/* 业务展示格式化：阶段、状态、徽标 */
import { esc, icon, cnDate, daysAgo, num } from './utils.js';

let CFG = null;
export function setConfig(cfg) { CFG = cfg; }
export function cfg() { return CFG || {}; }

export function stageMeta(id) {
  const s = (CFG?.stages || []).find((x) => x.id === Number(id));
  return s || { id: Number(id), name: `阶段${id}`, short: `阶段${id}`, color: '#6366F1' };
}
export function stageName(id) { return stageMeta(id).name; }
export function stageShort(id) { return stageMeta(id).short; }
export function stageColor(id) { return stageMeta(id).color; }

export function stageBadge(id) {
  const s = stageMeta(id);
  return `<span class="badge" style="background:${s.color}1A;color:${s.color};border-color:transparent">${esc(s.short)}</span>`;
}

const STATUS_MAP = {
  active: { name: '在培', cls: 'badge-success' },
  risk: { name: '需关注', cls: 'badge-warn' },
  paused: { name: '暂停', cls: '' },
  graduated: { name: '已通关', cls: 'badge-brand' }
};
export function statusBadge(status) {
  const s = STATUS_MAP[status] || { name: status || '未知', cls: '' };
  return `<span class="badge ${s.cls}">${esc(s.name)}</span>`;
}
export function statusName(status) { return (STATUS_MAP[status] || {}).name || status || '--'; }

/* ---------------------- 投入方式：全职 / 兼职 ---------------------- */
const EMP_FALLBACK = [
  { id: 'fulltime', name: '全职', short: '全职', color: '#4F46E5' },
  { id: 'parttime', name: '兼职', short: '兼职', color: '#F59E0B' }
];
const WEEK_FALLBACK = [
  { id: 1, name: '周一' }, { id: 2, name: '周二' }, { id: 3, name: '周三' },
  { id: 4, name: '周四' }, { id: 5, name: '周五' }, { id: 6, name: '周六' }, { id: 7, name: '周日' }
];
const SLOT_FALLBACK = [
  { id: 'am', name: '上午' }, { id: 'pm', name: '下午' }, { id: 'ev', name: '晚上' }
];

export function employmentMeta(id) {
  const list = CFG?.employmentTypes || EMP_FALLBACK;
  return list.find((x) => x.id === id) || { id: '', name: '未填', short: '未填', color: '#94A3B8' };
}
export function employmentName(id) { return employmentMeta(id).name; }
export function employmentBadge(id) {
  const t = employmentMeta(id);
  return `<span class="badge" style="background:${t.color}1A;color:${t.color};border-color:transparent">${esc(t.name)}</span>`;
}

/** 空闲时间一句话说明，例如「周一 晚上 · 周六 下午晚上」 */
export function availabilityText(av) {
  const slots = (av && av.slots) || {};
  const days = CFG?.weekDays || WEEK_FALLBACK;
  const ts = CFG?.timeSlots || SLOT_FALLBACK;
  const parts = [];
  for (const d of days) {
    const arr = slots[String(d.id)] || [];
    if (!arr.length) continue;
    const names = ts.filter((s) => arr.includes(s.id)).map((s) => s.name);
    parts.push(`${d.name} ${names.join('/')}`);
  }
  if (!parts.length) return '未登记空闲时间';
  const note = (av && av.note) ? `（${av.note}）` : '';
  return parts.join(' · ') + note;
}

/** 只读的每周空闲网格（详情里展示用） */
export function availabilityGridHtml(av) {
  const slots = (av && av.slots) || {};
  const days = CFG?.weekDays || WEEK_FALLBACK;
  const ts = CFG?.timeSlots || SLOT_FALLBACK;
  return `<div class="avail-grid">
    <div class="avail-row"><div class="avail-day"></div>${ts.map((s) => `<div class="avail-head">${esc(s.name)}</div>`).join('')}</div>
    ${days.map((d) => `<div class="avail-row">
      <div class="avail-day">${esc(d.name)}</div>
      ${ts.map((s) => {
        const on = (slots[String(d.id)] || []).includes(s.id);
        return `<div class="avail-cell ${on ? 'on' : ''}" style="pointer-events:none">${icon('check', 13)}</div>`;
      }).join('')}
    </div>`).join('')}
  </div>`;
}

