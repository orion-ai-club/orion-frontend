import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Fingerprint,
  FolderKanban,
  Heart,
  Lightbulb,
  Orbit,
  Plus,
  SlidersHorizontal,
  Sparkles,
  UserRound
} from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import type { BrainDashboard, BrainMemory } from '../../services/brainService';
const topics = [
  {
    key: 'instruction',
    cn: '相处方式',
    en: 'Instructions',
    icon: SlidersHorizontal,
    color: '#b45277'
  },
  { key: 'identity', cn: '关于我', en: 'Identity', icon: Fingerprint, color: '#6986b8' },
  { key: 'career', cn: '职业与学习', en: 'Career', icon: BriefcaseBusiness, color: '#a481b7' },
  { key: 'project', cn: '项目', en: 'Projects', icon: FolderKanban, color: '#b99255' },
  { key: 'preference', cn: '偏好', en: 'Preferences', icon: Heart, color: '#c57b86' },
  { key: 'decision', cn: '决定', en: 'Decisions', icon: Lightbulb, color: '#8c9a66' },
  { key: 'fact', cn: '知识', en: 'Facts', icon: BookOpen, color: '#639c96' },
  { key: 'other', cn: '其他', en: 'Other', icon: Sparkles, color: '#9293ab' }
];
export function KnowledgeOverview({
  dashboard,
  onFilter,
  onOpen,
  onNew
}: {
  dashboard: BrainDashboard | null;
  onFilter: (type: string) => void;
  onOpen: (memory: BrainMemory) => void;
  onNew: () => void;
}) {
  const { language } = useTranslation(),
    zh = language.startsWith('zh');
  const tr = (cn: string, en: string) => (zh ? cn : en);
  if (!dashboard)
    return (
      <p role="status" className="knowledge-loading">
        {tr('正在整理知识全景…', 'Loading your knowledge…')}
      </p>
    );
  const total = Object.values(dashboard.types).reduce((a, b) => a + b, 0);
  const active = topics.filter((t) => (dashboard.types[t.key] || 0) > 0);
  const visible = active.length ? active : topics.slice(0, 5);
  const points = visible.map((t, i) => {
    const angle = ((-90 + (i * 360) / visible.length) * Math.PI) / 180;
    return {
      ...t,
      x: 50 + 35 * Math.cos(angle),
      y: 50 + 34 * Math.sin(angle),
      count: dashboard.types[t.key] || 0
    };
  });
  const activity = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
    return { day, count: dashboard.activity.find((a) => a.day === day)?.count || 0 };
  });
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));
  return (
    <div className="knowledge-overview">
      <div className="knowledge-toolbar">
        <dl className="knowledge-summary">
          <div>
            <dt>{tr('知识', 'Memories')}</dt>
            <dd>{total}</dd>
          </div>
          <div>
            <dt>{tr('类别', 'Categories')}</dt>
            <dd>{active.length}</dd>
          </div>
          <div>
            <dt>{tr('来源', 'Sources')}</dt>
            <dd>{Object.values(dashboard.sources).reduce((a, b) => a + b, 0)}</dd>
          </div>
        </dl>
        <button className="knowledge-primary" onClick={onNew}>
          <Plus size={17} />
          {tr('新增记忆', 'New memory')}
        </button>
      </div>
      <div className="knowledge-overview-grid">
        <article className="knowledge-map-panel">
          <div className="knowledge-panel-heading">
            <div>
              <h3>{tr('知识分布', 'Knowledge map')}</h3>
              <p>{tr('按类别查看', 'Browse by category')}</p>
            </div>
            <Orbit size={21} />
          </div>
          <div
            className="knowledge-constellation"
            aria-label={tr('知识分类可视化', 'Knowledge by category')}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <ellipse cx="50" cy="50" rx="35" ry="34" className="knowledge-orbit" />
              <ellipse
                cx="50"
                cy="50"
                rx="22"
                ry="22"
                className="knowledge-orbit knowledge-orbit-inner"
              />
              {points.map((p) => (
                <line key={p.key} x1="50" y1="50" x2={p.x} y2={p.y} style={{ stroke: p.color }} />
              ))}
            </svg>
            <div className="knowledge-you">
              <UserRound size={25} />
              <strong>{total}</strong>
              <span>{tr('条知识', 'memories')}</span>
            </div>
            {points.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  className="knowledge-topic"
                  data-topic={p.key}
                  style={
                    {
                      left: p.x + '%',
                      top: p.y + '%',
                      '--topic-color': p.color
                    } as React.CSSProperties
                  }
                  aria-label={(zh ? p.cn : p.en) + ': ' + p.count}
                  onClick={() => onFilter(p.key)}
                >
                  <span className="knowledge-topic-icon">
                    <Icon size={20} />
                  </span>
                  <span>{zh ? p.cn : p.en}</span>
                  <strong>{p.count}</strong>
                </button>
              );
            })}
          </div>
          <div className="knowledge-map-footer">
            <span>
              {active.length} {tr('个知识类别', 'categories')}
            </span>
            <span>{tr('点击类别筛选', 'Select a category to filter')}</span>
          </div>
        </article>
        <div className="knowledge-side">
          <article className="knowledge-composition">
            <div className="knowledge-panel-heading">
              <h3>{tr('分类统计', 'Categories')}</h3>
              <span>
                {total} {tr('条', 'total')}
              </span>
            </div>
            <div className="knowledge-topic-bars">
              {visible.map((t) => (
                <button key={t.key} onClick={() => onFilter(t.key)}>
                  <span>{zh ? t.cn : t.en}</span>
                  <strong>{dashboard.types[t.key] || 0}</strong>
                  <i>
                    <span
                      style={{
                        width: (total ? ((dashboard.types[t.key] || 0) / total) * 100 : 0) + '%',
                        background: t.color
                      }}
                    />
                  </i>
                </button>
              ))}
            </div>
          </article>
          <article className="knowledge-activity">
            <div className="knowledge-panel-heading">
              <h3>{tr('更新记录', 'Activity')}</h3>
              <span>{tr('近 14 天', 'Last 14 days')}</span>
            </div>
            <div
              className="knowledge-sparkbars"
              role="img"
              aria-label={tr('近14天知识更新次数', 'Knowledge updates during the last 14 days')}
            >
              {activity.map((a) => (
                <div key={a.day} title={a.day + ' UTC · ' + a.count}>
                  <i
                    style={{
                      height: (a.count ? Math.max(8, (a.count / maxActivity) * 100) : 3) + '%'
                    }}
                  />
                  <span className="sr-only">
                    {a.day}: {a.count}
                  </span>
                </div>
              ))}
            </div>
            <p>
              {activity.reduce((a, b) => a + b.count, 0)}{' '}
              {tr('次新增与修订', 'additions and revisions')}
            </p>
          </article>
        </div>
      </div>
      <div className="knowledge-panel-heading knowledge-recent-title">
        <div>
          <h3>{tr('最近更新', 'Recently updated')}</h3>
        </div>
        <button onClick={() => onFilter('')}>
          {tr('全部知识', 'All memories')} <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="knowledge-recent-grid">
        {dashboard.recent.map((m) => {
          const t = topics.find((t) => t.key === m.type) || topics[7],
            Icon = t.icon;
          return (
            <button key={m._id} className="knowledge-recent-card" onClick={() => onOpen(m)}>
              <span className="knowledge-recent-type" style={{ color: t.color }}>
                <Icon size={16} />
                {zh ? t.cn : t.en}
                <span>v{m.revision}</span>
              </span>
              <p>{m.statement}</p>
              <small>
                {m.eventAt
                  ? new Date(m.eventAt).toLocaleDateString(language, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC'
                    })
                  : tr('日期未知', 'Date unknown')}
                <ArrowUpRight size={15} />
              </small>
            </button>
          );
        })}
        {!total && (
          <div className="knowledge-empty">
            <BookOpen size={25} />
            <p>{tr('暂无知识记录', 'No memories yet')}</p>
            <button onClick={onNew}>{tr('新增记忆', 'New memory')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
