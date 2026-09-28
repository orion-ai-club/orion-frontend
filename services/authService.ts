import { fetchClient, API_BASE_URL } from './core';
import { toast } from '../components/Toast';
import {
  User,
  AuditLog,
  PaginationData,
  PaginatedResponse,
  PermissionRequest,
  Role,
  Permission
} from '../types';

export const authService = {
  // --- Auth & Subscription ---
  subscribe: async (email: string): Promise<any> => {
    const res = await fetchClient('/auth/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    toast.success('Subscribed successfully!');
    return res;
  },

  verifySecret: async (secret: string): Promise<boolean> => {
    const res = await fetchClient<{ success: boolean; code: number; message: string }>(
      '/auth/verify-secret',
      {
        method: 'POST',
        body: JSON.stringify({ secret })
      }
    );
    return res.success;
  },

  // --- Users ---
  login: async (email: string, password: string): Promise<{ token: string; user?: User }> => {
    const response = await fetchClient<{ token: string; user?: User }>('/users/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    toast.success('Welcome back!');
    return response;
  },

  register: async (
    displayName: string,
    email: string,
    password: string,
    passwordConf: string,
    phone?: string
  ): Promise<{ token: string; user?: User }> => {
    const response = await fetchClient<{ token: string; user?: User }>('/users', {
      method: 'POST',
      body: JSON.stringify({
        displayName,
        email,
        password,
        passwordConf,
        phone
      })
    });
    toast.success('Registration successful! Welcome aboard.');
    return response;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<any> => {
    return await fetchClient('/users/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    });
  },

  resetPasswordBySecret: async (
    email: string,
    newPassword: string,
    secretKey: string
  ): Promise<any> => {
    return await fetchClient('/users/reset-by-secret', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword, secretKey })
    });
  },

  sendOtp: async (identifier: string): Promise<any> => {
    return await fetchClient('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
  },

  verifyOtp: async (
    identifier: string,
    code: string
  ): Promise<{ token: string; user?: User; isProfileCompleted: boolean }> => {
    const response = await fetchClient<{
      token: string;
      user?: User;
      isProfileCompleted: boolean;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, code })
    });
    return response;
  },

  completeProfile: async (
    displayName: string,
    email?: string,
    phone?: string
  ): Promise<{ user: User }> => {
    const response = await fetchClient<{ user: User }>('/users/complete-profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName, email, phone })
    });
    toast.success('Profile completed successfully!');
    return response;
  },

  verifyFirebaseToken: async (
    idToken: string
  ): Promise<{ token: string; user?: User; isProfileCompleted: boolean }> => {
    const response = await fetchClient<{
      token: string;
      user?: User;
      isProfileCompleted: boolean;
    }>('/auth/firebase-verify', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    });
    return response;
  },

  grantVip: async (email: string): Promise<any> => {
    return await fetchClient('/users/grant-vip', {
      method: 'PUT',
      body: JSON.stringify({ email })
    });
  },

  revokeVip: async (email: string): Promise<any> => {
    return await fetchClient('/users/revoke-vip', {
      method: 'PUT',
      body: JSON.stringify({ email })
    });
  },

  updateUserRole: async (id: string, role: string): Promise<any> => {
    return await fetchClient(`/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  updateUserPermissions: async (id: string, permissions: string[]): Promise<any> => {
    return await fetchClient(`/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions })
    });
  },

  backupLogs: async (type?: string): Promise<void> => {
    const urlEndpoint = type ? `${API_BASE_URL}/backup?type=${type}` : `${API_BASE_URL}/backup`;

    const response = await fetch(urlEndpoint, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Backup failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `backup-${type || 'full'}-${new Date().toISOString().split('T')[0]}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  backupDatabaseToR2: async (): Promise<void> => {
    await fetchClient('/backup/database', {
      method: 'POST'
    });
    toast.success('Database backup uploaded to Cloud successfully!');
  },

  getCurrentUser: async (): Promise<User | null> => {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.status === 401) return null;
    if (!response.ok) {
      throw new Error(`Auth check failed with status ${response.status}`);
    }

    return (await response.json()) as User;
  },

  logout: async () => {
    try {
      await fetchClient('/users/logout', { method: 'POST' }).catch(() => {});
    } finally {
      localStorage.removeItem('googleInfo');
      toast.info('You have been logged out.');
    }
  },

  changeUsername: async (id: string, newDisplayName: string): Promise<any> => {
    const res = await fetchClient(`/users/changeusername/${id}`, {
      method: 'POST',
      body: JSON.stringify({ newDisplayName })
    });
    toast.success('Username updated.');
    return res;
  },

  updateProfile: async (id: string, data: Partial<User>): Promise<User> => {
    return await fetchClient<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // --- Roles Management ---
  getAllRoles: async (): Promise<Role[]> => {
    return await fetchClient<Role[]>('/roles');
  },

  createRole: async (data: Partial<Role>): Promise<Role> => {
    return await fetchClient<Role>('/roles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateRoleDefinition: async (name: string, data: Partial<Role>): Promise<Role> => {
    return await fetchClient<Role>(`/roles/${name}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteRole: async (name: string): Promise<void> => {
    await fetchClient(`/roles/${name}`, { method: 'DELETE' });
    toast.success(`Role ${name} deleted.`);
  },

  // --- Permissions Management ---
  getAllPermissions: async (): Promise<Permission[]> => {
    return await fetchClient<Permission[]>('/permissions');
  },

  createPermission: async (data: Partial<Permission>): Promise<Permission> => {
    return await fetchClient<Permission>('/permissions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updatePermission: async (key: string, data: Partial<Permission>): Promise<Permission> => {
    return await fetchClient<Permission>(`/permissions/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deletePermission: async (key: string): Promise<void> => {
    await fetchClient(`/permissions/${key}`, { method: 'DELETE' });
    toast.success(`Permission ${key} deleted.`);
  },

  // --- Permission Requests ---
  submitPermissionRequest: async (permission: string, reason: string): Promise<void> => {
    await fetchClient('/permission-requests', {
      method: 'POST',
      body: JSON.stringify({ permission, reason })
    });
    toast.success('Permission request submitted successfully.');
  },

  submitRoleRequest: async (role: string, reason: string): Promise<void> => {
    await fetchClient('/permission-requests/role', {
      method: 'POST',
      body: JSON.stringify({ role, reason })
    });
    toast.success(`Role request for ${role} submitted successfully.`);
  },

  getPermissionRequests: async (status: string = 'pending'): Promise<PermissionRequest[]> => {
    return await fetchClient<PermissionRequest[]>(`/permission-requests?status=${status}`);
  },

  approvePermissionRequest: async (id: string): Promise<void> => {
    await fetchClient(`/permission-requests/${id}/approve`, {
      method: 'PUT'
    });
    toast.success('Permission granted.');
  },

  rejectPermissionRequest: async (id: string): Promise<void> => {
    await fetchClient(`/permission-requests/${id}/reject`, {
      method: 'PUT'
    });
    toast.success('Permission rejected.');
  },

  // --- Audit Logs (Updated for new Backend API) ---
  getAuditOptions: async (): Promise<{ actions: string[] }> => {
    return await fetchClient<{ actions: string[] }>('/audit/options');
  },

  getAuditLogs: async (
    page: number = 1,
    limit: number = 20,
    filters: {
      operator?: string;
      action?: string;
      target?: string;
      ip?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{
    data: AuditLog[];
    pagination: { currentPage: number; limit: number; totalPages: number; totalLogCount: number };
  }> => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    if (filters.operator) queryParams.append('operator', filters.operator);
    if (filters.action) queryParams.append('action', filters.action);
    if (filters.target) queryParams.append('target', filters.target);
    if (filters.ip) queryParams.append('ip', filters.ip);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);

    const response = await fetchClient<any>(`/audit?${queryParams.toString()}`);
    return response;
  },

  deleteAuditLog: async (id: string): Promise<void> => {
    await fetchClient(`/audit/${id}`, { method: 'DELETE' });
    toast.success('Audit log deleted.');
  },

  pruneAuditLogs: async (): Promise<{ deletedCount: number }> => {
    const res = await fetchClient<{ success: boolean; msg: string; deletedCount: number }>(
      '/audit/prune/old',
      {
        method: 'DELETE'
      }
    );
    toast.success(res.msg);
    return res;
  },

  // --- Users List ---
  getUsers: async (
    page: number = 1,
    limit: number = 20,
    search: string = '',
    sortBy: string = 'vip',
    order: string = 'desc'
  ): Promise<{ data: User[]; pagination: PaginationData }> => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy: sortBy,
      order: order
    });
    if (search) queryParams.append('search', search);

    const response = await fetchClient<PaginatedResponse<User>>(`/users?${queryParams.toString()}`);

    const backendPagination = response.pagination as any;
    const pagination: PaginationData = {
      currentPage: backendPagination.currentPage || page,
      totalPages: backendPagination.totalPages || 1,
      totalItems: backendPagination.totalUsers || 0,
      itemsPerPage: limit,
      hasNextPage: (backendPagination.currentPage || page) < (backendPagination.totalPages || 1),
      hasPrevPage: (backendPagination.currentPage || page) > 1
    };

    return { data: response.data, pagination };
  }
};
