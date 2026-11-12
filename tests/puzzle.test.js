// Test cho src/puzzle.js: máy trạng thái một level.
// Chạy: npm test  (hoặc: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { toFen, parseSquare } from '../src/board.js';
import {
  createPuzzle, playerMove, retry, opponentMove, undoMove, restart, getHint,
  legalTargets, needsPromotion, summary, PLAYER_TURN, OPPONENT_TURN, WRONG_MOVE, WON,
} from '../src/puzzle.js';
import { createRng } from '../tools/generate-levels.js';

// Thế cờ ghi thẳng ở đây (không đọc levels.json) để test không đổi khi sinh lại level.
// Mate in 1, Xe c4 có nước c4b4 gây hòa pat; đáp án c4c5.
const M1_STALEMATE = { id: 1, width: 3, height: 5, fen: 'k2/2R/K2/3/3 w', mateIn: 1 };
// Mate in 2; nước 2 có hai cách chiếu hết: b3e3 hoặc b3b1.
const M2_TWO_FINISHES = { id: 2, width: 5, height: 5, fen: 'K4/pB3/1R1R1/4k/x4 w', mateIn: 2 };
// Level mẫu GDD nhưng ghi là mate in 2: nhiều nước đầu đều thắng.
const GDD_AS_M2 = { id: 3, width: 4, height: 4, fen: 'k3/2K1/4/3R w', mateIn: 2 };
// Level Tốt: giải bằng phong cấp e4-e5.
const PROMOTION = { id: 4, width: 5, height: 5, fen: 'x1k2/4P/1K3/5/4x w', mateIn: 1 };

const fixed = () => 0; // đối thủ luôn chọn nước đầu tiên trong các nước bằng điểm

test('bắt đầu level: lượt người chơi, đủ số nước', () => {
  const p = createPuzzle(M2_TWO_FINISHES);
  assert.equal(p.state, PLAYER_TURN);
  assert.equal(p.movesLeft, 2);
  assert.deepEqual(p.moves, []);
});

test('nước không hợp lệ: không có gì thay đổi', () => {
  const p = createPuzzle(M1_STALEMATE);
  const before = toFen(p.board);
  assert.deepEqual(playerMove(p, 'c4a1'), { result: 'illegal' });
  assert.equal(p.state, PLAYER_TURN);
  assert.equal(toFen(p.board), before);
  assert.equal(p.wrongMoves, 0);
});

test('mate in 1: đi đúng là thắng', () => {
  const p = createPuzzle(M1_STALEMATE);
  assert.deepEqual(playerMove(p, 'c4c5'), { result: 'win', move: 'c4c5' });
  assert.equal(p.state, WON);
  assert.equal(p.movesLeft, 0);
  assert.equal(summary(p).perfect, true);
});

test('gây hòa pat là sai; retry lùi nước và cho thử lại', () => {
  const p = createPuzzle(M1_STALEMATE);
  const start = toFen(p.board);
  assert.deepEqual(playerMove(p, 'c4b4'), { result: 'wrong', move: 'c4b4', reason: 'stalemate' });
  assert.equal(p.state, WRONG_MOVE);
  assert.notEqual(toFen(p.board), start, 'bàn vẫn hiện nước sai để giao diện rung bàn');
  retry(p);
  assert.equal(p.state, PLAYER_TURN);
  assert.equal(toFen(p.board), start);
  assert.equal(p.movesLeft, 1, 'đi sai không bị trừ nước');
  assert.equal(playerMove(p, 'c4c5').result, 'win');
  assert.equal(summary(p).perfect, false, 'đã đi sai 1 lần thì không còn "perfect"');
  assert.equal(summary(p).wrongMoves, 1);
});

test('mate in 2: đúng → đối thủ đáp → chiếu hết; chấp nhận cách giải khác đáp án', () => {
  const p = createPuzzle(M2_TWO_FINISHES, { random: fixed });
  assert.deepEqual(playerMove(p, 'd3d2'), { result: 'correct', move: 'd3d2' });
  assert.equal(p.state, OPPONENT_TURN);
  assert.equal(p.movesLeft, 1);
  const reply = opponentMove(p);
  assert.equal(p.state, PLAYER_TURN);
  assert.equal(reply, 'e2e1');
  // Đáp án lưu trong level là b3e3, nhưng b3b1 cũng chiếu hết: phải được tính là thắng.
  assert.equal(playerMove(p, 'b3b1').result, 'win');
  assert.deepEqual(summary(p).moves, ['d3d2', 'e2e1', 'b3b1']);
});

test('chấp nhận mọi nước đầu còn chiếu hết được trong số nước còn lại', () => {
  for (const first of ['d1c1', 'd1b1', 'c3b2']) {
    const p = createPuzzle(GDD_AS_M2);
    assert.equal(playerMove(p, first).result, 'correct', first);
  }
  // d1a1 chiếu hết luôn: thắng sớm hơn hạn cũng được.
  assert.equal(playerMove(createPuzzle(GDD_AS_M2), 'd1a1').result, 'win');
  // Rd4+ cho Vua đen chạy thoát: sai.
  const p = createPuzzle(GDD_AS_M2);
  assert.deepEqual(playerMove(p, 'd1d4'), { result: 'wrong', move: 'd1d4', reason: 'no-mate' });
});

