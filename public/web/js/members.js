/* 新人管理：列表 + 表单编辑 + 详情抽屉 */
import { $, $$, esc, icon, num, md, cnDate, todayStr, debounce, relativeTime } from '/shared/js/utils.js';
import { api } from '/shared/js/api.js';
import { toast, modal, drawer, confirmDialog, pagerHtml, bindPager, emptyHtml, avatarHtml, ringHtml, progressHtml, delegate } from '/shared/js/ui.js';
import {
  stageBadge, stageName, stageColor, statusBadge, stagePipelineHtml, taskListHtml,
  overdueBadge, lastCheckinText, checkinSummary, btStatusBadge, scoreBadge, percentColor,
  employmentBadge, availabilityText, availabilityGridHtml
} from '/shared/js/format.js';
import { memberFormHtml, mountMemberForm, readMemberForm, checkinFormHtml, mountCheckinForm, readCheckinForm, reviewFormHtml, readReviewForm } from '/shared/js/forms.js';

const filters = { q: '', stage: '', status: '', employmentType: '', sort: 'updated', page: 1, pageSize: 10 };

export async function render(host, ctx, param) {
  host.innerHTML = `
  <div class="card">
    <div class="toolbar">
      <div class="search-box">
        ${icon('search', 15)}
        <input class="input" id="f-q" placeholder="搜索姓名 / 手机号 / 推荐人" value="${esc(filters.q)}">
      </div>
      <select class="select" id="f-stage">
        <option value="">全部阶段</option>
        ${(ctx.config.stages || []).map((s) => `<option value="${s.id}" ${filters.stage == s.id ? 'selected' : ''}>${esc(s.short)} · ${esc(s.name)}</option>`).join('')}
      </select>
      <select class="select" id="f-status">
        <option value="">全部状态</option>
        <option value="active" ${filters.status === 'active' ? 'selected' : ''}>在培</option>
        <option value="risk" ${filters.status === 'risk' ? 'selected' : ''}>需关注</option>
        <option value="paused" ${filters.status === 'paused' ? 'selected' : ''}>暂停</option>
        <option value="graduated" ${filters.status === 'graduated' ? 'selected' : ''}>已通关</option>
      </select>
      <select class="select" id="f-emp">
        <option value="">全部投入方式</option>
        ${(ctx.config.employmentTypes || [{ id: 'fulltime', name: '全职' }, { id: 'parttime', name: '兼职' }])
          .map((t) => `<option value="${t.id}" ${filters.employmentType === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        <option value="none" ${filters.employmentType === 'none' ? 'selected' : ''}>未填写</option>
      </select>
      <select class="select" id="f-sort">
        <option value="updated" ${filters.sort === 'updated' ? 'selected' : ''}>最近更新</option>
        <option value="progress" ${filters.sort === 'progress' ? 'selected' : ''}>总进度高→低</option>
        <option value="streak" ${filters.sort === 'streak' ? 'selected' : ''}>连续打卡</option>
        <option value="risk" ${filters.sort === 'risk' ? 'selected' : ''}>逾期优先</option>
        <option value="stage" ${filters.sort === 'stage' ? 'selected' : ''}>阶段高→低</option>
      </select>
      <div class="spacer"></div>
      ${ctx.user.role !== 'member' ? `<button class="btn btn-primary" id="btn-new">${icon('plus', 15)} 新增新人</button>` : ''}
    </div>
    <div class="table-wrap"><table class="table" id="tbl"><tbody><tr><td style="padding:40px" class="center"><div class="skeleton" style="width:160px;height:14px"></div></td></tr></tbody></table></div>
    <div style="padding:0 16px 14px" id="pager"></div>
  </div>`;

  const load = async () => {
    const box = $('#tbl');
    const pager = $('#pager');
    try {
      const res = await api.members({ ...filters });
      if (!res.items.length) {
        box.innerHTML = `<tbody><tr><td>${emptyHtml('没有符合条件的新人', '换个筛选条件，或点右上角新增一位新人')}</td></tr></tbody>`;
        pager.innerHTML = '';
        return;
      }
      box.innerHTML = `
        <thead><tr>
          <th>新人</th><th>阶段</th><th>状态</th><th>投入方式</th><th>总进度</th><th>阶段完成度</th>
          <th>连续打卡</th><th>打雾</th><th>最近打卡</th><th style="text-align:right">操作</th>
        </tr></thead>
        <tbody>${res.items.map(rowHtml).join('')}</tbody>`;
      pager.innerHTML = pagerHtml(res.page, res.pageSize, res.total);
      bindPager(pager, (p) => { filters.page = p; load(); });
      $$('[data-open]', box).forEach((b) => { b.onclick = () => openDetail(b.dataset.open, ctx, load); });
      $$('[data-edit]', box).forEach((b) => { b.onclick = () => openForm(b.dataset.edit, ctx, load); });
      $$('[data-del]', box).forEach((b) => {
        b.onclick = async () => {
          if (!await confirmDialog(`确定删除「${b.dataset.name}」吗？其打卡、闯关记录会一并删除，且不可恢复。`, { danger: true, okText: '删除' })) return;
          await api.deleteMember(b.dataset.del);
          toast('已删除');
          load();
        };
      });
    } catch (e) {
      box.innerHTML = `<tbody><tr><td class="t-danger" style="padding:20px">${esc(e.message)}</td></tr></tbody>`;
    }
  };

  $('#f-q').addEventListener('input', debounce((e) => { filters.q = e.target.value.trim(); filters.page = 1; load(); }, 300));
  $('#f-stage').onchange = (e) => { filters.stage = e.target.value; filters.page = 1; load(); };
  $('#f-status').onchange = (e) => { filters.status = e.target.value; filters.page = 1; load(); };
  $('#f-emp').onchange = (e) => { filters.employmentType = e.target.value; filters.page = 1; load(); };
  $('#f-sort').onchange = (e) => { filters.sort = e.target.value; load(); };
  const newBtn = $('#btn-new');
  if (newBtn) newBtn.onclick = () => openForm(null, ctx, load);

  await load();
  if (param) openDetail(param, ctx, load);
}

function rowHtml(m) {
  const p = m.progress || {};
  const st = p.stats || {};
  return `<tr>
    <td>
      <div class="member-cell">
        ${avatarHtml(m.name)}
        <div style="min-width:0">
          <div class="name">${esc(m.name)} <span class="t-xs t-dim">${esc(m.gender || '')}</span></div>
          <div class="sub">${esc(m.phone || '未填手机号')} · ${esc(m.leaderName || '未指定领导人')}</div>
        </div>
      </div>
    </td>
    <td>${stageBadge(m.stage)}</td>
    <td>${statusBadge(m.status)}</td>
    <td>${employmentBadge(m.employmentType)}</td>
    <td>
      <div class="row" style="gap:8px">
        <div class="progress" style="width:80px"><i style="width:${p.overallPercent || 0}%;background:${percentColor(p.overallPercent)}"></i></div>
        <span class="t-sm t-num t-bold">${p.overallPercent || 0}%</span>
      </div>
    </td>
    <td>
      <div class="row" style="gap:8px">
        <div class="progress thin" style="width:70px"><i style="width:${p.stagePercent || 0}%;background:${stageColor(m.stage)}"></i></div>
        <span class="t-sm t-num">${p.stagePercent || 0}%</span>
      </div>
    </td>
    <td><span class="t-num t-bold" style="color:${(st.streak || 0) >= 3 ? 'var(--success)' : 'var(--text-2)'}">${st.streak || 0} 天</span></td>
    <td class="t-num">${st.mistTotal || 0} / ${st.mistTarget || 30}</td>
    <td>${overdueBadge(st.overdueDays)}</td>
    <td style="text-align:right" class="nowrap">
      <button class="btn btn-soft btn-sm" data-open="${m.id}">详情</button>
      <button class="btn btn-sm" data-edit="${m.id}">编辑</button>
      <button class="btn btn-ghost btn-sm" data-del="${m.id}" data-name="${esc(m.name)}">${icon('trash', 14)}</button>
    </td>
  </tr>`;
}

/* ------------------------------ 新增 / 编辑 ------------------------------ */
export async function openForm(id, ctx, onDone) {
  const load = id
    ? api.member(id).then((d) => ({ member: d.member, leaders: d.leaders }))
    : api.members({ pageSize: 1 }).then((d) => ({ member: {}, leaders: d.leaders || [] }));
  load.then((d) => {
    modal({
      title: id ? `编辑新人 · ${d.member.name}` : '新增新人',
      size: 'modal-lg',
      body: `<div id="mform">${memberFormHtml(d.member, { config: ctx.config, leaders: d.leaders })}</div>`,
      footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>${icon('save', 15)} 保存</button>`,
      onMount(root, closeFn) {
        mountMemberForm($('#mform', root));
        $('[data-cancel]', root).onclick = closeFn;
        $('[data-save]', root).onclick = async () => {
          const data = readMemberForm($('#mform', root));
          if (!data.name) return toast('请填写姓名', 'err');
          try {
            if (id) await api.updateMember(id, data); else await api.createMember(data);
            toast('已保存', 'ok');
            closeFn();
            onDone && onDone();
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    });
  }).catch((e) => toast(e.message, 'err'));
}

