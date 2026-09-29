/**
 * ATK 工作室 · 新人学习进度领域模型
 * ------------------------------------------------------------------
 * 这个文件是「业务配置」的唯一真源（Single Source of Truth）。
 * 服务端启动时作为默认配置写入数据库，前端通过 /shared/domain.js 直接引用。
 * 管理员可在后台「阶段配置」中修改，修改后的值存进 data/db.json 的 config 字段。
 */

/** 团队黑话词典 */
export const GLOSSARY = [
  { term: '打雾', desc: '请教、打开迷雾的意思。向领导/嘉宾请教，把不清楚的地方问明白。' },
  { term: 'P 仔', desc: '潜在客户朋友（Prospect）。还在跟进中、尚未成交的对象。' },
  { term: '复 A', desc: '讲解公司和产品 PPT。' },
  { term: '复数', desc: '讲解公司的制度模式。' },
  { term: 'Tup 对上', desc: '向上对齐 / 向上管理，把动作和结果同步给领导人。' },
  { term: '联谊', desc: '邀约沟通、建立关系的动作。' },
  { term: '会后会', desc: '每次学习/活动结束后的复盘语音反馈。' },
  { term: '闯关', desc: '阶段性的通关考核，通过后才可进入下一阶段。' }
];

/** 阶段一 · 视频目录（每天看 1 个视频） */
export const VIDEOS = [
  { id: 'v1', group: '行业认知', speaker: '张嘉信', title: '正确认识直销' },
  { id: 'v2', group: '行业认知', speaker: '张嘉信', title: '直销形势分析' },
  { id: 'v3', group: '选择宇航', speaker: '张嘉信', title: '推消合一的理念' },
  { id: 'v4', group: '选择宇航', speaker: '张嘉信', title: '本质直销的逻辑' },
  { id: 'v5', group: '选择宇航', speaker: '于晓辉', title: '宇航人集团八大优势' },
  { id: 'v6', group: '选择宇航', speaker: '张嘉信', title: '永续经营三要素之前言·文化·模式·制度' },
  { id: 'v7', group: '产品认知', speaker: '田景民', title: '沙棘研究与未来发展' },
  { id: 'v8', group: '产品认知', speaker: '高铭阳', title: '沙棘的神奇故事' }
];

/** 阶段一 · 每日主题（Day1 ~ Day10） */
export const DAY_TOPICS = [
  {
    day: 1,
    tag: '行业',
    title: '行业',
    points: ['行业咨询', '行业魅力', '模式', '放大格局', '定位', '产品知识（产品体验）']
  },
  {
    day: 2,
    tag: '生意观 · 老板',
    title: '生意观 · 老板心态',
    points: [
      '老板心态（思维、格局、抗压能力、负债）',
      '行业规则（1-5 条）',
      '抗负面的压力',
      '生意观（长远计划做事业、事业是累计的过程、长远发展不怕投资）',
      '诚实守信',
      '看书',
      '生意人习惯'
    ]
  },
  {
    day: 3,
    tag: '做有素质的人',
    title: '做有素质的人',
    points: [
      '感恩',
      '帮人',
      '五相信',
      '学习的重要性',
      '要快不要急',
      '谈改变的重要性',
      '言行举止',
      '远离负面',
      '感恩对上尊敬对下',
      '好的到处传、不好的向上传',
      '过五关',
      '想成为什么人就靠近什么样的人'
    ]
  },
  {
    day: 4,
    tag: '联谊邀约心态',
    title: '联谊邀约心态',
    points: [
      '学习复数',
      '复 A',
      '简单联谊邀约的例子（为什么帮这个人）',
      '产品知识',
      '联谊邀约的心态',
      '帮人',
      '平常心',
      '由亲至疏',
      '基本的联谊对答'
    ]
  },
  {
    day: 5,
    tag: '装身',
    title: '装身',
    points: [
      '改变造型',
      '确认新人用产品',
      '买书',
      '教订目标',
      '打雾快跳快上的例子',
      '列自己的时间表'
    ]
  },
  {
    day: 6,
    tag: '开门七件事',
    title: '开门七件事 · 列名单',
    points: ['打雾快点快上例子', '开门七件事', '列名单']
  },
  {
    day: 7,
    tag: '慢慢放手',
    title: '慢慢放手',
    points: ['闯关产品复数', 'Tup 对上', '对答']
  },
  {
    day: 8,
    tag: '坚持用心',
    title: '坚持用心',
    points: [
      '慢慢开始见朋友',
      '准备和别人学习做生意',
      '教拍档如何打雾领导（不害怕拒绝、积极主动、不打毒雾、做朋友）',
      '基本功教学',
      '接下来每天坚持打雾两到三个领导',
      '做好打雾领导记录'
    ]
  },
  {
    day: 9,
    tag: '跟进人名单',
    title: '跟进人名单',
    points: ['跟进每个可能性 P 仔', '约对应的领导打雾']
  },
  {
    day: 10,
    tag: '复盘通关',
    title: '十日复盘 · 通关准备',
    custom: true,
    points: ['10 天学习复盘总结', '观念检验（行业 / 生意观 / 素质 / 邀约）', '列出进入闯关阶段的目标与时间表']
  }
];

