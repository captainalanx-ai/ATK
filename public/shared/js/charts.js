/* 轻量 SVG 图表：环形图 / 折线面积图 / 柱状图 / 横向条形图
   无第三方依赖，自适应容器宽度 */

import { esc } from './utils.js';

function niceMax(v) {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = Math.ceil(v / (pow / 2)) * (pow / 2);
  return n || 1;
}

/* ------------------------------ 环形图 ------------------------------ */
export function donut(items, opt = {}) {
  const size = opt.size || 170;
  const thickness = opt.thickness || 22;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const c = 2 * Math.PI * r;
  let offset = 0;
  let segs = '';
  if (total > 0) {
    items.forEach((it) => {
      const v = Number(it.value) || 0;
      if (!v) return;
      const frac = v / total;
      segs += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thickness}"
        stroke-dasharray="${(c * frac).toFixed(2)} ${(c * (1 - frac)).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})">
        <title>${esc(it.label)}：${v}</title></circle>`;
      offset += c * frac;
    });
  } else {
    segs = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--bg-soft)" stroke-width="${thickness}"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" style="max-width:${size}px;margin:0 auto">
    ${segs}
    <text x="50%" y="47%" text-anchor="middle" font-size="${size * 0.24}" font-weight="750" fill="currentColor" font-family="var(--font)">${total}</text>
    <text x="50%" y="60%" text-anchor="middle" font-size="${size * 0.09}" fill="var(--text-3)" font-family="var(--font)">${esc(opt.centerLabel || '总数')}</text>
  </svg>`;
}

export function legendHtml(items) {
  return `<div class="legend">${items.map((i) => `
    <div class="legend-item"><span class="legend-swatch" style="background:${i.color}"></span>
      <span>${esc(i.label)}</span><b style="color:var(--text)">${i.value}</b></div>`).join('')}</div>`;
}

/* --------------------------- 折线 / 面积图 --------------------------- */
export function lineChart(data, opt = {}) {
  const W = 680, H = opt.height || 210;
  const pl = 34, pr = 10, pt = 14, pb = 26;
  const iw = W - pl - pr, ih = H - pt - pb;
  if (!data.length) return '<div class="t-sm t-dim center" style="height:120px">暂无数据</div>';

  const max = niceMax(Math.max(...data.map((d) => Number(d.value) || 0), 1));
  const step = data.length > 1 ? iw / (data.length - 1) : 0;
  const x = (i) => pl + (data.length > 1 ? i * step : iw / 2);
  const y = (v) => pt + ih - (Number(v) / max) * ih;

  const pts = data.map((d, i) => [x(i), y(Number(d.value) || 0)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${pt + ih} L${pts[0][0].toFixed(1)},${pt + ih} Z`;

  const gridN = 4;
  let grid = '';
  for (let i = 0; i <= gridN; i++) {
    const gy = pt + (ih / gridN) * i;
    const gv = Math.round(max - (max / gridN) * i);
    grid += `<line x1="${pl}" y1="${gy.toFixed(1)}" x2="${W - pr}" y2="${gy.toFixed(1)}" stroke="var(--border)" stroke-dasharray="3 4"/>
      <text x="${pl - 7}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--text-3)">${gv}</text>`;
  }

  const stepLabel = Math.ceil(data.length / 8);
  let labels = '';
  data.forEach((d, i) => {
    if (i % stepLabel === 0 || i === data.length - 1) {
      labels += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="var(--text-3)">${esc(String(d.label).slice(5))}</text>`;
    }
  });

  const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="var(--surface)" stroke="${opt.color || 'var(--brand)'}" stroke-width="2.2"><title>${esc(data[i].label)}：${data[i].value}</title></circle>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${opt.color || 'var(--brand)'}" stop-opacity=".28"/>
      <stop offset="100%" stop-color="${opt.color || 'var(--brand)'}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#lg1)"/>
    <path d="${line}" fill="none" stroke="${opt.color || 'var(--brand)'}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}
  </svg>`;
}

/* ------------------------------ 柱状图 ------------------------------ */
export function barChart(data, opt = {}) {
  const W = 680, H = opt.height || 190;
  const pl = 32, pr = 10, pt = 12, pb = 26;
  const iw = W - pl - pr, ih = H - pt - pb;
  if (!data.length) return '<div class="t-sm t-dim center" style="height:110px">暂无数据</div>';
  const max = niceMax(Math.max(...data.map((d) => Number(d.value) || 0), 1));
  const bw = Math.max(6, (iw / data.length) * 0.62);
  const gap = iw / data.length;
  const color = opt.color || 'var(--brand)';

  const gridN = 4;
  let grid = '';
  for (let i = 0; i <= gridN; i++) {
    const gy = pt + (ih / gridN) * i;
    grid += `<line x1="${pl}" y1="${gy.toFixed(1)}" x2="${W - pr}" y2="${gy.toFixed(1)}" stroke="var(--border)" stroke-dasharray="3 4"/>
      <text x="${pl - 7}" y="${(gy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--text-3)">${Math.round(max - (max / gridN) * i)}</text>`;
  }
  const stepLabel = Math.ceil(data.length / 10);
  let bars = '';
  data.forEach((d, i) => {
    const v = Number(d.value) || 0;
    const bh = Math.max(2, (v / max) * ih);
    const bx = pl + gap * i + (gap - bw) / 2;
    const by = pt + ih - bh;
    bars += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${d.color || color}" opacity="${v ? 0.95 : 0.25}">
      <title>${esc(d.label)}：${v}</title></rect>
      ${v ? `<text x="${(bx + bw / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-3)">${v}</text>` : ''}
      ${i % stepLabel === 0 ? `<text x="${(bx + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--text-3)">${esc(String(d.label).slice(5))}</text>` : ''}`;
  });
  return `<svg viewBox="0 0 ${W} ${H}">${grid}${bars}</svg>`;
}

/* ---------------------------- 横向条形图 ---------------------------- */
export function hBar(items, opt = {}) {
  const rows = items.map((it) => {
    const p = Math.max(0, Math.min(100, Number(it.percent) || 0));
    return `<div style="display:grid;grid-template-columns:26px 1fr 42px;gap:10px;align-items:center;padding:7px 0">
      <div class="t-sm t-dim t-num">${esc(it.rank)}</div>
      <div>
        <div class="row-between" style="gap:6px;margin-bottom:4px">
          <span class="t-sm t-bold truncate">${esc(it.label)}</span>
          <span class="t-xs t-dim nowrap">${esc(it.note || '')}</span>
        </div>
        <div class="progress"><i style="width:${p}%;background:${it.color || 'var(--brand)'}"></i></div>
      </div>
      <div class="t-sm t-num t-bold" style="text-align:right">${esc(it.value)}</div>
    </div>`;
  }).join('');
  return `<div>${rows || '<div class="t-sm t-dim center" style="padding:20px">暂无数据</div>'}</div>`;
}

/* ------------------------------ 迷你走势 ------------------------------ */
export function sparkline(values, opt = {}) {
  const W = opt.width || 90, H = opt.height || 28;
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const pts = values.map((v, i) => [i * step, H - (v / max) * (H - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <path d="${d}" fill="none" stroke="${opt.color || 'var(--brand)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
