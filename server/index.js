/**
 * ATK 工作室 · 新人学习进度管理系统 —— 服务端
 * 零第三方依赖（仅 Node 内置模块），单端口 HTTP 服务，数据存 JSON 文件。
 *   /       → 网页版（PC）
 *   /m/     → 手机版
 *   /api/*  → REST 接口
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { get, load, save, flush, addLog, uid, ROOT } from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession,
  userFromToken, tokenFromReq, publicUser, ensureSeedUsers,
  deleteMemberAccount, cleanupOrphanAccounts
} from './auth.js';
import { computeProgress, todayStr, addDays, daysBetween, streakOf } from './progress.js';
import { seedDemoData, NEWCOMERS } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
// 注意：前端页面里引用的 /shared/... 是 public/shared（浏览器可直接加载的公共模块），
// 不是服务端专用的 shared/domain.js 目录（那个只在 Node 侧 import，不走 HTTP）。
const SHARED_DIR = path.join(PUBLIC_DIR, 'shared');
const PORT = Number(process.env.PORT) || 3000;

/* ------------------------------------------------------------------ */
/* 启动                                                                 */
/* ------------------------------------------------------------------ */
load();
ensureSeedUsers();
const orphans = cleanupOrphanAccounts();
if (orphans.length) console.log(`[cleanup] 已清理 ${orphans.length} 个失效的新人账号：${orphans.join('、')}`);
const db0 = get();
if (!db0.members.length) {
  const r = seedDemoData();
  console.log(`[seed] 已生成演示数据：${r.members} 位新人 / ${r.checkins} 条打卡`);
}

/**
 * 老数据补齐「全职/兼职 + 空闲时间」字段。
 * 已存在的成员按姓名匹配演示数据里的设定补一次；匹配不到就留空，由使用者在表单里补填。
 */
function migrateEmploymentFields() {
  const db = get();
  const seedMap = new Map((NEWCOMERS || []).map((n) => [n.name, n]));
  let changed = false;
  for (const m of db.members) {
    if (m.employmentType === undefined || m.employmentType === null) {
      const s = seedMap.get(m.name);
      m.employmentType = s ? (s.type || '') : '';
      changed = true;
    }
    if (!m.availability || typeof m.availability !== 'object') {
      const s = seedMap.get(m.name);
      m.availability = s && s.avail
        ? { slots: Object.fromEntries(Object.entries(s.avail).map(([d, a]) => [String(d), a])), note: s.availNote || '' }
        : { slots: {}, note: '' };
      changed = true;
    }
  }
  if (changed) { save(true); flush(); console.log('[migrate] 已补齐全职/兼职与空闲时间字段'); }
}
migrateEmploymentFields();

/* ------------------------------------------------------------------ */
/* 工具                                                                 */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
const ok = (res, data) => sendJson(res, { ok: true, data });
const fail = (res, msg, status = 400) => sendJson(res, { ok: false, error: msg }, status);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const MAX = 4 * 1024 * 1024;
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON 解析失败')); }
    });
    req.on('error', reject);
  });
}

function safeJoin(baseDir, relPath) {
  const clean = decodeURIComponent(relPath).split('?')[0];
  const target = path.normalize(path.join(baseDir, clean));
  if (!target.startsWith(baseDir)) return null;
  return target;
}

