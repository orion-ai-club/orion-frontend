import React, { useRef, useState, useEffect } from 'react';
// 假设你的图片上传工具在这里
import { uploadImage } from '../../services/media';
import { safeExternalUrl, sanitizeEditorHtml } from '../../utils/security';

interface ZenEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

// --- Constants ---
const FONT_FAMILIES = [
  { name: 'Default', value: 'ui-sans-serif, system-ui, sans-serif' },
  { name: 'Serif', value: 'ui-serif, Georgia, serif' },
  { name: 'Mono', value: 'ui-monospace, SFMono-Regular, monospace' },
  { name: 'Comic', value: '"Comic Sans MS", cursive' }
];

const FONT_SIZES = [
  { name: 'Small', value: '2' },
  { name: 'Normal', value: '3' },
  { name: 'Large', value: '5' },
  { name: 'Huge', value: '7' }
];

const EMOJIS = [
  '😀',
  '😂',
  '😍',
  '🤔',
  '😎',
  '😭',
  '😡',
  '👍',
  '👎',
  '🎉',
  '❤️',
  '🔥',
  '✅',
  '❌',
  '⭐'
];

// --- Helper: HTML Cleaner (源头治理核心) ---
const cleanPastedHTML = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. 移除垃圾元素 (Google/Gemini 复制带来的 UI 噪音)
  const garbageSelectors = [
    '.buttons', // 复制按钮容器
    'mat-icon', // Material Icons
    '.mat-mdc-button-touch-target',
    'svg', // 大部分内联 SVG 都是图标，文章里很少用
    'button', // 按钮
    'script', // 脚本
    'style' // 内联样式块
  ];

  garbageSelectors.forEach((selector) => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });

  // 2. 遍历所有元素清洗样式
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    if (el instanceof HTMLElement) {
      // A. 移除背景色 (彻底解决白底/黑底问题)
      el.style.removeProperty('background-color');
      el.style.removeProperty('background');

      // B. 智能处理字体颜色
      const color = el.style.color;
      if (color) {
        // 移除 Google 常用的深灰/纯黑，让编辑器主题接管颜色
        // 保留其他颜色（如红色、蓝色高亮）
        const isGarbageColor = [
          'rgb(31, 31, 31)',
          'rgb(68, 71, 70)',
          '#1f1f1f',
          '#202124',
          '#000000',
          'black'
        ].some((c) => color.includes(c) || color === c);

        if (isGarbageColor) {
          el.style.removeProperty('color');
        }
      }

      // C. 修复布局问题
      // 移除 margin-top: 0，防止段落粘连
      if (el.style.marginTop === '0px') {
        el.style.removeProperty('margin-top');
      }
      // 移除固定宽度，防止撑破移动端布局
      if (el.style.width || el.style.maxWidth) {
        el.style.removeProperty('width');
        el.style.removeProperty('max-width');
      }

      // D. 转换特殊的 Google Code Block
      if (el.tagName.toLowerCase() === 'code-block') {
        // 这里可以做更复杂的转换，目前保留标签但清除样式，靠 CSS 处理
        el.removeAttribute('style');
        el.classList.add('code-block-wrapper'); // 适配你的 CSS
      }
    }
  });

  return sanitizeEditorHtml(doc.body.innerHTML);
};

