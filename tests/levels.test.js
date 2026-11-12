// Test cho bộ level: chạy tools/verify-levels.js trên levels.json, và kiểm tra
// rằng bộ kiểm tra thật sự bắt được các loại lỗi (level hỏng phải bị báo).
// Chạy: npm test  (hoặc: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { analyzePuzzle, positionProblem } from '../tools/level-check.js';
import { verifyLevels, verifyLevel, canonicalFen, ORIGINAL_POSITIONS, MAIN_COUNTS, DAILY_COUNT } from '../tools/verify-levels.js';
import { createRng } from '../tools/generate-levels.js';
import { parseFen } from '../src/board.js';

const data = JSON.parse(readFileSync(new URL('../levels.json', import.meta.url), 'utf8'));
// Bản sao sâu để test sửa thoải mái mà không ảnh hưởng dữ liệu gốc.
const copy = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------------
// Toàn bộ levels.json
// ---------------------------------------------------------------------------

test('levels.json: verify-levels không báo lỗi nào', () => {
  assert.deepEqual(verifyLevels(data), []);
});

test('levels.json: đúng số lượng và cấu trúc chương', () => {
  assert.equal(data.levels.length, 60);
  assert.equal(data.daily.length, DAILY_COUNT);
  for (const [n, count] of Object.entries(MAIN_COUNTS)) {
    assert.equal(data.levels.filter((l) => l.mateIn === Number(n)).length, count);
  }
  // Chương k chỉ chứa mate in k, và các chương nối tiếp nhau.
  for (const l of data.levels) assert.equal(l.chapter, l.mateIn);
  // Bàn nhỏ: 3×4 đến 6×6.
  for (const l of [...data.levels, ...data.daily]) {
    assert.ok(l.width >= 3 && l.width <= 6 && l.height >= 4 && l.height <= 6, `${l.id}: ${l.width}×${l.height}`);
  }
  // Có ít nhất vài bàn có lỗ và vài level Đen tấn công, cho đa dạng.
  assert.ok([...data.levels, ...data.daily].some((l) => l.fen.includes('x')));
  assert.ok([...data.levels, ...data.daily].some((l) => l.attacker === 'b'));
});

test('levels.json: 5 level đầu giới thiệu từng quân, Trắng đi', () => {
  const intro = data.levels.slice(0, 5);
  // Quân trắng trừ Vua (chữ hoa trong phần các hàng của FEN, bỏ chữ K).
  const types = intro.map((l) => l.fen.split(' ')[0].replace(/[^A-Z]/g, '').replace('K', ''));
  assert.deepEqual(types, ['R', 'Q', 'N', 'B', 'P']);
  for (const l of intro) assert.equal(l.attacker, 'w');
  assert.match(intro[4].solution[0], /[qrbn]$/, 'level Tốt phải giải bằng phong cấp');
});

// ---------------------------------------------------------------------------
// Bộ kiểm tra phải bắt được level hỏng
// ---------------------------------------------------------------------------

test('verifyLevel bắt lỗi: solution sai, mateIn sai, FEN sai kích thước', () => {
  const good = data.levels.find((l) => l.mateIn === 2);
  assert.deepEqual(verifyLevel(good), []);

  const wrongMove = copy(good);
  wrongMove.solution[2] = wrongMove.solution[0]; // nước thứ 3 không hợp lệ ở thế đó
  assert.ok(verifyLevel(wrongMove).length > 0);

  const tooShort = copy(good);
  tooShort.solution = tooShort.solution.slice(0, 1);
  assert.match(verifyLevel(tooShort).join(), /dài 3 ply/);

  const earlier = copy(data.levels[0]); // level mate in 1 mà ghi là mate in 2
  earlier.mateIn = 2;
  assert.match(verifyLevel(earlier).join(), /sớm hơn/);

  const badSize = copy(good);
  badSize.width += 1;
  assert.match(verifyLevel(badSize).join(), /width/);

  const badAttacker = copy(good);
  badAttacker.attacker = good.attacker === 'w' ? 'b' : 'w';
  assert.match(verifyLevel(badAttacker).join(), /attacker/);
});

test('verifyLevels bắt lỗi: trùng level (kể cả gương), sai thứ tự, sai số lượng, chép game gốc', () => {
  const dup = copy(data);
  dup.daily[0] = { ...copy(data.levels[20]), id: 'daily-01' };
  assert.match(verifyLevels(dup, { deep: false }).join('\n'), /trùng thế cờ với level 21/);

  const order = copy(data);
  [order.levels[14], order.levels[15]] = [order.levels[15], order.levels[14]];
  order.levels[14].id = 15;
  order.levels[15].id = 16;
  assert.match(verifyLevels(order, { deep: false }).join('\n'), /đứng sau/);

  const missing = copy(data);
  missing.daily.pop();
  assert.match(verifyLevels(missing, { deep: false }).join('\n'), /cần 30 level Daily/);

  const stolen = copy(data);
  stolen.daily[0] = { id: 'daily-01', width: 3, height: 4, fen: ORIGINAL_POSITIONS[0], mateIn: 1, attacker: 'w', solution: ['a1a4'] };
  assert.match(verifyLevels(stolen, { deep: false }).join('\n'), /game gốc/);
});

test('analyzePuzzle: loại thế cờ có nhiều nước đầu đúng hoặc không hợp lệ', () => {
  // Cả Rd1-a1 và Rb2-a2 đều chiếu hết: nước đầu không duy nhất.
  assert.match(analyzePuzzle('k3/2K1/1R2/3R w', 1).reason, /không duy nhất/);
  // Level mẫu GDD: đạt chuẩn.
  assert.deepEqual(analyzePuzzle('k3/2K1/4/3R w', 1).solution, ['d1a1']);
  // Trắng đến lượt mà Vua đen đã đang bị Xe a1 chiếu: thế cờ không thể xảy ra.
  assert.match(positionProblem(parseFen('k3/4/4/R2K w')), /bên phòng thủ đang bị chiếu/);
  // Trắng đến lượt và Vua trắng đang bị Xe đen chiếu: puzzle không tự nhiên.
  assert.match(positionProblem(parseFen('k3/4/4/r2K w')), /bên tấn công đang bị chiếu/);
  assert.match(positionProblem(parseFen('k3/4/4/3R w')), /thiếu Vua trắng/);
  assert.match(positionProblem(parseFen('k2P/4/2K1/4 w')), /Tốt/);
});

test('canonicalFen: thế cờ đối xứng gương là cùng một level', () => {
  assert.equal(canonicalFen('k3/2K1/4/3R w'), canonicalFen('3k/1K2/4/R3 w'));
  assert.notEqual(canonicalFen('k3/2K1/4/3R w'), canonicalFen('k3/2K1/4/3R b'));
  assert.equal(canonicalFen('x1k2/5 w'), canonicalFen('2k1x/5 w'));
});

test('createRng: cùng seed cho cùng dãy số, khác seed cho dãy khác', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  for (const x of seqA) assert.ok(x >= 0 && x < 1);
});
