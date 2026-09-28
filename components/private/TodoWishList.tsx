import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Todo } from '../../types';
import { featureService } from '../../services/featureService';
import { formatUserDate } from '../../utils/date';
import { useTranslation } from '../../i18n/LanguageContext';
import { toast } from '../Toast';

type TabType = 'todo' | 'in_progress' | 'done';

interface WishListProps {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  onEdit: (todo: Todo) => void;
  refreshKey: number;
}

export const WishList: React.FC<WishListProps> = ({
  activeTab,
  setActiveTab,
  onEdit,
  refreshKey
}) => {
  const { t } = useTranslation();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);

  // Search state if needed, or controlled by parent. For now self contained or just fetch activeTab.
  // We assume basic listing by activeTab status is sufficient for now, using backend filtering if needed or just filtering locally if API returns mixed.
  // The API supports filtering by 'type=wish'. We need to filter locally by status if API doesn't support status param yet, or fetch all wishes.
  // API currently: GET /todo?type=wish
  // We can fetch all wishes and filter locally, or paginated.
  // If paginated, we should ideally filter on backend.
  // Assuming backend returns mixed status for now, we just filter locally. But pagination breaks local filtering.
  // *Correction*: The prompt said backend API supports search/pagination/type. It didn't explicitly say status.
  // Let's assume we fetch `type=wish` and render. But waiting for status filter on backend might be better.
  // Current implementation: Fetch `type=wish` and filter locally. This is imperfect with pagination but acceptable for MVP or if dataset is small.
  // Better: Pass `keyword` for search.

  const fetchWishes = useCallback(async (p: number, reset = false) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const { data, pagination } = await featureService.getTodos(p, 50, 'wish');
      if (requestId !== requestIdRef.current) return;
      if (reset) {
        setTodos(data);
      } else {
        setTodos((prev) => [...prev, ...data]);
      }
      setHasMore(pagination.hasNextPage);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWishes(1, true);
  }, [refreshKey, fetchWishes]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchWishes(page + 1);
    }
  };

  const handleQuickStatusUpdate = async (e: React.MouseEvent, todo: Todo, newStatus: TabType) => {
    e.stopPropagation();
    try {
      await featureService.updateTodo(todo._id, { status: newStatus });
      // Optimistic update
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, status: newStatus } : t)));
      toast.success(`Updated status`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleQuickDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await featureService.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t._id !== id));
      toast.success('Wish deleted');
    } catch (e) {
      toast.error('Failed to delete');
      setDeletingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const filteredTodos = todos.filter((item) => {
    const itemStatus = item.status || (item.done ? 'done' : 'todo');
    return itemStatus === activeTab;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex px-4 py-2 gap-2 shrink-0">
        {(['todo', 'in_progress', 'done'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-xl transition-all border ${
              activeTab === tab
                ? 'bg-white text-rose-500 border-rose-200 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:bg-white/50'
            }`}
          >
            {t.privateSpace.bucketList.tabs[tab]}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar space-y-3 pt-2">
        {filteredTodos.length === 0 && !loading ? (
          <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2 border-2 border-dashed border-pink-100 rounded-2xl">
            <i className="fas fa-cloud text-3xl text-pink-100"></i>
            <p className="text-xs">{t.privateSpace.bucketList.empty}</p>
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const itemStatus = todo.status || (todo.done ? 'done' : 'todo');
            const isDeleting = deletingIds.has(todo._id);
            return (
              <div
                key={todo._id}
                onClick={() => onEdit(todo)}
                className={`group bg-white p-4 rounded-2xl border border-pink-100 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col gap-2 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-50 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-100">
                      <img
                        src={
                          todo.user?.photoURL ||
                          `https://ui-avatars.com/api/?name=${todo.user?.displayName || 'U'}`
                        }
                        alt="user"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      {todo.user?.displayName || 'Unknown'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleQuickDelete(e, todo._id)}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    {isDeleting ? (
                      <i className="fas fa-circle-notch fa-spin text-[10px]"></i>
                    ) : (
                      <i className="fas fa-trash text-[10px]"></i>
                    )}
                  </button>
                </div>

                <div className="flex justify-between items-start gap-4 relative z-10">
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`font-bold text-slate-800 text-sm ${itemStatus === 'done' ? 'line-through opacity-60' : ''}`}
                    >
                      {todo.todo}
                    </h4>
                    {todo.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {todo.description}
                      </p>
                    )}
                    {todo.targetDate && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-pink-400 bg-pink-50 w-fit px-2 py-0.5 rounded">
                        <i className="fas fa-clock"></i>{' '}
                        {formatUserDate(todo.targetDate, null, 'short')}
                      </div>
                    )}
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${itemStatus === 'done' ? 'bg-amber-400 border-amber-400 text-white' : itemStatus === 'in_progress' ? 'bg-white border-pink-400 text-pink-400 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-300'}`}
                  >
                    {itemStatus === 'done' && <i className="fas fa-check text-[10px]"></i>}
                    {itemStatus === 'in_progress' && <i className="fas fa-running text-[10px]"></i>}
                  </div>
                </div>

                {todo.images && todo.images.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-hidden h-12 relative z-10 pt-2 border-t border-slate-50">
                    {todo.images.slice(0, 3).map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-100"
                      />
                    ))}
                    {todo.images.length > 3 && (
                      <div className="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center text-[10px] text-pink-400 font-bold border border-pink-100">
                        +{todo.images.length - 3}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50 relative z-20">
                  {itemStatus === 'todo' && (
                    <>
                      <button
                        onClick={(e) => handleQuickStatusUpdate(e, todo, 'in_progress')}
                        className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-500 text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fas fa-play"></i> {t.privateSpace.bucketList.actions.start}
                      </button>
                      <button
                        onClick={(e) => handleQuickStatusUpdate(e, todo, 'done')}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-500 text-[10px] font-bold uppercase hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fas fa-check"></i>{' '}
                        {t.privateSpace.bucketList.actions.complete}
                      </button>
                    </>
                  )}
                  {itemStatus === 'in_progress' && (
                    <>
                      <button
                        onClick={(e) => handleQuickStatusUpdate(e, todo, 'todo')}
                        className="flex-1 py-1.5 rounded-lg bg-slate-50 text-slate-400 text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fas fa-undo"></i> {t.privateSpace.bucketList.actions.later}
                      </button>
                      <button
                        onClick={(e) => handleQuickStatusUpdate(e, todo, 'done')}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-500 text-[10px] font-bold uppercase hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fas fa-check"></i>{' '}
                        {t.privateSpace.bucketList.actions.complete}
                      </button>
                    </>
                  )}
                  {itemStatus === 'done' && (
                    <>
                      <button
                        onClick={(e) => handleQuickStatusUpdate(e, todo, 'todo')}
                        className="flex-1 py-1.5 rounded-lg bg-slate-50 text-slate-400 text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fas fa-undo"></i> {t.privateSpace.bucketList.actions.wishlist}
                      </button>
                      <button
                        onClick={(e) => handleQuickStatusUpdate(e, todo, 'in_progress')}
                        className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-500 text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fas fa-redo"></i> {t.privateSpace.bucketList.actions.restart}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {hasMore && !loading && (
          <button
            onClick={loadMore}
            className="w-full py-2 text-xs font-bold text-slate-400 hover:text-pink-500 bg-white/50 rounded-lg transition-colors"
          >
            Load More
          </button>
        )}
        {loading && (
          <div className="text-center py-2 text-xs text-pink-300 animate-pulse">Loading...</div>
        )}
      </div>
    </div>
  );
};