function serveStatic(req, res, urlPath) {
  let filePath = null;
  if (urlPath === '/shared/' || urlPath.startsWith('/shared/')) {
    filePath = safeJoin(SHARED_DIR, urlPath.replace('/shared/', '') || 'index.html');
  } else {
    filePath = safeJoin(PUBLIC_DIR, urlPath);
  }
  if (!filePath) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA 回退
      const fallback = urlPath.startsWith('/m') ? path.join(PUBLIC_DIR, 'm', 'index.html') : path.join(PUBLIC_DIR, 'web', 'index.html');
      fs.readFile(fallback, (e2, buf) => {
        if (e2) { res.writeHead(404).end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // 系统还在频繁迭代，静态资源一律不缓存，避免改完代码刷新看不到
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ------------------------------------------------------------------ */
/* 权限                                                                 */
/* ------------------------------------------------------------------ */
function currentUser(req) {
  return userFromToken(tokenFromReq(req));
}

function requireAuth(req, res, roles) {
  const user = currentUser(req);
  if (!user) { fail(res, '登录已失效，请重新登录', 401); return null; }
  if (roles && !roles.includes(user.role)) { fail(res, '没有操作权限', 403); return null; }
  return user;
}

/** 可见的新人集合 */
function visibleMembers(user) {
  const db = get();
  if (user.role === 'admin') return db.members;
  if (user.role === 'leader') {
    return db.members.filter((m) => m.leaderId === user.id || (m.leaderName && user.name && m.leaderName === user.name));
  }
  return db.members.filter((m) => m.id === user.memberId);
}

function canTouchMember(user, member) {
  if (user.role === 'admin') return true;
  if (user.role === 'leader') return member.leaderId === user.id || (member.leaderName && member.leaderName === user.name);
  return user.memberId === member.id;
}

function ctxFor(db, memberIds) {
  const ids = new Set(memberIds);
  return {
    config: db.config,
    checkins: db.checkins.filter((c) => ids.has(c.memberId)),
    breakthroughs: db.breakthroughs.filter((b) => ids.has(b.memberId)),
    events: db.events.filter((e) => ids.has(e.memberId))
  };
}

function decorate(member, db) {
  const ctx = {
    config: db.config,
    checkins: db.checkins.filter((c) => c.memberId === member.id),
    breakthroughs: db.breakthroughs.filter((b) => b.memberId === member.id),
    events: db.events.filter((e) => e.memberId === member.id)
  };
  const p = computeProgress(member, ctx);
  return {
    ...member,
    progress: {
      stagePercent: p.stagePercent,
      overallPercent: p.overallPercent,
      tasks: p.tasks,
      stats: p.stats
    }
  };
}

/* ------------------------------------------------------------------ */
/* 路由                                                                 */
/* ------------------------------------------------------------------ */
const routes = [];

function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:([A-Za-z0-9_]+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  routes.push({ method, regex, keys, handler });
}

/* ---------------------------- 鉴权 ---------------------------- */
route('POST', '/api/auth/login', async (req, res) => {
  const body = await readBody(req);
  const db = get();
  const username = String(body.username || '').trim();
  const user = db.users.find((u) => u.username === username || u.phone === username);
  if (!user || !verifyPassword(String(body.password || ''), user)) {
    return fail(res, '账号或密码不正确', 401);
  }
  if (user.active === false) return fail(res, '该账号已停用', 403);
  const token = createSession(user.id);
  addLog('登录', `${user.name} 登录系统`, user);
  save();
  return ok(res, { token, user: publicUser(user) });
});

route('POST', '/api/auth/logout', (req, res) => {
  const token = tokenFromReq(req);
  if (token) destroySession(token);
  return ok(res, true);
});

route('GET', '/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return fail(res, '未登录', 401);
  const db = get();
  let member = null;
  if (user.role === 'member' && user.memberId) {
    const m = db.members.find((x) => x.id === user.memberId);
    if (m) member = decorate(m, db);
  }
  return ok(res, { user: publicUser(user), member, config: db.config });
});

route('POST', '/api/auth/password', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  if (!verifyPassword(String(body.oldPassword || ''), user)) return fail(res, '原密码不正确');
  const np = String(body.newPassword || '');
  if (np.length < 6) return fail(res, '新密码至少 6 位');
  const { salt, hash } = hashPassword(np);
  user.salt = salt; user.hash = hash;
  addLog('修改密码', `${user.name} 修改了登录密码`, user);
  save();
  return ok(res, true);
});

/* ---------------------------- 配置 ---------------------------- */
route('GET', '/api/config', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  return ok(res, get().config);
});

const CONFIG_KEYS = ['studioName', 'subtitle', 'overdueDays', 'videos', 'dayTopics', 'stage1Daily',
  'breakthroughTypes', 'stage2Requirements', 'openingSeven', 'stage3Requirements',
  'stage4Requirements', 'threeRoles', 'stages', 'glossary',
  'employmentTypes', 'weekDays', 'timeSlots'];

route('PUT', '/api/config', async (req, res) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const body = await readBody(req);
  const db = get();
  for (const k of CONFIG_KEYS) if (body[k] !== undefined) db.config[k] = body[k];
  addLog('更新配置', '修改了阶段 / 学习内容配置', user);
  save();
  return ok(res, db.config);
});

/* ---------------------------- 新人 ---------------------------- */
route('GET', '/api/members', (req, res, url) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const stage = url.searchParams.get('stage');
  const status = url.searchParams.get('status');
  const leaderId = url.searchParams.get('leaderId');
  const employmentType = url.searchParams.get('employmentType');
  const sort = url.searchParams.get('sort') || 'updated';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  let list = visibleMembers(user);
  if (q) list = list.filter((m) => (m.name + (m.phone || '') + (m.referrer || '')).toLowerCase().includes(q));
  if (stage) list = list.filter((m) => String(m.stage) === String(stage));
  if (status) list = list.filter((m) => m.status === status);
  if (leaderId) list = list.filter((m) => m.leaderId === leaderId);
  if (employmentType) {
    // 'none' 表示「还没登记投入方式」，用来把待补资料的人筛出来
    list = employmentType === 'none'
      ? list.filter((m) => !m.employmentType)
      : list.filter((m) => (m.employmentType || '') === employmentType);
  }

  const all = list.map((m) => decorate(m, db));
  const sorters = {
    updated: (a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)),
    name: (a, b) => a.name.localeCompare(b.name, 'zh'),
    progress: (a, b) => b.progress.overallPercent - a.progress.overallPercent,
    streak: (a, b) => (b.progress.stats.streak || 0) - (a.progress.stats.streak || 0),
    risk: (a, b) => (b.progress.stats.overdueDays ?? 999) - (a.progress.stats.overdueDays ?? 999),
    stage: (a, b) => b.stage - a.stage || b.progress.stagePercent - a.progress.stagePercent
  };
  all.sort(sorters[sort] || sorters.updated);

  const total = all.length;
  const items = all.slice((page - 1) * pageSize, page * pageSize);
  const leaders = db.users.filter((u) => u.role === 'leader' || u.role === 'admin').map((u) => ({ id: u.id, name: u.name }));
  return ok(res, { total, page, pageSize, items, leaders });
});

