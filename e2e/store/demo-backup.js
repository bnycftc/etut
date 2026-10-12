#!/usr/bin/env node
/**
 * Demo backup for the App Store screenshots (e2e/store/): about four weeks of use by a YKS
 * Sayısal student who is not a real person. Sessions across subjects with solved-question counts,
 * TYT and AYT mock exams with rising nets and tagged topics, topic progress, a daily goal with a
 * long streak, weekly subject targets and net targets.
 *
 * Every date is relative to `now` (the run date): the sessions must fall in the last weeks, so
 * the file is generated at run time, never committed. Output is deterministic for a given `now`.
 * The file is restored through the app's own "Yedekten geri yükle" flow; the Jest test
 * src/domain/__tests__/store-demo-backup.test.ts runs it through the app's backup parser.
 *
 * Usage: node e2e/store/demo-backup.js [out.json]   (stdout without an argument)
 * DEMO_NOW=<epoch ms> fixes the clock (tests, reruns).
 *
 * Plain CommonJS without dependencies: it runs on the CI host before `npm ci` (cached app build).
 */

'use strict';

const HOUR = 3_600_000;
const MIN = 60_000;
const DAY = 24 * HOUR;
/** Türkiye: fixed UTC+3 (same rule as src/domain/istanbul-day.ts). */
const IST = 3 * HOUR;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (ms) => {
  const d = new Date(ms + IST);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const dayStart = (ms) => {
  const d = new Date(ms + IST);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST;
};
/** 0 = Monday … 6 = Sunday (Istanbul). */
const weekday = (ms) => (new Date(ms + IST).getUTCDay() + 6) % 7;

/** Small deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Curriculum topic ids per timer subject (all exist in src/domain/curriculum; the test checks). */
const TOPICS = {};
TOPICS.matematik = [
  'tyt.matematik.oran-oranti',
  'tyt.matematik.sayi-problemleri',
  'tyt.matematik.yuzde-problemleri',
  'tyt.matematik.fonksiyonlar',
  'tyt.matematik.polinomlar',
  'ayt.matematik.trigonometri-1',
  'ayt.matematik.logaritma',
  'ayt.matematik.limit-sureklilik',
  'ayt.matematik.turev',
];
TOPICS.geometri = [
  'tyt.geometri.dik-ucgen',
  'tyt.geometri.ucgende-alan',
  'tyt.geometri.dortgenler',
  'tyt.geometri.cemberde-aci',
];
TOPICS.fizik = [
  'tyt.fizik.kuvvet-newton',
  'tyt.fizik.is-guc-enerji',
  'tyt.fizik.elektrik-akimi',
  'ayt.fizik.vektorler',
  'ayt.fizik.atislar',
];
TOPICS.kimya = [
  'tyt.kimya.kimyasal-hesaplamalar',
  'tyt.kimya.karisimlar',
  'ayt.kimya.gazlar',
  'ayt.kimya.kimyasal-denge',
];
TOPICS.biyoloji = [
  'tyt.biyoloji.hucre-organeller',
  'tyt.biyoloji.kalitim',
  'ayt.biyoloji.sinir-sistemi',
  'ayt.biyoloji.genden-proteine',
];
TOPICS.turkce = [
  'tyt.turkce.paragrafta-anlam',
  'tyt.turkce.cumlede-anlam',
  'tyt.turkce.yazim-kurallari',
  'tyt.turkce.anlatim-bozukluklari',
];
TOPICS.tarih = ['tyt.tarih.milli-mucadele'];
TOPICS.cografya = ['tyt.cografya.iklim-tipleri'];

/** Share of study time per subject (Sayısal: Matematik and Fen first). */
const WEIGHTS = [
  ['matematik', 34],
  ['fizik', 14],
  ['turkce', 13],
  ['kimya', 12],
  ['geometri', 10],
  ['biyoloji', 10],
  ['tarih', 4],
  ['cografya', 3],
];
const QUESTIONS_PER_MIN = { matematik: 0.55, geometri: 0.5, fizik: 0.45, kimya: 0.5, biyoloji: 0.6, turkce: 0.8, tarih: 0.5, cografya: 0.5 };

/** Days of history before today (goal 180 min a day). Missed days: none in the last 16. */
const HISTORY_DAYS = 27;
const GOAL_MIN = 180;

function pickSubject(r, avoid) {
  for (;;) {
    let x = r() * 100;
    for (const [id, w] of WEIGHTS) {
      x -= w;
      if (x <= 0) {
        if (id !== avoid) return id;
        break;
      }
    }
  }
}

function buildSessions(now, r) {
  const sessions = [];
  let n = 0;
  const add = (subjectId, startedAt, minutes, withQuestions = r() < 0.85) => {
    const durationMs = minutes * MIN + Math.floor(r() * 50) * 1000;
    const topics = TOPICS[subjectId] ?? [];
    const s = {
      id: `demo-s-${String(++n).padStart(3, '0')}`,
      subjectId,
      topicId: topics.length > 0 && r() < 0.75 ? topics[Math.floor(r() * topics.length)] : null,
      startedAt,
      endedAt: startedAt + durationMs,
      pauses: [],
      durationMs,
      source: 'timer',
    };
    if (withQuestions) s.questions = Math.max(5, Math.round(minutes * QUESTIONS_PER_MIN[subjectId] * (0.8 + r() * 0.4)));
    sessions.push(s);
    return s.endedAt;
  };

  const today = dayStart(now);
  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const start = today - back * DAY;
    // Older weeks: a missed day and a light one now and then; the last 16 days all reach the goal.
    if (back > 16 && (back === 24 || back === 19)) continue;
    const light = back === 22;
    const weekend = weekday(start) >= 5;
    const total = light ? 70 : GOAL_MIN + 15 + Math.round(r() * (weekend ? 120 : 75));
    const count = light ? 2 : weekend ? 5 : 4;
    let t = start + (weekend ? 10 * HOUR : 16.5 * HOUR) + Math.round(r() * 40) * MIN;
    let last = null;
    for (let i = 0; i < count; i++) {
      const minutes = Math.max(25, Math.round((total / count) * (0.75 + r() * 0.5)));
      const subject = i === 0 && !light ? (r() < 0.6 ? 'matematik' : 'fizik') : pickSubject(r, last);
      t = add(subject, t, minutes) + (10 + Math.round(r() * 20)) * MIN;
      last = subject;
    }
  }

  // Today: about two hours, finished a quarter of an hour before the run (never in the future).
  const end = now - 15 * MIN;
  const plan = [
    ['matematik', 55],
    ['fizik', 40],
    ['turkce', 35],
  ];
  const needed = plan.reduce((s, [, m]) => s + m + 12, 0) * MIN;
  let t = Math.max(today + 5 * MIN, end - needed);
  for (const [subject, minutes] of plan) {
    if (t + (minutes + 1) * MIN > end) break;
    t = add(subject, t, minutes, true) + 12 * MIN;
  }
  return sessions;
}

