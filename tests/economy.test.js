// Test cho src/economy.js: coin, gợi ý, quảng cáo giả lập, cửa hàng giả lập.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEconomy, solveReward, addSolveReward, canAffordHint, spendForHint, adsRemaining,
  watchRewardedAd, onLevelWon, buyPack, START_COINS, HINT_COSTS, MAX_ADS_PER_DAY,
} from '../src/economy.js';

test('người chơi mới có 100 coin, chưa mua Remove Ads', () => {
  const e = createEconomy();
  assert.equal(e.coins, START_COINS);
  assert.equal(START_COINS, 100);
  assert.equal(e.noAds, false);
});

test('thưởng giải level theo bảng GDD 6.2', () => {
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
  assert.deepEqual(spendForHint(e, 1), { ok: true, cost: 20, coins: 40 });
  assert.throws(() => spendForHint(e, 4), /Mức gợi ý/);
});

test('quảng cáo thưởng: +25 coin, tối đa 5 lần mỗi ngày, sang ngày mới thì đếm lại', () => {
  const e = createEconomy();
  assert.equal(adsRemaining(e, '20261112'), MAX_ADS_PER_DAY);
  for (let i = 0; i < MAX_ADS_PER_DAY; i++) assert.equal(watchRewardedAd(e, '20261112').ok, true);
  assert.equal(e.coins, 100 + 5 * 25);
  assert.deepEqual(watchRewardedAd(e, '20261112'), { ok: false, gained: 0, remaining: 0 });
  assert.equal(e.coins, 225);
  assert.equal(adsRemaining(e, '20261113'), 5);
  assert.deepEqual(watchRewardedAd(e, '20261113'), { ok: true, gained: 25, remaining: 4 });
});

test('quảng cáo xen giữa: không hiện ở 10 level đầu, sau đó cứ 3 level một lần', () => {
  const e = createEconomy();
  const shown = [];
  for (let id = 1; id <= 22; id++) if (onLevelWon(e, id)) shown.push(id);
  assert.deepEqual(shown, [13, 16, 19, 22]);
});

test('Remove Ads tắt hẳn quảng cáo xen giữa; gói coin cộng coin', () => {
  const e = createEconomy();
  assert.deepEqual(buyPack(e, 'medium'), { ok: true, coins: 600, noAds: false });
  buyPack(e, 'removeAds');
  for (let id = 1; id <= 40; id++) assert.equal(onLevelWon(e, id), false);
  assert.throws(() => buyPack(e, 'mega'), /Không có gói/);
});
