// Test cho src/trophies.js: điều kiện đạt, Bạch kim, thống kê từ save.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TROPHIES, createTrophies, collectStats, evaluateTrophies, trophyCounts } from '../src/trophies.js';
import { createSave } from '../src/storage.js';
import { markSolved, completeDaily } from '../src/progress.js';
import { markObstacleSolved, recordBlitz } from '../src/modes.js';

// Dữ liệu level nhỏ: 2 chương, mỗi chương 2 level.
const DATA = {
  chapters: [{ chapter: 1 }, { chapter: 2 }],
  levels: [{ id: 1, chapter: 1 }, { id: 2, chapter: 1 }, { id: 3, chapter: 2 }, { id: 4, chapter: 2 }],
};

const ZERO = { levelsSolved: 0, chaptersDone: [], hintlessSolved: 0, perfectSolved: 0, dailySolved: 0, bestStreak: 0, obstacleSolved: 0, blitzBest: 0 };

test('có đủ 4 hạng, đúng 1 Bạch kim', () => {
  const tiers = new Set(TROPHIES.map((t) => t.tier));
  assert.deepEqual([...tiers].sort(), ['bronze', 'gold', 'platinum', 'silver']);
  assert.equal(TROPHIES.filter((t) => t.tier === 'platinum').length, 1);
});

test('collectStats đọc đúng từ save', () => {
  const save = createSave();
  markSolved(save.progress, 1, { perfect: true });
  markSolved(save.progress, 2, { hintUsed: true });
  completeDaily(save.progress, '20261205');
  markObstacleSolved(save.modes, 0);
  recordBlitz(save.modes, 5, '20261205');
  assert.deepEqual(collectStats(save, DATA), {
    levelsSolved: 2, chaptersDone: [1], hintlessSolved: 1, perfectSolved: 1,
    dailySolved: 1, bestStreak: 1, obstacleSolved: 1, blitzBest: 5,
  });
});

test('evaluateTrophies: trả về trophy VỪA đạt, không lặp lại', () => {
  const t = createTrophies();
  assert.deepEqual(evaluateTrophies(t, ZERO, '20261205'), []);
  const fresh = evaluateTrophies(t, { ...ZERO, levelsSolved: 1, blitzBest: 3 }, '20261205');
  assert.deepEqual(fresh.map((x) => x.id), ['first-mate', 'blitz-3']);
  assert.equal(t.unlocked['first-mate'], '20261205');
  assert.deepEqual(evaluateTrophies(t, { ...ZERO, levelsSolved: 2, blitzBest: 3 }, '20261206'), []);
  assert.deepEqual(trophyCounts(t), { bronze: 2, silver: 0, gold: 0, platinum: 0 });
});

test('Bạch kim chỉ khi đạt mọi trophy khác', () => {
  const t = createTrophies();
  const all = { levelsSolved: 60, chaptersDone: [1, 2, 3, 4], hintlessSolved: 60, perfectSolved: 60, dailySolved: 9, bestStreak: 7, obstacleSolved: 1, blitzBest: 7 };
  const fresh = evaluateTrophies(t, all, '20261205');
  assert.equal(fresh.some((x) => x.tier === 'platinum'), false, 'còn thiếu Blitz 8 thì chưa có Bạch kim');
  const last = evaluateTrophies(t, { ...all, blitzBest: 8 }, '20261206');
  assert.deepEqual(last.map((x) => x.id), ['blitz-8', 'platinum']);
  assert.equal(trophyCounts(t).platinum, 1);
});