route('GET', '/api/members/:id', (req, res, url, m) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const member = db.members.find((x) => x.id === m[1]);
  if (!member) return fail(res, '新人不存在', 404);
  if (!canTouchMember(user, member)) return fail(res, '没有权限查看该新人', 403);

  const ctx = {
    config: db.config,
    checkins: db.checkins.filter((c) => c.memberId === member.id),
    breakthroughs: db.breakthroughs.filter((b) => b.memberId === member.id),
    events: db.events.filter((e) => e.memberId === member.id)
  };
  const progress = computeProgress(member, ctx);
  const checkins = ctx.checkins.slice().sort((a, b) => b.date.localeCompare(a.date));
  return ok(res, {
    member,
    progress,
    checkins,
    breakthroughs: ctx.breakthroughs.slice().sort((a, b) => b.date.localeCompare(a.date)),
    events: ctx.events.slice().sort((a, b) => b.date.localeCompare(a.date)),
    leaders: db.users.filter((u) => u.role === 'leader' || u.role === 'admin').map((u) => ({ id: u.id, name: u.name }))
  });
});

/** 规范化空闲时间：{ slots: { "1": ["am","ev"], ... }, note: "" }，只保留合法的天与时段 */
function normalizeAvailability(v) {
  const out = { slots: {}, note: '' };
  if (v && typeof v === 'object') {
    const slots = v.slots && typeof v.slots === 'object' ? v.slots : {};
    for (const d of [1, 2, 3, 4, 5, 6, 7]) {
      const arr = Array.isArray(slots[String(d)]) ? slots[String(d)].filter((s) => ['am', 'pm', 'ev'].includes(s)) : [];
      if (arr.length) out.slots[String(d)] = [...new Set(arr)];
    }
    out.note = String(v.note || '').slice(0, 200);
  }
  return out;
}

route('POST', '/api/members', async (req, res) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const body = await readBody(req);
  const db = get();
  if (!String(body.name || '').trim()) return fail(res, '请填写新人姓名');
  const today = todayStr();
  const member = {
    id: uid('m'),
    name: String(body.name).trim(),
    phone: String(body.phone || '').trim(),
    gender: body.gender || '',
    wechat: String(body.wechat || '').trim(),
    leaderId: body.leaderId || (user.role === 'leader' ? user.id : null),
    leaderName: body.leaderName || (user.role === 'leader' ? user.name : ''),
    referrer: String(body.referrer || '').trim(),
    startDate: body.startDate || today,
    stage: Number(body.stage) || 1,
    status: body.status || 'active',
    focusBreakthrough: body.focusBreakthrough || '',
    openingTimes: Number(body.openingTimes) || 0,
    employmentType: ['fulltime', 'parttime'].includes(body.employmentType) ? body.employmentType : '',
    availability: normalizeAvailability(body.availability),
    marketAnswers: body.marketAnswers || { what: '', how: '', result: '' },
    reasons: Array.isArray(body.reasons) ? body.reasons : [],
    schedule: Array.isArray(body.schedule) ? body.schedule : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
    note: String(body.note || ''),
    createdAt: new Date().toISOString(),
    updatedAt: null
  };
  db.members.push(member);

  // 自动建登录账号（手机号 / 默认密码 123456）
  if (member.phone) {
    if (!db.users.some((u) => u.phone === member.phone)) {
      const { salt, hash } = hashPassword('123456');
      db.users.push({
        id: uid('u'), username: member.phone, name: member.name, role: 'member',
        phone: member.phone, memberId: member.id, salt, hash, active: true,
        avatarColor: '#6366F1', title: '新人', createdAt: new Date().toISOString()
      });
    }
  }
  addLog('新增新人', `录入新人 ${member.name}（阶段 ${member.stage}）`, user);
  save();
  return ok(res, decorate(member, db));
});

