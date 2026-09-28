import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Todo } from '../../types';
import { featureService } from '../../services/featureService';
import { formatUserDate } from '../../utils/date';
import { useTranslation } from '../../i18n/LanguageContext';
import { toast } from '../Toast';
import { getRecurrenceOptions } from '../../constants/TodoConstants';

interface RoutineListProps {
  onEdit: (todo: Todo) => void;
  refreshKey: number;
}

export const RoutineList: React.FC<RoutineListProps> = ({ onEdit, refreshKey }) => {
  const { t } = useTranslation();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('active');
  const requestIdRef = useRef(0);

  const RECURRENCE_OPTIONS = getRecurrenceOptions(t);

  const fetchRoutines = useCallback(
    async (p: number, reset = false) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const activeParam =
          filterStatus === 'all' ? undefined : filterStatus === 'active' ? true : false;

        const { data, pagination } = await featureService.getTodos(
          p,
          50,
          'routine',
          undefined,
          activeParam
        );
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
    },
    [filterStatus]
  );

  useEffect(() => {
    void fetchRoutines(1, true);
  }, [refreshKey, fetchRoutines]);

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchRoutines(page + 1);
    }
  };

  const handleCheckIn = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (checkingIds.has(id)) return;
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await featureService.checkRoutine(id);
      toast.success(res.msg);
      // Refresh list to show updated next run time
      fetchRoutines(1, true);
    } catch (e) {
      console.error(e);
      toast.error('Check-in failed');
    } finally {
      setCheckingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, todo: Todo) => {
    e.stopPropagation();
    if (togglingIds.has(todo._id)) return;

    setTogglingIds((prev) => new Set(prev).add(todo._id));
    const newStatus = !todo.isActive;

    try {
      await featureService.updateTodo(todo._id, { isActive: newStatus });
      toast.success(newStatus ? 'Routine Resumed' : 'Routine Paused');

      // If we are filtering by specific status, remove the item
      if (filterStatus !== 'all') {
        setTodos((prev) => prev.filter((t) => t._id !== todo._id));
      } else {
        // Otherwise just update it locally
        setTodos((prev) =>
          prev.map((t) => (t._id === todo._id ? { ...t, isActive: newStatus } : t))
        );
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update status');
    } finally {
      setTogglingIds((prev) => {
        const n = new Set(prev);
        n.delete(todo._id);
        return n;
      });
    }
  };

  const getRecurrenceLabel = (val?: string) => {
    if (!val) return t.privateSpace.bucketList.routine.recurrenceOptions.none;
    return RECURRENCE_OPTIONS.find((o) => o.value === val)?.label || val;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar space-y-3 pt-2 h-full">
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-2 bg-slate-100 p-1 rounded-lg w-fit mx-auto sticky top-0 z-30 shadow-sm">
        {(['active', 'paused', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilterStatus(s);
              setPage(1);
            }}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${
              filterStatus === s
                ? 'bg-white text-pink-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {s === 'active' ? 'Runing' : s}
          </button>
        ))}
      </div>

      {todos.length === 0 && !loading ? (
        <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2 border-2 border-dashed border-pink-100 rounded-2xl">
          <i className="fas fa-sync text-3xl text-pink-100"></i>
          <p className="text-xs">No routines yet.</p>
        </div>
      ) : (
        todos.map((todo) => {
          const isChecking = checkingIds.has(todo._id);
          return (
            <div
              key={todo._id}
              onClick={() => onEdit(todo)}
              className="group bg-white p-4 rounded-2xl border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col gap-2"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-50 mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full overflow-hidden ${todo.isActive === false ? 'grayscale opacity-50' : 'bg-slate-100'}`}
                  >
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
                <div className="flex items-center gap-2">
                  <button
                    className={`relative w-8 h-4 rounded-full transition-colors ${todo.isActive === false ? 'bg-slate-200' : 'bg-green-400'}`}
                    onClick={(e) => handleToggleActive(e, todo)}
                    disabled={togglingIds.has(todo._id)}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${todo.isActive === false ? 'left-0.5' : 'left-4.5 translate-x-0'}`}
                    >
                      {togglingIds.has(todo._id) && (
                        <i className="fas fa-circle-notch fa-spin text-[6px] text-slate-400 absolute inset-0 m-auto flex items-center justify-center"></i>
                      )}
                    </div>
                  </button>
                  <button
                    className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(todo);
                    }}
                  >
                    <i className="fas fa-bolt mr-1"></i> TEST
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm">{todo.todo}</h4>
                  <div className="mt-2 flex flex-col gap-1">
                    {todo.remindAt && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-blue-500 bg-blue-50 w-fit px-2 py-0.5 rounded">
                        <i className="fas fa-bell"></i> {t.privateSpace.bucketList.routine.nextRun}:{' '}
                        {formatUserDate(todo.remindAt, null)}
                      </div>
                    )}
                    {todo.recurrence && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-500 bg-emerald-50 w-fit px-2 py-0.5 rounded">
                        <i className="fas fa-redo"></i> {getRecurrenceLabel(todo.recurrence)}
                      </div>
                    )}
                    {todo.notifyUsers &&
                      Array.isArray(todo.notifyUsers) &&
                      todo.notifyUsers.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {(todo.notifyUsers as any[]).slice(0, 3).map((u, i) => (
                            <div
                              key={i}
                              className="w-4 h-4 rounded-full overflow-hidden bg-slate-200 border border-white"
                              title={u.displayName}
                            >
                              <img
                                src={
                                  u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`
                                }
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {todo.notifyUsers.length > 3 && (
                            <span className="text-[9px] text-slate-400">
                              +{todo.notifyUsers.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 bg-blue-50 border-blue-200 text-blue-400">
                  <i className="fas fa-history text-[10px]"></i>
                </div>
              </div>

              <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50 relative z-20">
                <button
                  onClick={(e) => handleCheckIn(e, todo._id)}
                  disabled={isChecking}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase hover:bg-emerald-600 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {isChecking ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <>
                      <i className="fas fa-check-double"></i> OK! Check-in
                    </>
                  )}
                </button>
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
          Load More Routines
        </button>
      )}
      {loading && (
        <div className="text-center py-2 text-xs text-pink-300 animate-pulse">Loading...</div>
      )}
    </div>
  );
};
