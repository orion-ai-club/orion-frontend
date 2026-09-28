import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { featureService } from '../services/featureService';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/LanguageContext';

interface BackupTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupTerminalModal: React.FC<BackupTerminalModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [isError, setIsError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const hasStartedRef = useRef(false);

  const startBackup = useCallback(async () => {
    hasStartedRef.current = true;
    setLogs([t.system.backup.init, t.system.backup.reqDump]);

    try {
      const response = await featureService.getBackupStream();

      if (!response.ok) {
        throw new Error(`Connection Failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body received.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Split by newlines as backend sends distinct log lines
        const lines = chunk.split('\n').filter(Boolean);

        setLogs((prev) => [...prev, ...lines]);
      }

      setIsDone(true);
      setLogs((prev) => [...prev, t.system.backup.success]);
    } catch (e: any) {
      console.error(e);
      setIsError(true);
      setLogs((prev) => [
        ...prev,
        `> ERROR: ${e.message || 'Unknown error occurred.'}`,
        t.system.backup.terminated
      ]);
    }
  }, [
    t.system.backup.init,
    t.system.backup.reqDump,
    t.system.backup.success,
    t.system.backup.terminated
  ]);

  useEffect(() => {
    if (isOpen && !hasStartedRef.current) {
      void startBackup();
    }
    if (!isOpen) {
      setLogs([]);
      setIsDone(false);
      setIsError(false);
      hasStartedRef.current = false;
    }
  }, [isOpen, startBackup]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleGoToFiles = () => {
    onClose();
    navigate('/system-management', {
      state: {
        tab: 'RESOURCES',
        resourceTab: 'R2',
        r2Type: 'backup'
      }
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col font-mono text-sm max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${isError ? 'bg-red-500' : isDone ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}
            ></div>
            <span className="font-bold text-slate-300">{t.system.backup.terminalTitle}</span>
          </div>
          {!isDone && !isError && (
            <span className="text-xs text-slate-500 animate-pulse">
              {t.system.backup.processing}
            </span>
          )}
        </div>

        {/* Terminal Window */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar min-h-[300px]"
        >
          {logs.map((log, i) => (
            <div
              key={i}
              className={`break-words ${log.includes('ERROR') ? 'text-red-400' : log.includes('Uploaded') || log.includes('Done') ? 'text-emerald-400' : 'text-slate-300'}`}
            >
              {log}
            </div>
          ))}
          {!isDone && !isError && <div className="text-slate-500 animate-pulse">_</div>}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
          {isDone ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {t.system.common.cancel}
              </button>
              <button
                onClick={handleGoToFiles}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2"
              >
                <i className="fas fa-folder-open"></i> {t.system.backup.viewFiles}
              </button>
            </>
          ) : isError ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
            >
              {t.system.common.cancel}
            </button>
          ) : (
            <button disabled className="px-4 py-2 text-slate-500 cursor-not-allowed">
              {t.system.backup.wait}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