// Mock exams: [correct, wrong] per section, in EXAM_SECTIONS order (src/domain/net.ts).
const TYT_SECTIONS = [
  ['turkce', 40],
  ['tarih', 5],
  ['cografya', 5],
  ['felsefe', 5],
  ['din', 5],
  ['matematik', 40],
  ['fizik', 7],
  ['kimya', 7],
  ['biyoloji', 6],
];
const AYT_SECTIONS = [
  ['matematik', 40],
  ['fizik', 14],
  ['kimya', 13],
  ['biyoloji', 13],
];
const TYT_RESULTS = [
  // 66,5 → 76,25 → 85 → 93 net
  [[28, 7], [3, 1], [3, 1], [3, 1], [4, 1], [22, 6], [3, 2], [3, 2], [3, 1]],
  [[30, 6], [4, 1], [3, 1], [4, 0], [4, 1], [25, 5], [4, 2], [4, 1], [3, 2]],
  [[31, 5], [4, 0], [4, 1], [4, 1], [5, 0], [28, 5], [5, 1], [4, 2], [4, 1]],
  [[33, 4], [4, 1], [4, 0], [4, 1], [5, 0], [31, 4], [5, 1], [5, 1], [5, 0]],
];
const AYT_RESULTS = [
  // 31 → 37,25 → 44 net
  [[18, 8], [6, 3], [5, 3], [6, 2]],
  [[21, 7], [7, 3], [6, 3], [7, 2]],
  [[24, 6], [8, 2], [7, 2], [8, 2]],
];
/** Topics the wrong and blank answers are tagged with, per paper and section. */
const MARK_TOPICS = {
  TYT: {
    turkce: ['tyt.turkce.paragrafta-anlam', 'tyt.turkce.anlatim-bozukluklari', 'tyt.turkce.yazim-kurallari'],
    matematik: ['tyt.matematik.sayi-problemleri', 'tyt.matematik.fonksiyonlar', 'tyt.matematik.permutasyon', 'tyt.matematik.olasilik'],
    fizik: ['tyt.fizik.elektrik-akimi', 'tyt.fizik.dalgalar'],
    kimya: ['tyt.kimya.kimyasal-hesaplamalar'],
    biyoloji: ['tyt.biyoloji.kalitim'],
  },
  AYT_SAY: {
    matematik: ['ayt.matematik.trigonometri-1', 'ayt.matematik.limit-sureklilik', 'ayt.matematik.turev', 'ayt.matematik.belirli-integral'],
    fizik: ['ayt.fizik.itme-momentum', 'ayt.fizik.manyetizma-induksiyon'],
    kimya: ['ayt.kimya.kimyasal-denge', 'ayt.kimya.organik-bilesikler'],
    biyoloji: ['ayt.biyoloji.genden-proteine'],
  },
};

