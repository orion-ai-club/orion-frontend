import { fetchClient, API_BASE_URL } from './core';
import { toast } from '../components/Toast';
import {
  ChatMessage,
  Todo,
  FitnessRecord,
  FitnessStats,
  PeriodRecord,
  PeriodResponse,
  Footprint,
  FootprintStats,
  Menu,
  DrawResponse,
  DailyListResponse,
  DailyListType,
  SmartMenuResponse,
  CloudinaryUsage,
  Conversation,
  R2UsageStats,
  PaginatedResponse
} from '../types';

export const featureService = {
  // --- Chat ---
  getPublicChatHistory: async (roomName: string): Promise<ChatMessage[]> => {
    try {
      const res = await fetchClient<any[]>(`/chat/public/${roomName}`);
      return res.map((msg) => ({
        message: msg.content || msg.message,
        author: msg.user?.name || msg.user?.displayName || 'Unknown',
        userId: msg.user?.id || msg.user?._id,
        email: msg.user?.email || msg.email,
        timestamp: msg.createdDate || msg.date,
        isPrivate: false,
        room: msg.room
      }));
    } catch (e) {
      console.warn('Public chat history fetch failed', e);
      return [];
    }
  },

  getPrivateChatHistory: async (targetUserId: string): Promise<ChatMessage[]> => {
    try {
      const res = await fetchClient<any[]>(`/chat/private/${targetUserId}`);
      return res.map((msg) => {
        let sender: any = {};
        let senderId = '';

        if (msg.user && typeof msg.user === 'object') {
          sender = msg.user;
          senderId = sender._id || sender.id;
          if (sender.id && typeof sender.id === 'object') {
            sender = sender.id;
            senderId = sender._id || sender.id;
          }
        } else if (msg.fromUser && typeof msg.fromUser === 'object') {
          sender = msg.fromUser;
          senderId = sender._id || sender.id;
        } else {
          senderId = msg.fromUserId || msg.userId || (typeof msg.user === 'string' ? msg.user : '');
        }

        let receiverId = '';
        if (msg.toUser && typeof msg.toUser === 'object') {
          receiverId = msg.toUser._id || msg.toUser.id;
        } else {
          receiverId = msg.toUserId || msg.toUser || msg.receiver;
        }

        return {
          message: msg.content || msg.message,
          timestamp: msg.createdDate || msg.date || msg.timestamp,
          author: sender.displayName || sender.name || msg.author || 'Unknown',
          userId: senderId,
          email: sender.email || msg.email,
          photoURL: sender.photoURL || msg.photoURL,
          isPrivate: true,
          receiver: receiverId
        };
      });
    } catch (e) {
      console.warn('Private chat history fetch failed', e);
      return [];
    }
  },

  // --- AI Chat History (Session Based) ---

  // Get List of Conversations
  getAiConversations: async (): Promise<Conversation[]> => {
    return await fetchClient<Conversation[]>('/chat/ai/conversations');
  },

  // Get messages for a specific session
  getAiChatHistory: async (sessionId?: string, page = 1, limit = 20): Promise<any[]> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    if (sessionId) {
      params.append('sessionId', sessionId);
    }
    return await fetchClient<any[]>(`/chat/ai?${params.toString()}`);
  },

  // Save message to specific session
  saveAiChatMessage: async (
    text: string,
    role: 'user' | 'ai',
    sessionId: string,
    images?: string[]
  ): Promise<any> => {
    return await fetchClient('/chat/ai/save', {
      method: 'POST',
      body: JSON.stringify({ text, role, sessionId, images })
    });
  },

  // Delete a conversation session
  deleteAiConversation: async (sessionId: string): Promise<any> => {
    return await fetchClient(`/chat/ai/conversation/${sessionId}`, {
      method: 'DELETE'
    });
  },

  clearAiChatHistory: async (): Promise<any> => {
    // Legacy: Clears ALL history (dangerous, kept for admin or legacy support)
    return await fetchClient('/chat/ai', {
      method: 'DELETE'
    });
  },

  // --- Second Brain (God Mode) Streaming ---
  askLifeStream: async (
    prompt: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    onChunk: (text: string) => void,
    images?: string[] | null
  ): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No auth token');

    try {
      // Updated endpoint path to include /ai prefix
      const response = await fetch(`${API_BASE_URL}/ai/ask-life/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        // We pass the prompt, history, and images (array) to the streaming endpoint.
        body: JSON.stringify({ prompt, history, images })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } catch (e) {
      console.error('Streaming error:', e);
      throw e;
    }
  },

  // --- Bucket List (Todos) ---
  getTodos: async (
    page: number = 1,
    limit: number = 20,
    type?: string,
    keyword?: string,
    isActive?: boolean | string
  ): Promise<PaginatedResponse<Todo>> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (type) params.append('type', type);
      if (keyword) params.append('keyword', keyword);
      if (isActive !== undefined) params.append('isActive', isActive.toString());

      return await fetchClient<PaginatedResponse<Todo>>(`/todo?${params.toString()}`);
    } catch (e) {
      console.error('Fetch todos failed', e);
      return {
        data: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }
  },

  addTodo: async (
    todo: string,
    description?: string,
    targetDate?: string,
    images?: string[],
    type?: 'wish' | 'routine',
    recurrence?: string,
    remindAt?: string,
    options?: { notifyUsers?: string[]; bark?: any; isActive?: boolean }
  ): Promise<Todo[]> => {
    const payload = {
      todo,
      description,
      targetDate,
      images,
      type,
      recurrence,
      remindAt,
      ...(options || {})
    };

    const res = await fetchClient<Todo[]>('/todo', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    toast.success('Added to the list!');
    return res;
  },

  updateTodo: async (id: string, updates: Partial<Todo>): Promise<Todo[]> => {
    const payload: any = { ...updates };
    return await fetchClient<Todo[]>(`/todo/done/${id}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  checkRoutine: async (id: string): Promise<{ success: boolean; nextRun: string; msg: string }> => {
    return await fetchClient(`/todo/routine/${id}/check`, {
      method: 'POST'
    });
  },

  testRoutine: async (id: string): Promise<{ success: boolean; msg: string }> => {
    return await fetchClient(`/todo/routine/${id}/test`, {
      method: 'POST'
    });
  },

  deleteTodo: async (id: string): Promise<void> => {
    await fetchClient(`/todo/${id}`, {
      method: 'DELETE'
    });
    toast.success('Removed from list.');
  },

  toggleTodo: async (id: string): Promise<Todo[]> => {
    throw new Error('Use updateTodo instead');
  },

  // --- Hot Search & News (Unified Daily List) ---
  getDailyList: async (type: DailyListType, force = false): Promise<DailyListResponse> => {
    const params = new URLSearchParams({ type });
    if (force) params.append('force', 'true');
    return await fetchClient<DailyListResponse>(`/external/daily-list?${params.toString()}`);
  },

  // Backward compatibility methods if needed (can be removed if all components updated)
  getHotSearch: async (force = false): Promise<DailyListResponse> => {
    return featureService.getDailyList('hotsearch', force);
  },

  getFinanceNews: async (force = false): Promise<DailyListResponse> => {
    return featureService.getDailyList('finance', force);
  },

  // --- Fitness ---
  updateFitnessGoal: async (
    goal: 'cut' | 'bulk' | 'maintain',
    userId?: string
  ): Promise<{ success: boolean; msg: string; goal: string }> => {
    return await fetchClient<{ success: boolean; msg: string; goal: string }>(
      '/users/fitness-goal',
      {
        method: 'PUT',
        body: JSON.stringify({ goal, userId })
      }
    );
  },

  getFitnessRecords: async (start?: string, end?: string): Promise<FitnessRecord[]> => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return await fetchClient<FitnessRecord[]>(`/fitness?${params.toString()}`);
  },

  getFitnessPhotos: async (start?: string, end?: string): Promise<FitnessRecord[]> => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return await fetchClient<FitnessRecord[]>(`/fitness/photos?${params.toString()}`);
  },

  submitFitnessRecord: async (data: FitnessRecord): Promise<FitnessRecord> => {
    const res = await fetchClient<FitnessRecord>('/fitness', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    toast.success('Fitness record saved.');
    return res;
  },

  getFitnessStats: async (days: number = 30, email?: string): Promise<FitnessStats> => {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    if (email) params.append('email', email);
    return await fetchClient<FitnessStats>(`/fitness/stats?${params.toString()}`);
  },

  // --- Period / Cycle Tracker ---
  getPeriodData: async (targetUserId?: string): Promise<PeriodResponse> => {
    const q = targetUserId ? `?targetUserId=${targetUserId}` : '';
    return await fetchClient<PeriodResponse>(`/period${q}`);
  },

  savePeriodRecord: async (
    data: Partial<PeriodRecord>,
    targetUserId?: string
  ): Promise<PeriodResponse> => {
    const body = { ...data, targetUserId };
    if (data._id) {
      return await fetchClient<PeriodResponse>(`/period/${data._id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
    } else {
      return await fetchClient<PeriodResponse>('/period', {
        method: 'POST',
        body: JSON.stringify(body)
      });
    }
  },

  deletePeriodRecord: async (id: string): Promise<void> => {
    await fetchClient(`/period/${id}`, {
      method: 'DELETE'
    });
  },

  // --- Footprint / Star Map ---
  getFootprints: async (status?: string): Promise<{ stats: FootprintStats; data: Footprint[] }> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    return await fetchClient<{ stats: FootprintStats; data: Footprint[] }>(
      `/footprints?${params.toString()}`
    );
  },

  createFootprint: async (data: Partial<Footprint>): Promise<Footprint> => {
    const res = await fetchClient<Footprint>('/footprints', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    toast.success('Footprint added!');
    return res;
  },

  updateFootprint: async (id: string, data: Partial<Footprint>): Promise<Footprint> => {
    const res = await fetchClient<Footprint>(`/footprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    toast.success('Footprint updated!');
    return res;
  },

  deleteFootprint: async (id: string): Promise<void> => {
    await fetchClient(`/footprints/${id}`, {
      method: 'DELETE'
    });
    toast.success('Footprint deleted.');
  },

  // --- Menu / Chef's Wheel ---
  getMenus: async (category?: string): Promise<Menu[]> => {
    const q = category ? `?category=${category}` : '';
    return await fetchClient<Menu[]>(`/menu${q}`);
  },

  drawMenu: async (category?: string, cooldown = false, healthy = false): Promise<DrawResponse> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (cooldown) params.append('cooldown', 'true');
    if (healthy) params.append('healthy', 'true');
    return await fetchClient<DrawResponse>(`/menu/draw?${params.toString()}`);
  },

  createMenu: async (data: Partial<Menu>): Promise<Menu> => {
    return await fetchClient<Menu>('/menu', { method: 'POST', body: JSON.stringify(data) });
  },

  updateMenu: async (id: string, data: Partial<Menu>): Promise<Menu> => {
    return await fetchClient<Menu>(`/menu/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteMenu: async (id: string): Promise<void> => {
    await fetchClient(`/menu/${id}`, { method: 'DELETE' });
  },

  confirmMenu: async (id: string, mealTime?: string): Promise<any> => {
    return await fetchClient(`/menu/confirm/${id}`, {
      method: 'POST',
      body: JSON.stringify({ mealTime })
    });
  },

  getSmartMenuRecommendation: async (): Promise<SmartMenuResponse> => {
    return await fetchClient<SmartMenuResponse>('/menu/recommend', { method: 'POST' });
  },

  // --- Recipe & AI ---
  getRecipeDetails: async (name: string): Promise<any[]> => {
    return await fetchClient<any[]>(`/external/recipe/detail?name=${encodeURIComponent(name)}`);
  },

  getRecipeRecommendation: async (dishName: string): Promise<any> => {
    return await fetchClient<any>('/ai/recipe-recommend', {
      method: 'POST',
      body: JSON.stringify({ dishName })
    });
  },

  // --- Cloudinary Usage ---
  getCloudinaryUsage: async (): Promise<CloudinaryUsage> => {
    return await fetchClient<CloudinaryUsage>('/cloudinary/usage');
  },

  // --- R2 Resource Management ---
  getR2Files: async (
    limit = 50,
    cursor?: string,
    type: 'all' | 'resource' | 'backup' = 'all',
    folder: string = ''
  ): Promise<any> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      type: type
    });
    if (cursor) params.append('cursor', cursor);
    if (folder) params.append('folder', folder);

    return await fetchClient(`/upload/list?${params.toString()}`);
  },

  getR2ObjectBlob: async (key: string): Promise<Blob> => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) headers['x-auth-token'] = token;

    const response = await fetch(
      `${API_BASE_URL}/upload/object?key=${encodeURIComponent(key)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to read R2 object: ${response.status}`);
    }

    return await response.blob();
  },

  deleteR2File: async (key: string): Promise<void> => {
    await fetchClient('/upload', {
      method: 'DELETE',
      body: JSON.stringify({ key })
    });
    // No toast here to allow custom messages in component
  },

  // --- R2 Presigned Upload Flow ---

  // 1. Get the Presigned URL from Backend
  getPresignedUrl: async (
    fileName: string,
    fileType: string,
    folder: string = '',
    useOriginalName: boolean = true
  ): Promise<{
    uploadUrl: string;
    url: string | null;
    publicUrl: string | null;
    customUrl: string | null;
    r2Url: string | null;
    key: string;
    folder: string;
  }> => {
    // Fallback for missing fileType
    const safeType = fileType || 'application/octet-stream';

    return await fetchClient('/upload/presign', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType: safeType, folder, useOriginalName })
    });
  },

  // 2. Perform the direct PUT to R2/S3
  uploadToPresignedUrl: async (uploadUrl: string, file: File): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    });

    if (!response.ok) {
      throw new Error(`Direct upload failed: ${response.statusText}`);
    }
  },

  // Combined Helper for simple uploads
  uploadFileToR2Presigned: async (
    file: File,
    folder: string = '',
    useOriginalName: boolean = true
  ): Promise<string> => {
    // Step 1: Get Sign
    const { uploadUrl, url, publicUrl, r2Url } = await featureService.getPresignedUrl(
      file.name,
      file.type,
      folder,
      useOriginalName
    );

    // Step 2: Put File
    await featureService.uploadToPresignedUrl(uploadUrl, file);

    const readUrl = url || publicUrl || r2Url;
    if (!readUrl) throw new Error('R2 presign returned no public read URL');
    return readUrl;
  },

  // Helper to "Create Folder" by uploading a dummy .keep file
  createR2Folder: async (folderName: string, parentFolder: string = ''): Promise<void> => {
    const dummyFile = new File([''], '.keep', { type: 'application/x-empty' });
    const targetPath = parentFolder ? `${parentFolder}${folderName}/` : `${folderName}/`;

    // We treat the "folder" param as the full path for the presign, excluding the filename
    // Or we can pass folder=targetPath and fileName=.keep
    const { uploadUrl } = await featureService.getPresignedUrl(
      '.keep',
      'application/x-empty',
      targetPath,
      true // Force exact name to keep structure
    );

    await featureService.uploadToPresignedUrl(uploadUrl, dummyFile);
  },

  // Legacy Multipart Upload (kept for backup or small files if needed)
  uploadFileToR2Multipart: async (file: File, folder: string = ''): Promise<string> => {
    const formData = new FormData();

    // Explicitly append metadata fields FIRST
    formData.append('fileType', file.type || 'application/octet-stream');
    formData.append('fileName', file.name);

    if (folder) {
      formData.append('folder', folder);
    }

    // Append File LAST
    formData.append('files', file);

    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) headers['x-auth-token'] = token;

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`R2 Upload Failed: ${response.status} ${errText}`);
    }

    const data = await response.json();

    // The backend selects the current delivery domain; API writes normalize it to a key.
    if (data.url || data.publicUrl) {
      return data.url || data.publicUrl;
    }

    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const uploaded = data.data[0];
      if (uploaded.url || uploaded.publicUrl) return uploaded.url || uploaded.publicUrl;
      if (uploaded.r2Url) return uploaded.r2Url;
    }

    if (data.r2Url) {
      return data.r2Url;
    }

    if (data.success && data.urls && data.urls.length > 0) {
      return data.urls[0];
    }

    throw new Error('R2 Upload returned no URLs');
  },

  // NEW: Get R2 Usage Stats
  getR2Usage: async (): Promise<R2UsageStats> => {
    const res = await fetchClient<{ success: boolean; usage: R2UsageStats }>('/upload/r2/usage');
    return res.usage;
  },

  // NEW: Get Backup Stream (Returns raw Response)
  getBackupStream: async (): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/backup/database`, {
      method: 'POST',
      headers: {
        'x-auth-token': token || '',
        'Content-Type': 'application/json'
      }
    });
    return response;
  }
};
