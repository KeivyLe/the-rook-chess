// =============================================================================
// Test đa ngôn ngữ (src/ui/i18n.js + src/ui/i18n/*.js).
// Mục tiêu: 15 ngôn ngữ đều ĐỦ khoá như tiếng Anh, chỗ điền {tên} giống nhau,
// chuỗi số nhiều có dạng 'other', và mọi khoá giao diện gọi tới đều có thật.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DICTIONARIES, LANGUAGES, DEFAULT_LANGUAGE, createTranslator, normalizeLanguage, formatDayMonth,
} from '../src/ui/i18n.js';
import { TROPHIES } from '../src/trophies.js';
import { createSettings } from '../src/storage.js';

const en = DICTIONARIES.en;

/** Lấy tập tên chỗ điền {tên} của một giá trị (chuỗi hoặc đối tượng số nhiều). */
function placeholders(value) {
  const text = typeof value === 'object' ? Object.values(value).join(' ') : value;
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
}

test('đủ 15 ngôn ngữ theo yêu cầu, mặc định là tiếng Anh', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code),
    ['en', 'de', 'fr', 'ja', 'es', 'pt', 'ko', 'ru', 'id', 'hi', 'it', 'tr', 'zh', 'pl', 'vi']);
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(createSettings().language, 'en');
  assert.equal(normalizeLanguage('xx'), 'en');
  assert.equal(normalizeLanguage('vi'), 'vi');
});

test('mọi ngôn ngữ có đúng bộ khoá của tiếng Anh và cùng chỗ điền {tên}', () => {
  const keys = Object.keys(en).sort();
  for (const { code } of LANGUAGES) {
    const dict = DICTIONARIES[code];
    assert.deepEqual(Object.keys(dict).sort(), keys, `ngôn ngữ ${code} thiếu hoặc thừa khoá`);
    for (const key of keys) {
      const v = dict[key];
      assert.ok(typeof v === 'string' ? v.trim() !== '' : typeof v.other === 'string', `${code}.${key} rỗng hoặc thiếu dạng 'other'`);
      // Chuỗi số nhiều: chỉ yêu cầu có đủ chỗ điền của tiếng Anh ở dạng 'other'
      // (tiếng Nga, Ba Lan có thể bỏ {n} ở dạng 'one').
      const want = placeholders(en[key]);
      const got = placeholders(v);
      assert.deepEqual(got, want, `${code}.${key}: chỗ điền ${got} khác tiếng Anh ${want}`);
    }
  }
});

test('mọi khoá viết thẳng trong giao diện đều có trong tiếng Anh', () => {
  const sources = ['src/ui/app.js', 'src/ui/board-view.js'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const used = [...sources.matchAll(/\bt\(\s*'([\w.:-]+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 50, 'phải tìm thấy nhiều lời gọi t()');
  for (const key of used) assert.ok(key in en, `thiếu khoá "${key}"`);
});

test('các khoá ghép động (trophy, quân, skin, kết thúc ván) đều có', () => {
  const dynamic = [
    ...TROPHIES.flatMap((x) => [`trophy.${x.id}.name`, `trophy.${x.id}.desc`]),
    ...'kqrbnp'.split('').map((p) => `piece.${p}`),
    ...['bronze', 'silver', 'gold', 'platinum'].map((x) => `tier.${x}`),
    ...['outOfMoves', 'stalemate', 'lost'].flatMap((x) => [`end.${x}.title`, `end.${x}.toast`]),
    ...['solved', 'open', 'locked'].flatMap((x) => [`aria.level.${x}`, `aria.obstacle.${x}`]),
    ...[1, 2, 3, 4].map((n) => `chapter.${n}`),
    ...['classic', 'marble', 'neon'].map((x) => `skin.board.${x}`),
    ...['ivory', 'marble', 'neon', 'royal'].map((x) => `skin.pieces.${x}`),
  ];
  for (const key of dynamic) assert.ok(key in en, `thiếu khoá "${key}"`);
});

test('t(): điền chỗ trống, chọn dạng số nhiều, thiếu khoá thì trả lại khoá', () => {
  const t = createTranslator('en');
  assert.equal(t('mateIn', { n: 2 }), 'Mate in 2');
  assert.equal(t('pass.active', { n: 1 }), 'Active · 1 day left');
  assert.equal(t('pass.active', { n: 5 }), 'Active · 5 days left');
  assert.equal(t('khong.co'), 'khong.co');

  const ru = createTranslator('ru');
  assert.equal(ru('mateIn', { n: 1 }), 'Мат в 1 ход');
  assert.equal(ru('mateIn', { n: 3 }), 'Мат в 3 хода');
  assert.equal(ru('mateIn', { n: 5 }), 'Мат в 5 ходов');

  assert.equal(createTranslator('vi')('mateIn', { n: 2 }), 'Chiếu hết trong 2');
  assert.equal(createTranslator('ja')('mateIn', { n: 2 }), '2手詰め');
});

test('ngày Daily viết theo ngôn ngữ, không lệch múi giờ', () => {
  assert.equal(formatDayMonth('en', '20261114'), 'November 14');
  assert.match(formatDayMonth('vi', '20261114'), /14/);
  assert.match(formatDayMonth('ja', '20261114'), /11月14日/);
});
