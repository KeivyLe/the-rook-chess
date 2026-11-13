// =============================================================================
// movegen.js — Sinh nước đi hợp lệ theo luật cờ vua, trên bàn kích thước tùy ý.
//
// Ý tưởng chung (giống tài liệu thiết kế mục 3.3):
//   1. Sinh "nước giả hợp lệ" (pseudo-legal): đi đúng cách đi của quân,
//      nhưng CHƯA kiểm tra Vua mình có bị chiếu sau nước đó không.
//   2. Với từng nước giả hợp lệ: thử đi (make), xem Vua mình có bị tấn công
//      không, rồi lùi lại (undo). Nếu Vua bị tấn công thì loại nước đó.
//   Phần còn lại là nước hợp lệ (legal).
//
// Từ danh sách nước hợp lệ suy ra:
//   - Chiếu hết (checkmate): đang bị chiếu VÀ không còn nước hợp lệ nào.
//   - Hòa pat (stalemate): KHÔNG bị chiếu nhưng cũng không còn nước hợp lệ nào.
//
// Lỗ ('x'): mọi hàm ở đây kiểm tra ô bằng onBoard() trước khi đi vào, mà
// onBoard() trả false tại lỗ, nên quân tự dừng trước lỗ như dừng trước mép bàn.
// =============================================================================

import {
  WHITE, EMPTY, colorOf, typeOf, opponent,
  sqIndex, fileOf, rankOf, onBoard, castlingRookSquare,
  make, undo, moveToString,
} from './board.js';

// Các bước nhảy của Mã: hình chữ L (2 ô một hướng + 1 ô hướng vuông góc).
const KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
// Các bước của Vua: 1 ô theo 8 hướng.
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
// Hướng trượt của Xe: theo hàng và cột.
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Hướng trượt của Tượng: theo 4 đường chéo.
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
// Các quân mà Tốt được phép phong thành.
const PROMOTION_PIECES = ['q', 'r', 'b', 'n'];

/**
 * Tạo đối tượng nước đi. Ghi lại cả quân đi và quân bị ăn để make/undo
 * không phải đoán. Xem mô tả các trường ở hàm make() trong board.js.
 */
function createMove(board, from, to, extra = {}) {
  return {
    from,
    to,
    piece: board.squares[from],
    captured: board.squares[to],
    ...extra,
  };
}

/**
 * Kiểm tra ô `sq` có đang bị bên `byColor` tấn công không.
 *
 * Thay vì sinh nước của mọi quân đối phương (chậm), ta đứng tại ô `sq`
 * và "nhìn ngược ra": nếu đứng ở đây đi kiểu Mã mà gặp Mã địch, thì Mã đó
 * đang tấn công ô này; tương tự cho Vua, Tốt, và các quân trượt.
 *
 * Hàm này dùng cho 2 việc: xem Vua có bị chiếu không, và xem Vua có đi
 * qua ô bị tấn công khi nhập thành không.
 */
export function isSquareAttacked(board, sq, byColor) {
  const f = fileOf(board, sq);
  const r = rankOf(board, sq);
  const isEnemy = (piece, type) => piece !== EMPTY && colorOf(piece) === byColor && typeOf(piece) === type;
  const at = (ff, rr) => board.squares[sqIndex(board, ff, rr)];

  // Mã.
  for (const [df, dr] of KNIGHT_STEPS) {
    const ff = f + df, rr = r + dr;
    if (onBoard(board, ff, rr) && isEnemy(at(ff, rr), 'n')) return true;
  }

  // Vua (hai Vua không được đứng cạnh nhau, nên ô cạnh Vua địch là ô bị tấn công).
  for (const [df, dr] of KING_STEPS) {
    const ff = f + df, rr = r + dr;
    if (onBoard(board, ff, rr) && isEnemy(at(ff, rr), 'k')) return true;
  }

  // Tốt: Tốt trắng ăn chéo LÊN, nên Tốt trắng tấn công ô sq nếu nó đứng ở
  // hàng ngay DƯỚI sq, lệch 1 cột. Tốt đen thì ngược lại.
  const pawnRank = byColor === WHITE ? r - 1 : r + 1;
  for (const df of [-1, 1]) {
    const ff = f + df;
    if (onBoard(board, ff, pawnRank) && isEnemy(at(ff, pawnRank), 'p')) return true;
  }

  // Quân trượt: đi dọc mỗi hướng tới khi gặp quân đầu tiên hoặc mép bàn.
  // Quân đầu tiên gặp được là Xe/Hậu (hướng thẳng) hoặc Tượng/Hậu (hướng chéo)
  // của địch thì ô bị tấn công. Quân nào khác thì đã chắn đường.
  const slidersHit = (dirs, types) => {
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (onBoard(board, ff, rr)) {
        const p = at(ff, rr);
        if (p !== EMPTY) {
          if (colorOf(p) === byColor && types.includes(typeOf(p))) return true;
          break;
        }
        ff += df; rr += dr;
      }
    }
    return false;
  };
  if (slidersHit(ROOK_DIRS, ['r', 'q'])) return true;
  if (slidersHit(BISHOP_DIRS, ['b', 'q'])) return true;

  return false;
}

