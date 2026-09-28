import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { TodoWidget } from '../../components/private/TodoWidget';
import { PrivateBlogFeed } from '../../components/private/PrivateBlogFeed';
import { SimpleEditor } from '../../components/private/SimpleEditor';
import { DeleteModal } from '../../components/DeleteModal';
import { BlogPost, User, PaginationData, Tag } from '../../types';
import { apiService } from '../../services/api';
import { useTranslation } from '../../i18n/LanguageContext';
import { BlogContent } from '../../components/BlogContent';
import { CommentsSection } from '../../components/CommentsSection';
import { formatUserDate } from '../../utils/date';
import { TagCloud } from '../../components/TagCloud';

export const JournalSpace: React.FC = () => {
  const { user } = useOutletContext<{ user: User | null }>();
  const { t, language } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL State
  const page = parseInt(searchParams.get('page') || '1', 10);
  const search = searchParams.get('q') || '';
  const tag = searchParams.get('tag') || '';

  // Data State
  const [privateBlogs, setPrivateBlogs] = useState<BlogPost[]>([]);
  const [privatePagination, setPrivatePagination] = useState<PaginationData | null>(null);

  // Tags State
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Public Logs State (if switched)
  const [logSource, setLogSource] = useState<'private' | 'public'>('private');
  const [publicBlogs, setPublicBlogs] = useState<BlogPost[]>([]);
  const [publicPagination, setPublicPagination] = useState<PaginationData | null>(null);
  const [isPublicLoading, setIsPublicLoading] = useState(false);

  // Like Tracking State
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // UI State
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<BlogPost | null>(null);
  const [previewData, setPreviewData] = useState<{
    title: string;
    content: string;
    tags: string[];
    date: string;
  } | null>(null);
  const [isPreviewHidden, setIsPreviewHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState(search);

  // Load likes from local storage on mount
  useEffect(() => {
    const savedLikes = localStorage.getItem('liked_posts');
    if (savedLikes) {
      try {
        setLikedPosts(new Set(JSON.parse(savedLikes)));
      } catch (e) {
        /* Optional cleanup/cache failure does not block the page. */
      }
    }
  }, []);

  // Fetch Tags on Mount (ALL types for private dashboard)
  useEffect(() => {
    const loadTags = async () => {
      try {
        // Request all tags so private user can filter everything
        const tags = await apiService.getTags('all');
        setAvailableTags(tags);
      } catch (e) {
        console.error('Failed to load tags', e);
      }
    };
    loadTags();
  }, []);

  // Sync internal search with URL
  useEffect(() => {
    setSearchQuery(search);
  }, [search]);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== search) {
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          if (searchQuery) p.set('q', searchQuery);
          else p.delete('q');
          p.set('page', '1');
          return p;
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, search, setSearchParams]);

  // Fetch Private Data
  const fetchPrivateBlogs = useCallback(async () => {
    try {
      const { data, pagination } = await apiService.getPrivatePosts(page, 10, search, tag);
      setPrivateBlogs(data);
      setPrivatePagination(pagination);
    } catch (e) {
      console.error(e);
    }
  }, [page, search, tag]);

  // Fetch Public Data
  const fetchPublicLogs = useCallback(async () => {
    setIsPublicLoading(true);
    try {
      const { data, pagination } = await apiService.getPosts(page, 10, search, tag);
      setPublicBlogs(data);
      setPublicPagination(pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublicLoading(false);
    }
  }, [page, search, tag]);

  useEffect(() => {
    if (logSource === 'private') void fetchPrivateBlogs();
    else void fetchPublicLogs();
  }, [logSource, fetchPrivateBlogs, fetchPublicLogs]);

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('page', newPage.toString());
      return p;
    });
  };

  const handleTagToggle = (selectedTagName: string | null) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (!selectedTagName) {
        p.delete('tag');
      } else {
        p.set('tag', selectedTagName);
      }
      p.set('page', '1');
      return p;
    });
  };

  // Handle Like Toggle Logic (Success First)
  const handleLike = async (id: string) => {
    const isLiked = likedPosts.has(id);

    try {
      if (isLiked) {
        // Currently Liked -> Unlike
        await apiService.unlikePost(id);

        // Update UI
        if (logSource === 'public') {
          setPublicBlogs((prev) =>
            prev.map((p) => (p._id === id ? { ...p, likes: Math.max(0, (p.likes || 0) - 1) } : p))
          );
        } else {
          setPrivateBlogs((prev) =>
            prev.map((p) => (p._id === id ? { ...p, likes: Math.max(0, (p.likes || 0) - 1) } : p))
          );
        }
        if (selectedEntry && selectedEntry._id === id) {
          setSelectedEntry((prev) =>
            prev ? { ...prev, likes: Math.max(0, (prev.likes || 0) - 1) } : null
          );
        }

        // Update Local State
        const newLikedPosts = new Set(likedPosts);
        newLikedPosts.delete(id);
        setLikedPosts(newLikedPosts);
        localStorage.setItem('liked_posts', JSON.stringify(Array.from(newLikedPosts)));
      } else {
        // Not Liked -> Like
        await apiService.likePost(id);

        // Update UI
        if (logSource === 'public') {
          setPublicBlogs((prev) =>
            prev.map((p) => (p._id === id ? { ...p, likes: (p.likes || 0) + 1 } : p))
          );
        } else {
          setPrivateBlogs((prev) =>
            prev.map((p) => (p._id === id ? { ...p, likes: (p.likes || 0) + 1 } : p))
          );
        }
        if (selectedEntry && selectedEntry._id === id) {
          setSelectedEntry((prev) => (prev ? { ...prev, likes: (prev.likes || 0) + 1 } : null));
        }

        // Update Local State
        const newLikedPosts = new Set(likedPosts);
        newLikedPosts.add(id);
        setLikedPosts(newLikedPosts);
        localStorage.setItem('liked_posts', JSON.stringify(Array.from(newLikedPosts)));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostCreated = (isPrivate: boolean) => {
    const nextSource = isPrivate ? 'private' : 'public';
    setLogSource(nextSource);
    // Determine if it was a new post or an edit based on current state
    // If editingPost is not null, we are updating. If null, we are creating.
    const wasEditing = !!editingPost;

    setEditingPost(null);
    setPreviewData(null);

    // Refresh tags list as new post might introduce new tags
    apiService.getTags('all').then(setAvailableTags);

    // If creating a new post and NOT on the first page, navigate to page 1 to ensure visibility.
    // The useEffect hook will automatically trigger fetchPrivateBlogs() when 'page' changes.
    if (!wasEditing && page !== 1) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('page', '1');
        return p;
      });
    } else if (nextSource === logSource) {
      // Otherwise (Editing existing post, OR Creating on Page 1), manually refresh the current view.
      if (logSource === 'private') fetchPrivateBlogs();
      else fetchPublicLogs();
    }
  };

  const confirmDelete = async (secret?: string) => {
    if (!postToDelete) return;
    try {
      await apiService.deletePost(postToDelete._id, secret);
      setPostToDelete(null);
      if (selectedEntry?._id === postToDelete._id) setSelectedEntry(null);
      if (logSource === 'private') fetchPrivateBlogs();
      else fetchPublicLogs();

      // Refresh tags
      apiService.getTags('all').then(setAvailableTags);
    } catch (error) {
      console.error(error);
    }
  };

  const displayBlogs = logSource === 'private' ? privateBlogs : publicBlogs;
  const displayPagination = logSource === 'private' ? privatePagination : publicPagination;

  const hasContent = (data: any) => {
    if (!data) return false;
    const textContent = (data.content || '').replace(/<[^>]*>/g, '').trim();
    return (
      !!data.title?.trim() ||
      textContent.length > 0 ||
      /<(img|figure|video|iframe)|data-type="journal-math"/.test(data.content || '')
    );
  };

  const showPreview = previewData && hasContent(previewData) && !isPreviewHidden;

  return (
    <>
      <div className="journal-space grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10 lg:pb-0 lg:h-[88vh] lg:min-h-[850px] min-h-0 relative">
        <DeleteModal
          isOpen={!!postToDelete}
          onClose={() => setPostToDelete(null)}
          onConfirm={confirmDelete}
          title={t.delete.confirmTitle}
          confirmKeyword={
            logSource === 'private' ? user?.private_token || 'ilovechenfangting' : undefined
          }
          isSecret={logSource === 'private'}
          message={logSource === 'private' ? t.delete.confirmSecretMessage : undefined}
        />

        {/* Left Column Container */}
        <div className="h-[65vh] lg:h-full flex flex-col min-h-0 journal-space-panel rounded-3xl border shadow-lg backdrop-blur-md overflow-hidden ring-1 ring-white/50 order-2 lg:order-1 private-feed-top transition-all duration-300 relative">
          {/* Detail View */}
          {selectedEntry && (
            <div className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-slate-950 animate-slide-up overflow-hidden">
              <div className="p-4 border-b border-rose-100 dark:border-amber-400/15 flex items-center justify-between bg-white dark:bg-slate-950 shrink-0">
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-500 transition-all font-bold text-xs uppercase tracking-wider"
                >
                  <i className="fas fa-arrow-left"></i> Back
                </button>
                <div className="text-right">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    {formatUserDate(
                      selectedEntry.createdDate || selectedEntry.date,
                      user,
                      'default'
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-white dark:bg-slate-950">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-8 text-center">
                    <div className="flex justify-center gap-2 mb-4">
                      {selectedEntry.tags.map((t) => (
                        <span
                          key={t}
                          className="px-3 py-1 bg-rose-50 text-rose-500 rounded-full text-[10px] font-bold uppercase tracking-widest"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">
                      {selectedEntry.name}
                    </h1>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono uppercase">
                      <span>{selectedEntry.author}</span>
                      {selectedEntry.isPrivate && <i className="fas fa-lock text-rose-300"></i>}
                    </div>
                  </div>
                  <div className="mb-12">
                    {selectedEntry.image && (
                      <img
                        src={selectedEntry.image}
                        className="w-full rounded-2xl shadow-lg mb-8"
                        alt={selectedEntry.name}
                      />
                    )}
                    <BlogContent
                      content={selectedEntry.content || ''}
                      shadowClass="shadow-none border-none"
                      forceLight={false}
                    />
                  </div>
                  <div className="border-t border-slate-100 pt-8">
                    <CommentsSection
                      postId={selectedEntry._id}
                      currentUser={user}
                      onLoginRequest={() => {}}
                      forceLight={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview View */}
          {showPreview ? (
            <div className="flex-col h-full flex animate-fade-in bg-white/50 dark:bg-slate-950/70">
              <div className="p-6 pb-4 bg-amber-50/50 border-b border-amber-100 flex items-center justify-center relative shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 shadow-sm animate-pulse">
                    <i className="fas fa-eye"></i>
                  </div>
                  <h2 className="text-lg font-display font-bold text-slate-700 uppercase tracking-widest">
                    Live Preview
                  </h2>
                </div>
                <button
                  onClick={() => setIsPreviewHidden(true)}
                  className="absolute right-6 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-colors shadow-sm"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-rose-50/30 dark:bg-slate-950">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 mb-6">
                  <h1 className="text-3xl font-display font-bold text-slate-900 mb-2 text-center leading-tight">
                    {previewData?.title || 'Untitled Entry'}
                  </h1>
                </div>
                <BlogContent
                  content={previewData?.content || ''}
                  shadowClass="shadow-sm"
                  forceLight={false}
                />
              </div>
            </div>
          ) : (
            // List View
            <div className={`flex flex-col h-full ${selectedEntry ? 'hidden' : 'flex'}`}>
              <div className="journal-orbit-header shrink-0 border-b p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-500/20 dark:bg-amber-400 dark:text-slate-950 dark:shadow-amber-500/20">
                      <i className={`fas ${logSource === 'private' ? 'fa-lock' : 'fa-globe'}`}></i>
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950"></span>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-rose-600 dark:text-amber-400">
                        Captain&apos;s log archive
                      </p>
                      <h1 className="truncate font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        {logSource === 'private' ? t.privateSpace.journal : 'Public Journal'}
                      </h1>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {displayPagination ? displayPagination.totalItems : displayBlogs.length}{' '}
                        entries ·{' '}
                        {logSource === 'private'
                          ? 'Only visible inside the cabin'
                          : 'Published to Orion'}
                      </p>
                    </div>
                  </div>
                  <div
                    className="grid grid-cols-2 rounded-2xl border border-rose-100 bg-rose-50/80 p-1 dark:border-amber-400/10 dark:bg-slate-900"
                    role="tablist"
                    aria-label="Journal visibility"
                  >
                    {[
                      { value: 'private', label: 'Private', icon: 'fa-lock' },
                      { value: 'public', label: 'Public', icon: 'fa-globe' }
                    ].map((source) => (
                      <button
                        key={source.value}
                        type="button"
                        role="tab"
                        aria-selected={logSource === source.value}
                        onClick={() => setLogSource(source.value as 'private' | 'public')}
                        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${logSource === source.value ? 'bg-white text-rose-700 shadow-sm dark:bg-amber-400 dark:text-slate-950' : 'text-slate-500 hover:text-rose-700 dark:text-slate-400 dark:hover:text-amber-300'}`}
                      >
                        <i className={`fas ${source.icon}`}></i>
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="group relative block">
                    <span className="sr-only">Search journal</span>
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 transition-colors group-focus-within:text-rose-600 dark:text-slate-600 dark:group-focus-within:text-amber-400"></i>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search titles, memories and ideas…"
                      className="w-full rounded-2xl border border-rose-100 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-400/40 dark:focus:ring-amber-400/10"
                    />
                  </label>
                  <TagCloud
                    tags={availableTags}
                    selectedTag={tag || null}
                    onSelect={handleTagToggle}
                    theme="rose"
                    limit={8}
                    label={language === 'zh' ? '按标签筛选' : 'Filter by tag'}
                  />
                  {hasContent(previewData) && isPreviewHidden && (
                    <button
                      onClick={() => setIsPreviewHidden(false)}
                      className="self-start rounded-full bg-rose-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 transition hover:bg-rose-200 dark:bg-amber-400/10 dark:text-amber-300"
                    >
                      <i className="fas fa-eye mr-1"></i> Resume live preview
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-rose-50/30 dark:bg-slate-950/70">
                {isPublicLoading ? (
                  <div className="text-center py-20 text-slate-400 animate-pulse">
                    Loading Logs...
                  </div>
                ) : (
                  <PrivateBlogFeed
                    blogs={displayBlogs}
                    onSelectBlog={setSelectedEntry}
                    onLike={handleLike}
                    onEdit={(blog) => {
                      setEditingPost(blog);
                      if (window.innerWidth < 1024)
                        setTimeout(
                          () =>
                            document
                              .getElementById('private-editor')
                              ?.scrollIntoView({ behavior: 'smooth' }),
                          100
                        );
                    }}
                    onDelete={(blog) => setPostToDelete(blog)}
                    pagination={displayPagination}
                    onPageChange={handlePageChange}
                    currentUser={user}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Widgets & Editor */}
        <div className="flex flex-col gap-6 lg:h-full order-1 lg:order-2 min-h-0">
          <div className="shrink-0 relative z-20">
            <TodoWidget user={user} />
          </div>

          <div
            id="private-editor"
            className="lg:flex-1 lg:min-h-0 h-[80vh] shadow-xl rounded-[2rem] bg-white dark:bg-slate-950 overflow-hidden ring-1 ring-rose-100 dark:ring-amber-400/10 flex flex-col"
          >
            <SimpleEditor
              key={`${user?._id}:${editingPost?._id || 'new-post'}`}
              user={user}
              onPostCreated={handlePostCreated}
              editingPost={editingPost}
              onCancelEdit={() => {
                setEditingPost(null);
                setPreviewData(null);
              }}
              onPreviewChange={setPreviewData}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default JournalSpace;
