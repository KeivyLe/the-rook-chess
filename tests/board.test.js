// Test cho src/board.js: đọc/ghi FEN mở rộng, make/undo.
// Chạy: npm test  (hoặc: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFen, toFen, parseSquare, squareName, sqIndex, onBoard, make, undo } from '../src/board.js';
import { findMove, legalMoves } from '../src/movegen.js';

test('đọc FEN level mẫu 4×4: kích thước, vị trí quân, lượt đi', () => {
  const b = parseFen('k3/2K1/4/3R w', { width: 4, height: 4 });
  assert.equal(b.width, 4);
  assert.equal(b.height, 4);
  assert.equal(b.turn, 'w');
  assert.equal(b.squares[parseSquare(b, 'a4')], 'k');
  assert.equal(b.squares[parseSquare(b, 'c3')], 'K');
  assert.equal(b.squares[parseSquare(b, 'd1')], 'R');
  // Đếm số quân: đúng 3 quân, còn lại trống.
  assert.equal(b.squares.filter((p) => p !== '.').length, 3);
  // Bàn nhỏ: mặc định Tốt không được đi 2 ô.
  assert.equal(b.pawnDoubleStep, false);
});

test('đánh số ô: a1 = 0, hàng tính từ dưới lên', () => {
  const b = parseFen('4/4/4/4 w');
  assert.equal(parseSquare(b, 'a1'), 0);
  assert.equal(parseSquare(b, 'd1'), 3);
  assert.equal(parseSquare(b, 'a2'), 4);
  assert.equal(parseSquare(b, 'd4'), 15);
  assert.equal(squareName(b, sqIndex(b, 2, 1)), 'c2');
  assert.throws(() => parseSquare(b, 'e1'), /ngoài bàn/);
});

test('bàn chữ nhật và số ô trống nhiều chữ số', () => {
  const b = parseFen('10/k8K b'); // rộng 10, cao 2
  assert.equal(b.width, 10);
  assert.equal(b.height, 2);
  assert.equal(b.turn, 'b');
  assert.equal(b.squares[parseSquare(b, 'a1')], 'k');
  assert.equal(b.squares[parseSquare(b, 'j1')], 'K');
});

test('toFen(parseFen(x)) trả lại đúng chuỗi ban đầu (dạng đầy đủ)', () => {
  for (const fen of [
    'k3/2K1/4/3R w - -',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
    '8/8/8/3pP3/8/8/8/K6k w - d6',
    '5/5/2N2/5/K3k b - -',
  ]) {
    assert.equal(toFen(parseFen(fen)), fen);
  }
  // Thiếu trường thì được điền mặc định.
  assert.equal(toFen(parseFen('k3/2K1/4/3R w')), 'k3/2K1/4/3R w - -');
});

test('FEN sai thì báo lỗi rõ ràng', () => {
  assert.throws(() => parseFen('k3/2K/4/3R w'), /hàng 2/);          // hàng thiếu ô
  assert.throws(() => parseFen('k3/2K1/4/3X w'), /không phải quân/); // ký tự lạ
  assert.throws(() => parseFen('k3/2K1/4/3R x'), /lượt đi/);
  assert.throws(() => parseFen('k3/2K1/4/3R w', { width: 5 }), /width/);
  assert.throws(() => parseFen('k3/2K1/4/3R w', { height: 5 }), /height/);
});

test('make rồi undo trả bàn về đúng như cũ (mọi nước trong thế Kiwipete)', () => {
  // Thế cờ nổi tiếng có đủ nhập thành, ăn quân, bắt tốt qua đường (sau 1 nước).
  const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -';
  const b = parseFen(fen);
  for (const m of legalMoves(b)) {
    make(b, m);
    assert.notEqual(toFen(b), fen);
    undo(b);
    assert.equal(toFen(b), fen, `undo sai sau nước ${m.from}->${m.to}`);
  }
  assert.equal(b.history.length, 0);
});

test('make: nhập thành di chuyển cả Xe, mất quyền nhập thành', () => {
  const b = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
  make(b, findMove(b, 'e1g1'));
  assert.equal(toFen(b), 'r3k2r/8/8/8/8/8/8/R4RK1 b kq -');
  make(b, findMove(b, 'e8c8'));
  assert.equal(toFen(b), '2kr3r/8/8/8/8/8/8/R4RK1 w - -');
  undo(b);
  undo(b);
  assert.equal(toFen(b), 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
});

test('make: Xe đi hoặc bị ăn ở góc thì mất quyền nhập thành phía đó', () => {
  const b = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
  make(b, findMove(b, 'a1a8')); // Xe trắng ăn Xe đen ở a8
  assert.equal(toFen(b), 'R3k2r/8/8/8/8/8/8/4K2R b Kk -');
});

test('make: Tốt đi 2 ô tạo ô bắt tốt qua đường; bắt qua đường xoá đúng Tốt', () => {
  const b = parseFen('4k3/3p4/8/4P3/8/8/8/4K3 b - -');
  make(b, findMove(b, 'd7d5'));
  assert.equal(toFen(b), '4k3/8/8/3pP3/8/8/8/4K3 w - d6');
  make(b, findMove(b, 'e5d6'));
  assert.equal(toFen(b), '4k3/8/3P4/8/8/8/8/4K3 b - -');
  undo(b);
  assert.equal(toFen(b), '4k3/8/8/3pP3/8/8/8/4K3 w - d6');
});

test('make: phong cấp đặt đúng quân mới, undo trả lại Tốt', () => {
  const b = parseFen('4/P3/4/K1k1 w');
  make(b, findMove(b, 'a3a4n'));
  assert.equal(toFen(b), 'N3/4/4/K1k1 b - -');
  undo(b);
  assert.equal(toFen(b), '4/P3/4/K1k1 w - -');
});

test('undo khi không còn nước thì báo lỗi', () => {
  const b = parseFen('k3/2K1/4/3R w');
  assert.throws(() => undo(b), /undo/);
});

// ---------------------------------------------------------------------------
// Lỗ ('x'): ô không tồn tại, cho bàn hình dạng lạ
// ---------------------------------------------------------------------------

test('lỗ: đọc/ghi FEN có "x", onBoard trả false tại lỗ', () => {
  // Thế cờ "20 September" (ảnh 3): bàn 4×5 khuyết góc dưới bên trái.
  const fen = '2k1/4/x1P1/xx1R/xxxB w - -';
  const b = parseFen(fen);
  assert.equal(b.width, 4);
  assert.equal(b.height, 5);
  assert.equal(toFen(b), fen);
  assert.equal(onBoard(b, 0, 0), false); // a1 là lỗ
  assert.equal(onBoard(b, 3, 0), true);  // d1 có Tượng
  assert.equal(onBoard(b, 0, 3), true);  // a4 là ô thật
  assert.equal(onBoard(b, 4, 0), false); // ngoài mép phải
  assert.throws(() => parseSquare(b, 'a1'), /lỗ/);
  assert.equal(b.squares[parseSquare(b, 'd1')], 'B');
});

test('lỗ không bị gộp vào số ô trống khi ghi FEN', () => {
  assert.equal(toFen(parseFen('1x1x/4 w')), '1x1x/4 w - -');
  assert.equal(toFen(parseFen('xx2/k2K w')), 'xx2/k2K w - -');
});

test('FEN có 2 Vua cùng màu thì báo lỗi', () => {
  assert.throws(() => parseFen('K3/4/4/K2k w'), /nhiều hơn 1/);
});
