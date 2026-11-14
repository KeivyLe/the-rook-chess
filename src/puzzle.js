// =============================================================================
// puzzle.js — Điều khiển MỘT level: đếm nước, gọi đối thủ, undo, gợi ý, báo
// thắng (tài liệu thiết kế mục 2, 3.4 và 8.2).
//
// LUẬT CHƠI CỦA BẢN NÀY (yêu cầu của chủ dự án, thay cho "báo sai rồi lùi lại"
// trong GDD mục 3.4): đi sai thì KỆ — không báo sai, không tự lùi nước. Ván cứ
// tiếp tục, đối thủ vẫn đáp trả. Chỉ khi người chơi thật sự chiếu hết mới thắng.
// Người chơi tự Undo để thử lại, bao nhiêu lần cũng được, tới khi thắng.
//
// MÁY TRẠNG THÁI
//
//   PLAYER_TURN ──playerMove()──┬─► WON            (chiếu hết)
//        ▲                      ├─► ENDED          (hết nước / hòa pat)
//        │                      └─► OPPONENT_TURN
//        │                                 │
//        ├────── opponentMove() ◄──────────┤ (đối thủ đáp xong)
//        │                                 └─► ENDED (đối thủ chiếu hết lại / pat)
//        └────── undoMove() ◄──── ENDED hoặc PLAYER_TURN
//
//   - ENDED: ván không thể đi tiếp mà chưa thắng. endReason cho biết vì sao:
//     'out-of-moves' (đã đi đủ N nước mà chưa chiếu hết), 'stalemate' (hòa pat),
//     'lost' (đi lệch tới mức bị đối thủ chiếu hết ngược). Chỉ còn cách Undo.
//   - OPPONENT_TURN: giao diện chờ khoảng 400 ms cho người chơi nhìn rồi gọi
//     opponentMove().
//   - ANIMATING (khoá thao tác khi quân đang trượt) là việc của giao diện, không
//     nằm ở đây: file này không biết gì về thời gian, DOM hay hình ảnh.
//   Gọi một hàm ở sai trạng thái (ví dụ playerMove khi đang OPPONENT_TURN) sẽ
//   báo lỗi, để lỗi lập trình ở giao diện lộ ra ngay.
//
// "CÒN TRÊN ĐƯỜNG THẮNG" (onTrack)
//   Sau mỗi nước của người chơi, bộ giải vẫn âm thầm kiểm tra còn chiếu hết bắt
//   buộc trong số nước còn lại không (isStillWinning). Kết quả KHÔNG đổi luồng
//   chơi; nó chỉ dùng để:
//     - đếm wrongMoves (nước làm mất chiếu hết bắt buộc) cho thưởng "hoàn hảo";
//     - biết gợi ý còn dùng được không (lệch rồi thì không còn nước đúng để gợi ý).
// =============================================================================

import { parseFen, make, undo, moveToString, squareName } from './board.js';
import { legalMoves, findMove, isCheckmate, isStalemate } from './movegen.js';
import { isStillWinning, bestDefense, bestHint, findMate } from './solver.js';

export const PLAYER_TURN = 'PLAYER_TURN';
export const OPPONENT_TURN = 'OPPONENT_TURN';
export const ENDED = 'ENDED';
export const WON = 'WON';

/**
 * Bắt đầu một level. `level` là một bản ghi trong levels.json
 * ({ id, width, height, fen, mateIn, ... }).
 * options.random: hàm số ngẫu nhiên cho đối thủ chọn giữa các nước bằng điểm
 * (mặc định Math.random; test truyền hàm cố định).
 *
 * Đối tượng puzzle gồm:
 *   level, board, state,
 *   attacker   : bên người chơi cầm ('w' hoặc 'b') = bên đi trước,
 *   movesLeft  : số nước NGƯỜI CHƠI còn được đi (bắt đầu bằng mateIn),
 *   moves      : các nước đã đi (cả hai bên), dạng chuỗi, để hiện lịch sử / xem lại,
 *   onTrack    : còn chiếu hết bắt buộc trong số nước còn lại không,
 *   trackHistory: giá trị onTrack trước mỗi nước của người chơi (để Undo trả lại),
 *   endReason  : lý do ENDED ('out-of-moves' | 'stalemate' | 'lost'), hoặc null,
 *   wrongMoves : số nước đã làm mất chiếu hết bắt buộc (kể cả nước sau đó được Undo),
 *   hintsUsed  : số lần dùng gợi ý (tính cả mọi mức).
 */
