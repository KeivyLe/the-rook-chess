#!/usr/bin/env node
// =============================================================================
// tools/verify-levels.js — Kiểm tra lại TOÀN BỘ levels.json bằng bộ giải.
//
// Cách chạy:  node tools/verify-levels.js [đường dẫn levels.json]
// In ra từng lỗi (nếu có) và thoát với mã 1 khi có lỗi, để dùng được trong test/CI.
//
// Mỗi level phải:
//   - có FEN đọc được, đúng width/height, attacker khớp lượt đi trong FEN;
//   - đạt chuẩn puzzle (tools/level-check.js): thế hợp lệ, chiếu hết ĐÚNG
//     mateIn nước, nước đầu duy nhất;
//   - có solution đi được hết, dài 2·mateIn − 1 ply, kết thúc bằng chiếu hết,
//     nước đầu trùng với nước đầu duy nhất mà bộ giải tìm ra.
// Cả bộ phải:
//   - đúng 60 level chính (15/20/15/10 cho mate in 1/2/3/4) và 30 level Daily;
//   - id không trùng, level chính đánh số 1..60 liên tục;
//   - level chính không giảm số nước (chương sau khó hơn chương trước);
//   - không có hai level trùng nhau (kể cả đối xứng gương trái–phải);
//   - không trùng thế cờ nào đã biết của game gốc (không chép level).
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseFen, make, toFen } from '../src/board.js';
import { findMove, isCheckmate } from '../src/movegen.js';
import { analyzePuzzle } from './level-check.js';

/** Số level chính cần có cho mỗi số nước. */
export const MAIN_COUNTS = { 1: 15, 2: 20, 3: 15, 4: 10 };
/** Số level Daily cần có. */
export const DAILY_COUNT = 30;

/**
 * Các thế cờ đã biết của game gốc (chép từ ảnh chụp màn hình, xem
 * tests/solver.test.js). Chỉ dùng để KIỂM TRA rằng levels.json không chứa chúng.
 */
export const ORIGINAL_POSITIONS = [
  '2k/1pp/3/R2 w',
  '2k1/4/x1P1/xx1R/xxxB w',
  '5/q2n1/2PN1/3PP/1R2K b',
];

/**
 * Lật gương trái–phải phần các hàng của FEN (cột a đổi chỗ với cột cuối).
 * Hai thế cờ đối xứng gương là cùng một puzzle, chỉ nhìn ngược lại.
 */
function mirrorRows(rows) {
  const board = parseFen(rows + ' w');
  const w = board.width;
  const squares = board.squares.map((_, sq) => board.squares[Math.floor(sq / w) * w + (w - 1 - (sq % w))]);
  board.squares = squares;
  return toFen(board).split(' ')[0];
}

/**
 * "Chuẩn hoá" một FEN để so trùng: giữ phần các hàng và lượt đi, chọn bản nhỏ
 * hơn (theo thứ tự chữ cái) giữa bản gốc và bản lật gương. Hai level có cùng
 * FEN chuẩn hoá là trùng nhau.
 */
export function canonicalFen(fen) {
  const [rows, turn = 'w'] = fen.trim().split(/\s+/);
  const normal = toFen(parseFen(rows + ' w')).split(' ')[0];
  const mirrored = mirrorRows(rows);
  return (normal < mirrored ? normal : mirrored) + ' ' + turn;
}

/**
 * Kiểm tra một level. Trả về mảng chuỗi lỗi (rỗng nếu đạt).
 */
