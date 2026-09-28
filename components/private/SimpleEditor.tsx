import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../../services/api';
import { User, BlogPost, Tag } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import { toast } from '../Toast';
import { NoteEditor } from '../journal/NoteEditor';
import { contentSummary } from '../journal/content';
import { JournalTemplates, JournalTemplate } from './JournalTemplates';

interface SimpleEditorProps {
  user?: User | null;
  onPostCreated?: (isPrivate: boolean) => void;
  editingPost?: BlogPost | null;
  onCancelEdit?: () => void;
  onPreviewChange?: (data: {
    title: string;
    content: string;
    tags: string[];
    date: string;
  }) => void;
}
type Draft = {
  title: string;
  content: string;
  author: string;
  info: string;
  tags: string;
  isPrivate: boolean;
};

export const SimpleEditor: React.FC<SimpleEditorProps> = ({
  user,
  onPostCreated,
  editingPost,
  onCancelEdit,
  onPreviewChange
}) => {
  const { t } = useTranslation();
  const draftKey = `orion:journal:v1:${user?._id || 'anonymous'}:${editingPost?._id || 'new'}`;
  const empty = useCallback(
    (): Draft => ({
      title: '',
      content: '',
      author: user?.displayName || '',
      info: '',
      tags: '',
      isPrivate: true
    }),
    [user?.displayName]
  );
  const [legacyDraft, setLegacyDraft] = useState(false);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    const base = editingPost
      ? {
          title: editingPost.name,
          content: editingPost.content || '',
          author: editingPost.author,
          info: editingPost.info || '',
          tags: editingPost.tags.join(' '),
          isPrivate: editingPost.isPrivate === true
        }
      : empty();
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (
        saved &&
        ['title', 'content', 'author', 'info', 'tags'].every(
          (key) => typeof saved[key] === 'string'
        ) &&
        typeof saved.isPrivate === 'boolean'
      )
        return saved;
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    return base;
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [details, setDetails] = useState(false);
  const latest = useRef(draft);
  latest.current = draft;
  const skipSave = useRef(false);
  const previewCallback = useRef(onPreviewChange);
  previewCallback.current = onPreviewChange;
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const persist = useCallback(() => {
    if (skipSave.current) return true;
    try {
      const current = latest.current;
      if (!current.content && !current.title && !current.info && !current.tags)
        localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(current));
      return true;
    } catch {
      return false;
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      setRestored(!!localStorage.getItem(draftKey));
      setLegacyDraft(
        !editingPost && !!(localStorage.getItem('cachedText') || localStorage.getItem('titleText'))
      );
    } catch {
      /* optional storage */
    }
    apiService
      .getTags('all')
      .then(setAvailableTags)
      .catch(() => {});
  }, [draftKey, editingPost]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSaved(persist() ? '草稿已保存在此设备' : '设备空间不足，请先保存日记');
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, persist]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      const stored = persist();
      if ((!stored || uploading) && !skipSave.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const hide = () => {
      persist();
    };
    window.addEventListener('beforeunload', leave);
    window.addEventListener('pagehide', hide);
    return () => {
      persist();
      window.removeEventListener('beforeunload', leave);
      window.removeEventListener('pagehide', hide);
    };
  }, [persist, uploading]);
  useEffect(() => {
    previewCallback.current?.({
      title: draft.title,
      content: draft.content,
      tags: draft.tags.split(/\s+/).filter(Boolean),
      date: editingPost?.createdAt || editingPost?.date || new Date().toISOString()
    });
  }, [draft.title, draft.content, draft.tags, editingPost]);
  const saveDraft = useCallback(() => {
    setSaved(persist() ? '草稿已保存在此设备' : '草稿保存失败，请先保存日记');
  }, [persist]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [saveDraft]);

  const submit = async () => {
    if (loading || uploading) return;
    if (!draft.title.trim() || !draft.tags.trim() || !draft.author.trim()) {
      toast.error('请填写标题、作者和至少一个标签。');
      setDetails(true);
      return;
    }
    setLoading(true);
    try {
      const summary = contentSummary(draft.content);
      const payload = {
        name: draft.title.trim(),
        author: draft.author.trim(),
        info: draft.info.trim() || summary.slice(0, 150) || '手写日记',
        content: draft.content,
        tags: draft.tags.trim(),
        isPrivate: draft.isPrivate
      };
      if (editingPost) await apiService.updatePost(editingPost._id, payload);
      else await apiService.createPost(payload);
      skipSave.current = true;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* Successful server save remains valid. */
      }
      const next = empty();
      latest.current = next;
      setDraft(next);
      setEditorKey((key) => key + 1);
      setRestored(false);
      setSaved('已保存');
      onPostCreated?.(payload.isPrivate);
    } catch {
      toast.error('保存失败，草稿仍在。请重试。');
    } finally {
      setLoading(false);
    }
  };

  const change = (html: string) => {
    skipSave.current = false;
    update('content', html);
  };
  const applyTemplate = (template: JournalTemplate) => {
    if (loading || uploading) {
      toast.info('请等待当前保存或图片上传完成。');
      return;
    }
    if (draft.content && !window.confirm('用模板替换正文？当前草稿可先保存为日记。')) return;
    skipSave.current = false;
    setDraft((prev) => ({
      ...prev,
      title: template.title,
      content: template.content,
      tags: [...new Set([...prev.tags.split(/\s+/).filter(Boolean), ...template.tags])].join(' ')
    }));
    setEditorKey((key) => key + 1);
  };
  return (
    <section className="journal-composer flex flex-col h-full bg-white rounded-[2rem] border border-rose-100 shadow-xl overflow-hidden relative">
      <header className="px-5 md:px-7 pt-5 pb-4 space-y-4 shrink-0 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[.24em] font-bold text-slate-400">
            Captain’s cabin / Journal
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetails(!details)}
              aria-expanded={details}
              className="text-xs text-slate-500 px-2 py-1"
            >
              {details ? '收起设置' : '日记设置'}
            </button>
            {editingPost && (
              <button
                type="button"
                disabled={loading || uploading}
                onClick={onCancelEdit}
                className="text-xs text-slate-500 px-2 py-1"
              >
                {t.privateSpace.editor.cancel}
              </button>
            )}
          </div>
        </div>
        <input
          aria-label="日记标题"
          value={draft.title}
          disabled={loading}
          onChange={(e) => {
            skipSave.current = false;
            update('title', e.target.value);
          }}
          placeholder={t.privateSpace.editor.titlePlaceholder}
          className="w-full text-2xl md:text-3xl font-display font-bold text-slate-800 placeholder:text-slate-300 outline-none bg-transparent"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-label="私密日记"
            aria-checked={draft.isPrivate}
            disabled={loading}
            onClick={() => {
              skipSave.current = false;
              update('isPrivate', !draft.isPrivate);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${draft.isPrivate ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-600'}`}
          >
            <i className={`fas ${draft.isPrivate ? 'fa-lock' : 'fa-globe'} mr-2`} />
            {draft.isPrivate ? '私密日记' : '公开日记'}
          </button>
          <input
            aria-label="日记标签"
            list="journal-tags"
            value={draft.tags}
            disabled={loading}
            onChange={(e) => {
              skipSave.current = false;
              update('tags', e.target.value);
            }}
            placeholder="# 标签，用空格分隔"
            className="bg-transparent outline-none min-w-0 flex-1 text-sm text-slate-600"
          />
          <datalist id="journal-tags">
            {availableTags.map((tag) => (
              <option key={tag.name} value={tag.name} />
            ))}
          </datalist>
        </div>
        {details && (
          <div className="space-y-3 text-xs text-slate-500">
            <label className="block">
              {t.privateSpace.editor.author}
              <input
                aria-label="日记作者"
                value={draft.author}
                disabled={loading}
                onChange={(e) => update('author', e.target.value)}
                className="mt-1 block w-full rounded-lg bg-slate-50 p-2 text-slate-700"
              />
            </label>
            <label className="block">
              {t.privateSpace.editor.summary}
              <input
                aria-label="日记摘要"
                value={draft.info}
                disabled={loading}
                onChange={(e) => update('info', e.target.value)}
                placeholder="留空时自动摘取正文"
                className="mt-1 block w-full rounded-lg bg-slate-50 p-2 text-slate-700"
              />
            </label>
            {!editingPost && <JournalTemplates onSelect={applyTemplate} />}
            <button
              type="button"
              disabled={loading || uploading}
              onClick={() => {
                if (!window.confirm('清空这篇草稿？此操作无法撤销。')) return;
                skipSave.current = false;
                setDraft(empty());
                setEditorKey((key) => key + 1);
                setRestored(false);
              }}
              className="text-rose-500"
            >
              清空草稿
            </button>
          </div>
        )}
        {legacyDraft && !draft.content && !draft.title && (
          <button
            type="button"
            className="text-xs text-emerald-600"
            onClick={() => {
              try {
                const imported = {
                  ...empty(),
                  content: localStorage.getItem('cachedText') || '',
                  title: localStorage.getItem('titleText') || '',
                  author: localStorage.getItem('authorText') || user?.displayName || '',
                  tags: localStorage.getItem('tagText') || '',
                  info: localStorage.getItem('infoText') || '',
                  isPrivate: true
                };
                // Write the account-scoped copy before removing the legacy keys.
                localStorage.setItem(draftKey, JSON.stringify(imported));
                setDraft(imported);
                setEditorKey((key) => key + 1);
                setLegacyDraft(false);
                for (const key of ['cachedText', 'titleText', 'authorText', 'tagText', 'infoText'])
                  localStorage.removeItem(key);
              } catch {
                toast.error('旧草稿导入失败，原稿仍保留在此设备。');
              }
            }}
          >
            发现旧版编辑器草稿 · 恢复到当前账号
          </button>
        )}
        {restored && (
          <div className="text-xs text-emerald-600 flex justify-between gap-2" role="status">
            <span>已恢复上次未完成的草稿</span>
            <button type="button" onClick={() => setRestored(false)} aria-label="关闭草稿提示">
              ×
            </button>
          </div>
        )}
      </header>
      <div className="flex-1 min-h-0 p-3 md:p-4 bg-white">
        <NoteEditor
          key={editorKey}
          initialContent={draft.content}
          onChange={change}
          onBusyChange={setUploading}
          disabled={loading}
          placeholder={t.privateSpace.editor.tellStory}
        />
      </div>
      <footer className="px-5 py-4 flex items-center justify-between gap-3 shrink-0 border-t border-slate-100 bg-white">
        <div className="min-w-0">
          <button
            type="button"
            onClick={saveDraft}
            disabled={uploading}
            title="Ctrl / ⌘ S"
            className="text-xs font-semibold text-slate-500"
          >
            保存草稿
          </button>
          <p className="text-[10px] text-slate-400 mt-1" role="status">
            {uploading ? '图片上传完成后即可保存' : saved || '安心写，草稿会自动保存'}
          </p>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={loading || uploading}
          className="px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? '正在保存…'
            : editingPost
              ? '保存修改'
              : draft.isPrivate
                ? '保存私密日记'
                : '发布公开日记'}
        </button>
      </footer>
    </section>
  );
};
