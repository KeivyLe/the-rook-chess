// Test cho src/solver.js: tìm chiếu hết bằng alpha-beta + bảng băm.
// Ba thế cờ lấy từ ảnh chụp game gốc (tự chép lại thành FEN).
// Chạy: npm test  (hoặc: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFen, toFen, make, undo, moveToString } from '../src/board.js';
import { legalMoves, isCheckmate, findMove } from '../src/movegen.js';
import { findMate, isStillWinning, bestDefense, bestHint } from '../src/solver.js';

// Ảnh "Level 8": bàn 3×4, Trắng đi, mate in 1.
const LEVEL_8 = '2k/1pp/3/R2 w';

// Ảnh "20 September": bàn 4×5 có lỗ ở góc dưới trái, Trắng đi, mate in 2.
const SEPT_20 = '2k1/4/x1P1/xx1R/xxxB w';

// Ảnh "Level 90": bàn 5×5, Đen đi (người chơi cầm Đen), mate in 4.
// Game gốc xoay bàn 180° khi người chơi cầm Đen (phía người chơi luôn ở dưới),
// nên khi chép phải xoay lại cho Trắng ở dưới: Vua trắng e1, Tốt trắng đi lên.
const LEVEL_90 = '5/q2n1/2PN1/3PP/1R2K b';

/** Đi lần lượt các nước dạng chuỗi trên bàn, báo lỗi nếu có nước không hợp lệ. */
function play(board, line) {
  for (const text of line) {
    const m = findMove(board, text);
    assert.ok(m, `nước ${text} không hợp lệ`);
    make(board, m);
  }
}

/** Kiểm tra level: chiếu hết ĐÚNG n nước (có trong n, không có trong n-1). */
function assertMateInExactly(fen, n) {
  const b = parseFen(fen);
  if (n > 1) assert.equal(findMate(b, n - 1), null, `${fen}: không được có mate in ${n - 1}`);
  const r = findMate(b, n);
  assert.ok(r, `${fen}: phải có mate in ${n}`);
  assert.equal(r.mateIn, n);
  assert.equal(r.line.length, 2 * n - 1, 'biến chính dài 2n-1 ply');
  // Đi theo biến chính thì phải kết thúc bằng chiếu hết.
  play(b, r.line);
  assert.equal(isCheckmate(b), true, `${fen}: biến chính ${r.line.join(' ')} không chiếu hết`);
  return r;
}

test('ảnh "Level 8" (3×4): mate in 1, đáp án Ra4', () => {
  const r = assertMateInExactly(LEVEL_8, 1);
  assert.deepEqual(r.line, ['a1a4']);
});

test('ảnh "20 September" (4×5 có lỗ): mate in 2, Bb3 rồi Rd5#', () => {
  const r = assertMateInExactly(SEPT_20, 2);
  assert.equal(r.line[0], 'd1b3');
  assert.equal(r.line[2], 'd2d5');
});

test('ảnh "Level 90" (5×5, Đen tấn công): mate in 4, kết thúc chiếu hết ngộp thở', () => {
  const r = assertMateInExactly(LEVEL_90, 4);
  // Nc2+ Kd1, Ne3+ Ke1, Qd1+! Rxd1 (hy sinh Hậu), Nc2#.
  assert.deepEqual(r.line, ['d4c2', 'e1d1', 'c2e3', 'd1e1', 'a4d1', 'b1d1', 'e3c2']);
});

test('level mẫu GDD "k3/2K1/4/3R w": mate in 1 = d1a1', () => {
  assert.deepEqual(assertMateInExactly('k3/2K1/4/3R w', 1).line, ['d1a1']);
});

test('findMate trả về số nước ÍT NHẤT, kể cả khi cho phép nhiều hơn', () => {
  assert.equal(findMate(parseFen(LEVEL_8), 3).mateIn, 1);
  assert.equal(findMate(parseFen(SEPT_20), 4).mateIn, 2);
});

test('findMate trả null khi không có chiếu hết, và không làm thay đổi bàn', () => {
  const b = parseFen('k3/4/4/K3 w'); // chỉ còn 2 Vua
  assert.equal(findMate(b, 3), null);
  const c = parseFen(LEVEL_90);
  const before = toFen(c);
  findMate(c, 4);
  assert.equal(toFen(c), before);
  assert.equal(c.history.length, 0);
});

test('findMate đếm số node đã duyệt (để chấm độ khó)', () => {
  const easy = findMate(parseFen(LEVEL_8), 1).nodes;
  const hard = findMate(parseFen(LEVEL_90), 4).nodes;
  assert.ok(easy > 0 && hard > easy);
});

