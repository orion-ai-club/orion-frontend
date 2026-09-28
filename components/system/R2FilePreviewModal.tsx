import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getR2FileIcon,
  getR2FileName,
  getR2LanguageLabel,
  getR2PreviewKind,
  R2FileLike
} from './r2FileUtils';

interface R2FilePreviewModalProps {
  file: R2FileLike | null;
  onClose: () => void;
}

const MAX_INLINE_TEXT_BYTES = 5 * 1024 * 1024;

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const R2FilePreviewModal: React.FC<R2FilePreviewModalProps> = ({ file, onClose }) => {
  const [textContent, setTextContent] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const url = file?.url || file?.publicUrl || '';
  const kind = file ? getR2PreviewKind(file) : 'unsupported';
  const icon = file ? getR2FileIcon(file) : getR2FileIcon({ name: '' });
  const name = file ? getR2FileName(file) : '';
  const language = file ? getR2LanguageLabel(file) : '';

  useEffect(() => {
    if (!file) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [file, onClose]);

  useEffect(() => {
    if (!file || (kind !== 'code' && kind !== 'text')) {
      setTextContent('');
      setTextError(null);
      setTextLoading(false);
      return;
    }

    if (!url) {
      setTextError('This object does not have a public read URL.');
      return;
    }

    if ((file.size || 0) > MAX_INLINE_TEXT_BYTES) {
      setTextError(
        `This file is ${formatBytes(file.size)}. Open the original file for large-file viewing.`
      );
      return;
    }

    const controller = new AbortController();
    setTextLoading(true);
    setTextError(null);

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((content) => {
        if (getR2LanguageLabel(file) === 'JSON') {
          try {
            setTextContent(JSON.stringify(JSON.parse(content), null, 2));
            return;
          } catch {
            // Keep malformed or JSON-like files exactly as stored.
          }
        }
        setTextContent(content);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setTextError(
          `Inline preview could not load this object (${error?.message || 'unknown error'}). You can still open the original file.`
        );
      })
      .finally(() => setTextLoading(false));

    return () => controller.abort();
  }, [file, kind, url]);

  const codeLines = useMemo(() => textContent.split('\n'), [textContent]);

  if (!file) return null;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
    } catch {
      // Clipboard permission can be unavailable in embedded/PWA contexts.
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[11000] bg-slate-950/80 backdrop-blur-md p-3 md:p-6 flex items-center justify-center"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="w-full max-w-7xl h-[92vh] bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <header className="h-16 px-4 md:px-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/90 dark:bg-slate-950/70">
          <div
            className={`w-10 h-10 rounded-xl ${icon.bg} ${icon.tone} flex items-center justify-center shrink-0`}
          >
            <i className={`fas ${icon.icon} text-lg`}></i>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate"
              title={name}
            >
              {name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
              {file.path || file.key || language}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800">{language}</span>
            <span>{formatBytes(file.size)}</span>
          </div>

          {(kind === 'code' || kind === 'text') && textContent && (
            <button
              onClick={copyText}
              className="w-9 h-9 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="Copy file contents"
            >
              <i className="far fa-copy"></i>
            </button>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="w-9 h-9 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors flex items-center justify-center"
              title="Open original"
            >
              <i className="fas fa-arrow-up-right-from-square"></i>
            </a>
          )}

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-red-500 hover:text-white text-slate-500 transition-colors"
            title="Close preview"
          >
            <i className="fas fa-times"></i>
          </button>
        </header>

        <main className="flex-1 min-h-0 bg-slate-100 dark:bg-[#060a12] overflow-hidden">
          {kind === 'image' && url && (
            <div className="w-full h-full p-6 flex items-center justify-center bg-[radial-gradient(#64748b25_1px,transparent_1px)] [background-size:14px_14px]">
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
              />
            </div>
          )}

          {kind === 'video' && url && (
            <div className="w-full h-full p-4 md:p-8 flex items-center justify-center bg-black">
              <video src={url} controls autoPlay className="max-w-full max-h-full rounded-lg" />
            </div>
          )}

          {kind === 'audio' && url && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8">
              <div
                className={`w-24 h-24 rounded-3xl ${icon.bg} ${icon.tone} flex items-center justify-center`}
              >
                <i className={`fas ${icon.icon} text-5xl`}></i>
              </div>
              <audio src={url} controls className="w-full max-w-xl" />
            </div>
          )}

          {kind === 'pdf' && url && (
            <iframe
              src={`${url}#toolbar=1&navpanes=0`}
              title={name}
              className="w-full h-full bg-white"
            />
          )}

          {(kind === 'code' || kind === 'text') && (
            <div className="w-full h-full flex flex-col bg-[#0d1117] text-slate-200">
              <div className="h-9 px-4 border-b border-white/10 flex items-center justify-between bg-[#161b22] shrink-0">
                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                  {kind === 'code' ? 'IDE Preview' : 'Text Preview'} · {language}
                </span>
                <span className="text-[10px] text-slate-500">{codeLines.length} lines</span>
              </div>

              {textLoading ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <i className="fas fa-circle-notch fa-spin mr-2"></i> Loading file…
                </div>
              ) : textError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <i className="fas fa-file-circle-exclamation text-4xl text-amber-400"></i>
                  <p className="max-w-2xl text-sm text-slate-400">{textError}</p>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-lg bg-sky-500 text-white text-xs font-bold"
                    >
                      Open original
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-auto custom-scrollbar font-mono text-[13px] leading-6">
                  <table className="min-w-full border-collapse">
                    <tbody>
                      {codeLines.map((line, index) => (
                        <tr key={index} className="hover:bg-white/[0.035]">
                          <td className="select-none sticky left-0 w-14 min-w-14 px-3 text-right align-top text-slate-600 border-r border-white/5 bg-[#0d1117]">
                            {index + 1}
                          </td>
                          <td className="px-4 whitespace-pre align-top text-slate-200">
                            {line || ' '}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {kind === 'unsupported' && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div
                className={`w-24 h-24 rounded-3xl ${icon.bg} ${icon.tone} flex items-center justify-center`}
              >
                <i className={`fas ${icon.icon} text-5xl`}></i>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">{name}</h4>
                <p className="text-sm text-slate-500 mt-1">
                  No inline viewer is available for this file type, but the object is still listed
                  and accessible.
                </p>
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors"
                >
                  Open original
                </a>
              )}
            </div>
          )}
        </main>
      </div>
    </div>,
    document.body
  );
};
