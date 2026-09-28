import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { AuditLog, User } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { DeleteModal } from '../components/DeleteModal';

const ITEMS_PER_PAGE = 20;

type ViewMode = 'TIMELINE' | 'OPERATORS' | 'ACTIONS';

export const AuditLogViewer: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalLogCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('TIMELINE');

  // Filters
  const [filterOperator, setFilterOperator] = useState<User | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [targetSearch, setTargetSearch] = useState('');
  const [ipSearch, setIpSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Lists
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [operatorList, setOperatorList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Modals
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [showPruneModal, setShowPruneModal] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const filtersRef = useRef({
    filterOperator,
    filterAction,
    targetSearch,
    ipSearch,
    startDate,
    endDate
  });
  filtersRef.current = {
    filterOperator,
    filterAction,
    targetSearch,
    ipSearch,
    startDate,
    endDate
  };
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  useEffect(() => {
    apiService
      .getCurrentUser()
      .then(setCurrentUser)
      .catch(() => {});
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const res = await apiService.getAuditOptions();
      setActionOptions(res.actions);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = useCallback(async (page = 1) => {
    const filters = filtersRef.current;
    setLoading(true);
    try {
      const res = await apiService.getAuditLogs(page, ITEMS_PER_PAGE, {
        operator: filters.filterOperator?._id,
        action: filters.filterAction || undefined,
        target: filters.targetSearch || undefined,
        ip: filters.ipSearch || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      });
      setLogs(res.data);
      setPagination({
        currentPage: res.pagination.currentPage,
        totalPages: res.pagination.totalPages,
        totalLogCount: res.pagination.totalLogCount
      });
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOperators = async () => {
    try {
      const { data } = await apiService.getUsers(1, 100, '', 'role', 'desc');
      setOperatorList(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (viewMode === 'TIMELINE') void fetchLogs(1);
    if (viewMode === 'OPERATORS') void fetchOperators();
  }, [viewMode, filterOperator, filterAction, startDate, endDate, fetchLogs]);

  // Debounced text/IP search. The ref keeps view changes from triggering a duplicate fetch;
  // the immediate effect above owns viewMode changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewModeRef.current === 'TIMELINE') void fetchLogs(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [targetSearch, ipSearch, fetchLogs]);

  const handleDelete = async () => {
    if (!logToDelete) return;
    try {
      await apiService.deleteAuditLog(logToDelete);
      setLogToDelete(null);
      fetchLogs(currentPage);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrune = async () => {
    try {
      await apiService.pruneAuditLogs();
      setShowPruneModal(false);
      fetchLogs(1);
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container mx-auto px-4 py-24 pt-32 max-w-7xl animate-fade-in min-h-screen">
      <DeleteModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Single Log Entry"
        message="Permanently remove this audit record?"
        requireInput={false}
      />

      <DeleteModal
        isOpen={showPruneModal}
        onClose={() => setShowPruneModal(false)}
        onConfirm={handlePrune}
        title="Prune Old Logs"
        message="This will delete all system logs older than 90 days. Are you sure?"
        requireInput={true}
        confirmKeyword="PRUNE"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <i className="fas fa-shield-alt text-cyan-400 text-xl"></i>
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-wide">
              {t.auditLog.title}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-mono text-sm max-w-xl">
            {t.auditLog.subtitle}
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setShowPruneModal(true)}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
          >
            <i className="fas fa-broom mr-2"></i> Prune Old Logs (90d)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation & Advanced Filters */}
        <div className="col-span-1 space-y-6">
          <div className="bg-[#050914] border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">
              Views
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setViewMode('TIMELINE')}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${viewMode === 'TIMELINE' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
              >
                <i className="fas fa-stream w-5 text-center"></i>
                <span className="font-bold text-sm">Live Feed</span>
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setViewMode('OPERATORS')}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${viewMode === 'OPERATORS' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                >
                  <i className="fas fa-users w-5 text-center"></i>
                  <span className="font-bold text-sm">Operator Analysis</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Section */}
          <div className="bg-[#050914] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Advanced Filters
            </h3>

            {/* Action Dropdown */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">
                Command Type
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
              >
                <option value="">All Actions</option>
                {actionOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Target & IP fuzzy */}
            <div className="space-y-4">
              <div className="relative group">
                <input
                  type="text"
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  placeholder="Search target..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
                <i className="fas fa-bullseye absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
              </div>
              <div className="relative group">
                <input
                  type="text"
                  value={ipSearch}
                  onChange={(e) => setIpSearch(e.target.value)}
                  placeholder="Search IP..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                />
                <i className="fas fa-network-wired absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
              </div>
            </div>

            <button
              onClick={() => {
                setFilterOperator(null);
                setFilterAction('');
                setTargetSearch('');
                setIpSearch('');
                setStartDate('');
                setEndDate('');
              }}
              className="w-full py-2 text-[10px] font-bold uppercase text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-all"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-span-1 lg:col-span-3">
          <div className="bg-[#050914] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative min-h-[600px] flex flex-col">
            {/* VIEW: LIVE FEED (TIMELINE) */}
            {viewMode === 'TIMELINE' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-800 text-xs uppercase tracking-widest font-mono text-slate-400">
                        <th className="p-4 pl-6">{t.auditLog.operator}</th>
                        <th className="p-4">{t.auditLog.action}</th>
                        <th className="p-4">{t.auditLog.target}</th>
                        <th className="p-4">{t.auditLog.time}</th>
                        <th className="p-4 pr-6 text-right">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-mono text-sm">
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td colSpan={5} className="p-6">
                              <div className="h-4 bg-slate-800 rounded w-full"></div>
                            </td>
                          </tr>
                        ))
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-20 text-center text-slate-600">
                            <i className="fas fa-database text-3xl mb-4 opacity-20 block"></i> No
                            records found for current criteria.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr
                            key={log._id}
                            className="hover:bg-cyan-900/10 transition-colors group"
                          >
                            <td className="p-4 pl-6 text-white">
                              {log.operator ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-700 ring-1 ring-slate-600">
                                    <img
                                      src={
                                        log.operator.photoURL ||
                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(log.operator.displayName)}&background=random`
                                      }
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-cyan-300 text-xs">
                                      {log.operator.displayName}
                                    </span>
                                    <span className="text-[9px] opacity-40 uppercase">
                                      {log.operator.role}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-500 italic text-xs">System</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4 text-slate-400 text-xs">
                              {log.target}
                              {log.details && (
                                <div
                                  className="text-[9px] text-slate-600 truncate max-w-[120px]"
                                  title={JSON.stringify(log.details)}
                                >
                                  {JSON.stringify(log.details)}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-slate-500 text-[11px] whitespace-nowrap">
                              {formatDate(log.createdDate)}
                            </td>
                            <td className="p-4 pr-6 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] text-slate-600">
                                  {log.ipAddress || 'Internal'}
                                </span>
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => setLogToDelete(log._id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all"
                                    title="Delete record"
                                  >
                                    <i className="fas fa-trash-alt text-[10px]"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-between items-center shrink-0">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => fetchLogs(currentPage - 1)}
                      className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 disabled:opacity-20"
                    >
                      <i className="fas fa-chevron-left mr-2"></i> Previous
                    </button>
                    <span className="font-mono text-xs text-slate-500">
                      Page <span className="text-cyan-500 font-bold">{currentPage}</span> /{' '}
                      {pagination.totalPages}
                    </span>
                    <button
                      disabled={currentPage === pagination.totalPages}
                      onClick={() => fetchLogs(currentPage + 1)}
                      className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 disabled:opacity-20"
                    >
                      Next <i className="fas fa-chevron-right ml-2"></i>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VIEW: OPERATORS ANALYSIS */}
            {viewMode === 'OPERATORS' && (
              <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <i className="fas fa-user-chart text-cyan-400"></i> User Access Dossier
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {operatorList.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        setFilterOperator(u);
                        setViewMode('TIMELINE');
                      }}
                      className={`p-4 rounded-2xl bg-slate-900 border transition-all text-left flex items-center gap-4 group ${filterOperator?._id === u._id ? 'border-cyan-500 bg-cyan-900/20' : 'border-slate-800 hover:border-slate-600'}`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 ring-2 ring-transparent group-hover:ring-cyan-500/50 transition-all">
                        <img
                          src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white group-hover:text-cyan-400 truncate">
                          {u.displayName}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                          {u.role}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
