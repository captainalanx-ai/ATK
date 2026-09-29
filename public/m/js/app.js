/* 手机端入口：登录 → 底部 Tab 外壳 → 四个页面 */
import { $, $$, esc, icon, num, md, cnDate, todayStr, relativeTime, debounce } from '/shared/js/utils.js';
import { api, store, setUnauthorizedHandler } from '/shared/js/api.js';
import { toast, modal, confirmDialog, emptyHtml, avatarHtml, ringHtml, progressHtml } from '/shared/js/ui.js';
import { donut, legendHtml, lineChart, hBar } from '/shared/js/charts.js';
import {
  setConfig, cfg, stageBadge, stageName, stageColor, statusBadge, stagePipelineHtml,
  taskListHtml, overdueBadge, lastCheckinText, checkinSummary, btStatusBadge, scoreBadge,
  percentColor, roleName, employmentBadge, availabilityText, availabilityGridHtml
} from '/shared/js/format.js';
import { checkinFormHtml, mountCheckinForm, readCheckinForm, reviewFormHtml, readReviewForm, memberFormHtml, mountMemberForm, readMemberForm } from '/shared/js/forms.js';

const state = {
  user: null,
  config: null,
  tab: 'home',
  theme: localStorage.getItem('atk_theme') || 'light'
};

const TABS_ALL = [
  { id: 'home', label: '首页', icon: 'dashboard' },
  { id: 'checkin', label: '打卡', icon: 'check' },
  { id: 'partners', label: '伙伴', icon: 'users' },
  { id: 'schedule', label: '排期', icon: 'clock', roles: ['admin', 'leader'] },
  { id: 'me', label: '我的', icon: 'user' }
];
/** 按角色过滤底部 Tab：排期只对管理员 / 领导人开放 */
function tabs() {
  const role = state.user && state.user.role;
  return TABS_ALL.filter((t) => !t.roles || (role && t.roles.includes(role)));
}

/* ------------------------------- 通用 ------------------------------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('atk_theme', state.theme);
}
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); }

function openSheet(title, html, onMount) {
  const wrap = document.createElement('div');
  wrap.className = 'm-sheet';
  wrap.innerHTML = `
    <div class="m-sheet-top">
      <button class="btn btn-ghost btn-icon" data-back>${icon('chevronLeft', 20)}</button>
      <h1 style="font-size:15.5px">${esc(title)}</h1>
    </div>
    <div class="m-sheet-body">${html}</div>`;
  document.body.appendChild(wrap);
  const close = () => {
    wrap.style.transition = 'transform .2s';
    wrap.style.transform = 'translateY(100%)';
    setTimeout(() => wrap.remove(), 220);
  };
  $('[data-back]', wrap).onclick = close;
  onMount && onMount($('.m-sheet-body', wrap), close);
  return { root: $('.m-sheet-body', wrap), close };
}

/* ------------------------------- 登录 ------------------------------- */
function renderLogin() {
  $('#app').innerHTML = `
  <div class="m-login">
    <div class="m-login-brand">
      <div class="brand-mark" style="width:46px;height:46px;font-size:17px">ATK</div>
      <div>
        <div style="font-size:18px;font-weight:750">ATK 工作室</div>
        <div class="t-xs t-dim">新人学习进度 · 手机端</div>
      </div>
    </div>
    <div class="big">每天进步一点点<br>都记得清清楚楚</div>
    <div class="t-sm t-dim">四阶段培养 · 每日打卡 · 闯关考核</div>

    <form class="col mt24" id="lf" style="gap:14px">
      <div class="field"><label>账号 / 手机号</label><input class="input" id="u" placeholder="admin 或 手机号" autocomplete="username"></div>
      <div class="field"><label>密码</label><input class="input" type="password" id="p" placeholder="请输入密码" autocomplete="current-password"></div>
      <button class="btn btn-primary m-btn-lg btn-block" type="submit" id="sb">登 录</button>
      <div id="err" class="t-sm t-danger center hide"></div>
    </form>

    <div class="mt24 t-xs t-dim mb8">演示账号（点击填入）</div>
    <div class="col" style="gap:8px">
      <div class="quick-account" data-a="admin"><span>${icon('shield', 14)} 管理员</span><span class="mono t-xs">admin / atk2026</span></div>
      <div class="quick-account" data-a="ken"><span>${icon('award', 14)} 领导人 Ken 哥</span><span class="mono t-xs">ken / atk2026</span></div>
      <div class="quick-account" data-a="m"><span>${icon('user', 14)} 新人 林晓雅</span><span class="mono t-xs">13800000011 / 123456</span></div>
    </div>

    <div class="row mt24" style="justify-content:center;gap:8px">
      <a class="btn btn-sm" href="/?v=web">${icon('monitor', 14)} 电脑版</a>
      <button class="btn btn-sm btn-ghost" id="th">${icon(state.theme === 'dark' ? 'sun' : 'moon', 14)} ${state.theme === 'dark' ? '浅色' : '深色'}</button>
    </div>
  </div>`;

  const fill = (u, p) => { $('#u').value = u; $('#p').value = p; };
  $$('[data-a]').forEach((el) => el.onclick = () => {
    if (el.dataset.a === 'admin') fill('admin', 'atk2026');
    if (el.dataset.a === 'ken') fill('ken', 'atk2026');
    if (el.dataset.a === 'm') fill('13800000011', '123456');
  });
  $('#th').onclick = toggleTheme;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#sb'), err = $('#err');
    err.classList.add('hide');
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      const res = await api.login($('#u').value.trim(), $('#p').value);
      store.token = res.token; store.user = res.user; state.user = res.user;
      const me = await api.me();
      state.config = me.config;
      window.__ATK_CONFIG__ = me.config;
      setConfig(me.config);
      renderShell();
      toast(`欢迎，${res.user.name}`, 'ok');
    } catch (e2) {
      err.textContent = e2.message; err.classList.remove('hide');
      btn.disabled = false; btn.textContent = '登 录';
    }
  };
}

