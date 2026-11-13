#!/usr/bin/env node
// =============================================================================
// tools/generate-levels.js — Sinh bộ level bằng cách tạo thế cờ NGẪU NHIÊN rồi
// để bộ giải lọc (không chép level từ game gốc).
//
// Cách chạy:
//   node tools/generate-levels.js                 # seed mặc định, ghi levels.json
//   node tools/generate-levels.js --seed 7 --out thu.json
// Cùng một seed luôn ra cùng một bộ level (bộ sinh số ngẫu nhiên có seed), nên
// levels.json có thể sinh lại y hệt khi cần.
//
// Quy trình:
//   1. Tạo thế cờ ngẫu nhiên: bàn 3×4 đến 6×6, đôi khi có lỗ ở mép bàn, 2 Vua
//      và vài quân mỗi bên. Bên tấn công (đi trước) thường là Trắng, đôi khi Đen.
//   2. Lọc bằng analyzePuzzle (tools/level-check.js): hợp lệ, chiếu hết ĐÚNG N
//      nước, nước đầu duy nhất.
//   3. Rút gọn: thử bỏ từng quân (trừ Vua); nếu bỏ đi mà puzzle vẫn đạt chuẩn
//      thì quân đó thừa, bỏ luôn. Puzzle chỉ còn quân quan trọng (GDD mục 3.1).
//   4. Gom nhiều ứng viên cho mỗi N, chấm điểm khó, rồi chọn level cho từng
//      chương theo độ khó tăng dần, xếp kiểu răng cưa (GDD mục 5.2).
//   5. Phần ứng viên còn lại dùng cho Daily Puzzle.
// =============================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createBoard, toFen, typeOf, colorOf, EMPTY, HOLE } from '../src/board.js';
import { analyzePuzzle } from './level-check.js';
import { canonicalFen } from './verify-levels.js';

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------

/**
 * Cấu hình thế cờ ngẫu nhiên cho từng loại puzzle.
 *   widths, heights: các kích thước bàn có thể chọn.
 *   attacker/defender: [ít nhất, nhiều nhất] số quân (không tính Vua).
 *   attackerPool/defenderPool: chuỗi quân để bốc ngẫu nhiên; chữ nào lặp nhiều
 *   thì dễ được chọn hơn.
 */
const SPECS = {
  1: { widths: [3, 4, 5], heights: [4, 5], attacker: [1, 2], defender: [0, 2], attackerPool: 'qrrbnnp', defenderPool: 'pppnbr' },
  2: { widths: [4, 5], heights: [4, 5, 6], attacker: [1, 3], defender: [1, 3], attackerPool: 'qrrbbnnpp', defenderPool: 'pppnbr' },
  3: { widths: [4, 5, 6], heights: [5, 6], attacker: [2, 3], defender: [1, 3], attackerPool: 'qrrbbnnpp', defenderPool: 'pppnbr' },
  4: { widths: [4, 5, 6], heights: [5, 6], attacker: [2, 4], defender: [1, 4], attackerPool: 'qrrbbnnpp', defenderPool: 'pppnbrr' },
};
const HOLE_CHANCE = 0.25;  // xác suất bàn có lỗ
const BLACK_CHANCE = 0.25; // xác suất bên tấn công là Đen

/** Các chương của chuỗi level chính (60 level). */
const CHAPTERS = [
  { chapter: 1, name: 'Làm quen', mateIn: 1, count: 15 },
  { chapter: 2, name: 'Phối hợp', mateIn: 2, count: 20 },
  { chapter: 3, name: 'Tính toán', mateIn: 3, count: 15 },
  { chapter: 4, name: 'Cao thủ', mateIn: 4, count: 10 },
];
/** Số level Daily theo từng N (tổng 30). */
const DAILY = { 1: 8, 2: 14, 3: 8 };
/** Số ứng viên cần gom cho mỗi N trước khi chọn (nhiều hơn số cần để có lựa chọn). */
const POOL_SIZE = { 1: 80, 2: 100, 3: 50, 4: 22 };
/**
 * 5 level đầu chương 1 giới thiệu từng quân (GDD mục 5.2): bên tấn công chỉ có
 * Vua và đúng 1 quân loại này. Level Tốt yêu cầu nước giải là phong cấp.
 */
