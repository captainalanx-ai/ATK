/* 网页版入口：登录 → 外壳 → 路由 */
import { $, $$, esc, icon, todayStr, cnDate } from '/shared/js/utils.js';
import { api, store, setUnauthorizedHandler } from '/shared/js/api.js';
import { toast, modal, confirmDialog } from '/shared/js/ui.js';
import { setConfig, cfg, roleName } from '/shared/js/format.js';

import * as dashboardPage from './dashboard.js';
import * as membersPage from './members.js';
import * as checkinsPage from './checkins.js';
import * as schedulePage from './schedule.js';
import * as managePage from './manage.js';

const state = {
  user: null,
  config: null,
  route: 'dashboard',
  param: '',
  navOpen: false,
  theme: localStorage.getItem('atk_theme') || 'light'
};

const PAGES = {
  dashboard: { title: '数据看板', icon: 'dashboard', render: dashboardPage.render, roles: ['admin', 'leader', 'member'] },
  members: { title: '新人管理', icon: 'users', render: membersPage.render, roles: ['admin', 'leader'] },
  checkins: { title: '打卡记录', icon: 'check', render: checkinsPage.render, roles: ['admin', 'leader', 'member'] },
  schedule: { title: '学习排期', icon: 'clock', render: schedulePage.render, roles: ['admin', 'leader'] },
  breakthrough: { title: '闯关考核', icon: 'flag', render: managePage.renderBreakthrough, roles: ['admin', 'leader'] },
  config: { title: '阶段配置', icon: 'settings', render: managePage.renderConfig, roles: ['admin'] },
  users: { title: '账号权限', icon: 'shield', render: managePage.renderUsers, roles: ['admin'] }
};

const ctx = {
  get user() { return state.user; },
  get config() { return state.config; },
  go, refresh, state
};

export function go(route, param = '') {
  state.route = route;
  state.param = param;
  // pushState avoids hash-anchor scroll handlers that treat "#/route" as a CSS selector
  const nextHash = `#/${route}${param ? `/${param}` : ''}`;
  if (location.hash !== nextHash) history.pushState(null, '', nextHash);
  renderPage();
}

function renderPage() {
  const page = PAGES[state.route] || PAGES.dashboard;
  const host = $('#page');
  const titleEl = $('#page-title');
  // 同一页面在不同角色下叫法不同（新人看到的是「我的进度 / 我的档案」），以导航文案为准
  const label = (navItems().find((n) => n.route === state.route) || {}).label || page.title;
  if (titleEl) titleEl.innerHTML = `${icon(page.icon, 17)} <span>${esc(label)}</span>`;
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.route === state.route));
  host.innerHTML = '';
  try {
    page.render(host, ctx, state.param);
  } catch (e) {
    console.error(e);
    host.innerHTML = `<div class="card card-pad"><div class="t-md t-danger">页面渲染出错：${esc(e.message)}</div></div>`;
  }
  window.scrollTo({ top: 0 });
}

async function refresh() {
  const me = await api.me();
  state.user = me.user;
  state.config = me.config;
  window.__ATK_CONFIG__ = me.config;
  setConfig(me.config);
  renderShell();
}

