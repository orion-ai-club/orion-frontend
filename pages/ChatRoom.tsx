import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { User, ChatMessage, ChatUser } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { toast } from '../components/Toast';
import { apiService } from '../services/api';

interface ChatRoomProps {
  currentUser: User | null;
  socket: Socket | null;
  targetUser?: ChatUser | null;
}

const EVENTS = {
  CONFIRM_USER: 'CONFIRM_USER',
  USER_CONNECTED: 'USER_CONNECTED',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  PRIVATE_MESSAGE: 'PRIVATE_MESSAGE',
  TYPING: 'TYPING',
  STOP_TYPING: 'STOP_TYPING',
  LOGOUT: 'LOGOUT',
  ROOM_WELCOME: 'ROOM_WELCOME'
};

// Priority Emails for sorting
const PRIORITY_EMAILS = ['moviegoer24@gmail.com', 'cenniferchen@gmail.com'];

export const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, socket, targetUser }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Real-time online presence from Socket
  const [onlineUsers, setOnlineUsers] = useState<Record<string, ChatUser>>({});

  // Full User Directory from API (for the list)
  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [dirPage, setDirPage] = useState(1);
  const [hasMoreDir, setHasMoreDir] = useState(true);
  const [isLoadingDir, setIsLoadingDir] = useState(false);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Replaced string receiver with ChatUser object to better handle IDs for history
  const [activeUser, setActiveUser] = useState<ChatUser | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto scroll to bottom of the chat container ONLY
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeUser]);

  // Handle external navigation request (targetUser prop)
  useEffect(() => {
    if (targetUser) {
      setActiveUser((previous) => (previous?.id === targetUser.id ? previous : targetUser));
    }
  }, [targetUser]);

  // Fetch Directory Users (Pagination)
  const fetchDirectory = useCallback(async (page: number) => {
    setIsLoadingDir(true);
    try {
      const { data, pagination } = await apiService.getUsers(page, 20, '', 'vip', 'desc');

      setDirectoryUsers((prev) => {
        const newUsers = page === 1 ? data : [...prev, ...data];
        return Array.from(new Map(newUsers.map((u) => [u._id, u])).values());
      });
      setHasMoreDir(pagination.hasNextPage);
    } catch (e) {
      console.error('Failed to load user directory', e);
    } finally {
      setIsLoadingDir(false);
    }
  }, []);

  useEffect(() => {
    void fetchDirectory(1);
  }, [fetchDirectory]);

  const loadMoreUsers = () => {
    if (hasMoreDir && !isLoadingDir) {
      const nextPage = dirPage + 1;
      setDirPage(nextPage);
      fetchDirectory(nextPage);
    }
  };

  // Process User List for Display
  const processedUserList = useMemo(() => {
    if (!currentUser) return [];

    // 1. Create Map from Directory
    let combined = [...directoryUsers];
    if (!combined.find((u) => u._id === currentUser._id)) {
      combined.unshift(currentUser);
    }

    // 2. Sort Logic
    combined.sort((a, b) => {
      const emailA = (a.email || '').toLowerCase();
      const emailB = (b.email || '').toLowerCase();

      const isAPriority = PRIORITY_EMAILS.includes(emailA);
      const isBPriority = PRIORITY_EMAILS.includes(emailB);

      if (isAPriority && !isBPriority) return -1;
      if (!isBPriority && isAPriority) return 1;
      if (isAPriority && isBPriority) {
        // Keep internal order of priority list
        return PRIORITY_EMAILS.indexOf(emailA) - PRIORITY_EMAILS.indexOf(emailB);
      }

      if (a.vip && !b.vip) return -1;
      if (!a.vip && b.vip) return 1;

      return 0;
    });

    return combined;
  }, [directoryUsers, currentUser]);

  // Helper to check online status
  const isUserOnline = (userId: string) => {
    return Object.values(onlineUsers).some((u: ChatUser) => u.id === userId);
  };

  // Fetch History Logic
  useEffect(() => {
    if (!currentUser) return;

    const loadHistory = async () => {
      let history: ChatMessage[] = [];
      try {
        if (activeUser) {
          // Private History
          history = await apiService.getPrivateChatHistory(activeUser.id);
        } else {
          // Public History
          const raw = await apiService.getPublicChatHistory('public');
          history = raw.map((m: any) => ({
            ...m,
            isPrivate: false,
            room: 'public'
          }));
        }

        // Replace current messages state with history to prevent duplicates and ensure clean slate on switch
        // Sorting by timestamp to ensure order
        const sortedHistory = history.sort(
          (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        );
        setMessages(sortedHistory);
      } catch (e) {
        console.error('History load error', e);
      }
    };

    // Clear previous messages when switching rooms, then load
    setMessages([]);
    loadHistory();
  }, [activeUser, currentUser]);

  useEffect(() => {
    if (!currentUser || !socket) return;

    // 1. Listen for Global/Room Welcome
    const handleWelcome = (data: { user: string; message: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          author: data.user,
          message: data.message,
          isSystem: true,
          timestamp: new Date().toISOString()
        }
      ]);
    };

    // 2. Update Online Users List
    const handleUserConnected = (users: Record<string, ChatUser>) => {
      setOnlineUsers(users);
    };

    // 3. Receive Public Messages (Normalized)
    const handleMessageReceived = (rawMsg: any) => {
      // Check if this is truly a public message
      // Allow if room is explicitly public OR undefined/null (some backends broadcast generally)
      if (rawMsg.room && rawMsg.room !== 'public') return;

      // Normalize: Backend sends { user: { displayName, id... }, message: "..." }
      const normalizedMsg: ChatMessage = {
        message: rawMsg.message || rawMsg.content,
        timestamp: rawMsg.createdDate || rawMsg.timestamp || new Date().toISOString(),
        isPrivate: false,
        room: 'public',
        // Critical: extract from nested user object if present
        author: rawMsg.user?.displayName || rawMsg.user?.name || rawMsg.author || 'Unknown',
        userId: rawMsg.user?.id || rawMsg.user?._id || rawMsg.userId,
        email: rawMsg.user?.email || rawMsg.email,
        photoURL: rawMsg.user?.photoURL || rawMsg.photoURL
      };

      setMessages((prev) => [...prev, normalizedMsg]);
    };

    // 4. Receive Private Messages (Normalized & Filtered)
    const handlePrivateMessage = (rawMsg: any) => {
      const myId = currentUser._id;

      // Identify Sender and Receiver IDs for robust filtering
      const senderObj = rawMsg.user || {};
      // Handle varied structure (sender might be flat id or object)
      const senderId = senderObj.id || senderObj._id || rawMsg.fromUserId || rawMsg.userId;

      // OPTIMISTIC UPDATE HANDLING:
      // The backend echoes the message back to the sender.
      // However, the echo payload does NOT contain the receiver ID.
      // Without receiver ID, we can't incorrectly route the echo to the active chat window (which might be for a different user).
      // Therefore, we use Optimistic Updates in `handleSendMessage` and IGNORE the echo from ourselves here.
      if (senderId === myId) {
        return;
      }

      // For Incoming Messages (from others):
      // The backend sends to our room. Receiver ID is implicitly ME if not present.
      let receiverId = rawMsg.receiver || rawMsg.toUserId || rawMsg.toUser;
      if (!receiverId) {
        receiverId = myId;
      }

      // CRITICAL: Security & Relevance Filter
      // We only accept messages sent TO us (from others).
      if (receiverId !== myId) {
        return;
      }

      // Normalize backend payload
      const msg: ChatMessage = {
        message: rawMsg.message || rawMsg.content,
        timestamp: rawMsg.timestamp || rawMsg.createdDate || new Date().toISOString(),
        isPrivate: true,
        author: senderObj.displayName || senderObj.name || rawMsg.author || 'Unknown',
        userId: senderId,
        email: senderObj.email || rawMsg.email,
        photoURL: senderObj.photoURL || rawMsg.photoURL,
        receiver: receiverId
      };

      // Add message to state. Display filtering happens in render/filteredMessages.
      setMessages((prev) => [...prev, msg]);
    };

    // 5. Typing Indicators
    const handleTyping = ({ user, isTyping }: { user: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(user);
        else next.delete(user);
        return next;
      });
    };

    const handleStopTyping = ({ user }: { user: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(user);
        return next;
      });
    };

    // Attach Listeners
    socket.on(EVENTS.ROOM_WELCOME, handleWelcome);
    socket.on(EVENTS.USER_CONNECTED, handleUserConnected);
    socket.on(EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
    socket.on(EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
    socket.on(EVENTS.TYPING, handleTyping);
    socket.on(EVENTS.STOP_TYPING, handleStopTyping);

    return () => {
      socket.off(EVENTS.ROOM_WELCOME, handleWelcome);
      socket.off(EVENTS.USER_CONNECTED, handleUserConnected);
      socket.off(EVENTS.MESSAGE_RECEIVED, handleMessageReceived);
      socket.off(EVENTS.PRIVATE_MESSAGE, handlePrivateMessage);
      socket.off(EVENTS.TYPING, handleTyping);
      socket.off(EVENTS.STOP_TYPING, handleStopTyping);
    };
  }, [socket, currentUser]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !currentUser) return;

    if (activeUser) {
      // 1. Optimistic Update (Immediate Display)
      const optimisticMsg: ChatMessage = {
        message: inputText,
        author: currentUser.displayName,
        userId: currentUser._id,
        email: currentUser.email,
        photoURL: currentUser.photoURL,
        timestamp: new Date().toISOString(),
        isPrivate: true,
        receiver: activeUser.id // Important for filtering in UI
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      // 2. Send to Backend
      socket.emit(EVENTS.PRIVATE_MESSAGE, {
        receiverName: activeUser.name, // Backend uses this to find socket
        toUserId: activeUser.id,
        message: inputText,
        room: 'private'
      });
    } else {
      // Send Public
      socket.emit(EVENTS.MESSAGE_SENT, {
        message: inputText,
        room: 'public'
      });
      // Public usually echoes back via MESSAGE_RECEIVED with full data, so no optimistic needed
    }

    // Stop typing status immediately
    socket.emit(EVENTS.STOP_TYPING, { chatId: 'public' });
    setInputText('');
    setIsTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit(EVENTS.TYPING, { chatId: 'public', isTyping: true });
    }

    // Debounce stop typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit(EVENTS.STOP_TYPING, { chatId: 'public' });
    }, 2000);
  };

  if (!currentUser) {
    return <div className="pt-32 text-center text-white">Access Denied. Please Login.</div>;
  }

  // FILTER MESSAGES BASED ON CHANNEL
  const filteredMessages = messages.filter((msg) => {
    if (activeUser) {
      // Private Channel Filtering
      if (!msg.isPrivate) return false;

      const myId = String(currentUser._id);
      const partnerId = String(activeUser.id);
      const msgUserId = String(msg.userId); // Sender ID
      const msgReceiver = String(msg.receiver); // Receiver ID (or name in legacy)

      // 1. Incoming: Message is FROM activeUser
      // Check both ID equality and if message was meant for me
      const isFromPartner = msgUserId === partnerId;

      // 2. Outgoing: Message is FROM me AND TO activeUser
      const isFromMe = msgUserId === myId;
      const isToPartner = msgReceiver === partnerId || msgReceiver === activeUser.name;

      return isFromPartner || (isFromMe && isToPartner);
    } else {
      // Public Channel Filtering
      return !msg.isPrivate;
    }
  });

  const connectionStatus = socket?.connected ? 'Connected' : 'Connecting...';

  return (
    <div className="h-screen pt-24 pb-6 px-4 md:px-6 relative flex flex-col items-center justify-center overflow-hidden">
      {/* HUD Background Decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl"></div>
        {/* Grid Lines */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
        <div className="absolute top-24 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
        <div className="absolute bottom-10 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
      </div>

      <div className="w-full max-w-7xl h-full flex flex-col md:flex-row gap-6 relative z-10">
        {/* LEFT PANEL: Crew Manifest (Users) */}
        <div className="w-full md:w-80 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center">
            <h3 className="font-display font-bold text-cyan-400 uppercase tracking-widest text-sm">
              <i className="fas fa-users-cog mr-2"></i> {t.chat.crewManifest}
            </h3>
            <span className="text-xs font-mono text-emerald-400 animate-pulse">
              ● {Object.keys(onlineUsers).length} Online
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {/* Public Channel Selector */}
            <button
              onClick={() => setActiveUser(null)}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all ${!activeUser ? 'bg-cyan-900/30 border border-cyan-500/30 text-cyan-300' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600">
                <i className="fas fa-satellite-dish text-xs"></i>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{t.chat.publicChannel}</div>
                <div className="text-[10px] opacity-60">Global Broadcast</div>
              </div>
              {!activeUser && <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>}
            </button>

            <div className="my-2 h-px bg-slate-700/50 mx-2"></div>

            {/* Users List */}
            {processedUserList.map((u) => {
              const isMe = u._id === currentUser._id;
              const isActive = activeUser?.id === u._id;
              const online = isUserOnline(u._id);
              const isPriority = PRIORITY_EMAILS.includes(u.email);

              return (
                <button
                  key={u._id}
                  onClick={() =>
                    !isMe && setActiveUser({ id: u._id, name: u.displayName, email: u.email })
                  }
                  disabled={isMe}
                  className={`w-full text-left p-2 rounded-lg flex items-center gap-3 transition-all border ${
                    isActive
                      ? 'bg-amber-900/20 border-amber-500/40 text-amber-200'
                      : isMe
                        ? 'border-transparent opacity-50 cursor-default'
                        : 'border-transparent text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`w-8 h-8 rounded-full overflow-hidden bg-slate-700 ring-1 ${u.vip ? 'ring-amber-500' : 'ring-slate-600'}`}
                    >
                      <img
                        src={
                          u.photoURL ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=random`
                        }
                        alt={u.displayName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                    )}
                    {isPriority && !online && (
                      <div className="absolute -top-1 -right-1 text-[8px] text-amber-400">
                        <i className="fas fa-crown"></i>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate flex items-center gap-1">
                      {u.displayName} {isMe && `(${t.chat.me})`}
                      {u.vip && <i className="fas fa-star text-[8px] text-amber-500"></i>}
                    </div>
                    {typingUsers.has(u.displayName) ? (
                      <div className="text-[10px] text-emerald-400 animate-pulse font-mono">
                        {t.chat.typing}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 truncate">
                        {u.vip ? 'VIP Officer' : 'Crew'}
                      </div>
                    )}
                  </div>
                  {isActive && <div className="w-2 h-2 bg-amber-400 rounded-full"></div>}
                </button>
              );
            })}

            {/* Load More Button */}
            {hasMoreDir && (
              <button
                onClick={loadMoreUsers}
                className="w-full py-2 text-[10px] text-slate-500 uppercase font-bold hover:text-cyan-400 hover:bg-cyan-900/10 rounded transition-colors"
              >
                {isLoadingDir ? 'Loading...' : 'Load More Users'}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Chat Interface */}
        <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
          {/* Header */}
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${activeUser ? 'bg-amber-500' : 'bg-cyan-500'} animate-pulse`}
              ></div>
              <div>
                <h2 className="font-bold text-white tracking-wide">
                  {activeUser ? `@ ${activeUser.name}` : t.chat.publicChannel}
                </h2>
                <p className="text-[10px] font-mono text-slate-400 uppercase">
                  {activeUser ? t.chat.privateChannel : t.chat.subtitle}
                </p>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-500 border border-slate-700 px-2 py-1 rounded">
              {connectionStatus}
            </div>
          </div>

          {/* Messages Area - Uses ScrollTop for stable scrolling */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-slate-900 to-slate-950"
          >
            {filteredMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                <i className="fas fa-satellite text-4xl mb-4 opacity-50"></i>
                <p className="font-mono text-sm">
                  {activeUser ? 'Start a private conversation...' : t.chat.connecting}
                </p>
              </div>
            )}

            {filteredMessages.map((msg, idx) => {
              // Robust isMe Check
              const isMe = String(msg.userId) === String(currentUser._id);
              const isSystem = msg.isSystem;

              // System Message
              if (isSystem) {
                return (
                  <div key={idx} className="flex justify-center my-4">
                    <span className="px-3 py-1 bg-cyan-900/30 text-cyan-400 text-xs font-mono border border-cyan-500/20 rounded-full">
                      {msg.message}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-fade-in`}
                >
                  <div
                    className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {msg.author}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        {new Date(msg.timestamp || '').toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div
                      className={`
                             relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg border
                             ${
                               isMe
                                 ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-tr-sm border-indigo-500/50'
                                 : msg.isPrivate
                                   ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 text-amber-100 rounded-tl-sm border-amber-500/30'
                                   : 'bg-slate-800 text-slate-200 rounded-tl-sm border-slate-700'
                             }
                          `}
                    >
                      {msg.isPrivate && (
                        <div className="absolute -top-2 -right-2 text-[10px] bg-black/50 backdrop-blur px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-500 flex items-center gap-1">
                          <i className="fas fa-lock text-[8px]"></i> {t.chat.encrypted}
                        </div>
                      )}
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-900/90 border-t border-slate-700/50">
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={handleTyping}
                  placeholder={
                    activeUser ? `${t.chat.send} @${activeUser.name}...` : t.chat.placeholder
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none text-white placeholder-slate-600 transition-all font-mono text-sm"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <i className="fas fa-keyboard"></i>
                </div>
              </div>
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg flex items-center gap-2 ${
                  activeUser
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span>{t.chat.send}</span>
                <i className="fas fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
