import React, { useState, useEffect, useCallback } from 'react';
import { Comment, User } from '../types';
import { apiService } from '../services/api';
import { useTranslation } from '../i18n/LanguageContext';
import { toast } from './Toast';

interface CommentsSectionProps {
  postId: string;
  currentUser: User | null;
  onLoginRequest: () => void;
  forceLight?: boolean;
}

// --- Smart Avatar Component with Error Fallback ---
const Avatar: React.FC<{ user?: any; size?: 'sm' | 'md'; forceLight?: boolean }> = ({
  user,
  size = 'md',
  forceLight
}) => {
  const name = user?.displayName || user?.name || user?.username || 'Anonymous';
  const generatedAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
  const [imgSrc, setImgSrc] = useState<string>(user?.photoURL || generatedAvatarUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(user?.photoURL || generatedAvatarUrl);
    setHasError(false);
  }, [user?.photoURL, generatedAvatarUrl]);

  const sizeClasses = size === 'md' ? 'w-12 h-12' : 'w-8 h-8';
  const bgClasses = forceLight
    ? 'bg-slate-200 ring-white'
    : 'bg-slate-200 dark:bg-slate-700 ring-white dark:ring-slate-800';

  return (
    <div
      className={`${sizeClasses} rounded-full overflow-hidden shrink-0 ring-2 shadow-md ${bgClasses}`}
    >
      <img
        src={imgSrc}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => !hasError && (setHasError(true), setImgSrc(generatedAvatarUrl))}
      />
    </div>
  );
};

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  postId,
  currentUser,
  onLoginRequest,
  forceLight = false
}) => {
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getComments(postId);
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load comments', error);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await apiService.addComment(postId, currentUser, newComment, currentUser.photoURL);
      await fetchComments();
      setNewComment('');
    } catch (error) {
      toast.error(t.comments.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (commentId: string, targetUser: User) => {
    if (!currentUser || !replyText.trim()) return;

    setIsSubmitting(true);
    try {
      await apiService.addReply(
        commentId,
        currentUser,
        replyText,
        targetUser,
        currentUser.photoURL
      );
      await fetchComments();
      setReplyingTo(null);
      setReplyText('');
    } catch (error) {
      toast.error(t.comments.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserName = (user: any) =>
    user?.displayName || user?.name || user?.username || user?.email?.split('@')[0] || 'Anonymous';
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const textClass = forceLight ? 'text-slate-900' : 'text-slate-900 dark:text-white';
  const subTextClass = forceLight ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400';
  const bgClass = forceLight ? 'bg-slate-50' : 'bg-slate-50 dark:bg-slate-900';
  const borderClass = forceLight ? 'border-slate-200' : 'border-slate-200 dark:border-slate-800';
  const inputBgClass = forceLight ? 'bg-white' : 'bg-white dark:bg-slate-900';

  if (isLoading) {
    return (
      <div className={`py-12 text-center animate-pulse border-t ${subTextClass} ${borderClass}`}>
        Loading conversation...
      </div>
    );
  }

  return (
    <section className={`py-16 border-t ${borderClass}`} id="comments">
      <div className="flex items-center justify-between mb-12">
        <h3 className={`text-2xl font-display font-bold ${textClass}`}>{t.comments.title}</h3>
        <span
          className={`text-sm font-medium px-3 py-1 rounded-full ${forceLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          {Array.isArray(comments) ? comments.length : 0} Comments
        </span>
      </div>

      <div className="mb-16">
        {currentUser ? (
          <div className="flex gap-6">
            <div className="hidden sm:block">
              <Avatar user={currentUser} forceLight={forceLight} />
            </div>
            <div className="flex-1">
              <form onSubmit={handlePostComment} className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t.comments.placeholder}
                  className={`w-full rounded-2xl p-6 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all min-h-[120px] resize-y placeholder:text-slate-400 ${bgClass} ${borderClass} ${forceLight ? 'text-slate-900' : 'text-slate-900 dark:text-white'}`}
                  required
                />
                <div className="absolute bottom-4 right-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                    className={`px-6 py-2 rounded-xl font-bold text-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${forceLight ? 'bg-slate-900 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}
                  >
                    {isSubmitting ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      t.comments.postButton
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl p-8 text-center border ${bgClass} ${forceLight ? 'border-slate-100' : 'border-slate-100 dark:border-slate-800/50'}`}
          >
            <h4 className={`font-bold mb-2 ${textClass}`}>Join the conversation</h4>
            <p className={`mb-6 text-sm ${subTextClass}`}>{t.comments.loginToComment}</p>
            <button
              onClick={onLoginRequest}
              className="px-8 py-3 bg-primary-600 text-white rounded-full font-bold text-sm hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
            >
              {t.header.signIn}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-12">
        {!Array.isArray(comments) || comments.length === 0 ? (
          <div className="text-center py-12">
            <i
              className={`far fa-comments text-4xl mb-4 ${forceLight ? 'text-slate-200' : 'text-slate-200 dark:text-slate-700'}`}
            ></i>
            <p className={subTextClass}>{t.comments.noComments}</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="animate-fade-in group">
              <div className="flex gap-6">
                <Avatar user={comment.user} forceLight={forceLight} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`font-bold ${textClass}`}>{getUserName(comment.user)}</span>
                    <span className="text-xs text-slate-400">{formatDate(comment.date)}</span>
                  </div>
                  <div
                    className={`leading-relaxed text-lg mb-4 whitespace-pre-wrap ${forceLight ? 'text-slate-700' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {comment.comment}
                  </div>

                  <div className="flex items-center gap-4">
                    {currentUser && (
                      <button
                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                        className={`text-xs font-bold uppercase tracking-wider hover:text-primary-600 transition-colors flex items-center gap-2 ${forceLight ? 'text-slate-400' : 'text-slate-400 dark:hover:text-primary-400'}`}
                      >
                        <i className="fas fa-reply"></i> {t.comments.reply}
                      </button>
                    )}
                  </div>

                  {replyingTo === comment.id && (
                    <div className="mt-6 flex gap-4 animate-fade-in">
                      <div className="flex-1">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`${t.comments.replyTo} ${getUserName(comment.user)}...`}
                          className={`w-full rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary-500 outline-none ${inputBgClass} ${borderClass} ${forceLight ? 'text-slate-900' : 'text-slate-900 dark:text-white'}`}
                          autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-3">
                          <button
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                            className={`px-4 py-2 text-xs font-bold ${forceLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                          >
                            {t.comments.cancel}
                          </button>
                          <button
                            onClick={() => handleReply(comment.id, comment.user)}
                            disabled={isSubmitting || !replyText.trim()}
                            className="px-5 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 disabled:opacity-50"
                          >
                            {isSubmitting ? '...' : t.comments.postButton}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {comment.reply && comment.reply.length > 0 && (
                    <div
                      className={`mt-8 space-y-8 pl-8 border-l-2 ${forceLight ? 'border-slate-100' : 'border-slate-100 dark:border-slate-800'}`}
                    >
                      {comment.reply.map((reply) => (
                        <div key={reply.id} className="flex gap-4">
                          <Avatar user={reply.user} size="sm" forceLight={forceLight} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-bold text-sm ${textClass}`}>
                                {getUserName(reply.user)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                • {formatDate(reply.date)}
                              </span>
                            </div>
                            <div
                              className={`text-sm leading-relaxed ${forceLight ? 'text-slate-600' : 'text-slate-600 dark:text-slate-300'}`}
                            >
                              {reply.targetUser && (
                                <span className="text-primary-500 font-medium text-xs mr-1">
                                  @{getUserName(reply.targetUser)}
                                </span>
                              )}
                              {reply.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
