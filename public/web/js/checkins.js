/* 打卡记录：列表 + 筛选 + 审核点评 */
import { $, $$, esc, icon, md, todayStr, addDaysStr, debounce, cnDate } from '/shared/js/utils.js';
import { api } from '/shared/js/api.js';
import { toast, modal, confirmDialog, pagerHtml, bindPager, emptyHtml, avatarHtml, delegate } from '/shared/js/ui.js';
import { stageBadge, checkinSummary, scoreBadge, stageName } from '/shared/js/format.js';
import { checkinFormHtml, mountCheckinForm, readCheckinForm, reviewFormHtml, readReviewForm } from '/shared/js/forms.js';
import { openDetail } from './members.js';

const f = { memberId: '', stage: '', from: '', to: '', pending: false, page: 1, pageSize: 15 };

export async function render(host, ctx) {
  host.innerHTML = `
  <div class="card">
    <div class="toolbar">
      <select class="select" id="c-member"><option value="">全部新人</option></select>
      <select class="select" id="c-stage">
        <option value="">全部阶段</option>
        ${(ctx.config.stages || []).map((s) => `<option value="${s.id}">${esc(s.short)}</option>`).join('')}
      </select>
      <input class="input" type="date" id="c-from" title="开始日期">
      <input class="input" type="date" id="c-to" title="结束日期">
      <button class="btn btn-sm" id="c-week">近 7 天</button>
      <label class="row t-sm" style="gap:6px;cursor:pointer">
        <span class="switch" id="c-pending"></span> 仅看待点评
      </label>
      <div class="spacer"></div>
      ${ctx.user.role === 'member' ? '' : '<button class="btn btn-sm" id="c-add-all">补录打卡</button>'}
      <button class="btn btn-primary btn-sm" id="c-add">${icon('plus', 14)} 我要打卡</button>
    </div>
    <div class="table-wrap"><table class="table" id="tbl"></table></div>
    <div style="padding:0 16px 14px" id="pager"></div>
  </div>`;

  const memberList = await api.members({ pageSize: 200 });
  $('#c-member').innerHTML = `<option value="">全部新人</option>` +
    memberList.items.map((m) => `<option value="${m.id}">${esc(m.name)}${m.phone ? ` · ${esc(m.phone)}` : ''}</option>`).join('');
  $('#c-week').onclick = () => { $('#c-from').value = addDaysStr(todayStr(), -6); $('#c-to').value = todayStr(); f.from = $('#c-from').value; f.to = $('#c-to').value; f.page = 1; load(); };
  $('#c-member').onchange = (e) => { f.memberId = e.target.value; f.page = 1; load(); };
  $('#c-stage').onchange = (e) => { f.stage = e.target.value; f.page = 1; load(); };
  $('#c-from').onchange = (e) => { f.from = e.target.value; f.page = 1; load(); };
  $('#c-to').onchange = (e) => { f.to = e.target.value; f.page = 1; load(); };
  $('#c-pending').onclick = (e) => { f.pending = !f.pending; e.target.classList.toggle('on', f.pending); f.page = 1; load(); };
  $('#c-add').onclick = () => {
    const mid = f.memberId || (ctx.user.role === 'member' ? ctx.user.memberId : (memberList.items[0] || {}).id);
    const m = memberList.items.find((x) => x.id === mid);
    if (!m) return toast('请先选择一位新人', 'err');
    openCheckin(m, ctx, load);
  };
  const addAll = $('#c-add-all');
  if (addAll) addAll.onclick = () => {
    const m = memberList.items.find((x) => x.id === f.memberId) || memberList.items[0];
    if (!m) return toast('请先新增新人', 'err');
    openCheckin(m, ctx, load);
  };

  const load = async () => {
    const tbl = $('#tbl');
    const pager = $('#pager');
    try {
      const res = await api.checkins({ ...f, pending: f.pending ? 1 : '' });
      if (!res.items.length) {
        tbl.innerHTML = `<tbody><tr><td>${emptyHtml('没有符合条件的打卡记录')}</td></tr></tbody>`;
        pager.innerHTML = '';
        return;
      }
      tbl.innerHTML = `
        <thead><tr>
          <th>日期</th><th>新人</th><th>阶段</th><th>今日内容</th>
          <th>视频</th><th>打雾</th><th>会后会</th><th>评分</th><th style="text-align:right">操作</th>
        </tr></thead>
        <tbody>${res.items.map(row).join('')}</tbody>`;
      pager.innerHTML = pagerHtml(res.page, res.pageSize, res.total);
      bindPager(pager, (p) => { f.page = p; load(); });
      $$('[data-review]', tbl).forEach((b) => { b.onclick = () => reviewOne(b.dataset.review, ctx, load); });
      $$('[data-person]', tbl).forEach((b) => { b.onclick = () => openDetail(b.dataset.person, ctx, () => {}); });
      $$('[data-del]', tbl).forEach((b) => {
        b.onclick = async () => {
          if (!await confirmDialog('确定删除这条打卡记录吗？', { danger: true, okText: '删除' })) return;
          await api.deleteCheckin(b.dataset.del); toast('已删除'); load();
        };
      });
    } catch (e) {
      tbl.innerHTML = `<tbody><tr><td class="t-danger" style="padding:20px">${esc(e.message)}</td></tr></tbody>`;
    }
  };
  await load();
}