test('gọi hàm ở sai trạng thái thì báo lỗi', () => {
  const p = createPuzzle(M2_TWO_FINISHES);
  assert.throws(() => opponentMove(p), /OPPONENT_TURN/);
  assert.throws(() => retry(p), /WRONG_MOVE/);
  playerMove(p, 'd3d2');
  assert.throws(() => playerMove(p, 'b3e3'), /PLAYER_TURN/);
  assert.throws(() => undoMove(p), /PLAYER_TURN/);
  assert.throws(() => getHint(p, 1), /PLAYER_TURN/);
});

test('undo: lùi cả nước mình lẫn nước đáp, trả lại 1 nước', () => {
  const p = createPuzzle(M2_TWO_FINISHES, { random: fixed });
  assert.equal(undoMove(p), false, 'chưa đi gì thì không undo được');
  const start = toFen(p.board);
  playerMove(p, 'd3d2');
  opponentMove(p);
  assert.equal(undoMove(p), true);
  assert.equal(toFen(p.board), start);
  assert.equal(p.movesLeft, 2);
  assert.deepEqual(p.moves, []);
  assert.equal(playerMove(p, 'd3d2').result, 'correct');
});

test('restart: về thế ban đầu nhưng giữ số lần sai và gợi ý', () => {
  const p = createPuzzle(M2_TWO_FINISHES, { random: fixed });
  playerMove(p, 'b3a3'); // sai
  retry(p);
  getHint(p, 1);
  playerMove(p, 'd3d2');
  opponentMove(p);
  restart(p);
  assert.equal(p.state, PLAYER_TURN);
  assert.equal(p.movesLeft, 2);
  assert.equal(toFen(p.board), toFen(createPuzzle(M2_TWO_FINISHES).board));
  assert.equal(p.wrongMoves, 1);
  assert.equal(p.hintsUsed, 1);
});

test('gợi ý 3 mức, tính từ thế cờ hiện tại', () => {
  const p = createPuzzle(M2_TWO_FINISHES, { random: fixed });
  assert.deepEqual(getHint(p, 1), { from: 'd3' });
  assert.deepEqual(getHint(p, 2), { from: 'd3', to: 'd2', move: 'd3d2' });
  assert.deepEqual(getHint(p, 3), { line: ['d3d2', 'e2e1', 'b3e3'] });
  assert.equal(p.hintsUsed, 3);
  assert.throws(() => getHint(p, 4), /Mức gợi ý/);

  // Giữa chừng: gợi ý nước TIẾP THEO, không quay lại nước đầu (sửa lỗi UX bản gốc).
  playerMove(p, 'd3d2');
  opponentMove(p);
  const h = getHint(p, 2);
  assert.ok(['b3e3', 'b3b1'].includes(h.move));
  assert.equal(playerMove(p, h.move).result, 'win');
  assert.equal(summary(p).hintUsed, true);
  assert.equal(summary(p).perfect, false);
});

test('legalTargets và needsPromotion cho giao diện', () => {
  const p = createPuzzle(PROMOTION);
  const e4 = parseSquare(p.board, 'e4');
  const e5 = parseSquare(p.board, 'e5');
  assert.deepEqual(legalTargets(p, e4), [{ to: e5, capture: false, promotion: true }]);
  assert.equal(needsPromotion(p, e4, e5), true);
  assert.equal(needsPromotion(p, parseSquare(p.board, 'b3'), parseSquare(p.board, 'b2')), false);
  // Phong Hậu là thắng; không ghi quân thì mặc định Hậu.
  assert.equal(playerMove(p, 'e4e5').result, 'win');
  assert.deepEqual(legalTargets(p, e5), [], 'hết lượt người chơi thì không có ô nào');
});

test('chơi hết các level thật trong levels.json chỉ bằng gợi ý mức 2 → luôn thắng đúng hạn', () => {
  const data = JSON.parse(readFileSync(new URL('../levels.json', import.meta.url), 'utf8'));
  // Mọi level mate in 1–2, cộng vài level mate in 3–4 và Daily (có cả level Đen tấn công).
  const sample = [
    ...data.levels.filter((l) => l.mateIn <= 2),
    ...data.levels.filter((l) => l.mateIn === 3).slice(0, 3),
    ...data.levels.filter((l) => l.mateIn === 4).slice(0, 2),
    ...data.levels.filter((l) => l.attacker === 'b'),
    ...data.daily.slice(0, 5),
  ];
  const rng = createRng(7); // đối thủ chọn ngẫu nhiên nhưng lặp lại được
  for (const level of sample) {
    const p = createPuzzle(level, { random: rng });
    for (let turn = 0; turn < level.mateIn && p.state !== WON; turn++) {
      const r = playerMove(p, getHint(p, 2).move);
      assert.ok(r.result === 'win' || r.result === 'correct', `level ${level.id}: gợi ý bị chấm ${r.result}`);
      if (p.state === OPPONENT_TURN) opponentMove(p);
    }
    assert.equal(p.state, WON, `level ${level.id} chưa thắng sau ${level.mateIn} nước`);
  }
});
