import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { BlogPost, User } from '../types';
import { apiService } from '../services/api';
import { BlogContent } from '../components/BlogContent';
import { CommentsSection } from '../components/CommentsSection';
import { ExternalFramePost } from '../components/ExternalFramePost';
import { formatUserDate } from '../utils/date';
import { useTranslation } from '../i18n/LanguageContext';
import { toast } from '../components/Toast';

interface ArticleViewProps {
  onBack: () => void;
  onNavigateToBlog: (blog: BlogPost) => void;
  currentUser: User | null;
  onLoginRequest: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  onBack,
  onNavigateToBlog,
  currentUser,
  onLoginRequest
}) => {
  const { t } = useTranslation();
  // Use slug from params
  const { slug } = useParams<{ slug: string }>();

  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isImageError, setIsImageError] = useState(false);

  // Like State
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  // Fetch related posts
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setIsImageError(false);

    const fetchPost = async () => {
      if (!slug) return;
      setIsLoading(true);
      try {
        // Logic: Slug format is "title-ID". Extract ID from the end.
        const parts = slug.split('-');
        const postId = parts[parts.length - 1];

        // Validate that we have a potential ID (MongoIDs are usually 24 hex chars)
        if (postId && postId.length >= 24) {
          const post = await apiService.getPostById(postId);
          if (post) {
            setBlog(post);
            setContent(post.content || '');
            setLikeCount(post.likes || 0);

            // Fetch related if tags exist
            if (post.tags && post.tags.length > 0) {
              const { data: related } = await apiService.getPosts(1, 3, '', post.tags[0]);
              setRelatedPosts(related.filter((p) => p._id !== post._id));
            }
          } else {
            setContent('<p>Post not found by ID.</p>');
          }
        } else {
          // Fallback: Attempt legacy search by title
          const searchKeyword = decodeURIComponent(slug).replace(/-/g, ' ');
          const { data } = await apiService.getPosts(1, 1, searchKeyword);

          if (data && data.length > 0) {
            const post = data[0];
            setBlog(post);
            setContent(post.content || '');
            setLikeCount(post.likes || 0);
          } else {
            setContent('<p>Post not found.</p>');
          }
        }
      } catch (error) {
        console.error('Error loading article:', error);
        setContent('<p>Error loading content. Please try again later.</p>');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  // Check Local Storage for Likes
  useEffect(() => {
    if (!blog) return;
    const savedLikes = localStorage.getItem('liked_posts');
    if (savedLikes) {
      try {
        const likesSet = new Set(JSON.parse(savedLikes));
        setIsLiked(likesSet.has(blog._id));
      } catch (e) {
        /* Optional cleanup/cache failure does not block the page. */
      }
    }
  }, [blog]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      toast.success(t.articleView.copied);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleToggleLike = async () => {
    if (!blog) return;
    const id = blog._id;

    try {
      // Optimistic UI Update
      if (isLiked) {
        setLikeCount((prev) => Math.max(0, prev - 1));
        setIsLiked(false);
        await apiService.unlikePost(id);

        // Update Storage
        const savedLikes = localStorage.getItem('liked_posts');
        const likesSet = new Set(savedLikes ? JSON.parse(savedLikes) : []);
        likesSet.delete(id);
        localStorage.setItem('liked_posts', JSON.stringify(Array.from(likesSet)));
      } else {
        setLikeCount((prev) => prev + 1);
        setIsLiked(true);
        // Trigger heart animation here if we had one
        await apiService.likePost(id);

        // Update Storage
        const savedLikes = localStorage.getItem('liked_posts');
        const likesSet = new Set(savedLikes ? JSON.parse(savedLikes) : []);
        likesSet.add(id);
        localStorage.setItem('liked_posts', JSON.stringify(Array.from(likesSet)));
      }
    } catch (e) {
      console.error('Like failed', e);
      // Revert on error could be implemented here
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalArticlePath = blog
    ? `/blogs/${(
        blog.name
          ?.replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase() || 'post'
      )}-${blog._id}`
    : slug
      ? `/blogs/${slug}`
      : '';
  const currentArticleUrl = currentOrigin ? `${currentOrigin}${canonicalArticlePath}` : '';

  // --- 🌟 SEO: 准备 JSON-LD 结构化数据 ---
  const structuredData = blog
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: blog.name,
        description: blog.info ? blog.info.substring(0, 160) : `Read ${blog.name} on Orion.`,
        image: [blog.image || (currentOrigin ? `${currentOrigin}/og-image.png` : '/og-image.png')],
        datePublished: new Date(blog.createdAt || blog.createdDate || blog.date).toISOString(),
        dateModified: new Date(
          blog.updatedAt || blog.updatedDate || blog.createdAt || blog.createdDate || blog.date
        ).toISOString(),
        author: [
          {
            '@type': 'Person',
            name: blog.author || 'Sam',
            url: currentOrigin ? `${currentOrigin}/profile` : '/profile'
          }
        ],
        publisher: {
          '@type': 'Organization',
          name: 'Orion Journals',
          logo: {
            '@type': 'ImageObject',
            url: currentOrigin ? `${currentOrigin}/og-image.png` : '/og-image.png'
          }
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': typeof window !== 'undefined' ? window.location.href : ''
        }
      }
    : null;

  // Removed container and max-w-7xl to allow full width
  const containerClass = 'w-full px-4 md:px-8 py-24 pt-32 animate-fade-in relative z-10';

  if (!blog && !isLoading) {
    return (
      <div className={containerClass}>
        <div className="text-center text-slate-500">Post not found.</div>
        <button onClick={onBack} className="mt-4 text-primary-500 block mx-auto hover:underline">
          Back to Journal
        </button>
      </div>
    );
  }

  // --- Date Logic Helpers ---
  const getPublishDate = () => {
    if (!blog) return '';
    // Prefer createdAt, then createdDate, fall back to date
    return blog.createdAt || blog.createdDate || blog.date;
  };

  const shouldShowUpdatedDate = () => {
    const updated = blog?.updatedAt || blog?.updatedDate;
    if (!blog || !updated) return false;
    const pub = getPublishDate();
    // Only show if updatedDate is strictly different and valid
    return updated !== pub && !isNaN(new Date(updated).getTime());
  };

  return (
    <article className={containerClass}>
      {blog && (
        <Helmet>
          <title>{`${blog.name} | Orion Journals`}</title>
          <meta
            name="keywords"
            content={
              blog.tags && blog.tags.length > 0
                ? blog.tags.join(', ')
                : 'Sam, Engineering, Blog, Life, Orion'
            }
          />
          <meta
            name="description"
            content={
              blog.info
                ? blog.info.substring(0, 160)
                : `Read "${blog.name}" by ${blog.author || 'Sam'}. A digital memoir on engineering, code, and life recorded on Orion.`
            }
          />
          <meta property="og:site_name" content="Orion" />
          <meta property="og:type" content="article" />
          <meta property="og:title" content={`${blog.name} | Orion Journals`} />
          <meta
            property="og:description"
            content={
              blog.info ||
              `Explore "${blog.name}" - Insights on technology and digital evolution by Sam.`
            }
          />
          <meta property="og:url" content={currentArticleUrl} />
          <meta property="article:author" content={blog.author || 'Sam'} />
          {blog.image && <meta property="og:image" content={blog.image} />}
          {structuredData && (
            <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
          )}
          <link rel="canonical" href={currentArticleUrl} />
        </Helmet>
      )}

      {/* Header Container - Max-width aligned, combined Back Button & Title */}
      <div className="max-w-5xl mx-auto mb-8 relative w-full">
        {/* Top Row: Back button and Tags */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <button
            onClick={onBack}
            className="group flex items-center text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors w-fit"
          >
            <div className="w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur flex items-center justify-center mr-3 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors shadow-sm">
              <i className="fas fa-arrow-left text-xs transition-transform group-hover:-translate-x-1"></i>
            </div>
            {t.articleView.back}
          </button>

          {blog && (
            <div className="flex flex-wrap gap-2">
              {blog.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest border border-slate-200/60 dark:border-slate-700/60 shadow-sm"
                >
                  {tag}
                </span>
              ))}
              {blog.isPrivate && (
                <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border border-rose-200 dark:border-rose-800">
                  <i className="fas fa-lock text-[9px]"></i> Encrypted
                </span>
              )}
            </div>
          )}
        </div>

        {blog && (
          <div className="text-left w-full relative overflow-hidden py-4">
            {/* Ambient Background Effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-amber-500/5 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none rounded-full blur-3xl opacity-60"></div>

            <div className="relative z-10 max-w-4xl">
              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight drop-shadow-sm">
                {blog.name}
              </h1>

              {/* Meta Data Row (Author, Date, Last Updated in a single row) */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 md:gap-x-6 text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
                {/* Author */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 p-0.5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                    <img
                      src={
                        blog.user?.photoURL ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.user?.displayName || blog.author || 'Author')}`
                      }
                      className="w-full h-full rounded-full object-cover"
                      alt={blog.author}
                    />
                  </div>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">
                    {blog.user?.displayName || blog.author}
                  </span>
                </div>

                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>

                {/* Date */}
                <div className="flex items-center gap-1.5">
                  <i className="far fa-calendar-alt text-amber-500/80"></i>
                  <span>{formatUserDate(getPublishDate(), currentUser, 'detailed')}</span>
                </div>

                {/* Last Updated */}
                {shouldShowUpdatedDate() && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-white/40 dark:bg-slate-800/40 px-2 py-0.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                      <i className="fas fa-edit text-amber-500/80"></i>
                      <span>
                        Updated:{' '}
                        {formatUserDate(
                          blog.updatedAt || blog.updatedDate,
                          currentUser,
                          'detailed'
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {blog?.iframeUrl ? (
        <ExternalFramePost src={blog.iframeUrl} title={blog.name} />
      ) : (
        // Max width wrapper for text readability, but parent is full width
        <div className="max-w-5xl mx-auto">
          {/* Featured Image */}
          {blog?.image && !isImageError ? (
            <div className="w-full aspect-[21/9] rounded-2xl overflow-hidden mb-8 shadow-xl bg-slate-100 dark:bg-slate-800 relative content-visibility-auto">
              <img
                src={blog.image}
                alt={blog.name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={() => setIsImageError(true)}
              />
            </div>
          ) : blog?.image && isImageError ? (
            <div className="w-full h-px bg-slate-200 dark:bg-slate-800 mb-8"></div>
          ) : null}

          {/* Content Area */}
          <BlogContent content={content} isLoading={isLoading} />
        </div>
      )}

      {/* Share & Like Section */}
      <div className="max-w-3xl mx-auto mt-20 pt-12 border-t border-slate-200 dark:border-slate-800 mb-24">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden group">
          {/* Decorative Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-colors"></div>

          <div className="relative z-10">
            <div className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
              {t.articleView.ctaTitle}
            </div>
            <p className="text-base text-slate-600 dark:text-slate-300 font-light max-w-lg mx-auto mb-8 leading-relaxed">
              {t.articleView.ctaMessage}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Like Button */}
              <button
                onClick={handleToggleLike}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg ${
                  isLiked
                    ? 'bg-rose-500 text-white shadow-rose-500/30 ring-2 ring-rose-300 dark:ring-rose-900'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-700 hover:text-rose-500 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <i className={`fas fa-heart text-lg ${isLiked ? 'animate-pulse' : ''}`}></i>
                <span>{isLiked ? t.articleView.liked : t.articleView.like}</span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-xs ${isLiked ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}
                >
                  {likeCount}
                </span>
              </button>

              {/* Share Button */}
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 ${
                  isCopied
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <i className={`fas ${isCopied ? 'fa-check' : 'fa-share-alt'} text-lg`}></i>
                <span>{isCopied ? t.articleView.copied : t.articleView.share}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Related Posts Section */}
      {relatedPosts.length > 0 && (
        <section className="max-w-5xl mx-auto mb-32 border-t border-slate-200 dark:border-slate-800 pt-16">
          <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-10 text-center">
            Further Reading
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedPosts.map((post) => (
              <div
                key={post._id}
                onClick={() => onNavigateToBlog(post)}
                className="group cursor-pointer flex flex-col gap-4"
              >
                {post.image && (
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-sm content-visibility-auto">
                    <img
                      src={post.image}
                      alt={post.name}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
                <div>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                    {formatUserDate(
                      post.createdAt || post.createdDate || post.date,
                      currentUser,
                      'short'
                    )}
                  </span>
                  <h4 className="font-bold text-xl text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight">
                    {post.name}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comments Section */}
      {blog && (
        <div className="max-w-3xl mx-auto">
          <CommentsSection
            postId={blog._id}
            currentUser={currentUser}
            onLoginRequest={onLoginRequest}
          />
        </div>
      )}
    </article>
  );
};
