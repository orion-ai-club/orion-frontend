import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { withBuiltinProjects } from '../../constants/builtinProjects';
import { apiService } from '../../services/api';
import {
  PortfolioImportPreview,
  PortfolioImportProgress,
  PortfolioProject,
  PortfolioProjectCategory,
  User
} from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import { toast } from '../Toast';
import { DeleteModal } from '../DeleteModal';
import { R2ImageSelectorModal } from '../R2ImageSelectorModal';
import { renderSafeMarkdown, safeExternalUrl } from '../../utils/security';
import { dataUrlToBlob } from '../../utils/dataUrl';

interface ProjectShowcaseProps {
  currentUser?: User | null;
}

type ConcreteProjectCategory = PortfolioProjectCategory;
type ProjectCategory = 'all' | ConcreteProjectCategory;

const CATEGORY_META: Array<{ value: ProjectCategory; icon: string; zh: string; en: string }> = [
  { value: 'all', icon: 'fa-layer-group', zh: '全部作品', en: 'All work' },
  { value: 'web', icon: 'fa-window-maximize', zh: 'Web 应用', en: 'Web' },
  { value: 'fullstack', icon: 'fa-server', zh: '全栈系统', en: 'Full Stack' },
  { value: 'mobile', icon: 'fa-mobile-alt', zh: '移动端', en: 'Mobile' },
  { value: 'tools', icon: 'fa-screwdriver-wrench', zh: '工具', en: 'Tools' }
];

const inferCategories = (project: PortfolioProject): ConcreteProjectCategory[] => {
  if (Array.isArray(project.categories) && project.categories.length > 0) {
    return Array.from(new Set(project.categories)) as ConcreteProjectCategory[];
  }
  if (project.category) return [project.category];

  const stack = (project.techStack || []).join(' ').toLowerCase();
  if (/react native|expo|flutter|swift|kotlin|android|ios/.test(stack)) return ['mobile'];
  if (/node|express|mongo|cloudflare|worker|d1|sql|firebase|cloud run|golang/.test(stack))
    return ['fullstack'];
  return ['web'];
};

