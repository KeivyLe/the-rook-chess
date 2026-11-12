// =============================================================================
// tools/level-check.js — Các hàm kiểm tra một thế cờ có phải là puzzle tốt không.
// Dùng chung cho generate-levels.js (lọc thế cờ ngẫu nhiên) và verify-levels.js
// (kiểm tra lại toàn bộ levels.json), để hai bên luôn dùng CÙNG một tiêu chuẩn.
//
// Một puzzle "mate in N" đạt chuẩn khi:
//   1. Thế cờ hợp lệ: mỗi bên đúng 1 Vua, KHÔNG bên nào đang bị chiếu
//      (bên phòng thủ bị chiếu khi đến lượt bên kia là thế cờ không thể có;
//      bên tấn công bị chiếu thì puzzle mất tự nhiên), Tốt không đứng ở hàng
//      đầu hoặc hàng cuối của bàn.
//   2. Có chiếu hết trong N nước và KHÔNG có chiếu hết trong ít hơn N nước.
//   3. Nước đầu tiên là duy nhất: chỉ đúng 1 nước đầu còn chiếu hết được
//      trong N nước. Nhờ vậy puzzle có một ý tưởng rõ ràng để người chơi tìm.
// =============================================================================

import { parseFen, make, undo, moveToString, squareName, colorOf, typeOf, rankOf, opponent, EMPTY } from '../src/board.js';
import { legalMoves, inCheck, findKing } from '../src/movegen.js';
import { findMate, isStillWinning } from '../src/solver.js';

// Giá trị quân (GDD mục 3.2), dùng để nhận ra nước hy sinh.
const PIECE_VALUE = { k: 20000, q: 900, r: 500, b: 330, n: 320, p: 100 };

/**
 * Kiểm tra điều kiện 1 (thế cờ hợp lệ). Trả về chuỗi mô tả lỗi, hoặc null nếu hợp lệ.
 */
export function positionProblem(board) {
  for (const color of ['w', 'b']) {
    if (findKing(board, color) === -1) return `thiếu Vua ${color === 'w' ? 'trắng' : 'đen'}`;
  }
  if (inCheck(board, opponent(board.turn))) return 'bên phòng thủ đang bị chiếu dù không đến lượt';
  if (inCheck(board, board.turn)) return 'bên tấn công đang bị chiếu ngay từ đầu';
  for (let sq = 0; sq < board.squares.length; sq++) {
    const p = board.squares[sq];
    if (p !== EMPTY && colorOf(p) && typeOf(p) === 'p') {
      const r = rankOf(board, sq);
      if (r === 0 || r === board.height - 1) return 'có Tốt đứng ở hàng đầu hoặc hàng cuối';
    }
  }
  return null;
}

/**
 * Đếm số nước đầu tiên vẫn còn chiếu hết được trong n nước.
 * Dừng sớm khi đã thấy `limit` nước (mặc định 2), vì chỉ cần biết có duy nhất hay không.
 * Trả về { count, moves } với moves là các nước dạng chuỗi đã tìm thấy.
 */
export function winningFirstMoves(board, n, limit = 2) {
  const found = [];
  for (const m of legalMoves(board)) {
    make(board, m);
    // Sau nước đầu, còn 2n - 2 ply (n - 1 lượt đáp của đối thủ + n - 1 nước của mình).
    const ok = isStillWinning(board, 2 * n - 2);
    undo(board);
    if (ok) {
      found.push(moveToString(board, m));
      if (found.length >= limit) break;
    }
  }
  return { count: found.length, moves: found };
}

/**
 * Điểm độ khó của puzzle (GDD mục 5.1), càng cao càng khó. Gồm:
 *   - số thế cờ bộ giải phải duyệt (lấy log, vì số node tăng theo cấp số nhân),
 *   - nước đầu "yên lặng" (không chiếu, không ăn quân): khó nghĩ ra hơn,
 *   - nước đầu là hy sinh (đối thủ ăn được ngay quân vừa đi, quân đó giá trị hơn Tốt),
 *   - số quân trên bàn và số ô của bàn.
 * Chỉ dùng để SẮP XẾP level trong cùng một chương, không cần chính xác tuyệt đối.
 */
export function difficultyScore(board, result) {
  const first = result.move;
  make(board, first);
  const givesCheck = inCheck(board);
  undo(board);
  const quiet = !givesCheck && first.captured === EMPTY;
  // Hy sinh: nước đáp tốt nhất của đối thủ đi vào đúng ô quân mình vừa đến (tức là ăn nó).
  const reply = result.line[1];
  const sacrifice = reply !== undefined &&
    reply.replace(/[qrbn]$/, '').endsWith(squareName(board, first.to)) &&
    PIECE_VALUE[typeOf(first.piece)] > PIECE_VALUE.p;
  const pieces = board.squares.filter((p) => colorOf(p)).length;
  const cells = board.squares.filter((p) => p !== 'x').length;
  const score = Math.log2(result.nodes + 1) * 10 + (quiet ? 15 : 0) + (sacrifice ? 15 : 0) + pieces * 2 + cells * 0.5;
  return { score: Math.round(score * 10) / 10, quiet, sacrifice };
}

/**
 * Phân tích đầy đủ một thế cờ cho puzzle mate in n.
 * Trả về { ok: false, reason } nếu không đạt, hoặc
 * { ok: true, solution, nodes, difficulty, quiet, sacrifice } nếu đạt.
 * `fen` có thể là chuỗi FEN hoặc đã là đối tượng bàn cờ.
 */
export function analyzePuzzle(fenOrBoard, n) {
  const board = typeof fenOrBoard === 'string' ? parseFen(fenOrBoard) : fenOrBoard;
  const problem = positionProblem(board);
  if (problem) return { ok: false, reason: problem };

  const result = findMate(board, n);
  if (!result) return { ok: false, reason: `không có chiếu hết trong ${n} nước` };
  if (result.mateIn !== n) return { ok: false, reason: `có chiếu hết sớm hơn: mate in ${result.mateIn}` };

  const first = winningFirstMoves(board, n);
  if (first.count !== 1) return { ok: false, reason: `nước đầu không duy nhất: ${first.moves.join(', ')}` };

  const d = difficultyScore(board, result);
  return { ok: true, solution: result.line, nodes: result.nodes, difficulty: d.score, quiet: d.quiet, sacrifice: d.sacrifice };
}