/**
 * Tìm ô của Vua bên `color`. Trả về -1 nếu bên đó không có Vua
 * (có thể xảy ra với thế cờ puzzle dựng tay; khi đó coi như không bao giờ bị chiếu).
 */
export function findKing(board, color) {
  const king = color === WHITE ? 'K' : 'k';
  return board.squares.indexOf(king);
}

/**
 * Bên `color` (mặc định là bên đang đến lượt) có đang bị chiếu không?
 * = Vua bên đó đang đứng trên ô bị đối phương tấn công.
 */
export function inCheck(board, color = board.turn) {
  const k = findKing(board, color);
  return k !== -1 && isSquareAttacked(board, k, opponent(color));
}

/**
 * Sinh nước đi của Tốt đứng ở ô `from`, thêm vào mảng `moves`.
 *   - Tiến 1 ô nếu ô trước mặt trống.
 *   - Tiến 2 ô nếu level cho phép (board.pawnDoubleStep), Tốt đang ở hàng
 *     xuất phát và cả 2 ô phía trước đều trống.
 *   - Ăn chéo 1 ô nếu có quân địch, hoặc nếu đó là ô bắt tốt qua đường.
 *   - Tới hàng cuối thì sinh 4 nước, mỗi nước phong cấp một loại quân
 *     (Hậu, Xe, Tượng, Mã): nhiều puzzle cần phong cấp Mã để chiếu hết.
 */
function addPawnMoves(board, from, color, moves) {
  const f = fileOf(board, from);
  const r = rankOf(board, from);
  const dir = color === WHITE ? 1 : -1;                     // Trắng đi lên, Đen đi xuống.
  const startRank = color === WHITE ? 1 : board.height - 2; // Hàng xuất phát của Tốt.
  const lastRank = color === WHITE ? board.height - 1 : 0;  // Hàng phong cấp.

  // Thêm một nước Tốt; nếu ô đến là hàng cuối thì tách thành 4 nước phong cấp.
  const push = (to, extra = {}) => {
    if (rankOf(board, to) === lastRank) {
      for (const promotion of PROMOTION_PIECES) moves.push(createMove(board, from, to, { ...extra, promotion }));
    } else {
      moves.push(createMove(board, from, to, extra));
    }
  };

  // Tiến thẳng.
  const r1 = r + dir;
  if (onBoard(board, f, r1) && board.squares[sqIndex(board, f, r1)] === EMPTY) {
    push(sqIndex(board, f, r1));
    const r2 = r + 2 * dir;
    if (board.pawnDoubleStep && r === startRank && onBoard(board, f, r2) && r2 !== lastRank &&
        board.squares[sqIndex(board, f, r2)] === EMPTY) {
      moves.push(createMove(board, from, sqIndex(board, f, r2), { flag: 'double' }));
    }
  }

  // Ăn chéo (kể cả bắt tốt qua đường).
  for (const df of [-1, 1]) {
    const ff = f + df;
    if (!onBoard(board, ff, r1)) continue;
    const to = sqIndex(board, ff, r1);
    const target = board.squares[to];
    if (target !== EMPTY && colorOf(target) !== color) {
      push(to);
    } else if (to === board.ep) {
      // Ô đến trống, quân bị ăn là Tốt địch đứng cạnh (cùng hàng với Tốt mình).
      const capturedPawn = board.squares[sqIndex(board, ff, r)];
      moves.push(createMove(board, from, to, { flag: 'ep', captured: capturedPawn }));
    }
  }
}

