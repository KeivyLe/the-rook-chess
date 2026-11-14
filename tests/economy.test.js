// Test cho src/economy.js: coin, giá gợi ý, rewarded giả lập theo kế hoạch MKT.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEconomy, solveReward, addSolveReward, canAffordHint, spendForHint, hintCost,
  canWatchHintAd, useHintAd, START_COINS, HINT_COSTS, HINT_ADS_PER_DAY,
} from '../src/economy.js';

test('người chơi mới có 100 coin, chưa dùng rewarded', () => {
  const e = createEconomy();
  assert.equal(e.coins, START_COINS);
  assert.equal(START_COINS, 100);
  assert.equal(e.hintAdsUsed, 0);
});

test('thưởng giải level: lần đầu +10, hoàn hảo +5, Daily +20, giải lại 0', () => {
  assert.equal(solveReward({ firstTime: true }), 10);
  assert.equal(solveReward({ firstTime: true, perfect: true }), 15);
  assert.equal(solveReward({ firstTime: true, daily: true }), 20);
  assert.equal(solveReward({ firstTime: true, daily: true, perfect: true }), 25);
  assert.equal(solveReward({ firstTime: false, perfect: true }), 0, 'giải lại level cũ không có coin');
  const e = createEconomy();
  assert.equal(addSolveReward(e, { firstTime: true, perfect: true }), 15);
  assert.equal(e.coins, 115);
});

test('gợi ý 3 mức 20/40/100 coin; không đủ coin thì không trừ', () => {
  assert.deepEqual(HINT_COSTS, { 1: 20, 2: 40, 3: 100 });
  const e = createEconomy(); // 100 coin
  assert.deepEqual(spendForHint(e, 2), { ok: true, cost: 40, coins: 60 });
  assert.equal(canAffordHint(e, 3), false);
  assert.deepEqual(spendForHint(e, 3), { ok: false, cost: 100, coins: 60 });
  assert.equal(e.coins, 60);
  assert.throws(() => spendForHint(e, 4), /Mức gợi ý/);
});

test('Rook Pass: gợi ý miễn phí ở mọi mức', () => {
  const e = createEconomy();
  e.coins = 0;
  assert.equal(hintCost(3, true), 0);
  assert.equal(canAffordHint(e, 3, true), true);
  assert.deepEqual(spendForHint(e, 3, true), { ok: true, cost: 0, coins: 0 });
});

test('rewarded: chỉ khi sai ≥ 2 lần ở bài đang chơi, 1 lượt/ngày, không cho người có Pass', () => {
  const e = createEconomy();
  const day = '20261205';
  assert.equal(HINT_ADS_PER_DAY, 1);
  assert.equal(canWatchHintAd(e, day, { wrongMoves: 0 }), false);
  assert.equal(canWatchHintAd(e, day, { wrongMoves: 1 }), false);
  assert.equal(canWatchHintAd(e, day, { wrongMoves: 2, hasPass: true }), false, 'người có Rook Pass không thấy rewarded');
  assert.equal(canWatchHintAd(e, day, { wrongMoves: 2 }), true);
  assert.deepEqual(useHintAd(e, day), { ok: true });
  assert.equal(canWatchHintAd(e, day, { wrongMoves: 5 }), false, 'hết lượt hôm nay');
  assert.deepEqual(useHintAd(e, day), { ok: false });
  assert.equal(canWatchHintAd(e, '20261206', { wrongMoves: 2 }), true, 'sang ngày mới có lại 1 lượt');
});

test('rewarded không cộng coin (kế hoạch: không thưởng xu bằng quảng cáo)', () => {
  const e = createEconomy();
  useHintAd(e, '20261205');
  assert.equal(e.coins, START_COINS);
});
