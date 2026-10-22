import { fetchClient, fetchEventStream } from './core';
import { toast } from '../components/Toast';
import { uploadImage } from './media';
import {
  BlogPost,
  Comment,
  User,
  Project,
  PortfolioProject,
  PortfolioImportPreview,
  PortfolioImportProgress,
  PortfolioAiCoverResponse,
  ResumeItem,
  ResumeData,
  Log,
  Photo,
  PaginatedResponse,
  PaginationData,
  Tag
} from '../types';

// Fallback data
const MOCK_BLOGS: BlogPost[] = [
  {
    _id: '1',
    name: 'The Evolution of Frontend Architecture',
    info: 'Why we moved from Monoliths to Micro-frontends and back to Modular Monoliths with Next.js.',
    author: 'Sam',
    tags: ['Architecture', 'Next.js', 'React'],
    createdAt: '2023-10-24', // New standard
    createdDate: '2023-10-24', // Legacy
    date: '2023-10-24', // Legacy
    likes: 156,
    image:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop',
    content: '<p>In the rapidly evolving landscape of frontend development...</p>',
    isPrivate: false
  },
  {
    _id: '2',
    name: 'Designing for Thinking Agents',
    info: 'Exploring the UX patterns required when interfacing with reasoning models like Gemini 3 Pro.',
    author: 'Sam',
    tags: ['AI', 'UX', 'Gemini'],
    createdAt: '2023-11-15', // New standard
    createdDate: '2023-11-15', // Legacy
    date: '2023-11-15', // Legacy
    likes: 92,
    image:
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1000&auto=format&fit=crop',
    content: '<p>As AI models become more capable...</p>',
    isPrivate: false
  }
];