test('isStillWinning: nước đúng thì true, nước sai thì false', () => {
  const good = parseFen(SEPT_20);
  play(good, ['d1b3']);
  assert.equal(isStillWinning(good, 2), true);

  const bad = parseFen(SEPT_20);
  play(bad, ['d2d5']); // chiếu ngay nhưng Vua đen chạy thoát
  assert.equal(isStillWinning(bad, 2), false);

  // Hết lượt (0 ply): chỉ đúng khi thế hiện tại đã là chiếu hết.
  const mated = parseFen(LEVEL_8);
  play(mated, ['a1a4']);
  assert.equal(isStillWinning(mated, 0), true);
});

test('isStillWinning: gây hòa pat tính là sai', () => {
  // Đen hết nước nhưng không bị chiếu.
  assert.equal(isStillWinning(parseFen('k2/2Q/1K1 b'), 0), false);
  assert.equal(isStillWinning(parseFen('k2/2Q/1K1 b'), 2), false);
});

test('isStillWinning chấp nhận MỌI nước còn chiếu hết được, không chỉ đúng đáp án', () => {
  // Level mẫu GDD cho mate in 2: ngoài d1a1 (hết luôn) còn nhiều nước khác vẫn thắng.
  const b = parseFen('k3/2K1/4/3R w');
  const winning = legalMoves(b).filter((m) => {
    make(b, m);
    const ok = isStillWinning(b, 2);
    undo(b);
    return ok;
  }).map((m) => moveToString(b, m));
  assert.ok(winning.includes('d1a1'));
  assert.ok(winning.length > 1, `chỉ có ${winning}`);
});

/** Số nước bên tấn công cần để chiếu hết sau khi bên phòng thủ đi `m` (Infinity = thoát). */
function defenseLength(board, m, maxMoves) {
  make(board, m);
  const r = findMate(board, maxMoves);
  undo(board);
  return r ? r.mateIn : Infinity;
}

test('bestDefense chọn nước kéo dài LÂU NHẤT', () => {
  // Level 90 sau Nc2+ Kd1 Ne3+: Trắng có thể chạy Ke1 hoặc Kc1, phải chọn nước bị hết muộn nhất.
  for (const [fen, line, plies] of [[LEVEL_90, ['d4c2'], 6], [LEVEL_90, ['d4c2', 'e1d1', 'c2e3'], 4], [SEPT_20, ['d1b3'], 2]]) {
    const b = parseFen(fen);
    play(b, line);
    const lengths = legalMoves(b).map((m) => defenseLength(b, m, 4));
    const longest = Math.max(...lengths);
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const d = bestDefense(b, plies, () => r);
      assert.equal(defenseLength(b, d, 4), longest, `${fen} sau ${line}: chọn ${moveToString(b, d)}`);
    }
  }
});

test('bestDefense chọn nước thoát được nếu có', () => {
  // Level 90 sau Nc2+ Kd1 Ne3+, giả sử Đen chỉ còn 1 nước nữa (2 ply):
  // Kc1 thì bị Nc2# ngay, Ke1 thì Đen không chiếu hết kịp → phải chọn Ke1.
  const b = parseFen(LEVEL_90);
  play(b, ['d4c2', 'e1d1', 'c2e3']);
  assert.equal(defenseLength(b, findMove(b, 'd1c1'), 1), 1);
  assert.equal(defenseLength(b, findMove(b, 'd1e1'), 1), Infinity);
  for (const r of [0, 0.99]) assert.equal(moveToString(b, bestDefense(b, 2, () => r)), 'd1e1');
});

test('bestDefense hòa điểm thì chọn ngẫu nhiên giữa các nước tốt nhất', () => {
  // Chỉ còn 2 Vua: mọi nước của Đen đều bằng điểm (không ai chiếu hết được).
  const b = parseFen('4/1k2/4/K3 b');
  const all = legalMoves(b).map((m) => moveToString(b, m));
  const picks = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((r) => moveToString(b, bestDefense(b, 2, () => r))));
  for (const p of picks) assert.ok(all.includes(p));
  assert.ok(picks.size > 1, 'phải chọn được nhiều nước khác nhau');
  // Mặc định dùng Math.random: chỉ cần trả về một nước hợp lệ.
  assert.ok(all.includes(moveToString(b, bestDefense(b, 2))));
  // Hết nước (pat) thì trả null.
  assert.equal(bestDefense(parseFen('k2/2Q/1K1 b'), 2), null);
});

test('bestHint gợi ý từ thế cờ HIỆN TẠI, kể cả giữa chừng', () => {
  const b = parseFen(SEPT_20);
  assert.equal(moveToString(b, bestHint(b, 3)), 'd1b3');
  play(b, ['d1b3', 'c5b5']);
  assert.equal(moveToString(b, bestHint(b, 1)), 'd2d5');

  const c = parseFen(LEVEL_90);
  assert.equal(moveToString(c, bestHint(c, 7)), 'd4c2'); // bên tấn công là Đen
  assert.equal(bestHint(c, 5), null); // không có mate in 3
});