export const ZenEditor: React.FC<ZenEditorProps> = ({
  initialContent = '',
  onChange,
  placeholder = 'Start writing... (Type ``` for code block)'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);

  // Global state to track CSS loading across component remounts
  let isRemixIconLoaded = false;
  let loadingPromise: Promise<void> | null = null;

  // --- UI States ---
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isCssLoaded, setIsCssLoaded] = useState(isRemixIconLoaded);

  useEffect(() => {
    if (isRemixIconLoaded) {
      setIsCssLoaded(true);
      return;
    }

    if (!loadingPromise) {
      // ✅ Use dynamic import()
      // Only download when component mounts for the first time
      loadingPromise = import('remixicon/fonts/remixicon.css')
        .then(() => {
          isRemixIconLoaded = true;
        })
        .catch((err) => {
          console.error('Failed to load icons', err);
          loadingPromise = null; // Allow retry
        });
    }

    loadingPromise.then(() => {
      if (!isRemixIconLoaded) return; // Failed case
      setIsCssLoaded(true);
    });
  }, []);

  // Initialize
  useEffect(() => {
    // Only configure editor when CSS is loaded and ref is available
    if (isCssLoaded && editorRef.current && initialContent) {
      editorRef.current.innerHTML = sanitizeEditorHtml(initialContent);

      const checkHljs = setInterval(() => {
        if ((window as any).hljs) {
          highlightAllBlocks();
          clearInterval(checkHljs);
        }
      }, 500);

      return () => clearInterval(checkHljs);
    }
  }, [isCssLoaded]);

  // --- 高亮逻辑 ---
  const highlightAllBlocks = () => {
    const hljs = (window as any).hljs;
    if (!editorRef.current || !hljs) return;

    const blocks = editorRef.current.querySelectorAll('pre code');
    blocks.forEach((block) => {
      block.removeAttribute('data-highlighted');
      hljs.highlightElement(block as HTMLElement);
    });
  };

  // --- 插入代码块 ---
  const insertCodeBlock = () => {
    const html = `<pre class="code-block-wrapper" spellcheck="false"><code class="language-javascript">// Write code...</code></pre><p><br/></p>`;
    exec('insertHTML', html);
  };

  // --- Selection Core ---
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      if (editorRef.current && editorRef.current.contains(selection.anchorNode)) {
        savedRange.current = selection.getRangeAt(0).cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (savedRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    } else {
      editorRef.current?.focus();
    }
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    setTimeout(() => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleChange();
    }, 0);
    setActiveDropdown(null);
  };

  // --- Feature: Insert Video ---
  const confirmInsertVideo = () => {
    const safeUrl = safeExternalUrl(videoUrl);
    if (!safeUrl) {
      toast.error('Please enter a valid HTTPS video URL.');
      return;
    }

    const parsed = new URL(safeUrl);
    let embedUrl = safeUrl;

    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname)) {
      const videoId = parsed.searchParams.get('v');
      if (videoId && /^[\\w-]{11}$/.test(videoId)) {
        embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
    } else if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0];
      if (videoId && /^[\\w-]{11}$/.test(videoId)) {
        embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
    } else if (
      ['vimeo.com', 'www.vimeo.com'].includes(parsed.hostname) &&
      /^\\/\\d+$/.test(parsed.pathname)
    ) {
      embedUrl = `https://player.vimeo.com/video${parsed.pathname}`;
    }

    const html = sanitizeEditorHtml(`
      <div class="my-4 relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shadow-sm">
        <iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <p><br/></p>
    `);

    exec('insertHTML', html);
    setVideoUrl('');
    setShowVideoInput(false);
  };

  // --- Feature: Insert Table ---
  const insertTable = () => {
    const borderColor = isDark ? 'border-gray-600' : 'border-gray-300';
    const headerBg = isDark ? 'bg-gray-800' : 'bg-gray-100';

    const html = `
      <div class="overflow-x-auto my-4">
        <table class="min-w-full border-collapse border ${borderColor} text-sm">
          <thead>
            <tr class="${headerBg}">
              <th class="border ${borderColor} p-2 text-left">Header 1</th>
              <th class="border ${borderColor} p-2 text-left">Header 2</th>
              <th class="border ${borderColor} p-2 text-left">Header 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="border ${borderColor} p-2">Data 1</td>
              <td class="border ${borderColor} p-2">Data 2</td>
              <td class="border ${borderColor} p-2">Data 3</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p><br/></p>
    `;
    exec('insertHTML', html);
  };

  // --- Keyboard Handler ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const selection = window.getSelection();
    if (!selection?.anchorNode) return;

    let currentNode = selection.anchorNode;
    const parentBlock =
      currentNode.nodeType === 3 ? currentNode.parentElement : (currentNode as HTMLElement);
    const insideCodeBlock = parentBlock?.closest('pre');

    if (e.key === 'Tab') {
      e.preventDefault();
      if (insideCodeBlock) {
        document.execCommand('insertText', false, '  ');
      } else {
        exec('indent');
      }
    }

    if (e.key === 'Enter') {
      if (insideCodeBlock) {
        if (e.shiftKey) {
          e.preventDefault();
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          insideCodeBlock.after(p);
          const range = document.createRange();
          range.setStart(p, 0);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        e.preventDefault();
        const range = selection.getRangeAt(0);
        const brNode = document.createTextNode('\n');
        range.deleteContents();
        range.insertNode(brNode);
        range.setStartAfter(brNode);
        range.setEndAfter(brNode);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;

    const anchorNode = selection.anchorNode;
    const text = anchorNode.textContent || '';

    if ((e.nativeEvent as InputEvent).data === ' ') {
      if (/^#\s$/.test(text)) {
        exec('formatBlock', 'H1');
        deleteTrigger(selection, 2);
      } else if (/^##\s$/.test(text)) {
        exec('formatBlock', 'H2');
        deleteTrigger(selection, 3);
      } else if (/^-\s$/.test(text)) {
        exec('insertUnorderedList');
        deleteTrigger(selection, 2);
      } else if (/^1\.\s$/.test(text)) {
        exec('insertOrderedList');
        deleteTrigger(selection, 3);
      } else if (/^>\s$/.test(text)) {
        exec(
          'insertHTML',
          `<blockquote class="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} py-2 rounded-r">Quote</blockquote>`
        );
        deleteTrigger(selection, 2);
      } else if (/^```\s$/.test(text)) {
        deleteTrigger(selection, 4);
        insertCodeBlock();
      }
    }
    handleChange();
  };

  const deleteTrigger = (selection: Selection, len: number) => {
    const range = document.createRange();
    range.setStart(selection.anchorNode!, 0);
    range.setEnd(selection.anchorNode!, len);
    range.deleteContents();
  };

  // --- Image Logic (UPDATED) ---
  const processAndInsertImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsProcessing(true);
    try {
      // Use the unified uploadImage helper (handles R2 -> Cloudinary -> Base64 fallback)
      const imageUrl = await uploadImage(file, { folder: 'journal' });

      restoreSelection();
      const imgHtml = `<img src="${imageUrl}" class="max-w-full h-auto rounded-lg my-4 shadow-md hover:shadow-lg transition-shadow duration-300" />`;
      document.execCommand('insertHTML', false, imgHtml);
      handleChange();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAndInsertImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = () => {
    if (editorRef.current && onChange) onChange(editorRef.current.innerHTML);
    saveSelection();
  };

  // --- Handle Paste (Modified for Cleaning) ---
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // 1. 优先处理图片文件粘贴
    const items = e.clipboardData.items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processAndInsertImage(file);
          hasImage = true;
          break;
        }
      }
    }
    if (hasImage) return;

    // 2. 处理 HTML/Text 粘贴 (源头清洗)
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    if (htmlData) {
      e.preventDefault(); // 阻止浏览器默认的肮脏粘贴行为
      const cleanHTML = cleanPastedHTML(htmlData);
      document.execCommand('insertHTML', false, cleanHTML);
      handleChange();
    } else if (textData) {
      // 如果只有纯文本，让浏览器处理，或者手动插入纯文本
      // 这里不 preventDefault 通常可以，但为了统一体验，也可以手动处理
    }
  };

  // --- UI Sub-Components ---
  const ToolbarBtn = ({ icon, cmd, val, title, onMouseDown, isActive }: any) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        if (onMouseDown) onMouseDown(e);
        else if (cmd) exec(cmd, val);
      }}
      className={`p-1.5 rounded-md transition-all w-8 h-8 flex items-center justify-center
        ${
          isActive
            ? isDark
              ? 'bg-blue-900 text-blue-300'
              : 'bg-blue-100 text-blue-600'
            : isDark
              ? 'text-gray-300 hover:bg-gray-700'
              : 'text-gray-600 hover:bg-gray-100'
        }
      `}
      title={title}
      disabled={isProcessing}
    >
      <i className={icon}></i>
    </button>
  );

  const Divider = () => (
    <div className={`w-px h-5 mx-1 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
  );

  const containerClass = `flex flex-col border rounded-xl shadow-sm overflow-hidden h-full relative transition-colors duration-300
    ${isDark ? 'border-gray-700 bg-gray-900 zen-theme-dark' : 'border-gray-200 bg-white zen-theme-light'}
  `;

  const toolbarClass = `flex flex-wrap items-center gap-1 p-2 border-b select-none z-20
    ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}
  `;

  if (!isCssLoaded) {
    return <div>Loading Editor Resources...</div>; // 可选：加载中的占位符
  }

  return (
    <div className={containerClass}>
      {/* Loading Overlay */}
      {isProcessing && (
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm ${isDark ? 'bg-black/60' : 'bg-white/60'}`}
        >
          <i className="ri-loader-4-line text-3xl text-blue-500 animate-spin"></i>
        </div>
      )}

      {/* --- Toolbar --- */}
      <div className={toolbarClass}>
        <ToolbarBtn icon="ri-arrow-go-back-line" cmd="undo" />
        <ToolbarBtn icon="ri-arrow-go-forward-line" cmd="redo" />
        <Divider />
        <ToolbarBtn icon="ri-bold" cmd="bold" />
        <ToolbarBtn icon="ri-italic" cmd="italic" />
        <ToolbarBtn icon="ri-strikethrough" cmd="strikeThrough" />
        <ToolbarBtn icon="ri-underline" cmd="underline" />

        <Divider />

        {/* Font & Size */}
        <div className="flex gap-1">
          {/* Font Dropdown */}
          <div className="relative">
            <button
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors
                ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'}
              `}
              onMouseDown={(e) => {
                e.preventDefault();
                setActiveDropdown(activeDropdown === 'font' ? null : 'font');
              }}
            >
              Font <i className="ri-arrow-down-s-line"></i>
            </button>
            {activeDropdown === 'font' && (
              <div
                className={`absolute top-full left-0 mt-1 w-40 border shadow-xl rounded-md flex flex-col z-30 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}
              >
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font.name}
                    className={`text-left px-3 py-2 text-xs ${isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-800'}`}
                    style={{ fontFamily: font.value }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      exec('fontName', font.value);
                    }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Size Dropdown */}
          <div className="relative">
            <button
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors
                ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'}
              `}
              onMouseDown={(e) => {
                e.preventDefault();
                setActiveDropdown(activeDropdown === 'size' ? null : 'size');
              }}
            >
              Size <i className="ri-arrow-down-s-line"></i>
            </button>
            {activeDropdown === 'size' && (
              <div
                className={`absolute top-full left-0 mt-1 w-24 border shadow-xl rounded-md flex flex-col z-30 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}
              >
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.name}
                    className={`text-left px-3 py-2 text-xs ${isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-800'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      exec('fontSize', size.value);
                    }}
                  >
                    {size.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Divider />

        <ToolbarBtn icon="ri-list-unordered" cmd="insertUnorderedList" />
        <ToolbarBtn icon="ri-list-ordered" cmd="insertOrderedList" />
        <ToolbarBtn icon="ri-align-left" cmd="justifyLeft" />
        <ToolbarBtn icon="ri-align-center" cmd="justifyCenter" />

        <Divider />

        <div className="relative">
          <ToolbarBtn
            icon="ri-font-color"
            onMouseDown={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
          />
          {activeDropdown === 'color' && (
            <div
              className={`absolute top-full left-0 mt-1 p-2 border shadow-xl rounded-lg grid grid-cols-5 gap-1 z-30 w-40 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}
            >
              {[
                '#000000',
                '#4B5563',
                '#EF4444',
                '#F59E0B',
                '#10B981',
                '#3B82F6',
                '#6366F1',
                '#8B5CF6',
                '#FFFFFF'
              ].map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded-full border border-gray-100 hover:scale-110"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec('foreColor', color);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <ToolbarBtn
            icon="ri-emotion-line"
            onMouseDown={() => setActiveDropdown(activeDropdown === 'emoji' ? null : 'emoji')}
          />
          {activeDropdown === 'emoji' && (
            <div
              className={`absolute top-full left-0 mt-1 p-2 border shadow-xl rounded-lg grid grid-cols-5 gap-1 z-30 w-48 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec('insertText', emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        <ToolbarBtn icon="ri-table-2" title="Insert Table" onMouseDown={insertTable} />

        <ToolbarBtn
          icon="ri-code-box-line"
          title="Insert Code Block"
          onMouseDown={(e: any) => {
            e.preventDefault();
            insertCodeBlock();
          }}
        />

        <button
          className={`p-1.5 rounded relative w-8 h-8 flex items-center justify-center ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          title="Insert Image"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
            fileInputRef.current?.click();
          }}
        >
          <i className="ri-image-add-line"></i>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </button>

        <div className="relative">
          <ToolbarBtn
            icon="ri-video-add-line"
            title="Insert Video"
            isActive={showVideoInput}
            onMouseDown={() => {
              saveSelection();
              setShowVideoInput(!showVideoInput);
              setTimeout(() => document.getElementById('video-url-input')?.focus(), 50);
            }}
          />
          {showVideoInput && (
            <div
              className={`absolute top-full left-0 mt-2 p-3 border shadow-xl rounded-lg z-40 w-72 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}
            >
              <span
                className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Embed Video (YouTube/Vimeo)
              </span>
              <input
                id="video-url-input"
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className={`text-sm p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none w-full ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                onKeyDown={(e) => e.key === 'Enter' && confirmInsertVideo()}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowVideoInput(false)}
                  className={`text-xs px-2 py-1 rounded ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmInsertVideo}
                  className="text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded font-medium"
                >
                  Insert
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto">
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-1.5 rounded-full w-8 h-8 flex items-center justify-center transition-colors ${isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <i className={isDark ? 'ri-sun-line' : 'ri-moon-line'}></i>
          </button>
        </div>
      </div>

      {/* --- Editor Content --- */}
      <div
        ref={editorRef}
        className={`flex-1 p-6 outline-none overflow-y-auto prose max-w-none custom-scrollbar zen-editor-content ${
          isDark ? 'prose-invert text-gray-100' : 'text-gray-900'
        }`}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onPaste={handlePaste} // <--- 绑定我们新的 Paste Handler
        onBlur={() => {
          saveSelection();
          highlightAllBlocks();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const items = e.dataTransfer.items;
          let handled = false;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                  processAndInsertImage(file);
                  handled = true;
                  break;
                }
              }
            }
          }
          if (!handled && e.dataTransfer.files?.[0]) {
            processAndInsertImage(e.dataTransfer.files[0]);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        data-placeholder={placeholder}
      />

      <div
        className={`text-[10px] p-2 px-4 border-t flex justify-between items-center shrink-0 ${isDark ? 'bg-slate-950 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
      >
        <div className="flex gap-3">
          <span>CHARS: {editorRef.current?.textContent?.length || 0}</span>
        </div>
        <span
          className={`font-semibold tracking-wide ${isDark ? 'text-gray-600' : 'text-gray-300'}`}
        >
          ZEN EDITOR V3
        </span>
      </div>

      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        
        /* Scoped Editor Styles */
        .zen-editor-content table { width: 100%; text-align: left; margin-top: 1em; margin-bottom: 1em; }
        .zen-editor-content td, .zen-editor-content th { border: 1px solid #e5e7eb; padding: 0.5rem; }
        .zen-theme-dark .zen-editor-content td, .zen-theme-dark .zen-editor-content th { border-color: #374151; }
        
        .zen-editor-content { font-family: 'Inter', sans-serif; }
        
        img::selection { background: transparent; }
        
        /* Code Block Styling */
        .zen-theme-light .zen-editor-content pre,
        .zen-theme-light .zen-editor-content .code-block-wrapper {
            background-color: #f8fafc !important;
            color: #1e293b !important;
            border: 1px solid #e2e8f0;
        }
        
        .zen-theme-dark .zen-editor-content pre,
        .zen-theme-dark .zen-editor-content .code-block-wrapper {
            background-color: #282c34 !important;
            color: #abb2bf !important;
            border: 1px solid #374151;
        }

        .zen-editor-content pre { 
            white-space: pre-wrap; 
            word-wrap: break-word; 
            font-family: 'Fira Code', 'Roboto Mono', monospace;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
        }
        
        .zen-editor-content pre code {
            background-color: transparent !important;
            color: inherit !important;
            padding: 0 !important;
        }
        
        .hljs { background: transparent !important; padding: 0 !important; }
      `}</style>
    </div>
  );
};
