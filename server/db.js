/**
 * JSON 文件存储层
 * - 全量读入内存，写操作做防抖 + 原子落盘（tmp + rename），避免并发写坏文件
 * - 零外部依赖，发布到线上沙箱也能直接跑
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig, DOMAIN_VERSION } from '../shared/domain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');

function emptyDb() {
  return {
    meta: { version: DOMAIN_VERSION, createdAt: new Date().toISOString(), updatedAt: null },
    config: defaultConfig(),
    users: [],
    members: [],
    checkins: [],
    breakthroughs: [],
    events: [],   // 大会 / 课堂 参加记录
    logs: []
  };
}

let state = null;
let timer = null;
let writing = false;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = Object.assign(emptyDb(), parsed);
      // 配置向后兼容：老库缺字段时用默认值补齐
      state.config = Object.assign(defaultConfig(), state.config || {});
    } catch (err) {
      console.error('[db] 读取失败，已备份并重建：', err.message);
      try {
        fs.copyFileSync(DB_FILE, `${DB_FILE}.broken.${Date.now()}`);
      } catch (_) { /* ignore */ }
      state = emptyDb();
    }
  } else {
    state = emptyDb();
  }
  return state;
}

export function get() {
  if (!state) load();
  return state;
}

function writeNow() {
  if (!state) return;
  state.meta.updatedAt = new Date().toISOString();
  const data = JSON.stringify(state, null, 2);
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  try {
    writing = true;
    // 先写到临时文件，确保内容完整后再替换（避免写一半进程被杀导致文件损坏）
    fs.writeFileSync(tmp, data, 'utf8');

    // 关键：某些托管沙箱的文件系统禁止「覆盖已存在的文件」（rename 到已有目标、
    // 或直接 writeFileSync 已存在路径都会报 File exists / modify backup failed），
    // 但允许「先删除再创建」。所以统一走 删 -> 建 的顺序。
    try { fs.rmSync(DB_FILE, { force: true }); } catch (_) { /* 不存在则忽略 */ }
    try {
      fs.renameSync(tmp, DB_FILE);
    } catch (renameErr) {
      // rename 兜底：直接重建
      fs.writeFileSync(DB_FILE, data, 'utf8');
      try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
    }
  } catch (err) {
    console.error('[db] 写入失败：', err.message);
    // 最后兜底：连临时文件都没写出来时，尝试直接重建目标文件
    try {
      try { fs.rmSync(DB_FILE, { force: true }); } catch (_) { /* ignore */ }
      fs.writeFileSync(DB_FILE, data, 'utf8');
    } catch (err2) {
      console.error('[db] 兜底写入也失败：', err2.message);
    }
  } finally {
    writing = false;
  }
}

/** 防抖写入：默认 120ms 内的多次修改合并成一次落盘 */
export function save(immediate = false) {
  if (immediate) {
    if (timer) { clearTimeout(timer); timer = null; }
    writeNow();
    return;
  }
  if (timer) return;
  timer = setTimeout(() => { timer = null; writeNow(); }, 120);
}

export function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  writeNow();
}

export function isWriting() { return writing; }

/** 生成短 ID */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** 追加一条操作日志 */
export function addLog(action, detail, actor) {
  const db = get();
  db.logs.unshift({
    id: uid('log'),
    action,
    detail,
    actor: actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
    at: new Date().toISOString()
  });
  if (db.logs.length > 500) db.logs.length = 500;
}