/**
 * Sinh nước của quân "nhảy" (Mã, Vua): thử từng bước trong `steps`,
 * được đi nếu ô đến nằm trong bàn và không có quân mình.
 */
function addStepMoves(board, from, color, steps, moves) {
  const f = fileOf(board, from);
  const r = rankOf(board, from);
  for (const [df, dr] of steps) {
    const ff = f + df, rr = r + dr;
    if (!onBoard(board, ff, rr)) continue;
    const to = sqIndex(board, ff, rr);
    const target = board.squares[to];
    if (target === EMPTY || colorOf(target) !== color) moves.push(createMove(board, from, to));
  }
}

/**
 * Sinh nước của quân trượt (Xe, Tượng, Hậu): theo mỗi hướng trong `dirs`,
 * đi từng ô một cho tới khi gặp mép bàn hoặc gặp quân.
 * Gặp quân địch thì được ăn rồi dừng; gặp quân mình thì dừng ngay trước nó.
 */
function addSlideMoves(board, from, color, dirs, moves) {
  const f = fileOf(board, from);
  const r = rankOf(board, from);
  for (const [df, dr] of dirs) {
    let ff = f + df, rr = r + dr;
    while (onBoard(board, ff, rr)) {
      const to = sqIndex(board, ff, rr);
      const target = board.squares[to];
      if (target === EMPTY) {
        moves.push(createMove(board, from, to));
      } else {
        if (colorOf(target) !== color) moves.push(createMove(board, from, to));
        break;
      }
      ff += df; rr += dr;
    }
  }
}

/**
 * Sinh nước nhập thành cho Vua ở ô `from` (nếu bên đó còn quyền).
 *
 * Cách làm tổng quát cho mọi độ rộng bàn: Vua đi 2 ô về phía Xe ở góc,
 * Xe nhảy qua đứng sát bên kia Vua. Trên bàn 8×8 chuẩn thì đúng là
 * e1-g1 (cánh Vua) và e1-c1 (cánh Hậu).
 *
 * Điều kiện:
 *   - Còn quyền nhập thành (ghi trong FEN), Vua đứng ở hàng xuất phát,
 *     Xe cùng màu vẫn ở ô góc.
 *   - Mọi ô giữa Vua và Xe đều trống.
 *   - Vua không đang bị chiếu, không đi qua và không đứng vào ô bị tấn công.
 *     (Ô đứng vào sẽ được kiểm tra lại ở bước lọc nước hợp lệ, nhưng kiểm tra
 *     luôn ở đây cũng không sai.)
 */
function addCastlingMoves(board, from, color, moves) {
  const homeRank = color === WHITE ? 0 : board.height - 1;
  if (rankOf(board, from) !== homeRank) return;
  const enemy = opponent(color);
  if (isSquareAttacked(board, from, enemy)) return; // Đang bị chiếu thì không được nhập thành.

  const kf = fileOf(board, from);
  for (const side of ['K', 'Q']) {
    const right = color === WHITE ? side : side.toLowerCase();
    if (!board.castling[right]) continue;

    const rookSq = castlingRookSquare(board, color, side);
    const rook = color === WHITE ? 'R' : 'r';
    if (board.squares[rookSq] !== rook) continue;

    const step = side === 'K' ? 1 : -1;
    const rf = fileOf(board, rookSq);
    const kingTo = kf + 2 * step;
    // Ô Vua đến phải nằm giữa Vua và Xe (không trùng hay vượt quá ô của Xe).
    if (step === 1 ? kingTo >= rf : kingTo <= rf) continue;

    // Mọi ô giữa Vua và Xe phải trống.
    let clear = true;
    for (let ff = kf + step; ff !== rf; ff += step) {
      if (board.squares[sqIndex(board, ff, homeRank)] !== EMPTY) { clear = false; break; }
    }
    if (!clear) continue;

    // Vua không được đi qua hoặc đứng vào ô bị tấn công.
    if (isSquareAttacked(board, sqIndex(board, kf + step, homeRank), enemy)) continue;
    if (isSquareAttacked(board, sqIndex(board, kingTo, homeRank), enemy)) continue;

    moves.push(createMove(board, from, sqIndex(board, kingTo, homeRank), {
      flag: side === 'K' ? 'castleK' : 'castleQ',
    }));
  }
}