const INTRO_PIECES = ['r', 'q', 'n', 'b', 'p'];

// ---------------------------------------------------------------------------
// Số ngẫu nhiên có seed
// ---------------------------------------------------------------------------

/**
 * Bộ sinh số ngẫu nhiên mulberry32: trả về hàm, mỗi lần gọi cho một số trong
 * [0, 1). Khác Math.random ở chỗ có seed: cùng seed thì cùng dãy số.
 */
export function createRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Trộn ngẫu nhiên một mảng (thuật toán Fisher–Yates), trả về mảng mới. */
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Tạo thế cờ ngẫu nhiên
// ---------------------------------------------------------------------------

/**
 * Đục lỗ ở mép bàn: chọn 1 đến vài ô ở viền (ưu tiên góc) và biến thành lỗ.
 * Chỉ đục ở viền để bàn vẫn liền một khối, nhìn giống hình dạng lạ chứ không
 * bị thủng giữa.
 */
function punchHoles(rng, board) {
  const { width: w, height: h } = board;
  const border = [];
  for (let r = 0; r < h; r++) {
    for (let f = 0; f < w; f++) {
      if (r === 0 || r === h - 1 || f === 0 || f === w - 1) border.push(r * w + f);
    }
  }
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const count = randInt(rng, 1, Math.max(1, Math.floor((w * h) / 10)));
  for (let i = 0; i < count; i++) {
    const sq = rng() < 0.5 ? pick(rng, corners) : pick(rng, border);
    board.squares[sq] = HOLE;
  }
}

/**
 * Tạo một thế cờ ngẫu nhiên theo cấu hình `spec`. Bên tấn công đi trước.
 * `onlyPiece` (không bắt buộc): bên tấn công chỉ có đúng 1 quân loại này,
 * và luôn là Trắng (level giới thiệu quân cho người mới, không bắt cầm Đen ngay).
 * Quân được đặt vào ô trống ngẫu nhiên; Tốt không đặt ở hàng đầu/cuối.
 */
function randomPosition(rng, spec, onlyPiece) {
  const board = createBoard(pick(rng, spec.widths), pick(rng, spec.heights));
  if (rng() < HOLE_CHANCE) punchHoles(rng, board);

  const attacker = !onlyPiece && rng() < BLACK_CHANCE ? 'b' : 'w';
  const own = (p) => (attacker === 'w' ? p.toUpperCase() : p.toLowerCase());
  const enemy = (p) => (attacker === 'w' ? p.toLowerCase() : p.toUpperCase());

  // Tìm một ô trống ngẫu nhiên phù hợp cho quân `type`.
  const place = (piece) => {
    for (let tries = 0; tries < 40; tries++) {
      const sq = Math.floor(rng() * board.squares.length);
      if (board.squares[sq] !== EMPTY) continue;
      const rank = Math.floor(sq / board.width);
      if (typeOf(piece) === 'p' && (rank === 0 || rank === board.height - 1)) continue;
      board.squares[sq] = piece;
      return;
    }
  };

  place(own('k'));
  place(enemy('k'));
  if (onlyPiece) {
    place(own(onlyPiece));
  } else {
    let queens = 0;
    for (let i = randInt(rng, ...spec.attacker); i > 0; i--) {
      let p = pick(rng, spec.attackerPool);
      if (p === 'q' && queens++ > 0) p = 'r'; // tối đa 1 Hậu, tránh thế cờ quá "dư quân"
      place(own(p));
    }
  }
  const defenderCount = randInt(rng, ...spec.defender) + (onlyPiece ? 1 : 0);
  for (let i = defenderCount; i > 0; i--) place(enemy(pick(rng, spec.defenderPool)));

  board.turn = attacker;
  return board;
}

