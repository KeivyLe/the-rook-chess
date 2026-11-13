// =============================================================================
// puzzle.js — Điều khiển MỘT level: đếm nước, chấm đúng/sai, gọi đối thủ,
// undo, gợi ý, báo thắng (tài liệu thiết kế mục 2, 3.4 và 8.2).
//
// MÁY TRẠNG THÁI (GDD mục 8.2)
//
//   PLAYER_TURN ──playerMove()──► CHECKING ──┬─► WON            (chiếu hết)
//        ▲                                    ├─► WRONG_MOVE     (sai)
//        │                                    └─► OPPONENT_TURN  (đúng, chưa xong)
//        ├────────────── retry() ◄─────────── WRONG_MOVE
//        └────────────── opponentMove() ◄──── OPPONENT_TURN
//
//   - CHECKING chỉ tồn tại bên trong playerMove(): gọi isStillWinning() rồi
//     chuyển ngay sang trạng thái kết quả.
//   - WRONG_MOVE: bàn VẪN đang hiện nước sai để giao diện rung bàn và cho quân
//     trượt về; giao diện gọi retry() để lùi nước và quay lại PLAYER_TURN.
//   - OPPONENT_TURN: giao diện chờ khoảng 400 ms cho người chơi nhìn rồi gọi
//     opponentMove().
//   - ANIMATING (khoá thao tác khi quân đang trượt) là việc của giao diện, không
//     nằm ở đây: file này không biết gì về thời gian, DOM hay hình ảnh.
//   Gọi một hàm ở sai trạng thái (ví dụ playerMove khi đang OPPONENT_TURN) sẽ
//   báo lỗi, để lỗi lập trình ở giao diện lộ ra ngay.
//
// CHẤM ĐÚNG/SAI (GDD mục 3.4)
//   Không so với một đáp án cố định: nước nào mà SAU ĐÓ vẫn còn chiếu hết bắt
//   buộc trong số nước còn lại thì đều đúng. Gây hòa pat hoặc làm mất chiếu
//   hết là sai; sai thì lùi lại, thử lại không giới hạn, không bị phạt.
// =============================================================================

import { parseFen, make, undo, moveToString, squareName } from './board.js';
import { legalMoves, findMove, isCheckmate, isStalemate } from './movegen.js';
import { isStillWinning, bestDefense, bestHint, findMate } from './solver.js';

export const PLAYER_TURN = 'PLAYER_TURN';
export const OPPONENT_TURN = 'OPPONENT_TURN';
export const WRONG_MOVE = 'WRONG_MOVE';
export const WON = 'WON';

/**
 * Bắt đầu một level. `level` là một bản ghi trong levels.json
 * ({ id, width, height, fen, mateIn, ... }).
 * options.random: hàm số ngẫu nhiên cho đối thủ chọn giữa các nước bằng điểm
 * (mặc định Math.random; test truyền hàm cố định).
 *
 * Đối tượng puzzle gồm:
 *   level, board, state,
 *   movesLeft  : số nước NGƯỜI CHƠI còn được đi (bắt đầu bằng mateIn),
 *   moves      : các nước đã đi (cả hai bên), dạng chuỗi, để hiện lịch sử / xem lại,
 *   wrongMoves : số lần đi sai, hintsUsed: số lần dùng gợi ý (tính cả mọi mức),
 *   lastWrong  : thông tin nước sai gần nhất (để giao diện hiện lý do).
 */
export function createPuzzle(level, options = {}) {
  const board = parseFen(level.fen, { width: level.width, height: level.height });
  return {
    level,
    board,
    startFen: level.fen,
    state: PLAYER_TURN,
    movesLeft: level.mateIn,
    moves: [],
    wrongMoves: 0,
    hintsUsed: 0,
    lastWrong: null,
    random: options.random ?? Math.random,
  };
}

/** Báo lỗi nếu puzzle không ở trạng thái `expected`. */
function requireState(puzzle, expected, action) {
  if (puzzle.state !== expected) {
    throw new Error(`Không thể ${action} khi đang ở trạng thái ${puzzle.state} (cần ${expected})`);
  }
}