export const contentService = {
  // --- Posts ---
  getPosts: async (
    page: number = 1,
    limit: number = 10,
    search: string = '',
    tag: string = ''
  ): Promise<{ data: BlogPost[]; pagination: PaginationData }> => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search) queryParams.append('q', search);
      if (tag) queryParams.append('tag', tag);

      const response = await fetchClient<PaginatedResponse<BlogPost>>(
        `/posts?${queryParams.toString()}`
      );

      const posts = response.data || [];

      const backendPagination = response.pagination as any;
      const pagination: PaginationData = {
        currentPage: backendPagination.currentPage,
        totalPages: backendPagination.totalPages,
        totalItems: backendPagination.totalPosts || 0,
        itemsPerPage: backendPagination.perPage || limit,
        hasNextPage: backendPagination.currentPage < backendPagination.totalPages,
        hasPrevPage: backendPagination.currentPage > 1
      };

      return { data: posts, pagination };
    } catch (e) {
      console.warn('API unavailable, falling back to mock');
      return {
        data: [...MOCK_BLOGS],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: MOCK_BLOGS.length,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }
  },

  getPrivatePosts: async (
    page: number = 1,
    limit: number = 10,
    search: string = '',
    tag: string = ''
  ): Promise<{ data: BlogPost[]; pagination: PaginationData }> => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search) queryParams.append('q', search);
      if (tag) queryParams.append('tag', tag);

      const response = await fetchClient<PaginatedResponse<BlogPost>>(
        `/posts/private/posts?${queryParams.toString()}`
      );

      const backendPagination = response.pagination as any;
      const pagination: PaginationData = {
        currentPage: backendPagination.currentPage,
        totalPages: backendPagination.totalPages,
        totalItems: backendPagination.totalPosts || 0,
        itemsPerPage: limit,
        hasNextPage: backendPagination.currentPage < backendPagination.totalPages,
        hasPrevPage: backendPagination.currentPage > 1
      };

      return { data: response.data, pagination };
    } catch (error) {
      console.error('Failed to fetch private blogs (safely handled):', error);
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

  getPostById: async (id: string): Promise<BlogPost | undefined> => {
    try {
      // 适配修改：后端现在直接返回对象 {...}，而不是数组 [{...}]
      // 如果后端返回 404，fetchClient 会抛出错误，我们在 catch 中处理
      const result = await fetchClient<BlogPost>(`/posts/${id}`);
      return result;
    } catch (e) {
      // Fallback to mock if API fails or returns 404 for demo purposes
      console.warn(`Post ${id} fetch failed or not found, falling back.`);
      return MOCK_BLOGS.find((b) => b._id === id);
    }
  },

  createPost: async (postData: any): Promise<void> => {
    await fetchClient('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
    toast.success('Entry successfully logged.');
  },

  updatePost: async (id: string, postData: any): Promise<void> => {
    await fetchClient(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(postData)
    });
    toast.success('Entry successfully updated.');
  },

  deletePost: async (id: string, secretKey?: string): Promise<void> => {
    const options: RequestInit = { method: 'DELETE' };
    if (secretKey) {
      options.body = JSON.stringify({ secretKey });
    }
    await fetchClient(`/posts/${id}`, options);
    toast.success('Log deleted successfully.');
  },

  likePost: async (id: string): Promise<void> => {
    await fetchClient(`/posts/likes/${id}/add`, { method: 'POST' });
  },

  unlikePost: async (id: string): Promise<void> => {
    await fetchClient(`/posts/likes/${id}/remove`, { method: 'POST' });
  },

  // --- Tags ---
  getTags: async (type: 'public' | 'private' | 'all' = 'public'): Promise<Tag[]> => {
    try {
      const q = type ? `?type=${type}` : '';
      return await fetchClient<Tag[]>(`/tags${q}`);
    } catch (e) {
      return [];
    }
  },

  // --- Photos ---
  getPhotos: async (): Promise<Photo[]> => {
    try {
      return await fetchClient<Photo[]>('/photos');
    } catch (e) {
      return [];
    }
  },

  addPhoto: async (fileOrUrl: File | string, name: string, date?: string): Promise<Photo[]> => {
    let url = '';
    if (typeof fileOrUrl !== 'string') {
      url = await uploadImage(fileOrUrl);
    } else {
      url = fileOrUrl;
    }

    const res = await fetchClient<Photo[]>('/photos', {
      method: 'POST',
      body: JSON.stringify({ url, name, createdDate: date })
    });
    return res;
  },

  updatePhoto: async (
    id: string,
    name?: string,
    fileOrUrl?: File | string,
    date?: string
  ): Promise<Photo[]> => {
    const payload: any = {};
    if (name) payload.name = name;
    if (date) payload.createdDate = date;

    if (fileOrUrl) {
      if (typeof fileOrUrl !== 'string') {
        payload.url = await uploadImage(fileOrUrl);
      } else {
        payload.url = fileOrUrl;
      }
    }

    const res = await fetchClient<Photo[]>(`/photos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    toast.success('Photo updated successfully');
    return res;
  },

  reorderPhotos: async (newOrderIds: string[]): Promise<Photo[]> => {
    return await fetchClient<Photo[]>('/photos/reorder', {
      method: 'PUT',
      body: JSON.stringify({ newOrderIds })
    });
  },

  deletePhoto: async (id: string): Promise<Photo[]> => {
    const res = await fetchClient<Photo[]>(`/photos/${id}`, {
      method: 'DELETE'
    });
    toast.success('Photo removed');
    return res;
  },

  uploadPhoto: async (file: File, caption: string, location?: string): Promise<Photo> => {
    const photos = await contentService.addPhoto(file, caption);
    return photos[0];
  },

  getRecentImages: async (): Promise<{ url: string; public_id: string }[]> => {
    try {
      const res = await fetchClient<any>('/cloudinary/resources');

      let list: any[] = [];

      // Handle both direct array and object wrapper responses
      if (Array.isArray(res)) {
        list = res;
      } else {
        list = res.data || res.resources || [];
      }

      if (list && Array.isArray(list)) {
        return list.map((r: any) => ({
          url: r.secure_url,
          public_id: r.public_id
        }));
      }
      return [];
    } catch (e) {
      console.error('Failed to fetch library', e);
      return [];
    }
  },

  deleteCloudinaryImage: async (public_id: string): Promise<void> => {
    await fetchClient('/cloudinary/delete', {
      method: 'POST',
      body: JSON.stringify({ public_id })
    });
    toast.success('Image deleted from cloud.');
  },

  // --- Comments ---
  getComments: async (postId: string): Promise<Comment[]> => {
    try {
      const response = await fetchClient<any>(`/comments/${postId}`);
      if (Array.isArray(response)) return response;
      if (response && Array.isArray(response.data)) return response.data;
      return [];
    } catch (error: any) {
      if (error.message && (error.message.includes('Not found') || error.message.includes('404'))) {
        return [];
      }
      return [];
    }
  },

  addComment: async (
    postId: string,
    user: User,
    comment: string,
    photoURL?: string
  ): Promise<Comment[]> => {
    const res = await fetchClient<any>(`/comments/${postId}?user_id=${user._id}`, {
      method: 'POST',
      body: JSON.stringify({ user, comment, photoURL })
    });
    toast.success('Message transmitted.');
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    return Array.isArray(res) ? res : [];
  },

  getReplies: async (commentId: string): Promise<Comment[]> => {
    const res = await fetchClient<any>(`/comments/reply/${commentId}`);
    return Array.isArray(res) ? res : [];
  },

  addReply: async (
    commentId: string,
    user: User,
    reply: string,
    targetUser: any,
    photoURL?: string
  ): Promise<Comment[]> => {
    const res = await fetchClient<any>(`/comments/reply/${commentId}`, {
      method: 'POST',
      body: JSON.stringify({ user, reply, photoURL, targetUser })
    });
    toast.success('Reply transmitted.');
    return Array.isArray(res) ? res : [];
  },

  // --- Homepage & Projects ---
  getProjects: async (): Promise<Project[]> => {
    return await fetchClient<Project[]>('/homepage/projects');
  },

  getPortfolioProjects: async (): Promise<PortfolioProject[]> => {
    return await fetchClient<PortfolioProject[]>('/projects');
  },

  streamGithubPortfolioImport: async (
    repoUrl: string,
    onProgress: (progress: PortfolioImportProgress) => void,
    cloudflareAiToken?: string,
    cloudflareAccountId?: string,
    options?: { generateCover?: boolean }
  ): Promise<PortfolioImportPreview> => {
    const headers: Record<string, string> = {};
    if (cloudflareAiToken) headers['x-cloudflare-ai-token'] = cloudflareAiToken;
    if (cloudflareAccountId) headers['x-cloudflare-account-id'] = cloudflareAccountId;

    return await fetchEventStream<PortfolioImportPreview>(
      '/projects/import-github/stream',
      {
        method: 'POST',
        headers: Object.keys(headers).length ? headers : undefined,
        body: JSON.stringify({ repoUrl, generateCover: options?.generateCover !== false })
      },
      onProgress
    );
  },

  streamPortfolioAiRewrite: async (
    project: Partial<PortfolioProject>,
    onProgress: (progress: PortfolioImportProgress) => void,
    cloudflareAiToken?: string,
    cloudflareAccountId?: string
  ): Promise<Partial<PortfolioProject>> => {
    const headers: Record<string, string> = {};
    if (cloudflareAiToken) headers['x-cloudflare-ai-token'] = cloudflareAiToken;
    if (cloudflareAccountId) headers['x-cloudflare-account-id'] = cloudflareAccountId;

    return await fetchEventStream<Partial<PortfolioProject>>(
      '/projects/ai-rewrite/stream',
      {
        method: 'POST',
        headers: Object.keys(headers).length ? headers : undefined,
        body: JSON.stringify(project)
      },
      onProgress
    );
  },

  previewGithubPortfolioImport: async (
    repoUrl: string,
    cloudflareAiToken?: string,
    cloudflareAccountId?: string,
    options?: { generateCover?: boolean }
  ): Promise<PortfolioImportPreview> => {
    const headers: Record<string, string> = {};
    if (cloudflareAiToken) headers['x-cloudflare-ai-token'] = cloudflareAiToken;
    if (cloudflareAccountId) headers['x-cloudflare-account-id'] = cloudflareAccountId;

    return await fetchClient<PortfolioImportPreview>('/projects/import-github/preview', {
      method: 'POST',
      headers: Object.keys(headers).length ? headers : undefined,
      body: JSON.stringify({ repoUrl, generateCover: options?.generateCover !== false })
    });
  },

  generatePortfolioAiCover: async (
    data: Partial<PortfolioProject>,
    cloudflareAiToken?: string,
    cloudflareAccountId?: string
  ): Promise<PortfolioAiCoverResponse> => {
    const headers: Record<string, string> = {};
    if (cloudflareAiToken) headers['x-cloudflare-ai-token'] = cloudflareAiToken;
    if (cloudflareAccountId) headers['x-cloudflare-account-id'] = cloudflareAccountId;

    return await fetchClient<PortfolioAiCoverResponse>('/projects/import-github/generate-cover', {
      method: 'POST',
      headers: Object.keys(headers).length ? headers : undefined,
      body: JSON.stringify(data)
    });
  },

  createProject: async (data: Partial<PortfolioProject>): Promise<PortfolioProject> => {
    const res = await fetchClient<PortfolioProject>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    toast.success('Project created successfully');
    return res;
  },

  updateProject: async (id: string, data: Partial<PortfolioProject>): Promise<PortfolioProject> => {
    // Seed cards are bundled with the frontend. Their first edit promotes them
    // into persisted projects, after which the normal update/delete flow applies.
    if (id.startsWith('seed-')) {
      const persistedData = { ...data };
      delete persistedData._id;
      delete persistedData.createdAt;
      const res = await fetchClient<PortfolioProject>('/projects', {
        method: 'POST',
        body: JSON.stringify(persistedData)
      });
      toast.success('Project saved successfully');
      return res;
    }

    const res = await fetchClient<PortfolioProject>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    toast.success('Project updated successfully');
    return res;
  },

  deleteProject: async (id: string): Promise<void> => {
    if (id.startsWith('seed-')) {
      toast.error('Edit and save this built-in app before deleting it.');
      return;
    }

    await fetchClient(`/projects/${id}`, {
      method: 'DELETE'
    });
    toast.success('Project deleted successfully');
  },

  getLogs: async (): Promise<Log[]> => {
    return await fetchClient<Log[]>('/homepage/logs');
  },

  getHomeLikes: async (): Promise<{ _id: string; likes: number }[]> => {
    try {
      const data = await fetchClient<{ _id: string; likes: number }[]>('/homepage/likes');
      return Array.isArray(data) ? data : [data];
    } catch (e) {
      console.warn('Failed to fetch home stats', e);
      return [];
    }
  },

  addHomeLike: async (id: string): Promise<{ likes: number }> => {
    return await fetchClient<{ likes: number }>(`/homepage/likes/${id}/add`, { method: 'POST' });
  },

  addHomeLikesBatch: async (id: string, count: number): Promise<{ likes: number }> => {
    return await fetchClient<{ likes: number }>(`/homepage/likes/${id}/batch-add`, {
      method: 'POST',
      body: JSON.stringify({ count })
    });
  },

  removeHomeLike: async (id: string): Promise<{ likes: number }> => {
    return await fetchClient<{ likes: number }>(`/homepage/likes/${id}/remove`, { method: 'POST' });
  },

  // --- Resume ---
  getResume: async (): Promise<ResumeItem[]> => {
    return await fetchClient<ResumeItem[]>('/resume');
  },

  getResumeData: async (userSlug: string = 'moviegoer24@gmail.com'): Promise<ResumeData> => {
    return await fetchClient<ResumeData>(`/resumes?user=${userSlug}`);
  },

  getResumeUsers: async (): Promise<string[]> => {
    return await fetchClient<string[]>('/resumes/users');
  },

  getResumeList: async (
    userSlug: string = 'moviegoer24@gmail.com'
  ): Promise<Array<{ slug: string; title: string; user: string; createdAt: string }>> => {
    return await fetchClient<
      Array<{ slug: string; title: string; user: string; createdAt: string }>
    >(`/resumes/list?user=${userSlug}`);
  },

  updateResume: async (
    data: Partial<ResumeData>,
    userSlug: string = 'moviegoer24@gmail.com'
  ): Promise<ResumeData> => {
    const res = await fetchClient<ResumeData>(`/resumes?user=${userSlug}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    toast.success('Resume updated successfully');
    return res;
  },

  deleteResume: async (userSlug: string): Promise<{ msg: string }> => {
    const res = await fetchClient<{ msg: string }>(`/resumes?user=${userSlug}`, {
      method: 'DELETE'
    });
    toast.success('Resume deleted successfully');
    return res;
  },

  setDefaultResume: async (
    slug: string
  ): Promise<{ msg: string; defaultSlug: string; swappedSlug: string }> => {
    const res = await fetchClient<{ msg: string; defaultSlug: string; swappedSlug: string }>(
      '/resumes/set-default',
      {
        method: 'POST',
        body: JSON.stringify({ slug })
      }
    );
    toast.success('Set as default homepage resume successfully');
    return res;
  }
};