/**
 * Sinh tất cả nước "giả hợp lệ" của bên đang đến lượt: đúng cách đi của
 * từng quân, nhưng chưa loại các nước khiến Vua mình bị chiếu.
 * Duyệt từng ô trên bàn, gặp quân của bên đang đi thì gọi hàm sinh nước
 * tương ứng với loại quân đó.
 */
export function pseudoLegalMoves(board) {
  const color = board.turn;
  const moves = [];
  for (let sq = 0; sq < board.squares.length; sq++) {
    const piece = board.squares[sq];
    if (piece === EMPTY || colorOf(piece) !== color) continue;
    switch (typeOf(piece)) {
      case 'p': addPawnMoves(board, sq, color, moves); break;
      case 'n': addStepMoves(board, sq, color, KNIGHT_STEPS, moves); break;
      case 'b': addSlideMoves(board, sq, color, BISHOP_DIRS, moves); break;
      case 'r': addSlideMoves(board, sq, color, ROOK_DIRS, moves); break;
      case 'q': addSlideMoves(board, sq, color, [...ROOK_DIRS, ...BISHOP_DIRS], moves); break;
      case 'k':
        addStepMoves(board, sq, color, KING_STEPS, moves);
        addCastlingMoves(board, sq, color, moves);
        break;
    }
  }
  return moves;
}

/**
 * Sinh tất cả nước HỢP LỆ của bên đang đến lượt.
 * Với mỗi nước giả hợp lệ: thử đi, nếu sau đó Vua của bên vừa đi bị tấn công
 * (tự để Vua bị chiếu, hoặc không thoát chiếu) thì loại; cuối cùng lùi lại.
 */
export function legalMoves(board) {
  const color = board.turn;
  const result = [];
  for (const m of pseudoLegalMoves(board)) {
    make(board, m);
    if (!inCheck(board, color)) result.push(m);
    undo(board);
  }
  return result;
}

/**
 * Bên đang đến lượt có bị chiếu hết không?
 * = đang bị chiếu và không còn nước hợp lệ nào để thoát.
 */
export function isCheckmate(board) {
  return inCheck(board) && legalMoves(board).length === 0;
}

/**
 * Bên đang đến lượt có bị hòa pat không?
 * = KHÔNG bị chiếu nhưng không có nước hợp lệ nào. Trong puzzle, gây hòa pat
 * bị tính là đi sai (tài liệu thiết kế mục 3.4).
 */
export function isStalemate(board) {
  return !inCheck(board) && legalMoves(board).length === 0;
}

/**
 * Tìm nước hợp lệ ứng với chuỗi như "d1a1" hoặc "a7a8n".
 * Trả về đối tượng nước đi để đưa vào make(), hoặc null nếu nước đó không hợp lệ.
 * Dùng để đọc trường "solution" của level, hoặc nước người chơi chọn trên giao diện.
 * Nếu là nước phong cấp mà không ghi quân thì mặc định phong Hậu.
 */
export function findMove(board, text) {
  const moves = legalMoves(board);
  const exact = moves.find((m) => moveToString(board, m) === text);
  if (exact) return exact;
  return moves.find((m) => m.promotion === 'q' && moveToString(board, m) === text + 'q') ?? null;
}

/**
 * Perft ("performance test"): đếm số chuỗi nước đi hợp lệ có độ dài `depth`.
 * depth = 1 là số nước hợp lệ hiện tại; depth = 2 là tổng số cặp (nước mình,
 * nước đáp lại); v.v. Đây là cách chuẩn để kiểm tra bộ sinh nước: so kết quả
 * với con số đã biết (đếm tay hoặc từ tài liệu cờ vua) là phát hiện được lỗi.
 */
export function perft(board, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(board);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) {
    make(board, m);
    total += perft(board, depth - 1);
    undo(board);
  }
  return total;
}
