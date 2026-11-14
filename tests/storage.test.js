// Test cho src/storage.js: lưu/đọc save data, chịu được mọi lỗi của localStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSave, writeSave, resetSave, createSave, SAVE_KEY, SAVE_VERSION } from '../src/storage.js';
import { markSolved } from '../src/progress.js';

/** localStorage giả bằng Map, đủ 3 hàm getItem / setItem / removeItem. */
function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/** localStorage "bị chặn": mọi thao tác đều ném lỗi, như trình duyệt chặn dữ liệu trang. */
const brokenStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

test('chưa có save thì tạo save mới', () => {
  const { save, status } = loadSave(fakeStorage());
  assert.equal(status, 'new');
  assert.deepEqual(save, createSave());
  assert.equal(save.economy.coins, 100);
  assert.equal(save.progress.unlockedLevel, 1);
});

test('ghi rồi đọc lại đúng dữ liệu', () => {
  const storage = fakeStorage();
  const save = createSave();
  save.economy.coins = 135;
  markSolved(save.progress, 1, { hintUsed: true });
  save.settings.music = false;
  assert.equal(writeSave(save, storage), true);
  assert.equal(JSON.parse(storage.map.get(SAVE_KEY)).version, SAVE_VERSION);
  const { save: loaded, status } = loadSave(storage);
  assert.equal(status, 'loaded');
  assert.deepEqual(loaded, save);
});

test('JSON hỏng hoặc phiên bản lạ: không lỗi, dùng save mới', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, '{không phải json');
  assert.equal(loadSave(storage).status, 'corrupt');
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, economy: { coins: 1 } }));
  const r = loadSave(storage);
  assert.equal(r.status, 'corrupt');
  assert.equal(r.save.economy.coins, 100);
  storage.setItem(SAVE_KEY, '42');
  assert.equal(loadSave(storage).status, 'corrupt');
});

test('save cũ thiếu trường thì bổ sung mặc định; trường sai kiểu thì bỏ', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    progress: { unlockedLevel: 7, solved: { 3: { hintUsed: false } } },
    economy: { coins: 'nhiều lắm' },
  }));
  const { save, status } = loadSave(storage);
  assert.equal(status, 'loaded');
  assert.equal(save.progress.unlockedLevel, 7);
  assert.deepEqual(save.progress.solved, { 3: { hintUsed: false } });
  assert.deepEqual(save.progress.daily, createSave().progress.daily);
  assert.equal(save.economy.coins, 100, 'coins sai kiểu thì lấy mặc định');
  assert.deepEqual(save.settings, createSave().settings);
});

test('localStorage bị chặn hoặc không tồn tại: không bao giờ ném lỗi', () => {
  assert.equal(loadSave(brokenStorage).status, 'unavailable');
  assert.equal(writeSave(createSave(), brokenStorage), false);
  assert.deepEqual(resetSave(brokenStorage), createSave());
  // Trong Node không có localStorage: dùng mặc định cũng không lỗi.
  assert.equal(loadSave(null).status, 'unavailable');
  assert.equal(writeSave(createSave(), null), false);
  assert.doesNotThrow(() => loadSave());
  assert.doesNotThrow(() => writeSave(createSave()));
});

test('resetSave xoá dữ liệu cũ', () => {
  const storage = fakeStorage();
  const save = createSave();
  save.economy.coins = 999;
  writeSave(save, storage);
  assert.deepEqual(resetSave(storage), createSave());
  assert.equal(loadSave(storage).status, 'new');
});

test('save v1 (bản cũ có quảng cáo) được chuyển lên v2, giữ nguyên tiến trình', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({
    version: 1,
    progress: { unlockedLevel: 12, solved: { 1: { hintUsed: false } }, daily: { lastDate: '20261113', streak: 2, bestStreak: 2, solvedDates: ['20261112', '20261113'] } },
    economy: { coins: 345, adsDate: '20261113', adsWatched: 3, noAds: true, levelsSinceAd: 2 },
    settings: { sound: false, music: true, vibration: true, showLegalMoves: true },
  }));
  const { save, status } = loadSave(storage);
  assert.equal(status, 'loaded');
  assert.equal(save.version, SAVE_VERSION);
  assert.equal(save.progress.unlockedLevel, 12);
  assert.equal(save.progress.daily.streak, 2);
  assert.equal(save.economy.coins, 345);
  for (const old of ['adsDate', 'adsWatched', 'noAds', 'levelsSinceAd']) assert.equal(old in save.economy, false, old);
  assert.equal(save.settings.sound, false);
  assert.deepEqual(save.store, createSave().store);
  assert.deepEqual(save.modes, createSave().modes);
  assert.deepEqual(save.trophies, createSave().trophies);
});
