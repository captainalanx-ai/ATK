import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, save, uid } from './db.js';

const SESSION_DAYS = 30;

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;
  const { hash } = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createSession(userId) {
  const db = get();
  const token = randomBytes(24).toString('hex');
  db.sessions = db.sessions || {};
  db.sessions[token] = {
    userId,
    exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000
  };
  save();
  return token;
}

export function destroySession(token) {
  const db = get();
  if (db.sessions && db.sessions[token]) {
    delete db.sessions[token];
    save();
  }
}

export function userFromToken(token) {
  if (!token) return null;
  const db = get();
  const s = (db.sessions || {})[token];
  if (!s) return null;
  if (s.exp < Date.now()) {
    delete db.sessions[token];
    save();
    return null;
  }
  const user = db.users.find((u) => u.id === s.userId);
  return user && user.active !== false ? user : null;
}

/** 从请求头 / Cookie 中提取 token */
export function tokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.headers.cookie || '';
  const m = /(?:^|;\s*)atk_token=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]) : null;
}

/** 删除某位新人的关联登录账号，并踢掉其在线会话 */
export function deleteMemberAccount(memberId) {
  const db = get();
  const removed = [];
  db.users = db.users.filter((u) => {
    if (u.role === 'member' && u.memberId === memberId) {
      removed.push(u.id);
      return false;
    }
    return true;
  });
  if (removed.length && db.sessions) {
    for (const [token, s] of Object.entries(db.sessions)) {
      if (removed.includes(s.userId)) delete db.sessions[token];
    }
  }
  return removed;
}

/**
 * 清理孤儿账号：member 角色但档案已被删除 / memberId 为空（管理员与领导人不受影响）。
 * 避免已删除的新人仍能登录，或残留账号占用手机号导致同名新人无法自动开号。
 */
export function cleanupOrphanAccounts() {
  const db = get();
  const alive = new Set(db.members.map((m) => m.id));
  const removedIds = new Set();
  const removed = [];
  db.users = db.users.filter((u) => {
    if (u.role !== 'member') return true;
    if (u.memberId && alive.has(u.memberId)) return true;
    removedIds.add(u.id);
    removed.push(u.username || u.id);
    return false;
  });
  if (removedIds.size && db.sessions) {
    for (const [token, s] of Object.entries(db.sessions)) {
      if (removedIds.has(s.userId)) delete db.sessions[token];
    }
  }
  if (removed.length) save();
  return removed;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    phone: u.phone || '',
    memberId: u.memberId || null,
    avatarColor: u.avatarColor || '#6366F1',
    title: u.title || ''
  };
}

export function ensureSeedUsers() {
  const db = get();
  if (db.users.length) return;
  const mk = (username, name, role, password, extra = {}) => {
    const { salt, hash } = hashPassword(password);
    return Object.assign({
      id: uid('u'),
      username,
      name,
      role,
      salt,
      hash,
      active: true,
      createdAt: new Date().toISOString()
    }, extra);
  };
  db.users.push(
    mk('admin', '系统管理员', 'admin', 'atk2026', { title: 'ATK 工作室 · 总管理' }),
    mk('ken', 'Ken 哥', 'leader', 'atk2026', { title: '领导人 · 带教负责人', phone: '13800000001' })
  );
  save(true);
}