/* -------------------------------- 外壳 -------------------------------- */
function renderShell() {
  const u = state.user;
  $('#app').innerHTML = `
  <div class="m-app">
    <div class="m-top">
      <h1 id="mt">${esc((tabs().find((t) => t.id === state.tab) || tabs()[0]).label)}</h1>
      <div class="spacer"></div>
      <button class="btn btn-ghost btn-icon" id="mth">${icon(state.theme === 'dark' ? 'sun' : 'moon', 18)}</button>
      <button class="btn btn-ghost btn-icon" id="mre">${icon('refresh', 18)}</button>
    </div>
    <div class="m-body" id="mb"><div class="skeleton" style="height:120px"></div></div>
  </div>
  <nav class="m-tabs">
    ${tabs().map((t) => `<div class="m-tab ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">
      ${icon(t.icon, 21)}<span>${t.label}</span></div>`).join('')}
  </nav>`;

  $$('.m-tab').forEach((el) => {
    el.onclick = () => { state.tab = el.dataset.tab; renderShell(); };
  });
  $('#mth').onclick = () => { toggleTheme(); renderShell(); };
  $('#mre').onclick = () => { renderShell(); toast('已刷新', 'info', 1000); };

  const body = $('#mb');
  const renderers = { home: renderHome, checkin: renderCheckin, partners: renderPartners, schedule: renderSchedule, me: renderMe };
  (renderers[state.tab] || renderHome)(body).catch((e) => {
    body.innerHTML = `<div class="m-card"><div class="t-danger">${esc(e.message)}</div></div>`;
  });
}