route('PUT', '/api/members/:id', async (req, res, url, m) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const member = db.members.find((x) => x.id === m[1]);
  if (!member) return fail(res, '新人不存在', 404);
  if (!canTouchMember(user, member)) return fail(res, '没有权限修改该新人', 403);
  const body = await readBody(req);
  const editable = ['name', 'phone', 'gender', 'wechat', 'leaderId', 'leaderName', 'referrer', 'startDate',
    'stage', 'status', 'focusBreakthrough', 'openingTimes', 'marketAnswers', 'reasons', 'schedule', 'tags', 'note',
    'employmentType', 'availability'];
  if (user.role === 'admin' || user.role === 'leader') {
    for (const k of editable) if (body[k] !== undefined) member[k] = body[k];
  } else {
    // 新人本人只能维护自己的 20 个理由 / 时间表 / 市场三问 / 投入方式与空闲时间
    for (const k of ['reasons', 'schedule', 'marketAnswers', 'note', 'employmentType', 'availability']) {
      if (body[k] !== undefined) member[k] = body[k];
    }
  }
  if (member.stage) member.stage = Number(member.stage);
  // 空闲时间与投入方式要按固定口径存，避免前端传脏数据进来
  if (body.availability !== undefined) member.availability = normalizeAvailability(body.availability);
  if (body.employmentType !== undefined && !['fulltime', 'parttime'].includes(member.employmentType)) member.employmentType = '';
  // 手机号变更时同步登录账号，避免新人换了号码就登不进来
  if (body.phone !== undefined && (user.role === 'admin' || user.role === 'leader')) {
    const newPhone = String(body.phone || '').trim();
    const acc = db.users.find((u) => u.role === 'member' && u.memberId === member.id);
    if (acc && newPhone && !db.users.some((u) => u.id !== acc.id && (u.username === newPhone || u.phone === newPhone))) {
      acc.username = newPhone;
      acc.phone = newPhone;
    }
  }
  member.updatedAt = new Date().toISOString();
  addLog('更新新人', `更新了 ${member.name} 的资料`, user);
  save();
  return ok(res, decorate(member, db));
});

route('DELETE', '/api/members/:id', (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const db = get();
  const idx = db.members.findIndex((x) => x.id === m[1]);
  if (idx < 0) return fail(res, '新人不存在', 404);
  const member = db.members[idx];
  db.members.splice(idx, 1);
  db.checkins = db.checkins.filter((c) => c.memberId !== member.id);
  db.breakthroughs = db.breakthroughs.filter((b) => b.memberId !== member.id);
  db.events = db.events.filter((e) => e.memberId !== member.id);
  // 同步注销该新人的登录账号并踢掉在线会话，避免留下可登录的孤儿账号
  const removedAccounts = deleteMemberAccount(member.id);
  addLog('删除新人', `删除了 ${member.name} 及其全部记录${removedAccounts.length ? `（含 ${removedAccounts.length} 个登录账号）` : ''}`, user);
  save();
  return ok(res, true);
});

/* ---------------------------- 打卡 ---------------------------- */
route('GET', '/api/checkins', (req, res, url) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const memberId = url.searchParams.get('memberId');
  const stage = url.searchParams.get('stage');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const onlyPending = url.searchParams.get('pending') === '1';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(300, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

  const allowed = new Set(visibleMembers(user).map((m) => m.id));
  let list = db.checkins.filter((c) => allowed.has(c.memberId));
  if (memberId) list = list.filter((c) => c.memberId === memberId);
  if (stage) list = list.filter((c) => String(c.stage) === String(stage));
  if (from) list = list.filter((c) => c.date >= from);
  if (to) list = list.filter((c) => c.date <= to);
  if (onlyPending) list = list.filter((c) => !c.reviewed);
  list = list.slice().sort((a, b) => (a.date === b.date ? String(b.createdAt).localeCompare(String(a.createdAt)) : b.date.localeCompare(a.date)));

  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  return ok(res, { total, page, pageSize, items });
});

route('POST', '/api/checkins', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await readBody(req);
  const db = get();
  const memberId = body.memberId || (user.role === 'member' ? user.memberId : null);
  const member = db.members.find((m) => m.id === memberId);
  if (!member) return fail(res, '请选择新人', 404);
  if (!canTouchMember(user, member)) return fail(res, '没有权限为该新人打卡', 403);
  const date = body.date || todayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, '日期格式不正确');

  const cfg = db.config;
  const videoId = body.videoId || '';
  const video = cfg.videos.find((v) => v.id === videoId);
  const dayIndex = body.dayIndex ? Number(body.dayIndex) : null;
  const topic = dayIndex ? cfg.dayTopics.find((d) => d.day === dayIndex) : null;

  const existing = db.checkins.find((c) => c.memberId === member.id && c.date === date);
  const payload = {
    memberId: member.id,
    memberName: member.name,
    date,
    stage: Number(body.stage) || Number(member.stage) || 1,
    dayIndex,
    dayTopic: topic ? topic.title : (body.dayTopic || ''),
    videoDone: !!body.videoDone,
    videoId,
    videoTitle: video ? `${video.speaker}·${video.title}` : (body.videoTitle || ''),
    mistCount: Number(body.mistCount) || 0,
    mistList: Array.isArray(body.mistList) ? body.mistList.map((g) => ({
      name: String(g?.name || '').trim(),
      star: Number(g?.star) || 1,
      note: String(g?.note || '').trim()
    })).filter((g) => g.name) : [],
    voiceDone: !!body.voiceDone,
    voiceSummary: String(body.voiceSummary || ''),
    learned: String(body.learned || ''),
    mistLearned: String(body.mistLearned || ''),
    minutes: Number(body.minutes) || 0,
    updatedAt: new Date().toISOString()
  };

  let record;
  if (existing) {
    Object.assign(existing, payload);
    record = existing;
    addLog('更新打卡', `${member.name} ${date} 打卡已更新`, user);
  } else {
    record = {
      id: uid('c'),
      score: null,
      review: '',
      reviewer: '',
      reviewed: false,
      createdAt: new Date().toISOString(),
      ...payload
    };
    db.checkins.push(record);
    addLog('提交打卡', `${member.name} 提交了 ${date} 的学习打卡`, user);
  }
  save();
  return ok(res, record);
});

