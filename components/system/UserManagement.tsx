import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { apiService } from '../../services/api';
import { User, PaginationData, Role, Permission } from '../../types';
import { toast } from '../Toast';
import { DeleteModal } from '../DeleteModal';

export const UserManagement: React.FC = () => {
  const { t } = useTranslation();
  const [userList, setUserList] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [roleList, setRoleList] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('user');

  // Permissions State
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isUpdatingPerms, setIsUpdatingPerms] = useState(false);

  // Modals / Actions
  const [showVipModal, setShowVipModal] = useState(false);
  const [isProcessingVip, setIsProcessingVip] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const fetchUsers = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const { data, pagination: pager } = await apiService.getUsers(
          p,
          25,
          search,
          'role',
          'desc'
        );
        setUserList(data);
        setPagination(pager);
        setPage(p);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  const fetchRolesAndPermissions = useCallback(async () => {
    try {
      const [roles, perms] = await Promise.all([
        apiService.getAllRoles(),
        apiService.getAllPermissions()
      ]);
      setRoleList(roles);
      setAllPermissions(perms);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void fetchRolesAndPermissions();
  }, [fetchRolesAndPermissions]);

  useEffect(() => {
    const delay = search ? 500 : 0;
    const timer = setTimeout(() => {
      void fetchUsers(1);
    }, delay);
    return () => clearTimeout(timer);
  }, [fetchUsers, search]);

  useEffect(() => {
    if (targetUser) {
      setSelectedRole(targetUser.role || 'user');
      setSelectedPermissions(targetUser.permissions || []);
    }
  }, [targetUser]);

  const displayUserList = useMemo(() => {
    const list = [...userList];
    return list.sort((a, b) => {
      const getRoleWeight = (role?: string) => {
        if (role === 'super_admin') return 100;
        if (role === 'admin') return 90;
        return 1;
      };
      const wA = getRoleWeight(a.role);
      const wB = getRoleWeight(b.role);
      if (wA !== wB) return wB - wA;
      if (a._id > b._id) return -1;
      if (a._id < b._id) return 1;
      return 0;
    });
  }, [userList]);

  // Group permissions by category for UI
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    allPermissions.forEach((p) => {
      const cat = p.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [allPermissions]);

  const handleVipActionClick = () => {
    if (!targetUser) return;
    if (targetUser.role === 'bot') {
      toast.error(t.system.users.botError);
      return;
    }
    setShowVipModal(true);
  };

  const handleVipActionConfirm = async (secret?: string) => {
    if (!targetUser || !secret) return;
    setIsProcessingVip(true);
    try {
      await apiService.verifySecret(secret);
      if (targetUser.vip) {
        await apiService.revokeVip(targetUser.email);
        toast.success(`VIP revoked for ${targetUser.displayName}`);
      } else {
        await apiService.grantVip(targetUser.email);
        toast.success(`VIP granted to ${targetUser.displayName}`);
      }
      fetchUsers(page);
      setTargetUser(null);
      setShowVipModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingVip(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!targetUser) return;
    if (targetUser.role === 'bot') {
      toast.error(t.system.users.botError);
      return;
    }
    if (selectedRole === targetUser.role) return;

    setIsUpdatingRole(true);
    try {
      await apiService.updateUserRole(targetUser._id, selectedRole);
      toast.success(`Role updated to ${selectedRole}`);
      fetchUsers(page);
      setTargetUser((prev) => (prev ? { ...prev, role: selectedRole as any } : null));
    } catch (e) {
      toast.error('Failed to update role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!targetUser) return;
    if (targetUser.role === 'bot') {
      toast.error(t.system.users.botError);
      return;
    }

    setIsUpdatingPerms(true);
    try {
      await apiService.updateUserPermissions(targetUser._id, selectedPermissions);
      toast.success(`Permissions updated for ${targetUser.displayName}`);
      fetchUsers(page);
      // Sync local targetUser with new permissions
      setTargetUser((prev) => (prev ? { ...prev, permissions: selectedPermissions } : null));
    } catch (e) {
      toast.error('Failed to update permissions');
    } finally {
      setIsUpdatingPerms(false);
    }
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col xl:flex-row gap-6 animate-fade-in min-h-[600px]">
      <DeleteModal
        isOpen={showVipModal}
        onClose={() => setShowVipModal(false)}
        onConfirm={handleVipActionConfirm}
        title={t.system.users.verifyTitle}
        message={t.system.users.verifyMsg}
        isSecret={true}
        confirmKeyword=""
        buttonText={t.system.users.verifyBtn}
        zIndexClass="z-[9999]"
      />

      {/* User List Column */}
      <div className="w-full xl:w-3/4 flex flex-col">
        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.system.users.search}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pl-10 outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
            <div className="text-center py-10 opacity-50">{t.system.common.loading}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {displayUserList.map((u) => (
                <button
                  key={u._id}
                  onClick={() => setTargetUser(u)}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl transition-all text-center group border ${targetUser?._id === u._id ? 'bg-blue-500 text-white shadow-lg border-blue-500' : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 shrink-0 ring-2 ring-white dark:ring-slate-800 shadow-sm">
                    <img
                      src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="font-bold truncate text-sm mb-1">{u.displayName}</div>
                    <div
                      className={`text-[10px] truncate mb-2 ${targetUser?._id === u._id ? 'text-blue-100' : 'text-slate-400'}`}
                    >
                      {u.email}
                    </div>

                    <div className="flex justify-center gap-1">
                      {u.role && u.role !== 'user' && (
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                            u.role === 'super_admin'
                              ? targetUser?._id === u._id
                                ? 'bg-white/20 text-white'
                                : 'bg-purple-100 text-purple-600'
                              : u.role === 'admin'
                                ? targetUser?._id === u._id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-100 text-blue-600'
                                : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {u.role === 'super_admin' ? 'Super' : u.role}
                        </span>
                      )}
                      {u.vip && (
                        <i
                          className={`fas fa-crown text-xs ${targetUser?._id === u._id ? 'text-yellow-300' : 'text-amber-400'}`}
                        ></i>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              disabled={!pagination.hasPrevPage}
              onClick={() => fetchUsers(page - 1)}
              className="text-slate-400 hover:text-blue-500 disabled:opacity-30"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="text-xs font-mono text-slate-500 pt-1">Page {page}</span>
            <button
              disabled={!pagination.hasNextPage}
              onClick={() => fetchUsers(page + 1)}
              className="text-slate-400 hover:text-blue-500 disabled:opacity-30"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>

      {/* Detail Column */}
      <div className="w-full xl:w-1/4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-start relative overflow-hidden">
        {!targetUser ? (
          <div className="text-slate-400 text-center mt-20">
            <i className="fas fa-user-circle text-4xl mb-4 opacity-50"></i>
            <p>Select a user to manage.</p>
          </div>
        ) : (
          <div className="w-full animate-fade-in flex flex-col h-full">
            <div className="text-center mb-6 shrink-0">
              <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden relative">
                <img
                  src={
                    targetUser.photoURL ||
                    `https://ui-avatars.com/api/?name=${targetUser.displayName}`
                  }
                  className="w-full h-full object-cover"
                />
                {targetUser.role === 'bot' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-xs font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                    Bot
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {targetUser.displayName}
              </h2>
              <p className="text-sm font-mono text-slate-500 break-all">{targetUser.email}</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
                {targetUser._id}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-slate-400 mb-1">
                    {t.system.users.vipStatus}
                  </div>
                  <div
                    className={`text-sm font-bold ${targetUser.vip ? 'text-amber-500' : 'text-slate-500'}`}
                  >
                    {targetUser.vip ? t.system.users.active : t.system.users.inactive}
                  </div>
                </div>
                <button
                  onClick={handleVipActionClick}
                  disabled={isProcessingVip || targetUser.role === 'bot'}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${targetUser.vip ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {targetUser.vip ? t.system.users.revoke : t.system.users.grant}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold uppercase text-slate-400 mb-2">
                  {t.system.users.role}
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={targetUser.role === 'bot'}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                  >
                    {roleList.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                    {!roleList.find((r) => r.name === 'user') && <option value="user">user</option>}
                    {!roleList.find((r) => r.name === 'admin') && (
                      <option value="admin">admin</option>
                    )}
                    {!roleList.find((r) => r.name === 'super_admin') && (
                      <option value="super_admin">super_admin</option>
                    )}
                  </select>
                  <button
                    onClick={handleUpdateRole}
                    disabled={
                      isUpdatingRole ||
                      selectedRole === targetUser.role ||
                      targetUser.role === 'bot'
                    }
                    className="px-4 bg-blue-500 text-white rounded-lg font-bold text-xs uppercase hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.system.common.update}
                  </button>
                </div>
              </div>

              {/* Direct Permissions Management */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xs font-bold uppercase text-slate-400">
                    {t.system.users.directPerms}
                  </div>
                  <button
                    onClick={handleUpdatePermissions}
                    disabled={isUpdatingPerms || targetUser.role === 'bot'}
                    className="px-3 py-1 bg-indigo-500 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingPerms ? t.system.common.loading : t.system.common.save}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-4">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category}>
                      <h5 className="text-[10px] font-bold text-primary-500 uppercase mb-2 sticky top-0 bg-white dark:bg-slate-900 py-1">
                        {category}
                      </h5>
                      <div className="grid grid-cols-1 gap-1">
                        {(perms as Permission[]).map((p) => {
                          const isChecked = selectedPermissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${isChecked ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                            >
                              <input
                                type="checkbox"
                                className="accent-indigo-500 w-4 h-4"
                                checked={isChecked}
                                onChange={() => togglePermission(p.key)}
                                disabled={targetUser.role === 'bot'}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                  {p.name}
                                </div>
                                <div className="text-[9px] text-slate-400 font-mono truncate">
                                  {p.key}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