export const ProjectShowcase: React.FC<ProjectShowcaseProps> = ({ currentUser }) => {
  const { language, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>('all');

  // Admin State
  const [isEditing, setIsEditing] = useState(false);
  const [currentProject, setCurrentProject] = useState<Partial<PortfolioProject>>({});
  // Fix: Dedicated state for Tech Stack input to allow free typing of commas/spaces
  const [techStackInput, setTechStackInput] = useState('');

  const [projectToDelete, setProjectToDelete] = useState<PortfolioProject | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRepoUrl, setImportRepoUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<PortfolioImportProgress | null>(null);
  const [isProjectAiBusy, setIsProjectAiBusy] = useState(false);
  const [projectAiMode, setProjectAiMode] = useState<'sync' | 'rewrite' | null>(null);
  const [projectAiProgress, setProjectAiProgress] = useState<PortfolioImportProgress | null>(null);
  const [cloudflareAiToken, setCloudflareAiToken] = useState('');
  const [cloudflareAccountId, setCloudflareAccountId] = useState('');
  const [showCloudflareToken, setShowCloudflareToken] = useState(false);
  const [generatedCoverSvg, setGeneratedCoverSvg] = useState('');
  const [generatedAiCoverDataUrl, setGeneratedAiCoverDataUrl] = useState('');
  const [generatedIconDataUrl, setGeneratedIconDataUrl] = useState('');
  const [importedIconPath, setImportedIconPath] = useState('');
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);
  const [r2MediaTarget, setR2MediaTarget] = useState<'cover' | 'icon'>('cover');

  // Demo Modal State
  const [demoProject, setDemoProject] = useState<PortfolioProject | null>(null);
  const [viewMode, setViewMode] = useState<'CHOICE' | 'IFRAME' | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [activeDetailProject, setActiveDetailProject] = useState<PortfolioProject | null>(null);

  const canManageProjects = currentUser?.role === 'super_admin';

  // 1. Load Projects
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await apiService.getPortfolioProjects();
      const safeProjects = (Array.isArray(data) ? data : []).map((project) => ({
        ...project,
        techStack: Array.isArray(project.techStack) ? project.techStack : [],
        categories:
          Array.isArray(project.categories) && project.categories.length > 0
            ? project.categories
            : project.category
              ? [project.category]
              : undefined
      }));
      setProjects(withBuiltinProjects(safeProjects));
    } catch (e) {
      console.error('Failed to load projects', e);
      setProjects(withBuiltinProjects([]));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Deep Linking Logic: Sync URL 'demo' param with Modal State
  useEffect(() => {
    const demoId = searchParams.get('demo');

    // Only proceed if projects are loaded
    if (isLoading || projects.length === 0) return;

    if (demoId) {
      // If we have a demo ID in URL
      const target = projects.find((p) => p._id === demoId);
      if (target) {
        // Only update state if needed to prevent infinite loops
        if (demoProject?._id !== target._id || viewMode !== 'IFRAME') {
          setDemoProject(target);
          setViewMode('IFRAME'); // Directly go to Iframe view as requested
        }
      }
    } else {
      // If URL param is removed externally (back button), and we are in IFRAME mode, close modal
      // We check for IFRAME mode to allow CHOICE mode to exist without URL param
      if (viewMode === 'IFRAME') {
        closeDemoModal(false);
      }
    }
  }, [searchParams, projects, isLoading, viewMode, demoProject]);

  const getLocalized = (obj: any, field: string) => {
    return language === 'zh'
      ? obj[`${field}_zh`] || obj[`${field}_en`]
      : obj[`${field}_en`] || obj[`${field}_zh`];
  };

  const handleCreate = () => {
    setGeneratedCoverSvg('');
    setGeneratedAiCoverDataUrl('');
    setGeneratedIconDataUrl('');
    setImportedIconPath('');
    setCurrentProject({
      title_zh: '',
      title_en: '',
      summary_zh: '',
      summary_en: '',
      description_zh: '',
      description_en: '',
      techStack: [],
      repoUrl: '',
      demoUrl: '',
      coverImage: '',
      iconImage: '',
      category: 'web',
      categories: ['web'],
      order: 0,
      isVisible: true
    });
    setTechStackInput('');
    setIsEditing(true);
  };

  const handleEdit = (project: PortfolioProject) => {
    setGeneratedCoverSvg('');
    setGeneratedAiCoverDataUrl('');
    setGeneratedIconDataUrl('');
    setImportedIconPath('');
    setCurrentProject({ ...project, categories: inferCategories(project) });
    setTechStackInput(project.techStack ? project.techStack.join(', ') : '');
    setIsEditing(true);
  };

  const handleGithubImportPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    const repoUrl = importRepoUrl.trim();
    if (!repoUrl) return;

    setIsImporting(true);
    setImportProgress({
      stage: 'connect',
      percent: 1,
      message: 'Connecting to the import stream'
    });
    try {
      const preview: PortfolioImportPreview = await apiService.streamGithubPortfolioImport(
        repoUrl,
        (progress: PortfolioImportProgress) => setImportProgress(progress),
        cloudflareAiToken.trim() || undefined,
        cloudflareAccountId.trim() || undefined
      );
      setGeneratedCoverSvg(preview.coverSvg || '');
      setGeneratedAiCoverDataUrl('');
      setGeneratedIconDataUrl(preview.iconDataUrl || '');
      setImportedIconPath(preview.source.iconPath || '');
      setCurrentProject({
        ...preview.project,
        categories:
          Array.isArray(preview.project.categories) && preview.project.categories.length > 0
            ? preview.project.categories
            : preview.project.category
              ? [preview.project.category]
              : ['web']
      });
      setTechStackInput((preview.project.techStack || []).join(', '));
      setIsImportOpen(false);
      setIsEditing(true);
      toast.success('GitHub project analysed. Review it before saving.');
    } catch (error) {
      console.error(error);
      toast.error('GitHub import failed. Check repository access and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const prepareProjectEditor = (project: Partial<PortfolioProject>) => {
    setGeneratedCoverSvg('');
    setGeneratedAiCoverDataUrl('');
    setGeneratedIconDataUrl('');
    setImportedIconPath('');
    setCurrentProject({
      ...project,
      categories:
        Array.isArray(project.categories) && project.categories.length > 0
          ? project.categories
          : project.category
            ? [project.category]
            : ['web']
    });
    setTechStackInput((project.techStack || []).join(', '));
    setIsEditing(true);
  };

  const handleSyncProjectFromGithub = async (project: Partial<PortfolioProject>) => {
    const repoUrl = project.repoUrl?.trim();
    if (!repoUrl) {
      toast.error('Add a GitHub repository URL before syncing.');
      return;
    }

    prepareProjectEditor(project);
    setIsProjectAiBusy(true);
    setProjectAiMode('sync');
    setProjectAiProgress({
      stage: 'connect',
      percent: 1,
      message: 'Connecting to GitHub sync'
    });

    try {
      const preview = await apiService.streamGithubPortfolioImport(
        repoUrl,
        (progress: PortfolioImportProgress) => setProjectAiProgress(progress),
        cloudflareAiToken.trim() || undefined,
        cloudflareAccountId.trim() || undefined
      );

      const synced = preview.project;
      setCurrentProject((existing) => ({
        ...existing,
        title_zh: synced.title_zh || existing.title_zh,
        title_en: synced.title_en || existing.title_en,
        summary_zh: synced.summary_zh || '',
        summary_en: synced.summary_en || '',
        description_zh: synced.description_zh || '',
        description_en: synced.description_en || '',
        techStack: synced.techStack || [],
        category: synced.category || existing.category || 'web',
        categories:
          Array.isArray(synced.categories) && synced.categories.length > 0
            ? synced.categories
            : existing.categories,
        repoUrl: repoUrl
      }));
      setTechStackInput((synced.techStack || []).join(', '));

      if (!project.iconImage && preview.iconDataUrl) {
        setGeneratedIconDataUrl(preview.iconDataUrl);
        setImportedIconPath(preview.source.iconPath || '');
      }

      toast.success('GitHub details synced. Review changes before saving.');
    } catch (error) {
      console.error(error);
      toast.error('GitHub sync failed.');
    } finally {
      setIsProjectAiBusy(false);
      setProjectAiMode(null);
    }
  };

  const handleAiRewriteProject = async (project: Partial<PortfolioProject>) => {
    prepareProjectEditor(project);
    setIsProjectAiBusy(true);
    setProjectAiMode('rewrite');
    setProjectAiProgress({
      stage: 'connect',
      percent: 1,
      message: 'Connecting to AI rewrite'
    });

    const categories: PortfolioProjectCategory[] =
      Array.isArray(project.categories) && project.categories.length > 0
        ? project.categories
        : project.category
          ? [project.category]
          : ['web'];

    try {
      const rewritten = await apiService.streamPortfolioAiRewrite(
        {
          ...project,
          techStack: Array.isArray(project.techStack) ? project.techStack : [],
          category: categories[0],
          categories
        },
        (progress: PortfolioImportProgress) => setProjectAiProgress(progress),
        cloudflareAiToken.trim() || undefined,
        cloudflareAccountId.trim() || undefined
      );

      setCurrentProject((existing) => ({
        ...existing,
        ...rewritten,
        repoUrl: existing.repoUrl,
        demoUrl: existing.demoUrl,
        coverImage: existing.coverImage,
        iconImage: existing.iconImage,
        order: existing.order,
        isVisible: existing.isVisible
      }));
      setTechStackInput((rewritten.techStack || []).join(', '));

      toast.success('AI rewrite is ready. Review changes before saving.');
    } catch (error) {
      console.error(error);
      toast.error('AI rewrite failed.');
    } finally {
      setIsProjectAiBusy(false);
      setProjectAiMode(null);
    }
  };

  const handleGenerateAiCover = async () => {
    if (!currentProject.title_en && !currentProject.title_zh) {
      toast.error('Add a project title before generating a cover.');
      return;
    }

    setIsGeneratingAiCover(true);
    try {
      const selectedCategories: ConcreteProjectCategory[] =
        Array.isArray(currentProject.categories) && currentProject.categories.length > 0
          ? currentProject.categories
          : currentProject.category
            ? [currentProject.category]
            : ['web'];

      const result = await apiService.generatePortfolioAiCover(
        {
          ...currentProject,
          techStack: techStackInput
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
          category: selectedCategories[0],
          categories: selectedCategories
        },
        cloudflareAiToken.trim() || undefined,
        cloudflareAccountId.trim() || undefined
      );

      setGeneratedAiCoverDataUrl(result.dataUrl);
      toast.success('Cloudflare FLUX cover generated.');
    } catch (error) {
      console.error(error);
      toast.error('Cloudflare cover generation is unavailable or not configured.');
    } finally {
      setIsGeneratingAiCover(false);
    }
  };

  const toggleProjectCategory = (category: ConcreteProjectCategory) => {
    setCurrentProject((project) => {
      const selected = Array.isArray(project.categories)
        ? (project.categories as ConcreteProjectCategory[])
        : project.category
          ? [project.category]
          : [];

      const next = selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category];

      // Keep at least one category selected.
      if (next.length === 0) return project;

      return {
        ...project,
        categories: next,
        category: next[0]
      };
    });
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await apiService.deleteProject(projectToDelete._id);
      loadProjects();
      setProjectToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCategories: ConcreteProjectCategory[] =
      Array.isArray(currentProject.categories) && currentProject.categories.length > 0
        ? Array.from(new Set(currentProject.categories))
        : currentProject.category
          ? [currentProject.category]
          : ['web'];

    const processedProject: Partial<PortfolioProject> = {
      ...currentProject,
      category: selectedCategories[0],
      categories: selectedCategories,
      techStack: techStackInput
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
    };

    try {
      if (!processedProject.iconImage && generatedIconDataUrl) {
        setIsUploadingIcon(true);
        const iconBlob = dataUrlToBlob(generatedIconDataUrl);
        const iconExt =
          iconBlob.type === 'image/svg+xml'
            ? 'svg'
            : iconBlob.type === 'image/webp'
              ? 'webp'
              : iconBlob.type === 'image/x-icon' || iconBlob.type === 'image/vnd.microsoft.icon'
                ? 'ico'
                : iconBlob.type === 'image/jpeg'
                  ? 'jpg'
                  : 'png';

        const safeName =
          (processedProject.title_en || 'portfolio-project')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'portfolio-project';

        const importedIcon = new File([iconBlob], `${safeName}-icon.${iconExt}`, {
          type: iconBlob.type || 'image/png'
        });

        processedProject.iconImage = await apiService.uploadImage(importedIcon, {
          folder: 'portfolio/icons'
        });
      }

      if (!processedProject.coverImage && (generatedAiCoverDataUrl || generatedCoverSvg)) {
        setIsUploading(true);
        const safeName =
          (processedProject.title_en || 'portfolio-project')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'portfolio-project';

        let generatedCover: File;
        if (generatedAiCoverDataUrl) {
          const blob = dataUrlToBlob(generatedAiCoverDataUrl);
          generatedCover = new File([blob], `${safeName}-cover.jpg`, {
            type: blob.type || 'image/jpeg'
          });
        } else {
          generatedCover = new File([generatedCoverSvg], `${safeName}-cover.svg`, {
            type: 'image/svg+xml'
          });
        }

        processedProject.coverImage = await apiService.uploadImage(generatedCover, {
          folder: 'portfolio'
        });
      }

      if (processedProject._id) {
        await apiService.updateProject(processedProject._id, processedProject);
      } else {
        await apiService.createProject(processedProject);
      }

      setGeneratedCoverSvg('');
      setGeneratedAiCoverDataUrl('');
      setGeneratedIconDataUrl('');
      setImportedIconPath('');
      setIsEditing(false);
      loadProjects();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save project');
    } finally {
      setIsUploading(false);
      setIsUploadingIcon(false);
    }
  };

  // Logic to process file upload (reused by input change and paste)
  const processUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await apiService.uploadImage(file, { folder: 'portfolio' });
      setCurrentProject((prev) => ({ ...prev, coverImage: url }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  };

  const processIconUpload = async (file: File) => {
    setIsUploadingIcon(true);
    try {
      const url = await apiService.uploadImage(file, { folder: 'portfolio/icons' });
      setCurrentProject((prev) => ({ ...prev, iconImage: url }));
      setGeneratedIconDataUrl('');
      setImportedIconPath('');
      toast.success('Project icon uploaded successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload project icon');
    } finally {
      setIsUploadingIcon(false);
      if (iconFileInputRef.current) iconFileInputRef.current.value = '';
    }
  };

  const handleIconImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processIconUpload(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault(); // Prevent pasting binary string
          processUpload(file);
          return;
        }
      }
    }
  };

  // Demo Logic
  const handleLiveDemoClick = (project: PortfolioProject) => {
    // Just open the choice modal locally.
    // We do NOT update the URL here to keep the choice modal "clean" of deep links
    // until the user actually selects a specific viewing mode that supports deep linking (like Iframe).
    setDemoProject(project);
    setViewMode('CHOICE');
  };

  const handleOpenLocal = () => {
    const url = safeExternalUrl(demoProject?.demoUrl);
    if (!url) {
      toast.error('Invalid demo URL.');
      return;
    }

    // Update URL to trigger Iframe view via Effect.
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (demoProject) newParams.set('demo', demoProject._id);
      return newParams;
    });
    setViewMode('IFRAME');
    setIframeLoading(true);
  };

  const handleOpenNewTab = () => {
    const url = safeExternalUrl(demoProject?.demoUrl);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Invalid demo URL.');
    }
    // Just close modal, don't update URL since we aren't showing anything inside the app
    closeDemoModal(false);
  };

  const closeDemoModal = (updateUrl = true) => {
    setDemoProject(null);
    setViewMode(null);
    setIframeLoading(true);

    if (updateUrl) {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('demo');
        return newParams;
      });
    }
  };

  const safeDemoUrl = safeExternalUrl(demoProject?.demoUrl);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-80 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        ))}
      </div>
    );
  }

  // Styles for the "Kraft Paper" vs "Star Chart" theme in editor
  const modalBaseClass =
    'fixed z-[9999] inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4';
  const editorClass =
    'w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl border bg-white text-slate-900 border-slate-200 dark:bg-[#020617] dark:text-slate-100 dark:border-slate-700 animate-slide-up';
  const inputClass =
    'w-full p-3 rounded-lg outline-none border focus:border-primary-500 bg-slate-50 border-slate-200 dark:bg-[#1e293b] dark:border-slate-700';

  return (
    <div className="relative pb-20">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.5); }
      `}</style>

      <R2ImageSelectorModal
        isOpen={isR2ModalOpen}
        onClose={() => setIsR2ModalOpen(false)}
        onSelect={(url) => {
          setCurrentProject((prev) =>
            r2MediaTarget === 'icon' ? { ...prev, iconImage: url } : { ...prev, coverImage: url }
          );
          if (r2MediaTarget === 'icon') {
            setGeneratedIconDataUrl('');
            setImportedIconPath('');
          }
          setIsR2ModalOpen(false);
        }}
      />

      {isImportOpen &&
        createPortal(
          <div className={modalBaseClass}>
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#020617] dark:text-slate-100">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">
                  GitHub → Apps
                </p>
                <h2 className="mt-2 text-2xl font-bold">Import project</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Paste a GitHub repository URL. Orion will analyse the README and package metadata,
                  draft the portfolio copy and create a free deterministic Orion cover. You can
                  optionally replace it with Cloudflare FLUX before saving. Nothing is persisted
                  until you review and press Save Project.
                </p>
              </div>

              <form onSubmit={handleGithubImportPreview} className="space-y-4">
                <input
                  autoFocus
                  type="url"
                  required
                  placeholder="https://github.com/owner/repository"
                  value={importRepoUrl}
                  onChange={(e) => setImportRepoUrl(e.target.value)}
                  className={inputClass}
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                  Public repositories work directly. Private repositories require
                  <code className="mx-1">GITHUB_PORTFOLIO_TOKEN</code>
                  on the backend with read-only Metadata/Contents access.
                </div>

                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowCloudflareToken((value) => !value)}
                    className="flex w-full items-center justify-between text-left text-sm font-bold"
                  >
                    <span>Use my Cloudflare API token for this session</span>
                    <i
                      className={`fas fa-chevron-${showCloudflareToken ? 'up' : 'down'} text-xs opacity-50`}
                    />
                  </button>
                  {showCloudflareToken && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Cloudflare Account ID (optional if using Orion account)"
                        value={cloudflareAccountId}
                        onChange={(e) => setCloudflareAccountId(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Cloudflare Workers AI API token"
                        value={cloudflareAiToken}
                        onChange={(e) => setCloudflareAiToken(e.target.value)}
                        className={inputClass}
                      />
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        Optional BYOK. Account ID and token stay only in this open Profile session,
                        are sent to the backend only for the current AI request, and are not written
                        to Orion storage or localStorage. Leave both blank to use the server
                        Cloudflare Workers AI configuration.
                      </p>
                    </div>
                  )}
                </div>
                {isImporting && importProgress && (
                  <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-900/60 dark:bg-primary-950/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <i className="fas fa-circle-notch fa-spin shrink-0 text-primary-500" />
                        <span className="truncate text-sm font-bold">{importProgress.message}</span>
                      </div>
                      <span className="shrink-0 text-xs font-black tabular-nums text-primary-600 dark:text-primary-400">
                        {Math.max(0, Math.min(100, importProgress.percent))}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
                        style={{ width: `${Math.max(2, Math.min(100, importProgress.percent))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {importProgress.stage}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => setIsImportOpen(false)}
                    className="rounded-lg px-5 py-2.5 font-bold hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isImporting}
                    className="rounded-lg bg-primary-600 px-6 py-2.5 font-bold text-white disabled:opacity-50 dark:bg-primary-500 dark:text-black"
                  >
                    {isImporting ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin mr-2" />
                        Analysing…
                      </>
                    ) : (
                      <>
                        <i className="fab fa-github mr-2" />
                        Analyse repository
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      <DeleteModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Project?"
      />

      {canManageProjects && (
        <div className="mb-8 flex flex-wrap justify-end gap-3">
          <button
            onClick={() => {
              setImportRepoUrl('');
              setImportProgress(null);
              setIsImportOpen(true);
            }}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold uppercase text-sm hover:border-primary-300 hover:text-primary-600 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <i className="fab fa-github mr-2" />
            Import from GitHub
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-primary-600 dark:bg-primary-500 text-white dark:text-black rounded-xl font-bold uppercase text-sm hover:bg-primary-700 dark:hover:bg-primary-400 transition-colors shadow-lg shadow-primary-500/20 dark:shadow-primary-500/20"
          >
            <i className="fas fa-plus mr-2"></i> Add Project
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing &&
        createPortal(
          <div className={modalBaseClass}>
            <div className={editorClass}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold font-display">
                  {currentProject._id ? 'Edit Project' : 'New Project'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {currentProject.repoUrl && (
                    <button
                      type="button"
                      disabled={isProjectAiBusy}
                      onClick={() => handleSyncProjectFromGithub(currentProject)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <i className="fab fa-github mr-2" />
                      Sync from GitHub
                    </button>
                  )}
                  {(currentProject.title_en || currentProject.title_zh) && (
                    <button
                      type="button"
                      disabled={isProjectAiBusy}
                      onClick={() => handleAiRewriteProject(currentProject)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <i className="fas fa-wand-magic-sparkles mr-2" />
                      AI Rewrite
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {isProjectAiBusy && projectAiProgress && (
                  <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-900/60 dark:bg-primary-950/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <i className="fas fa-circle-notch fa-spin shrink-0 text-primary-500" />
                        <span className="truncate text-sm font-bold">
                          {projectAiProgress.message}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-black tabular-nums text-primary-600 dark:text-primary-400">
                        {Math.max(0, Math.min(100, projectAiProgress.percent))}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
                        style={{
                          width: `${Math.max(2, Math.min(100, projectAiProgress.percent))}%`
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {projectAiMode === 'sync' ? 'GitHub sync' : 'AI rewrite'} ·{' '}
                      {projectAiProgress.stage}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider opacity-60 border-b border-current pb-2">
                      Chinese Content
                    </h3>
                    <input
                      className={inputClass}
                      placeholder="Title (ZH)"
                      value={currentProject.title_zh || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, title_zh: e.target.value }))
                      }
                      required
                    />
                    <textarea
                      className={`${inputClass} h-24`}
                      placeholder="Summary (ZH)"
                      value={currentProject.summary_zh || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, summary_zh: e.target.value }))
                      }
                    />
                    <textarea
                      className={`${inputClass} h-40 font-mono text-sm`}
                      placeholder="Description Markdown (ZH)"
                      value={currentProject.description_zh || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, description_zh: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider opacity-60 border-b border-current pb-2">
                      English Content
                    </h3>
                    <input
                      className={inputClass}
                      placeholder="Title (EN)"
                      value={currentProject.title_en || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, title_en: e.target.value }))
                      }
                      required
                    />
                    <textarea
                      className={`${inputClass} h-24`}
                      placeholder="Summary (EN)"
                      value={currentProject.summary_en || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, summary_en: e.target.value }))
                      }
                    />
                    <textarea
                      className={`${inputClass} h-40 font-mono text-sm`}
                      placeholder="Description Markdown (EN)"
                      value={currentProject.description_en || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, description_en: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-current opacity-80">
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase opacity-60">
                      Tech Stack (comma separated)
                    </label>
                    <input
                      className={inputClass}
                      placeholder="React, Node.js, TypeScript"
                      value={techStackInput}
                      onChange={(e) => setTechStackInput(e.target.value)}
                    />
                    <label className="block text-xs font-bold uppercase opacity-60">
                      Project Categories
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_META.filter(
                        (
                          item
                        ): item is (typeof CATEGORY_META)[number] & {
                          value: ConcreteProjectCategory;
                        } => item.value !== 'all'
                      ).map((item) => {
                        const selectedCategories =
                          Array.isArray(currentProject.categories) &&
                          currentProject.categories.length > 0
                            ? currentProject.categories
                            : currentProject.category
                              ? [currentProject.category]
                              : ['web'];
                        const checked = selectedCategories.includes(item.value);

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => toggleProjectCategory(item.value)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all ${
                              checked
                                ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-400/40 dark:bg-primary-400/10 dark:text-primary-300'
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-primary-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                            aria-pressed={checked}
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] ${
                                checked
                                  ? 'border-primary-500 bg-primary-500 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {checked && <i className="fas fa-check" />}
                            </span>
                            <i className={`fas ${item.icon}`} />
                            <span>{language === 'zh' ? item.zh : item.en}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-xs font-bold uppercase opacity-60">
                      Links & Media
                    </label>
                    <input
                      className={inputClass}
                      placeholder="Demo URL"
                      value={currentProject.demoUrl || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, demoUrl: e.target.value }))
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Repo URL"
                      value={currentProject.repoUrl || ''}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, repoUrl: e.target.value }))
                      }
                    />

                    <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <label className="block text-xs font-bold uppercase opacity-60">
                          Project Icon / Favicon
                        </label>
                        {(currentProject.iconImage || generatedIconDataUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentProject((project) => ({ ...project, iconImage: '' }));
                              setGeneratedIconDataUrl('');
                              setImportedIconPath('');
                            }}
                            className="text-xs font-bold text-slate-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                          {currentProject.iconImage || generatedIconDataUrl ? (
                            <img
                              src={currentProject.iconImage || generatedIconDataUrl}
                              alt="Project icon preview"
                              className="h-full w-full object-contain p-1.5"
                            />
                          ) : (
                            <span className="text-xl font-black text-primary-500">
                              {(currentProject.title_en || currentProject.title_zh || 'P')
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            className={inputClass}
                            placeholder="Icon URL"
                            value={currentProject.iconImage || ''}
                            onChange={(e) => {
                              setCurrentProject((project) => ({
                                ...project,
                                iconImage: e.target.value
                              }));
                              if (e.target.value) {
                                setGeneratedIconDataUrl('');
                                setImportedIconPath('');
                              }
                            }}
                          />
                          {generatedIconDataUrl && importedIconPath && (
                            <p className="mt-1 truncate text-[11px] text-emerald-600 dark:text-emerald-400">
                              <i className="fab fa-github mr-1.5" />
                              Detected from {importedIconPath} · uploads to R2 on Save
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {currentUser?.role === 'super_admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setR2MediaTarget('icon');
                              setIsR2ModalOpen(true);
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary-300 hover:text-primary-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            <i className="fas fa-database mr-2" />
                            R2 Library
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => iconFileInputRef.current?.click()}
                          disabled={isUploadingIcon}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          {isUploadingIcon ? (
                            <i className="fas fa-circle-notch fa-spin mr-2" />
                          ) : (
                            <i className="fas fa-upload mr-2" />
                          )}
                          Upload icon
                        </button>
                        <input
                          type="file"
                          ref={iconFileInputRef}
                          className="hidden"
                          accept="image/*,.ico"
                          onChange={handleIconImageUpload}
                        />
                      </div>
                    </div>

                    {(generatedAiCoverDataUrl || generatedCoverSvg) &&
                      !currentProject.coverImage && (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700">
                          <img
                            src={
                              generatedAiCoverDataUrl ||
                              `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generatedCoverSvg)}`
                            }
                            alt="Generated project cover preview"
                            className="aspect-video w-full object-cover"
                          />
                          <div className="space-y-2 px-3 py-2 text-xs text-slate-300">
                            <div className="flex items-center justify-between gap-3">
                              <span>
                                {generatedAiCoverDataUrl
                                  ? 'Cloudflare FLUX cover · uploads to R2 only when you save'
                                  : 'Free deterministic Orion cover · $0 and generated locally'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setGeneratedAiCoverDataUrl('');
                                  setGeneratedCoverSvg('');
                                }}
                                className="font-bold text-slate-400 hover:text-white"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {generatedAiCoverDataUrl && generatedCoverSvg && (
                                <button
                                  type="button"
                                  onClick={() => setGeneratedAiCoverDataUrl('')}
                                  className="rounded-lg border border-white/15 px-3 py-1.5 font-bold text-slate-200 hover:bg-white/10"
                                >
                                  Use free default
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isGeneratingAiCover}
                                onClick={handleGenerateAiCover}
                                className="rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white hover:bg-white/15 disabled:opacity-50"
                              >
                                {isGeneratingAiCover ? (
                                  <>
                                    <i className="fas fa-circle-notch fa-spin mr-1.5" />
                                    Generating…
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-wand-magic-sparkles mr-1.5" />
                                    {generatedAiCoverDataUrl
                                      ? 'Regenerate with FLUX'
                                      : 'Generate with FLUX'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    {!currentProject.coverImage &&
                      !generatedCoverSvg &&
                      !generatedAiCoverDataUrl && (
                        <button
                          type="button"
                          disabled={isGeneratingAiCover}
                          onClick={handleGenerateAiCover}
                          className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-500 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400"
                        >
                          <i className="fas fa-wand-magic-sparkles mr-2" />
                          Optional: Generate cover with Cloudflare FLUX
                        </button>
                      )}

                    <div className="flex gap-2 relative">
                      <input
                        className={inputClass}
                        placeholder="Cover Image URL (Paste image supported)"
                        value={currentProject.coverImage || ''}
                        onChange={(e) =>
                          setCurrentProject((p) => ({ ...p, coverImage: e.target.value }))
                        }
                        onPaste={handlePaste}
                      />

                      {currentUser?.role === 'super_admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setR2MediaTarget('cover');
                            setIsR2ModalOpen(true);
                          }}
                          className="px-4 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded-lg text-primary-600 dark:text-primary-400 transition-colors flex items-center justify-center min-w-[3rem]"
                          title="R2 Library"
                        >
                          <i className="fas fa-database"></i>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center min-w-[3rem]"
                        title="Upload Image"
                      >
                        {isUploading ? (
                          <i className="fas fa-circle-notch fa-spin"></i>
                        ) : (
                          <i className="fas fa-upload"></i>
                        )}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold">Order Priority:</label>
                    <input
                      type="number"
                      className={`${inputClass} w-24 text-center`}
                      value={currentProject.order || 0}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, order: parseInt(e.target.value) }))
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentProject.isVisible ?? true}
                      onChange={(e) =>
                        setCurrentProject((p) => ({ ...p, isVisible: e.target.checked }))
                      }
                      className="accent-primary-500 w-5 h-5"
                    />
                    <span className="text-sm font-bold">Visible</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-current opacity-80">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedCoverSvg('');
                      setGeneratedAiCoverDataUrl('');
                      setGeneratedIconDataUrl('');
                      setImportedIconPath('');
                      setIsEditing(false);
                    }}
                    className="px-6 py-2.5 rounded-lg font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-primary-500 hover:bg-primary-600 text-white dark:bg-primary-500 dark:hover:bg-primary-400 dark:text-black rounded-lg font-bold shadow-lg shadow-primary-500/20 dark:shadow-primary-500/20 transition-all"
                  >
                    Save Project
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Demo View Modals */}
      {viewMode === 'CHOICE' &&
        demoProject &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-slate-200 dark:border-slate-700 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>

              <button
                onClick={() => closeDemoModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>

              <div className="text-center mb-8 relative z-10">
                <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4 text-primary-500 dark:text-primary-400">
                  <i className="fas fa-desktop text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {t.portfolio.demoOptions.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {getLocalized(demoProject, 'title')}
                </p>
              </div>

              <div className="flex flex-col gap-3 relative z-10">
                <button
                  onClick={handleOpenLocal}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-window-maximize"></i> {t.portfolio.demoOptions.local}
                </button>
                <button
                  onClick={handleOpenNewTab}
                  className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-external-link-alt"></i> {t.portfolio.demoOptions.newTab}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {viewMode === 'IFRAME' &&
        demoProject &&
        safeDemoUrl &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex flex-col bg-slate-900 animate-fade-in">
            {/* Header */}
            <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 shadow-lg relative z-20">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => closeDemoModal(true)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
                <h3 className="text-white font-bold text-sm md:text-base hidden sm:block truncate max-w-xs md:max-w-md">
                  {t.portfolio.demoOptions.iframeTitle}: {getLocalized(demoProject, 'title')}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={safeDemoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-primary-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors"
                >
                  <span className="hidden sm:inline">{t.portfolio.demoOptions.newTab}</span>
                  <i className="fas fa-external-link-alt"></i>
                </a>
                <button
                  onClick={() => closeDemoModal(true)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Iframe Content */}
            <div className="flex-1 relative bg-black w-full">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0">
                  <i className="fas fa-circle-notch fa-spin text-3xl mb-4 text-primary-500"></i>
                  <p className="text-xs uppercase tracking-widest font-mono">
                    Loading Application...
                  </p>
                </div>
              )}
              <iframe
                src={safeDemoUrl}
                className="w-full h-full border-0 relative z-10"
                onLoad={() => setIframeLoading(false)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>,
          document.body
        )}

      <section className="mb-9 flex flex-col gap-5 rounded-[2rem] border border-primary-100/70 bg-white/70 p-4 shadow-[0_20px_70px_-55px_rgba(79,70,229,.55)] backdrop-blur-xl dark:border-primary-400/15 dark:bg-slate-950/55 dark:shadow-none sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400">
            <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-primary-600 dark:text-primary-400">
              {language === 'zh' ? '应用目录' : 'App directory'}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {language === 'zh'
                ? `${projects.length} 个已发布或持续迭代的产品`
                : `${projects.length} shipped products and active experiments`}
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-[1.25rem] bg-primary-50/80 p-1 dark:bg-slate-900 sm:flex"
          role="tablist"
          aria-label="Project categories"
        >
          {CATEGORY_META.map((category) => {
            const count =
              category.value === 'all'
                ? projects.length
                : projects.filter((project) =>
                    inferCategories(project).includes(category.value as ConcreteProjectCategory)
                  ).length;
            return (
              <button
                key={category.value}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.value}
                onClick={() => setActiveCategory(category.value)}
                className={`flex items-center justify-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeCategory === category.value ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20 dark:text-slate-950' : 'text-slate-500 hover:bg-white hover:text-primary-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary-300'}`}
              >
                <i className={`fas ${category.icon}`} aria-hidden="true" />
                <span>{language === 'zh' ? category.zh : category.en}</span>
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-[9px] ${activeCategory === category.value ? 'bg-primary-700 text-white dark:bg-slate-950/15 dark:text-slate-950' : 'bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects
          .filter(
            (project) =>
              activeCategory === 'all' ||
              inferCategories(project).includes(activeCategory as ConcreteProjectCategory)
          )
          .map((project) => {
            const title = getLocalized(project, 'title') || 'Untitled app';
            const projectCategories = inferCategories(project);
            const categoryMeta = projectCategories
              .map((value) => CATEGORY_META.find((item) => item.value === value))
              .filter(Boolean);

            return (
              <article
                key={project._id}
                className="group relative flex min-h-[31rem] flex-col overflow-hidden rounded-[2.1rem] border border-slate-200/80 bg-white/88 shadow-[0_24px_70px_-50px_rgba(15,23,42,.45)] transition duration-500 hover:-translate-y-1.5 hover:border-primary-200 hover:shadow-[0_30px_90px_-48px_rgba(79,70,229,.38)] dark:border-slate-800 dark:bg-slate-950/82 dark:hover:border-primary-400/30 dark:hover:shadow-[0_30px_90px_-48px_rgba(0,0,0,.95)]"
              >
                {canManageProjects && !project._id.startsWith('builtin-') && (
                  <div className="absolute right-4 top-4 z-20 flex gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    {project.repoUrl && (
                      <button
                        type="button"
                        onClick={() => handleSyncProjectFromGithub(project)}
                        disabled={isProjectAiBusy}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-emerald-500 disabled:opacity-50"
                        aria-label={`Sync ${title} from GitHub`}
                        title="Sync from GitHub"
                      >
                        <i className="fas fa-rotate text-xs" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAiRewriteProject(project)}
                      disabled={isProjectAiBusy}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-violet-500 disabled:opacity-50"
                      aria-label={`Rewrite ${title} with AI`}
                      title="AI Rewrite"
                    >
                      <i className="fas fa-wand-magic-sparkles text-xs" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(project)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-primary-500"
                      aria-label={`Edit ${title}`}
                    >
                      <i className="fas fa-pencil-alt text-xs" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectToDelete(project)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-red-500"
                      aria-label={`Delete ${title}`}
                    >
                      <i className="fas fa-trash text-xs" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => project.coverImage && setZoomedImage(project.coverImage)}
                  disabled={!project.coverImage}
                  className="group/image relative aspect-[16/10] w-full overflow-hidden bg-slate-100 text-left dark:bg-slate-900 disabled:cursor-default"
                  aria-label={project.coverImage ? `View ${title} screenshot` : undefined}
                >
                  {project.coverImage ? (
                    <img
                      src={project.coverImage}
                      alt={`${title} preview`}
                      className="h-full w-full object-cover transition duration-700 group-hover/image:scale-[1.035]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-primary-900/20">
                      <span className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-primary-100 bg-white/80 text-3xl font-black text-primary-500 shadow-xl dark:border-primary-400/15 dark:bg-slate-900">
                        {title.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/68 via-transparent to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {categoryMeta.map((category) => (
                        <span
                          key={category!.value}
                          className="rounded-full border border-white/20 bg-slate-950/45 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-white backdrop-blur-md"
                        >
                          {language === 'zh' ? category!.zh : category!.en}
                        </span>
                      ))}
                    </div>
                    {project.coverImage && (
                      <span className="flex h-9 w-9 translate-y-2 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white opacity-0 backdrop-blur-md transition group-hover/image:translate-y-0 group-hover/image:opacity-100">
                        <i className="fas fa-expand-alt text-xs" />
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-100 text-lg font-black text-primary-700 ring-1 ring-primary-200/70 dark:bg-primary-400/10 dark:text-primary-400 dark:ring-primary-400/15">
                        {project.iconImage ? (
                          <img
                            src={project.iconImage}
                            alt={`${title} icon`}
                            className="h-full w-full object-contain bg-white p-1.5 dark:bg-slate-900"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                              const fallback = event.currentTarget
                                .nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span
                          className={
                            project.iconImage
                              ? 'hidden h-full w-full items-center justify-center'
                              : 'flex h-full w-full items-center justify-center'
                          }
                        >
                          {title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-black tracking-tight text-slate-950 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                          {title}
                        </h2>
                        <p className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-600 dark:text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {language === 'zh' ? '可体验产品' : 'Available now'}
                        </p>
                      </div>
                    </div>

                    {project.demoUrl && (
                      <button
                        type="button"
                        onClick={() => handleLiveDemoClick(project)}
                        className="shrink-0 rounded-full bg-primary-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-primary-500/20 transition hover:-translate-y-0.5 hover:bg-primary-600 dark:text-slate-950"
                      >
                        {language === 'zh' ? '打开' : 'Open'}
                      </button>
                    )}
                  </div>

                  <p className="mt-5 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {getLocalized(project, 'summary') || 'Open the project details to learn more.'}
                  </p>

                  <div className="my-5 flex flex-wrap gap-1.5">
                    {(project.techStack || []).slice(0, 4).map((tech) => (
                      <span
                        key={tech}
                        className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      >
                        {tech}
                      </span>
                    ))}
                    {(project.techStack || []).length > 4 && (
                      <span className="rounded-lg border border-primary-100 bg-primary-50 px-2.5 py-1 text-[9px] font-bold text-primary-600 dark:border-primary-400/15 dark:bg-primary-400/5 dark:text-primary-400">
                        +{(project.techStack || []).length - 4}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setActiveDetailProject(project)}
                      className="group/details flex items-center gap-2 text-xs font-bold text-slate-600 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
                    >
                      {language === 'zh' ? '项目详情' : 'View details'}
                      <i className="fas fa-arrow-right text-[9px] transition-transform group-hover/details:translate-x-1" />
                    </button>
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-400/10 dark:hover:text-primary-400"
                        title={language === 'zh' ? '查看源码' : 'View source'}
                        aria-label={`${title} source code`}
                      >
                        <i className="fab fa-github text-base" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>

      {/* Project Detail Modal */}
      {activeDetailProject &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in text-slate-900"
            onClick={() => setActiveDetailProject(null)}
          >
            <div
              className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col relative animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveDetailProject(null)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center transition-all z-35 backdrop-blur-md border border-white/25 cursor-pointer shadow-lg active:scale-90"
              >
                <i className="fas fa-times text-sm"></i>
              </button>

              {/* Hero Banner Area */}
              <div className="h-48 md:h-72 shrink-0 relative bg-slate-950 overflow-hidden">
                {activeDetailProject.coverImage ? (
                  <img
                    src={activeDetailProject.coverImage}
                    alt={getLocalized(activeDetailProject, 'title')}
                    className="w-full h-full object-cover opacity-75"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                    <i className="fas fa-cube text-6xl text-slate-700"></i>
                  </div>
                )}
                {/* Immersive overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0f172a] via-transparent to-black/30"></div>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 -mt-16 relative z-10 space-y-6 bg-gradient-to-b from-transparent via-white dark:via-[#0f172a] to-white dark:to-[#0f172a]">
                {/* Header Block */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center text-white dark:text-slate-950 text-3xl font-black shadow-lg shadow-primary-500/20 flex-shrink-0 select-none">
                      {(getLocalized(activeDetailProject, 'title') || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-display font-black text-slate-900 dark:text-white leading-tight">
                        {getLocalized(activeDetailProject, 'title')}
                      </h2>
                      <p className="text-xs font-mono text-primary-500 uppercase tracking-wider font-bold mt-1">
                        Application Specification
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {activeDetailProject.demoUrl && (
                      <button
                        onClick={() => {
                          handleLiveDemoClick(activeDetailProject);
                          setActiveDetailProject(null);
                        }}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-500 hover:from-primary-600 hover:to-primary-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                      >
                        <i className="fas fa-play-circle mr-1.5"></i> {t.portfolio.liveDemo}
                      </button>
                    )}
                    {activeDetailProject.repoUrl && (
                      <a
                        href={activeDetailProject.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 dark:border-slate-700 transition-all"
                      >
                        <i className="fab fa-github text-sm"></i> GitHub
                      </a>
                    )}
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800/80 text-slate-900 dark:text-slate-100">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Developer
                    </span>
                    <span className="text-xs font-bold">Sam Yao</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Status
                    </span>
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Live / Stable</span>
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Access
                    </span>
                    <span className="text-xs font-bold">Public Sandbox</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Category
                    </span>
                    <span className="text-xs font-bold capitalize">
                      {inferCategories(activeDetailProject)
                        .map((value) => {
                          const meta = CATEGORY_META.find((item) => item.value === value);
                          return language === 'zh' ? meta?.zh : meta?.en;
                        })
                        .filter(Boolean)
                        .join(' · ') || 'Software'}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                  {/* Left Column: Tech (1/3) */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Core Tech Stack
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(activeDetailProject.techStack || []).map((tech, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 text-xs font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border border-primary-100/50 dark:border-primary-800/30 rounded-xl"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Markdown / Summary (2/3) */}
                  <div className="lg:col-span-2 space-y-6 text-slate-600 dark:text-slate-350 leading-relaxed text-sm">
                    {/* Summary */}
                    {getLocalized(activeDetailProject, 'summary') && (
                      <div className="relative pl-4 border-l-4 border-primary-500 bg-primary-500/5 p-4 rounded-r-2xl text-slate-800 dark:text-slate-200">
                        <p className="font-bold">{getLocalized(activeDetailProject, 'summary')}</p>
                      </div>
                    )}

                    {/* Markdown Description */}
                    {getLocalized(activeDetailProject, 'description') && (
                      <div className="prose dark:prose-invert prose-slate max-w-none prose-sm">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: renderSafeMarkdown(
                              getLocalized(activeDetailProject, 'description') || ''
                            )
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Image Zoom Modal */}
      {zoomedImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-fade-in transition-all duration-300"
            onClick={() => setZoomedImage(null)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImage(null);
              }}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-50 border border-white/20"
            >
              <i className="fas fa-times text-xl"></i>
            </button>

            <div
              className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center animate-zoom-in"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={zoomedImage}
                alt="Project detail"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