/** Ghi FEN dạng gọn như trong GDD: chỉ phần các hàng và lượt đi, ví dụ "k3/2K1/4/3R w". */
function shortFen(board) {
  const [rows, turn] = toFen(board).split(' ');
  return `${rows} ${turn}`;
}

/**
 * Rút gọn puzzle: lần lượt thử bỏ từng quân không phải Vua. Nếu bỏ mà vẫn là
 * puzzle đạt chuẩn mate in n thì bỏ hẳn quân đó. Lặp tới khi không bỏ thêm được.
 * Trả về { board, analysis } của thế cờ đã rút gọn.
 */
function minimize(board, n, analysis) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let sq = 0; sq < board.squares.length; sq++) {
      const p = board.squares[sq];
      if (!colorOf(p) || typeOf(p) === 'k') continue;
      board.squares[sq] = EMPTY;
      const a = analyzePuzzle(board, n);
      if (a.ok) { analysis = a; changed = true; } else { board.squares[sq] = p; }
    }
  }
  return { board, analysis };
}

/** Kiểm tra bên tấn công chỉ có Vua và đúng 1 quân `type` (dùng cho level giới thiệu quân). */
function attackerHasOnly(board, type) {
  const pieces = board.squares.filter((p) => colorOf(p) === board.turn && typeOf(p) !== 'k');
  return pieces.length === 1 && typeOf(pieces[0]) === type;
}

/**
 * Sinh ứng viên mate in n cho tới khi đủ `count` thế cờ khác nhau.
 * `seen` là tập FEN chuẩn hoá đã dùng (chung cho mọi N) để không trùng level,
 * kể cả trùng kiểu đối xứng gương trái–phải.
 * `accept` (không bắt buộc) là điều kiện thêm cho ứng viên.
 */
function collect(rng, n, count, seen, { onlyPiece, accept } = {}) {
  const result = [];
  let tries = 0;
  const started = Date.now();
  while (result.length < count) {
    tries++;
    const board = randomPosition(rng, SPECS[n], onlyPiece);
    const first = analyzePuzzle(board, n);
    if (!first.ok) continue;
    const { analysis } = minimize(board, n, first);
    if (onlyPiece && !attackerHasOnly(board, onlyPiece)) continue;
    if (accept && !accept(board, analysis)) continue;
    const key = canonicalFen(shortFen(board));
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ fen: shortFen(board), board, analysis, mateIn: n });
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  process.stderr.write(`  mate in ${n}${onlyPiece ? ` (giới thiệu ${onlyPiece.toUpperCase()})` : ''}: ${count} thế / ${tries} lần thử, ${secs}s\n`);
  return result;
}

// ---------------------------------------------------------------------------
// Chọn và sắp xếp level
// ---------------------------------------------------------------------------

/**
 * Chọn `count` phần tử trải đều trên danh sách đã sắp xếp theo độ khó, để
 * chương có cả level dễ lẫn khó thay vì toàn level cùng một mức.
 * Trả về { chosen, rest }.
 */
function spreadPick(sorted, count) {
  const idx = new Set();
  for (let i = 0; i < count; i++) idx.add(Math.round((i * (sorted.length - 1)) / Math.max(1, count - 1)));
  // Làm tròn có thể trùng chỉ số; bổ sung bằng các chỉ số chưa dùng.
  for (let i = 0; idx.size < count; i++) idx.add(i);
  return {
    chosen: sorted.filter((_, i) => idx.has(i)),
    rest: sorted.filter((_, i) => !idx.has(i)),
  };
}

/**
 * Xếp kiểu răng cưa (GDD mục 5.2): danh sách đã tăng dần độ khó; cứ 3 level
 * thì chèn 1 level dễ để người chơi "nghỉ". Level dễ lấy từ 1/4 dễ nhất.
 */
