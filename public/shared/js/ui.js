/* UI 组件：Toast / Modal / Drawer / 分页 / 空态 */
import { $, $$, esc, icon } from './utils.js';

/* ------------------------------- Toast ------------------------------- */
let toastHost = null;
export function toast(msg, type = 'ok', ms = 2200) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'err' ? 'alert' : type === 'info' ? 'clock' : 'check', 16)}<span>${esc(msg)}</span>`;
  toastHost.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/* ------------------------------ 弹层基础 ------------------------------ */
function overlay(innerHtml, className = '') {
  const mask = document.createElement('div');
  mask.className = `mask ${className}`;
  mask.innerHTML = innerHtml;
  document.body.appendChild(mask);
  const close = () => {
    mask.style.transition = 'opacity .15s';
    mask.style.opacity = '0';
    setTimeout(() => mask.remove(), 160);
  };
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) close(); });
  return { mask, close };
}

/**
 * 打开模态框
 * @param {{title:string, body:string, footer?:string, size?:''|'modal-lg'|'modal-sm', onMount?:(root:HTMLElement, close:Function)=>void}} opt
 */
export function modal(opt) {
  const { mask, close } = overlay(`
    <div class="modal ${opt.size || ''}">
      <div class="modal-head">
        <h3 style="font-size:15.5px">${esc(opt.title || '')}</h3>
        <button class="btn btn-ghost btn-icon btn-sm" data-close>${icon('x', 18)}</button>
      </div>
      <div class="modal-body">${opt.body || ''}</div>
      ${opt.footer ? `<div class="modal-foot">${opt.footer}</div>` : ''}
    </div>`);
  $('[data-close]', mask).onclick = close;
  if (opt.onMount) opt.onMount($('.modal', mask), close);
  return { root: $('.modal', mask), close };
}

/** 右侧抽屉 */
export function drawer(opt) {
  const mask = document.createElement('div');
  mask.className = 'mask';
  mask.style.padding = '0';
  mask.style.justifyContent = 'flex-end';
  mask.innerHTML = `
    <div class="drawer" style="width:${opt.width || 'min(620px,100%)'}">
      <div class="modal-head">
        <div>
          <h3 style="font-size:15.5px">${esc(opt.title || '')}</h3>
          ${opt.subtitle ? `<div class="t-sm t-dim" style="margin-top:2px">${esc(opt.subtitle)}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close>${icon('x', 18)}</button>
      </div>
      <div class="modal-body" style="flex:1">${opt.body || ''}</div>
      ${opt.footer ? `<div class="modal-foot">${opt.footer}</div>` : ''}
    </div>`;
  document.body.appendChild(mask);
  const close = () => {
    const d = $('.drawer', mask);
    d.style.transition = 'transform .2s';
    d.style.transform = 'translateX(100%)';
    mask.style.transition = 'opacity .2s';
    mask.style.opacity = '0';
    setTimeout(() => mask.remove(), 200);
  };
  $('[data-close]', mask).onclick = close;
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) close(); });
  if (opt.onMount) opt.onMount($('.drawer', mask), close);
  return { root: $('.drawer', mask), close };
}

export function confirmDialog(message, opt = {}) {
  return new Promise((resolve) => {
    const { root, close } = modal({
      title: opt.title || '请确认',
      size: 'modal-sm',
      body: `<p style="font-size:14px;line-height:1.7">${esc(message)}</p>`,
      footer: `
        <button class="btn" data-no>${opt.cancelText || '取消'}</button>
        <button class="btn ${opt.danger ? 'btn-danger' : 'btn-primary'}" data-yes>${opt.okText || '确定'}</button>`
    });
    $('[data-no]', root).onclick = () => { close(); resolve(false); };
    $('[data-yes]', root).onclick = () => { close(); resolve(true); };
  });
}

/* ------------------------------- 分页 ------------------------------- */
export function pagerHtml(page, pageSize, total) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages);
  let btns = '';
  const push = (p, label, disabled = false, active = false) => {
    btns += `<button data-page="${p}" ${disabled ? 'disabled' : ''} class="${active ? 'active' : ''}">${label}</button>`;
  };
  push(cur - 1, '‹', cur <= 1);
  const window = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 1) window.push(i);
  }
  let last = 0;
  window.forEach((i) => {
    if (last && i - last > 1) btns += `<button disabled>…</button>`;
    push(i, i, false, i === cur);
    last = i;
  });
  push(cur + 1, '›', cur >= pages);
  return `<div class="pager"><span class="t-sm t-dim" style="margin-right:auto">共 ${total} 条 / ${pages} 页</span>${btns}</div>`;
}

export function bindPager(container, cb) {
  $$('[data-page]', container).forEach((b) => {
    b.onclick = () => {
      const p = Number(b.dataset.page);
      if (!p || b.disabled) return;
      cb(p);
    };
  });
}

/* ------------------------------- 空态 ------------------------------- */
export function emptyHtml(text = '暂无数据', hint = '') {
  return `<div class="empty">${icon('inbox', 46)}<div class="t-md t-bold" style="color:var(--text-2)">${esc(text)}</div>
    ${hint ? `<div class="t-sm t-dim mt8">${esc(hint)}</div>` : ''}</div>`;
}

export function loadingHtml(text = '加载中…') {
  return `<div class="empty"><div class="skeleton" style="width:120px;height:12px;margin:0 auto 10px"></div>
    <div class="t-sm t-dim">${esc(text)}</div></div>`;
}

/* ------------------------------ 小组件 ------------------------------ */
export function avatarHtml(name, size = '', color) {
  const c = color || 'var(--brand)';
  return `<span class="avatar ${size}" style="background:${c}">${esc(String(name || '?').slice(-2))}</span>`;
}

export function ringHtml(percent, opt = {}) {
  const size = opt.size || 76;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const color = opt.color || 'var(--brand)';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--bg-soft)" stroke-width="7"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dy="0.36em" font-size="${size * 0.26}" font-weight="700"
      fill="currentColor" font-family="var(--font)">${Math.round(p)}</text>
  </svg>`;
}

export function progressHtml(percent, color) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="progress"><i style="width:${p}%${color ? `;background:${color}` : ''}"></i></div>`;
}

export function chipHtml(text, kind = '') {
  return `<span class="badge ${kind ? `badge-${kind}` : ''}">${esc(text)}</span>`;
}

/** 星级 1-5 */
export function starsHtml(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += `<span style="color:${i <= n ? 'var(--warning)' : 'var(--border-strong)'};font-size:13px">★</span>`;
  }
  return s;
}

/** 让容器支持 [data-act] 事件委托 */
export function delegate(root, map) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = map[el.dataset.act];
    if (fn) fn(el, e);
  });
}
