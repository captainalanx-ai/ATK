/* 闯关考核 / 阶段配置 / 账号权限 */
import { $, $$, esc, icon, md, todayStr, cnDate } from '/shared/js/utils.js';
import { api } from '/shared/js/api.js';
import { toast, modal, confirmDialog, emptyHtml, avatarHtml, pagerHtml, bindPager } from '/shared/js/ui.js';
import { stageBadge, btStatusBadge, scoreBadge, roleBadge, roleName } from '/shared/js/format.js';
import { openDetail, openBreakthroughModal } from './members.js';

/* ============================ 闯关考核 ============================ */
export async function renderBreakthrough(host, ctx) {
  host.innerHTML = `<div class="card"><div class="card-body"><div class="skeleton" style="height:80px"></div></div></div>`;
  const [bt, members] = await Promise.all([api.breakthroughs(), api.members({ pageSize: 200 })]);
  const nameOf = (id) => (members.items.find((m) => m.id === id) || {}).name || '未知';

  host.innerHTML = `
  <div class="card">
    <div class="card-head">
      <h3>闯关记录 <span class="badge">${bt.length}</span></h3>
      <button class="btn btn-primary btn-sm" id="bt-add">${icon('plus', 14)} 登记闯关</button>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>新人</th><th>闯关项目</th><th>日期</th><th>结果</th><th>评分</th><th>点评</th><th style="text-align:right">操作</th></tr></thead>
      <tbody>${bt.length ? bt.map((b) => `<tr>
        <td><span class="t-sm t-bold" style="cursor:pointer" data-person="${b.memberId}">${esc(b.memberName || nameOf(b.memberId))}</span></td>
        <td class="t-sm t-bold">${esc(b.typeName)}</td>
        <td class="nowrap">${cnDate(b.date)}</td>
        <td>${btStatusBadge(b.status)}</td>
        <td>${scoreBadge(b.score)}</td>
        <td class="t-sm t-dim clamp2" style="max-width:260px">${esc(b.note || '--')}</td>
        <td style="text-align:right" class="nowrap">
          <button class="btn btn-sm" data-pass="${b.id}">标记通过</button>
          <button class="btn btn-ghost btn-sm" data-del="${b.id}">${icon('trash', 14)}</button>
        </td></tr>`).join('') : `<tr><td>${emptyHtml('还没有闯关记录')}</td></tr>`}
      </tbody></table></div>
  </div>

  <div class="card mt16">
    <div class="card-head"><h3>四类大闯关 · 通过情况</h3></div>
    <div class="card-body grid g2" style="gap:12px">
      ${(ctx.config.breakthroughTypes || []).map((t) => {
    const rows = bt.filter((b) => b.type === t.id);
    const passed = rows.filter((b) => b.status === 'passed').length;
    return `<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
          <div class="row-between"><span class="t-md t-bold">${esc(t.name)}</span>
            <span class="badge ${passed ? 'badge-success' : ''}">${passed} / ${rows.length}</span></div>
          <div class="t-xs t-dim mt8">${esc(t.desc || '')}</div>
          <div class="progress mt8"><i style="width:${rows.length ? (passed / rows.length) * 100 : 0}%;background:var(--success)"></i></div>
        </div>`;
  }).join('')}
    </div>
  </div>`;

  $('#bt-add').onclick = () => {
    const m = members.items[0];
    if (!m) return toast('请先新增新人', 'err');
    openBreakthroughModal(m, ctx, () => renderBreakthrough(host, ctx));
  };
  $$('[data-person]', host).forEach((b) => { b.onclick = () => openDetail(b.dataset.person, ctx, () => {}); });
  $$('[data-pass]', host).forEach((b) => {
    b.onclick = async () => {
      await api.updateBreakthrough(b.dataset.pass, { status: 'passed', date: todayStr() });
      toast('已标记为通过', 'ok');
      renderBreakthrough(host, ctx);
    };
  });
  $$('[data-del]', host).forEach((b) => {
    b.onclick = async () => {
      if (!await confirmDialog('确定删除这条闯关记录？', { danger: true, okText: '删除' })) return;
      await api.deleteBreakthrough(b.dataset.del); toast('已删除'); renderBreakthrough(host, ctx);
    };
  });
}