route('PUT', '/api/checkins/:id', async (req, res, url, m) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const c = db.checkins.find((x) => x.id === m[1]);
  if (!c) return fail(res, '打卡记录不存在', 404);
  const member = db.members.find((x) => x.id === c.memberId);
  if (user.role === 'member') return fail(res, '新人不能修改已提交的打卡', 403);
  if (member && !canTouchMember(user, member)) return fail(res, '没有权限审核该记录', 403);
  const body = await readBody(req);
  if (body.score !== undefined) c.score = body.score === null || body.score === '' ? null : Number(body.score);
  if (body.review !== undefined) c.review = String(body.review);
  if (body.reviewer !== undefined) c.reviewer = String(body.reviewer);
  if (body.reviewed !== undefined) c.reviewed = !!body.reviewed;
  if (body.review !== undefined || body.score !== undefined) {
    c.reviewed = true;
    if (!c.reviewer) c.reviewer = user.name;
  }
  if (user.role !== 'member') {
    for (const k of ['videoDone', 'voiceDone', 'mistCount', 'voiceSummary', 'learned', 'mistLearned', 'minutes', 'dayIndex', 'videoId', 'videoTitle', 'mistList']) {
      if (body[k] !== undefined) c[k] = body[k];
    }
  }
  c.updatedAt = new Date().toISOString();
  addLog('点评打卡', `点评了 ${c.memberName} ${c.date} 的打卡`, user);
  save();
  return ok(res, c);
});

route('DELETE', '/api/checkins/:id', (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const db = get();
  const idx = db.checkins.findIndex((x) => x.id === m[1]);
  if (idx < 0) return fail(res, '打卡记录不存在', 404);
  const c = db.checkins[idx];
  db.checkins.splice(idx, 1);
  addLog('删除打卡', `删除了 ${c.memberName} ${c.date} 的打卡`, user);
  save();
  return ok(res, true);
});

/* ---------------------------- 闯关 / 大会 ---------------------------- */
route('GET', '/api/breakthroughs', (req, res, url) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const allowed = new Set(visibleMembers(user).map((m) => m.id));
  let list = db.breakthroughs.filter((b) => allowed.has(b.memberId));
  const memberId = url.searchParams.get('memberId');
  if (memberId) list = list.filter((b) => b.memberId === memberId);
  const status = url.searchParams.get('status');
  if (status) list = list.filter((b) => b.status === status);
  return ok(res, list.sort((a, b) => b.date.localeCompare(a.date)));
});

route('POST', '/api/breakthroughs', async (req, res) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const body = await readBody(req);
  const db = get();
  const member = db.members.find((m) => m.id === body.memberId);
  if (!member) return fail(res, '请选择新人');
  if (!canTouchMember(user, member)) return fail(res, '没有权限', 403);
  const t = db.config.breakthroughTypes.find((x) => x.id === body.type);
  const rec = {
    id: uid('b'),
    memberId: member.id,
    memberName: member.name,
    type: body.type || 'market',
    typeName: body.typeName || (t ? t.name : '市场闯关'),
    status: body.status || 'pending',
    date: body.date || todayStr(),
    score: body.score === '' || body.score === undefined || body.score === null ? null : Number(body.score),
    reviewer: body.reviewer || user.name,
    note: String(body.note || ''),
    createdAt: new Date().toISOString()
  };
  db.breakthroughs.push(rec);
  if (rec.status === 'passed' && !member.focusBreakthrough) member.focusBreakthrough = rec.type;
  addLog('闯关记录', `登记 ${member.name} 的${rec.typeName}（${rec.status === 'passed' ? '通过' : '待考'}）`, user);
  save();
  return ok(res, rec);
});

route('PUT', '/api/breakthroughs/:id', async (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const db = get();
  const b = db.breakthroughs.find((x) => x.id === m[1]);
  if (!b) return fail(res, '记录不存在', 404);
  const member = db.members.find((x) => x.id === b.memberId);
  if (member && !canTouchMember(user, member)) return fail(res, '没有权限', 403);
  const body = await readBody(req);
  for (const k of ['type', 'typeName', 'status', 'date', 'score', 'reviewer', 'note']) {
    if (body[k] !== undefined) b[k] = k === 'score' ? (body[k] === '' || body[k] === null ? null : Number(body[k])) : body[k];
  }
  if (b.status === 'passed' && member && !member.focusBreakthrough) member.focusBreakthrough = b.type;
  addLog('更新闯关', `更新了 ${b.memberName} 的${b.typeName}`, user);
  save();
  return ok(res, b);
});

route('DELETE', '/api/breakthroughs/:id', (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const db = get();
  const idx = db.breakthroughs.findIndex((x) => x.id === m[1]);
  if (idx < 0) return fail(res, '记录不存在', 404);
  db.breakthroughs.splice(idx, 1);
  save();
  return ok(res, true);
});