/** 阶段一 · 每天固定动作 */
export const STAGE1_DAILY = {
  videoPerDay: 1,
  mistPerDay: 2,
  mistStarMin: 1,
  mistTotalTarget: 30,
  voiceFeedback: true
};

/** 阶段二 · 闯关项（四选一作为重点攻克任务） */
export const BREAKTHROUGH_TYPES = [
  { id: 'product', name: '产品示范闯关', desc: '独立完成沙棘产品示范，讲清成分、原理与体验反馈。' },
  { id: 'bonus', name: '复数闯关', desc: '完整讲解公司制度模式，讲清收益逻辑与长期性。' },
  { id: 'ppt', name: '游场 / 讲解公司产品 PPT 闯关', desc: '独立讲解公司产品 PPT，做到游场级别的流畅表达。' },
  { id: 'roles', name: '三大员 · 每日必背', desc: '三大员内容理解 + 背诵，做到脱稿可讲。' }
];

/** 阶段二 · 其他硬性要求 */
export const STAGE2_REQUIREMENTS = [
  { id: 'voice15', name: '连续 15 天语音会后会总结', desc: '每天语音反馈学习总结（宇航家园视频 + 打雾学习 30 人）。', targetDays: 15 },
  { id: 'kenClass', name: '参加 Ken 哥课堂', desc: '一个月一次，需现场/线上参加并提交反馈。' },
  { id: 'allHuman', name: '参加全人类大会', desc: '一个月一次，需参加并提交反馈。' },
  { id: 'schedule', name: '制定时间表', desc: 'A. 团队内所有学习、行动均养成时间表制定习惯，向上管理；B. 制定闯关完成目标和学习的时间规划。' },
  { id: 'reasons20', name: '创业 / 改变的 20 个理由', desc: '要求丰富、且感性。写满 20 条。' }
];

/** 阶段三 · 开业七件事（可后台编辑） */
export const OPENING_SEVEN = [
  { id: 'o1', name: '列名单', desc: '梳理 100 人名单并分层（A / B / C）。' },
  { id: 'o2', name: '定邀约', desc: '每天 2 个嘉宾邀约，约到对应领导打雾。' },
  { id: 'o3', name: '讲计划（复 A）', desc: '讲解公司产品 PPT，讲清「做什么」。' },
  { id: 'o4', name: '产品示范', desc: '沙棘产品体验与示范，讲清「为什么」。' },
  { id: 'o5', name: '讲制度（复数）', desc: '讲解公司制度模式，讲清「怎么做」。' },
  { id: 'o6', name: '跟进成交', desc: '会后会跟进、答疑、送货与产品确认。' },
  { id: 'o7', name: '复制带人', desc: '带出第一个拍档，复制自己的时间表与动作。' }
];

/** 阶段三 · 硬性要求 */
export const STAGE3_REQUIREMENTS = [
  { id: 'opening7', name: '讲解开业七件事', desc: '重复学 1-3 次，能独立讲清楚七件事。', times: 3 },
  { id: 'voice', name: '语音反馈会后会内容', desc: '每次学习后语音反馈复盘内容。' }
];

/** 阶段四 · 市场前期 */
export const STAGE4_REQUIREMENTS = [
  { id: 'q1', name: '市场话题 · 做什么', desc: '用 3 分钟讲清楚自己在做什么。' },
  { id: 'q2', name: '市场话题 · 怎么做', desc: '讲清楚具体动作与方法路径。' },
  { id: 'q3', name: '市场话题 · 做的怎么样', desc: '用真实数据与结果说话。' },
  { id: 'final', name: '完成闯关', desc: '通过市场前期阶段闯关考核。' }
];

/** 三大员 · 每日必背（可后台编辑） */
export const THREE_ROLES = [
  { id: 'r1', name: '产品讲解员', points: ['沙棘的成分与原理', '产品体验的真实反馈', '常见疑问的标准回答'] },
  { id: 'r2', name: '制度（复数）讲解员', points: ['制度模式完整讲通', '长期性与累计性讲透', '不做收益承诺'] },
  { id: 'r3', name: '会后会主持员', points: ['会后会流程主持', '引导新人复盘总结', '做好记录与向上同步'] }
];