/* -------------------------------- 首页 -------------------------------- */
async function renderHome(host) {
  const role = state.user.role;
  const [today, stats] = await Promise.all([api.myToday(), api.stats()]);
  const t = stats.totals;

  if (role === 'member') {
    const m = today.member;
    const p = today.progress;
    const st = p.stats || {};
    const done = !!today.todayCheckin;
    host.innerHTML = `
      <div class="m-hero">
        <div class="h-title">${done ? '今日已打卡 🎉' : '今天还没打卡'}</div>
        <div class="h-value">${done ? `连续 ${st.streak || 0} 天` : '去打卡'}</div>
        <div class="h-sub">${esc(lastCheckinText(st.lastDate))}</div>
        <button class="btn btn-block mt12 m-btn-lg" id="go-checkin">${icon(done ? 'edit' : 'check', 17)} ${done ? '修改今日打卡' : '立即打卡'}</button>
      </div>

      <div class="m-card">
        <div class="row" style="gap:14px;align-items:flex-start">
          ${ringHtml(p.overallPercent, { size: 84, color: percentColor(p.overallPercent) })}
          <div class="grow">
            <div class="row wrap" style="gap:6px">${stageBadge(m.stage)} ${statusBadge(m.status)}</div>
            <div class="t-md t-bold mt8">${esc(stageName(m.stage))}</div>
            <div class="t-xs t-dim">阶段完成度 ${p.stagePercent}%</div>
            <div class="mt8">${progressHtml(p.stagePercent, stageColor(m.stage))}</div>
          </div>
        </div>
        <div class="divider"></div>
        ${stagePipelineHtml(m.stage)}
      </div>

      <div class="m-grid4">
        <div class="m-cell"><div class="v">${st.checkinDays || 0}</div><div class="l">打卡天数</div></div>
        <div class="m-cell"><div class="v">${st.streak || 0}</div><div class="l">连续(天)</div></div>
        <div class="m-cell"><div class="v">${st.videoTotal || 0}</div><div class="l">视频(个)</div></div>
        <div class="m-cell"><div class="v">${st.mistTotal || 0}</div><div class="l">打雾(人)</div></div>
      </div>

      <div class="m-card">
        <div class="m-title"><h3>${esc(stageName(m.stage))} · 任务清单</h3>
          <span class="badge ${p.stagePercent >= 100 ? 'badge-success' : 'badge-warn'}">${p.stagePercent}%</span></div>
        ${taskListHtml(p.tasks)}
      </div>

      <div class="m-card">
        <div class="m-title"><h3>${icon('flame', 14)} 团队连续打卡榜</h3></div>
        ${hBar(stats.leaderboard.slice(0, 6).map((x, i) => ({
    rank: i + 1, label: x.name, note: `阶段${x.stage}`, value: `${x.streak} 天`,
    percent: Math.min(100, x.streak * 10), color: percentColor(x.percent)
  })))}
      </div>`;
    $('#go-checkin', host).onclick = () => { state.tab = 'checkin'; renderShell(); };
    return;
  }

  // 领导人 / 管理员
  host.innerHTML = `
    <div class="m-hero">
      <div class="h-title">今日团队打卡</div>
      <div class="h-value">${t.todayRate}%</div>
      <div class="h-sub">${today.checkedIds ? today.checkedIds.length : 0} / ${today.memberCount || t.members} 人已打卡 · 共 ${t.todayCheckins} 条记录</div>
      <div class="mt12" style="height:6px;border-radius:99px;background:rgba(255,255,255,.25);overflow:hidden">
        <div style="height:100%;width:${t.todayRate}%;background:#fff;border-radius:99px"></div>
      </div>
    </div>

    <div class="m-grid4">
      <div class="m-cell"><div class="v">${num(t.members)}</div><div class="l">在培</div></div>
      <div class="m-cell"><div class="v">${num(t.weekCheckins)}</div><div class="l">本周打卡</div></div>
      <div class="m-cell"><div class="v" style="color:var(--warning)">${num(t.pendingReview)}</div><div class="l">待点评</div></div>
      <div class="m-cell"><div class="v" style="color:var(--danger)">${num(stats.overdue.length)}</div><div class="l">逾期</div></div>
    </div>

    <div class="m-card">
      <div class="m-title"><h3>近 14 天打卡趋势</h3></div>
      <div class="chart">${lineChart(stats.trend.map((d) => ({ label: d.date, value: d.count })), { height: 150 })}</div>
    </div>

    <div class="m-card">
      <div class="m-title"><h3>阶段分布</h3><span class="t-xs t-dim">${t.members} 人</span></div>
      <div class="row" style="gap:16px;align-items:center">
        ${donut(stats.byStage.map((b) => ({ label: `阶段${b.stage}`, value: b.count, color: b.color })), { size: 130, thickness: 18 })}
        <div class="grow">${legendHtml(stats.byStage.map((b) => ({ label: stageName(b.stage), value: b.count, color: b.color })))}</div>
      </div>
    </div>

    <div class="m-card">
      <div class="m-title"><h3>${icon('alert', 14)} 逾期预警</h3>
        <span class="badge ${stats.overdue.length ? 'badge-danger' : 'badge-success'}">${stats.overdue.length} 人</span></div>
      ${stats.overdue.length ? stats.overdue.map((o) => `
        <div class="m-item">
          ${avatarHtml(o.name, 'avatar-sm')}
          <div class="grow">
            <div class="row" style="gap:6px"><span class="t-sm t-bold">${esc(o.name)}</span>${stageBadge(o.stage)}</div>
            <div class="t-xs t-dim">上次 ${o.lastDate ? md(o.lastDate) : '无'}</div>
          </div>
          ${overdueBadge(o.overdueDays)}
        </div>`).join('') : `<div class="t-sm t-dim center" style="padding:14px">全员保持打卡 👏</div>`}
    </div>

    <div class="m-card">
      <div class="m-title"><h3>${icon('trophy', 14)} 连续打卡榜</h3></div>
      ${hBar(stats.leaderboard.slice(0, 8).map((x, i) => ({
    rank: i + 1, label: x.name, note: `阶段${x.stage} · 打雾 ${x.mistTotal} 人`,
    value: `${x.streak} 天`, percent: Math.min(100, x.streak * 10), color: percentColor(x.percent)
  })))}
    </div>`;
}