route('GET', '/api/events', (req, res, url) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const allowed = new Set(visibleMembers(user).map((m) => m.id));
  let list = db.events.filter((e) => allowed.has(e.memberId));
  const memberId = url.searchParams.get('memberId');
  if (memberId) list = list.filter((e) => e.memberId === memberId);
  return ok(res, list.sort((a, b) => b.date.localeCompare(a.date)));
});

route('POST', '/api/events', async (req, res) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const body = await readBody(req);
  const db = get();
  const member = db.members.find((m) => m.id === body.memberId);
  if (!member) return fail(res, '请选择新人');
  if (!canTouchMember(user, member)) return fail(res, '没有权限', 403);
  const type = body.type || 'kenClass';
  const rec = {
    id: uid('e'),
    memberId: member.id,
    memberName: member.name,
    type,
    name: body.name || (type === 'kenClass' ? 'Ken 哥课堂' : '全人类大会'),
    date: body.date || todayStr(),
    note: String(body.note || ''),
    createdAt: new Date().toISOString()
  };
  db.events.push(rec);
  addLog('参会记录', `登记 ${member.name} 参加${rec.name}`, user);
  save();
  return ok(res, rec);
});

route('DELETE', '/api/events/:id', (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const db = get();
  const idx = db.events.findIndex((x) => x.id === m[1]);
  if (idx < 0) return fail(res, '记录不存在', 404);
  db.events.splice(idx, 1);
  save();
  return ok(res, true);
});

/* ---------------------------- 看板统计 ---------------------------- */
route('GET', '/api/stats/overview', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const cfg = db.config;
  const today = todayStr();
  const members = visibleMembers(user).filter((m) => m.status !== 'paused' || true);
  const decorated = members.map((m) => decorate(m, db));
  const allowed = new Set(members.map((m) => m.id));
  const checkins = db.checkins.filter((c) => allowed.has(c.memberId));

  const byStage = [1, 2, 3, 4].map((s) => ({
    stage: s,
    name: (cfg.stages.find((x) => x.id === s) || {}).name || `阶段${s}`,
    color: (cfg.stages.find((x) => x.id === s) || {}).color || '#6366F1',
    count: decorated.filter((m) => Number(m.stage) === s).length
  }));
  const byStatus = ['active', 'risk', 'paused', 'graduated'].map((s) => ({
    status: s, count: decorated.filter((m) => m.status === s).length
  }));

  // 近 14 天打卡趋势
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const list = checkins.filter((c) => c.date === d);
    const uniqueMembers = new Set(list.map((c) => c.memberId)).size;
    trend.push({ date: d, count: list.length, members: uniqueMembers, mist: list.reduce((s, c) => s + (Number(c.mistCount) || 0), 0) });
  }

  const todayList = checkins.filter((c) => c.date === today);
  const activeCount = decorated.filter((m) => m.status !== 'paused').length;
  const todayRate = activeCount ? Math.round((new Set(todayList.map((c) => c.memberId)).size / activeCount) * 100) : 0;

  const overdueLimit = Number(cfg.overdueDays) || 2;
  const overdue = decorated
    .filter((m) => m.status !== 'paused' && m.status !== 'graduated' && (m.progress.stats.overdueDays ?? 0) >= overdueLimit)
    .sort((a, b) => (b.progress.stats.overdueDays ?? 0) - (a.progress.stats.overdueDays ?? 0))
    .slice(0, 10)
    .map((m) => ({
      id: m.id, name: m.name, stage: m.stage, leaderName: m.leaderName,
      overdueDays: m.progress.stats.overdueDays, lastDate: m.progress.stats.lastDate,
      percent: m.progress.overallPercent
    }));

  const leaderboard = decorated
    .filter((m) => m.status !== 'paused')
    .map((m) => ({
      id: m.id, name: m.name, stage: m.stage, avatarColor: '#6366F1',
      streak: m.progress.stats.streak || 0,
      checkinDays: m.progress.stats.checkinDays || 0,
      mistTotal: m.progress.stats.mistTotal || 0,
      percent: m.progress.overallPercent
    }))
    .sort((a, b) => b.streak - a.streak || b.percent - a.percent)
    .slice(0, 10);

  const btAll = db.breakthroughs.filter((b) => allowed.has(b.memberId));
  const breakthrough = {
    total: btAll.length,
    passed: btAll.filter((b) => b.status === 'passed').length,
    pending: btAll.filter((b) => b.status === 'pending').length,
    failed: btAll.filter((b) => b.status === 'failed').length,
    byType: cfg.breakthroughTypes.map((t) => ({
      id: t.id, name: t.name,
      total: btAll.filter((b) => b.type === t.id).length,
      passed: btAll.filter((b) => b.type === t.id && b.status === 'passed').length
    }))
  };

  const mistTotal = checkins.reduce((s, c) => s + (Number(c.mistCount) || 0), 0);
  const mistTarget = decorated.length * (cfg.stage1Daily?.mistTotalTarget || 30);

  const recentCheckins = checkins.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
    .map((c) => ({ id: c.id, memberId: c.memberId, memberName: c.memberName, date: c.date, stage: c.stage, score: c.score, reviewed: c.reviewed, videoTitle: c.videoTitle, mistCount: c.mistCount }));

  const logs = (db.logs || []).slice(0, 8);

  return ok(res, {
    totals: {
      members: decorated.length,
      active: activeCount,
      graduated: decorated.filter((m) => m.status === 'graduated').length,
      risk: decorated.filter((m) => m.status === 'risk').length,
      checkins: checkins.length,
      todayCheckins: todayList.length,
      todayRate,
      weekCheckins: checkins.filter((c) => c.date >= addDays(today, -6)).length,
      monthCheckins: checkins.filter((c) => c.date >= addDays(today, -29)).length,
      pendingReview: checkins.filter((c) => !c.reviewed).length,
      mistTotal,
      mistTarget,
      avgPercent: decorated.length ? Math.round(decorated.reduce((s, m) => s + m.progress.overallPercent, 0) / decorated.length) : 0
    },
    byStage,
    byStatus,
    trend,
    overdue,
    leaderboard,
    breakthrough,
    recentCheckins,
    logs,
    today
  });
});