function sawtooth(sortedAsc) {
  const easyCount = Math.floor(sortedAsc.length / 4);
  const easy = sortedAsc.slice(0, easyCount);
  const rest = sortedAsc.slice(easyCount);
  const out = [];
  rest.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % 3 === 0 && easy.length > 0) out.push(easy.shift());
  });
  return out.concat(easy);
}

/** Đổi một ứng viên thành bản ghi level để ghi vào levels.json. */
function toLevel(c, extra) {
  return {
    ...extra,
    width: c.board.width,
    height: c.board.height,
    fen: c.fen,
    mateIn: c.mateIn,
    attacker: c.board.turn,
    solution: c.analysis.solution,
    difficulty: c.analysis.difficulty,
  };
}

/**
 * Sinh toàn bộ dữ liệu level với một seed. Trả về đối tượng sẽ ghi ra levels.json:
 * { version, seed, chapters, levels: [...60], daily: [...30] }.
 */
export function generateLevels(seed) {
  const rng = createRng(seed);
  const seen = new Set();
  const byDifficulty = (a, b) => a.analysis.difficulty - b.analysis.difficulty;

  process.stderr.write(`Sinh level với seed ${seed}...\n`);

  // Level giới thiệu quân cho đầu chương 1.
  const intro = INTRO_PIECES.map((type) => collect(rng, 1, 1, seen, {
    onlyPiece: type,
    // Level Tốt: nước giải phải là phong cấp (có chữ quân ở cuối, ví dụ "b4b5q").
    accept: type === 'p' ? (_b, a) => /[qrbn]$/.test(a.solution[0]) : undefined,
  })[0]);

  const pools = {};
  for (const n of [1, 2, 3, 4]) pools[n] = collect(rng, n, POOL_SIZE[n], seen).sort(byDifficulty);

  const levels = [];
  for (const ch of CHAPTERS) {
    const need = ch.chapter === 1 ? ch.count - intro.length : ch.count;
    const { chosen, rest } = spreadPick(pools[ch.mateIn], need);
    pools[ch.mateIn] = rest;
    const ordered = ch.chapter === 1 ? [...intro, ...sawtooth(chosen)] : sawtooth(chosen);
    for (const c of ordered) levels.push(toLevel(c, { id: levels.length + 1, chapter: ch.chapter }));
  }

  // Daily: lấy ngẫu nhiên từ phần ứng viên chưa dùng, rồi trộn thứ tự.
  const dailyPicks = [];
  for (const [n, count] of Object.entries(DAILY)) dailyPicks.push(...shuffle(rng, pools[n]).slice(0, count));
  const daily = shuffle(rng, dailyPicks).map((c, i) => toLevel(c, { id: `daily-${String(i + 1).padStart(2, '0')}` }));

  return {
    version: 1,
    seed,
    chapters: CHAPTERS.map(({ chapter, name, mateIn }) => ({ chapter, name, mateIn })),
    levels,
    daily,
  };
}

/**
 * Ghi JSON dễ đọc: mỗi level một khối, nhưng mảng solution nằm trên một dòng.
 */
export function formatLevels(data) {
  return JSON.stringify(data, null, 2).replace(/\[\s+("[^\]]*?")\s+\]/g, (_, inner) => `[${inner.replace(/\s*\n\s*/g, ' ')}]`) + '\n';
}

// Chạy trực tiếp bằng dòng lệnh (không chạy khi file được import).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => {
    const i = args.indexOf(name);
    return i === -1 ? fallback : args[i + 1];
  };
  const seed = Number(arg('--seed', 20261112));
  const out = arg('--out', join(dirname(fileURLToPath(import.meta.url)), '..', 'levels.json'));
  const data = generateLevels(seed);
  writeFileSync(out, formatLevels(data));
  process.stderr.write(`Đã ghi ${data.levels.length} level chính + ${data.daily.length} level Daily vào ${out}\n`);
}