/** 四个阶段 */
export const STAGES = [
  {
    id: 1,
    name: '价值确认 · 定心定位',
    short: '阶段一',
    duration: 10,
    unit: '天',
    summary: '10 天打底：每天 1 个视频 + 打雾 2 个嘉宾 + 语音会后会反馈，观念要在 2 周内打扎实。',
    color: '#6366F1',
    goals: [
      '每天看 1 个视频（共 8 个视频目录循环）',
      '每天打雾 2 个嘉宾（1 星及以上，累计 30 人）',
      '每天语音反馈会后会内容',
      '完成 Day1 ~ Day10 主题学习'
    ]
  },
  {
    id: 2,
    name: '闯关阶段',
    short: '阶段二',
    duration: 30,
    unit: '天',
    summary: '连续 15 天语音会后会 + 月度课堂 + 大闯关四选一 + 时间表 + 20 个理由。',
    color: '#F59E0B',
    goals: [
      '连续 15 天每天语音会后会总结',
      '参加月度 Ken 哥课堂、全人类大会',
      '完成大闯关（产品示范 / 复数 / 游场 PPT / 三大员 四选一）',
      '制定时间表与闯关目标',
      '写满创业 / 改变的 20 个理由'
    ]
  },
  {
    id: 3,
    name: '开业阶段',
    short: '阶段三',
    duration: 14,
    unit: '天',
    summary: '讲解开业七件事（重复学 1-3 次）+ 语音反馈会后会内容。',
    color: '#10B981',
    goals: ['独立讲解开业七件事（1-3 次）', '每次学习后语音反馈会后会内容']
  },
  {
    id: 4,
    name: '市场前期阶段',
    short: '阶段四',
    duration: 21,
    unit: '天',
    summary: '回答市场话题：做什么、怎么做、做的怎么样，并完成闯关。',
    color: '#EC4899',
    goals: ['讲清市场三问', '完成市场前期闯关']
  }
];

/** 新人投入方式：全职 / 兼职（兼职必须登记空闲时间，才好排学习） */
export const EMPLOYMENT_TYPES = [
  { id: 'fulltime', name: '全职', short: '全职', color: '#4F46E5', desc: '全职投入，白天大部分时间都能安排' },
  { id: 'parttime', name: '兼职', short: '兼职', color: '#F59E0B', desc: '有本职工作/学业，只能按空闲时段安排' }
];

/** 空闲时间：一周七天 × 三个时段 */
export const WEEK_DAYS = [
  { id: 1, name: '周一' }, { id: 2, name: '周二' }, { id: 3, name: '周三' },
  { id: 4, name: '周四' }, { id: 5, name: '周五' }, { id: 6, name: '周六' }, { id: 7, name: '周日' }
];

export const TIME_SLOTS = [
  { id: 'am', name: '上午', time: '09:00-12:00' },
  { id: 'pm', name: '下午', time: '12:00-18:00' },
  { id: 'ev', name: '晚上', time: '18:00-22:00' }
];

export const MEMBER_STATUS = [
  { id: 'active', name: '在培', color: '#10B981' },
  { id: 'risk', name: '需关注', color: '#F59E0B' },
  { id: 'paused', name: '暂停', color: '#94A3B8' },
  { id: 'graduated', name: '已通关', color: '#6366F1' }
];

export const ROLES = [
  { id: 'admin', name: '管理员', desc: '全量管理：新人、打卡、闯关、配置、账号' },
  { id: 'leader', name: '领导人', desc: '管理自己带的新人：查看、审核、点评' },
  { id: 'member', name: '新人', desc: '查看自己的进度并提交每日打卡' }
];

/** 默认配置（写库用） */
export function defaultConfig() {
  return {
    studioName: 'ATK 工作室',
    subtitle: '新人学习进度管理系统',
    videos: VIDEOS,
    dayTopics: DAY_TOPICS,
    stage1Daily: STAGE1_DAILY,
    breakthroughTypes: BREAKTHROUGH_TYPES,
    stage2Requirements: STAGE2_REQUIREMENTS,
    openingSeven: OPENING_SEVEN,
    stage3Requirements: STAGE3_REQUIREMENTS,
    stage4Requirements: STAGE4_REQUIREMENTS,
    threeRoles: THREE_ROLES,
    stages: STAGES,
    glossary: GLOSSARY,
    employmentTypes: EMPLOYMENT_TYPES,
    weekDays: WEEK_DAYS,
    timeSlots: TIME_SLOTS,
    /** 超过 N 天未打卡则预警 */
    overdueDays: 2
  };
}

export const DOMAIN_VERSION = 1;
