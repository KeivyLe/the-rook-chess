// Test cho src/movegen.js: sinh nước, chiếu, chiếu hết, hòa pat, phong cấp.
// Chạy: npm test  (hoặc: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFen, make, undo, moveToString } from '../src/board.js';
import {
  legalMoves, inCheck, isCheckmate, isStalemate, findMove, perft,
} from '../src/movegen.js';

// Danh sách nước hợp lệ dạng chuỗi, đã sắp xếp, để so sánh dễ đọc.
const moveList = (b) => legalMoves(b).map((m) => moveToString(b, m)).sort();

// ---------------------------------------------------------------------------
// Level mẫu trong tài liệu thiết kế (mục 8.3)
// ---------------------------------------------------------------------------

test('level mẫu "k3/2K1/4/3R w": Ra1 (d1a1) là chiếu hết', () => {
  const b = parseFen('k3/2K1/4/3R w', { width: 4, height: 4 });
  assert.equal(isCheckmate(b), false);

  const m = findMove(b, 'd1a1');
  assert.ok(m, 'd1a1 phải là nước hợp lệ');
  make(b, m);
  assert.equal(b.turn, 'b');
  assert.equal(inCheck(b), true, 'Vua đen phải bị chiếu');
  assert.deepEqual(moveList(b), [], 'Vua đen không còn nước nào');
  assert.equal(isCheckmate(b), true);
  assert.equal(isStalemate(b), false);

  undo(b);
  assert.equal(isCheckmate(b), false);
});

test('level mẫu: d1a1 là nước chiếu hết DUY NHẤT trong 1 nước', () => {
  const b = parseFen('k3/2K1/4/3R w');
  const mates = legalMoves(b).filter((m) => {
    make(b, m);
    const mate = isCheckmate(b);
    undo(b);
    return mate;
  }).map((m) => moveToString(b, m));
  assert.deepEqual(mates, ['d1a1']);
});

test('level mẫu: Rd4 chiếu nhưng không hết (Vua đen chạy được a3)', () => {
  const b = parseFen('k3/2K1/4/3R w');
  make(b, findMove(b, 'd1d4'));
  assert.equal(inCheck(b), true);
  assert.equal(isCheckmate(b), false);
  assert.deepEqual(moveList(b), ['a4a3']);
});

// ---------------------------------------------------------------------------
// 6 thế cờ tự dựng, số nước hợp lệ đã đếm tay (tài liệu thiết kế, Mốc 1)
// ---------------------------------------------------------------------------

test('đếm tay 1: Vua trắng ở góc a4 → 3 nước', () => {
  // K a4 đi được a3, b3, b4. Vua đen a1 khống chế a2, b1, b2 (không ảnh hưởng).
  const b = parseFen('K3/4/4/k3 w');
  assert.deepEqual(moveList(b), ['a4a3', 'a4b3', 'a4b4']);
});

test('đếm tay 2: Mã giữa bàn 5×5 có 8 nước, cộng 3 nước Vua = 11', () => {
  const b = parseFen('5/5/2N2/5/K3k w');
  const moves = moveList(b);
  assert.equal(moves.length, 11);
  assert.deepEqual(moves.filter((s) => s.startsWith('c3')),
    ['c3a2', 'c3a4', 'c3b1', 'c3b5', 'c3d1', 'c3d5', 'c3e2', 'c3e4']);
});

test('đếm tay 3: Tốt tới hàng cuối sinh 4 nước phong cấp (Q R B N)', () => {
  // Tốt a3 lên a4 = 4 lựa chọn. Vua a1: b1, b2 bị Vua đen c1 khống chế, chỉ còn a2.
  const b = parseFen('4/P3/4/K1k1 w');
  assert.deepEqual(moveList(b), ['a1a2', 'a3a4b', 'a3a4n', 'a3a4q', 'a3a4r']);
});

test('đếm tay 4: quân bị ghim không được đi → chỉ 2 nước Vua', () => {
  // Xe đen a4 ghim Tượng trắng a2 vào Vua a1: Tượng đi chéo là để lộ Vua.
  const b = parseFen('r3/4/B3/K2k w');
  assert.deepEqual(moveList(b), ['a1b1', 'a1b2']);
});

test('đếm tay 5: đang bị chiếu thì chỉ được đi nước thoát chiếu', () => {
  // Xe đen d1 chiếu Vua trắng a1 theo hàng 1. Không quân nào chặn được,
  // Vua chỉ chạy a2 hoặc b2 (b1 vẫn nằm trên đường Xe).
  const b = parseFen('k3/4/4/K2r w');
  assert.equal(inCheck(b), true);
  assert.deepEqual(moveList(b), ['a1a2', 'a1b2']);
});

test('đếm tay 6: bắt tốt qua đường trên bàn 8×8 → 5 nước', () => {
  // e5-e6, e5xd6 (qua đường), Vua a1: a2, b1, b2.
  const b = parseFen('8/8/8/3pP3/8/8/8/K6k w - d6');
  assert.deepEqual(moveList(b), ['a1a2', 'a1b1', 'a1b2', 'e5d6', 'e5e6']);
  const ep = findMove(b, 'e5d6');
  assert.equal(ep.flag, 'ep');
  assert.equal(ep.captured, 'p');
});

// ---------------------------------------------------------------------------
// Chiếu hết, hòa pat, phong cấp Mã
// ---------------------------------------------------------------------------

