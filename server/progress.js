/**
 * 进度计算引擎
 * 把「打卡记录 + 闯关记录 + 大会记录」换算成每个新人的阶段进度、连续天数、完成度。
 */
export const TZ = 'Asia/Shanghai';

export function todayStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function dateStr(iso) {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

export function daysBetween(aStr, bStr) {
  const a = Date.parse(`${aStr}T00:00:00Z`);
  const b = Date.parse(`${bStr}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function addDays(str, n) {
  const d = new Date(`${str}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 连续打卡天数（从今天或最后打卡日往前数） */
export function streakOf(dateSet, today = todayStr()) {
  let cursor = dateSet.has(today) ? today : null;
  if (!cursor) {
    // 允许今天还没打卡：从昨天开始数
    cursor = addDays(today, -1);
    if (!dateSet.has(cursor)) return 0;
  }
  let n = 0;
  while (dateSet.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * 计算单个新人的完整进度
 * @param {object} ctx { checkins, breakthroughs, events, config }
 */
export function computeProgress(member, ctx) {
  const cfg = ctx.config;
  const myCheckins = ctx.checkins
    .filter((c) => c.memberId === member.id)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const myBt = ctx.breakthroughs.filter((b) => b.memberId === member.id);
  const myEvents = ctx.events.filter((e) => e.memberId === member.id);

  const dates = new Set(myCheckins.map((c) => c.date));
  const today = todayStr();
  const stage = Number(member.stage) || 1;

  // ---- 通用统计 ----
  const videoTotal = myCheckins.reduce((s, c) => s + (c.videoDone ? 1 : 0), 0);
  const videoUnique = new Set(myCheckins.filter((c) => c.videoDone && c.videoId).map((c) => c.videoId)).size;
  const mistTotal = myCheckins.reduce((s, c) => s + (Number(c.mistCount) || 0), 0);
  const mistQualified = myCheckins.reduce(
    (s, c) => s + (Array.isArray(c.mistList) ? c.mistList.filter((g) => (Number(g.star) || 0) >= (cfg.stage1Daily?.mistStarMin || 1)).length : 0),
    0
  );
  const voiceDays = myCheckins.filter((c) => c.voiceDone).length;
  const lastCheckin = myCheckins.length ? myCheckins[myCheckins.length - 1] : null;
  const lastDate = lastCheckin ? lastCheckin.date : null;
  const overdue = lastDate ? Math.max(0, daysBetween(lastDate, today)) : (member.startDate ? daysBetween(member.startDate, today) : 999);
  const streak = streakOf(dates, today);

  // ---- 分阶段任务清单 ----
  const tasks = [];
  let stagePercent = 0;

  if (stage === 1) {
    const d = cfg.stage1Daily || {};
    const targetDays = cfg.dayTopics?.length || 10;
    const dayDone = new Set(myCheckins.filter((c) => c.dayIndex).map((c) => c.dayIndex));
    const daysDone = myCheckins.filter((c) => c.videoDone && (Number(c.mistCount) || 0) >= (d.mistPerDay || 2) && c.voiceDone).length;
    tasks.push(
      { id: 'video', label: `每日视频 · 已看 ${videoTotal} 个`, done: videoTotal > 0, hint: `每天 1 个视频，建议覆盖全部 ${cfg.videos?.length || 8} 个目录（已覆盖 ${videoUnique} 个）` },
      { id: 'mist', label: `打雾累计 ${mistTotal} 人`, done: mistTotal >= (d.mistTotalTarget || 30), hint: `每天 2 个嘉宾，${d.mistStarMin || 1} 星及以上，阶段目标 ${d.mistTotalTarget || 30} 人（合格 ${mistQualified} 人）` },
      { id: 'voice', label: `语音会后会 ${voiceDays} 天`, done: voiceDays >= targetDays, hint: '每天语音反馈会后会内容' },
      { id: 'days', label: `达标天数 ${daysDone} / ${targetDays}`, done: daysDone >= targetDays, hint: '视频 + 打雾 + 语音三项全完成才算达标' },
      { id: 'topics', label: `主题学习 ${dayDone.size} / ${targetDays}`, done: dayDone.size >= targetDays, hint: 'Day1 ~ Day10 主题逐项过关' }
    );
    stagePercent = Math.round(
      (Math.min(daysDone, targetDays) / targetDays) * 60 +
      (Math.min(mistTotal, d.mistTotalTarget || 30) / (d.mistTotalTarget || 30)) * 25 +
      (Math.min(dayDone.size, targetDays) / targetDays) * 15
    );
  } else if (stage === 2) {
    const req = cfg.stage2Requirements || [];
    const voice15 = Math.min(voiceDays, 15);
    const ken = myEvents.filter((e) => e.type === 'kenClass').length;
    const allHuman = myEvents.filter((e) => e.type === 'allHuman').length;
    const passed = myBt.filter((b) => b.status === 'passed');
    const focus = member.focusBreakthrough || (passed[0] && passed[0].type) || '';
    const reasons = Array.isArray(member.reasons) ? member.reasons.filter((r) => (r || '').trim()).length : 0;
    const hasSchedule = Array.isArray(member.schedule) && member.schedule.length > 0;
    tasks.push(
      { id: 'voice15', label: `语音会后会连续 ${voiceDays} 天 / 15`, done: voiceDays >= 15, hint: '连续 15 天每天语音总结（宇航家园视频 + 打雾学习 30 人）' },
      { id: 'ken', label: `Ken 哥课堂 ${ken} 次`, done: ken > 0, hint: '一个月一次' },
      { id: 'allHuman', label: `全人类大会 ${allHuman} 次`, done: allHuman > 0, hint: '一个月一次' },
      { id: 'breakthrough', label: focus ? `大闯关（${passed.length ? '已通过' : '进行中'}）` : '大闯关（未选重点）', done: passed.length > 0, hint: '产品示范 / 复数 / 游场 PPT / 三大员 四选一' },
      { id: 'schedule', label: '时间表制定', done: hasSchedule, hint: 'A 养成时间表习惯向上管理；B 制定闯关目标与时间规划' },
      { id: 'reasons20', label: `创业/改变的理由 ${reasons} / 20`, done: reasons >= 20, hint: '要求丰富、且感性' }
    );
    stagePercent = Math.round(
      (voice15 / 15) * 30 +
      (ken ? 10 : 0) + (allHuman ? 10 : 0) +
      (passed.length ? 25 : 0) +
      (hasSchedule ? 10 : 0) +
      (Math.min(reasons, 20) / 20) * 15
    );
  } else if (stage === 3) {
    const times = member.openingTimes || 0;
    const vDays = myCheckins.filter((c) => c.voiceDone && Number(c.stage) === 3).length;
    tasks.push(
      { id: 'opening7', label: `开业七件事讲解 ${times} / 3 次`, done: times >= 3, hint: '重复学 1-3 次' },
      { id: 'voice', label: `语音会后会 ${vDays} 次`, done: vDays > 0, hint: '语音反馈学习的会后会内容' }
    );
    stagePercent = Math.round((Math.min(times, 3) / 3) * 70 + (vDays ? 30 : 0));
  } else {
    const answers = member.marketAnswers || {};
    const done3 = ['what', 'how', 'result'].filter((k) => (answers[k] || '').trim()).length;
    const passed = myBt.some((b) => b.type === 'market' && b.status === 'passed');
    tasks.push(
      { id: 'market3', label: `市场三问 ${done3} / 3`, done: done3 === 3, hint: '做什么、怎么做、做的怎么样' },
      { id: 'final', label: '完成闯关', done: passed, hint: '市场前期阶段闯关考核' }
    );
    stagePercent = Math.round((done3 / 3) * 60 + (passed ? 40 : 0));
  }

  stagePercent = Math.max(0, Math.min(100, stagePercent));

  // 总进度：已完成阶段按权重折入
  const weights = [30, 30, 20, 20];
  let overall = 0;
  for (let i = 1; i < stage; i++) overall += weights[i - 1];
  overall += (stagePercent / 100) * weights[stage - 1];

  return {
    stage,
    stagePercent,
    overallPercent: Math.round(overall),
    tasks,
    stats: {
      checkinDays: dates.size,
      checkinCount: myCheckins.length,
      videoTotal,
      videoUnique,
      mistTotal,
      mistQualified,
      mistTarget: cfg.stage1Daily?.mistTotalTarget || 30,
      voiceDays,
      streak,
      lastDate,
      overdueDays: overdue === 999 ? null : overdue
    },
    lastCheckin
  };
}
