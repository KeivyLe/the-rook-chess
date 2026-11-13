#!/usr/bin/env node
// =============================================================================
// tools/playtest.js — "Người chơi máy" chơi thử TOÀN BỘ level qua puzzle.js
// (đúng các hàm mà giao diện gọi), để tìm lỗi trước khi người thật chơi.
//
// Cách chạy:  node tools/playtest.js            (mọi level chính + Daily)
//             node tools/playtest.js --rounds 5 (mỗi level chơi 5 ván, đối thủ ngẫu nhiên khác nhau)
//
// Với mỗi level, script chơi `rounds` ván. Mỗi ván:
//   1. Thử một nước SAI ở đầu ván (nếu có): phải bị chấm "wrong", retry() phải
//      trả bàn về đúng như cũ.
//   2. Đi theo gợi ý mức 2 (bestHint), đối thủ đáp bằng bestDefense với số
//      ngẫu nhiên khác nhau mỗi ván (để đi qua nhiều nhánh phòng thủ).
//   3. Giữa chừng thử Undo rồi đi lại.
//   4. Phải thắng trong đúng số nước của đề, không có lỗi nào bị ném ra.
// Ván đầu tiên còn kiểm tra gợi ý mức 3 (toàn bộ lời giải) đi được hết.
// In ra thời gian chậm nhất của một lượt (bộ giải) để biết game có bị "đơ" không.
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { toFen, moveToString, make, undo } from '../src/board.js';
import { legalMoves } from '../src/movegen.js';
import { isStillWinning } from '../src/solver.js';
import {
  createPuzzle, playerMove, retry, opponentMove, undoMove, getHint, summary,
  PLAYER_TURN, OPPONENT_TURN, WON,
} from '../src/puzzle.js';
import { createRng } from './generate-levels.js';

/**
 * Tìm một nước SAI ở thế cờ đầu level: nước hợp lệ mà sau đó không còn chiếu
 * hết kịp. Trả về chuỗi nước, hoặc null nếu mọi nước đều đúng.
 */
function findWrongMove(puzzle) {
  const b = puzzle.board;
  for (const m of legalMoves(b)) {
    make(b, m);
    const ok = isStillWinning(b, 2 * (puzzle.movesLeft - 1));
    undo(b);
    if (!ok) return moveToString(b, m);
  }
  return null;
}

/**
 * Chơi một ván của `level`. Trả về { errors, slowestMs }.
 * `round` là số thứ tự ván (ván 0 kiểm tra thêm gợi ý mức 3 và nước sai).
 */
function playRound(level, round, rng) {
  const errors = [];
  const fail = (msg) => errors.push(`level ${level.id} ván ${round + 1}: ${msg}`);
  let slowestMs = 0;
  const timed = (fn) => {
    const t = performance.now();
    const r = fn();
    slowestMs = Math.max(slowestMs, performance.now() - t);
    return r;
  };

  const p = createPuzzle(level, { random: rng });
  const startFen = toFen(p.board);

  // 1. Nước sai.
  if (round === 0) {
    const wrong = findWrongMove(p);
    if (wrong) {
      const r = timed(() => playerMove(p, wrong));
      if (r.result !== 'wrong') fail(`nước sai ${wrong} lại bị chấm "${r.result}"`);
      else {
        retry(p);
        if (toFen(p.board) !== startFen) fail('retry() không trả bàn về như cũ');
        if (p.movesLeft !== level.mateIn) fail('đi sai mà bị trừ nước');
      }
    }
    // Gợi ý mức 3: lời giải phải đủ 2·N − 1 ply.
    const full = getHint(p, 3).line;
    if (full.length !== 2 * level.mateIn - 1) fail(`gợi ý mức 3 dài ${full.length} ply`);
  }

  // 2–3. Đi theo gợi ý, thử Undo ở lượt thứ hai.
  let undone = false;
  for (let turn = 0; turn < level.mateIn + 1 && p.state !== WON; turn++) {
    if (p.state !== PLAYER_TURN) { fail(`trạng thái lạ ${p.state}`); break; }
    const hint = timed(() => getHint(p, 2));
    const r = timed(() => playerMove(p, hint.move));
    if (r.result !== 'correct' && r.result !== 'win') { fail(`gợi ý ${hint.move} bị chấm "${r.result}"`); break; }
    if (p.state === OPPONENT_TURN) timed(() => opponentMove(p));
    if (!undone && p.state === PLAYER_TURN && p.moves.length >= 2) {
      undone = true;
      const left = p.movesLeft;
      undoMove(p);
      if (p.movesLeft !== left + 1) fail('undo không trả lại 1 nước');
    }
  }
  if (p.state !== WON) fail(`chưa thắng sau khi hết lượt (còn ${p.movesLeft} nước)`);
  const s = summary(p);
  const playerMoves = Math.ceil(s.moves.length / 2);
  if (playerMoves > level.mateIn) fail(`thắng bằng ${playerMoves} nước, đề là ${level.mateIn}`);
  return { errors, slowestMs };
}

/** Chơi thử toàn bộ dữ liệu. Trả về { errors, games, slowestMs, slowestLevel }. */
export function playtestAll(data, rounds = 3) {
  const rng = createRng(2026);
  const errors = [];
  let games = 0;
  let slowestMs = 0;
  let slowestLevel = null;
  for (const level of [...data.levels, ...data.daily]) {
    for (let round = 0; round < rounds; round++) {
      try {
        const r = playRound(level, round, rng);
        errors.push(...r.errors);
        if (r.slowestMs > slowestMs) { slowestMs = r.slowestMs; slowestLevel = level.id; }
      } catch (e) {
        errors.push(`level ${level.id} ván ${round + 1}: lỗi ${e.message}`);
      }
      games++;
    }
  }
  return { errors, games, slowestMs, slowestLevel };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--rounds');
  const rounds = i === -1 ? 3 : Number(args[i + 1]);
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'levels.json');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const started = Date.now();
  const r = playtestAll(data, rounds);
  for (const e of r.errors) console.log('LỖI: ' + e);
  console.log(`${r.games} ván, ${r.errors.length} lỗi, ${((Date.now() - started) / 1000).toFixed(1)}s; ` +
    `lượt chậm nhất ${r.slowestMs.toFixed(0)} ms (level ${r.slowestLevel})`);
  if (r.errors.length) process.exit(1);
}
