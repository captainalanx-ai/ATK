/* 数据看板 */
import { $, $$, esc, icon, num, md, relativeTime, cnDate } from '/shared/js/utils.js';
import { api } from '/shared/js/api.js';
import { toast, avatarHtml } from '/shared/js/ui.js';
import { donut, legendHtml, lineChart, hBar } from '/shared/js/charts.js';
import { stageColor, stageName, stageBadge, overdueBadge, percentColor } from '/shared/js/format.js';

function statCard(opts) {
  return `<div class="stat" style="--stat-c:${opts.color}">
    <div class="ico">${icon(opts.icon, 18)}</div>
    <div class="label">${esc(opts.label)}</div>
    <div class="value" style="color:${opts.valueColor ? opts.color : 'inherit'}">${esc(opts.value)}<span style="font-size:13px;font-weight:600;color:var(--text-3);margin-left:3px">${esc(opts.unit || '')}</span></div>
    <div class="sub">${esc(opts.sub || '')}</div>
  </div>`;
}

export async function render(host, ctx) {
  host.innerHTML = `<div class="skeleton" style="height:120px"></div>`;
  let s;
  try {
    s = await api.stats();
  } catch (e) {
    host.innerHTML = `<div class="card card-pad"><div class="t-danger">${esc(e.message)}</div></div>`;
    return;
  }
  const t = s.totals;
  const isMember = ctx.user.role === 'member';

  const cards = [
    { icon: 'users', label: isMember ? '我的档案' : '在培新人', value: num(t.members), unit: '人', color: '#4F46E5', sub: isMember ? '本人' : `已通关 ${t.graduated} 人 · 需关注 ${t.risk} 人` },
    { icon: 'check', label: '今日打卡率', value: `${t.todayRate}`, unit: '%', color: '#10B981', valueColor: true, sub: `今日 ${t.todayCheckins} 条打卡记录` },
    { icon: 'trend', label: '本周打卡', value: num(t.weekCheckins), unit: '次', color: '#0EA5E9', sub: `近 30 天 ${t.monthCheckins} 次` },
    { icon: 'inbox', label: '待点评', value: num(t.pendingReview), unit: '条', color: '#F59E0B', valueColor: true, sub: '领导人待处理的打卡' },
    { icon: 'flame', label: '打雾累计', value: num(t.mistTotal), unit: '人', color: '#EC4899', sub: `阶段目标合计 ${t.mistTarget} 人` },
    { icon: 'target', label: isMember ? '我的总进度' : '平均总进度', value: `${t.avgPercent}`, unit: '%', color: '#8B5CF6', valueColor: true, sub: '四阶段加权完成度' },
    { icon: 'alert', label: '逾期预警', value: num(s.overdue.length), unit: '人', color: '#EF4444', valueColor: true, sub: `${ctx.config.overdueDays || 2} 天以上未打卡` },
    { icon: 'award', label: '闯关通过', value: `${s.breakthrough.passed}`, unit: `/ ${s.breakthrough.total}`, color: '#14B8A6', sub: `待考核 ${s.breakthrough.pending} 项` }
  ];

  host.innerHTML = `
  <div class="dash-grid">${cards.map(statCard).join('')}</div>

  <div class="dash-main mt16">
    <div class="card">
      <div class="card-head">
        <h3>近 14 天打卡趋势</h3>
        <div class="row t-xs t-dim">
          <span class="legend-swatch" style="background:var(--brand)"></span> 打卡人次
          <span class="legend-swatch" style="background:var(--accent);margin-left:8px"></span> 打雾人数
        </div>
      </div>
      <div class="card-body">
        <div class="chart">${lineChart(s.trend.map((d) => ({ label: d.date, value: d.count })), { height: 210 })}</div>
        <div class="divider"></div>
        <div class="chart">${lineChart(s.trend.map((d) => ({ label: d.date, value: d.mist })), { height: 150, color: '#F59E0B' })}</div>
      </div>
    </div>

    <div class="col" style="gap:16px">
      <div class="card">
        <div class="card-head"><h3>阶段分布</h3><span class="t-xs t-dim">共 ${t.members} 人</span></div>
        <div class="card-body center" style="flex-direction:column;gap:14px">
          ${donut(s.byStage.map((b) => ({ label: `阶段${b.stage}`, value: b.count, color: b.color })), { centerLabel: '在培' })}
          ${legendHtml(s.byStage.map((b) => ({ label: `${b.name}`, value: b.count, color: b.color })))}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>四阶段培养路径</h3></div>
        <div class="card-body col" style="gap:10px">
          ${(ctx.config.stages || []).map((st) => {
    const b = s.byStage.find((x) => x.stage === st.id) || { count: 0 };
    return `<div class="row" style="gap:10px">
              <span class="badge" style="background:${st.color}1A;color:${st.color};border-color:transparent">${esc(st.short)}</span>
              <span class="grow t-sm t-bold truncate">${esc(st.name)}</span>
              <span class="t-sm t-num t-dim">${b.count} 人</span>
            </div>
            <div class="progress thin"><i style="width:${t.members ? (b.count / t.members) * 100 : 0}%;background:${st.color}"></i></div>`;
  }).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="dash-main mt16">
    <div class="card">
      <div class="card-head">
        <h3>${icon('flame', 15)} 连续打卡排行</h3>
        <span class="t-xs t-dim">Top 10</span>
      </div>
      <div class="card-body">
        ${hBar(s.leaderboard.slice(0, 10).map((m, i) => ({
    rank: i + 1,
    label: m.name,
    note: `阶段${m.stage} · 累计 ${m.checkinDays} 天 · 打雾 ${m.mistTotal} 人`,
    value: `${m.streak} 天`,
    percent: Math.min(100, m.streak * 10),
    color: percentColor(m.percent)
  })))}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>${icon('alert', 15)} 逾期预警</h3>
        <span class="badge ${s.overdue.length ? 'badge-danger' : 'badge-success'}">${s.overdue.length} 人</span>
      </div>
      <div class="card-body col" style="gap:10px;max-height:420px;overflow:auto">
        ${s.overdue.length ? s.overdue.map((m) => `
          <div class="row" style="gap:10px;padding:9px;border:1px solid var(--border);border-radius:var(--r-sm)">
            ${avatarHtml(m.name, '')}
            <div class="grow" style="min-width:0">
              <div class="row" style="gap:6px">
                <span class="t-sm t-bold">${esc(m.name)}</span>${stageBadge(m.stage)}
              </div>
              <div class="t-xs t-dim">${esc(m.leaderName || '未指定领导人')} · 上次 ${m.lastDate ? md(m.lastDate) : '无'}</div>
            </div>
            ${overdueBadge(m.overdueDays)}
            <button class="btn btn-soft btn-sm" data-goto="${m.id}">查看</button>
          </div>`).join('')
      : `<div class="t-sm t-dim center" style="padding:24px">${icon('check', 18)} 所有人都保持打卡，很好！</div>`}
      </div>
    </div>
  </div>

  <div class="dash-main mt16">
    <div class="card">
      <div class="card-head"><h3>${icon('flag', 15)} 闯关通过情况</h3></div>
      <div class="card-body col" style="gap:12px">
        ${s.breakthrough.byType.map((b) => `
          <div>
            <div class="row-between mb8">
              <span class="t-sm t-bold">${esc(b.name)}</span>
              <span class="t-sm t-dim t-num">${b.passed} / ${b.total} 通过</span>
            </div>
            <div class="progress"><i style="width:${b.total ? (b.passed / b.total) * 100 : 0}%;background:var(--success)"></i></div>
          </div>`).join('')}
        <div class="divider"></div>
        <div class="row wrap" style="gap:8px">
          <span class="badge badge-warn">待考核 ${s.breakthrough.pending}</span>
          <span class="badge badge-success">通过 ${s.breakthrough.passed}</span>
          <span class="badge badge-danger">未通过 ${s.breakthrough.failed}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>${icon('clock', 15)} 最近动态</h3></div>
      <div class="card-body">
        <div class="timeline">
          ${(s.logs || []).map((l) => `
            <div class="tl-item">
              <div class="row-between" style="gap:8px">
                <span class="t-sm t-bold">${esc(l.action)}</span>
                <span class="t-xs t-dim nowrap">${relativeTime(l.at)}</span>
              </div>
              <div class="t-xs t-dim">${esc(l.detail)} · ${esc(l.actor?.name || '系统')}</div>
            </div>`).join('') || '<div class="t-sm t-dim">暂无动态</div>'}
        </div>
      </div>
    </div>
  </div>`;

  $$('[data-goto]', host).forEach((b) => {
    b.onclick = () => ctx.go('members', b.dataset.goto);
  });
}
