/* 学习排期：按新人的空闲时间，找出能统一安排学习的时段 */
import { $, $$, esc, icon } from '/shared/js/utils.js';
import { api } from '/shared/js/api.js';
import { toast, modal, emptyHtml } from '/shared/js/ui.js';
import { stageBadge, employmentBadge, availabilityText } from '/shared/js/format.js';

const filters = { type: '', stage: '' };

const levelOf = (n) => (n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);

function cellHtml(d, day, slot) {
  const cell = ((d.grid || {})[day.id] || {})[slot.id] || [];
  const n = cell.length;
  const who = cell.slice(0, 2).map((x) => esc(x.name)).join('、');
  return `<div class="sch-cell lv${levelOf(n)}" data-day="${day.id}" data-slot="${slot.id}" title="${esc(day.name + ' ' + slot.name + ' ' + slot.time)}">
    <div class="n">${n || ''}</div>
    <div class="who">${who}${n > 2 ? ` +${n - 2}` : ''}</div>
  </div>`;
}

function gridHtml(d) {
  const days = d.days || [];
  const slots = d.slots || [];
  return `<div class="sch-grid" style="grid-template-columns:78px repeat(${days.length}, minmax(72px, 1fr))">
    <div class="sch-cell head"></div>
    ${days.map((day) => `<div class="sch-cell head"><div class="n" style="font-size:12.5px">${esc(day.name)}</div></div>`).join('')}
    ${slots.map((s) => `
      <div class="sch-cell head"><div class="n" style="font-size:12.5px">${esc(s.name)}</div><div class="who">${esc(s.time)}</div></div>
      ${days.map((day) => cellHtml(d, day, s)).join('')}
    `).join('')}
  </div>`;
}

function openCell(d, dayId, slotId) {
  const day = (d.days || []).find((x) => String(x.id) === String(dayId));
  const slot = (d.slots || []).find((x) => String(x.id) === String(slotId));
  const members = ((d.grid || {})[dayId] || {})[slotId] || [];
  modal({
    title: `${day ? day.name : ''} · ${slot ? slot.name : ''} ${slot ? slot.time : ''}`,
    body: members.length
      ? `<div class="t-sm t-dim mb8">这个时段有 ${members.length} 位新人有空，适合安排集体学习 / 集体打雾。</div>
         <div class="col" style="gap:6px">
           ${members.map((m) => `<div class="row" style="gap:8px;padding:7px 0;border-bottom:1px dashed var(--border)">
             <span class="t-sm t-bold">${esc(m.name)}</span>${stageBadge(m.stage)} ${employmentBadge(m.employmentType)}
             <span class="spacer"></span>
             <button class="btn btn-sm" data-open-m="${m.id}">看档案</button>
           </div>`).join('')}
         </div>`
      : emptyHtml('这个时段没有人登记空闲'),
    footer: '<button class="btn" data-cancel>关闭</button>',
    size: 'modal-sm',
    onMount(root, closeFn) {
      $('[data-cancel]', root).onclick = closeFn;
      $$('[data-open-m]', root).forEach((b) => {
        b.onclick = () => { closeFn(); location.hash = `#/members/${b.dataset.openM}`; };
      });
    }
  });
}

export async function render(host, ctx) {
  host.innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:220px;height:14px"></div></div>`;

  const paint = (d) => {
    host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>${icon('clock', 15)} 空闲时间排期表</h3>
        <div class="row" style="gap:8px">
          <select class="select" id="s-type" style="width:150px">
            <option value="">全部（全职+兼职）</option>
            <option value="fulltime" ${filters.type === 'fulltime' ? 'selected' : ''}>只看全职</option>
            <option value="parttime" ${filters.type === 'parttime' ? 'selected' : ''}>只看兼职</option>
          </select>
          <select class="select" id="s-stage" style="width:150px">
            <option value="">全部阶段</option>
            ${(ctx.config.stages || []).map((s) => `<option value="${s.id}" ${filters.stage == s.id ? 'selected' : ''}>${esc(s.short)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card-body">
        <div class="row wrap" style="gap:8px">
          <span class="badge badge-brand">全职 ${d.counts.fulltime} 人</span>
          <span class="badge badge-warn">兼职 ${d.counts.parttime} 人</span>
          ${d.counts.unknown ? `<span class="badge">未登记 ${d.counts.unknown} 人</span>` : ''}
          <span class="spacer"></span>
          <span class="t-xs t-dim">格子里的数字＝该时段有空的人数，点格子看名单</span>
        </div>
        <div class="mt16">${gridHtml(d)}</div>
      </div>
    </div>

    <div class="grid g2 mt16" style="gap:16px;align-items:start">
      <div class="card">
        <div class="card-head"><h3>${icon('award', 15)} 推荐安排时段</h3></div>
        <div class="card-body col" style="gap:8px">
          ${d.best.length ? d.best.map((b, i) => `<div class="row" style="gap:10px;padding:8px;background:var(--surface-2);border-radius:var(--r-sm)">
            <span class="badge badge-brand">${i + 1}</span>
            <div class="grow">
              <div class="t-sm t-bold">${esc(b.dayName)} ${esc(b.slotName)} <span class="t-xs t-dim">${esc(b.time)}</span></div>
              <div class="t-xs t-dim truncate">${b.members.map((m) => esc(m.name)).join('、')}</div>
            </div>
            <span class="t-md t-bold t-num" style="color:var(--brand)">${b.count} 人</span>
          </div>`).join('') : '<div class="t-sm t-dim">暂时没有 2 人以上的共同空闲时段，建议先补登记空闲时间。</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('alert', 15)} 还没登记空闲时间</h3></div>
        <div class="card-body">
          ${d.noAvailability.length ? `<div class="t-xs t-dim mb8">以下 ${d.noAvailability.length} 位新人还没填空闲时间，排学习前先找他们确认。</div>
            <div class="col" style="gap:6px">${d.noAvailability.map((m) => `<div class="row" style="gap:8px">
              <span class="t-sm t-bold">${esc(m.name)}</span>${employmentBadge(m.employmentType)}
              <span class="spacer"></span>
              <button class="btn btn-sm" data-edit-m="${m.id}">去补填</button>
            </div>`).join('')}</div>`
          : '<div class="t-sm t-dim center" style="padding:20px">所有新人都已登记空闲时间 👍</div>'}
        </div>
      </div>
    </div>`;

    $('#s-type', host).onchange = (e) => { filters.type = e.target.value; load(); };
    $('#s-stage', host).onchange = (e) => { filters.stage = e.target.value; load(); };
    $$('[data-cell]', host).forEach((el) => {
      el.onclick = () => openCell(d, el.dataset.day, el.dataset.slot);
    });
    $$('[data-edit-m]', host).forEach((b) => {
      b.onclick = () => { location.hash = `#/members/${b.dataset.editM}`; };
    });
  };

  const load = async () => {
    try {
      const d = await api.availability({ type: filters.type, stage: filters.stage });
      paint(d);
    } catch (e) {
      host.innerHTML = `<div class="card card-pad t-danger">${esc(e.message)}</div>`;
    }
  };
  await load();
}
