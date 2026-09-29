/** npm run reset —— 清空并重新生成演示数据 */
import { get, save } from './db.js';
import { resetAll, seedDemoData } from './seed.js';
import { ensureSeedUsers } from './auth.js';
import { flush } from './db.js';

const db = get();
resetAll();
ensureSeedUsers();
const r = seedDemoData();
flush();
console.log(`已重置：${r.members} 位新人 / ${r.checkins} 条打卡 / ${db.users.length} 个账号`);
