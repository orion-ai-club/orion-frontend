import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Cpu,
  FileText,
  GitFork,
  Globe2,
  Layers3,
  Map,
  MoveUpRight,
  Radio,
  Terminal,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

type Project = {
  number: string;
  name: string;
  type: string;
  summary: string;
  tags: string[];
  href: string;
  art: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const projects = (zh: boolean): Project[] => [
  {
    number: '01',
    name: 'Remote Arc',
    type: zh ? 'AI · 设备执行层' : 'AI · DEVICE INFRASTRUCTURE',
    summary: zh
      ? '让 ChatGPT、Claude 和其他 AI 客户端真正操作你授权的电脑、浏览器和工作流。'
      : 'Give AI clients a secure way to do real work across your computers, browser and connected apps.',
    tags: ['Go', 'TypeScript', 'MCP', 'Cloudflare'],
    href: 'https://remotearc.app',
    art: 'arc',
    Icon: Radio,
  },
  {
    number: '02',
    name: 'Waybi',
    type: zh ? '出行 · 地图' : 'MOBILITY · MAPS',
    summary: zh
      ? '更聪明的日常导航，路线规划、道路提醒和出发前的信息，都在一个地方。'
      : 'An everyday navigation companion for routes, road awareness and a better start to every trip.',
    tags: ['Flutter', 'Maps', 'Routing'],
    href: 'https://github.com/yaohuangguan/Waybi',
    art: 'waybi',
    Icon: Map,
  },
  {
    number: '03',
    name: 'Orion',
    type: zh ? '个人系统 · 数字花园' : 'PERSONAL SYSTEM · DIGITAL GARDEN',
    summary: zh
      ? '你正在浏览的这个网站。写作、项目与私人知识系统，放在同一个属于自己的空间。'
      : 'The place you are in now. A digital garden for writing, projects and an evolving personal workspace.',
    tags: ['React', 'Vite', 'Cloudflare'],
    href: 'https://github.com/orion-ai-club/orion-frontend',
    art: 'orion',
    Icon: Layers3,
  },
  {
    number: '04',
    name: 'PDF Master',
    type: zh ? '生产力 · 文档工具' : 'PRODUCTIVITY · DOCUMENTS',
    summary: zh
      ? '专注实际操作的 PDF 工具：编辑、填写、合并与导出，也为 AI 操作留出接口。'
      : 'Practical PDF editing, filling, merging and exporting — designed to be usable by people and agents.',
    tags: ['PDF', 'Web', 'AI-ready'],
    href: 'https://github.com/yaohuangguan/pdf-master',
    art: 'pdf',
    Icon: FileText,
  },
];

const ProjectCard: React.FC<{ project: Project; openLabel: string }> = ({
  project,
  openLabel,
}) => {
  const Icon = project.Icon;

  const moveSpotlight = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spot-x', event.clientX - bounds.left + 'px');
    event.currentTarget.style.setProperty('--spot-y', event.clientY - bounds.top + 'px');
  };

  return (
    <a
      className={'sam-project-card sam-project-' + project.art}
      href={project.href}
      target="_blank"
      rel="noopener noreferrer"
      onPointerMove={moveSpotlight}
      aria-label={project.name + ' — ' + openLabel}
    >
      <div className="sam-project-card-top">
        <span className="sam-number">{project.number} / 04</span>
        <span className="sam-project-open" aria-hidden="true"><ArrowUpRight size={22} /></span>
      </div>

      <div className={'sam-project-art sam-art-' + project.art} aria-hidden="true">
        {project.art === 'arc' && (
          <div className="sam-arc-artwork">
            <span className="sam-arc-halo sam-arc-halo-one" />
            <span className="sam-arc-halo sam-arc-halo-two" />
            <span className="sam-arc-core"><Radio size={38} strokeWidth={1.3} /></span>
            <span className="sam-arc-satellite sam-satellite-one"><Terminal size={16} /></span>
            <span className="sam-arc-satellite sam-satellite-two"><Globe2 size={16} /></span>
            <span className="sam-arc-satellite sam-satellite-three"><Cpu size={16} /></span>
          </div>
        )}
        {project.art === 'waybi' && (
          <div className="sam-map-artwork">
            <span className="sam-map-line sam-map-line-one" />
            <span className="sam-map-line sam-map-line-two" />
            <span className="sam-map-marker sam-map-marker-a" />
            <span className="sam-map-marker sam-map-marker-b" />
            <span className="sam-map-route">WAYBI <ArrowUpRight size={16} /></span>
          </div>
        )}
        {project.art === 'orion' && (
          <div className="sam-orion-artwork">
            <span className="sam-orion-ring sam-orion-ring-one" />
            <span className="sam-orion-ring sam-orion-ring-two" />
            <span className="sam-orion-core">O<span>.</span></span>
          </div>
        )}
        {project.art === 'pdf' && (
          <div className="sam-pdf-artwork">
            <span className="sam-pdf-sheet sam-pdf-sheet-back" />
            <span className="sam-pdf-sheet sam-pdf-sheet-front">
              <span /><span /><span /><span />
              <FileText size={30} strokeWidth={1.2} />
            </span>
          </div>
        )}
      </div>

      <div className="sam-project-card-content">
        <div className="sam-project-type"><Icon size={14} strokeWidth={1.7} />{project.type}</div>
        <h3>{project.name}</h3>
        <p>{project.summary}</p>
        <div className="sam-project-tags">
          {project.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>
    </a>
  );
};

export const HomePage: React.FC = () => {
  const { language } = useTranslation();
  const zh = String(language).startsWith('zh');
  const work = projects(zh);
  const c = zh
    ? {
        eyebrow: '独立开发者 / 新西兰 · 奥克兰',
        lineOne: '不只写代码。',
        lineTwo: '也把想法',
        lineThree: '做成产品',
        introduction: '我是 Sam Yao，一名全栈工程师。我做 AI 基础设施、开发者工具和跨平台产品，也在这里记录一路上的思考。',
        primary: '看看我做的东西',
        secondary: '阅读技术日志',
        scroll: '向下探索',
        panel: '正在构建',
        panelTitle: '从想法到真正运行。',
        panelText: '想法、工程、发布、迭代。',
        panelStatus: '持续迭代中',
        sectionTag: '精选作品 / 2026',
        sectionTitle: '做出来，',
        sectionTitleAccent: '才能被使用。',
        sectionIntro: '不只是设计稿。这些是我实际动手开发和维护的产品。',
        open: '打开项目',
        allWork: '更多项目和经历',
        aboutTag: '一点自我介绍',
        aboutTitle: '喜欢构建，',
        aboutAccent: '也喜欢弄明白。',
        aboutIntro: '我关注产品能否真正解决问题，而不只是能否跑通 demo。从界面交互到 API、运行时、部署和运维，我喜欢把完整链路连起来。',
        aboutSecond: '目前在奥克兰，持续探索 AI 工具、开发者体验与跨平台软件。',
        focusTitle: '关注方向',
        focus: ['AI Agents & MCP', '全栈产品工程', '开发者基础设施', '跨平台应用'],
        journalTag: '正在记录',
        journalTitle: '把过程留下来。',
        journalText: '工程笔记、实践心得，以及那些值得再想一遍的问题。',
        journalCta: '打开 Journal',
        closing: '做有用的东西，慢慢打磨。',
      }
    : {
        eyebrow: 'INDEPENDENT BUILDER / AUCKLAND, NZ',
        lineOne: 'More than code.',
        lineTwo: 'Ideas made',
        lineThree: 'real',
        introduction: "I'm Sam Yao, a full-stack engineer building AI infrastructure, developer tools and cross-platform products. This is where I share what I'm making and learning.",
        primary: 'Explore selected work',
        secondary: 'Read the journal',
        scroll: 'SCROLL TO EXPLORE',
        panel: 'CURRENTLY BUILDING',
        panelTitle: 'From an idea to something running.',
        panelText: 'Think. Build. Ship. Improve.',
        panelStatus: 'WORK IN PROGRESS',
        sectionTag: 'SELECTED WORK / 2026',
        sectionTitle: 'Built to be',
        sectionTitleAccent: 'used.',
        sectionIntro: 'Not just mockups. A few products I actually build and maintain.',
        open: 'Open project',
        allWork: 'All projects & experience',
        aboutTag: 'A LITTLE ABOUT ME',
        aboutTitle: 'Curious by nature.',
        aboutAccent: 'Builder by choice.',
        aboutIntro: 'I care about whether software solves a real problem, not just whether a demo runs. I like connecting the entire journey — interaction, APIs, runtime, shipping and operations.',
        aboutSecond: "Based in Auckland. Exploring AI tooling, developer experience and cross-platform software.",
        focusTitle: 'AREAS OF FOCUS',
        focus: ['AI Agents & MCP', 'Full-stack product engineering', 'Developer infrastructure', 'Cross-platform applications'],
        journalTag: 'FIELD NOTES',
        journalTitle: 'The work behind the work.',
        journalText: 'Engineering notes, things I learned by doing, and ideas worth revisiting.',
        journalCta: 'Explore the journal',
        closing: 'Make useful things. Keep refining.',
      };

  return (
    <div className="sam-home" id="top">
      <section className="sam-hero" aria-labelledby="sam-hero-title">
        <div className="sam-hero-grid" aria-hidden="true" />
        <div className="sam-hero-inner">
          <div className="sam-hero-copy">
            <p className="sam-eyebrow"><span className="sam-live-dot" />{c.eyebrow}</p>
            <h1 id="sam-hero-title">
              <span>{c.lineOne}</span>
              <span>{c.lineTwo}</span>
              <span className="sam-hero-accent">{c.lineThree}<span className="sam-hero-period">{zh ? '。' : '.'}</span></span>
            </h1>
            <p className="sam-hero-description">{c.introduction}</p>
            <div className="sam-hero-actions">
              <a href="#selected-work" className="sam-button sam-button-primary">{c.primary}<ArrowUpRight size={19} /></a>
              <Link to="/blogs" className="sam-button sam-button-outline">{c.secondary}<ArrowRight size={19} /></Link>
            </div>
          </div>

          <div className="sam-hero-visual" aria-label={c.panelTitle}>
            <div className="sam-console">
              <div className="sam-console-header">
                <span><span className="sam-console-light" /> SAM / WORKSPACE</span>
                <span>2026 <Braces size={14} /></span>
              </div>
              <div className="sam-console-stage">
                <span className="sam-stage-grid" />
                <span className="sam-stage-ring sam-stage-ring-outer" />
                <span className="sam-stage-ring sam-stage-ring-inner" />
                <span className="sam-stage-line sam-stage-line-one" />
                <span className="sam-stage-line sam-stage-line-two" />
                <span className="sam-stage-node sam-stage-node-top">AI</span>
                <span className="sam-stage-node sam-stage-node-right">WEB</span>
                <span className="sam-stage-node sam-stage-node-bottom">CLOUD</span>
                <span className="sam-stage-node sam-stage-node-left">APP</span>
                <span className="sam-stage-core"><span>S<span className="sam-core-slash">/</span>Y</span><small>BUILD • SHIP • ITERATE</small></span>
              </div>
              <div className="sam-console-bottom">
                <div><span className="sam-console-caption">{c.panel}</span><strong>{c.panelTitle}</strong><span className="sam-console-subtitle">{c.panelText}</span></div>
                <span className="sam-console-running"><span />{c.panelStatus}</span>
              </div>
            </div>
            <span className="sam-visual-index">FIG. 01 — AN ENGINEER&apos;S WORKSPACE</span>
          </div>
        </div>

        <div className="sam-hero-footer">
          <span className="sam-scroll-text"><ArrowDownRight size={17} />{c.scroll}</span>
          <span>41°17′S / 174°46′E</span>
        </div>
      </section>

      <div className="sam-stack-strip" aria-label="Technology stack">
        <div className="sam-stack-inner">
          <span>REACT</span><i />
          <span>TYPESCRIPT</span><i />
          <span>GO</span><i />
          <span>NODE.JS</span><i />
          <span>CLOUDFLARE</span><i />
          <span>FLUTTER</span><i />
          <span>MCP</span>
        </div>
      </div>

      <section id="selected-work" className="sam-work-section sam-section" aria-labelledby="sam-work-title">
        <div className="sam-section-heading">
          <div>
            <span className="sam-section-kicker"><span>↗</span> {c.sectionTag}</span>
            <h2 id="sam-work-title">{c.sectionTitle} <em>{c.sectionTitleAccent}</em></h2>
          </div>
          <p>{c.sectionIntro}</p>
        </div>
        <div className="sam-project-grid">
          {work.map((project) => <ProjectCard key={project.name} project={project} openLabel={c.open} />)}
        </div>
        <div className="sam-section-end">
          <Link to="/profile" className="sam-text-link">{c.allWork}<MoveUpRight size={18} /></Link>
        </div>
      </section>

      <section className="sam-about-section sam-section" aria-labelledby="sam-about-title">
        <div className="sam-about-main">
          <span className="sam-section-kicker"><span>↗</span> {c.aboutTag}</span>
          <h2 id="sam-about-title">{c.aboutTitle}<br /><em>{c.aboutAccent}</em></h2>
          <p>{c.aboutIntro}</p>
          <p>{c.aboutSecond}</p>
          <Link to="/profile/experience" className="sam-text-link">{c.allWork}<MoveUpRight size={18} /></Link>
        </div>
        <div className="sam-focus-card">
          <div className="sam-focus-top"><span>01 / SAM YAO</span><span><Cpu size={19} /></span></div>
          <h3>{c.focusTitle}</h3>
          <div className="sam-focus-list">
            {c.focus.map((item, index) => (
              <div key={item}><span>0{index + 1}</span><strong>{item}</strong><ArrowUpRight size={17} /></div>
            ))}
          </div>
          <div className="sam-focus-footer"><span className="sam-live-dot" /> AUCKLAND, NEW ZEALAND</div>
        </div>
      </section>

      <section className="sam-journal-section sam-section" aria-labelledby="sam-journal-title">
        <span className="sam-section-kicker"><span>↗</span> {c.journalTag}</span>
        <div className="sam-journal-row">
          <div><h2 id="sam-journal-title">{c.journalTitle}</h2><p>{c.journalText}</p></div>
          <Link to="/blogs" className="sam-journal-arrow" aria-label={c.journalCta}><ArrowUpRight size={36} strokeWidth={1.5} /></Link>
        </div>
        <Link to="/blogs" className="sam-text-link">{c.journalCta}<ArrowRight size={18} /></Link>
      </section>

      <div className="sam-home-signoff">
        <span>© {new Date().getFullYear()} Sam Yao · {c.closing}</span>
        <div><a href="https://github.com/yaohuangguan" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><GitFork size={20} /></a><Link to="/profile" aria-label="Profile"><Globe2 size={20} /></Link></div>
      </div>
    </div>
  );
};