/**
 * Số ply còn lại tính cả nước người chơi SẮP đi: n nước của mình còn lại thì
 * là 2n - 1 ply (n nước mình xen n - 1 nước đáp của đối thủ).
 */
function pliesForPlayer(puzzle) {
  return 2 * puzzle.movesLeft - 1;
}

/**
 * Các ô mà quân ở ô `from` đi tới được (để giao diện vẽ chấm tròn, GDD mục 7.2).
 * Trả về mảng { to, capture, promotion } — mỗi ô chỉ một lần, kể cả khi nước
 * đó có 4 lựa chọn phong cấp (promotion = true để giao diện biết phải hỏi).
 * Không phải lượt người chơi thì trả mảng rỗng.
 */
export function legalTargets(puzzle, from) {
  if (puzzle.state !== PLAYER_TURN) return [];
  const targets = new Map();
  for (const m of legalMoves(puzzle.board)) {
    if (m.from !== from) continue;
    if (!targets.has(m.to)) targets.set(m.to, { to: m.to, capture: m.captured !== '.', promotion: Boolean(m.promotion) });
  }
  return [...targets.values()];
}

/**
 * Nước từ `from` tới `to` có phải phong cấp không (giao diện cần hiện hộp chọn 4 quân)?
 */
export function needsPromotion(puzzle, from, to) {
  return legalMoves(puzzle.board).some((m) => m.from === from && m.to === to && m.promotion);
}

/**
 * Người chơi đi một nước. `text` là chuỗi như "d1a1" hoặc "a7a8n"
 * (phong cấp mà không ghi quân thì mặc định Hậu).
 *
 * Trả về một trong:
 *   { result: 'illegal' }                      nước không hợp lệ, không có gì thay đổi;
 *   { result: 'win', move }                    chiếu hết → trạng thái WON;
 *   { result: 'wrong', move, reason }          sai → WRONG_MOVE, reason là
 *        'stalemate' (gây hòa pat) hoặc 'no-mate' (không còn chiếu hết kịp);
 *   { result: 'correct', move }                đúng, chưa xong → OPPONENT_TURN.
 * `move` là chuỗi của nước vừa đi.
 */
export function playerMove(puzzle, text) {
  requireState(puzzle, PLAYER_TURN, 'đi quân');
  const m = findMove(puzzle.board, text);
  if (!m) return { result: 'illegal' };

  const board = puzzle.board;
  const moveText = moveToString(board, m);
  make(board, m);

  // CHECKING
  if (isCheckmate(board)) {
    puzzle.moves.push(moveText);
    puzzle.movesLeft--;
    puzzle.state = WON;
    return { result: 'win', move: moveText };
  }
  // Sau nước này, còn 2·(movesLeft − 1) ply: đối thủ đáp, rồi các nước còn lại của mình.
  const pliesLeft = 2 * (puzzle.movesLeft - 1);
  if (!isStillWinning(board, pliesLeft)) {
    puzzle.wrongMoves++;
    puzzle.lastWrong = { move: moveText, reason: isStalemate(board) ? 'stalemate' : 'no-mate' };
    puzzle.state = WRONG_MOVE;
    return { result: 'wrong', ...puzzle.lastWrong };
  }
  puzzle.moves.push(moveText);
  puzzle.movesLeft--;
  puzzle.state = OPPONENT_TURN;
  return { result: 'correct', move: moveText };
}

/**
 * Sau khi giao diện đã hiện nước sai (rung bàn, báo "Chưa đúng, thử lại"):
 * lùi nước sai và quay về lượt người chơi.
 */
export function retry(puzzle) {
  requireState(puzzle, WRONG_MOVE, 'thử lại');
  undo(puzzle.board);
  puzzle.state = PLAYER_TURN;
}

/**
 * Đối thủ đáp trả: chọn nước kéo dài lâu nhất (solver.bestDefense), đi luôn
 * và trả lượt cho người chơi. Trả về chuỗi nước đối thủ vừa đi.
 */
