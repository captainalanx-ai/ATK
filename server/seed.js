/**
 * 初始化演示数据：领导人、新人、打卡记录、闯关记录、大会记录
 * 只在数据库为空（或执行 npm run reset）时执行。
 */
import { get, save, uid } from './db.js';
import { hashPassword } from './auth.js';
import { todayStr, addDays } from './progress.js';
import { defaultConfig } from '../shared/domain.js';

// 固定种子的伪随机，保证每次演示数据一致
let seedState = 20260929;
function rnd() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }

/* type：全职 / 兼职；avail：一周七天（1=周一）中哪几个时段有空 am/pm/ev */
export const NEWCOMERS = [
  { name: '林晓雅', phone: '13800000011', stage: 1, startDateOffset: -8, leader: 'ken', gender: '女',
    type: 'parttime', avail: { 1: ['ev'], 3: ['ev'], 5: ['ev'], 6: ['pm', 'ev'] }, availNote: '白天上班，晚上 19:30 后固定可安排' },
  { name: '陈志远', phone: '13800000012', stage: 1, startDateOffset: -3, leader: 'ken', gender: '男',
    type: 'fulltime', avail: { 1: ['am', 'pm'], 2: ['am', 'pm'], 3: ['am', 'pm'], 4: ['am', 'pm'], 5: ['am', 'pm'] }, availNote: '' },
  { name: '王思思', phone: '13800000013', stage: 1, startDateOffset: -12, leader: 'ken', gender: '女',
    type: 'parttime', avail: { 2: ['ev'], 4: ['ev'], 7: ['am', 'pm'] }, availNote: '周末白天可以，工作日只能晚上' },
  { name: '赵一鸣', phone: '13800000014', stage: 2, startDateOffset: -35, leader: 'ken', gender: '男', focus: 'product',
    type: 'fulltime', avail: { 1: ['am', 'pm'], 2: ['am', 'pm'], 3: ['am', 'pm'], 4: ['am', 'pm'], 5: ['am', 'pm'], 6: ['am'] }, availNote: '' },
  { name: '孙悦然', phone: '13800000015', stage: 2, startDateOffset: -42, leader: 'ken', gender: '女', focus: 'bonus',
    type: 'parttime', avail: { 1: ['pm', 'ev'], 3: ['pm', 'ev'], 6: ['am', 'pm', 'ev'] }, availNote: '周三下午要接孩子，尽量安排上午或晚上' },
  { name: '周峻熙', phone: '13800000016', stage: 3, startDateOffset: -60, leader: 'ken', gender: '男', openingTimes: 2,
    type: 'fulltime', avail: { 1: ['am', 'pm', 'ev'], 2: ['am', 'pm', 'ev'], 3: ['am', 'pm', 'ev'], 4: ['am', 'pm', 'ev'], 5: ['am', 'pm', 'ev'] }, availNote: '' },
  { name: '吴桐雨', phone: '13800000017', stage: 4, startDateOffset: -85, leader: 'ken', gender: '女',
    type: 'parttime', avail: { 5: ['ev'], 6: ['am', 'pm'], 7: ['am', 'pm'] }, availNote: '只在周末和周五晚上' },
  { name: '郑楷文', phone: '13800000018', stage: 4, startDateOffset: -95, leader: 'ken', gender: '男',
    type: 'fulltime', avail: { 1: ['am', 'pm'], 2: ['am', 'pm'], 3: ['am', 'pm'], 4: ['am', 'pm'], 5: ['am', 'pm'], 6: ['pm', 'ev'] }, availNote: '' }
];