/* ============================ 阶段配置 ============================ */
const SECTIONS = [
  {
    key: 'videos', title: '阶段一 · 视频目录', hint: '每天 1 个视频，8 个目录循环学习',
    fields: [{ k: 'group', ph: '分组', w: '.7fr' }, { k: 'speaker', ph: '讲师', w: '.7fr' }, { k: 'title', ph: '视频标题', w: '2fr' }],
    blank: { group: '行业认知', speaker: '', title: '' }
  },
  {
    key: 'dayTopics', title: '阶段一 · Day1~Day10 主题', hint: '每天一个主题，要点一行一条',
    fields: [{ k: 'title', ph: '主题标题', w: '1fr' }, { k: 'points', ph: '要点（一行一条）', w: '2.4fr', lines: true }],
    blank: { day: 1, title: '', tag: '', points: [] }, numbered: 'day'
  },
  {
    key: 'breakthroughTypes', title: '阶段二 · 大闯关项目', hint: '新人四选一作为重点攻克任务',
    fields: [{ k: 'name', ph: '闯关项', w: '1fr' }, { k: 'desc', ph: '说明', w: '2fr' }],
    blank: { id: '', name: '', desc: '' }
  },
  {
    key: 'stage2Requirements', title: '阶段二 · 其他硬性要求',
    fields: [{ k: 'name', ph: '要求', w: '1fr' }, { k: 'desc', ph: '说明', w: '2fr' }],
    blank: { id: '', name: '', desc: '' }
  },
  {
    key: 'openingSeven', title: '阶段三 · 开业七件事', hint: '需重复学 1-3 次',
    fields: [{ k: 'name', ph: '事项', w: '1fr' }, { k: 'desc', ph: '说明', w: '2fr' }],
    blank: { id: '', name: '', desc: '' }
  },
  {
    key: 'stage3Requirements', title: '阶段三 · 硬性要求',
    fields: [{ k: 'name', ph: '要求', w: '1fr' }, { k: 'desc', ph: '说明', w: '2fr' }],
    blank: { id: '', name: '', desc: '' }
  },
  {
    key: 'stage4Requirements', title: '阶段四 · 市场前期要求',
    fields: [{ k: 'name', ph: '要求', w: '1fr' }, { k: 'desc', ph: '说明', w: '2fr' }],
    blank: { id: '', name: '', desc: '' }
  },
  {
    key: 'threeRoles', title: '三大员 · 每日必背', hint: '每个角色下面是要背诵的要点，一行一条',
    fields: [{ k: 'name', ph: '角色', w: '1fr' }, { k: 'points', ph: '必背要点（一行一条）', w: '2.4fr', lines: true }],
    blank: { id: '', name: '', points: [] }
  },
  {
    key: 'glossary', title: '团队名词词典', hint: '打雾 / P 仔 / 复 A / 复数 等黑话说明',
    fields: [{ k: 'term', ph: '名词', w: '.8fr' }, { k: 'desc', ph: '解释', w: '2.4fr' }],
    blank: { term: '', desc: '' }
  }
];

function listSection(sec, draft) {
  const items = draft[sec.key] || [];
  const rowHtml = (it, i) => `
    <div class="cfg-row" data-row="${i}">
      ${sec.numbered ? `<span class="badge mono">${esc(it[sec.numbered] ?? i + 1)}</span>` : ''}
      ${sec.fields.map((fl) => fl.lines
    ? `<textarea class="textarea" data-i="${i}" data-k="${fl.k}" rows="3" placeholder="${esc(fl.ph)}" style="grid-column:span 2">${esc((it[fl.k] || []).join('\n'))}</textarea>`
    : `<input class="input" data-i="${i}" data-k="${fl.k}" value="${esc(it[fl.k] || '')}" placeholder="${esc(fl.ph)}">`).join('')}
      <button class="btn btn-ghost btn-icon btn-sm" data-rm="${i}" title="删除">${icon('trash', 14)}</button>
    </div>`;
  return `<div class="cfg-editor" data-sec="${sec.key}">
    <div style="padding:10px 12px;background:var(--surface-2);border-bottom:1px solid var(--border)" class="row-between">
      <div><div class="t-sm t-bold">${esc(sec.title)}</div><div class="t-xs t-dim">${esc(sec.hint || '')}</div></div>
      <button class="btn btn-soft btn-sm" data-add-sec="${sec.key}">${icon('plus', 13)} 添加</button>
    </div>
    <div data-rows="${sec.key}">${items.map(rowHtml).join('') || '<div class="t-sm t-dim" style="padding:12px">暂无条目</div>'}</div>
  </div>`;
}

