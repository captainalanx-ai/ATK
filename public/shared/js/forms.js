/* 共享表单：新人档案 / 每日打卡
   网页版与手机端复用同一套字段与取值逻辑，保证数据口径一致 */
import { $, $$, esc, icon, todayStr } from './utils.js';
import { stageMeta } from './format.js';

/* 配置里还没下发时的兜底（老数据库 / 首次加载） */
const DEFAULT_EMPLOYMENT_TYPES = [
  { id: 'fulltime', name: '全职', desc: '全职投入，白天大部分时间都能安排' },
  { id: 'parttime', name: '兼职', desc: '有本职工作/学业，只能按空闲时段安排' }
];
const DEFAULT_WEEK_DAYS = [
  { id: 1, name: '周一' }, { id: 2, name: '周二' }, { id: 3, name: '周三' },
  { id: 4, name: '周四' }, { id: 5, name: '周五' }, { id: 6, name: '周六' }, { id: 7, name: '周日' }
];
const DEFAULT_TIME_SLOTS = [
  { id: 'am', name: '上午', time: '09:00-12:00' },
  { id: 'pm', name: '下午', time: '12:00-18:00' },
  { id: 'ev', name: '晚上', time: '18:00-22:00' }
];

/* ============================== 新人档案 ============================== */
export function memberFormHtml(member = {}, opt = {}) {
  const cfg = opt.config || {};
  const m = member;
  const leaders = opt.leaders || [];
  const stages = cfg.stages || [];
  const bts = cfg.breakthroughTypes || [];
  const leaderOptions = leaders.length
    ? leaders.map((l) => `<option value="${esc(l.name)}" ${m.leaderName === l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('')
    : `<option value="${esc(m.leaderName || '')}">${esc(m.leaderName || '未指定')}</option>`;

  const reasons = Array.isArray(m.reasons) ? m.reasons.join('\n') : '';
  const schedule = Array.isArray(m.schedule) ? m.schedule.map((s) => `${s.time || ''} ${s.content || ''}`.trim()).join('\n') : '';
  const tags = Array.isArray(m.tags) ? m.tags.join(' ') : '';
  const answers = m.marketAnswers || {};
  const empTypes = cfg.employmentTypes || DEFAULT_EMPLOYMENT_TYPES;
  const weekDays = cfg.weekDays || DEFAULT_WEEK_DAYS;
  const timeSlots = cfg.timeSlots || DEFAULT_TIME_SLOTS;
  const availSlots = (m.availability && m.availability.slots) || {};
  const availNote = (m.availability && m.availability.note) || '';

  return `
  <div class="grid g2" style="gap:14px">
    <div class="field"><label>姓名 *</label><input class="input" data-f="name" value="${esc(m.name || '')}" placeholder="新人姓名"></div>
    <div class="field"><label>手机号（登录账号）</label><input class="input" data-f="phone" value="${esc(m.phone || '')}" placeholder="用于登录，默认密码 123456"></div>
    <div class="field"><label>性别</label>
      <select class="select" data-f="gender">
        <option value="">未填</option>
        <option value="女" ${m.gender === '女' ? 'selected' : ''}>女</option>
        <option value="男" ${m.gender === '男' ? 'selected' : ''}>男</option>
      </select></div>
    <div class="field"><label>微信号</label><input class="input" data-f="wechat" value="${esc(m.wechat || '')}"></div>
    <div class="field"><label>带教领导人</label><select class="select" data-f="leaderName">${leaderOptions}</select></div>
    <div class="field"><label>推荐人</label><input class="input" data-f="referrer" value="${esc(m.referrer || '')}"></div>
    <div class="field"><label>入组日期</label><input class="input" type="date" data-f="startDate" value="${esc(m.startDate || todayStr())}"></div>
    <div class="field"><label>当前阶段</label>
      <select class="select" data-f="stage">
        ${stages.map((s) => `<option value="${s.id}" ${Number(m.stage) === s.id ? 'selected' : ''}>${esc(s.short)} · ${esc(s.name)}</option>`).join('')}
      </select></div>
    <div class="field"><label>状态</label>
      <select class="select" data-f="status">
        <option value="active" ${m.status === 'active' ? 'selected' : ''}>在培</option>
        <option value="risk" ${m.status === 'risk' ? 'selected' : ''}>需关注</option>
        <option value="paused" ${m.status === 'paused' ? 'selected' : ''}>暂停</option>
        <option value="graduated" ${m.status === 'graduated' ? 'selected' : ''}>已通关</option>
      </select></div>
    <div class="field"><label>主攻闯关项（阶段二）</label>
      <select class="select" data-f="focusBreakthrough">
        <option value="">未选择</option>
        ${bts.map((b) => `<option value="${b.id}" ${m.focusBreakthrough === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
      </select></div>
    <div class="field"><label>开业七件事讲解次数</label><input class="input" type="number" min="0" max="10" data-f="openingTimes" data-type="num" value="${Number(m.openingTimes) || 0}"></div>
    <div class="field"><label>投入方式</label>
      <select class="select" data-f="employmentType">
        <option value="">未填写</option>
        ${empTypes.map((t) => `<option value="${t.id}" ${(m.employmentType || '') === t.id ? 'selected' : ''}>${esc(t.name)}${t.desc ? ' · ' + esc(t.desc) : ''}</option>`).join('')}
      </select></div>
  </div>

  <div class="divider"></div>
  <div class="field">
    <label>每周空闲时间 <span class="hint" style="display:inline;margin-left:6px">点格子选择，用于统一安排学习与打雾时间</span></label>
    <div class="avail-grid">
      <div class="avail-row">
        <div class="avail-day"></div>
        ${timeSlots.map((s) => `<div class="avail-head">${esc(s.name)}<span>${esc(s.time)}</span></div>`).join('')}
      </div>
      ${weekDays.map((d) => `<div class="avail-row">
        <div class="avail-day">${esc(d.name)}</div>
        ${timeSlots.map((s) => {
          const on = (availSlots[String(d.id)] || []).includes(s.id);
          return `<button type="button" class="avail-cell ${on ? 'on' : ''}" data-avail data-day="${d.id}" data-slot="${s.id}" data-on="${on ? '1' : '0'}">${icon('check', 14)}</button>`;
        }).join('')}
      </div>`).join('')}
    </div>
    <div class="row" style="justify-content:space-between;margin-top:6px">
      <span class="hint" data-avail-summary></span>
      <button type="button" class="btn btn-ghost btn-sm" data-avail-clear>清空</button>
    </div>
  </div>
  <div class="field"><label>空闲时间补充说明</label>
    <input class="input" data-f="availNote" value="${esc(availNote)}" placeholder="例如：周三下午要接孩子，尽量安排上午或晚上"></div>

  <div class="divider"></div>
  <div class="field"><label>创业 / 改变的 20 个理由</label>
    <textarea class="textarea" data-f="reasons" rows="5" placeholder="每行一条，写满 20 条；要求丰富、且感性">${esc(reasons)}</textarea>
    <span class="hint" data-count="reasons"></span></div>

  <div class="field mt12"><label>每日时间表</label>
    <textarea class="textarea" data-f="schedule" rows="5" placeholder="每行一条，例如：&#10;07:00-07:30 晨读 + 三大员背诵&#10;09:00-12:00 打雾 2 位领导">${esc(schedule)}</textarea>
    <span class="hint">养成时间表制定习惯，向上管理</span></div>

  <div class="field mt12"><label>市场三问（阶段四）</label>
    <div class="grid" style="gap:8px">
      <input class="input" data-f="answer_what" value="${esc(answers.what || '')}" placeholder="做什么？">
      <input class="input" data-f="answer_how" value="${esc(answers.how || '')}" placeholder="怎么做？">
      <input class="input" data-f="answer_result" value="${esc(answers.result || '')}" placeholder="做的怎么样？">
    </div></div>

  <div class="grid g2 mt12" style="gap:14px">
    <div class="field"><label>标签</label><input class="input" data-f="tags" data-type="tags" value="${esc(tags)}" placeholder="空格分隔，如：新进 重点"></div>
    <div class="field"><label>备注</label><input class="input" data-f="note" value="${esc(m.note || '')}"></div>
  </div>`;
}

/** 绑定新人表单里的空闲时间网格（点格子选中 / 取消，清空按钮） */
export function mountMemberForm(root) {
  const sync = () => {
    const n = $$('[data-avail][data-on="1"]', root).length;
    const el = $('[data-avail-summary]', root);
    if (el) el.textContent = n ? `已选 ${n} 个空闲时段` : '还没选择空闲时段（兼职建议必填）';
  };
  $$('[data-avail]', root).forEach((cell) => {
    cell.addEventListener('click', () => {
      const on = cell.dataset.on === '1';
      cell.dataset.on = on ? '0' : '1';
      cell.classList.toggle('on', !on);
      sync();
    });
  });
  const clearBtn = $('[data-avail-clear]', root);
  if (clearBtn) {
    clearBtn.onclick = () => {
      $$('[data-avail]', root).forEach((c) => { c.dataset.on = '0'; c.classList.remove('on'); });
      sync();
    };
  }
  sync();
}

export function readMemberForm(root) {
  const get = (k) => {
    const el = $(`[data-f="${k}"]`, root);
    return el ? el.value : '';
  };
  const availSlots = {};
  $$('[data-avail][data-on="1"]', root).forEach((cell) => {
    const d = String(cell.dataset.day);
    (availSlots[d] = availSlots[d] || []).push(cell.dataset.slot);
  });
  const reasons = String(get('reasons') || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const schedule = String(get('schedule') || '').split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
    const m = /^(\S+)\s+(.*)$/.exec(line);
    return m ? { time: m[1], content: m[2] } : { time: '', content: line };
  });
  return {
    name: get('name').trim(),
    phone: get('phone').trim(),
    gender: get('gender'),
    wechat: get('wechat').trim(),
    leaderName: get('leaderName'),
    referrer: get('referrer').trim(),
    startDate: get('startDate'),
    stage: Number(get('stage')) || 1,
    status: get('status'),
    focusBreakthrough: get('focusBreakthrough'),
    openingTimes: Number(get('openingTimes')) || 0,
    employmentType: get('employmentType'),
    availability: { slots: availSlots, note: get('availNote').trim() },
    reasons,
    schedule,
    marketAnswers: { what: get('answer_what'), how: get('answer_how'), result: get('answer_result') },
    tags: String(get('tags') || '').split(/[\s,，]+/).filter(Boolean),
    note: get('note')
  };
}

/* ============================== 每日打卡 ============================== */
function guestRow(g = {}) {
  return `<div class="row" data-guest style="gap:6px;margin-bottom:6px">
    <input class="input" data-g="name" value="${esc(g.name || '')}" placeholder="嘉宾姓名" style="flex:1.4">
    <select class="select" data-g="star" style="flex:none;width:88px">
      ${[1, 2, 3, 4, 5].map((s) => `<option value="${s}" ${(Number(g.star) || 1) === s ? 'selected' : ''}>${s} 星</option>`).join('')}
    </select>
    <input class="input" data-g="note" value="${esc(g.note || '')}" placeholder="沟通主题" style="flex:1.6">
    <button class="btn btn-ghost btn-icon btn-sm" data-rm-guest title="移除">${icon('x', 15)}</button>
  </div>`;
}

export function checkinFormHtml(opt = {}) {
  const cfg = opt.config || {};
  const c = opt.record || {};
  const date = c.date || opt.date || todayStr();
  const stage = Number(c.stage || opt.stage || 1);
  const videos = cfg.videos || [];
  const topics = cfg.dayTopics || [];
  const stage1 = cfg.stage1Daily || {};
  const guests = Array.isArray(c.mistList) && c.mistList.length ? c.mistList : [{ name: '', star: 1, note: '' }, { name: '', star: 1, note: '' }];

  return `
  <div class="grid g2" style="gap:14px">
    <div class="field"><label>日期</label><input class="input" type="date" data-f="date" value="${esc(date)}"></div>
    <div class="field"><label>阶段</label>
      <select class="select" data-f="stage">
        ${(cfg.stages || []).map((s) => `<option value="${s.id}" ${stage === s.id ? 'selected' : ''}>${esc(s.short)} · ${esc(s.name)}</option>`).join('')}
      </select></div>
  </div>

  <div data-only-stage="1" class="${stage === 1 ? '' : 'hide'}">
    <div class="divider"></div>
    <div class="grid g2" style="gap:14px">
      <div class="field"><label>今日主题（Day）</label>
        <select class="select" data-f="dayIndex">
          <option value="">未指定</option>
          ${topics.map((t) => `<option value="${t.day}" ${Number(c.dayIndex) === t.day ? 'selected' : ''}>Day${t.day} · ${esc(t.title)}</option>`).join('')}
        </select></div>
      <div class="field"><label>今日视频</label>
        <select class="select" data-f="videoId">
          <option value="">未选择</option>
          ${videos.map((v) => `<option value="${v.id}" ${c.videoId === v.id ? 'selected' : ''}>${esc(v.group)}｜${esc(v.speaker)}·${esc(v.title)}</option>`).join('')}
        </select></div>
    </div>
    <label class="check-row mt12 ${c.videoDone ? 'checked' : ''}" data-toggle="videoDone">
      <span class="check-box">${icon('check', 12)}</span>
      <span class="grow"><span class="check-label">今天看完了 1 个视频</span>
        <span class="check-hint">每天 1 个视频，共 ${videos.length} 个目录循环学习</span></span>
      <input type="checkbox" data-f="videoDone" class="hide" ${c.videoDone ? 'checked' : ''}>
    </label>
  </div>

  <div class="divider"></div>
  <div class="row-between mb8">
    <div>
      <div class="t-md t-bold">${icon('users', 15)} 打雾嘉宾</div>
      <div class="t-xs t-dim">每天 ${stage1.mistPerDay || 2} 位，${stage1.mistStarMin || 1} 星及以上，阶段目标 ${stage1.mistTotalTarget || 30} 人</div>
    </div>
    <span class="badge badge-brand" data-mist-count>${(Array.isArray(c.mistList) ? c.mistList.length : guests.length)} 人</span>
  </div>
  <div data-guests>${guests.map(guestRow).join('')}</div>
  <button class="btn btn-soft btn-sm" data-add-guest>${icon('plus', 14)} 添加嘉宾</button>

  <div class="divider"></div>
  <label class="check-row ${c.voiceDone ? 'checked' : ''}" data-toggle="voiceDone">
    <span class="check-box">${icon('check', 12)}</span>
    <span class="grow"><span class="check-label">语音反馈会后会内容</span>
      <span class="check-hint">每天语音总结当天学习内容</span></span>
    <input type="checkbox" data-f="voiceDone" class="hide" ${c.voiceDone ? 'checked' : ''}>
  </label>

  <div class="field mt12"><label>会后会语音总结</label>
    <textarea class="textarea" data-f="voiceSummary" rows="3" placeholder="今天学了什么、讲给谁听、对方的反馈…">${esc(c.voiceSummary || '')}</textarea></div>
  <div class="field mt12"><label>打雾学到了什么</label>
    <textarea class="textarea" data-f="mistLearned" rows="3" placeholder="向哪位领导/嘉宾请教，解决了什么疑问…">${esc(c.mistLearned || '')}</textarea></div>
  <div class="field mt12"><label>今日心得</label>
    <textarea class="textarea" data-f="learned" rows="3" placeholder="观念、心态、行动上的收获…">${esc(c.learned || '')}</textarea></div>
  <div class="grid g2 mt12" style="gap:14px">
    <div class="field"><label>学习时长（分钟）</label><input class="input" type="number" data-f="minutes" data-type="num" value="${Number(c.minutes) || 0}"></div>
  </div>`;
}

/** 绑定打卡表单的交互（增删嘉宾、勾选、阶段联动） */
export function mountCheckinForm(root, opt = {}) {
  const add = $('[data-add-guest]', root);
  const box = $('[data-guests]', root);
  const counter = $('[data-mist-count]', root);
  const stageSel = $('[data-f="stage"]', root);
  const updateCount = () => { if (counter) counter.textContent = `${$$('[data-guest]', box).length} 人`; };

  if (add) {
    add.onclick = () => {
      const div = document.createElement('div');
      div.innerHTML = guestRow({ star: 1 });
      box.appendChild(div.firstElementChild);
      updateCount();
    };
  }
  box.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm-guest]');
    if (!rm) return;
    const row = rm.closest('[data-guest]');
    if ($$('[data-guest]', box).length <= 1) { row.querySelectorAll('input').forEach((i) => { i.value = ''; }); return; }
    row.remove();
    updateCount();
  });

  // 勾选行
  $$('[data-toggle]', root).forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('input,button,select,textarea')) return;
      const cb = $('input[type=checkbox]', row);
      cb.checked = !cb.checked;
      row.classList.toggle('checked', cb.checked);
    });
  });

  // 阶段联动：只有阶段一显示视频 / Day 主题
  if (stageSel) {
    const sync = () => {
      const s = Number(stageSel.value);
      $$('[data-only-stage="1"]', root).forEach((el) => el.classList.toggle('hide', s !== 1));
    };
    stageSel.addEventListener('change', sync);
    sync();
  }
  updateCount();

  // 理由计数
  const reasonsEl = $('[data-f="reasons"]', root);
  const cnt = $('[data-count="reasons"]', root);
  if (reasonsEl && cnt) {
    const upd = () => {
      const n = reasonsEl.value.split('\n').filter((s) => s.trim()).length;
      cnt.textContent = `已写 ${n} / 20 条${n >= 20 ? ' ✓' : ''}`;
      cnt.style.color = n >= 20 ? 'var(--success)' : 'var(--text-3)';
    };
    reasonsEl.addEventListener('input', upd);
    upd();
  }
}