/* ------------------------------- 详情抽屉 ------------------------------- */
export function openDetail(id, ctx, onDone) {
  let data = null;
  let tab = 'overview';

  const body = () => {
    const m = data.member;
    const p = data.progress;
    const st = p.stats || {};
    if (tab === 'overview') return `
      <div class="row" style="gap:14px;align-items:flex-start">
        ${ringHtml(p.overallPercent, { size: 88, color: percentColor(p.overallPercent) })}
        <div class="grow">
          <div class="row wrap" style="gap:6px">${stageBadge(m.stage)} ${statusBadge(m.status)} ${employmentBadge(m.employmentType)}
            ${m.focusBreakthrough ? `<span class="badge badge-brand">主攻：${esc((ctx.config.breakthroughTypes || []).find((b) => b.id === m.focusBreakthrough)?.name || m.focusBreakthrough)}</span>` : ''}</div>
          <div class="t-sm t-muted mt8">${esc(lastCheckinText(st.lastDate))}</div>
          <div class="mt8">${stagePipelineHtml(m.stage)}</div>
        </div>
      </div>
      <div class="grid g4 mt16" style="gap:10px">
        ${[['打卡天数', st.checkinDays || 0], ['连续', `${st.streak || 0} 天`], ['视频', `${st.videoTotal || 0} 个`], ['打雾', `${st.mistTotal || 0} 人`]]
      .map(([k, v]) => `<div class="card card-pad" style="text-align:center;padding:10px">
            <div class="t-xl t-bold t-num">${v}</div><div class="t-xs t-dim">${k}</div></div>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="row-between mb8"><div class="t-md t-bold">${esc(stageName(m.stage))} · 任务清单</div>
        <span class="badge ${p.stagePercent >= 100 ? 'badge-success' : 'badge-warn'}">${p.stagePercent}%</span></div>
      ${taskListHtml(p.tasks)}
      ${Array.isArray(m.reasons) && m.reasons.length ? `
        <div class="divider"></div>
        <div class="row-between mb8"><div class="t-md t-bold">创业 / 改变的 20 个理由</div><span class="badge ${m.reasons.length >= 20 ? 'badge-success' : 'badge-warn'}">${m.reasons.length} / 20</span></div>
        <ol style="padding-left:20px;list-style:decimal" class="t-sm col" style="gap:4px">
          ${m.reasons.slice(0, 20).map((r) => `<li>${esc(r)}</li>`).join('')}
        </ol>` : ''}
      ${Array.isArray(m.schedule) && m.schedule.length ? `
        <div class="divider"></div>
        <div class="t-md t-bold mb8">每日时间表</div>
        ${m.schedule.map((s) => `<div class="row" style="gap:10px;padding:6px 0;border-bottom:1px dashed var(--border)">
          <span class="badge mono">${esc(s.time || '')}</span><span class="t-sm">${esc(s.content || '')}</span></div>`).join('')}` : ''}
      <div class="divider"></div>
      <div class="row-between mb8"><div class="t-md t-bold">每周空闲时间</div>
        <span class="t-xs t-dim">${esc(availabilityText(m.availability))}</span></div>
      ${availabilityGridHtml(m.availability)}
      ${(m.availability && m.availability.note) ? `<div class="t-sm t-dim mt8">${esc(m.availability.note)}</div>` : ''}
      <div class="divider"></div>
      <dl class="kv">
        <dt>手机号</dt><dd>${esc(m.phone || '--')}</dd>
        <dt>推荐人</dt><dd>${esc(m.referrer || '--')}</dd>
        <dt>领导人</dt><dd>${esc(m.leaderName || '--')}</dd>
        <dt>入组日期</dt><dd>${cnDate(m.startDate)}</dd>
        <dt>标签</dt><dd>${(m.tags || []).map((t) => `<span class="badge" style="margin-right:4px">${esc(t)}</span>`).join('') || '--'}</dd>
        <dt>备注</dt><dd>${esc(m.note || '--')}</dd>
      </dl>`;

    if (tab === 'checkins') return `
      <div class="row-between mb12">
        <div class="t-sm t-dim">共 ${data.checkins.length} 条打卡</div>
        <button class="btn btn-primary btn-sm" data-act="add-checkin">${icon('plus', 14)} 补录打卡</button>
      </div>
      ${data.checkins.length ? data.checkins.slice(0, 60).map((c) => `
        <div class="card card-pad mb8" style="padding:12px">
          <div class="row-between">
            <div class="row" style="gap:8px"><span class="t-md t-bold">${md(c.date)}</span>${stageBadge(c.stage)}
              ${c.dayIndex ? `<span class="badge">Day${c.dayIndex} ${esc(c.dayTopic || '')}</span>` : ''}</div>
            <div class="row" style="gap:6px">${scoreBadge(c.score)}
              <button class="btn btn-sm" data-act="review" data-id="${c.id}">点评</button></div>
          </div>
          <div class="t-sm t-muted mt8">${esc(checkinSummary(c))}</div>
          ${c.voiceSummary ? `<div class="t-sm mt8" style="padding:8px;background:var(--surface-2);border-radius:var(--r-sm)">🎙 ${esc(c.voiceSummary)}</div>` : ''}
          ${c.mistLearned ? `<div class="t-sm t-dim mt8">打雾收获：${esc(c.mistLearned)}</div>` : ''}
          ${c.review ? `<div class="t-sm mt8" style="padding:8px;background:var(--brand-50);border-radius:var(--r-sm);color:var(--brand)">点评（${esc(c.reviewer || '')}）：${esc(c.review)}</div>` : ''}
          ${Array.isArray(c.mistList) && c.mistList.length ? `<div class="row wrap mt8" style="gap:5px">
            ${c.mistList.map((g) => `<span class="badge">${esc(g.name)} · ${g.star}星${g.note ? ` · ${esc(g.note)}` : ''}</span>`).join('')}</div>` : ''}
        </div>`).join('') : emptyHtml('还没有打卡记录')}`;

    if (tab === 'bt') return `
      <div class="row-between mb12">
        <div class="t-sm t-dim">闯关记录</div>
        ${ctx.user.role !== 'member' ? `<button class="btn btn-primary btn-sm" data-act="add-bt">${icon('plus', 14)} 登记闯关</button>` : ''}
      </div>
      ${data.breakthroughs.length ? data.breakthroughs.map((b) => `
        <div class="card card-pad mb8" style="padding:12px">
          <div class="row-between">
            <div><span class="t-md t-bold">${esc(b.typeName)}</span> <span class="t-xs t-dim">${md(b.date)}</span></div>
            <div class="row" style="gap:6px">${btStatusBadge(b.status)} ${scoreBadge(b.score)}
              ${ctx.user.role === 'admin' ? `<button class="btn btn-ghost btn-sm" data-act="del-bt" data-id="${b.id}">${icon('trash', 13)}</button>` : ''}</div>
          </div>
          ${b.note ? `<div class="t-sm t-dim mt8">${esc(b.note)}</div>` : ''}
        </div>`).join('') : emptyHtml('还没有闯关记录', '阶段二需要完成大闯关（四选一）')}
      <div class="divider"></div>
      <div class="row-between mb8"><div class="t-md t-bold">大会 / 课堂参加记录</div>
        ${ctx.user.role !== 'member' ? `<button class="btn btn-sm" data-act="add-event">${icon('plus', 14)} 登记</button>` : ''}</div>
      ${data.events.length ? data.events.map((e) => `<div class="row" style="gap:8px;padding:7px 0;border-bottom:1px dashed var(--border)">
          <span class="badge badge-info">${esc(e.name)}</span><span class="t-sm t-dim">${cnDate(e.date)}</span></div>`).join('')
      : '<div class="t-sm t-dim">暂无参会记录</div>'}`;

    if (tab === 'edit') return `<div id="edit-form">${memberFormHtml(data.member, { config: ctx.config, leaders: data.leaders })}</div>`;
    return '';
  };

  api.member(id).then((d) => {
    data = d;
    const m = d.member;
    const dr = drawer({
      title: m.name,
      subtitle: `${stageName(m.stage)} · ${m.phone || '未填手机号'}`,
      width: 'min(680px,100%)',
      body: `
        <div class="tabs" id="dtabs">
          <div class="tab active" data-tab="overview">概览</div>
          <div class="tab" data-tab="checkins">打卡 ${d.checkins.length}</div>
          <div class="tab" data-tab="bt">闯关 ${d.breakthroughs.length}</div>
          ${ctx.user.role !== 'member' ? '<div class="tab" data-tab="edit">编辑资料</div>' : ''}
        </div>
        <div id="dbody" class="mt16"></div>`,
      footer: `<button class="btn" data-act="close">关闭</button>
        <span class="spacer"></span>
        <button class="btn btn-primary hide" data-act="save-edit">${icon('save', 15)} 保存资料</button>`,
      onMount(root, closeFn) {
        const bodyHost = $('#dbody', root);
        const paint = () => {
          bodyHost.innerHTML = body();
          $$('.tab', root).forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
          $('[data-act="save-edit"]', root).classList.toggle('hide', tab !== 'edit');
          if (tab === 'edit') mountMemberForm($('#edit-form', bodyHost));
        };
        $$('.tab', root).forEach((t) => { t.onclick = () => { tab = t.dataset.tab; paint(); }; });
        paint();

        delegate(root, {
          close: () => closeFn(),
          'save-edit': async () => {
            const payload = readMemberForm($('#edit-form', bodyHost));
            try {
              await api.updateMember(id, payload);
              toast('资料已保存', 'ok');
              const fresh = await api.member(id);
              data = fresh;
              tab = 'overview';
              paint();
              onDone && onDone();
            } catch (e) { toast(e.message, 'err'); }
          },
          'add-checkin': () => openCheckinModal(m, ctx, () => api.member(id).then((f) => { data = f; paint(); onDone && onDone(); })),
          review: async (el) => {
            const c = data.checkins.find((x) => x.id === el.dataset.id);
            modal({
              title: `点评 · ${m.name} ${md(c.date)}`,
              body: `<div id="rform">${reviewFormHtml(c)}</div>
                <div class="t-sm t-muted mt12" style="padding:10px;background:var(--surface-2);border-radius:var(--r-sm)">${esc(checkinSummary(c))}</div>`,
              footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>保存点评</button>`,
              onMount(r2, close2) {
                $('[data-cancel]', r2).onclick = close2;
                $('[data-save]', r2).onclick = async () => {
                  try {
                    await api.updateCheckin(c.id, readReviewForm($('#rform', r2)));
                    toast('点评已保存', 'ok');
                    close2();
                    const fresh = await api.member(id); data = fresh; paint(); onDone && onDone();
                  } catch (e) { toast(e.message, 'err'); }
                };
              }
            });
          },
          'add-bt': () => openBreakthroughModal(m, ctx, () => api.member(id).then((f) => { data = f; paint(); onDone && onDone(); })),
          'del-bt': async (el) => {
            await api.deleteBreakthrough(el.dataset.id);
            toast('已删除');
            const fresh = await api.member(id); data = fresh; paint();
          },
          'add-event': () => openEventModal(m, ctx, () => api.member(id).then((f) => { data = f; paint(); }))
        });
      }
    });
  }).catch((e) => toast(e.message, 'err'));
}