export function opponentMove(puzzle) {
  requireState(puzzle, OPPONENT_TURN, 'cho đối thủ đi');
  const board = puzzle.board;
  // Còn 2·movesLeft ply: nước đáp này + movesLeft nước của người chơi xen giữa.
  const m = bestDefense(board, 2 * puzzle.movesLeft, puzzle.random);
  if (!m) throw new Error('Đối thủ không còn nước đi nhưng chưa bị chiếu hết (lỗi chấm điểm)');
  const text = moveToString(board, m);
  make(board, m);
  puzzle.moves.push(text);
  puzzle.state = PLAYER_TURN;
  return text;
}

/**
 * Nút Undo: lùi lại nước gần nhất của người chơi cùng nước đáp của đối thủ,
 * trả lại cho người chơi một nước. Chỉ dùng ở lượt người chơi. Không còn gì
 * để lùi thì trả false.
 */
export function undoMove(puzzle) {
  requireState(puzzle, PLAYER_TURN, 'undo');
  if (puzzle.moves.length === 0) return false;
  // Ở lượt người chơi thì nước cuối luôn là nước đáp của đối thủ, trước đó là nước của mình.
  for (let i = 0; i < 2; i++) {
    undo(puzzle.board);
    puzzle.moves.pop();
  }
  puzzle.movesLeft++;
  return true;
}

/**
 * Nút Restart: bắt đầu lại level từ đầu. Giữ số lần sai/gợi ý đã dùng
 * (để thưởng "không gợi ý, không đi sai" vẫn công bằng).
 */
export function restart(puzzle) {
  const fresh = createPuzzle(puzzle.level, { random: puzzle.random });
  Object.assign(puzzle, fresh, { wrongMoves: puzzle.wrongMoves, hintsUsed: puzzle.hintsUsed });
}

/**
 * Gợi ý mức `hintLevel`, tính từ thế cờ HIỆN TẠI (không quay về đầu level,
 * sửa lỗi UX của bản gốc ở GDD mục 7.4):
 *   1 → { from }                 tô sáng quân cần đi (tên ô, ví dụ "d1"),
 *   2 → { from, to, move }       hiện nước đi tiếp theo,
 *   3 → { line }                 toàn bộ lời giải còn lại (cả nước đáp của đối thủ).
 * Trừ coin là việc của economy.js: giao diện gọi spendForHint trước, đủ tiền mới gọi hàm này.
 * Chỉ dùng ở lượt người chơi.
 */
export function getHint(puzzle, hintLevel) {
  requireState(puzzle, PLAYER_TURN, 'xem gợi ý');
  if (![1, 2, 3].includes(hintLevel)) throw new Error(`Mức gợi ý không hợp lệ: ${hintLevel} (chỉ có 1, 2, 3)`);
  const board = puzzle.board;
  puzzle.hintsUsed++;
  if (hintLevel === 3) {
    const r = findMate(board, puzzle.movesLeft);
    return { line: r ? r.line : [] };
  }
  const m = bestHint(board, pliesForPlayer(puzzle));
  if (!m) throw new Error('Không tìm được gợi ý (thế cờ không còn chiếu hết)');
  const from = squareName(board, m.from);
  if (hintLevel === 1) return { from };
  return { from, to: squareName(board, m.to), move: moveToString(board, m) };
}

/**
 * Tóm tắt kết quả khi thắng, để tính thưởng (economy.solveReward) và ghi
 * tiến trình (progress.markSolved):
 *   perfect : không đi sai, không dùng gợi ý,
 *   hintUsed: có dùng gợi ý ít nhất một lần.
 */
export function summary(puzzle) {
  return {
    won: puzzle.state === WON,
    perfect: puzzle.wrongMoves === 0 && puzzle.hintsUsed === 0,
    hintUsed: puzzle.hintsUsed > 0,
    wrongMoves: puzzle.wrongMoves,
    moves: [...puzzle.moves],
  };
}