export function createPuzzle(level, options = {}) {
  const board = parseFen(level.fen, { width: level.width, height: level.height });
  return {
    level,
    board,
    attacker: board.turn,
    state: PLAYER_TURN,
    movesLeft: level.mateIn,
    moves: [],
    onTrack: true,
    trackHistory: [],
    endReason: null,
    wrongMoves: 0,
    hintsUsed: 0,
    random: options.random ?? Math.random,
  };
}

/** Báo lỗi nếu puzzle không ở một trong các trạng thái `expected`. */
function requireState(puzzle, expected, action) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(puzzle.state)) {
    throw new Error(`Không thể ${action} khi đang ở trạng thái ${puzzle.state} (cần ${allowed.join(' hoặc ')})`);
  }
}

/** Chuyển sang ENDED với lý do `reason`. */
function endGame(puzzle, reason) {
  puzzle.state = ENDED;
  puzzle.endReason = reason;
  puzzle.onTrack = false;
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
 * Không có chuyện "báo sai": nước hợp lệ nào cũng được đi. Trả về một trong:
 *   { result: 'illegal' }                    nước không hợp lệ, không có gì thay đổi;
 *   { result: 'win', move }                  chiếu hết → WON;
 *   { result: 'ended', move, reason }        ván dừng → ENDED ('stalemate' hoặc 'out-of-moves');
 *   { result: 'continue', move, onTrack }    chưa xong → OPPONENT_TURN.
 * `move` là chuỗi của nước vừa đi; `onTrack` cho biết còn chiếu hết bắt buộc
 * không (giao diện KHÔNG hiển thị điều này, theo yêu cầu "đi sai thì kệ").
 */
export function playerMove(puzzle, text) {
  requireState(puzzle, PLAYER_TURN, 'đi quân');
  const m = findMove(puzzle.board, text);
  if (!m) return { result: 'illegal' };

  const board = puzzle.board;
  const moveText = moveToString(board, m);
  make(board, m);
  puzzle.moves.push(moveText);
  puzzle.movesLeft--;
  puzzle.trackHistory.push(puzzle.onTrack);

  if (isCheckmate(board)) {
    puzzle.state = WON;
    return { result: 'win', move: moveText };
  }
  if (isStalemate(board)) {
    if (puzzle.onTrack) puzzle.wrongMoves++;
    endGame(puzzle, 'stalemate');
    return { result: 'ended', move: moveText, reason: 'stalemate' };
  }

  // Âm thầm kiểm tra còn chiếu hết bắt buộc không. Sau nước này còn
  // 2·movesLeft ply: đối thủ đáp, rồi movesLeft nước của mình xen nước đáp.
  // Đã lệch từ trước thì khỏi tính (không thể "quay lại" đường thắng khi đối
  // thủ chơi tốt nhất).
  if (puzzle.onTrack) {
    const still = puzzle.movesLeft > 0 && isStillWinning(board, 2 * puzzle.movesLeft);
    if (!still) puzzle.wrongMoves++;
    puzzle.onTrack = still;
  }

  if (puzzle.movesLeft === 0) {
    endGame(puzzle, 'out-of-moves');
    return { result: 'ended', move: moveText, reason: 'out-of-moves' };
  }
  puzzle.state = OPPONENT_TURN;
  return { result: 'continue', move: moveText, onTrack: puzzle.onTrack };
}

/**
 * Đối thủ đáp trả bằng solver.bestDefense: thoát được thì thoát, không thì
 * chọn nước bị chiếu hết muộn nhất; nếu người chơi đi lệch tới mức đối thủ
 * chiếu hết ngược được thì đối thủ cũng làm (vì đó là điểm tốt nhất cho họ).
 * Trả về { move, result: 'continue' } hoặc { move, result: 'ended', reason }
 * với reason 'lost' (người chơi bị chiếu hết) hoặc 'stalemate'.
 */
export function opponentMove(puzzle) {
  requireState(puzzle, OPPONENT_TURN, 'cho đối thủ đi');
  const board = puzzle.board;
  // Còn 2·movesLeft ply: nước đáp này + movesLeft nước của người chơi xen giữa.
  const m = bestDefense(board, 2 * puzzle.movesLeft, puzzle.random);
  if (!m) throw new Error('Đối thủ không còn nước đi nhưng chưa bị chiếu hết hay pat (lỗi luồng chơi)');
  const text = moveToString(board, m);
  make(board, m);
  puzzle.moves.push(text);
  if (isCheckmate(board)) {
    endGame(puzzle, 'lost');
    return { move: text, result: 'ended', reason: 'lost' };
  }
  if (isStalemate(board)) {
    endGame(puzzle, 'stalemate');
    return { move: text, result: 'ended', reason: 'stalemate' };
  }
  puzzle.state = PLAYER_TURN;
  return { move: text, result: 'continue' };
}

/** Có thể bấm Undo lúc này không (đang lượt mình hoặc ván đã dừng, và đã đi ít nhất 1 nước). */
export function canUndo(puzzle) {
  return (puzzle.state === PLAYER_TURN || puzzle.state === ENDED) && puzzle.moves.length > 0;
}

/**
 * Nút Undo: lùi lại nước gần nhất của người chơi (cùng nước đáp của đối thủ,
 * nếu đối thủ đã đáp), trả lại cho người chơi một nước và quay về PLAYER_TURN.
 * Dùng được cả khi ván đã dừng (ENDED). Không còn gì để lùi thì trả false.
 */
export function undoMove(puzzle) {
  requireState(puzzle, [PLAYER_TURN, ENDED], 'undo');
  if (puzzle.moves.length === 0) return false;
  // Nếu tới lượt người chơi thì nước cuối là của đối thủ: lùi nó trước.
  if (puzzle.board.turn === puzzle.attacker) {
    undo(puzzle.board);
    puzzle.moves.pop();
  }
  undo(puzzle.board);
  puzzle.moves.pop();
  puzzle.movesLeft++;
  puzzle.onTrack = puzzle.trackHistory.pop();
  puzzle.state = PLAYER_TURN;
  puzzle.endReason = null;
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
 * Nếu người chơi đã đi lệch (không còn chiếu hết bắt buộc) thì không có nước
 * đúng nào để gợi ý: trả { offTrack: true } và KHÔNG tính là đã dùng gợi ý.
 * Giao diện nên kiểm tra canHint() trước khi trừ coin.
 * Trừ coin là việc của economy.js: giao diện gọi spendForHint trước, đủ tiền mới gọi hàm này.
 * Chỉ dùng ở lượt người chơi.
 */
export function getHint(puzzle, hintLevel) {
  requireState(puzzle, PLAYER_TURN, 'xem gợi ý');
  if (![1, 2, 3].includes(hintLevel)) throw new Error(`Mức gợi ý không hợp lệ: ${hintLevel} (chỉ có 1, 2, 3)`);
  if (!puzzle.onTrack) return { offTrack: true };
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

/** Gợi ý còn dùng được không: đang lượt mình và vẫn còn chiếu hết bắt buộc. */
export function canHint(puzzle) {
  return puzzle.state === PLAYER_TURN && puzzle.onTrack;
}

/**
 * Tóm tắt kết quả khi thắng, để tính thưởng (economy.solveReward) và ghi
 * tiến trình (progress.markSolved):
 *   perfect : chưa từng đi nước làm mất chiếu hết bắt buộc, không dùng gợi ý,
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