const VIDEO_PICKS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'];
const GUEST_SURNAME = ['李', '王', '张', '刘', '陈', '杨', '黄', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭'];
const VOICE_NOTES = [
  '今天把行业魅力讲给朋友听，对方开始有兴趣，约了下次见面。',
  '打雾时领导提醒我：不要急着讲制度，先把观念讲透。',
  '会后会复盘：自己的表达还是太散，需要按 3 分钟结构练。',
  '今天被拒绝了两次，领导帮我分析了名单分层的问题。',
  '看完视频很有感觉，沙棘的故事讲出来朋友很受触动。',
  '今天列了 30 人名单，发现 A 类只有 5 个，需要继续补充。',
  '学会了用「为什么帮这个人」做联谊邀约，心态稳了很多。',
  '产品体验反馈不错，明天继续跟进。'
];
const REVIEW_NOTES = [
  '表达有进步，继续按时间表执行。',
  '打雾质量不错，注意记录要更具体。',
  '观念还需再扎实，建议把 Day3 内容重听一遍。',
  '状态很好，可以开始带拍档了。'
];

export function seedDemoData() {
  const db = get();
  const today = todayStr();
  const cfg = db.config;
  const ken = db.users.find((u) => u.username === 'ken');

  const members = [];
  for (const n of NEWCOMERS) {
    const startDate = addDays(today, n.startDateOffset);
    const m = {
      id: uid('m'),
      name: n.name,
      phone: n.phone,
      gender: n.gender,
      wechat: '',
      leaderId: ken ? ken.id : null,
      leaderName: ken ? ken.name : 'Ken 哥',
      referrer: pick(['张嘉信', '于晓辉', '田景民', '高铭阳']),
      startDate,
      stage: n.stage,
      status: n.stage === 4 && rnd() > 0.5 ? 'graduated' : 'active',
      focusBreakthrough: n.focus || '',
      openingTimes: n.openingTimes || 0,
      employmentType: n.type || 'fulltime',
      availability: {
        slots: Object.fromEntries(Object.entries(n.avail || {}).map(([d, arr]) => [String(d), arr])),
        note: n.availNote || ''
      },
      marketAnswers: n.stage === 4 ? { what: '做沙棘健康产品的推广与团队搭建', how: '每天打雾 2 人 + 每周 3 场复 A', result: '已带出 2 位拍档，月流水稳定增长' } : { what: '', how: '', result: '' },
      reasons: n.stage >= 2 ? Array.from({ length: 20 }, (_, i) => `理由 ${i + 1}：我想给家人更好的生活，也想证明自己可以。` ) : [],
      schedule: n.stage >= 2 ? [
        { time: '07:00-07:30', content: '晨读 + 三大员背诵' },
        { time: '09:00-12:00', content: '打雾 2 位领导 / 嘉宾' },
        { time: '14:00-17:00', content: '邀约联谊 + 复 A' },
        { time: '20:00-21:00', content: '语音会后会 + Tup 对上' }
      ] : [],
      tags: n.stage === 1 ? ['新进'] : ['闯关中'],
      note: '',
      createdAt: new Date(`${startDate}T00:00:00Z`).toISOString(),
      updatedAt: null
    };
    members.push(m);

    // 新人登录账号
    const { salt, hash } = hashPassword('123456');
    db.users.push({
      id: uid('u'),
      username: n.phone,
      name: n.name,
      role: 'member',
      phone: n.phone,
      memberId: m.id,
      salt,
      hash,
      active: true,
      avatarColor: pick(['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#0EA5E9']),
      title: '新人',
      createdAt: new Date().toISOString()
    });
  }
  db.members.push(...members);

  // ---- 打卡记录 ----
  const checkins = [];
  for (const m of members) {
    const startOffset = NEWCOMERS.find((n) => n.name === m.name).startDateOffset;
    const span = Math.min(Math.abs(startOffset), 45);
    // 部分新人有断卡，用来演示「需关注 / 逾期预警」
    const missRate = m.name === '陈志远' ? 0.45 : m.name === '王思思' ? 0.25 : 0.08;
    for (let i = 0; i < span; i++) {
      if (rnd() < missRate) continue;
      const date = addDays(m.startDate, i);
      if (date > today) break;
      const stage = Number(m.stage);
      const dayIndex = stage === 1 ? Math.min(10, i + 1) : null;
      const vid = cfg.videos.find((v) => v.id === VIDEO_PICKS[Math.floor(rnd() * VIDEO_PICKS.length)]);
      const mistCount = 2 + (rnd() > 0.65 ? 1 : 0);
      const mistList = Array.from({ length: mistCount }, () => ({
        name: `${pick(GUEST_SURNAME)}老师`,
        star: rnd() > 0.3 ? 2 : 1,
        note: pick(['观念沟通', '邀约联谊', '产品体验', '复 A 讲解'])
      }));
      checkins.push({
        id: uid('c'),
        memberId: m.id,
        memberName: m.name,
        date,
        stage,
        dayIndex,
        dayTopic: dayIndex ? (cfg.dayTopics.find((d) => d.day === dayIndex) || null)?.title || '' : '',
        videoDone: rnd() > 0.12,
        videoId: vid ? vid.id : '',
        videoTitle: vid ? `${vid.speaker}·${vid.title}` : '',
        mistCount,
        mistList,
        voiceDone: rnd() > 0.1,
        voiceSummary: pick(VOICE_NOTES),
        learned: pick(VOICE_NOTES),
        mistLearned: '打雾记录：今天向领导请教了邀约话术，学会了先问再讲。',
        minutes: 30 + Math.floor(rnd() * 90),
        score: [3, 4, 4, 5, 5][Math.floor(rnd() * 5)],
        review: rnd() > 0.5 ? pick(REVIEW_NOTES) : '',
        reviewer: rnd() > 0.5 ? 'Ken 哥' : '',
        reviewed: rnd() > 0.5,
        createdAt: new Date(`${date}T12:00:00Z`).toISOString(),
        updatedAt: null
      });
    }
  }
  db.checkins.push(...checkins);

  // ---- 闯关记录 ----
  const btSeed = [
    { member: '赵一鸣', type: 'product', status: 'passed' },
    { member: '孙悦然', type: 'bonus', status: 'pending' },
    { member: '孙悦然', type: 'ppt', status: 'passed' },
    { member: '周峻熙', type: 'ppt', status: 'passed' },
    { member: '吴桐雨', type: 'market', status: 'passed' },
    { member: '郑楷文', type: 'market', status: 'pending' }
  ];
  for (const b of btSeed) {
    const m = members.find((x) => x.name === b.member);
    if (!m) continue;
    const t = cfg.breakthroughTypes.find((x) => x.id === b.type) || { name: b.type };
    db.breakthroughs.push({
      id: uid('b'),
      memberId: m.id,
      memberName: m.name,
      type: b.type,
      typeName: t.name || '市场闯关',
      status: b.status,
      date: addDays(today, -Math.floor(rnd() * 20)),
      score: b.status === 'passed' ? 4 + (rnd() > 0.5 ? 1 : 0) : null,
      reviewer: 'Ken 哥',
      note: b.status === 'passed' ? '表达流畅，可独立讲解。' : '还需再练两轮。',
      createdAt: new Date().toISOString()
    });
  }

  // ---- 大会 / 课堂记录 ----
  for (const m of members.filter((x) => Number(x.stage) >= 2)) {
    db.events.push(
      { id: uid('e'), memberId: m.id, memberName: m.name, type: 'kenClass', name: 'Ken 哥课堂', date: addDays(today, -12), createdAt: new Date().toISOString() },
      { id: uid('e'), memberId: m.id, memberName: m.name, type: 'allHuman', name: '全人类大会', date: addDays(today, -6), createdAt: new Date().toISOString() }
    );
  }

  save(true);
  return { members: members.length, checkins: checkins.length };
}

export function resetAll() {
  const db = get();
  db.members = [];
  db.checkins = [];
  db.breakthroughs = [];
  db.events = [];
  db.logs = [];
  db.users = [];
  db.sessions = {};
  db.config = defaultConfig();
  save(true);
}
