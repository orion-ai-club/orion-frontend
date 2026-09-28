import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/api';
import { authService } from '../../services/authService';

import { ResumeData, User, UserRole, PERM_KEYS } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import { toast } from '../Toast';
import { ResumePaper } from './ResumePaper';

const ResumeEditModal = React.lazy(() =>
  import('./ResumeEditModal').then((m) => ({ default: m.ResumeEditModal }))
);
import { safeKey, getNormalizedSectionOrder } from './utils';
import { withCanonicalSamResume } from './canonicalResume';

interface CustomSelectProps {
  label?: string;
  icon?: string;
  value: string | number;
  onChange: (val: any) => void;
  options: Array<{ value: string | number; label: string; icon?: string }>;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  icon,
  value,
  onChange,
  options,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, []);

  const activeOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100/30 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-750 dark:text-slate-200 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {icon && <i className={`${icon} text-slate-400`}></i>}
            {activeOption?.icon && <i className={`${activeOption.icon} text-slate-400`}></i>}
            <span className="truncate">{activeOption?.label || value}</span>
          </div>
          <i
            className={`fas fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          ></i>
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1 w-full bg-white dark:bg-[#0f172a] border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto animate-fade-in select-none">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-l-4 border-amber-500 font-semibold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.icon && <i className={`${opt.icon} text-[10px]`}></i>}
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface ResumeDocumentProps {
  currentUser?: User | null;
}

export const ResumeDocument = React.forwardRef<HTMLDivElement, ResumeDocumentProps>(
  ({ currentUser }, ref) => {
    const { language } = useTranslation();
    const [searchParams] = useSearchParams();
    const urlUser = searchParams.get('user');
    const mapLegacyUser = (user: string | null) => {
      if (!user) return 'moviegoer24@gmail.com';
      const trimmed = user.trim().toLowerCase();
      if (trimmed === 'sam' || trimmed === 'samyao') return 'moviegoer24@gmail.com';
      if (trimmed === 'jenny') return 'cenniferchen@gmail.com';
      if (trimmed === 'yaob@miamioh.edu') return 'moviegoer24@gmail.com';
      if (trimmed === 'cft_cool@hotmail.com') return 'cenniferchen@gmail.com';
      return trimmed;
    };

    const getBaseEmail = (userQuery: string) => {
      const atIndex = userQuery.indexOf('@');
      if (atIndex !== -1) {
        const hyphenIndex = userQuery.indexOf('-', atIndex);
        return hyphenIndex !== -1 ? userQuery.substring(0, hyphenIndex) : userQuery;
      }
      return userQuery.split('-')[0];
    };

    const parsedUser = urlUser
      ? mapLegacyUser(urlUser)
      : currentUser?.email || 'moviegoer24@gmail.com';
    const baseEmail = getBaseEmail(parsedUser);

    const [resume, setResume] = useState<ResumeData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [targetProfile, setTargetProfile] = useState<string>(baseEmail);
    const [currentSlug, setCurrentSlug] = useState<string>(parsedUser);
    const hasInitializedDefaultRef = useRef(false);
    const [resumeList, setResumeList] = useState<
      Array<{ slug: string; title: string; user: string; isHomepage?: boolean }>
    >([]);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);

    // Layout and print settings
    const urlPdfMode = searchParams.get('pdfMode') || 'single-page';
    const urlPaperSize = searchParams.get('paperSize') || 'a4';
    const isPrint = searchParams.get('print') === 'true';
    const urlPageLimit = parseInt(searchParams.get('pageLimit') || '0', 10) || 0;

    const [pdfMode, setPdfMode] = useState<'single-page' | 'multi-page'>(
      urlPdfMode === 'multi-page' ? 'multi-page' : 'single-page'
    );
    const [paperSize, setPaperSize] = useState<'a4' | 'a3' | 'a5'>(
      urlPaperSize === 'a3' || urlPaperSize === 'a5' ? urlPaperSize : 'a4'
    );

    const currentPdfMode = isPrint ? urlPdfMode : pdfMode;
    const currentPaperSize = isPrint ? urlPaperSize : paperSize;
    const currentPageLimit = isPrint ? urlPageLimit : resume?.pageLimit || 0;

    // Admin Editing
    const [isEditing, setIsEditing] = useState(false);
    const [editResume, setEditResume] = useState<ResumeData | null>(null);
    const [activeTab, setActiveTab] = useState<
      'BASICS' | 'WORK' | 'EDUCATION' | 'SKILLS' | 'VOLUNTEER' | 'INTEREST'
    >('BASICS');

    const canUse =
      currentUser?.role === UserRole.SuperAdmin ||
      currentUser?.role === UserRole.Admin ||
      currentUser?.permissions?.includes(PERM_KEYS.RESUME_USE) ||
      currentUser?.permissions?.includes(PERM_KEYS.RESUME_UPDATE);

    const canUpdate =
      currentUser?.role === UserRole.SuperAdmin ||
      currentUser?.role === UserRole.Admin ||
      currentUser?.permissions?.includes(PERM_KEYS.RESUME_UPDATE);

    const isVip = canUse;

    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isVersionOpen, setIsVersionOpen] = useState(false);
    const [isLayoutOpen, setIsLayoutOpen] = useState(false);
    const [isPaperSizeOpen, setIsPaperSizeOpen] = useState(false);

    useEffect(() => {
      const handleGlobalClick = () => {
        setIsAccountOpen(false);
        setIsVersionOpen(false);
        setIsLayoutOpen(false);
        setIsPaperSizeOpen(false);
      };
      document.addEventListener('click', handleGlobalClick);
      return () => document.removeEventListener('click', handleGlobalClick);
    }, []);

    const activeUserObj = availableUsers.find(
      (u) => (u.email || u.phone || u._id || '').toLowerCase() === targetProfile.toLowerCase()
    );
    const activeResumeObj = resumeList.find((item) => item.slug === currentSlug);
    // Inline visual editing states
    const [activeInlineEdit, setActiveInlineEdit] = useState<{
      path: string;
      label: string;
      value: string;
      isTextArea?: boolean;
      listIndex?: number;
      listField?: string;
    } | null>(null);
    const [inlineEditAnchor, setInlineEditAnchor] = useState<HTMLElement | null>(null);
    const [tempTextValue, setTempTextValue] = useState('');
    const [tempStyles, setTempStyles] = useState<{
      fontSize?: string;
      fontWeight?: string;
      color?: string;
    }>({});

    useEffect(() => {
      const loadUsers = async () => {
        try {
          const res = await authService.getUsers(1, 1000, '', 'role', 'desc');
          if (res && Array.isArray(res.data)) {
            setAvailableUsers(res.data);
          }
        } catch (e) {
          console.error('Failed to load users list for resume dropdown', e);
        }
      };
      if (currentUser?.role === UserRole.SuperAdmin) {
        loadUsers();
      }
    }, [currentUser]);

    useEffect(() => {
      hasInitializedDefaultRef.current = false;
    }, [targetProfile]);

    useEffect(() => {
      if (currentUser && currentUser.role !== UserRole.SuperAdmin) {
        const myEmail = (currentUser.email || '').toLowerCase();
        setTargetProfile(getBaseEmail(myEmail));
        setCurrentSlug(myEmail);
      } else {
        setTargetProfile(baseEmail);
        setCurrentSlug(parsedUser);
      }
    }, [parsedUser, baseEmail, currentUser]);

    const processResumeList = (list: any[], profile: string) => {
      return list.filter(
        (item) =>
          item.user === profile || item.slug === profile || item.slug?.startsWith(`${profile}-`)
      );
    };

    const loadResumeAndList = useCallback(async () => {
      setIsLoading(true);
      try {
        const list = await apiService.getResumeList(targetProfile);
        const processed = processResumeList(list, targetProfile);
        setResumeList(processed);

        if (processed.length > 0) {
          let activeSlug = currentSlug;
          if (!hasInitializedDefaultRef.current) {
            hasInitializedDefaultRef.current = true;
            const homepageItem = processed.find((item) => item.isHomepage);
            if (
              activeSlug &&
              activeSlug !== targetProfile &&
              processed.some((item) => item.slug === activeSlug)
            ) {
              // Keep explicitly requested version
            } else if (homepageItem) {
              activeSlug = homepageItem.slug;
            } else {
              const defaultItem = processed.find((item) => item.slug === targetProfile);
              activeSlug = defaultItem ? defaultItem.slug : processed[0].slug;
            }
          } else {
            if (!activeSlug || !processed.some((item) => item.slug === activeSlug)) {
              const defaultItem = processed.find((item) => item.slug === targetProfile);
              activeSlug = defaultItem ? defaultItem.slug : processed[0].slug;
            }
          }

          if (activeSlug !== currentSlug) {
            setCurrentSlug(activeSlug);
            return;
          }

          const data = await apiService.getResumeData(activeSlug);
          const displayResume = withCanonicalSamResume(data, activeSlug);
          setResume(displayResume);
          if (displayResume?.styleSettings) {
            if (displayResume.styleSettings.pdfMode) {
              setPdfMode(displayResume.styleSettings.pdfMode as any);
            }
            if (displayResume.styleSettings.paperSize) {
              setPaperSize(displayResume.styleSettings.paperSize as any);
            }
          }
        } else {
          setResume(null);
        }
      } catch (e) {
        console.error('Failed to load resume or list', e);
        setResume(null);
        setResumeList([]);
      } finally {
        setIsLoading(false);
      }
    }, [currentSlug, targetProfile]);

    useEffect(() => {
      void loadResumeAndList();
    }, [loadResumeAndList]);

    const formatProfileName = (name: string) => {
      if (!name) return '';
      const lower = name.toLowerCase();
      if (lower === 'sam') return 'Sam';
      if (lower === 'jenny') return 'Jenny';
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    const handleProfileChange = (profile: string) => {
      const cleanProfile = profile.trim().toLowerCase();
      setTargetProfile(cleanProfile);
      setCurrentSlug(cleanProfile);
    };

    const updateStyleSetting = async (key: string, val: any) => {
      if (!resume) return;
      const updated = {
        ...resume,
        styleSettings: {
          ...(resume.styleSettings || {}),
          [key]: val
        }
      };
      setResume(updated);
      await apiService.updateResume(updated, currentSlug);
    };

    const handlePdfModeChange = async (val: 'single-page' | 'multi-page') => {
      setPdfMode(val);
      await updateStyleSetting('pdfMode', val);
    };

    const handlePaperSizeChange = async (val: 'a4' | 'a3' | 'a5') => {
      setPaperSize(val);
      await updateStyleSetting('paperSize', val);
    };

    const handlePageLimitChange = async (limit: number) => {
      if (!resume) return;
      const updated = { ...resume, pageLimit: limit };
      setResume(updated);
      await apiService.updateResume(updated, currentSlug);
    };

    const handleMoveSection = async (idx: number, dir: 'up' | 'down') => {
      if (!resume) return;
      const order = [...getNormalizedSectionOrder(resume.sectionOrder)];
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      const temp = order[idx];
      order[idx] = order[targetIdx];
      order[targetIdx] = temp;

      const updated = { ...resume, sectionOrder: order };
      setResume(updated);
      await apiService.updateResume(updated, currentSlug);
    };

    // Dialog States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newVersionTitle, setNewVersionTitle] = useState('');
    const [newVersionSuffix, setNewVersionSuffix] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleCreateVersion = () => {
      setNewVersionTitle('');
      setNewVersionSuffix('');
      setIsCreateModalOpen(true);
    };

    const submitCreateVersion = async () => {
      const title = newVersionTitle.trim();
      if (!title) {
        toast.error('Version title is required / 请填写版本名称');
        return;
      }

      const cleanSuffix = newVersionSuffix
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      if (newVersionSuffix.trim() && cleanSuffix !== newVersionSuffix.trim().toLowerCase()) {
        toast.error(
          'Suffix can only contain letters, numbers, and hyphens / 后缀只能包含英文字母、数字和连字符'
        );
        return;
      }

      const newSlug = cleanSuffix ? `${targetProfile}-${cleanSuffix}` : targetProfile;

      if (resumeList.some((item) => item.slug === newSlug)) {
        toast.error(
          'Version slug already exists. Please choose a different suffix. / 该版本的链接已存在，请换个后缀'
        );
        return;
      }

      let newResumeData: Partial<ResumeData>;
      if (resume) {
        newResumeData = JSON.parse(JSON.stringify(resume));
        newResumeData.slug = newSlug;
        newResumeData.title = title;
        newResumeData.user = targetProfile;
        delete newResumeData._id;
      } else {
        newResumeData = {
          slug: newSlug,
          title: title,
          user: targetProfile,
          basics: {
            name_zh: targetProfile.toUpperCase(),
            name_en: targetProfile.toUpperCase(),
            label_zh: '专业岗位',
            label_en: 'Professional Role',
            email: currentUser?.email || '',
            phone: '',
            location_zh: '',
            location_en: '',
            visaStatus_zh: '',
            visaStatus_en: '',
            summary_zh: '个人简介...',
            summary_en: 'Summary...'
          },
          education: [],
          work: [],
          skills: [],
          languages: [],
          volunteer: [],
          interest: []
        };
      }

      try {
        setIsLoading(true);
        setIsCreateModalOpen(false);
        await apiService.updateResume(newResumeData, newSlug);
        setCurrentSlug(newSlug);
        toast.success('Resume version created / 简历版本创建成功');
      } catch (e) {
        console.error('Failed to create new version', e);
        toast.error('Failed to create version / 创建版本失败');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteVersion = () => {
      setIsDeleteModalOpen(true);
    };

    const submitDeleteVersion = async () => {
      try {
        setIsLoading(true);
        setIsDeleteModalOpen(false);
        await apiService.deleteResume(currentSlug);
        setCurrentSlug('');
        toast.success('Resume version deleted / 简历版本删除成功');
      } catch (e) {
        console.error('Failed to delete version', e);
        toast.error('Failed to delete version / 删除版本失败');
      } finally {
        setIsLoading(false);
      }
    };

    const handleEditOpen = () => {
      if (!resume) return;
      const copy = JSON.parse(JSON.stringify(resume)); // Deep copy
      if (!copy.sectionOrder || copy.sectionOrder.length === 0) {
        copy.sectionOrder = ['profile', 'work', 'projects', 'education', 'skills'];
      }
      if (!copy.styleSettings) {
        copy.styleSettings = { fontSize: 'normal', lineHeight: 'normal', themeColor: 'slate' };
      }
      if (copy.pageLimit === undefined) {
        copy.pageLimit = 0;
      }
      setEditResume(copy);
      setActiveTab('BASICS');
      setIsEditing(true);
    };

    const handleSave = async () => {
      if (!editResume) return;
      try {
        await apiService.updateResume(editResume, currentSlug);
        setResume(editResume);
        setIsEditing(false);
        // Refresh list
        const list = await apiService.getResumeList(targetProfile);
        setResumeList(processResumeList(list, targetProfile));
      } catch (e) {
        console.error(e);
      }
    };

    const handleSetDefault = async () => {
      if (!resume || resume.isHomepage) return;
      if (
        !window.confirm(
          language === 'zh'
            ? '确定要将当前简历版本设为首页默认展示吗？'
            : 'Are you sure you want to set this resume version as the homepage default?'
        )
      ) {
        return;
      }
      try {
        setIsLoading(true);
        await apiService.setDefaultResume(currentSlug);

        // Refresh the loaded resume data (to get isHomepage: true)
        const data = await apiService.getResumeData(currentSlug);
        setResume(data);

        // Refresh the list of resumes
        const list = await apiService.getResumeList(targetProfile);
        setResumeList(processResumeList(list, targetProfile));
      } catch (e) {
        console.error(e);
        toast.error(language === 'zh' ? '设置失败' : 'Failed to set default resume');
      } finally {
        setIsLoading(false);
      }
    };

    // Generic Field Updater
    const updateField = (
      section: keyof ResumeData,
      field: string,
      value: any,
      index?: number,
      nestedField?: string
    ) => {
      if (!editResume) return;
      const newResume = { ...editResume };

      if (section === 'basics') {
        (newResume.basics as any)[field] = value;
      } else if (Array.isArray(newResume[section]) && index !== undefined) {
        const arr = newResume[section] as any[];
        if (!arr[index]) return;

        if (nestedField) {
          // Special handling for array of strings like highlights/keywords
          if (nestedField === 'keywords' || nestedField.includes('highlights')) {
            arr[index][nestedField] =
              typeof value === 'string' ? value.split('\n').filter((s: string) => s.trim()) : value;
          } else {
            arr[index][nestedField] = value;
          }
        } else {
          arr[index] = value;
        }
      }

      setEditResume(newResume);
    };

    const addItem = (section: 'work' | 'education' | 'skills' | 'volunteer' | 'interest') => {
      if (!editResume) return;
      const newResume = { ...editResume };
      const arr = (newResume[section] as any[]) || [];

      let newItem = {};
      if (section === 'work')
        newItem = { company_en: 'New Company', highlights_en: [], highlights_zh: [], weight: 0 };
      if (section === 'education') newItem = { institution: 'New School' };
      if (section === 'skills')
        newItem = { name_en: 'New Category', name_zh: '新品类', keywords: [] };
      if (section === 'volunteer')
        newItem = { organization_en: 'New Organization', highlights_en: [], highlights_zh: [] };
      if (section === 'interest')
        newItem = { name_en: 'New Category', name_zh: '新品类', keywords: [] };

      arr.push(newItem);
      (newResume as any)[section] = arr;
      setEditResume(newResume);
    };

    const removeItem = (
      section: 'work' | 'education' | 'skills' | 'volunteer' | 'interest',
      index: number
    ) => {
      if (!editResume) return;
      const newResume = { ...editResume };
      (newResume[section] as any[]).splice(index, 1);
      setEditResume(newResume);
    };

    // --- Inline Visual Editor Engine Hooks & Helper Functions ---
    useEffect(() => {
      if (activeInlineEdit) {
        setTempTextValue(activeInlineEdit.value);
        const customStyle =
          resume?.styleSettings?.customStyles?.[safeKey(activeInlineEdit.path)] || {};
        setTempStyles({
          fontSize: customStyle.fontSize || 'inherit',
          fontWeight: customStyle.fontWeight || 'inherit',
          color: customStyle.color || 'inherit'
        });
      } else {
        setTempTextValue('');
        setTempStyles({});
      }
    }, [activeInlineEdit, resume]);

    const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
      if (!inlineEditAnchor || !activeInlineEdit) {
        setPopoverCoords(null);
        return;
      }

      const updatePosition = () => {
        const rect = inlineEditAnchor.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        let top = rect.bottom + scrollY + 8;
        let left = rect.left + scrollX;

        const popoverWidth = 320;
        if (left + popoverWidth > window.innerWidth) {
          left = window.innerWidth - popoverWidth - 16;
        }
        if (left < 16) {
          left = 16;
        }

        setPopoverCoords({ top, left });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }, [inlineEditAnchor, activeInlineEdit]);

    const setNestedValue = (obj: any, path: string, val: any) => {
      const parts = path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (Array.isArray(current[part]) || (!isNaN(Number(parts[i + 1])) && !current[part])) {
          if (!current[part]) current[part] = [];
        } else if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = val;
    };

    const handleSaveInlineEdit = async () => {
      if (!resume || !activeInlineEdit) return;

      const copy = JSON.parse(JSON.stringify(resume));
      setNestedValue(copy, activeInlineEdit.path, tempTextValue);

      if (!copy.styleSettings) copy.styleSettings = {};
      if (!copy.styleSettings.customStyles) copy.styleSettings.customStyles = {};

      if (
        tempStyles.fontSize === 'inherit' &&
        tempStyles.fontWeight === 'inherit' &&
        tempStyles.color === 'inherit'
      ) {
        if (copy.styleSettings.customStyles) {
          delete copy.styleSettings.customStyles[safeKey(activeInlineEdit.path)];
        }
      } else {
        copy.styleSettings.customStyles[safeKey(activeInlineEdit.path)] = {
          fontSize: tempStyles.fontSize === 'inherit' ? undefined : tempStyles.fontSize,
          fontWeight: tempStyles.fontWeight === 'inherit' ? undefined : tempStyles.fontWeight,
          color: tempStyles.color === 'inherit' ? undefined : tempStyles.color
        };
      }

      try {
        setResume(copy);
        await apiService.updateResume(copy, currentSlug);
        toast.success(language === 'zh' ? '保存成功 / Saved successfully' : 'Saved successfully');
      } catch (e) {
        toast.error('Failed to save inline modifications');
      }

      setActiveInlineEdit(null);
      setInlineEditAnchor(null);
    };

    const fontSizeClass = resume?.styleSettings?.fontSize
      ? `resume-style-font-${resume.styleSettings.fontSize}`
      : 'resume-style-font-normal';
    const lineHeightClass = resume?.styleSettings?.lineHeight
      ? `resume-style-line-${resume.styleSettings.lineHeight}`
      : 'resume-style-line-normal';
    const themeColorClass = resume?.styleSettings?.themeColor
      ? `resume-style-theme-${resume.styleSettings.themeColor}`
      : 'resume-style-theme-slate';
    const marginClass = resume?.styleSettings?.margin
      ? `resume-style-margin-${resume.styleSettings.margin}`
      : 'resume-style-margin-normal';
    const sectionGapClass = resume?.styleSettings?.sectionGap
      ? `resume-style-gap-${resume.styleSettings.sectionGap}`
      : 'resume-style-gap-normal';
    const pageHeight = currentPaperSize === 'a4' ? 1123 : currentPaperSize === 'a3' ? 1587 : 794;

    return (
      <div className="relative">
        {/* Edit Modal Component */}
        {isEditing && (
          <React.Suspense
            fallback={
              <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                <i className="fas fa-circle-notch fa-spin text-white text-3xl"></i>
              </div>
            }
          >
            <ResumeEditModal
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              editResume={editResume}
              setEditResume={setEditResume}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              language={language}
              targetProfile={targetProfile}
              currentSlug={currentSlug}
              updateField={updateField}
              removeItem={removeItem}
              addItem={addItem}
              handleSave={handleSave}
            />
          </React.Suspense>
        )}

        {/* Main Layout Grid wrapper */}
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start justify-center px-4 w-full relative">
          {/* Left: Combined Sidebar */}
          {canUse && (
            <div className="w-full lg:w-80 flex-shrink-0 bg-white/75 dark:bg-[#0f172a]/75 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-5 shadow-xl space-y-5 sticky top-24 print:hidden z-40 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
              {/* 1. Account & Version Management */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  {language === 'zh' ? '管理控制 Dossier' : 'Dossier Control'}
                </h3>

                {/* Account Dropdown */}
                {currentUser?.role === UserRole.SuperAdmin && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setIsAccountOpen(!isAccountOpen);
                        setIsVersionOpen(false);
                        setIsLayoutOpen(false);
                        setIsPaperSizeOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm flex-shrink-0">
                        {activeUserObj?.photoURL ? (
                          <img
                            src={activeUserObj.photoURL}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>
                            {(activeUserObj?.displayName || activeUserObj?.email || targetProfile)
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="truncate max-w-[125px]">
                          {activeUserObj?.displayName ||
                            activeUserObj?.email ||
                            formatProfileName(targetProfile)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono capitalize">
                          {activeUserObj?.role || 'User'}
                        </span>
                      </div>
                      <i
                        className={`fas fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ${isAccountOpen ? 'rotate-180' : ''}`}
                      ></i>
                    </button>

                    {isAccountOpen && (
                      <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-[#0f172a] border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 animate-fade-in custom-scrollbar max-h-80 overflow-y-auto">
                        {availableUsers.map((u) => {
                          const emailVal = (u.email || u.phone || u._id || '').toLowerCase();
                          const isSelected = emailVal === targetProfile.toLowerCase();
                          return (
                            <button
                              key={u._id || emailVal}
                              onClick={() => {
                                handleProfileChange(emailVal);
                                setIsAccountOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                                isSelected
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-l-4 border-amber-500 font-semibold'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                                {u.photoURL ? (
                                  <img
                                    src={u.photoURL}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>
                                    {(u.displayName || u.email || '').charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {u.displayName || 'Unnamed User'}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {u.email || u.phone}
                                </div>
                              </div>
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase select-none flex-shrink-0 ${
                                  u.role === 'super_admin'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : u.role === 'admin'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-750 dark:text-slate-400'
                                }`}
                              >
                                {u.role || 'user'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Version Dropdown */}
                {resumeList.length > 0 && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setIsVersionOpen(!isVersionOpen);
                        setIsAccountOpen(false);
                        setIsLayoutOpen(false);
                        setIsPaperSizeOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm"
                    >
                      <i className="fas fa-layer-group text-sky-500 text-sm"></i>
                      <span className="flex-1 text-left truncate">
                        {activeResumeObj?.title || currentSlug}
                      </span>
                      <i
                        className={`fas fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 ${isVersionOpen ? 'rotate-180' : ''}`}
                      ></i>
                    </button>

                    {isVersionOpen && (
                      <div className="absolute left-0 mt-2 w-full min-w-[200px] bg-white dark:bg-[#0f172a] border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-1.5 animate-fade-in">
                        {resumeList.map((item) => {
                          const isSelected = item.slug === currentSlug;
                          return (
                            <button
                              key={item.slug}
                              onClick={() => {
                                setCurrentSlug(item.slug);
                                setIsVersionOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-2 text-left text-xs transition-all ${
                                isSelected
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-l-4 border-sky-500 font-semibold'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="truncate">{item.title || item.slug}</span>
                              {item.isHomepage && (
                                <i
                                  className="fas fa-home text-[9px] text-amber-500"
                                  title="Default homepage"
                                ></i>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  {resume && (
                    <>
                      {/* Default Homepage Toggle (Super Admin Only) */}
                      {currentUser?.role === UserRole.SuperAdmin &&
                        (resume.isHomepage ? (
                          <span className="px-3 py-2 text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 select-none">
                            <i className="fas fa-home text-[10px]"></i>
                            <span>{language === 'zh' ? '已设为首页默认' : 'Default Homepage'}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSetDefault}
                            className="px-3 py-2 text-xs font-bold uppercase rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200/50 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 dark:text-sky-400 dark:border-sky-900/30 active:scale-95"
                          >
                            <i className="fas fa-home text-[10px]"></i>
                            <span>{language === 'zh' ? '设为首页默认' : 'Set default'}</span>
                          </button>
                        ))}

                      {/* Edit Button */}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={handleEditOpen}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-black text-xs font-bold uppercase rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                        >
                          <i className="fas fa-edit text-[10px]"></i>
                          <span>{language === 'zh' ? '编辑简历' : 'Edit Resume'}</span>
                        </button>
                      )}

                      {/* Create Version Button */}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={handleCreateVersion}
                          className="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold uppercase transition-all duration-205 flex items-center justify-center gap-2 active:scale-95 hover:shadow-md"
                        >
                          <i className="fas fa-plus text-[10px]"></i>
                          <span>{language === 'zh' ? '新建版本' : 'New Version'}</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={handleDeleteVersion}
                          className="w-full py-2 text-xs font-bold uppercase rounded-xl transition-all duration-200 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/30 active:scale-95"
                        >
                          <i className="fas fa-trash text-[10px]"></i>
                          <span>{language === 'zh' ? '删除版本' : 'Delete'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 2. Style & Page layout Settings */}
              {resume && (
                <div className="space-y-4 pt-4 border-t border-slate-200/65 dark:border-slate-800">
                  <h3 className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {language === 'zh' ? '排版设置 Styles' : 'Page Styles'}
                  </h3>

                  {/* Mode select */}
                  <CustomSelect
                    label={language === 'zh' ? '导出模式 Mode' : 'Print Mode'}
                    value={pdfMode}
                    onChange={handlePdfModeChange}
                    options={[
                      {
                        value: 'single-page',
                        label: language === 'zh' ? '连续长页' : 'Continuous',
                        icon: 'fas fa-arrows-alt-v'
                      },
                      {
                        value: 'multi-page',
                        label: language === 'zh' ? '分页打印' : 'Paginated',
                        icon: 'fas fa-file-invoice'
                      }
                    ]}
                    disabled={!canUpdate}
                  />

                  {/* Paper Size Selector (Only in Paginated Mode) */}
                  {pdfMode === 'multi-page' && (
                    <CustomSelect
                      label={language === 'zh' ? '纸张尺寸 Size' : 'Paper Size'}
                      value={paperSize}
                      onChange={handlePaperSizeChange}
                      options={[
                        { value: 'a4', label: 'A4' },
                        { value: 'a3', label: 'A3' },
                        { value: 'a5', label: 'A5' }
                      ]}
                      icon="fas fa-ruler-combined"
                      disabled={!canUpdate}
                    />
                  )}

                  {/* Page Limit Selector (Only in Paginated Mode) */}
                  {pdfMode === 'multi-page' && (
                    <CustomSelect
                      label={language === 'zh' ? '页数限制 Limits' : 'Page Limits'}
                      value={resume.pageLimit || 0}
                      onChange={handlePageLimitChange}
                      options={[
                        { value: 0, label: language === 'zh' ? '不限页数' : 'Unlimited' },
                        { value: 1, label: language === 'zh' ? '限制 1 页' : 'Limit 1 Page' },
                        { value: 2, label: language === 'zh' ? '限制 2 页' : 'Limit 2 Pages' },
                        { value: 3, label: language === 'zh' ? '限制 3 页' : 'Limit 3 Pages' }
                      ]}
                      icon="fas fa-file-alt"
                      disabled={!canUpdate}
                    />
                  )}

                  {/* Margins */}
                  <CustomSelect
                    label={language === 'zh' ? '页边距 Margins' : 'Page Margins'}
                    value={resume.styleSettings?.margin || 'normal'}
                    onChange={(val) => updateStyleSetting('margin', val)}
                    options={[
                      {
                        value: 'small',
                        label: language === 'zh' ? '窄边距 (8mm)' : 'Narrow (8mm)'
                      },
                      {
                        value: 'normal',
                        label: language === 'zh' ? '默认边距 (12mm)' : 'Normal (12mm)'
                      },
                      { value: 'large', label: language === 'zh' ? '宽边距 (18mm)' : 'Wide (18mm)' }
                    ]}
                    icon="fas fa-border-style"
                    disabled={!canUpdate}
                  />

                  {/* Section spacing */}
                  <CustomSelect
                    label={language === 'zh' ? '板块间距 Spacing' : 'Section Spacing'}
                    value={resume.styleSettings?.sectionGap || 'normal'}
                    onChange={(val) => updateStyleSetting('sectionGap', val)}
                    options={[
                      { value: 'compact', label: language === 'zh' ? '紧凑' : 'Compact' },
                      { value: 'normal', label: language === 'zh' ? '默认' : 'Normal' },
                      { value: 'relaxed', label: language === 'zh' ? '宽松' : 'Relaxed' }
                    ]}
                    icon="fas fa-compress-arrows-alt"
                    disabled={!canUpdate}
                  />

                  {/* Font Size */}
                  <CustomSelect
                    label={language === 'zh' ? '默认字号 Size' : 'Font Size'}
                    value={resume.styleSettings?.fontSize || 'normal'}
                    onChange={(val) => updateStyleSetting('fontSize', val)}
                    options={[
                      { value: 'small', label: language === 'zh' ? '较小' : 'Small' },
                      { value: 'normal', label: language === 'zh' ? '默认' : 'Normal' },
                      { value: 'large', label: language === 'zh' ? '较大' : 'Large' }
                    ]}
                    icon="fas fa-text-height"
                    disabled={!canUpdate}
                  />

                  {/* Line height */}
                  <CustomSelect
                    label={language === 'zh' ? '默认行高 Line Spacing' : 'Line Spacing'}
                    value={resume.styleSettings?.lineHeight || 'normal'}
                    onChange={(val) => updateStyleSetting('lineHeight', val)}
                    options={[
                      { value: 'compact', label: language === 'zh' ? '紧凑' : 'Compact' },
                      { value: 'normal', label: language === 'zh' ? '默认' : 'Normal' },
                      { value: 'relaxed', label: language === 'zh' ? '宽松' : 'Relaxed' }
                    ]}
                    icon="fas fa-align-left"
                    disabled={!canUpdate}
                  />

                  {/* Accent Theme Color */}
                  <CustomSelect
                    label={language === 'zh' ? '强调色 Accent' : 'Theme Color'}
                    value={resume.styleSettings?.themeColor || 'slate'}
                    onChange={(val) => updateStyleSetting('themeColor', val)}
                    options={[
                      { value: 'slate', label: language === 'zh' ? '极简黑' : 'Slate / Black' },
                      { value: 'amber', label: language === 'zh' ? '琥珀黄' : 'Amber' },
                      { value: 'emerald', label: language === 'zh' ? '翡翠绿' : 'Emerald' },
                      { value: 'sky', label: language === 'zh' ? '天空蓝' : 'Sky' },
                      { value: 'crimson', label: language === 'zh' ? '玫瑰红' : 'Crimson' }
                    ]}
                    icon="fas fa-palette"
                    disabled={!canUpdate}
                  />
                </div>
              )}

              {/* 3. Section Ordering */}
              {resume && (
                <div className="space-y-3 pt-4 border-t border-slate-200/65 dark:border-slate-800">
                  <label className="block text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {language === 'zh' ? '版块显示顺序' : 'Section Order'}
                  </label>
                  <div className="space-y-1.5">
                    {getNormalizedSectionOrder(resume.sectionOrder).map((sectionId, idx, arr) => {
                      const getSectionName = (sid: string) => {
                        if (sid === 'profile') return language === 'zh' ? '个人简介' : 'Profile';
                        if (sid === 'work') return language === 'zh' ? '工作经历' : 'Work';
                        if (sid === 'projects') return language === 'zh' ? '作品项目' : 'Projects';
                        if (sid === 'education')
                          return language === 'zh' ? '教育经历' : 'Education';
                        if (sid === 'volunteer')
                          return language === 'zh' ? '志愿活动' : 'Volunteer';
                        if (sid === 'interest') return language === 'zh' ? '兴趣爱好' : 'Interests';
                        if (sid === 'skills') return language === 'zh' ? '专业技能' : 'Skills';
                        return sid;
                      };

                      return (
                        <div
                          key={sectionId}
                          className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 rounded-lg text-xs"
                        >
                          <span className="font-semibold text-slate-750 dark:text-slate-350">
                            {getSectionName(sectionId)}
                          </span>
                          {canUpdate && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSection(idx, 'up')}
                                className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300 disabled:opacity-30 rounded transition-colors"
                              >
                                <i className="fas fa-arrow-up text-[8px]"></i>
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveSection(idx, 'down')}
                                className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700/70 dark:text-slate-300 disabled:opacity-30 rounded transition-colors"
                              >
                                <i className="fas fa-arrow-down text-[8px]"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Area: Resume Sheet or Placeholder */}
          <div className="flex-grow w-full max-w-4xl min-w-0">
            {isLoading ? (
              <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 p-16 dark:bg-[#0b1120] dark:border-slate-800 space-y-8 animate-pulse min-h-[800px]">
                {/* Header Skeleton */}
                <div className="text-center space-y-4">
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mx-auto"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mx-auto"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3 mx-auto"></div>
                </div>

                {/* Section 1 */}
                <div className="space-y-4 pt-8">
                  <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                  <div className="h-[2px] bg-slate-200 dark:bg-slate-800 w-full"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="space-y-4 pt-4">
                  <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                  <div className="h-[2px] bg-slate-200 dark:bg-slate-800 w-full"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
                  </div>
                </div>
              </div>
            ) : !resume ? (
              <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 p-16 text-center font-sans text-slate-800 dark:bg-[#0b1120] dark:border-slate-800 dark:text-slate-300 space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-2">
                  <i className="fas fa-file-invoice text-3xl"></i>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {language === 'zh' ? '暂无简历内容' : 'No Resume Found'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {language === 'zh'
                    ? '该用户尚未创建任何简历版本。如果您有编辑权限，可以点击左侧的“新建”按钮来初始化您的第一份简历。'
                    : 'No resume versions are currently available for this user. If you have editing privileges, click the "New" button in the sidebar to initialize your first resume.'}
                </p>
                {canUpdate && (
                  <button
                    type="button"
                    onClick={handleCreateVersion}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold uppercase rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95"
                  >
                    <i className="fas fa-plus"></i>
                    <span>{language === 'zh' ? '新建第一份简历' : 'Create First Resume'}</span>
                  </button>
                )}
              </div>
            ) : (
              <ResumePaper
                ref={ref}
                resume={resume}
                isPrint={isPrint}
                isVip={canUpdate}
                language={language}
                currentPdfMode={currentPdfMode as any}
                currentPaperSize={currentPaperSize as any}
                currentPageLimit={currentPageLimit}
                fontSizeClass={fontSizeClass}
                lineHeightClass={lineHeightClass}
                themeColorClass={themeColorClass}
                marginClass={marginClass}
                sectionGapClass={sectionGapClass}
                pageHeight={pageHeight}
                setActiveInlineEdit={setActiveInlineEdit}
                setInlineEditAnchor={setInlineEditAnchor}
              />
            )}
          </div>
        </div>

        {/* Custom Modal for Creating Version */}
        {isCreateModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700/50 text-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-up space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-amber-400">
                    Create New Resume Version / 新建简历版本
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      Version Title / 简历名称
                    </label>
                    <input
                      type="text"
                      className="w-full p-2 rounded outline-none border bg-slate-950 border-slate-800 focus:border-amber-500 text-sm text-white"
                      value={newVersionTitle}
                      onChange={(e) => setNewVersionTitle(e.target.value)}
                      placeholder="e.g. 学校兼职简历"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                      URL Slug Suffix / 链接后缀
                    </label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-1">
                      <span className="text-xs text-slate-500 px-2 font-mono">
                        {targetProfile}-
                      </span>
                      <input
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none p-1 text-sm text-white font-mono"
                        value={newVersionSuffix}
                        onChange={(e) => setNewVersionSuffix(e.target.value)}
                        placeholder="parttime"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      只能包含小写字母、数字和连字符。全称：{targetProfile}-
                      {newVersionSuffix || 'suffix'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition-colors text-sm font-bold"
                  >
                    Cancel / 取消
                  </button>
                  <button
                    type="button"
                    onClick={submitCreateVersion}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold transition-all text-sm"
                  >
                    Create / 确认创建
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Custom Modal for Deleting Version */}
        {isDeleteModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-700/50 text-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up space-y-4">
                <div className="flex items-center gap-3 text-red-500 pb-2 border-b border-slate-800">
                  <i className="fas fa-exclamation-triangle text-xl"></i>
                  <h3 className="text-lg font-bold">Delete Resume Version / 删除确认</h3>
                </div>
                <div className="py-2">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Are you sure you want to delete this resume version /
                    确定要删除该简历版本吗？该操作不可撤销。
                  </p>
                  <p className="text-slate-400 text-xs mt-2 bg-slate-950 p-2 rounded border border-slate-800 font-mono">
                    {resume?.title || currentSlug} ({currentSlug})
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white transition-colors text-sm font-bold"
                  >
                    Cancel / 取消
                  </button>
                  <button
                    type="button"
                    onClick={submitDeleteVersion}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all text-sm"
                  >
                    Delete / 确认删除
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Floating Formatting & Inline Text Editor Popover */}
        {activeInlineEdit &&
          popoverCoords &&
          createPortal(
            <div
              className="absolute z-[99999] w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 space-y-4 animate-scale-up"
              style={{
                top: `${popoverCoords.top}px`,
                left: `${popoverCoords.left}px`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Popover Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  {language === 'zh' ? '所见即所得编辑' : 'Visual Formatting'}
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  {activeInlineEdit.label}
                </span>
              </div>

              {/* Text Input Content */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  {language === 'zh' ? '文本内容 Text' : 'Text Content'}
                </label>
                {activeInlineEdit.isTextArea ? (
                  <textarea
                    rows={4}
                    value={tempTextValue}
                    onChange={(e) => setTempTextValue(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200 font-sans"
                  />
                ) : (
                  <input
                    type="text"
                    value={tempTextValue}
                    onChange={(e) => setTempTextValue(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200 font-sans"
                  />
                )}
              </div>

              {/* Style controls (Size, Weight, Color) */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* Custom Font Size */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {language === 'zh' ? '字号 Size' : 'Font Size'}
                  </label>
                  <select
                    value={tempStyles.fontSize || 'inherit'}
                    onChange={(e) => setTempStyles({ ...tempStyles, fontSize: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-xs outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="inherit">
                      {language === 'zh' ? '默认 (Inherit)' : 'Inherit'}
                    </option>
                    <option value="11px">11px</option>
                    <option value="12px">12px</option>
                    <option value="13px">13px</option>
                    <option value="14px">14px</option>
                    <option value="15px">15px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="22px">22px</option>
                    <option value="24px">24px</option>
                    <option value="28px">28px</option>
                    <option value="32px">32px</option>
                    <option value="36px">36px</option>
                    <option value="40px">40px</option>
                    <option value="48px">48px</option>
                  </select>
                </div>

                {/* Custom Font Weight */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {language === 'zh' ? '粗细 Weight' : 'Font Weight'}
                  </label>
                  <select
                    value={tempStyles.fontWeight || 'inherit'}
                    onChange={(e) => setTempStyles({ ...tempStyles, fontWeight: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-xs outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="inherit">
                      {language === 'zh' ? '默认 (Inherit)' : 'Inherit'}
                    </option>
                    <option value="normal">
                      {language === 'zh' ? '常规 (400)' : 'Normal (400)'}
                    </option>
                    <option value="medium">
                      {language === 'zh' ? '中等 (500)' : 'Medium (500)'}
                    </option>
                    <option value="semibold">
                      {language === 'zh' ? '半粗 (600)' : 'Semibold (600)'}
                    </option>
                    <option value="bold">{language === 'zh' ? '加粗 (700)' : 'Bold (700)'}</option>
                    <option value="900">{language === 'zh' ? '特粗 (900)' : 'Black (900)'}</option>
                  </select>
                </div>
              </div>

              {/* Custom Color Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {language === 'zh' ? '文字颜色 Color' : 'Font Color'}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={
                      ['inherit', '#000000', '#d97706', '#059669', '#0284c7', '#e11d48'].includes(
                        tempStyles.color || 'inherit'
                      )
                        ? tempStyles.color || 'inherit'
                        : 'custom'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setTempStyles({ ...tempStyles, color: val === 'custom' ? '#2563eb' : val });
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-xs outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="inherit">
                      {language === 'zh' ? '默认颜色 (Inherit)' : 'Inherit'}
                    </option>
                    <option value="#000000">
                      {language === 'zh' ? '深黑色 (Black)' : 'Black'}
                    </option>
                    <option value="#d97706">
                      {language === 'zh' ? '琥珀橘 (Amber)' : 'Amber'}
                    </option>
                    <option value="#059669">
                      {language === 'zh' ? '翡翠绿 (Emerald)' : 'Emerald'}
                    </option>
                    <option value="#0284c7">{language === 'zh' ? '天空蓝 (Sky)' : 'Sky'}</option>
                    <option value="#e11d48">
                      {language === 'zh' ? '玫瑰红 (Crimson)' : 'Crimson'}
                    </option>
                    <option value="custom">
                      {language === 'zh' ? '自定义 (Custom)' : 'Custom Hex'}
                    </option>
                  </select>

                  {/* Hex Color Input (only if custom or selected hex) */}
                  {tempStyles.color && tempStyles.color !== 'inherit' && (
                    <input
                      type="color"
                      value={tempStyles.color.startsWith('#') ? tempStyles.color : '#000000'}
                      onChange={(e) => setTempStyles({ ...tempStyles, color: e.target.value })}
                      className="w-8 h-7 p-0 border border-slate-200 dark:border-slate-700 rounded cursor-pointer bg-transparent"
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTempStyles({ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' });
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 font-bold transition-all"
                >
                  {language === 'zh' ? '重置样式' : 'Reset'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInlineEdit(null);
                    setInlineEditAnchor(null);
                  }}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-700 font-bold"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveInlineEdit}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 text-slate-950 rounded-lg font-bold shadow-md transition-all"
                >
                  {language === 'zh' ? '完成' : 'Done'}
                </button>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

ResumeDocument.displayName = 'ResumeDocument';
