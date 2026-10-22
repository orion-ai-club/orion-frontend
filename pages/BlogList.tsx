import React, { useEffect, useState } from 'react';
import { BlogPost, User, PaginationData, Tag } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { formatUserDate } from '../utils/date';
import { TagCloud } from '../components/TagCloud';
import { Helmet } from 'react-helmet-async';

interface BlogListProps {
  onSelectBlog: (blog: BlogPost) => void;
  isLoading?: boolean;
  currentUser?: User | null;
  onDeletePost?: (blog: BlogPost) => void;
  onLike?: (id: string) => void;
}

// Adjusted for list view
const ITEMS_PER_PAGE = 10;

export const BlogList: React.FC<BlogListProps> = ({
  onSelectBlog,
  isLoading: initialLoading,
  currentUser,
  onDeletePost,
  onLike
}) => {
  const { t, language } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for fetched data
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Derived state from URL params
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchQuery = searchParams.get('q') || '';
  const selectedTag = searchParams.get('tag') || null;

  // Local state for search input to debounce
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Load likes from local storage
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

  // Fetch Tags (PUBLIC only)
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const fetchedTags = await apiService.getTags('public');
        setTags(fetchedTags);
      } catch (e) {
        console.error('Failed to fetch tags', e);
      }
    };
    fetchTags();
  }, []);

  // Sync input with URL param if URL changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Debounced Search Update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);
          if (searchInput) newParams.set('q', searchInput);
          else newParams.delete('q');
          newParams.set('page', '1'); // Reset to page 1 on search
          return newParams;
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, searchQuery, setSearchParams]);

  // Fetch Data when URL params change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, pagination: pager } = await apiService.getPosts(
          currentPage,
          ITEMS_PER_PAGE,
          searchQuery,
          selectedTag || ''
        );
        setBlogs(data);
        setPagination(pager);
      } catch (error) {
        console.error('Failed to load posts', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Listen for global refresh events
    const handleRefresh = () => fetchData();
    window.addEventListener('blog:refresh', handleRefresh);
    return () => window.removeEventListener('blog:refresh', handleRefresh);
  }, [currentPage, searchQuery, selectedTag]);

  // Handle Page Change
  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('page', newPage.toString());
      return newParams;
    });
    document.getElementById('latest-posts')?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('q');
      next.delete('tag');
      next.delete('page');
      return next;
    });
  };

  // Handle Tag Click
  const handleTagClick = (tag: string | null) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (tag) newParams.set('tag', tag);
      else newParams.delete('tag');
      newParams.set('page', '1');
      return newParams;
    });
  };

  // Internal Like Handler (Updated: Success -> Update UI)
  const handleLikeInternal = async (id: string) => {
    const isLiked = likedPosts.has(id);

    try {
      if (isLiked) {
        // Currently liked, so UNLIKE
        await apiService.unlikePost(id);

        // Update State AFTER success
        setBlogs((prev) =>
          prev.map((p) => {
            if (p._id === id) {
              return { ...p, likes: Math.max(0, (p.likes || 0) - 1) };
            }
            return p;
          })
        );

        const newLikedPosts = new Set(likedPosts);
        newLikedPosts.delete(id);
        setLikedPosts(newLikedPosts);
        localStorage.setItem('liked_posts', JSON.stringify(Array.from(newLikedPosts)));
      } else {
        // Currently NOT liked, so LIKE
        await apiService.likePost(id);

        // Update State AFTER success
        setBlogs((prev) =>
          prev.map((p) => {
            if (p._id === id) {
              return { ...p, likes: (p.likes || 0) + 1 };
            }
            return p;
          })
        );

        const newLikedPosts = new Set(likedPosts);
        newLikedPosts.add(id);
        setLikedPosts(newLikedPosts);
        localStorage.setItem('liked_posts', JSON.stringify(Array.from(newLikedPosts)));
      }

      if (onLike) onLike(id);
    } catch (e) {
      console.error('Like action failed', e);
    }
  };

  // Helper to Render Pagination
  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    return (
      <div className="flex justify-center items-center gap-2 mb-8 mt-4">
        {/* Jump to First */}
        {currentPage > 1 && (
          <button
            onClick={() => handlePageChange(1)}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-all rounded-xl shadow-sm"
            title="First Page"
          >
            <i className="fas fa-step-backward"></i>
          </button>
        )}

        <button
          aria-label="Previous page"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-xl shadow-sm"
        >
          <i className="fas fa-chevron-left"></i>
        </button>

        <div className="flex items-center px-6 h-10 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs tracking-widest text-slate-500 rounded-xl shadow-sm">
          {t.blogList.page}{' '}
          <span className="text-primary-500 font-bold mx-2 text-sm">{currentPage}</span> /{' '}
          {pagination.totalPages}
        </div>

        <button
          aria-label="Next page"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === pagination.totalPages}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-xl shadow-sm"
        >
          <i className="fas fa-chevron-right"></i>
        </button>

        {/* Jump to Last */}
        {currentPage < pagination.totalPages && (
          <button
            onClick={() => handlePageChange(pagination.totalPages)}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-all rounded-xl shadow-sm"
            title="Last Page"
          >
            <i className="fas fa-step-forward"></i>
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      id="latest-posts"
      className="container relative z-10 mx-auto max-w-[1400px] px-4 pb-28 pt-28 sm:px-6"
    >
      <Helmet>
        <title>Orion Journals | Engineering & Digital Evolution | 工程与数字演进随笔</title>
        <meta
          name="description"
          content="Sam's recorded thoughts on engineering, star charts, and digital evolution. Sam关于工程技术、星图研究与数字演进的深度思考记录。"
        />
        <link rel="canonical" href="https://samyao.me/blogs" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Orion Journals | Engineering & Digital Evolution" />
        <meta
          property="og:description"
          content="Sam's technical journal on engineering, systems, AI tooling, architecture, and digital evolution."
        />
        <meta property="og:url" content="https://samyao.me/blogs" />
      </Helmet>

      <header className="relative mb-6 overflow-hidden rounded-[2.6rem] border border-primary-100/70 bg-white/72 px-6 py-10 shadow-[0_30px_100px_-65px_rgba(79,70,229,.65)] backdrop-blur-2xl dark:border-primary-400/15 dark:bg-slate-950/68 dark:shadow-[0_35px_110px_-60px_rgba(0,0,0,.98)] sm:px-10 sm:py-12 lg:px-14">
        <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-primary-300/15 blur-3xl dark:bg-primary-400/10" />
        <div
          className="pointer-events-none absolute bottom-8 right-10 hidden h-28 w-72 opacity-40 md:block"
          aria-hidden="true"
        >
          <span className="absolute right-0 top-4 h-px w-56 bg-gradient-to-l from-primary-500/70 to-transparent" />
          <span className="absolute right-10 top-12 h-px w-44 bg-gradient-to-l from-primary-400/50 to-transparent" />
          <span className="absolute right-4 top-0 h-2.5 w-2.5 rotate-45 border border-primary-500" />
          <span className="absolute right-36 top-8 h-1.5 w-1.5 rounded-full bg-primary-500" />
          <span className="absolute right-64 top-10 h-1 w-1 rounded-full bg-primary-400" />
        </div>

        <div className="relative max-w-3xl">
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] font-black uppercase tracking-[.32em] text-primary-600 dark:text-primary-400">
            <span className="h-px w-9 bg-primary-500" />
            {t.blogList.systemLog}
          </div>
          <h1 className="font-display text-5xl font-black tracking-[-.055em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
            {t.blogList.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-lg">
            {t.blogList.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50/80 px-3.5 py-2 font-semibold dark:border-primary-400/15 dark:bg-primary-400/5">
              <i className="fas fa-feather-pointed text-primary-500" />
              {pagination?.totalItems || blogs.length} {t.blogList.entries}
            </span>
            <span className="inline-flex items-center gap-2 px-2 font-mono text-[10px] uppercase tracking-[.18em]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {language === 'zh' ? '持续记录中' : 'Field notes in progress'}
            </span>
          </div>
        </div>
      </header>

      <section
        className="mb-10 rounded-[2rem] border border-slate-200/75 bg-white/72 p-4 shadow-[0_20px_70px_-58px_rgba(15,23,42,.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/62 sm:p-5"
        aria-label="Journal filters"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,.72fr)_1.28fr] lg:items-center">
          <label className="group relative block">
            <span className="sr-only">{t.blogList.searchPlaceholder}</span>
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary-500" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t.blogList.searchPlaceholder}
              className="block w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-400/35 dark:focus:bg-slate-900 dark:focus:ring-primary-400/10"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Clear search"
              >
                <i className="fas fa-times text-[10px]" />
              </button>
            )}
          </label>
          <div className="min-w-0 rounded-2xl bg-primary-50/60 px-4 py-3 dark:bg-primary-400/5">
            <TagCloud
              tags={tags}
              selectedTag={selectedTag}
              onSelect={handleTagClick}
              theme="primary"
              limit={15}
              label={language === 'zh' ? '主题' : 'Topics'}
            />
          </div>
        </div>
      </section>

      <div className="mb-5 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="font-mono text-[9px] font-black uppercase tracking-[.28em] text-primary-600 dark:text-primary-400">
            {selectedTag || searchQuery
              ? language === 'zh'
                ? '筛选结果'
                : 'Filtered entries'
              : language === 'zh'
                ? '最新记录'
                : 'Latest entries'}
          </p>
          <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {selectedTag
              ? `#${selectedTag}`
              : searchQuery
                ? `“${searchQuery}”`
                : language === 'zh'
                  ? '从最近开始读'
                  : 'Start with the latest'}
          </h2>
        </div>
        {(selectedTag || searchQuery) && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-primary-200 hover:text-primary-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-400/25 dark:hover:text-primary-400"
          >
            <i className="fas fa-rotate-left mr-2" />
            {t.blogList.clearFilters}
          </button>
        )}
      </div>

      {loading || initialLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className={`animate-pulse rounded-[2.2rem] border border-slate-200/70 bg-white/55 dark:border-slate-800 dark:bg-slate-900/50 ${item === 1 ? 'h-[22rem] lg:col-span-2' : 'h-[20rem]'}`}
            />
          ))}
        </div>
      ) : blogs.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {blogs.map((blog, index) => {
            const canDelete = currentUser?.vip && onDeletePost;
            const isLiked = likedPosts.has(blog._id);
            const isFeatured = index === 0 && currentPage === 1 && !searchQuery && !selectedTag;
            const authorName = blog.user?.displayName || blog.author || 'Anonymous';
            const authorAvatar =
              blog.user?.photoURL ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`;

            return (
              <article
                key={blog._id}
                onClick={() => onSelectBlog(blog)}
                className={`group relative flex min-h-[22rem] cursor-pointer flex-col overflow-hidden rounded-[2.2rem] border border-slate-200/80 bg-white/86 shadow-[0_24px_75px_-55px_rgba(15,23,42,.5)] transition duration-500 hover:-translate-y-1 hover:border-primary-200 hover:shadow-[0_30px_95px_-52px_rgba(79,70,229,.38)] dark:border-slate-800 dark:bg-slate-950/82 dark:hover:border-primary-400/30 dark:hover:shadow-[0_30px_95px_-52px_rgba(0,0,0,.95)] ${isFeatured ? 'lg:col-span-2' : ''}`}
              >
                <div className="flex flex-1 flex-col p-6 sm:p-7 lg:p-8">
                  <div className="mb-5 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <img
                        src={authorAvatar}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover ring-2 ring-primary-100 dark:ring-primary-400/15"
                      />
                      {authorName}
                    </span>
                    <span className="h-3 w-px bg-slate-200 dark:bg-slate-800" />
                    <time className="text-slate-600 dark:text-slate-400">
                      {formatUserDate(blog.createdAt || blog.createdDate || blog.date, currentUser)}
                    </time>
                  </div>

                  <h3
                    className={`font-serif font-bold leading-[1.14] tracking-tight text-slate-950 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 ${isFeatured ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}
                  >
                    <button
                      type="button"
                      className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectBlog(blog);
                      }}
                    >
                      {blog.name}
                    </button>
                  </h3>
                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-400 sm:text-[15px]">
                    {blog.info ||
                      (language === 'zh'
                        ? '打开这篇记录，继续阅读。'
                        : 'Open this field note to continue reading.')}
                  </p>

                  {blog.tags?.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {blog.tags.slice(0, 4).map((tagName) => (
                        <span
                          key={tagName}
                          className="rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary-600 dark:border-primary-400/15 dark:bg-primary-400/5 dark:text-primary-400"
                        >
                          #{tagName}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800/80">
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-600 transition-colors group-hover:text-primary-600 dark:text-slate-300 dark:group-hover:text-primary-400">
                      {language === 'zh' ? '阅读全文' : 'Read entry'}
                      <i className="fas fa-arrow-right text-[9px] transition-transform group-hover:translate-x-1" />
                    </span>
                    <div
                      className="flex items-center gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleLikeInternal(blog._id)}
                        className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${isLiked ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10'}`}
                        aria-label={isLiked ? 'Unlike entry' : 'Like entry'}
                      >
                        <i className="fas fa-heart" />
                        {blog.likes || 0}
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeletePost?.(blog)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                          aria-label="Delete entry"
                        >
                          <i className="fas fa-trash text-xs" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[2.4rem] border border-dashed border-primary-200 bg-white/60 px-6 py-28 text-center backdrop-blur-xl dark:border-primary-400/20 dark:bg-slate-950/55">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-2xl text-primary-500 dark:bg-primary-400/10">
            <i className="fas fa-satellite-dish" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-200">
            {t.blogList.noLogs}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t.blogList.adjustSearch}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-full bg-primary-500 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600 dark:text-slate-950"
          >
            {t.blogList.clearFilters}
          </button>
        </div>
      )}

      {!(loading || initialLoading) && renderPagination()}
    </div>
  );
};