export async function renderConfig(host, ctx) {
  const draft = JSON.parse(JSON.stringify(ctx.config || {}));

  const rebuild = (key) => {
    const sec = SECTIONS.find((s) => s.key === key);
    const holder = $(`[data-sec="${key}"]`, host);
    holder.outerHTML = listSection(sec, draft);
    bindSection(key);
  };

  const bindSection = (key) => {
    const sec = SECTIONS.find((s) => s.key === key);
    const holder = $(`[data-sec="${key}"]`, host);
    if (!holder) return;
    holder.addEventListener('input', (e) => {
      const i = e.target.dataset.i;
      if (i === undefined) return;
      const k = e.target.dataset.k;
      const fl = sec.fields.find((x) => x.k === k);
      draft[key][Number(i)][k] = fl.lines ? e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) : e.target.value;
    });
    const addBtn = $('[data-add-sec]', holder);
    if (addBtn) addBtn.onclick = () => {
      const blank = JSON.parse(JSON.stringify(sec.blank));
      if (sec.numbered) blank[sec.numbered] = (draft[key] || []).length + 1;
      if (!blank.id) blank.id = `${key}_${Date.now().toString(36)}`;
      draft[key] = draft[key] || [];
      draft[key].push(blank);
      rebuild(key);
    };
    $$('[data-rm]', holder).forEach((b) => {
      b.onclick = () => { draft[key].splice(Number(b.dataset.rm), 1); rebuild(key); };
    });
  };

  host.innerHTML = `
  <div class="card">
    <div class="card-head">
      <h3>基础设置</h3>
      <button class="btn btn-primary btn-sm" id="cfg-save">${icon('save', 14)} 保存全部配置</button>
    </div>
    <div class="card-body grid g2" style="gap:14px">
      <div class="field"><label>工作室名称</label><input class="input" data-base="studioName" value="${esc(draft.studioName || '')}"></div>
      <div class="field"><label>系统副标题</label><input class="input" data-base="subtitle" value="${esc(draft.subtitle || '')}"></div>
      <div class="field"><label>逾期预警天数</label><input class="input" type="number" min="1" max="30" data-base="overdueDays" value="${Number(draft.overdueDays) || 2}">
        <span class="hint">超过该天数未打卡，在看板「逾期预警」中提示</span></div>
    </div>
    <div class="card-body" style="padding-top:0">
      <div class="divider"></div>
      <div class="t-sm t-bold mb8">阶段一 · 每日动作标准</div>
      <div class="grid g4" style="gap:14px">
        ${[['videoPerDay', '每天视频数'], ['mistPerDay', '每天打雾人数'], ['mistStarMin', '嘉宾最低星级'], ['mistTotalTarget', '阶段累计打雾目标']]
      .map(([k, label]) => `<div class="field"><label>${label}</label>
          <input class="input" type="number" min="0" data-daily="${k}" value="${Number((draft.stage1Daily || {})[k]) || 0}"></div>`).join('')}
      </div>
    </div>
  </div>

  <div class="card mt16">
    <div class="card-head"><h3>四阶段定义</h3></div>
    <div class="card-body col" style="gap:10px">
      ${(draft.stages || []).map((s, i) => `
        <div class="cfg-row" style="grid-template-columns:auto 1fr 1.8fr auto">
          <span class="badge" style="background:${s.color}1A;color:${s.color};border-color:transparent">${esc(s.short)}</span>
          <input class="input" data-stage="${i}" data-k="name" value="${esc(s.name)}" placeholder="阶段名称">
          <input class="input" data-stage="${i}" data-k="summary" value="${esc(s.summary)}" placeholder="阶段说明">
          <input class="input" type="number" data-stage="${i}" data-k="duration" value="${Number(s.duration) || 0}" style="width:90px" title="建议天数">
        </div>`).join('')}
    </div>
  </div>

  <div class="mt16 col" style="gap:12px">
    ${SECTIONS.map((s) => listSection(s, draft)).join('')}
  </div>

  <div class="card mt16">
    <div class="card-head"><h3>${icon('shield', 15)} 数据备份与恢复</h3></div>
    <div class="card-body col" style="gap:10px">
      <div class="t-sm t-dim">数据保存在服务器 <code class="mono">data/db.json</code>。建议每周导出一次备份；换服务器或误删数据后，用备份文件一键恢复（会覆盖当前全部数据）。</div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="bk-export">${icon('save', 14)} 导出全量备份</button>
        <label class="btn btn-sm" style="cursor:pointer">${icon('refresh', 14)} 导入备份恢复
          <input type="file" id="bk-file" accept="application/json,.json" class="hide">
        </label>
        <button class="btn btn-sm btn-danger" id="bk-clear">${icon('trash', 14)} 清空业务数据</button>
      </div>
      <div id="bk-info" class="t-xs t-dim"></div>
    </div>
  </div>`;

  $('#bk-info', host).textContent = '导出前会先强制落盘一次，保证备份包含最新数据。';
  $('#bk-export', host).onclick = async () => {
    try {
      const data = await api.backup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atk-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('备份文件已下载', 'ok');
    } catch (e) { toast('导出失败：' + e.message, 'err'); }
  };
  $('#bk-file', host).onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const yes = await confirmDialog('导入备份会覆盖当前全部数据（新人、打卡、闯关、账号），确定继续吗？', { danger: true, okText: '覆盖恢复' });
    if (!yes) { e.target.value = ''; return; }
    try {
      const payload = JSON.parse(await file.text());
      const r = await api.restore(payload);
      toast(`已恢复 ${r.members} 位新人 / ${r.checkins} 条打卡，即将刷新`, 'ok');
      setTimeout(() => location.reload(), 900);
    } catch (e2) {
      toast('恢复失败：' + e2.message, 'err');
      e2 && console.error(e2);
    }
    e.target.value = '';
  };
  $('#bk-clear', host).onclick = () => {
    modal({
      title: '清空全部业务数据',
      body: `<div class="col" style="gap:10px">
        <div class="t-sm">将删除全部新人、打卡、闯关、大会记录及新人登录账号；<b>管理员 / 领导人账号与阶段配置会保留</b>。此操作不可恢复，建议先导出一份备份。</div>
        <div class="field"><label>请输入「清空」两个字以确认</label><input class="input" id="clr-input" placeholder="清空"></div>
      </div>`,
      footer: '<button class="btn" data-cancel>取消</button><button class="btn btn-danger" data-ok>确认清空</button>',
      onMount(root, closeFn) {
        $('[data-cancel]', root).onclick = closeFn;
        $('[data-ok]', root).onclick = async () => {
          const v = $('#clr-input', root).value.trim();
          if (v !== '清空') { toast('请输入「清空」两个字', 'err'); return; }
          try {
            await api.clearAll(v);
            toast('已清空全部业务数据', 'ok');
            closeFn();
            setTimeout(() => location.reload(), 800);
          } catch (e) { toast(e.message, 'err'); }
        };
      }
    });
  };

  SECTIONS.forEach((s) => bindSection(s.key));

  $$('[data-base]', host).forEach((el) => {
    el.oninput = () => { draft[el.dataset.base] = el.type === 'number' ? Number(el.value) : el.value; };
  });
  $$('[data-daily]', host).forEach((el) => {
    el.oninput = () => { draft.stage1Daily = draft.stage1Daily || {}; draft.stage1Daily[el.dataset.daily] = Number(el.value); };
  });
  $$('[data-stage]', host).forEach((el) => {
    el.oninput = () => { draft.stages[Number(el.dataset.stage)][el.dataset.k] = el.type === 'number' ? Number(el.value) : el.value; };
  });

  $('#cfg-save').onclick = async () => {
    try {
      const updated = await api.saveConfig(draft);
      window.__ATK_CONFIG__ = updated;
      const { setConfig } = await import('/shared/js/format.js');
      setConfig(updated);
      ctx.state.config = updated;
      toast('配置已保存并同步', 'ok');
      ctx.refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============================ 账号权限 ============================ */
export async function renderUsers(host, ctx) {
  const [users, members] = await Promise.all([api.users(), api.members({ pageSize: 200 })]);
  const memberOptions = members.items.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');

  const paint = () => {
    host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>账号列表 <span class="badge">${users.length}</span></h3>
        <button class="btn btn-primary btn-sm" id="u-add">${icon('plus', 14)} 新增账号</button>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>账号</th><th>姓名</th><th>角色</th><th>关联新人</th><th>手机</th><th>状态</th><th style="text-align:right">操作</th></tr></thead>
        <tbody>${users.map((u) => `<tr>
          <td class="mono t-sm">${esc(u.username)}</td>
          <td><div class="member-cell">${avatarHtml(u.name, 'avatar-sm')}<span class="t-sm t-bold">${esc(u.name)}</span></div></td>
          <td>${roleBadge(u.role)}</td>
          <td class="t-sm">${esc(u.memberName || '--')}</td>
          <td class="t-sm t-dim">${esc(u.phone || '--')}</td>
          <td>${u.active ? '<span class="badge badge-success">启用</span>' : '<span class="badge">停用</span>'}</td>
          <td style="text-align:right" class="nowrap">
            <button class="btn btn-sm" data-edit="${u.id}">编辑</button>
            <button class="btn btn-sm" data-pwd="${u.id}">重置密码</button>
            <button class="btn btn-ghost btn-sm" data-del="${u.id}">${icon('trash', 14)}</button>
          </td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card mt16 card-pad">
      <div class="t-sm t-muted">
        <b>角色说明：</b><br>
        · <b>管理员</b>：管理全部新人、打卡、闯关、阶段配置与账号。<br>
        · <b>领导人</b>：只能看到并审核自己带的新人（按「带教领导人」匹配）。<br>
        · <b>新人</b>：只能看到自己的进度，并提交每日打卡；新增新人时若填写手机号会自动创建登录账号，默认密码 <code class="mono">123456</code>。
      </div>
    </div>`;

    $('#u-add').onclick = () => openUserForm(null, memberOptions, async (u) => { await api.createUser(u); toast('账号已创建', 'ok'); renderUsers(host, ctx); });
    $$('[data-edit]', host).forEach((b) => {
      b.onclick = () => {
        const u = users.find((x) => x.id === b.dataset.edit);
        openUserForm(u, memberOptions, async (payload) => { await api.updateUser(u.id, payload); toast('已保存', 'ok'); renderUsers(host, ctx); });
      };
    });
    $$('[data-pwd]', host).forEach((b) => {
      b.onclick = async () => {
        const pwd = prompt('输入新密码（至少 6 位）：', '123456');
        if (!pwd) return;
        if (pwd.length < 6) return toast('密码至少 6 位', 'err');
        await api.updateUser(b.dataset.pwd, { password: pwd });
        toast('密码已重置', 'ok');
      };
    });
    $$('[data-del]', host).forEach((b) => {
      b.onclick = async () => {
        if (!await confirmDialog('确定删除该账号？删除后该账号无法登录。', { danger: true, okText: '删除' })) return;
        try { await api.deleteUser(b.dataset.del); toast('已删除'); renderUsers(host, ctx); } catch (e) { toast(e.message, 'err'); }
      };
    });
  };
  paint();
}

function openUserForm(user, memberOptions, onSave) {
  const u = user || { username: '', name: '', role: 'leader', phone: '', memberId: '', active: true, title: '' };
  modal({
    title: user ? `编辑账号 · ${u.username}` : '新增账号',
    body: `<div class="grid g2" style="gap:14px">
      <div class="field"><label>登录账号 *</label><input class="input" data-f="username" value="${esc(u.username)}" ${user ? 'disabled' : ''} placeholder="英文字母 / 手机号"></div>
      <div class="field"><label>姓名</label><input class="input" data-f="name" value="${esc(u.name)}"></div>
      <div class="field"><label>角色</label>
        <select class="select" data-f="role">
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理员</option>
          <option value="leader" ${u.role === 'leader' ? 'selected' : ''}>领导人</option>
          <option value="member" ${u.role === 'member' ? 'selected' : ''}>新人</option>
        </select></div>
      <div class="field"><label>手机号</label><input class="input" data-f="phone" value="${esc(u.phone || '')}"></div>
      <div class="field"><label>关联新人（角色为新人时必填）</label>
        <select class="select" data-f="memberId"><option value="">不关联</option>${memberOptions}</select></div>
      <div class="field"><label>头衔</label><input class="input" data-f="title" value="${esc(u.title || '')}"></div>
      ${user ? '' : '<div class="field"><label>初始密码</label><input class="input" data-f="password" value="123456"></div>'}
      <div class="field"><label>状态</label>
        <select class="select" data-f="active"><option value="true" ${u.active !== false ? 'selected' : ''}>启用</option><option value="false" ${u.active === false ? 'selected' : ''}>停用</option></select></div>
    </div>`,
    footer: `<button class="btn" data-cancel>取消</button><button class="btn btn-primary" data-save>保存</button>`,
    onMount(root, closeFn) {
      if (user && u.memberId) { const sel = $('[data-f="memberId"]', root); if (sel) sel.value = u.memberId; }
      $('[data-cancel]', root).onclick = closeFn;
      $('[data-save]', root).onclick = async () => {
        const g = (k) => ($(`[data-f="${k}"]`, root) || {}).value;
        const payload = {
          username: g('username'), name: g('name'), role: g('role'), phone: g('phone'),
          memberId: g('memberId') || null, title: g('title'), active: g('active') === 'true'
        };
        if (!user) payload.password = g('password') || '123456';
        if (!payload.username) return toast('请填写登录账号', 'err');
        try { await onSave(payload); closeFn(); } catch (e) { toast(e.message, 'err'); }
      };
    }
  });
}