route('GET', '/api/stats/leaderboard', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const members = visibleMembers(user);
  const rows = members.map((m) => decorate(m, db)).map((m) => ({
    id: m.id, name: m.name, stage: m.stage,
    streak: m.progress.stats.streak, checkinDays: m.progress.stats.checkinDays,
    mistTotal: m.progress.stats.mistTotal, percent: m.progress.overallPercent
  })).sort((a, b) => b.streak - a.streak || b.percent - a.percent);
  return ok(res, rows);
});

/* ---------------------------- 我的（手机端首页） ---------------------------- */
/* 空闲时间排期：谁在哪个时段有空，方便统一安排学习 */
route('GET', '/api/stats/availability', (req, res, url) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  const db = get();
  const days = db.config.weekDays || [];
  const slots = db.config.timeSlots || [];
  const type = url.searchParams.get('type') || '';
  const stageFilter = url.searchParams.get('stage') || '';
  let list = visibleMembers(user);
  if (type) list = list.filter((m) => (m.employmentType || '') === type);
  if (stageFilter) list = list.filter((m) => String(m.stage) === String(stageFilter));

  const grid = {};
  for (const d of days) { grid[d.id] = {}; for (const s of slots) grid[d.id][s.id] = []; }
  for (const m of list) {
    const sl = (m.availability && m.availability.slots) || {};
    for (const d of days) {
      const arr = Array.isArray(sl[String(d.id)]) ? sl[String(d.id)] : [];
      for (const s of slots) {
        if (arr.includes(s.id)) {
          grid[d.id][s.id].push({ id: m.id, name: m.name, stage: m.stage, employmentType: m.employmentType || '' });
        }
      }
    }
  }
  const flat = [];
  for (const d of days) {
    for (const s of slots) {
      flat.push({ day: d.id, dayName: d.name, slot: s.id, slotName: s.name, time: s.time, members: grid[d.id][s.id] });
    }
  }
  flat.forEach((x) => { x.count = x.members.length; });
  const best = flat.filter((x) => x.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5);
  const countBy = (t) => list.filter((m) => (m.employmentType || '') === t).length;
  const noAvailability = list
    .filter((m) => !Object.keys((m.availability || {}).slots || {}).length)
    .map((m) => ({ id: m.id, name: m.name, employmentType: m.employmentType || '' }));

  return ok(res, {
    days, slots, grid, flat, best,
    total: list.length,
    counts: { fulltime: countBy('fulltime'), parttime: countBy('parttime'), unknown: countBy('') },
    noAvailability
  });
});

route('GET', '/api/my/today', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const db = get();
  const today = todayStr();
  if (user.role === 'member' && user.memberId) {
    const member = db.members.find((m) => m.id === user.memberId);
    if (!member) return fail(res, '未关联新人档案', 404);
    const ctx = {
      config: db.config,
      checkins: db.checkins.filter((c) => c.memberId === member.id),
      breakthroughs: db.breakthroughs.filter((b) => b.memberId === member.id),
      events: db.events.filter((e) => e.memberId === member.id)
    };
    const progress = computeProgress(member, ctx);
    const todayRec = ctx.checkins.find((c) => c.date === today) || null;
    return ok(res, { member: decorate(member, db), progress, todayCheckin: todayRec });
  }
  // 领导人 / 管理员：返回团队今日概览
  const members = visibleMembers(user);
  const allowed = new Set(members.map((m) => m.id));
  const todayList = db.checkins.filter((c) => allowed.has(c.memberId) && c.date === today);
  return ok(res, {
    team: true,
    todayCount: todayList.length,
    memberCount: members.length,
    checkedIds: [...new Set(todayList.map((c) => c.memberId))]
  });
});

/* ---------------------------- 用户 ---------------------------- */
route('GET', '/api/users', (req, res) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const db = get();
  const rows = db.users.map((u) => ({
    ...publicUser(u),
    active: u.active !== false,
    createdAt: u.createdAt,
    memberName: u.memberId ? (db.members.find((m) => m.id === u.memberId) || {}).name || '' : ''
  }));
  return ok(res, rows);
});

