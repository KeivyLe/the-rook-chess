// Test cho src/progress.js: mở khoá level, Daily theo ngày, streak.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createProgress, isUnlocked, levelStatus, markSolved, currentLevel,
  dateKey, previousDateKey, dailyIndex, completeDaily, isDailySolved, currentStreak,
} from '../src/progress.js';

test('người chơi mới chỉ mở level 1', () => {
  const p = createProgress();
  assert.equal(isUnlocked(p, 1), true);
  assert.equal(isUnlocked(p, 2), false);
  assert.equal(levelStatus(p, 1), 'open');
  assert.equal(levelStatus(p, 2), 'locked');
  assert.equal(currentLevel(p, 60), 1);
});

test('thắng level n thì mở level n+1; giải lại level cũ không mở thêm', () => {
  const p = createProgress();
  assert.deepEqual(markSolved(p, 1), { firstTime: true, unlocked: 2 });
  assert.equal(levelStatus(p, 1), 'solved');
  assert.equal(levelStatus(p, 2), 'open');
  assert.deepEqual(markSolved(p, 2), { firstTime: true, unlocked: 3 });
  assert.deepEqual(markSolved(p, 1), { firstTime: false, unlocked: null });
  assert.equal(p.unlockedLevel, 3);
  assert.throws(() => markSolved(p, 5), /chưa mở/);
});

test('không mở quá level cuối', () => {
  const p = createProgress();
  for (let id = 1; id <= 3; id++) markSolved(p, id, { totalLevels: 3 });
  assert.equal(p.unlockedLevel, 3);
  assert.equal(currentLevel(p, 3), 3);
});

test('ghi có dùng gợi ý hay không, giữ kết quả tốt nhất khi giải lại', () => {
  const p = createProgress();
  markSolved(p, 1, { hintUsed: true });
  assert.deepEqual(p.solved[1], { hintUsed: true });
  markSolved(p, 1, { hintUsed: false });
  assert.deepEqual(p.solved[1], { hintUsed: false });
  markSolved(p, 1, { hintUsed: true });
  assert.deepEqual(p.solved[1], { hintUsed: false }, 'đã từng giải không gợi ý thì giữ nguyên');
});

test('dateKey theo giờ địa phương; previousDateKey qua tháng, năm, năm nhuận', () => {
  assert.equal(dateKey(new Date(2026, 10, 12, 23, 59)), '20261112');
  assert.equal(dateKey(new Date(2026, 0, 5)), '20260105');
  assert.equal(previousDateKey('20261112'), '20261111');
  assert.equal(previousDateKey('20261201'), '20261130');
  assert.equal(previousDateKey('20270101'), '20261231');
  assert.equal(previousDateKey('20280301'), '20280229');
  assert.throws(() => previousDateKey('2026-11-12'), /yyyymmdd/);
});

test('Daily: cùng ngày cùng level; 30 ngày liên tiếp đi qua đủ 30 level', () => {
  assert.equal(dailyIndex('20261112', 30), dailyIndex('20261112', 30));
  const seen = new Set();
  let key = '20261231';
  for (let i = 0; i < 30; i++) {
    seen.add(dailyIndex(key, 30));
    key = previousDateKey(key);
  }
  assert.equal(seen.size, 30);
  for (const i of seen) assert.ok(i >= 0 && i < 30);
  assert.throws(() => dailyIndex('20261112', 0), /rỗng/);
});

test('streak: ngày liên tiếp thì tăng, bỏ lỡ 1 ngày thì về 1, giải lại cùng ngày không tính', () => {
  const p = createProgress();
  assert.deepEqual(completeDaily(p, '20261130'), { firstTime: true, streak: 1 });
  assert.deepEqual(completeDaily(p, '20261201'), { firstTime: true, streak: 2 }); // qua tháng
  assert.deepEqual(completeDaily(p, '20261201'), { firstTime: false, streak: 2 });
  assert.deepEqual(completeDaily(p, '20261202'), { firstTime: true, streak: 3 });
  assert.equal(isDailySolved(p, '20261202'), true);
  assert.deepEqual(completeDaily(p, '20261205'), { firstTime: true, streak: 1 }); // bỏ lỡ 2 ngày
  assert.equal(p.daily.bestStreak, 3);
});

test('streak hiển thị: còn giữ tới hết ngày hôm sau, bỏ lỡ thì về 0', () => {
  const p = createProgress();
  completeDaily(p, '20261111');
  completeDaily(p, '20261112');
  assert.equal(currentStreak(p, '20261112'), 2);
  assert.equal(currentStreak(p, '20261113'), 2, 'hôm nay chưa giải nhưng vẫn kịp nối chuỗi');
  assert.equal(currentStreak(p, '20261114'), 0);
});