export function verifyLevel(level) {
  const errors = [];
  const name = `level ${level.id}`;
  let board;
  try {
    board = parseFen(level.fen, { width: level.width, height: level.height });
  } catch (e) {
    return [`${name}: ${e.message}`];
  }
  if (level.attacker !== board.turn) errors.push(`${name}: attacker "${level.attacker}" khác lượt đi trong FEN`);
  if (![1, 2, 3, 4].includes(level.mateIn)) return [...errors, `${name}: mateIn ${level.mateIn} không hợp lệ`];

  const a = analyzePuzzle(board, level.mateIn);
  if (!a.ok) return [...errors, `${name}: ${a.reason}`];

  const sol = level.solution;
  if (!Array.isArray(sol) || sol.length !== 2 * level.mateIn - 1) {
    errors.push(`${name}: solution phải dài ${2 * level.mateIn - 1} ply`);
    return errors;
  }
  if (sol[0] !== a.solution[0]) errors.push(`${name}: nước đầu ${sol[0]} khác nước duy nhất ${a.solution[0]}`);
  for (const text of sol) {
    const m = findMove(board, text);
    if (!m) { errors.push(`${name}: nước ${text} trong solution không hợp lệ`); return errors; }
    make(board, m);
  }
  if (!isCheckmate(board)) errors.push(`${name}: đi hết solution mà chưa chiếu hết`);
  return errors;
}

/**
 * Kiểm tra toàn bộ dữ liệu levels.json (đối tượng đã JSON.parse).
 * Trả về mảng lỗi; rỗng nghĩa là mọi thứ đạt.
 * options.deep = false: bỏ qua bước chạy bộ giải cho từng level (bước chậm
 * nhất, khoảng 8 giây), chỉ kiểm tra số lượng, thứ tự, trùng lặp. Test dùng
 * chế độ này khi chỉ muốn xem các lỗi cấu trúc có bị bắt không.
 */
export function verifyLevels(data, options = {}) {
  const deep = options.deep ?? true;
  const errors = [];
  const levels = data.levels ?? [];
  const daily = data.daily ?? [];

  // Số lượng.
  for (const [n, count] of Object.entries(MAIN_COUNTS)) {
    const have = levels.filter((l) => l.mateIn === Number(n)).length;
    if (have !== count) errors.push(`cần ${count} level chính mate in ${n}, đang có ${have}`);
  }
  if (daily.length !== DAILY_COUNT) errors.push(`cần ${DAILY_COUNT} level Daily, đang có ${daily.length}`);

  // Đánh số và thứ tự độ khó của chuỗi chính.
  levels.forEach((l, i) => {
    if (l.id !== i + 1) errors.push(`level thứ ${i + 1} có id ${l.id}, phải là ${i + 1}`);
    if (i > 0 && l.mateIn < levels[i - 1].mateIn) errors.push(`level ${l.id}: mate in ${l.mateIn} đứng sau mate in ${levels[i - 1].mateIn}`);
  });

  // Trùng id, trùng thế cờ, trùng game gốc.
  const ids = new Set();
  const seen = new Map();
  const originals = new Set(ORIGINAL_POSITIONS.map(canonicalFen));
  for (const l of [...levels, ...daily]) {
    if (ids.has(l.id)) errors.push(`id ${l.id} bị trùng`);
    ids.add(l.id);
    let key;
    try { key = canonicalFen(l.fen); } catch { continue; } // lỗi FEN sẽ được verifyLevel báo
    if (seen.has(key)) errors.push(`level ${l.id} trùng thế cờ với level ${seen.get(key)}`);
    seen.set(key, l.id);
    if (originals.has(key)) errors.push(`level ${l.id} trùng thế cờ của game gốc`);
  }

  // Kiểm tra từng level bằng bộ giải.
  if (deep) for (const l of [...levels, ...daily]) errors.push(...verifyLevel(l));
  return errors;
}

// Chạy trực tiếp bằng dòng lệnh.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'levels.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const started = Date.now();
  const errors = verifyLevels(data);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (errors.length === 0) {
    console.log(`OK: ${data.levels.length} level chính + ${data.daily.length} level Daily đều đạt (${secs}s)`);
  } else {
    for (const e of errors) console.log('LỖI: ' + e);
    console.log(`${errors.length} lỗi (${secs}s)`);
    process.exit(1);
  }
}