route('POST', '/api/users', async (req, res) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const body = await readBody(req);
  const db = get();
  const username = String(body.username || '').trim();
  if (!username) return fail(res, '请填写登录账号');
  if (db.users.some((u) => u.username === username)) return fail(res, '该账号已存在');
  const pwd = String(body.password || '123456');
  const { salt, hash } = hashPassword(pwd);
  const nu = {
    id: uid('u'), username, name: String(body.name || username), role: body.role || 'leader',
    phone: String(body.phone || ''), memberId: body.memberId || null, salt, hash,
    active: body.active !== false, avatarColor: body.avatarColor || '#6366F1',
    title: String(body.title || ''), createdAt: new Date().toISOString()
  };
  db.users.push(nu);
  addLog('新增账号', `创建账号 ${username}（${nu.role}）`, user);
  save();
  return ok(res, publicUser(nu));
});

route('PUT', '/api/users/:id', async (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const db = get();
  const u = db.users.find((x) => x.id === m[1]);
  if (!u) return fail(res, '账号不存在', 404);
  const body = await readBody(req);
  for (const k of ['name', 'role', 'phone', 'memberId', 'active', 'avatarColor', 'title']) {
    if (body[k] !== undefined) u[k] = body[k];
  }
  if (body.password) {
    const { salt, hash } = hashPassword(String(body.password));
    u.salt = salt; u.hash = hash;
  }
  addLog('更新账号', `更新账号 ${u.username}`, user);
  save();
  return ok(res, publicUser(u));
});

route('DELETE', '/api/users/:id', (req, res, url, m) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const db = get();
  const idx = db.users.findIndex((x) => x.id === m[1]);
  if (idx < 0) return fail(res, '账号不存在', 404);
  if (db.users[idx].id === user.id) return fail(res, '不能删除当前登录账号');
  db.users.splice(idx, 1);
  save();
  return ok(res, true);
});

route('GET', '/api/logs', (req, res) => {
  const user = requireAuth(req, res, ['admin', 'leader']);
  if (!user) return;
  return ok(res, (get().logs || []).slice(0, 50));
});

/* ------------------------------ 数据备份 ------------------------------ */
route('GET', '/api/backup', (req, res) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  addLog('导出备份', '导出了全量数据 JSON', user);
  save();
  return ok(res, get());
});

route('POST', '/api/restore', async (req, res) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const body = await readBody(req);
  const payload = body && body.data ? body.data : body;
  if (!payload || !Array.isArray(payload.members)) return fail(res, '备份文件格式不正确：缺少 members 数组');
  const db = get();
  for (const key of ['config', 'users', 'members', 'checkins', 'breakthroughs', 'events', 'logs']) {
    if (payload[key] !== undefined) db[key] = payload[key];
  }
  save(true);
  addLog('恢复备份', `从备份恢复了 ${db.members.length} 位新人 / ${db.checkins.length} 条打卡`, user);
  flush();
  return ok(res, { members: db.members.length, checkins: db.checkins.length, users: db.users.length });
});

route('POST', '/api/danger/clear', async (req, res) => {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const body = await readBody(req);
  if (String(body.confirm || '').trim() !== '清空') return fail(res, '确认文字不正确，请输入「清空」');
  const db = get();
  // 只清业务数据，保留管理员 / 领导人账号与阶段配置
  db.members = [];
  db.checkins = [];
  db.breakthroughs = [];
  db.events = [];
  db.logs = [];
  db.users = db.users.filter((u) => u.role !== 'member');
  save(true);
  addLog('清空数据', '清空了全部业务数据（新人 / 打卡 / 闯关 / 大会）', user);
  flush();
  return ok(res, true);
});

route('GET', '/api/health', (_req, res) => ok(res, { ok: true, time: new Date().toISOString(), today: todayStr() }));

/* ------------------------------------------------------------------ */
/* 服务器                                                               */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 移动端 UA 自动进入手机版
  if ((pathname === '/' || pathname === '/index.html') && url.searchParams.get('v') !== 'web') {
    const ua = String(req.headers['user-agent'] || '');
    if (/iPhone|Android|Mobile|iPad|Windows Phone/i.test(ua)) {
      res.writeHead(302, { Location: '/m/' });
      res.end();
      return;
    }
  }

  if (!pathname.startsWith('/api/')) {
    serveStatic(req, res, pathname);
    return;
  }

  const method = req.method || 'GET';
  try {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      await r.handler(req, res, url, m, params);
      return;
    }
    fail(res, `接口不存在：${method} ${pathname}`, 404);
  } catch (err) {
    console.error('[api]', method, pathname, err);
    fail(res, err.message || '服务器内部错误', 500);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ATK 工作室 · 新人学习进度管理系统`);
  console.log(`  ------------------------------------------`);
  console.log(`  网页版（PC）  http://localhost:${PORT}/`);
  console.log(`  手机端        http://localhost:${PORT}/m/`);
  console.log(`  数据文件      ${path.join(ROOT, 'data', 'db.json')}`);
  console.log(`  默认账号      admin / atk2026（管理员）  ken / atk2026（领导人）\n`);
});

function shutdown() {
  flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