/* ------------------------------ 补录打卡 ------------------------------ */
export function openCheckinModal(member, ctx, onDone) {
  modal({
    title: `${member.name} · 学习打卡`,
    size: 'modal-lg',
    body: `<div id="cform">${checkinFormHtml({ config: ctx.config, stage: member.stage, memberId: member.id })}</div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>${icon('check', 15)} 提交打卡</button>`,
    onMount(root, closeFn) {
      mountCheckinForm($('#cform', root), {});
      $('[data-cancel]', root).onclick = closeFn;
      $('[data-save]', root).onclick = async () => {
        const data = readCheckinForm($('#cform', root));
        try {
          await api.createCheckin({ ...data, memberId: member.id });
          toast('打卡已提交', 'ok');
          closeFn();
          onDone && onDone();
        } catch (e) { toast(e.message, 'err'); }
      };
    }
  });
}

export function openBreakthroughModal(member, ctx, onDone) {
  modal({
    title: `${member.name} · 登记闯关`,
    size: 'modal-sm',
    body: `<div class="col" style="gap:12px">
      <div class="field"><label>闯关项目</label>
        <select class="select" data-f="type">
          ${(ctx.config.breakthroughTypes || []).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}
          <option value="market">市场前期闯关</option>
        </select></div>
      <div class="field"><label>结果</label>
        <select class="select" data-f="status">
          <option value="pending">待考核</option><option value="passed">通过</option><option value="failed">未通过</option>
        </select></div>
      <div class="field"><label>日期</label><input class="input" type="date" data-f="date" value="${todayStr()}"></div>
      <div class="field"><label>评分（1-5）</label><input class="input" type="number" min="1" max="5" data-f="score"></div>
      <div class="field"><label>点评备注</label><textarea class="textarea" data-f="note"></textarea></div>
    </div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>保存</button>`,
    onMount(root, closeFn) {
      $('[data-cancel]', root).onclick = closeFn;
      $('[data-save]', root).onclick = async () => {
        const g = (k) => $(`[data-f="${k}"]`, root).value;
        try {
          const type = g('type');
          const t = (ctx.config.breakthroughTypes || []).find((b) => b.id === type);
          await api.createBreakthrough({
            memberId: member.id, type, typeName: t ? t.name : '市场前期闯关',
            status: g('status'), date: g('date'), score: g('score') || null, note: g('note')
          });
          toast('闯关记录已登记', 'ok');
          closeFn(); onDone && onDone();
        } catch (e) { toast(e.message, 'err'); }
      };
    }
  });
}

export function openEventModal(member, ctx, onDone) {
  modal({
    title: `${member.name} · 登记参会`,
    size: 'modal-sm',
    body: `<div class="col" style="gap:12px">
      <div class="field"><label>活动</label>
        <select class="select" data-f="type">
          <option value="kenClass">Ken 哥课堂</option><option value="allHuman">全人类大会</option>
        </select></div>
      <div class="field"><label>日期</label><input class="input" type="date" data-f="date" value="${todayStr()}"></div>
    </div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>保存</button>`,
    onMount(root, closeFn) {
      $('[data-cancel]', root).onclick = closeFn;
      $('[data-save]', root).onclick = async () => {
        try {
          await api.createEvent({ memberId: member.id, type: $('[data-f="type"]', root).value, date: $('[data-f="date"]', root).value });
          toast('已登记', 'ok'); closeFn(); onDone && onDone();
        } catch (e) { toast(e.message, 'err'); }
      };
    }
  });
}