/* ------------------------------- 登录页 ------------------------------- */
function renderLogin() {
  const app = $('#app');
  const cfgDefault = {
    stages: [
      { short: '阶段一', name: '价值确认 · 定心定位' },
      { short: '阶段二', name: '闯关阶段' },
      { short: '阶段三', name: '开业阶段' },
      { short: '阶段四', name: '市场前期阶段' }
    ]
  };
  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-side">
      <div>
        <div class="row" style="gap:12px">
          <div class="brand-mark" style="background:rgba(255,255,255,.22);width:42px;height:42px;font-size:16px">ATK</div>
          <div>
            <div style="font-size:19px;font-weight:750;letter-spacing:-.3px">ATK 工作室</div>
            <div style="font-size:12.5px;opacity:.8">新人学习进度管理系统</div>
          </div>
        </div>
      </div>
      <div>
        <h2 style="font-size:30px;line-height:1.35;letter-spacing:-.5px;margin-bottom:14px">
          把新人的每一天<br>都看得见、管得住
        </h2>
        <div class="col" style="gap:12px;max-width:420px">
          ${cfgDefault.stages.map((s) => `<div class="stage-pill">${icon('check', 13)} ${esc(s.short)} · ${esc(s.name)}</div>`).join('')}
        </div>
        <div class="col mt24" style="gap:10px;max-width:420px">
          <div class="feature-line">${icon('video', 16)} <span>8 个视频目录循环学习，每天 1 个，进度自动累计</span></div>
          <div class="feature-line">${icon('users', 16)} <span>打雾嘉宾逐条登记，星级、主题、累计人数一目了然</span></div>
          <div class="feature-line">${icon('mic', 16)} <span>语音会后会反馈沉淀成文字，领导在线点评打分</span></div>
          <div class="feature-line">${icon('flag', 16)} <span>四类闯关 + 开业七件事 + 市场三问，通关自动推进阶段</span></div>
        </div>
      </div>
      <div class="t-sm" style="opacity:.7">网页版 · 手机端双版本，数据实时同步</div>
    </div>

    <div class="login-main">
      <div class="login-card">
        <div class="login-title">欢迎回来 👋</div>
        <div class="login-sub">${cnDate(todayStr())} · 请登录以继续</div>

        <form class="col mt24" id="login-form" style="gap:14px" autocomplete="on">
          <div class="field">
            <label>账号 / 手机号</label>
            <input class="input" name="username" id="u" placeholder="admin 或 手机号" autocomplete="username" value="">
          </div>
          <div class="field">
            <label>密码</label>
            <input class="input" type="password" name="password" id="p" placeholder="请输入密码" autocomplete="current-password">
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit" id="submit">登 录</button>
          <div id="login-err" class="t-sm t-danger hide"></div>
        </form>

        <div class="mt20">
          <div class="t-xs t-dim mb8">演示账号（点击自动填入）</div>
          <div class="col" style="gap:7px">
            <div class="quick-account" data-acc="admin"><span>${icon('shield', 14)} 管理员</span><span class="mono t-xs">admin / atk2026</span></div>
            <div class="quick-account" data-acc="ken"><span>${icon('award', 14)} 领导人 Ken 哥</span><span class="mono t-xs">ken / atk2026</span></div>
            <div class="quick-account" data-acc="member"><span>${icon('user', 14)} 新人 林晓雅</span><span class="mono t-xs">13800000011 / 123456</span></div>
          </div>
        </div>

        <div class="row mt20" style="justify-content:center;gap:8px">
          <a class="btn btn-sm" href="/m/">${icon('smartphone', 14)} 手机端</a>
          <button class="btn btn-sm btn-ghost" id="theme-login">${icon(state.theme === 'dark' ? 'sun' : 'moon', 14)} ${state.theme === 'dark' ? '浅色' : '深色'}</button>
        </div>
      </div>
    </div>
  </div>`;

  const setAcc = (u, p) => { $('#u').value = u; $('#p').value = p; };
  $$('[data-acc]').forEach((el) => {
    el.onclick = () => {
      const k = el.dataset.acc;
      if (k === 'admin') setAcc('admin', 'atk2026');
      if (k === 'ken') setAcc('ken', 'atk2026');
      if (k === 'member') setAcc('13800000011', '123456');
    };
  });
  $('#theme-login').onclick = toggleTheme;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#submit');
    const err = $('#login-err');
    err.classList.add('hide');
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      const res = await api.login($('#u').value.trim(), $('#p').value);
      store.token = res.token;
      store.user = res.user;
      state.user = res.user;
      const me = await api.me();
      state.config = me.config;
      window.__ATK_CONFIG__ = me.config;
      setConfig(me.config);
      applyTheme();
      renderShell();
      toast(`欢迎回来，${res.user.name}`, 'ok');
    } catch (e2) {
      err.textContent = e2.message;
      err.classList.remove('hide');
      btn.disabled = false; btn.textContent = '登 录';
    }
  };
}

/* -------------------------------- 外壳 -------------------------------- */
function navItems() {
  const role = state.user?.role || 'member';
  const all = [
    { route: 'dashboard', label: role === 'member' ? '我的进度' : '数据看板', icon: 'dashboard' },
    { route: 'members', label: role === 'member' ? '我的档案' : '新人管理', icon: 'users' },
    { route: 'checkins', label: '打卡记录', icon: 'check' },
    { route: 'schedule', label: '学习排期', icon: 'clock' },
    { route: 'breakthrough', label: '闯关考核', icon: 'flag' },
    { route: 'config', label: '阶段配置', icon: 'settings' },
    { route: 'users', label: '账号权限', icon: 'shield' }
  ];
  return all.filter((i) => (PAGES[i.route].roles || []).includes(role));
}

function renderShell() {
  const app = $('#app');
  const u = state.user;
  const role = u.role;
  app.innerHTML = `
  <div class="shell">
    <aside class="sidebar ${state.navOpen ? 'open' : ''}" id="sidebar">
      <div class="brand">
        <div class="brand-mark">ATK</div>
        <div class="brand-text">
          <b>${esc(cfg().studioName || 'ATK 工作室')}</b>
          <span class="t-xs t-dim">${esc(cfg().subtitle || '新人学习进度管理')}</span>
        </div>
      </div>
      <nav class="nav">
        <div class="nav-group-title">工作台</div>
        ${navItems().slice(0, 3).map(navItemHtml).join('')}
        <div class="nav-group-title">培养体系</div>
        ${navItems().slice(3, 5).map(navItemHtml).join('')}
        ${role === 'admin' ? `<div class="nav-group-title">系统</div>${navItems().slice(5).map(navItemHtml).join('')}` : ''}
      </nav>
      <div class="side-foot">
        <div class="row" style="gap:10px">
          <span class="avatar" style="background:${esc(u.avatarColor || '#4F46E5')}">${esc(String(u.name).slice(-2))}</span>
          <div class="grow" style="min-width:0">
            <div class="t-sm t-bold truncate">${esc(u.name)}</div>
            <div class="t-xs t-dim">${esc(roleName(role))}</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" id="btn-logout" title="退出登录">${icon('logout', 16)}</button>
        </div>
      </div>
    </aside>
    <div class="side-mask hide" id="side-mask"></div>

    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon hide-sm-hide" id="btn-menu" style="display:none">${icon('menu', 19)}</button>
        <h1 id="page-title" class="row" style="gap:8px"></h1>
        <div class="spacer"></div>
        <div class="t-sm t-dim hide-sm">${cnDate(todayStr())}</div>
        <button class="btn btn-ghost btn-icon" id="btn-refresh" title="刷新数据">${icon('refresh', 17)}</button>
        <button class="btn btn-ghost btn-icon" id="btn-theme" title="切换主题">${icon(state.theme === 'dark' ? 'sun' : 'moon', 17)}</button>
        <a class="btn btn-sm" href="/m/" title="切换到手机端版本">${icon('smartphone', 15)} <span class="hide-sm">手机端</span></a>
      </header>
      <main class="content" id="page"></main>
    </div>
  </div>`;

  $$('.nav-item').forEach((el) => {
    el.onclick = () => { go(el.dataset.route); state.navOpen = false; renderShell(); };
  });
  $('#btn-logout').onclick = async () => {
    if (await confirmDialog('确定要退出登录吗？', { title: '退出登录' })) {
      try { await api.logout(); } catch (_) {}
      store.clear();
      state.user = null;
      renderLogin();
    }
  };
  $('#btn-theme').onclick = toggleTheme;
  $('#btn-refresh').onclick = () => { renderPage(); toast('数据已刷新', 'info', 1200); };
  const menu = $('#btn-menu');
  const mask = $('#side-mask');
  menu.onclick = () => {
    state.navOpen = !state.navOpen;
    $('#sidebar').classList.toggle('open', state.navOpen);
    mask.classList.toggle('hide', !state.navOpen);
  };
  mask.onclick = () => { state.navOpen = false; $('#sidebar').classList.remove('open'); mask.classList.add('hide'); };

  // 窄屏时显示汉堡按钮
  const syncMenu = () => { menu.style.display = window.innerWidth <= 900 ? '' : 'none'; };
  syncMenu();
  window.addEventListener('resize', syncMenu);

  renderPage();
}

function navItemHtml(n) {
  return `<div class="nav-item ${state.route === n.route ? 'active' : ''}" data-route="${n.route}">
    ${icon(n.icon, 18)} <span>${esc(n.label)}</span>
  </div>`;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('atk_theme', state.theme);
}
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  if (state.user) renderShell(); else renderLogin();
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
    const hash = location.hash.replace(/^#\/?/, '').split('/');
    if (hash[0] && PAGES[hash[0]]) { state.route = hash[0]; state.param = hash[1] || ''; }
    renderShell();
  } catch (e) {
    renderLogin();
  }
}

function syncRouteFromHash() {
  const hash = location.hash.replace(/^#\/?/, '').split('/');
  const r = hash[0] || 'dashboard';
  if (PAGES[r] && r !== state.route) { state.route = r; state.param = hash[1] || ''; if (state.user) renderShell(); }
}
window.addEventListener('hashchange', syncRouteFromHash);
window.addEventListener('popstate', syncRouteFromHash);

boot();