function row(c) {
  return `<tr>
    <td class="nowrap"><span class="t-md t-bold">${md(c.date)}</span><div class="t-xs t-dim">${cnDate(c.date)}</div></td>
    <td>
      <div class="member-cell">
        ${avatarHtml(c.memberName, 'avatar-sm')}
        <span class="t-sm t-bold" style="cursor:pointer" data-person="${c.memberId}">${esc(c.memberName)}</span>
      </div>
    </td>
    <td>${stageBadge(c.stage)}${c.dayIndex ? `<div class="t-xs t-dim">Day${c.dayIndex} ${esc(c.dayTopic || '')}</div>` : ''}</td>
    <td><div class="t-sm clamp2" style="max-width:320px">${esc(c.voiceSummary || c.learned || c.mistLearned || checkinSummary(c))}</div>
      <div class="t-xs t-dim">${esc(checkinSummary(c))}</div></td>
    <td>${c.videoDone ? `<span class="badge badge-success">✓ ${esc((c.videoTitle || '').slice(0, 14))}</span>` : '<span class="t-dim t-sm">—</span>'}</td>
    <td class="t-num t-bold">${c.mistCount || 0}</td>
    <td>${c.voiceDone ? '<span class="badge badge-info">已反馈</span>' : '<span class="t-dim t-sm">—</span>'}</td>
    <td>${scoreBadge(c.score)}</td>
    <td style="text-align:right" class="nowrap">
      ${c.reviewed ? '<span class="badge badge-success">已点评</span>' : '<span class="badge badge-warn">待点评</span>'}
      <button class="btn btn-sm" data-review="${c.id}">点评</button>
      <button class="btn btn-ghost btn-sm" data-del="${c.id}">${icon('trash', 14)}</button>
    </td>
  </tr>`;
}

function reviewOne(id, ctx, onDone) {
  api.checkins({ pageSize: 300 }).then((res) => {
    const c = res.items.find((x) => x.id === id);
    if (!c) return toast('记录不存在', 'err');
    modal({
      title: `点评 · ${c.memberName} ${md(c.date)}`,
      size: 'modal-sm',
      body: `<div class="t-sm t-muted mb12" style="padding:10px;background:var(--surface-2);border-radius:var(--r-sm);line-height:1.7">
          ${esc(checkinSummary(c))}
          ${c.voiceSummary ? `<br>🎙 ${esc(c.voiceSummary)}` : ''}
          ${c.mistLearned ? `<br>打雾收获：${esc(c.mistLearned)}` : ''}
          ${c.learned ? `<br>心得：${esc(c.learned)}` : ''}
        </div>
        <div id="rform">${reviewFormHtml({ ...c, reviewer: c.reviewer || ctx.user.name })}</div>`,
      footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>保存点评</button>`,
      onMount(root, closeFn) {
        $('[data-cancel]', root).onclick = closeFn;
        $('[data-save]', root).onclick = async () => {
          try {
            await api.updateCheckin(id, readReviewForm($('#rform', root)));
            toast('点评已保存', 'ok'); closeFn(); onDone && onDone();
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    });
  });
}

export function openCheckin(member, ctx, onDone) {
  modal({
    title: `${member.name} · 学习打卡`,
    size: 'modal-lg',
    body: `<div id="cform">${checkinFormHtml({ config: ctx.config, stage: member.stage })}</div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>${icon('check', 15)} 提交打卡</button>`,
    onMount(root, closeFn) {
      mountCheckinForm($('#cform', root), {});
      $('[data-cancel]', root).onclick = closeFn;
      $('[data-save]', root).onclick = async () => {
        const data = readCheckinForm($('#cform', root));
        try {
          await api.createCheckin({ ...data, memberId: member.id });
          toast('打卡已提交', 'ok'); closeFn(); onDone && onDone();
        } catch (e) { toast(e.message, 'err'); }
      };
    }
  });
}