function marksFor(kind, sections, result) {
  const marks = [];
  sections.forEach(([sectionId, questions], i) => {
    const topics = MARK_TOPICS[kind][sectionId];
    if (!topics) return;
    const [correct, wrong] = result[i];
    const blank = questions - correct - wrong;
    // Tag most wrong answers and about half of the blanks, the first topic the most.
    let w = wrong;
    let b = Math.floor(blank / 2);
    topics.forEach((topicId, j) => {
      const last = j === topics.length - 1;
      const tw = last ? w : Math.min(w, Math.ceil(w / 2));
      const tb = last ? b : Math.min(b, Math.ceil(b / 2));
      w -= tw;
      b -= tb;
      if (tw + tb > 0) marks.push({ sectionId, topicId, wrong: tw, blank: tb });
    });
  });
  return marks;
}

function buildExams(now) {
  const today = dayStart(now);
  const exams = [];
  const add = (kind, sections, result, back, n) => {
    const day = today - back * DAY;
    const createdAt = day + 19 * HOUR;
    exams.push({
      id: `demo-e-${kind.toLowerCase()}-${n}`,
      kind,
      scope: 'genel',
      bransSectionId: null,
      takenOn: dayKey(day),
      createdAt,
      analysisDoneAt: createdAt + 40 * MIN,
      scores: sections.map(([sectionId, questions], i) => ({
        sectionId,
        questions,
        correct: result[i][0],
        wrong: result[i][1],
      })),
      marks: marksFor(kind, sections, result),
    });
  };
  [24, 17, 10, 3].forEach((back, i) => add('TYT', TYT_SECTIONS, TYT_RESULTS[i], back, i + 1));
  [20, 13, 6].forEach((back, i) => add('AYT_SAY', AYT_SECTIONS, AYT_RESULTS[i], back, i + 1));
  return exams.sort((a, b) => a.createdAt - b.createdAt);
}