/* -------------------------------- 打卡 -------------------------------- */
async function renderCheckin(host) {
  const role = state.user.role;
  if (role === 'member') {
    const today = await api.myToday();
    const m = today.member;
    const rec = today.todayCheckin;
    host.innerHTML = `
      <div class="m-card">
        <div class="m-title"><h3>${icon('calendar', 14)} ${cnDate(todayStr())} · 今日打卡</h3>
          ${rec ? '<span class="badge badge-success">已提交</span>' : '<span class="badge badge-warn">未提交</span>'}</div>
        <div id="cform">${checkinFormHtml({ config: state.config, stage: m.stage, record: rec })}</div>
        <button class="btn btn-primary btn-block m-btn-lg mt12" id="submit">${icon('check', 17)} ${rec ? '更新今日打卡' : '提交打卡'}</button>
      </div>
      <div class="m-card">
        <div class="m-title"><h3>我的打卡记录</h3></div>
        <div id="mine"><div class="skeleton" style="height:60px"></div></div>
      </div>`;
    mountCheckinForm($('#cform', host), {});
    $('#submit', host).onclick = async () => {
      try {
        await api.createCheckin({ ...readCheckinForm($('#cform', host)), memberId: m.id });
        toast('打卡已提交', 'ok');
        renderShell();
      } catch (e) { toast(e.message, 'err'); }
    };
    const res = await api.checkins({ memberId: m.id, pageSize: 30 });
    $('#mine', host).innerHTML = res.items.length ? res.items.map((c) => `
      <div class="m-item">
        <div class="grow">
          <div class="row" style="gap:6px"><span class="t-sm t-bold">${md(c.date)}</span>${stageBadge(c.stage)}
            ${c.score ? scoreBadge(c.score) : (c.reviewed ? '' : '<span class="badge badge-warn">待点评</span>')}</div>
          <div class="t-xs t-dim clamp2">${esc(checkinSummary(c))}</div>
        </div>
        <button class="btn btn-sm" data-view="${c.id}">详情</button>
      </div>`).join('') : emptyHtml('还没有打卡记录');
    $$('[data-view]', host).forEach((b) => b.onclick = () => viewCheckin(b.dataset.view));
    return;
  }

  // 领导人 / 管理员
  const members = await api.members({ pageSize: 200 });
  const list = members.items;
  host.innerHTML = `
    <div class="m-card">
      <div class="m-title"><h3>选择新人</h3></div>
      <select class="select" id="sel">
        ${list.map((m) => `<option value="${m.id}">${esc(m.name)}${m.phone ? ` · ${esc(m.phone)}` : ''}（${esc(stageName(m.stage))}）</option>`).join('')}
      </select>
      <div class="row mt12" style="gap:8px">
        <button class="btn btn-primary grow" id="add">${icon('plus', 15)} 补录打卡</button>
        <label class="row t-sm" style="gap:6px;cursor:pointer;flex:none">
          <span class="switch" id="pend"></span> 待点评
        </label>
      </div>
    </div>
    <div class="m-card"><div class="m-title"><h3>打卡记录</h3></div><div id="list"></div></div>`;

  let onlyPending = false;
  const load = async () => {
    const mid = $('#sel', host).value;
    const res = await api.checkins({ memberId: mid, pageSize: 40, pending: onlyPending ? 1 : '' });
    $('#list', host).innerHTML = res.items.length ? res.items.map((c) => `
      <div class="m-item">
        <div class="grow">
          <div class="row" style="gap:6px"><span class="t-sm t-bold">${md(c.date)}</span>${stageBadge(c.stage)}
            ${c.reviewed ? scoreBadge(c.score) : '<span class="badge badge-warn">待点评</span>'}</div>
          <div class="t-xs t-dim clamp2">${esc(checkinSummary(c))}</div>
        </div>
        <button class="btn btn-sm" data-rev="${c.id}">${c.reviewed ? '查看' : '点评'}</button>
      </div>`).join('') : emptyHtml('暂无记录');
    $$('[data-rev]', host).forEach((b) => b.onclick = () => reviewSheet(b.dataset.rev, load));
  };
  $('#sel', host).onchange = load;
  $('#pend', host).onclick = (e) => { onlyPending = !onlyPending; e.target.classList.toggle('on', onlyPending); load(); };
  $('#add', host).onclick = () => {
    const mid = $('#sel', host).value;
    const m = list.find((x) => x.id === mid);
    if (!m) return;
    openSheet(`${m.name} · 补录打卡`, `<div id="cf">${checkinFormHtml({ config: state.config, stage: m.stage })}</div>
      <button class="btn btn-primary btn-block m-btn-lg mt12" id="s2">${icon('check', 17)} 提交</button>`,
    (root, close) => {
      mountCheckinForm($('#cf', root), {});
      $('#s2', root).onclick = async () => {
        try {
          await api.createCheckin({ ...readCheckinForm($('#cf', root)), memberId: m.id });
          toast('已提交', 'ok'); close(); load();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  };
  await load();
}

function viewCheckin(id) {
  api.checkins({ pageSize: 300 }).then((res) => {
    const c = res.items.find((x) => x.id === id);
    if (!c) return toast('记录不存在', 'err');
    openSheet(`打卡详情 · ${md(c.date)}`, `
      <div class="m-card">
        <div class="row wrap" style="gap:6px">${stageBadge(c.stage)}
          ${c.dayIndex ? `<span class="badge">Day${c.dayIndex} ${esc(c.dayTopic || '')}</span>` : ''}
          ${scoreBadge(c.score)}</div>
        <div class="divider"></div>
        <dl class="kv">
          <dt>视频</dt><dd>${c.videoDone ? esc(c.videoTitle || '已完成') : '未看'}</dd>
          <dt>打雾</dt><dd>${c.mistCount || 0} 人</dd>
          <dt>会后会</dt><dd>${c.voiceDone ? '已反馈' : '未反馈'}</dd>
          <dt>时长</dt><dd>${c.minutes || 0} 分钟</dd>
        </dl>
        ${Array.isArray(c.mistList) && c.mistList.length ? `<div class="divider"></div>
          <div class="t-sm t-bold mb8">打雾嘉宾</div>
          ${c.mistList.map((g) => `<div class="row" style="gap:6px;padding:5px 0">
            <span class="badge">${esc(g.name)}</span><span class="badge badge-warn">${g.star} 星</span>
            <span class="t-xs t-dim grow">${esc(g.note || '')}</span></div>`).join('')}` : ''}
        ${c.voiceSummary ? `<div class="divider"></div><div class="t-sm t-bold mb8">会后会总结</div>
          <div class="t-sm" style="padding:10px;background:var(--surface-2);border-radius:var(--r-sm)">${esc(c.voiceSummary)}</div>` : ''}
        ${c.mistLearned ? `<div class="t-sm t-bold mt12 mb8">打雾收获</div><div class="t-sm">${esc(c.mistLearned)}</div>` : ''}
        ${c.learned ? `<div class="t-sm t-bold mt12 mb8">今日心得</div><div class="t-sm">${esc(c.learned)}</div>` : ''}
        ${c.review ? `<div class="divider"></div><div class="t-sm t-bold mb8">领导人点评（${esc(c.reviewer || '')}）</div>
          <div class="t-sm" style="padding:10px;background:var(--brand-50);color:var(--brand);border-radius:var(--r-sm)">${esc(c.review)}</div>` : ''}
      </div>`);
  });
}

function reviewSheet(id, onDone) {
  api.checkins({ pageSize: 300 }).then((res) => {
    const c = res.items.find((x) => x.id === id);
    if (!c) return toast('记录不存在', 'err');
    openSheet(`点评 · ${c.memberName} ${md(c.date)}`, `
      <div class="m-card">
        <div class="t-sm t-muted" style="line-height:1.7">${esc(checkinSummary(c))}
          ${c.voiceSummary ? `<br>🎙 ${esc(c.voiceSummary)}` : ''}
          ${c.mistLearned ? `<br>打雾收获：${esc(c.mistLearned)}` : ''}</div>
      </div>
      <div class="m-card" id="rf">${reviewFormHtml({ ...c, reviewer: c.reviewer || state.user.name })}</div>
      <button class="btn btn-primary btn-block m-btn-lg" id="rs">${icon('save', 17)} 保存点评</button>`,
    (root, close) => {
      $('#rs', root).onclick = async () => {
        try {
          await api.updateCheckin(id, readReviewForm($('#rf', root)));
          toast('点评已保存', 'ok'); close(); onDone && onDone();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  });
}

/* -------------------------------- 伙伴 -------------------------------- */
async function renderPartners(host) {
  const res = await api.members({ pageSize: 100, sort: 'progress' });
  let stageFilter = '';
  let q = '';

  const paint = () => {
    const items = res.items.filter((m) => (!stageFilter || String(m.stage) === stageFilter))
      .filter((m) => !q || (m.name + (m.phone || '')).toLowerCase().includes(q.toLowerCase()));
    host.innerHTML = `
      <div class="m-card">
        <div class="search-box" style="position:relative">
          ${icon('search', 15)}
          <input class="input" id="q" placeholder="搜索姓名 / 手机号" value="${esc(q)}" style="padding-left:34px">
        </div>
        <div class="m-chips mt12">
          <div class="m-chip ${stageFilter === '' ? 'on' : ''}" data-s="">全部</div>
          ${(state.config.stages || []).map((s) => `<div class="m-chip ${stageFilter == s.id ? 'on' : ''}" data-s="${s.id}">${esc(s.short)}</div>`).join('')}
        </div>
      </div>
      ${items.length ? items.map(cardHtml).join('') : `<div class="m-card">${emptyHtml('没有找到伙伴')}</div>`}`;
    const qi = $('#q', host);
    qi.oninput = debounce((e) => { q = e.target.value.trim(); paint(); $('#q', host).focus(); }, 260);
    $$('[data-s]', host).forEach((el) => el.onclick = () => { stageFilter = el.dataset.s; paint(); });
    $$('[data-open]', host).forEach((el) => el.onclick = () => openMemberSheet(el.dataset.open));
  };

  const cardHtml = (m) => {
    const p = m.progress || {};
    const st = p.stats || {};
    return `<div class="m-card card-hover" data-open="${m.id}">
      <div class="row" style="gap:11px">
        ${avatarHtml(m.name, 'avatar-lg')}
        <div class="grow" style="min-width:0">
          <div class="row" style="gap:6px"><span class="t-md t-bold">${esc(m.name)}</span>${stageBadge(m.stage)} ${statusBadge(m.status)} ${employmentBadge(m.employmentType)}</div>
          <div class="t-xs t-dim truncate">${esc(m.phone || '未填手机')} · ${esc(m.leaderName || '未指定领导人')}</div>
          <div class="mt8">${progressHtml(p.overallPercent, percentColor(p.overallPercent))}</div>
        </div>
        <div style="text-align:right">
          <div class="t-lg t-bold t-num" style="color:${percentColor(p.overallPercent)}">${p.overallPercent}%</div>
          <div class="t-xs t-dim">总进度</div>
        </div>
      </div>
      <div class="row wrap mt12" style="gap:6px">
        <span class="badge">连续 ${st.streak || 0} 天</span>
        <span class="badge">打卡 ${st.checkinDays || 0} 天</span>
        <span class="badge">打雾 ${st.mistTotal || 0} 人</span>
        ${st.overdueDays >= (state.config.overdueDays || 2) ? overdueBadge(st.overdueDays) : '<span class="badge badge-success">今日已打卡</span>'}
      </div>
      <div class="t-xs t-dim mt8" style="line-height:1.5">${icon('clock', 12)} ${esc(availabilityText(m.availability))}</div>
    </div>`;
  };
  paint();
}

/* ------------------------------ 排期（空闲时间） ------------------------------ */
async function renderSchedule(host) {
  const d = await api.availability({});
  host.innerHTML = `
    <div class="m-card">
      <div class="m-title"><h3>空闲时间排期</h3></div>
      <div class="row wrap" style="gap:6px">
        <span class="badge badge-brand">全职 ${d.counts.fulltime} 人</span>
        <span class="badge badge-warn">兼职 ${d.counts.parttime} 人</span>
        ${d.counts.unknown ? `<span class="badge">未登记 ${d.counts.unknown} 人</span>` : ''}
      </div>
      <div class="t-xs t-dim mt8">数字＝该时段有空的人数，点一下看名单</div>
    </div>

    <div class="m-card">
      <div class="m-title"><h3>推荐安排时段</h3></div>
      ${d.best.length ? d.best.slice(0, 4).map((b) => `<div class="row" style="gap:8px;padding:7px 0;border-bottom:1px dashed var(--border)">
        <span class="badge badge-brand">${esc(b.dayName)} ${esc(b.slotName)}</span>
        <span class="t-xs t-dim grow truncate">${b.members.map((m) => esc(m.name)).join('、')}</span>
        <span class="t-sm t-bold t-num">${b.count} 人</span></div>`).join('')
      : '<div class="t-sm t-dim">暂时没有 2 人以上的共同空闲时段</div>'}
    </div>

    ${(d.days || []).map((day) => `<div class="m-card">
      <div class="m-title"><h3>${esc(day.name)}</h3></div>
      <div class="row" style="gap:6px">
        ${(d.slots || []).map((s) => {
          const cell = ((d.grid || {})[day.id] || {})[s.id] || [];
          return `<div class="m-chip ${cell.length ? 'on' : ''}" data-day="${day.id}" data-slot="${s.id}" style="flex:1;text-align:center">${esc(s.name)} ${cell.length} 人</div>`;
        }).join('')}
      </div>
    </div>`).join('')}

    ${d.noAvailability && d.noAvailability.length ? `<div class="m-card">
      <div class="m-title"><h3>还没登记空闲时间</h3></div>
      <div class="t-xs t-dim">${d.noAvailability.map((m) => esc(m.name)).join('、')}</div>
    </div>` : ''}`;

  $$('[data-day]', host).forEach((el) => {
    el.onclick = () => {
      const day = (d.days || []).find((x) => String(x.id) === String(el.dataset.day));
      const slot = (d.slots || []).find((x) => String(x.id) === String(el.dataset.slot));
      const members = ((d.grid || {})[el.dataset.day] || {})[el.dataset.slot] || [];
      modal({
        title: `${day ? day.name : ''} ${slot ? slot.name : ''} ${slot ? slot.time : ''}`,
        body: members.length
          ? `<div class="t-xs t-dim mb8">${members.length} 位新人有空，适合安排集体学习 / 集体打雾</div>
             ${members.map((m) => `<div class="row" style="gap:6px;padding:6px 0;border-bottom:1px dashed var(--border)">
               <span class="t-sm t-bold">${esc(m.name)}</span>${stageBadge(m.stage)} ${employmentBadge(m.employmentType)}</div>`).join('')}`
          : emptyHtml('没有人登记这个时段'),
        footer: '<button class="btn" data-cancel>关闭</button>',
        onMount(root, close) { $('[data-cancel]', root).onclick = close; }
      });
    };
  });
}

async function openMemberSheet(id) {
  const d = await api.member(id);
  const m = d.member;
  const p = d.progress;
  const st = p.stats || {};
  openSheet(m.name, `
    <div class="m-card">
      <div class="m-title"><h3>每周空闲时间</h3>${employmentBadge(m.employmentType)}</div>
      ${availabilityGridHtml(m.availability)}
      <div class="t-xs t-dim mt8">${esc(availabilityText(m.availability))}</div>
    </div>

    <div class="m-card">
      <div class="row" style="gap:14px;align-items:flex-start">
        ${ringHtml(p.overallPercent, { size: 84, color: percentColor(p.overallPercent) })}
        <div class="grow">
          <div class="row wrap" style="gap:6px">${stageBadge(m.stage)} ${statusBadge(m.status)}</div>
          <div class="t-md t-bold mt8">${esc(stageName(m.stage))}</div>
          <div class="t-xs t-dim">${esc(lastCheckinText(st.lastDate))}</div>
        </div>
      </div>
      <div class="divider"></div>
      ${stagePipelineHtml(m.stage)}
    </div>

    <div class="m-grid4">
      <div class="m-cell"><div class="v">${st.checkinDays || 0}</div><div class="l">打卡天数</div></div>
      <div class="m-cell"><div class="v">${st.streak || 0}</div><div class="l">连续(天)</div></div>
      <div class="m-cell"><div class="v">${st.videoTotal || 0}</div><div class="l">视频</div></div>
      <div class="m-cell"><div class="v">${st.mistTotal || 0}</div><div class="l">打雾</div></div>
    </div>

    <div class="m-card">
      <div class="m-title"><h3>任务清单</h3><span class="badge ${p.stagePercent >= 100 ? 'badge-success' : 'badge-warn'}">${p.stagePercent}%</span></div>
      ${taskListHtml(p.tasks)}
    </div>

    ${Array.isArray(m.reasons) && m.reasons.length ? `<div class="m-card">
      <div class="m-title"><h3>创业 / 改变的 20 个理由</h3><span class="badge ${m.reasons.length >= 20 ? 'badge-success' : 'badge-warn'}">${m.reasons.length}/20</span></div>
      <ol style="padding-left:20px;list-style:decimal" class="t-sm col" style="gap:5px">
        ${m.reasons.slice(0, 20).map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div>` : ''}

    ${Array.isArray(m.schedule) && m.schedule.length ? `<div class="m-card">
      <div class="m-title"><h3>每日时间表</h3></div>
      ${m.schedule.map((s) => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)">
        <span class="badge mono">${esc(s.time || '')}</span><span class="t-sm">${esc(s.content || '')}</span></div>`).join('')}</div>` : ''}

    <div class="m-card">
      <div class="m-title"><h3>最近打卡</h3><span class="t-xs t-dim">${d.checkins.length} 条</span></div>
      ${d.checkins.slice(0, 10).map((c) => `<div class="m-item">
        <div class="grow">
          <div class="row" style="gap:6px"><span class="t-sm t-bold">${md(c.date)}</span>${stageBadge(c.stage)} ${scoreBadge(c.score)}</div>
          <div class="t-xs t-dim clamp2">${esc(checkinSummary(c))}</div>
        </div>
        <button class="btn btn-sm" data-rev="${c.id}">点评</button>
      </div>`).join('') || emptyHtml('暂无打卡')}
    </div>

    <div class="m-card">
      <div class="m-title"><h3>闯关记录</h3></div>
      ${d.breakthroughs.length ? d.breakthroughs.map((b) => `<div class="row" style="gap:8px;padding:7px 0;border-bottom:1px dashed var(--border)">
        <span class="t-sm t-bold grow">${esc(b.typeName)}</span>${btStatusBadge(b.status)}${scoreBadge(b.score)}</div>`).join('')
      : '<div class="t-sm t-dim">暂无闯关记录</div>'}
    </div>

    <div class="m-card">
      <dl class="kv">
        <dt>手机号</dt><dd>${esc(m.phone || '--')}</dd>
        <dt>推荐人</dt><dd>${esc(m.referrer || '--')}</dd>
        <dt>领导人</dt><dd>${esc(m.leaderName || '--')}</dd>
        <dt>入组日期</dt><dd>${cnDate(m.startDate)}</dd>
      </dl>
    </div>`,
  (root) => {
    $$('[data-rev]', root).forEach((b) => b.onclick = () => reviewSheet(b.dataset.rev, () => renderShell()));
  });
}

/* -------------------------------- 我的 -------------------------------- */
async function renderMe(host) {
  const u = state.user;
  host.innerHTML = `
    <div class="m-card">
      <div class="row" style="gap:13px">
        ${avatarHtml(u.name, 'avatar-lg')}
        <div class="grow">
          <div class="t-lg t-bold">${esc(u.name)}</div>
          <div class="t-sm t-dim">${esc(roleName(u.role))}${u.title ? ` · ${esc(u.title)}` : ''}</div>
          <div class="t-xs t-dim mono mt8">${esc(u.username)}</div>
        </div>
      </div>
    </div>

    ${u.role === 'member' ? `<div class="m-card">
      <div class="m-title"><h3>我的资料</h3></div>
      <div class="t-xs t-dim mb8">可以维护自己的 20 个理由、每日时间表与市场三问</div>
      <button class="btn btn-primary btn-block" id="edit-self">${icon('edit', 15)} 编辑我的资料</button>
    </div>` : ''}

    <div class="m-card">
      <div class="m-item"><span class="grow t-sm">深色模式</span>
        <span class="switch ${state.theme === 'dark' ? 'on' : ''}" id="sw"></span></div>
      <div class="m-item"><span class="grow t-sm">修改登录密码</span>
        <button class="btn btn-sm" id="pwd">修改</button></div>
      <div class="m-item"><span class="grow t-sm">切换到电脑版</span>
        <a class="btn btn-sm" href="/?v=web">${icon('monitor', 14)} 打开</a></div>
    </div>

    <div class="m-card">
      <div class="t-sm t-bold mb8">团队名词</div>
      ${(state.config.glossary || []).map((g) => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px dashed var(--border)">
        <span class="badge badge-brand">${esc(g.term)}</span><span class="t-xs t-dim grow">${esc(g.desc)}</span></div>`).join('')}
    </div>

    <button class="btn btn-danger btn-block m-btn-lg" id="out">${icon('logout', 17)} 退出登录</button>
    <div class="t-xs t-dim center mt12">ATK 工作室 · 网页版 / 手机端数据实时同步</div>`;

  $('#sw', host).onclick = (e) => { toggleTheme(); e.target.classList.toggle('on', state.theme === 'dark'); };
  $('#pwd', host).onclick = () => {
    modal({
      title: '修改密码', size: 'modal-sm',
      body: `<div class="col" style="gap:12px">
        <div class="field"><label>原密码</label><input class="input" type="password" data-f="o"></div>
        <div class="field"><label>新密码（至少 6 位）</label><input class="input" type="password" data-f="n"></div>
      </div>`,
      footer: `<button class="btn" data-c>取消</button><button class="btn btn-primary" data-s>确定</button>`,
      onMount(root, close) {
        $('[data-c]', root).onclick = close;
        $('[data-s]', root).onclick = async () => {
          try {
            await api.changePassword($('[data-f="o"]', root).value, $('[data-f="n"]', root).value);
            toast('密码已修改', 'ok'); close();
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    });
  };
  $('#out', host).onclick = async () => {
    if (!await confirmDialog('确定退出登录吗？')) return;
    try { await api.logout(); } catch (_) {}
    store.clear(); state.user = null; renderLogin();
  };
  const es = $('#edit-self', host);
  if (es) es.onclick = async () => {
    const d = await api.member(u.memberId);
    openSheet('编辑我的资料', `<div id="mf">${memberFormHtml(d.member, { config: state.config, leaders: d.leaders })}</div>
      <button class="btn btn-primary btn-block m-btn-lg mt12" id="ms">${icon('save', 17)} 保存</button>`,
    (root, close) => {
      mountMemberForm($('#mf', root));
      $('#ms', root).onclick = async () => {
        try {
          await api.updateMember(u.memberId, readMemberForm($('#mf', root)));
          toast('已保存', 'ok'); close();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  };
}

/* ------------------------------- 启动 ------------------------------- */
setUnauthorizedHandler(() => { state.user = null; renderLogin(); });

async function boot() {
  applyTheme();
  if (!store.token) { renderLogin(); return; }
  try {
    const me = await api.me();
    state.user = me.user;
    state.config = me.config;
    window.__ATK_CONFIG__ = me.config;
    setConfig(me.config);
    renderShell();
  } catch (e) { renderLogin(); }
}
boot();
