export type R2PreviewKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'code'
  | 'text'
  | 'unsupported';

export interface R2FileLike {
  name?: string;
  path?: string;
  key?: string;
  type?: string;
  url?: string;
  publicUrl?: string;
  size?: number;
  lastModified?: string;
}

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx',
  'py', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts', 'swift',
  'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'cs',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'jsonc', 'yml', 'yaml', 'toml', 'ini', 'conf', 'config',
  'xml', 'svg', 'sql', 'graphql', 'gql', 'vue', 'svelte'
]);

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'log', 'csv', 'tsv',
  'env', 'gitignore', 'npmrc', 'editorconfig', 'properties'
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

export const getR2FileName = (file: R2FileLike) =>
  file.name || file.path?.split('/').filter(Boolean).pop() || file.key?.split('/').filter(Boolean).pop() || 'Untitled';

export const getR2FileExtension = (file: R2FileLike) => {
  const name = getR2FileName(file).toLowerCase();
  const special = ['dockerfile', 'makefile', 'procfile'];
  if (special.includes(name)) return name;
  if (name.startsWith('.') && !name.slice(1).includes('.')) return name.slice(1);
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
};

export const getR2PreviewKind = (file: R2FileLike): R2PreviewKind => {
  const ext = getR2FileExtension(file);
  const backendType = (file.type || '').toLowerCase();

  if (backendType === 'image' || IMAGE_EXTENSIONS.has(ext)) return ext === 'svg' ? 'code' : 'image';
  if (backendType === 'video' || VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (CODE_EXTENSIONS.has(ext) || ['dockerfile', 'makefile', 'procfile'].includes(ext)) return 'code';
  if (TEXT_EXTENSIONS.has(ext) || backendType === 'text') return 'text';
  return 'unsupported';
};

export const isR2Previewable = (file: R2FileLike) => getR2PreviewKind(file) !== 'unsupported';

export const getR2FileIcon = (file: R2FileLike) => {
  const ext = getR2FileExtension(file);
  const kind = getR2PreviewKind(file);

  if (kind === 'image') return { icon: 'fa-file-image', tone: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' };
  if (kind === 'video') return { icon: 'fa-file-video', tone: 'text-violet-500', bg: 'bg-violet-500/10' };
  if (kind === 'audio') return { icon: 'fa-file-audio', tone: 'text-pink-500', bg: 'bg-pink-500/10' };
  if (kind === 'pdf') return { icon: 'fa-file-pdf', tone: 'text-red-500', bg: 'bg-red-500/10' };
  if (kind === 'code') return { icon: 'fa-file-code', tone: 'text-sky-500', bg: 'bg-sky-500/10' };
  if (['zip', 'rar', '7z', 'gz', 'gzip', 'tar', 'bz2'].includes(ext)) {
    return { icon: 'fa-file-zipper', tone: 'text-amber-500', bg: 'bg-amber-500/10' };
  }
  if (['doc', 'docx', 'rtf'].includes(ext)) {
    return { icon: 'fa-file-word', tone: 'text-blue-500', bg: 'bg-blue-500/10' };
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return { icon: 'fa-file-excel', tone: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { icon: 'fa-file-powerpoint', tone: 'text-orange-500', bg: 'bg-orange-500/10' };
  }
  if (['sql', 'db', 'sqlite', 'sqlite3'].includes(ext)) {
    return { icon: 'fa-database', tone: 'text-cyan-500', bg: 'bg-cyan-500/10' };
  }
  if (kind === 'text') return { icon: 'fa-file-lines', tone: 'text-slate-500', bg: 'bg-slate-500/10' };

  return { icon: 'fa-file', tone: 'text-slate-400', bg: 'bg-slate-500/10' };
};

export const getR2LanguageLabel = (file: R2FileLike) => {
  const ext = getR2FileExtension(file);
  const labels: Record<string, string> = {
    js: 'JavaScript', jsx: 'JSX', mjs: 'JavaScript', cjs: 'JavaScript',
    ts: 'TypeScript', tsx: 'TSX', py: 'Python', rb: 'Ruby', php: 'PHP',
    go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', kts: 'Kotlin',
    swift: 'Swift', c: 'C', h: 'C', cc: 'C++', cpp: 'C++', cxx: 'C++',
    hpp: 'C++', cs: 'C#', sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    fish: 'Fish', ps1: 'PowerShell', bat: 'Batch', cmd: 'Batch',
    html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass',
    less: 'Less', json: 'JSON', jsonc: 'JSONC', yml: 'YAML', yaml: 'YAML',
    toml: 'TOML', ini: 'INI', conf: 'Config', config: 'Config', xml: 'XML',
    svg: 'SVG', sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL', vue: 'Vue',
    svelte: 'Svelte', md: 'Markdown', mdx: 'MDX', txt: 'Text', log: 'Log',
    csv: 'CSV', tsv: 'TSV', env: 'ENV', dockerfile: 'Dockerfile',
    makefile: 'Makefile', procfile: 'Procfile'
  };
  return labels[ext] || (ext ? ext.toUpperCase() : 'FILE');
};