/** Topic marks: [topic id, status], updated over the last weeks. */
const PROGRESS = [
  ...[
    'temel-kavramlar', 'sayi-basamaklari', 'bolme-bolunebilme', 'ebob-ekok', 'rasyonel-sayilar',
    'ondalik-sayilar', 'basit-esitsizlikler', 'mutlak-deger', 'uslu-sayilar', 'koklu-sayilar',
    'carpanlara-ayirma', 'oran-oranti', 'denklem-cozme', 'sayi-problemleri', 'kesir-problemleri',
    'yas-problemleri', 'isci-problemleri', 'yuzde-problemleri',
  ].map((s) => [`tyt.matematik.${s}`, 'done']),
  ['tyt.matematik.kar-zarar-problemleri', 'review'],
  ['tyt.matematik.hareket-problemleri', 'review'],
  ['tyt.matematik.fonksiyonlar', 'review'],
  ...['dogruda-ucgende-acilar', 'dik-ucgen', 'ozel-ucgenler', 'ikizkenar-eskenar-ucgen', 'aciortay', 'kenarortay'].map(
    (s) => [`tyt.geometri.${s}`, 'done'],
  ),
  ['tyt.geometri.ucgende-alan', 'review'],
  ...['fizik-bilimine-giris', 'madde-ve-ozellikleri', 'basinc', 'kaldirma-kuvveti', 'isi-sicaklik-genlesme', 'hareket', 'kuvvet-newton'].map(
    (s) => [`tyt.fizik.${s}`, 'done'],
  ),
  ['tyt.fizik.is-guc-enerji', 'review'],
  ['tyt.fizik.elektrik-akimi', 'review'],
  ...['kimya-bilimi', 'atom-periyodik-sistem', 'kimyasal-turler-etkilesim', 'maddenin-halleri', 'doga-ve-kimya', 'temel-kanunlar'].map(
    (s) => [`tyt.kimya.${s}`, 'done'],
  ),
  ['tyt.kimya.kimyasal-hesaplamalar', 'review'],
  ...['canlilarin-ortak-ozellikleri', 'inorganik-bilesikler', 'organik-bilesikler', 'hucre-organeller', 'madde-gecisleri'].map(
    (s) => [`tyt.biyoloji.${s}`, 'done'],
  ),
  ...['sozcukte-anlam', 'soz-yorumu', 'cumlede-anlam', 'paragrafta-anlam', 'paragrafta-yapi', 'ses-bilgisi', 'yazim-kurallari', 'noktalama', 'sozcukte-yapi', 'isimler'].map(
    (s) => [`tyt.turkce.${s}`, 'done'],
  ),
  ['tyt.turkce.anlatim-bozukluklari', 'review'],
  ...['fonksiyonlar', 'polinomlar', 'ikinci-derece-denklemler', 'karmasik-sayilar', 'parabol', 'esitsizlikler', 'permutasyon'].map(
    (s) => [`ayt.matematik.${s}`, 'done'],
  ),
  ['ayt.matematik.trigonometri-1', 'review'],
  ['ayt.matematik.limit-sureklilik', 'review'],
  ['ayt.fizik.vektorler', 'done'],
  ['ayt.fizik.bagil-hareket', 'done'],
  ['ayt.fizik.newton-yasalari', 'done'],
  ['ayt.kimya.modern-atom-teorisi', 'done'],
  ['ayt.kimya.gazlar', 'review'],
  ['ayt.biyoloji.sinir-sistemi', 'done'],
];

function buildTopicProgress(now) {
  const from = dayStart(now) - 25 * DAY;
  const span = 24 * DAY;
  return PROGRESS.map(([topicId, status], i) => ({
    topicId,
    status,
    updatedAt: from + Math.round((span * i) / PROGRESS.length) + 21 * HOUR,
  }));
}

function buildDemoBackup(now = Date.now()) {
  const r = rng(20270619);
  const year = new Date(now + IST).getUTCFullYear();
  return {
    format: 'etut-yedek',
    schemaVersion: 2,
    exportedAt: now - 5 * MIN,
    appVersion: 'demo',
    profile: { birthYear: year - 18, examType: 'YKS', yksArea: 'sayisal' },
    sessions: buildSessions(now, r),
    exams: buildExams(now),
    topicProgress: buildTopicProgress(now),
    settings: {
      dailyGoalMinutes: GOAL_MIN,
      pomodoro: null,
      timerMode: 'stopwatch',
      examDates: {},
      netTargets: { 'TYT:turkce': 35, 'TYT:matematik': 33, 'AYT_SAY:matematik': 30 },
      lastSubject: 'matematik',
      subjectWeeklyTargets: { matematik: 600, fizik: 240, turkce: 210, kimya: 180, geometri: 150, biyoloji: 150 },
    },
  };
}

module.exports = { buildDemoBackup, TOPICS, MARK_TOPICS, PROGRESS };

if (require.main === module) {
  const now = process.env.DEMO_NOW ? Number(process.env.DEMO_NOW) : Date.now();
  const json = JSON.stringify(buildDemoBackup(now));
  const out = process.argv[2];
  if (out) require('fs').writeFileSync(out, json);
  else process.stdout.write(json + '\n');
}
