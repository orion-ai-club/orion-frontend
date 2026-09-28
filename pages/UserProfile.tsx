import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { User, PaginationData, PERM_KEYS, Permission, Role, can } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { apiService } from '../services/api';
import { toast } from '../components/Toast';
import { DeleteModal } from '../components/DeleteModal';
import { BackupTerminalModal } from '../components/BackupTerminalModal';

interface UserProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC'
];

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [height, setHeight] = useState<string>(user.height ? user.height.toString() : '');
  const [fitnessGoal, setFitnessGoal] = useState<'cut' | 'bulk' | 'maintain'>(
    user.fitnessGoal || 'maintain'
  );
  const [barkUrl, setBarkUrl] = useState(user.barkUrl || '');
  const [timezone, setTimezone] = useState(user.timezone || 'Asia/Shanghai');

  const [isLoading, setIsLoading] = useState(false);

  // Avatar Upload State
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Export Log State
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState('');

  // Backup Terminal Modal State
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Permission Request State
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [permRequest, setPermRequest] = useState({ permission: '', role: 'admin', reason: '' });
  const [requestType, setRequestType] = useState<'ROLE' | 'PERM'>('ROLE'); // Toggle state
  const [isSubmittingPerm, setIsSubmittingPerm] = useState(false);

  // Dynamic Permission List & Role List
  const [backendPermissions, setBackendPermissions] = useState<Permission[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);

  // Guard to prevent double fetching in React Strict Mode
  const hasFetchedRef = useRef(false);

  // Fetch latest profile data on mount to ensure settings like Bark URL are fresh
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchLatest = async () => {
      try {
        const latestUser = await apiService.getCurrentUser();
        onUpdateUser(latestUser);
      } catch (error) {
        console.error('Failed to refresh user profile:', error);
      }
    };
    fetchLatest();
  }, [onUpdateUser]);

  // Fetch permissions when permission modal opens
  useEffect(() => {
    if (isPermModalOpen && requestType === 'PERM' && backendPermissions.length === 0) {
      const fetchPerms = async () => {
        try {
          const list = await apiService.getAllPermissions();
          setBackendPermissions(list);
        } catch (e) {
          console.error('Failed to fetch permissions', e);
        }
      };
      fetchPerms();
    }
  }, [isPermModalOpen, requestType, backendPermissions.length]);

  // Fetch roles dynamically when role modal opens
  useEffect(() => {
    if (isPermModalOpen && requestType === 'ROLE' && availableRoles.length === 0) {
      const fetchRoles = async () => {
        try {
          const list = await apiService.getAllRoles();
          setAvailableRoles(list);
        } catch (e) {
          console.error('Failed to fetch roles', e);
        }
      };
      fetchRoles();
    }
  }, [isPermModalOpen, requestType, availableRoles.length]);

  // Update local state when user prop changes (e.g. after refresh)
  useEffect(() => {
    setDisplayName(user.displayName);
    setHeight(user.height ? user.height.toString() : '');
    setFitnessGoal(user.fitnessGoal || 'maintain');
    setBarkUrl(user.barkUrl || '');
    setTimezone(user.timezone || 'Asia/Shanghai');
  }, [user]);

  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      // 1. Upload to Cloudinary (Forced)
      // Use Cloudinary for avatars to leverage face detection/cropping features if configured
      const photoURL = await apiService.uploadImage(file, { forceCloudinary: true });

      // 2. Update User Profile on backend
      await apiService.updateProfile(user._id, {
        photoURL
      });

      // 3. Re-fetch full user profile to ensure complete state (vip, tokens, etc.)
      const fullUser = await apiService.getCurrentUser();
      onUpdateUser(fullUser);

      toast.success('Avatar updated successfully.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update avatar.');
    } finally {
      setIsUploadingAvatar(false);
      // Reset input to allow selecting the same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsLoading(true);
    try {
      // Update Profile (Name, Height, Goal, Bark, Timezone)
      const payload: Partial<User> = {
        displayName,
        fitnessGoal,
        barkUrl,
        timezone
      };

      if (height) {
        const heightNum = parseFloat(height);
        if (!isNaN(heightNum) && heightNum > 0) {
          payload.height = heightNum;
        }
      }

      await apiService.updateProfile(user._id, payload);

      // Re-fetch full user profile
      const fullUser = await apiService.getCurrentUser();
      onUpdateUser(fullUser);

      toast.success('Identity updated successfully.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update identity.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setIsChangingPassword(true);
    try {
      await apiService.changePassword(oldPassword, newPassword);
      toast.success('Access Key updated successfully.');
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportLogs = async () => {
    setIsExporting(true);
    try {
      await apiService.backupLogs(exportType);
      toast.success(`Backup downloaded successfully.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to export logs.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permRequest.reason.trim()) return;

    setIsSubmittingPerm(true);
    try {
      if (requestType === 'ROLE') {
        if (permRequest.role === 'super_admin') {
          toast.error('Cannot request Super Admin role.');
          setIsSubmittingPerm(false);
          return;
        }
        await apiService.submitRoleRequest(permRequest.role, permRequest.reason);
      } else {
        if (!permRequest.permission.trim()) {
          toast.error('Please select a permission key.');
          setIsSubmittingPerm(false);
          return;
        }
        if (permRequest.permission.trim() === '*') {
          toast.error('Cannot request root permission (*).');
          setIsSubmittingPerm(false);
          return;
        }
        await apiService.submitPermissionRequest(permRequest.permission, permRequest.reason);
      }

      setIsPermModalOpen(false);
      setPermRequest({ permission: '', role: 'admin', reason: '' });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingPerm(false);
    }
  };

  const openPermissionModal = (type: 'ROLE' | 'PERM', defaultVal = '') => {
    setRequestType(type);
    setPermRequest({
      permission: type === 'PERM' ? defaultVal : '',
      role: type === 'ROLE' ? defaultVal || 'admin' : 'admin',
      reason: ''
    });
    setIsPermModalOpen(true);
  };

  const handleLogout = () => {
    apiService.logout();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('googleInfo');
    window.location.href = '/';
  };

  const getRoleColorClass = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-500 text-white border-purple-400';
      case 'admin':
        return 'bg-blue-500 text-white border-blue-400';
      case 'bot':
        return 'bg-slate-500 text-white border-slate-400';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  const getRoleLabel = (role?: string) => {
    if (!role) return 'User';
    // @ts-ignore
    return t.profile.roles[role] || role;
  };

  // Render a list item link
  const ListItemLink = ({
    to,
    icon,
    label,
    color = 'text-slate-600 dark:text-slate-300'
  }: {
    to: string;
    icon: string;
    label: string;
    color?: string;
  }) => (
    <Link
      to={to}
      className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      <div className={`flex items-center gap-3 ${color}`}>
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <i className={`fas ${icon}`}></i>
        </div>
        <span className="text-sm font-bold text-slate-700 dark:text-white">{label}</span>
      </div>
      <i className="fas fa-chevron-right text-slate-300 text-xs"></i>
    </Link>
  );

  return (
    <div className="container mx-auto px-6 py-24 pt-32 max-w-4xl animate-fade-in relative z-10">
      {/* Backup Terminal Modal */}
      <BackupTerminalModal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} />

      <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-2">
            {t.profile.title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">{t.profile.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Menu Links (Mobile Hub) */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Clickable Avatar Area */}
            <div
              className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-amber-400 to-rose-500 mb-4 relative group cursor-pointer"
              onClick={handleAvatarClick}
            >
              <img
                src={
                  user.photoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`
                }
                alt="Avatar"
                className={`w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-900 transition-opacity ${isUploadingAvatar ? 'opacity-50' : ''}`}
              />

              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <i className="fas fa-circle-notch fa-spin text-white text-2xl"></i>
                </div>
              )}

              {!isUploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="fas fa-camera text-white text-xl"></i>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {user.displayName}
            </h2>
            <p className="text-xs font-mono text-slate-500 mb-3">{user.email}</p>

            <div className="flex gap-2 justify-center flex-wrap mb-2">
              {user.role && user.role !== 'user' && (
                <div
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getRoleColorClass(user.role)} bg-opacity-10 border-opacity-20`}
                >
                  {getRoleLabel(user.role)}
                </div>
              )}
              {user.vip && (
                <div className="inline-flex items-center px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-500/20">
                  <i className="fas fa-crown mr-1"></i> {t.profile.vipBadge}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links Group */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
            <ListItemLink to="/system-settings" icon="fa-cog" label={t.header.settings} />

            {can(user, PERM_KEYS.SYSTEM_ACCESS) && (
              <ListItemLink
                to="/system-management"
                icon="fa-server"
                label={t.header.system}
                color="text-blue-500"
              />
            )}

            {can(user, PERM_KEYS.SYSTEM_LOGS) && (
              <ListItemLink
                to="/audit-log"
                icon="fa-shield-alt"
                label={t.header.audit}
                color="text-emerald-500"
              />
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-red-500 font-bold text-sm uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shadow-sm"
          >
            {t.header.signOut}
          </button>
        </div>

        {/* Right Column: Edit Forms (Desktop Primarily, stacks on mobile below nav) */}
        <div className="col-span-1 lg:col-span-2 space-y-8">
          {/* Identity Card */}
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">
              Edit Profile
            </h3>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {t.profile.displayName}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    {t.profile.height}
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 175"
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    {t.profile.fitnessGoal}
                  </label>
                  <select
                    value={fitnessGoal}
                    onChange={(e) => setFitnessGoal(e.target.value as any)}
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
                  >
                    <option value="cut">{t.profile.goals.cut}</option>
                    <option value="maintain">{t.profile.goals.maintain}</option>
                    <option value="bulk">{t.profile.goals.bulk}</option>
                  </select>
                </div>
              </div>

              {/* Bark URL & Timezone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {t.profile.barkUrl}
                </label>
                <input
                  type="text"
                  value={barkUrl}
                  onChange={(e) => setBarkUrl(e.target.value)}
                  placeholder={t.profile.barkUrlPlaceholder}
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {t.profile.timezone}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full md:w-auto px-8 py-3 bg-amber-500 text-black rounded-xl font-bold uppercase tracking-widest hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : t.profile.save}
                </button>
              </div>
            </form>
          </div>

          {/* Access Control & Permissions */}
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <i className="fas fa-key text-blue-500 text-xl"></i>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t.profile.accessControl}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl flex justify-between items-center">
                <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  {t.profile.role}
                </div>
                <div className="font-bold text-slate-800 dark:text-white uppercase text-sm">
                  {getRoleLabel(user.role)}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {user.role !== 'admin' && user.role !== 'super_admin' && (
                  <button
                    onClick={() => openPermissionModal('ROLE', 'admin')}
                    className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                  >
                    {t.profile.applyAdmin}
                  </button>
                )}
                <button
                  onClick={() => openPermissionModal('PERM', '')}
                  className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold uppercase text-xs tracking-widest transition-all"
                >
                  {t.profile.customRequest}
                </button>
              </div>
            </div>
          </div>

          {/* Security Protocol: Change Password */}
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <i className="fas fa-shield-alt text-amber-500 text-xl"></i>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t.profile.security}
              </h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {t.profile.oldPassword}
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {t.profile.newPassword}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
                  placeholder="••••••••"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword || !oldPassword || !newPassword}
                  className="w-full md:w-auto px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50"
                >
                  {isChangingPassword ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    t.profile.changePassword
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* VIP Data Management */}
          {user.vip && (
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <i className="fas fa-database text-blue-500 text-xl"></i>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t.profile.dataManagement}
                </h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {t.profile.downloadBackup}
              </p>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <select
                      value={exportType}
                      onChange={(e) => setExportType(e.target.value)}
                      className="w-full appearance-none px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      <option value="">Full System Backup</option>
                      <optgroup label="Content">
                        <option value="posts">Posts & Journals</option>
                        <option value="projects">Projects (Portfolio)</option>
                        <option value="photos">Photo Gallery</option>
                        <option value="footprints">Footprints (Star Map)</option>
                      </optgroup>
                      <optgroup label="Personal">
                        <option value="todos">Tasks (Todos)</option>
                        <option value="fitness">Fitness Records</option>
                        <option value="menus">Menus (Chef&apos;s Wheel)</option>
                        <option value="periods">Period Tracker Data</option>
                        <option value="resume">Resume Data</option>
                      </optgroup>
                      <optgroup label="Communication">
                        <option value="chats">Chat History</option>
                        <option value="conversations">AI Conversations</option>
                        <option value="comments">Comments</option>
                      </optgroup>
                      <optgroup label="System & Admin">
                        <option value="users">Users Database</option>
                        <option value="roles">Roles Config</option>
                        <option value="permissions">Permissions Config</option>
                        <option value="requests">Permission Requests</option>
                        <option value="audit">Audit Logs</option>
                        <option value="logs">System Logs</option>
                        <option value="sessions">Active Sessions</option>
                        <option value="homepage">Homepage Config</option>
                        <option value="external">External Resources</option>
                      </optgroup>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <i className="fas fa-chevron-down text-xs"></i>
                    </div>
                  </div>

                  <button
                    onClick={handleExportLogs}
                    disabled={isExporting}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 shrink-0"
                  >
                    {isExporting ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fas fa-download"></i>
                    )}
                    {t.profile.exportLogs}
                  </button>
                </div>

                {/* New One-Click Cloud Backup Button */}
                <button
                  onClick={() => setShowBackupModal(true)}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold uppercase tracking-widest hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-cloud-upload-alt"></i>
                  Backup to Cloud (R2)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Permission Request Modal */}
      {isPermModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-unlock-alt text-xl"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t.profile.requestPermissionTitle}
                </h3>
                <p className="text-sm text-slate-500 mt-2">
                  {requestType === 'ROLE'
                    ? 'Request a specific role change'
                    : 'Request specific permission access'}
                </p>
              </div>

              <form onSubmit={handlePermSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                    {requestType === 'ROLE' ? 'Target Role' : t.profile.permissionKey}
                  </label>
                  {requestType === 'ROLE' ? (
                    <div className="flex gap-2">
                      <select
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white"
                        value={permRequest.role}
                        onChange={(e) => setPermRequest({ ...permRequest, role: e.target.value })}
                      >
                        {availableRoles.length > 0 ? (
                          availableRoles
                            .filter((r) => r.name !== 'super_admin')
                            .map((role) => (
                              <option key={role._id} value={role.name}>
                                {role.name}
                              </option>
                            ))
                        ) : (
                          <>
                            <option value="admin">admin</option>
                            <option value="user">user</option>
                          </>
                        )}
                      </select>
                    </div>
                  ) : (
                    // If selecting raw permission keys
                    <div className="flex gap-2">
                      <input
                        type="text"
                        list="perms-list"
                        value={permRequest.permission}
                        onChange={(e) =>
                          setPermRequest({ ...permRequest, permission: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white font-mono text-sm"
                        placeholder="e.g. system:logs"
                      />
                      <datalist id="perms-list">
                        {backendPermissions
                          .filter((p) => p.key !== '*')
                          .map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.name}
                            </option>
                          ))}
                      </datalist>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                    {t.profile.reasonLabel}
                  </label>
                  <textarea
                    value={permRequest.reason}
                    onChange={(e) => setPermRequest({ ...permRequest, reason: e.target.value })}
                    placeholder={t.profile.reasonPlaceholder}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-32 text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPermModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t.access.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPerm || !permRequest.reason.trim()}
                    className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-sm uppercase shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmittingPerm && <i className="fas fa-circle-notch fa-spin"></i>}
                    {t.profile.submitRequest}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
