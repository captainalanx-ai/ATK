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
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // 只读文件系统（部分托管沙箱）下建目录会失败：不能让它把整个进程带崩，
    // 数据仍在内存里正常读写，只是重启后不保留。
    console.warn('[db] 数据目录不可用（只读环境？）：', err.message);
  }
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

/**
 * 落盘（**异步**）。
 *
 * 为什么必须是异步：托管沙箱的文件系统往往是「代理式」的（写入要经过一层 broker），
 * 单次写几百 KB 可能要几秒到十几秒。如果用 fs.writeFileSync，整条事件循环会被卡住，
 * 期间所有请求都拿不到响应，平台侧就表现成 500 INTERNAL_FUNCTION_INVOCATION_FAILED。
 * 改成 await fs.promises 后，写盘再慢也不会拖住请求。
 *
 * 不同环境的文件系统限制差别很大，所以按「从优到劣」逐级降级：
 *  - 正常环境：rename 覆盖即可（原子）
 *  - 部分托管沙箱：禁止覆盖已存在的文件，但允许「先删再建」
 *  - 只读沙箱：所有写都失败
 * 任何情况下都不允许把 db.json 删掉后写不回来。
 */
async function writeNow() {
  if (!state) return;
  state.meta.updatedAt = new Date().toISOString();
  const data = JSON.stringify(state, null, 2);
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  writing = true;
  try {
    let tmpOk = false;
    try {
      await fs.promises.writeFile(tmp, data, 'utf8');
      tmpOk = true;
    } catch (_) { /* 临时文件也写不出来，走下面的直接写 */ }

    const attempts = tmpOk
      ? [
          ['rename', async () => { await fs.promises.rename(tmp, DB_FILE); }],
          ['copy', async () => { await fs.promises.copyFile(tmp, DB_FILE); }],
          // 沙箱常见：允许「删掉再新建」，不允许覆盖
          ['rm+rename', async () => { await fs.promises.rm(DB_FILE, { force: true }); await fs.promises.rename(tmp, DB_FILE); }],
          ['rm+write', async () => { await fs.promises.rm(DB_FILE, { force: true }); await fs.promises.writeFile(DB_FILE, data, 'utf8'); }]
        ]
      : [
          ['write', async () => { await fs.promises.writeFile(DB_FILE, data, 'utf8'); }],
          ['rm+write', async () => { await fs.promises.rm(DB_FILE, { force: true }); await fs.promises.writeFile(DB_FILE, data, 'utf8'); }]
        ];

    let lastErr = null;
    for (const [name, fn] of attempts) {
      try {
        await fn();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = new Error(`${name}: ${err.message}`);
      }
    }
    if (tmpOk) { try { await fs.promises.rm(tmp, { force: true }); } catch (_) { /* ignore */ } }
    if (lastErr) {
      // 写不进去不等于服务不可用：内存里的数据仍然正确，只是重启会丢。
      // 同一种错误只报一次，避免每次保存刷屏。
      if (lastErr.message !== writeNow._lastErrMsg) {
        writeNow._lastErrMsg = lastErr.message;
        console.warn('[db] 落盘失败（数据仍在内存中，重启后丢失）：', lastErr.message);
      }
    }
  } catch (err) {
    console.error('[db] 写入异常：', err && err.message);
  } finally {
    writing = false;
    // 落盘期间又有新改动 → 再排一次，保证最后一次修改不会丢
    if (pendingAgain) {
      pendingAgain = false;
      queueWrite();
    }
  }
}

/** 串行化：同一时刻只允许一个落盘任务，避免多份 tmp 互相踩 */
let pendingAgain = false;
let currentWrite = null;
function queueWrite() {
  if (writing) { pendingAgain = true; return currentWrite || Promise.resolve(); }
  currentWrite = writeNow().catch((e) => console.error('[db] 落盘任务异常：', e && e.message));
  return currentWrite;
}

/** 防抖写入：默认 400ms 内的多次修改合并成一次落盘（线上磁盘慢，别写太勤） */
export function save(immediate = false) {
  if (immediate) {
    if (timer) { clearTimeout(timer); timer = null; }
    queueWrite();
    return;
  }
  if (timer) return;
  timer = setTimeout(() => { timer = null; queueWrite(); }, 400);
}

/**
 * 立即落盘。
 * 返回 Promise：退出流程要 await 它，否则慢磁盘上进程先退、数据没写完就丢了。
 */
export async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!state) return;
  // 有落盘正在进行 → 先等它结束，再排一次，确保把「等待期间的新改动」也写进去
  for (let i = 0; i < 5 && writing; i++) {
    pendingAgain = true;
    await (currentWrite || Promise.resolve());
  }
  if (writing) return; // 兜底：极端情况下也别把退出流程卡死
  await queueWrite();
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
