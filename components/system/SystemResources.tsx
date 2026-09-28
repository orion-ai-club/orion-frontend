import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/LanguageContext';
import { featureService } from '../../services/featureService';
import { apiService } from '../../services/api';
import { CloudinaryUsage, R2UsageStats } from '../../types';
import { toast } from '../Toast';
import { DeleteModal } from '../DeleteModal';
import { useLocation } from 'react-router-dom';
import { R2UsageDashboard } from './R2UsageDashboard';
import { R2FilePreviewModal } from './R2FilePreviewModal';
import {
  getR2FileIcon,
  getR2FileName,
  getR2LanguageLabel,
  isR2Previewable
} from './r2FileUtils';

export const SystemResources: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'CLOUDINARY' | 'R2'>('R2');

  // Cloudinary State
  const [usageData, setUsageData] = useState<CloudinaryUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [isCloudinaryLibraryOpen, setIsCloudinaryLibraryOpen] = useState(false);
  const [cloudinaryImages, setCloudinaryImages] = useState<{ url: string; public_id: string }[]>(
    []
  );
  const [loadingCloudinaryLib, setLoadingCloudinaryLib] = useState(false);

  // R2 State (Enhanced)
  const [r2Files, setR2Files] = useState<any[]>([]);
  const [r2Folders, setR2Folders] = useState<any[]>([]); // New: Separate folders
  const [loadingR2, setLoadingR2] = useState(false);
  const [r2Cursor, setR2Cursor] = useState<string | undefined>(undefined);
  const [r2HasMore, setR2HasMore] = useState(true);

  // R2 Upload State
  const [isUploading, setIsUploading] = useState(false);
  const r2FileInputRef = useRef<HTMLInputElement>(null);

  // R2 Usage Dashboard State
  const [r2Usage, setR2Usage] = useState<R2UsageStats | null>(null);
  const [loadingR2Usage, setLoadingR2Usage] = useState(false);

  // R2 Navigation State
  const [r2Type, setR2Type] = useState<'all' | 'resource' | 'backup'>('all');
  const [currentFolder, setCurrentFolder] = useState<string>(''); // Current subfolder path (e.g. "2023-12-25/")
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  // Common Delete State
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    type: 'CLOUDINARY' | 'R2';
  } | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    targetFolder?: string;
  }>({ x: 0, y: 0, visible: false });
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Initialize from Location State (if coming from backup action)
  useEffect(() => {
    if (location.state && (location.state as any).resourceTab) {
      setActiveTab((location.state as any).resourceTab);
    }
    if (location.state && (location.state as any).r2Type) {
      setR2Type((location.state as any).r2Type);
    }
  }, [location.state]);

  // Click outside to close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // --- Cloudinary Logic ---
  const fetchUsage = async () => {
    setLoadingUsage(true);
    try {
      const data = await featureService.getCloudinaryUsage();
      setUsageData(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load metrics.');
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleOpenCloudinaryLibrary = async () => {
    setIsCloudinaryLibraryOpen(true);
    setLoadingCloudinaryLib(true);
    try {
      const imgs = await apiService.getRecentImages();
      setCloudinaryImages(imgs);
    } catch (e) {
      toast.error('Failed to load images');
    } finally {
      setLoadingCloudinaryLib(false);
    }
  };

  // --- R2 Logic ---
  const fetchR2Data = async (cursor?: string) => {
    setLoadingR2(true);
    try {
      // Call updated endpoint with folder & type
      const res: any = await featureService.getR2Files(200, cursor, r2Type, currentFolder);
      if (res.success) {
        const incomingFiles = res.data.files || [];
        const incomingFolders = res.data.folders || [];
        const pagination = res.pagination || {};

        // If cursor exists, append files (folders usually don't paginate the same way in mixed views, but logic applies)
        // For cleaner folder navigation, we usually replace list on folder change, append on load more
        if (cursor) {
          setR2Files((prev) => [...prev, ...incomingFiles]);
        } else {
          setR2Files(incomingFiles);
          setR2Folders(incomingFolders);
        }

        // Sync current folder from metadata if available to keep breadcrumbs accurate
        if (res.meta && typeof res.meta.currentPath === 'string') {
          if (res.meta.currentPath !== currentFolder) {
            setCurrentFolder(res.meta.currentPath);
          }
        }

        setR2Cursor(pagination.nextCursor);
        setR2HasMore(!!pagination.hasMore);
      }
    } catch (e) {
      console.error(e);
      toast.error(t.system.r2.empty);
    } finally {
      setLoadingR2(false);
    }
  };

  const fetchR2Usage = async () => {
    setLoadingR2Usage(true);
    try {
      const stats = await featureService.getR2Usage();
      setR2Usage(stats);
    } catch (e) {
      console.error('Failed to load R2 usage stats', e);
    } finally {
      setLoadingR2Usage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CLOUDINARY' && !usageData) {
      fetchUsage();
    } else if (activeTab === 'R2') {
      // Reset and fetch when tab or type or folder changes
      setR2Files([]);
      setR2Folders([]);
      setR2Cursor(undefined);
      fetchR2Data();
      // Only fetch usage once per session or on tab switch
      if (!r2Usage) fetchR2Usage();
    }
  }, [activeTab, r2Type, currentFolder]);

  const handleLoadMoreR2 = () => {
    if (r2HasMore && !loadingR2) {
      fetchR2Data(r2Cursor);
    }
  };

  const handleFolderClick = (nextQueryParam: string) => {
    // Directly set the folder path provided by the API
    setCurrentFolder(nextQueryParam);
  };

  const handleBreadcrumbClick = (index: number, parts: string[]) => {
    // Reconstruct path up to index
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentFolder(newPath);
  };

  const handleRootClick = () => {
    setCurrentFolder('');
  };

  // --- Context Menu Logic ---
  const handleContextMenu = (e: React.MouseEvent, folderName?: string) => {
    if (activeTab === 'R2' && r2Type === 'all') return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      targetFolder: folderName
    });
  };

  // --- Create Folder Logic ---
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsUploading(true);
    try {
      // Use Presigned URL to upload a .keep file to create folder structure
      await featureService.createR2Folder(newFolderName, currentFolder);
      toast.success('Folder created!');
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
      fetchR2Data(); // Refresh to see new folder
    } catch (e) {
      console.error(e);
      toast.error('Failed to create folder.');
    } finally {
      setIsUploading(false);
    }
  };

  const openCreateFolderModal = () => {
    if (r2Type === 'all') return;
    setIsCreateFolderModalOpen(true);
    setContextMenu({ ...contextMenu, visible: false });
  };

  // --- R2 Upload Logic (Presigned) ---
  const handleR2UploadClick = () => {
    if (r2Type === 'all') {
      toast.error('Switch to Resources or Backups before uploading.');
      return;
    }
    if (r2FileInputRef.current) r2FileInputRef.current.click();
  };

  const handleR2FileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    // Determine upload target: If context menu had a target, upload there, else current folder
    const targetPath = contextMenu.targetFolder || currentFolder;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Use New Presigned Flow
        await featureService.uploadFileToR2Presigned(file, targetPath, true);
        successCount++;
      }
      toast.success(`${successCount} file(s) uploaded successfully.`);
      fetchR2Data(); // Refresh list
      fetchR2Usage(); // Refresh usage stats
    } catch (e: any) {
      console.error(e);
      toast.error('Upload failed: ' + e.message);
    } finally {
      setIsUploading(false);
      setContextMenu({ ...contextMenu, targetFolder: undefined }); // Reset context target
      if (r2FileInputRef.current) r2FileInputRef.current.value = '';
    }
  };

  // --- Common Delete Logic ---
  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    const { id, type } = fileToDelete;

    try {
      if (type === 'CLOUDINARY') {
        setCloudinaryImages((prev) => prev.filter((img) => img.public_id !== id));
        await apiService.deleteCloudinaryImage(id);
        fetchUsage(); // Refresh usage stats
      } else {
        // R2 Delete
        // Ensure we filter by unique ID (key) which is passed as 'id'
        setR2Files((prev) => prev.filter((f) => (f.id || f.key || f.name) !== id));
        await featureService.deleteR2File(id);
        fetchR2Usage(); // Refresh usage
      }
      toast.success(t.system.r2.deleteSuccess);
    } catch (e) {
      console.error(e);
      toast.error('Delete failed');
    } finally {
      setFileToDelete(null);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="animate-fade-in space-y-6" onContextMenu={(e) => handleContextMenu(e)}>
      {/* Tab Switcher */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('R2')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'R2' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-500' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          {t.system.r2.tab_storage}
        </button>
        <button
          onClick={() => setActiveTab('CLOUDINARY')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'CLOUDINARY' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          {t.system.r2.tab_cloudinary}
        </button>
      </div>

      {/* --- CLOUDINARY VIEW --- */}
      {activeTab === 'CLOUDINARY' && (
        <>
          {loadingUsage && !usageData ? (
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i>
              <p className="text-slate-400 font-mono text-sm uppercase">
                {t.system.common.loading}
              </p>
            </div>
          ) : usageData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Overall Status */}
              <div className="lg:col-span-1 space-y-8">
                {/* Plan Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors"></div>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-lg">
                        <i className="fas fa-cloud"></i>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">
                          {t.system.cloudinary.title}
                        </h3>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">
                          {usageData.plan} Plan
                        </p>
                      </div>
                    </div>

                    {/* Library Button */}
                    <button
                      onClick={handleOpenCloudinaryLibrary}
                      className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-500 flex items-center justify-center transition-all shadow-sm"
                      title="Manage Image Library"
                    >
                      <i className="fas fa-images"></i>
                    </button>
                  </div>

                  {/* Circular Progress for Total Credits */}
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          className="text-slate-100 dark:text-slate-800"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={440}
                          strokeDashoffset={440 - (440 * usageData.credits.used_percent) / 100}
                          className={`transition-all duration-1000 ease-out ${
                            usageData.credits.used_percent > 80
                              ? 'text-red-500'
                              : usageData.credits.used_percent > 50
                                ? 'text-amber-500'
                                : 'text-emerald-500'
                          }`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-slate-800 dark:text-white">
                          {usageData.credits.used_percent.toFixed(1)}%
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                          {t.system.cloudinary.credits}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 text-center">
                      {usageData.credits.usage.toFixed(2)} used of {usageData.credits.limit} monthly
                      credits
                    </p>
                  </div>
                </div>

                {/* Resources Summary */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-lg">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                    {t.system.cloudinary.resources}
                  </h4>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600 dark:text-slate-300">
                      <i className="fas fa-images mr-2 text-indigo-400"></i> Media Assets
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {formatNumber(usageData.resources)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600 dark:text-slate-300">
                      <i className="fas fa-magic mr-2 text-purple-400"></i> Derived
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {formatNumber(usageData.derived_resources)}
                    </span>
                  </div>
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-3"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300">
                      <i className="fas fa-exchange-alt mr-2 text-emerald-400"></i> Requests
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {formatNumber(usageData.requests)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Detailed Metrics */}
              <div className="lg:col-span-2 space-y-6">
                {/* Storage Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <i className="fas fa-hdd"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white">
                          {t.system.cloudinary.storage}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {formatBytes(usageData.storage.usage)} Used
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      {usageData.storage.credits_usage.toFixed(2)} Credits
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full"
                      style={{
                        width: `${(usageData.storage.credits_usage / usageData.credits.usage) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-400">
                      {((usageData.storage.credits_usage / usageData.credits.usage) * 100).toFixed(
                        1
                      )}
                      % of total usage
                    </span>
                  </div>
                </div>

                {/* Bandwidth Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                        <i className="fas fa-network-wired"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white">
                          {t.system.cloudinary.bandwidth}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {formatBytes(usageData.bandwidth.usage)} Consumed
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      {usageData.bandwidth.credits_usage.toFixed(2)} Credits
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-cyan-500 h-full rounded-full"
                      style={{
                        width: `${(usageData.bandwidth.credits_usage / usageData.credits.usage) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-400">
                      {(
                        (usageData.bandwidth.credits_usage / usageData.credits.usage) *
                        100
                      ).toFixed(1)}
                      % of total usage
                    </span>
                  </div>
                </div>

                {/* Transformations Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <i className="fas fa-sync-alt"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-white">
                          {t.system.cloudinary.transformations}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {formatNumber(usageData.transformations.usage)} Operations
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      {usageData.transformations.credits_usage.toFixed(2)} Credits
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full rounded-full"
                      style={{
                        width: `${(usageData.transformations.credits_usage / usageData.credits.usage) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-slate-400">
                      {(
                        (usageData.transformations.credits_usage / usageData.credits.usage) *
                        100
                      ).toFixed(1)}
                      % of total usage
                    </span>
                  </div>
                </div>

                {/* Objects Count (Simple Stat) */}
                <div className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-500 flex items-center justify-center shadow-sm">
                      <i className="fas fa-cubes"></i>
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-sm">
                      {t.system.cloudinary.objects}
                    </span>
                  </div>
                  <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                    {formatNumber(usageData.objects.usage)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* --- R2 VIEW (Updated with Dashboard, Folders & Breadcrumbs) --- */}
      {activeTab === 'R2' && (
        <div className="flex flex-col gap-6">
          {/* R2 Usage Dashboard */}
          {r2Usage && <R2UsageDashboard usage={r2Usage} />}

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl min-h-[600px] flex flex-col relative">
            {/* Header & Controls */}
            <div className="flex flex-col gap-4 mb-4 shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg">
                    <i className="fas fa-layer-group"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                      {t.system.r2.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r2Type === 'all' && r2Usage
                        ? `${r2Usage.total.count} objects in bucket`
                        : `${r2Files.length} files · ${r2Folders.length} folders`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* Scope Switcher */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => {
                        setR2Type('all');
                        setCurrentFolder('');
                      }}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${r2Type === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                    >
                      All Objects
                    </button>
                    <button
                      onClick={() => {
                        setR2Type('resource');
                        setCurrentFolder('');
                      }}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${r2Type === 'resource' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                    >
                      {t.system.r2.resources}
                    </button>
                    <button
                      onClick={() => {
                        setR2Type('backup');
                        setCurrentFolder('');
                      }}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${r2Type === 'backup' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                    >
                      {t.system.r2.backups}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      fetchR2Data();
                      fetchR2Usage();
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500 flex items-center justify-center transition-colors"
                  >
                    <i className="fas fa-sync"></i>
                  </button>

                  {/* Upload is intentionally scoped to managed prefixes, not bucket root. */}
                  {r2Type !== 'all' && (
                    <button
                      onClick={handleR2UploadClick}
                      disabled={isUploading}
                      className="px-4 bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <i className="fas fa-circle-notch fa-spin"></i>
                      ) : (
                        <i className="fas fa-upload"></i>
                      )}
                      {t.system.r2.upload}
                    </button>
                  )}
                  <input
                    type="file"
                    multiple
                    ref={r2FileInputRef}
                    className="hidden"
                    onChange={handleR2FileChange}
                    disabled={isUploading}
                  />
                </div>
              </div>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 dark:bg-black/30 p-2 rounded-xl overflow-x-auto whitespace-nowrap custom-scrollbar">
                <button
                  onClick={handleRootClick}
                  className={`flex items-center gap-1 hover:text-orange-500 transition-colors ${!currentFolder ? 'font-bold text-orange-500' : ''}`}
                >
                  <i className="fas fa-home"></i> {t.system.r2.home}
                </button>
                {currentFolder
                  .split('/')
                  .filter(Boolean)
                  .map((part, index, arr) => (
                    <React.Fragment key={index}>
                      <span className="text-slate-300 text-xs">/</span>
                      <button
                        onClick={() => handleBreadcrumbClick(index, arr)}
                        className={`hover:text-orange-500 transition-colors ${index === arr.length - 1 ? 'font-bold text-slate-700 dark:text-slate-200' : ''}`}
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-50 dark:bg-black/20 rounded-2xl relative">
              {/* Folders Section */}
              {r2Folders.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 px-1">
                    {t.system.r2.folders}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {r2Folders.map((folder, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleFolderClick(folder.nextQueryParam || folder.name)}
                        onContextMenu={(e) => handleContextMenu(e, folder.name)}
                        className="bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-slate-700/80 transition-colors group"
                      >
                        <i className="fas fa-folder text-amber-400 text-xl group-hover:text-amber-500"></i>
                        <span
                          className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate"
                          title={folder.name}
                        >
                          {folder.name.replace(/\/$/, '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files: drive-style rows so every object has a visible identity and action. */}
              {r2Files.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="hidden md:grid grid-cols-[minmax(0,1fr)_110px_100px_130px_112px] gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Size</span>
                    <span>Modified</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {r2Files.map((file) => {
                      const icon = getR2FileIcon(file);
                      const name = getR2FileName(file);
                      const canDelete =
                        String(file.id || file.key || file.path || '').startsWith('uploads/') ||
                        String(file.id || file.key || file.path || '').startsWith('db-backups/');
                      const canPreview = isR2Previewable(file);

                      return (
                        <div
                          key={file.id || file.key || file.name}
                          className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_110px_100px_130px_112px] gap-3 items-center px-3 md:px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="min-w-0 flex items-center gap-3 text-left"
                            title={canPreview ? `Preview ${name}` : `File details: ${name}`}
                          >
                            <div className={`w-10 h-10 rounded-xl ${icon.bg} ${icon.tone} flex items-center justify-center shrink-0`}>
                              <i className={`fas ${icon.icon} text-lg`}></i>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                {file.path || file.key || name}
                              </div>
                            </div>
                          </button>

                          <span className="hidden md:block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {getR2LanguageLabel(file)}
                          </span>
                          <span className="hidden md:block text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {formatBytes(file.size)}
                          </span>
                          <span className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
                            {file.lastModified ? new Date(file.lastModified).toLocaleString() : '—'}
                          </span>

                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setPreviewFile(file)}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-500/10 transition-colors flex items-center justify-center"
                              title={canPreview ? 'Preview' : 'File details'}
                            >
                              <i className={`fas ${canPreview ? 'fa-eye' : 'fa-circle-info'} text-xs`}></i>
                            </button>
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors flex items-center justify-center"
                                title="Open original"
                              >
                                <i className="fas fa-arrow-up-right-from-square text-xs"></i>
                              </a>
                            )}
                            {canDelete && (
                              <button
                                onClick={() =>
                                  setFileToDelete({
                                    id: file.id || file.key || file.name,
                                    type: 'R2'
                                  })
                                }
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                                title={t.system.common.delete}
                              >
                                <i className="fas fa-trash-alt text-xs"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {r2Files.length === 0 && r2Folders.length === 0 && !loadingR2 && (
                <div
                  className="flex flex-col items-center justify-center h-40 text-slate-400 cursor-pointer hover:text-slate-500"
                  onContextMenu={(e) => handleContextMenu(e)}
                >
                  <i className="fas fa-folder-open text-4xl mb-3 opacity-50"></i>
                  <p>{t.system.r2.empty}</p>
                  <span className="text-[10px] mt-1 opacity-50">Right-click to create folder</span>
                </div>
              )}

              {loadingR2 && (
                <div className="py-8 text-center text-slate-400 animate-pulse">
                  <i className="fas fa-circle-notch fa-spin mr-2"></i> {t.system.common.loading}
                </div>
              )}

              {!loadingR2 && r2HasMore && (r2Files.length > 0 || r2Folders.length > 0) && (
                <button
                  onClick={handleLoadMoreR2}
                  className="w-full py-3 mt-4 text-xs font-bold uppercase text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:text-blue-500 hover:border-blue-500 transition-colors"
                >
                  {t.system.r2.loadMore}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CONTEXT MENU --- */}
      {contextMenu.visible &&
        createPortal(
          <div
            className="fixed z-[10000] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg py-1 w-48 text-sm text-slate-700 dark:text-slate-300 animate-fade-in"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {contextMenu.targetFolder ? (
              <>
                <div className="px-3 py-2 text-xs font-bold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 truncate">
                  {contextMenu.targetFolder}
                </div>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => handleFolderClick(contextMenu.targetFolder!)}
                >
                  <i className="fas fa-folder-open text-amber-500"></i> Open Folder
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={handleR2UploadClick}
                >
                  <i className="fas fa-upload text-blue-500"></i> Upload Here
                </button>
              </>
            ) : (
              <>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={openCreateFolderModal}
                >
                  <i className="fas fa-folder-plus text-amber-500"></i> Create Folder
                </button>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={handleR2UploadClick}
                >
                  <i className="fas fa-upload text-blue-500"></i> Upload File
                </button>
              </>
            )}
          </div>,
          document.body
        )}

      {/* --- CREATE FOLDER MODAL --- */}
      {isCreateFolderModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
                Create New Folder
              </h3>
              <form onSubmit={handleCreateFolder}>
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Folder Name
                  </label>
                  <input
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-orange-500"
                    placeholder="e.g. Documents"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateFolderModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || !newFolderName.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {isUploading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      <R2FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* --- SHARED MODALS --- */}

      {/* Cloudinary Modal */}
      {isCloudinaryLibraryOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <i className="fas fa-images"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {t.system.cloudinary.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {cloudinaryImages.length} Assets
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCloudinaryLibraryOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-black/20 custom-scrollbar">
                {loadingCloudinaryLib ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <i className="fas fa-circle-notch fa-spin text-3xl mb-4 text-blue-500"></i>
                    <p className="font-mono text-xs uppercase tracking-widest">
                      {t.system.common.loading}
                    </p>
                  </div>
                ) : cloudinaryImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <i className="fas fa-folder-open text-5xl mb-4 opacity-50"></i>
                    <p>No images found in library.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {cloudinaryImages.map((img) => (
                      <div
                        key={img.public_id}
                        className="group relative aspect-square bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700"
                      >
                        <img
                          src={img.url}
                          alt="Asset"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <button
                            onClick={() =>
                              setFileToDelete({ id: img.public_id, type: 'CLOUDINARY' })
                            }
                            className="w-10 h-10 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all flex items-center justify-center hover:bg-red-600 shadow-lg"
                            title={t.system.common.delete}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur p-1 text-[9px] text-white/80 font-mono truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {img.public_id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={confirmDeleteFile}
        title={t.system.r2.deleteTitle}
        message={t.system.r2.deleteMsg.replace(
          '{storage}',
          fileToDelete?.type === 'R2' ? 'R2 Storage' : 'Cloudinary'
        )}
        requireInput={false}
        buttonText={t.system.common.delete}
        zIndexClass="z-[10000]"
      />
    </div>
  );
};
