// Test cho src/store.js: Rook Pass, Starter Bundle, skin, mode (đều là giả lập).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createStore, ensureInstallDate, hasPass, passDaysLeft, startPassTrial, subscribePass, owns,
  starterAvailable, starterDaysLeft, buy, equip, activeSkins, canPlayModeLevel, FREE_MODE_LEVELS,
} from '../src/store.js';

const INSTALL = '20261205';

function freshStore() {
  const s = createStore();
  ensureInstallDate(s, INSTALL);
  return s;
}

test('người chơi mới: chỉ có skin mặc định, chưa có Pass, chưa có mode', () => {
  const s = freshStore();
  assert.equal(s.installDate, INSTALL);
  ensureInstallDate(s, '20261231');
  assert.equal(s.installDate, INSTALL, 'ngày cài chỉ ghi lần đầu');
  assert.equal(owns(s, 'board:classic', INSTALL), true);
  assert.equal(owns(s, 'pieces:ivory', INSTALL), true);
  assert.equal(owns(s, 'board:marble', INSTALL), false);
  assert.equal(owns(s, 'mode:blitz', INSTALL), false);
  assert.equal(hasPass(s, INSTALL), false);
  assert.deepEqual(activeSkins(s, INSTALL), { board: 'classic', pieces: 'ivory' });
});

test('Rook Pass dùng thử 7 ngày, chỉ một lần; mở mọi mode và skin độc quyền', () => {
  const s = freshStore();
  assert.deepEqual(startPassTrial(s, INSTALL), { ok: true, until: '20261211' });
  assert.equal(passDaysLeft(s, INSTALL), 7);
  assert.equal(hasPass(s, '20261211'), true);
  assert.equal(hasPass(s, '20261212'), false, 'hết 7 ngày thì hết Pass');
  assert.deepEqual(startPassTrial(s, '20261212'), { ok: false, reason: 'trial-used' });
  assert.equal(owns(s, 'mode:obstacle', '20261208'), true);
  assert.equal(owns(s, 'pieces:royal', '20261208'), true);
  assert.equal(owns(s, 'board:marble', '20261208'), false, 'Pass không mở skin bán lẻ');
  assert.equal(owns(s, 'mode:obstacle', '20261212'), false);
});

test('đăng ký Pass: mỗi kỳ 30 ngày, nối tiếp hạn còn lại', () => {
  const s = freshStore();
  subscribePass(s, INSTALL);
  assert.equal(s.pass.until, '20270103');
  subscribePass(s, '20261220'); // còn hạn → cộng tiếp từ ngày hết hạn
  assert.equal(s.pass.until, '20270202');
  assert.equal(s.pass.trialUsed, true);
});

test('skin độc quyền của Pass: hết Pass thì quay về skin mặc định', () => {
  const s = freshStore();
  startPassTrial(s, INSTALL);
  assert.equal(equip(s, 'pieces', 'royal', INSTALL), true);
  assert.deepEqual(activeSkins(s, INSTALL), { board: 'classic', pieces: 'royal' });
  assert.deepEqual(activeSkins(s, '20261220'), { board: 'classic', pieces: 'ivory' });
});

test('Starter Bundle: chỉ bán 7 ngày đầu sau khi cài, mua một lần', () => {
  const s = freshStore();
  assert.equal(starterAvailable(s, INSTALL), true);
  assert.equal(starterDaysLeft(s, '20261211'), 1);
  assert.equal(starterAvailable(s, '20261212'), false, 'ngày thứ 8 thì hết');
  assert.deepEqual(buy(s, 'starter-bundle', '20261212'), { ok: false, reason: 'expired' });
  const r = buy(s, 'starter-bundle', '20261207');
  assert.equal(r.ok, true);
  assert.deepEqual(r.granted, ['mode:obstacle', 'board:marble', 'pieces:marble']);
  assert.equal(starterAvailable(s, '20261207'), false, 'đã mua thì không bán nữa');
  assert.equal(owns(s, 'mode:obstacle', '20270101'), true, 'mua rồi thì giữ mãi');
});

test('mua skin lẻ và bộ skin; trang bị chỉ khi đã có', () => {
  const s = freshStore();
  assert.equal(equip(s, 'board', 'neon', INSTALL), false);
  assert.deepEqual(buy(s, 'board:neon', INSTALL), { ok: true, granted: ['board:neon'] });
  assert.deepEqual(buy(s, 'board:neon', INSTALL), { ok: false, reason: 'owned' });
  assert.deepEqual(buy(s, 'set:neon', INSTALL), { ok: true, granted: ['pieces:neon'] }, 'bộ chỉ thêm món còn thiếu');
  assert.equal(equip(s, 'board', 'neon', INSTALL), true);
  assert.equal(equip(s, 'pieces', 'neon', INSTALL), true);
  assert.equal(equip(s, 'pieces', 'khong-co', INSTALL), false);
  assert.deepEqual(activeSkins(s, INSTALL), { board: 'neon', pieces: 'neon' });
  assert.deepEqual(buy(s, 'khong-co', INSTALL), { ok: false, reason: 'unknown' });
  assert.deepEqual(buy(s, 'rook-pass', INSTALL), { ok: false, reason: 'unknown' }, 'Pass mua bằng subscribePass');
});

test('mode: 5 bài đầu chơi thử miễn phí, từ bài 6 phải có mode', () => {
  const s = freshStore();
  assert.equal(FREE_MODE_LEVELS, 5);
  assert.equal(canPlayModeLevel(s, 'obstacle', 4, INSTALL), true);
  assert.equal(canPlayModeLevel(s, 'obstacle', 5, INSTALL), false);
  buy(s, 'mode:obstacle', INSTALL);
  assert.equal(canPlayModeLevel(s, 'obstacle', 19, INSTALL), true);
  assert.equal(canPlayModeLevel(s, 'blitz', 5, INSTALL), false);
  startPassTrial(s, INSTALL);
  assert.equal(canPlayModeLevel(s, 'blitz', 30, INSTALL), true, 'Pass mở mọi mode');
});