test('hòa pat: Đen không bị chiếu nhưng hết nước', () => {
  // Bàn 3×3: Vua đen a3, Hậu trắng c2, Vua trắng b1.
  const b = parseFen('k2/2Q/1K1 b');
  assert.equal(inCheck(b), false);
  assert.equal(isStalemate(b), true);
  assert.equal(isCheckmate(b), false);
});

test('phong cấp Mã để chiếu hết (phong Hậu thì không hết)', () => {
  // Bàn 4×4. Vua đen a3 bị quân mình chặn ở a2, a4, b4; Vua trắng c2 giữ b2, b3.
  const b = parseFen('nb2/k1P1/p1K1/4 w');
  const mateWith = (text) => {
    make(b, findMove(b, text));
    const mate = isCheckmate(b);
    undo(b);
    return mate;
  };
  assert.equal(mateWith('c3c4n'), true);
  assert.equal(mateWith('c3c4q'), false);
  // findMove không ghi quân phong cấp thì mặc định Hậu.
  assert.equal(findMove(b, 'c3c4').promotion, 'q');
});

test('nhập thành: không được nhập thành khi bị chiếu hoặc đi qua ô bị tấn công', () => {
  const free = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
  assert.ok(findMove(free, 'e1g1'));
  assert.ok(findMove(free, 'e1c1'));

  // Xe đen f8 khống chế f1: không nhập thành cánh Vua được, cánh Hậu vẫn được.
  const through = parseFen('4kr2/8/8/8/8/8/8/R3K2R w KQ -');
  assert.equal(findMove(through, 'e1g1'), null);
  assert.ok(findMove(through, 'e1c1'));

  // Xe đen e8 chiếu Vua e1: không được nhập thành bên nào.
  const check = parseFen('4r1k1/8/8/8/8/8/8/R3K2R w KQ -');
  assert.equal(findMove(check, 'e1g1'), null);
  assert.equal(findMove(check, 'e1c1'), null);
});

test('Tốt đi 2 ô chỉ khi level cho phép', () => {
  const small = parseFen('k4/5/5/P4/4K w'); // bàn 5×5, mặc định tắt
  assert.equal(findMove(small, 'a2a4'), null);
  const allowed = parseFen('k4/5/5/P4/4K w', { pawnDoubleStep: true });
  assert.ok(findMove(allowed, 'a2a4'));
});

test('bên không có Vua thì không bao giờ bị chiếu (thế cờ puzzle dựng tay)', () => {
  const b = parseFen('4/4/4/R2r w');
  assert.equal(inCheck(b), false);
  assert.equal(isCheckmate(b), false);
});

// ---------------------------------------------------------------------------
// Perft: so với số liệu chuẩn của cờ vua 8×8 (kiểm tra toàn diện make/undo/movegen)
// ---------------------------------------------------------------------------

test('perft thế khai cuộc chuẩn: 20, 400, 8902', () => {
  const b = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  assert.equal(perft(b, 1), 20);
  assert.equal(perft(b, 2), 400);
  assert.equal(perft(b, 3), 8902);
});

test('perft Kiwipete (nhập thành, bắt qua đường, phong cấp): 48, 2039, 97862', () => {
  const b = parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
  assert.equal(perft(b, 1), 48);
  assert.equal(perft(b, 2), 2039);
  assert.equal(perft(b, 3), 97862);
});

test('perft thế số 3 (ghim ngang, bắt qua đường hiểm): 14, 191, 2812, 43238', () => {
  const b = parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -');
  assert.equal(perft(b, 1), 14);
  assert.equal(perft(b, 2), 191);
  assert.equal(perft(b, 3), 2812);
  assert.equal(perft(b, 4), 43238);
});

// ---------------------------------------------------------------------------
// Lỗ ('x'): quân không đứng, đi vào hay trượt qua lỗ được
// ---------------------------------------------------------------------------

test('lỗ: Xe dừng trước lỗ như dừng trước mép bàn', () => {
  // Không có lỗ: Xe a1 đi được a2, a3, a4, b1, c1, d1 = 6 nước.
  assert.equal(moveList(parseFen('4/4/4/R3 w')).length, 6);
  // Lỗ ở a3: Xe chỉ lên được a2, không trượt qua tới a4.
  assert.deepEqual(moveList(parseFen('4/x3/4/R3 w')), ['a1a2', 'a1b1', 'a1c1', 'a1d1']);
});

test('lỗ: Tượng và Hậu không trượt qua lỗ theo đường chéo', () => {
  assert.deepEqual(moveList(parseFen('4/4/1x2/B3 w')), []);
  assert.deepEqual(moveList(parseFen('3/1x1/Q2 w')), ['a1a2', 'a1a3', 'a1b1', 'a1c1']);
});

test('lỗ: Mã nhảy QUA lỗ được nhưng không đáp XUỐNG lỗ', () => {
  // Bàn 3×3, hàng 2 toàn lỗ. Mã a1: b3 được (nhảy qua lỗ), c2 là lỗ nên không được.
  assert.deepEqual(moveList(parseFen('3/xxx/N2 w')), ['a1b3']);
});

test('lỗ: Tốt không tiến vào lỗ, Vua không bước vào lỗ', () => {
  assert.deepEqual(moveList(parseFen('3/x2/P2 w')), []);
  assert.deepEqual(moveList(parseFen('xx/Kx w')), []);
});

test('lỗ: nhập thành bị chặn nếu giữa Vua và Xe có lỗ', () => {
  const b = parseFen('4k3/8/8/8/8/8/8/R3Kx1R w KQ -');
  assert.equal(findMove(b, 'e1g1'), null);
  assert.ok(findMove(b, 'e1c1'));
});