export function readCheckinForm(root) {
  const val = (k) => { const el = $(`[data-f="${k}"]`, root); return el ? el.value : ''; };
  const checked = (k) => { const el = $(`[data-f="${k}"]`, root); return el ? el.checked : false; };
  const cfgVideos = (window.__ATK_CONFIG__ && window.__ATK_CONFIG__.videos) || [];
  const videoId = val('videoId');
  const v = cfgVideos.find((x) => x.id === videoId);
  const guests = $$('[data-guest]', root).map((row) => ({
    name: ($('[data-g="name"]', row) || {}).value || '',
    star: Number(($('[data-g="star"]', row) || {}).value) || 1,
    note: ($('[data-g="note"]', row) || {}).value || ''
  })).filter((g) => g.name.trim());
  return {
    date: val('date'),
    stage: Number(val('stage')) || 1,
    dayIndex: val('dayIndex') ? Number(val('dayIndex')) : null,
    videoId,
    videoTitle: v ? `${v.speaker}·${v.title}` : '',
    videoDone: checked('videoDone'),
    mistCount: guests.length,
    mistList: guests,
    voiceDone: checked('voiceDone'),
    voiceSummary: val('voiceSummary'),
    mistLearned: val('mistLearned'),
    learned: val('learned'),
    minutes: Number(val('minutes')) || 0
  };
}

/* ============================== 点评表单 ============================== */
export function reviewFormHtml(c = {}) {
  return `
  <div class="field"><label>评分</label>
    <select class="select" data-f="score">
      <option value="">未评分</option>
      ${[5, 4, 3, 2, 1].map((s) => `<option value="${s}" ${Number(c.score) === s ? 'selected' : ''}>${s} 分 · ${['需重做', '待加强', '基本达标', '良好', '优秀'][5 - s]}</option>`).join('')}
    </select></div>
  <div class="field mt12"><label>领导人点评</label>
    <textarea class="textarea" data-f="review" rows="4" placeholder="肯定做得好的地方，指出下一步要改的点">${esc(c.review || '')}</textarea></div>
  <div class="field mt12"><label>点评人</label><input class="input" data-f="reviewer" value="${esc(c.reviewer || '')}"></div>`;
}

export function readReviewForm(root) {
  const val = (k) => { const el = $(`[data-f="${k}"]`, root); return el ? el.value : ''; };
  return { score: val('score') === '' ? null : Number(val('score')), review: val('review'), reviewer: val('reviewer') };
}

export { stageMeta };