const ROLE_MAP = { admin: '管理员', leader: '领导人', member: '新人' };
export function roleName(r) { return ROLE_MAP[r] || r; }
export function roleBadge(r) {
  const cls = r === 'admin' ? 'badge-danger' : r === 'leader' ? 'badge-warn' : 'badge-info';
  return `<span class="badge ${cls}">${roleName(r)}</span>`;
}

export function btStatusBadge(s) {
  if (s === 'passed') return '<span class="badge badge-success">通过</span>';
  if (s === 'failed') return '<span class="badge badge-danger">未通过</span>';
  return '<span class="badge badge-warn">待考核</span>';
}

export function scoreBadge(score) {
  if (score === null || score === undefined || score === '') return '<span class="t-dim t-sm">未评</span>';
  const n = Number(score);
  const cls = n >= 5 ? 'badge-success' : n >= 4 ? 'badge-brand' : n >= 3 ? 'badge-warn' : 'badge-danger';
  return `<span class="badge ${cls}">${n} 分</span>`;
}

export function overdueBadge(days) {
  if (days === null || days === undefined) return '<span class="badge">无记录</span>';
  if (days <= 0) return '<span class="badge badge-success">今日已打卡</span>';
  if (days === 1) return '<span class="badge badge-info">昨天打过</span>';
  return `<span class="badge badge-danger">${days} 天未打卡</span>`;
}

export function lastCheckinText(iso) {
  if (!iso) return '还没有打卡记录';
  const d = daysAgo(iso);
  if (d === 0) return '今天已打卡';
  if (d === 1) return '昨天打卡';
  return `${cnDate(iso)}（${d} 天前）`;
}

/** 打卡内容摘要 */
export function checkinSummary(c) {
  const bits = [];
  if (c.videoDone) bits.push(`视频：${c.videoTitle || '已完成'}`);
  if (Number(c.mistCount) > 0) bits.push(`打雾 ${c.mistCount} 人`);
  if (c.voiceDone) bits.push('语音会后会 ✓');
  return bits.join(' · ') || '未填写内容';
}

/** 阶段任务清单渲染 */
export function taskListHtml(tasks) {
  return `<div class="col" style="gap:8px">${tasks.map((t) => `
    <div class="check-row ${t.done ? 'checked' : ''}" style="cursor:default">
      <span class="check-box">${icon('check', 12, '')}</span>
      <span class="grow">
        <span class="check-label">${esc(t.label)}</span>
        ${t.hint ? `<span class="check-hint">${esc(t.hint)}</span>` : ''}
      </span>
      ${t.done ? '<span class="badge badge-success">达标</span>' : '<span class="badge">进行中</span>'}
    </div>`).join('')}</div>`;
}

/** 四阶段流水线 */
export function stagePipelineHtml(current) {
  const stages = CFG?.stages || [];
  const cur = Number(current) || 1;
  return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    ${stages.map((s, i) => {
    const done = s.id < cur, active = s.id === cur;
    return `<span style="display:inline-flex;align-items:center;gap:6px">
        <span class="badge" style="background:${done ? s.color + '22' : active ? s.color : 'var(--surface-2)'};
          color:${done || active ? s.color : 'var(--text-3)'};border-color:${active ? s.color : 'transparent'}">
          ${done ? '✓ ' : ''}${esc(s.short)}</span>
        ${i < stages.length - 1 ? `<span style="color:var(--border-strong)">›</span>` : ''}
      </span>`;
  }).join('')}</div>`;
}

export function percentColor(p) {
  const n = Number(p) || 0;
  if (n >= 80) return 'var(--success)';
  if (n >= 50) return 'var(--brand)';
  if (n >= 25) return 'var(--warning)';
  return 'var(--danger)';
}

export function numOrDash(n) { return n === null || n === undefined ? '--' : num(n); }
