// Test cho src/modes.js: tiến trình Obstacle, kỷ lục Blitz theo tuần.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createModes, markObstacleSolved, obstacleSolvedCount, recordBlitz, blitzWeekBest, blitzQueue } from '../src/modes.js';
import { weekKey } from '../src/progress.js';

test('Obstacle: ghi bài đã giải, giữ kết quả tốt nhất', () => {
  const m = createModes();
  assert.deepEqual(markObstacleSolved(m, 0, { perfect: true }), { firstTime: true });
  assert.deepEqual(markObstacleSolved(m, 0), { firstTime: false });
  assert.deepEqual(m.obstacle.solved[0], { perfect: true });
  markObstacleSolved(m, 3);
  assert.equal(obstacleSolvedCount(m), 2);
});

test('Blitz: kỷ lục cá nhân và kỷ lục tuần (tuần mới tính lại)', () => {
  const m = createModes();
  assert.deepEqual(recordBlitz(m, 4, '20261207'), { best: 4, weekBest: 4, newBest: true, newWeekBest: true });
  assert.deepEqual(recordBlitz(m, 2, '20261209'), { best: 4, weekBest: 4, newBest: false, newWeekBest: false });
  assert.equal(blitzWeekBest(m, '20261213'), 4, 'Chủ nhật vẫn cùng tuần');
  assert.equal(blitzWeekBest(m, '20261214'), 0, 'thứ Hai là tuần mới');
  assert.deepEqual(recordBlitz(m, 3, '20261214'), { best: 4, weekBest: 3, newBest: false, newWeekBest: true });
  assert.equal(m.blitz.runs, 3);
});

test('weekKey: thứ Hai đầu tuần, qua năm vẫn đúng', () => {
  assert.equal(weekKey('20261114'), '20261109'); // thứ Bảy
  assert.equal(weekKey('20261116'), '20261116'); // thứ Hai
  assert.equal(weekKey('20270103'), '20261228'); // Chủ nhật đầu năm
});

test('blitzQueue: trộn đủ mọi bài, mỗi bài một lần', () => {
  let i = 0;
  const q = blitzQueue(10, () => ((i++ * 37) % 100) / 100);
  assert.deepEqual([...q].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
