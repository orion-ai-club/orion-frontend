import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { featureService } from '../../services/featureService';
import { uploadImage } from '../../services/media';
import { User, Conversation } from '../../types';
import { toast } from '../../components/Toast';
import { DeleteModal } from '../../components/DeleteModal';
import { R2ImageSelectorModal } from '../../components/R2ImageSelectorModal';
import { createPortal } from 'react-dom';
import { renderSafeMarkdown } from '../../utils/security';

// --- Types for Web Speech API ---
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface SecondBrainSpaceProps {
  user: User | null;
}

interface BrainMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  avatar?: string;
  name?: string;
  images?: string[];
}

const DEFAULT_AI_AVATAR = 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png';

// Helper to generate UUID-like string
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// --- OPTIMIZED SUB-COMPONENT: Memoized Message Item ---
const BrainMessageItem = React.memo(
  ({
    msg,
    onCopy,
    onImageClick
  }: {
    msg: BrainMessage;
    onCopy: (text: string) => void;
    onImageClick: (url: string) => void;
  }) => {
    const isUser = msg.role === 'user';
    const contentRef = useRef<HTMLDivElement>(null);

    // 1. Memoize Markdown Parsing to prevent re-parsing static history
    const htmlContent = useMemo(
      () => (msg.content ? renderSafeMarkdown(msg.content) : ''),
      [msg.content]
    );

    // 2. Scoped Syntax Highlighting: Only highlight code blocks within THIS message
    useEffect(() => {
      if (contentRef.current && window.hljs && !isUser) {
        contentRef.current.querySelectorAll('pre code').forEach((block) => {
          // Simple check to avoid double-highlighting if hljs doesn't handle it
          if (!block.hasAttribute('data-highlighted')) {
            window.hljs.highlightElement(block as HTMLElement);
          }
        });
      }
    }, [htmlContent, isUser]);

    return (
      <div
        className={`w-full py-6 md:py-8 px-4 md:px-12 border-b border-black/5 ${isUser ? 'bg-[#212121]' : 'bg-[#212121]'}`}
      >
        <div className="max-w-3xl mx-auto flex gap-4 md:gap-6">
          {/* Avatar */}
          <div className={`shrink-0 flex flex-col items-center ${isUser ? 'order-2' : 'order-1'}`}>
            <div
              className={`w-8 h-8 rounded-sm overflow-hidden flex items-center justify-center ${isUser ? 'bg-transparent' : 'bg-green-500/10'}`}
            >
              <img
                src={msg.avatar}
                alt={msg.role}
                className="w-full h-full object-cover rounded-sm"
                onError={(e) => (e.currentTarget.src = DEFAULT_AI_AVATAR)}
              />
            </div>
          </div>

          {/* Content Body */}
          <div className={`flex-1 min-w-0 ${isUser ? 'order-1 text-right' : 'order-2 text-left'}`}>
            <div className={`text-xs font-bold mb-2 ${isUser ? 'text-gray-400' : 'text-gray-200'}`}>
              {msg.name}
            </div>

            {/* Images */}
            {msg.images && msg.images.length > 0 && (
              <div
                className={`mb-3 ${isUser ? 'flex justify-end' : 'flex justify-start'} flex-wrap gap-2`}
              >
                {msg.images.map((imgUrl, imgIdx) => (
                  <div
                    key={imgIdx}
                    className="relative group max-w-[250px] rounded-lg overflow-hidden border border-white/10 cursor-zoom-in"
                    onClick={() => onImageClick(imgUrl)}
                  >
                    <img
                      src={imgUrl}
                      alt={`Attachment ${imgIdx}`}
                      className="w-full h-auto object-contain transition-transform group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            )}

            {isUser ? (
              // Only render user bubble if content exists
              msg.content ? (
                <div className="inline-block bg-[#2f2f2f] text-gray-100 px-4 py-2 md:px-5 md:py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap text-left shadow-sm">
                  {msg.content}
                </div>
              ) : null
            ) : (
              <div
                className="chat-content text-gray-300 text-sm md:text-[15px] leading-relaxed relative"
                ref={contentRef}
              >
                {msg.content ? (
                  <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                ) : (
                  <div className="flex items-center gap-1 h-6">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-500 rounded-full animate-bounce"></span>
                    <span
                      className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></span>
                    <span
                      className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    ></span>
                  </div>
                )}
                {msg.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-gray-400 ml-1 align-middle animate-pulse"></span>
                )}
              </div>
            )}

            {!isUser && !msg.isStreaming && msg.content && (
              <div className="flex items-center gap-4 mt-3 pt-2">
                <button
                  onClick={() => onCopy(msg.content)}
                  className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

// --- MAIN COMPONENT ---
export const SecondBrainSpace: React.FC<SecondBrainSpaceProps> = ({ user }) => {
  const { t, language } = useTranslation();

  // Session State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Delete Modal State
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Image Upload State
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);

  // Image Viewer State
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Voice Input State
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceTranscriptRef = useRef<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- 1. Load Conversations List on Mount ---
  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      try {
        const list = await featureService.getAiConversations();
        setConversations(list);

        if (list.length > 0) {
          handleSwitchSession(list[0].sessionId);
        } else {
          handleNewChat();
        }
      } catch (err) {
        console.error('Failed to init brain:', err);
        handleNewChat();
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  // --- 2. Action: Switch Session ---
  const handleSwitchSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsSidebarOpen(false);
    setMessages([]);
    setSelectedImages([]); // Clear any pending images

    try {
      const historyData = await featureService.getAiChatHistory(sessionId, 1, 50);

      if (historyData && historyData.length > 0) {
        const mappedMessages: BrainMessage[] = historyData.map((msg: any) => ({
          id: msg._id,
          role:
            msg.user && (msg.user.id === 'ai_assistant' || msg.user._id === 'ai_assistant')
              ? 'assistant'
              : 'user',
          content: msg.content || msg.text || '',
          timestamp: new Date(msg.createdDate || Date.now()),
          avatar:
            msg.user?.photoURL || (msg.user?.id === 'ai_assistant' ? DEFAULT_AI_AVATAR : undefined),
          name: msg.user?.displayName,
          // Robust mapping for images array from API response
          images: Array.isArray(msg.images) ? msg.images : msg.image ? [msg.image] : []
        }));
        setMessages(mappedMessages);
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to load session history', e);
    }
  };

  // --- 3. Action: New Chat ---
  const handleNewChat = () => {
    const newId = generateUUID();
    setCurrentSessionId(newId);
    setMessages([]);
    setSelectedImages([]);
    setIsSidebarOpen(false);
  };

  // --- 4. Action: Delete Session ---
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const sessionId = sessionToDelete;

    try {
      await featureService.deleteAiConversation(sessionId);
      setConversations((prev) => prev.filter((c) => c.sessionId !== sessionId));
      setSessionToDelete(null);

      if (currentSessionId === sessionId) {
        const remaining = conversations.filter((c) => c.sessionId !== sessionId);
        if (remaining.length > 0) {
          handleSwitchSession(remaining[0].sessionId);
        } else {
          handleNewChat();
        }
      }
    } catch (e) {
      toast.error('Failed to delete session');
    }
  };

  // --- Auto-scroll ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, selectedImages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // --- Voice Input Logic ---
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported.');
      return;
    }

    if (isRecording) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const langMap: Record<string, string> = {
      zh: 'zh-CN',
      'zh-HK': 'zh-HK',
      en: 'en-US',
      ja: 'ja-JP',
      fr: 'fr-FR',
      ru: 'ru-RU',
      de: 'de-DE',
      es: 'es-ES'
    };
    recognition.lang = langMap[language] || 'en-US';

    voiceTranscriptRef.current = '';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const allText = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      voiceTranscriptRef.current = allText;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error', event);
      if (event.error !== 'no-speech') {
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (isRecording) setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopAndSend = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsRecording(false);

    setTimeout(() => {
      const textToSend = voiceTranscriptRef.current.trim();
      if (textToSend) {
        handleSubmit(undefined, textToSend);
        voiceTranscriptRef.current = '';
      }
    }, 200);
  };

  // --- Image Handling ---
  const processFiles = async (files: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        validFiles.push(files[i]);
      }
    }

    if (validFiles.length === 0) {
      toast.error('Only image files are supported.');
      return;
    }

    // Process uploads sequentially or parallel, then update state
    const activeId = currentSessionId || 'temp';

    // Optimistic: We can't really do optimistic easily with raw files without reading them all to base64.
    // Let's just upload.
    try {
      for (const file of validFiles) {
        const uploadedUrl = await uploadImage(file, {
          folder: `ai-chat/${activeId}`,
          useOriginalName: false
        });
        setSelectedImages((prev) => [...prev, uploadedUrl]);
      }
      inputRef.current?.focus();
    } catch (e) {
      console.error('Image upload failed', e);
      toast.error('Failed to upload image(s).');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processFiles(files);
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Submission Logic ---
  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();

    const textToSend = overrideText !== undefined ? overrideText : input;

    if ((!textToSend.trim() && selectedImages.length === 0) || isProcessing) return;

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = generateUUID();
      setCurrentSessionId(activeSessionId);
    }

    const userText = textToSend.trim();
    // Copy images array to prevent modification during clear
    const userImages = [...selectedImages];
    const tempId = Date.now().toString();

    // 1. Optimistic Update (User Msg)
    const userMsg: BrainMessage = {
      id: tempId,
      role: 'user',
      content: userText,
      timestamp: new Date(),
      avatar: user?.photoURL,
      name: user?.displayName || 'User',
      images: userImages
    };

    setMessages((prev) => [...prev, userMsg]);

    if (overrideText === undefined) {
      setInput('');
    }
    setSelectedImages([]); // Clear pending images
    setIsProcessing(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      // 2. Save User Message
      await featureService.saveAiChatMessage(
        userText,
        'user',
        activeSessionId,
        userImages.length > 0 ? userImages : undefined
      );

      // 3. AI Placeholder
      const aiMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
          avatar: DEFAULT_AI_AVATAR,
          name: 'Second Brain'
        }
      ]);

      // 4. Stream AI Response
      const recentHistory = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content
      }));
      recentHistory.push({ role: 'user', content: userText });

      let fullAiResponse = '';

      await featureService.askLifeStream(
        userText,
        recentHistory,
        (chunk) => {
          fullAiResponse += chunk;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === aiMsgId) {
                // Update existing message content, BrainMessageItem will efficiently re-render
                return { ...m, content: m.content + chunk };
              }
              return m;
            })
          );
        },
        userImages.length > 0 ? userImages : undefined // Pass full array
      );

      // 5. Save AI Response
      if (fullAiResponse) {
        await featureService.saveAiChatMessage(fullAiResponse, 'ai', activeSessionId);
      }

      // 6. Refresh Sidebar
      const knownSession = conversations.find((c) => c.sessionId === activeSessionId);
      if (!knownSession) {
        setTimeout(async () => {
          const updatedList = await featureService.getAiConversations();
          setConversations(updatedList);
        }, 2000);
      } else {
        setConversations((prev) => {
          const others = prev.filter((c) => c.sessionId !== activeSessionId);
          return [{ ...knownSession, lastActiveAt: new Date().toISOString() }, ...others];
        });
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.isStreaming && last.role === 'assistant') {
          return prev.map((m) =>
            m.id === last.id
              ? {
                  ...m,
                  content: m.content + '\n\n*[Connection Error: Brain Offline]*',
                  isStreaming: false
                }
              : m
          );
        }
        return prev;
      });
    } finally {
      setMessages((prev) => prev.map((m) => ({ ...m, isStreaming: false })));
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  return (
    <div className="flex h-[calc(100vh-140px)] md:h-full relative max-w-7xl mx-auto w-full bg-[#171717] rounded-[2rem] border border-[#333] shadow-2xl overflow-hidden">
      {/* Full Screen Image Viewer */}
      {fullScreenImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[2200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setFullScreenImage(null)}
          >
            <button
              onClick={() => setFullScreenImage(null)}
              className="absolute top-4 right-4 text-white text-3xl hover:text-rose-500 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
            <img
              src={fullScreenImage}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              alt="Full View"
            />
          </div>,
          document.body
        )}

      <R2ImageSelectorModal
        isOpen={isR2ModalOpen}
        onClose={() => setIsR2ModalOpen(false)}
        onSelect={(url) => {
          setSelectedImages((prev) => [...prev, url]);
          setIsR2ModalOpen(false);
          inputRef.current?.focus();
        }}
      />

      <DeleteModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Conversation?"
        message="This action cannot be undone."
        requireInput={false}
        buttonText="Delete"
      />

      {/* --- LEFT SIDEBAR (History) --- */}
      <div
        className={`
          absolute inset-y-0 left-0 z-30 w-72 bg-[#171717] border-r border-[#333] transform transition-transform duration-300 md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-[#333]">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-bold transition-all text-sm"
            >
              <i className="fas fa-plus"></i> New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.sessionId}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${currentSessionId === conv.sessionId ? 'bg-[#2f2f2f] text-white' : 'text-gray-400 hover:bg-[#212121] hover:text-gray-200'}`}
                onClick={() => handleSwitchSession(conv.sessionId)}
              >
                <div className="flex items-center gap-3 truncate min-w-0">
                  <i className="fas fa-message text-xs"></i>
                  <span className="text-sm truncate">{conv.title || 'New Chat'}</span>
                </div>
                {currentSessionId === conv.sessionId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionToDelete(conv.sessionId);
                    }}
                    className="opacity-60 hover:opacity-100 hover:text-red-400 transition-opacity p-1"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>
                )}
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="text-center text-gray-600 text-xs py-10">No history yet</div>
            )}
          </div>

          <button
            className="md:hidden absolute top-4 right-4 text-gray-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* --- RIGHT MAIN CHAT --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#212121] relative">
        <div className="md:hidden p-4 border-b border-[#333] flex items-center gap-3 text-gray-200 bg-[#212121] z-10">
          <button onClick={() => setIsSidebarOpen(true)}>
            <i className="fas fa-bars"></i>
          </button>
          <span className="font-bold text-sm">Second Brain 3.0</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin"></div>
              <p className="text-xs uppercase tracking-widest">Loading Neural Net...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4 p-8 text-center">
              <div className="w-16 h-16 bg-[#333] rounded-full flex items-center justify-center text-3xl">
                🧠
              </div>
              <h3 className="text-xl font-bold text-gray-300">Second Brain</h3>
              <p className="text-sm max-w-md">
                I can remember your journals, check your fitness logs, and analyze your projects.
                How can I help today?
              </p>
            </div>
          ) : (
            <div className="flex flex-col pb-4">
              {messages.map((msg) => (
                <BrainMessageItem
                  key={msg.id}
                  msg={msg}
                  onCopy={copyToClipboard}
                  onImageClick={setFullScreenImage}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-6 bg-[#212121] border-t border-white/5 shrink-0">
          <div className="max-w-3xl mx-auto relative">
            {isDragging && (
              <div className="absolute inset-0 -top-12 -left-4 -right-4 -bottom-4 z-50 bg-[#212121]/90 backdrop-blur-sm border-2 border-dashed border-gray-500 rounded-xl flex items-center justify-center pointer-events-none">
                <span className="text-gray-200 font-bold text-lg animate-pulse">
                  Drop Image Here
                </span>
              </div>
            )}

            {/* Selected Images Preview List */}
            {selectedImages.length > 0 && (
              <div className="absolute -top-28 left-0 right-0 flex gap-3 overflow-x-auto p-2 z-20 custom-scrollbar pointer-events-auto">
                {selectedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group bg-[#2f2f2f] p-1.5 rounded-xl border border-gray-700 shadow-xl shrink-0 animate-slide-up"
                  >
                    <img
                      src={img}
                      alt="Preview"
                      className="h-20 w-auto rounded-lg object-contain"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-md border border-gray-800"
                    >
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className={`relative bg-[#2f2f2f] rounded-xl border transition-colors shadow-lg flex flex-col ${isDragging ? 'border-gray-400 bg-[#3a3a3a]' : 'border-gray-700 focus-within:border-gray-500'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="absolute left-2 md:left-3 bottom-2.5 flex items-center gap-2 z-20">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || isRecording}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <i className="fas fa-paperclip text-sm"></i>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                />

                {user?.role === 'super_admin' && (
                  <button
                    onClick={() => setIsR2ModalOpen(true)}
                    disabled={isProcessing || isRecording}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-white/10 transition-colors"
                    title="R2 Library"
                  >
                    <i className="fas fa-database text-sm"></i>
                  </button>
                )}

                <button
                  onClick={() => setIsVoiceMode(!isVoiceMode)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isVoiceMode ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title={isVoiceMode ? 'Switch to Text' : 'Switch to Voice'}
                >
                  <i className={`fas ${isVoiceMode ? 'fa-keyboard' : 'fa-microphone'} text-sm`}></i>
                </button>
              </div>

              {isVoiceMode ? (
                <div className="w-full h-14 pl-28 md:pl-32 pr-4 py-2">
                  <button
                    className={`w-full h-full rounded-lg font-bold text-sm uppercase tracking-widest transition-all select-none touch-none flex items-center justify-center gap-2 ${isRecording ? 'bg-emerald-500 text-white animate-pulse shadow-lg shadow-emerald-900/50' : 'bg-[#3a3a3a] text-gray-300 hover:bg-[#444]'}`}
                    onPointerDown={startRecording}
                    onPointerUp={stopAndSend}
                    onPointerLeave={stopAndSend}
                  >
                    {isRecording ? (
                      <>
                        <i className="fas fa-microphone-alt animate-bounce"></i> Listening...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-microphone"></i> Hold to Speak
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={t.privateSpace.secondBrain.placeholder}
                  className="w-full bg-transparent border-none outline-none py-3 pl-28 md:pl-32 pr-12 text-gray-200 placeholder:text-gray-500 resize-none max-h-32 md:max-h-48 min-h-[52px] text-sm leading-relaxed custom-scrollbar"
                  rows={1}
                  disabled={isProcessing}
                />
              )}

              {!isVoiceMode && (
                <button
                  onClick={(e) => handleSubmit(e)}
                  disabled={(!input.trim() && selectedImages.length === 0) || isProcessing}
                  className={`absolute right-2 bottom-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${!input.trim() && selectedImages.length === 0 ? 'bg-transparent text-gray-600 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'}`}
                >
                  {isProcessing ? (
                    <i className="fas fa-stop text-xs"></i>
                  ) : (
                    <i className="fas fa-arrow-up text-xs"></i>
                  )}
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-500 text-center mt-2 hidden md:block">
              AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .chat-content p { margin-bottom: 1em; }
        .chat-content p:last-child { margin-bottom: 0; }
        .chat-content h1, .chat-content h2, .chat-content h3 { color: #f3f4f6; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
        .chat-content ul, .chat-content ol { margin-left: 1.5em; margin-bottom: 1em; list-style-type: disc; }
        .chat-content ol { list-style-type: decimal; }
        .chat-content li { margin-bottom: 0.25em; }
        .chat-content strong { color: #fff; font-weight: 700; }
        .chat-content blockquote { border-left: 3px solid #4b5563; padding-left: 1em; color: #9ca3af; font-style: italic; }
        .chat-content code { background-color: #2f2f2f; padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #e5e7eb; }
        .chat-content pre { background-color: #0d0d0d; padding: 1em; border-radius: 8px; overflow-x: auto; margin: 1em 0; border: 1px solid #333; }
        .chat-content pre code { background-color: transparent; padding: 0; border-radius: 0; color: inherit; font-size: 0.85em; }
        .chat-content a { color: #60a5fa; text-decoration: underline; }
      `}</style>
    </div>
  );
};

export default SecondBrainSpace;

BrainMessageItem.displayName = 'BrainMessageItem';
