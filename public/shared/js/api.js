/* API 客户端：统一处理 token、错误提示 */

const TOKEN_KEY = 'atk_token';
const USER_KEY = 'atk_user';

export const store = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  set user(v) { v ? localStorage.setItem(USER_KEY, JSON.stringify(v)) : localStorage.removeItem(USER_KEY); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
};

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (store.token) headers.Authorization = `Bearer ${store.token}`;
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('网络连接失败，请检查网络后重试');
  }
  let json;
  try { json = await res.json(); } catch { throw new Error('服务返回异常'); }
  if (res.status === 401) {
    store.clear();
    if (onUnauthorized) onUnauthorized();
    throw new Error(json.error || '登录已失效，请重新登录');
  }
  if (!json.ok) throw new Error(json.error || `请求失败（${res.status}）`);
  return json.data;
}

const qs = (params = {}) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.append(k, v);
  });
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  // 鉴权
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),
  changePassword: (oldPassword, newPassword) => request('POST', '/api/auth/password', { oldPassword, newPassword }),

  // 配置
  config: () => request('GET', '/api/config'),
  saveConfig: (cfg) => request('PUT', '/api/config', cfg),

  // 新人
  members: (params) => request('GET', `/api/members${qs(params)}`),
  member: (id) => request('GET', `/api/members/${id}`),
  createMember: (data) => request('POST', '/api/members', data),
  updateMember: (id, data) => request('PUT', `/api/members/${id}`, data),
  deleteMember: (id) => request('DELETE', `/api/members/${id}`),

  // 打卡
  checkins: (params) => request('GET', `/api/checkins${qs(params)}`),
  createCheckin: (data) => request('POST', '/api/checkins', data),
  updateCheckin: (id, data) => request('PUT', `/api/checkins/${id}`, data),
  deleteCheckin: (id) => request('DELETE', `/api/checkins/${id}`),

  // 闯关
  breakthroughs: (params) => request('GET', `/api/breakthroughs${qs(params)}`),
  createBreakthrough: (data) => request('POST', '/api/breakthroughs', data),
  updateBreakthrough: (id, data) => request('PUT', `/api/breakthroughs/${id}`, data),
  deleteBreakthrough: (id) => request('DELETE', `/api/breakthroughs/${id}`),

  // 大会 / 课堂
  events: (params) => request('GET', `/api/events${qs(params)}`),
  createEvent: (data) => request('POST', '/api/events', data),
  deleteEvent: (id) => request('DELETE', `/api/events/${id}`),

  // 统计
  stats: () => request('GET', '/api/stats/overview'),
  leaderboard: () => request('GET', '/api/stats/leaderboard'),
  availability: (params) => request('GET', `/api/stats/availability${qs(params)}`),
  logs: () => request('GET', '/api/logs'),

  // 我的
  myToday: () => request('GET', '/api/my/today'),

  // 用户
  users: () => request('GET', '/api/users'),
  createUser: (data) => request('POST', '/api/users', data),
  updateUser: (id, data) => request('PUT', `/api/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/api/users/${id}`),

  // 数据备份（仅管理员）
  backup: () => request('GET', '/api/backup'),
  restore: (data) => request('POST', '/api/restore', data),
  clearAll: (confirmText) => request('POST', '/api/danger/clear', { confirm: confirmText })
};
