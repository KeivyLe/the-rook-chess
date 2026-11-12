// =============================================================================
// solver.js — Bộ giải chiếu hết bằng alpha-beta (tài liệu thiết kế mục 4).
//
// Bộ giải làm 4 việc cho game:
//   - findMate     : kiểm tra level (có chiếu hết trong N nước không, nhanh nhất là mấy nước).
//   - isStillWinning: chấm nước người chơi (sau nước đó còn chiếu hết bắt buộc không).
//   - bestDefense  : đối thủ đáp trả (chọn nước kéo dài trận lâu nhất).
//   - bestHint     : gợi ý (nước đầu tiên của chuỗi chiếu hết nhanh nhất).
//
// THUẬT NGỮ
//   - Bên tấn công (attacker): bên phải chiếu hết. Đó là bên đi trước trong
//     level, có thể là Trắng hoặc Đen. Bên còn lại là bên phòng thủ.
//   - Ply (nửa nước): một lần đi của MỘT bên. "Chiếu hết trong N nước" nghĩa
//     là bên tấn công đi N lần, xen giữa là N-1 lần đáp của bên phòng thủ,
//     tổng cộng 2N-1 ply. Mate in 4 = 7 ply.
//
// CÁCH CHẤM ĐIỂM (luôn nhìn từ phía bên tấn công)
//   - Bên phòng thủ bị chiếu hết khi còn `depth` ply chưa dùng: điểm = MATE + depth.
//     Chiếu hết càng sớm thì còn thừa càng nhiều ply, điểm càng cao, nên bên
//     tấn công tự ưu tiên chiếu hết nhanh, bên phòng thủ tự chọn kéo dài.
//   - Bên tấn công bị chiếu hết (phản đòn): điểm = -(MATE + depth).
//   - Hết ply mà chưa chiếu hết, hoặc hòa pat: điểm = 0.
//   Puzzle chỉ cần biết "có chiếu hết hay không, sau mấy nước", nên không cần
//   hàm đánh giá thế cờ phức tạp như máy chơi cờ.
//
// MINIMAX VÀ ALPHA-BETA
//   Minimax: bên tấn công (MAX) chọn nước điểm cao nhất, bên phòng thủ (MIN)
//   chọn nước điểm thấp nhất. Alpha-beta là minimax có cắt tỉa: giữ hai mốc
//     alpha = điểm MAX chắc chắn đạt được, beta = điểm MIN chắc chắn giữ được.
//   Khi alpha >= beta thì nhánh đang xét không thể ảnh hưởng kết quả, bỏ qua
//   các nước còn lại của nhánh đó. Kết quả luôn giống hệt minimax, chỉ nhanh hơn.
//
// BẢNG BĂM (transposition table, TT)
//   Cùng một thế cờ có thể đến bằng nhiều thứ tự nước khác nhau (ví dụ Xe đi
//   trước rồi Vua, hay Vua trước rồi Xe). TT nhớ kết quả đã tính của từng thế
//   cờ để không phải tính lại. Khoá là "ảnh chụp" thế cờ + số ply còn lại.
//   Vì alpha-beta có cắt tỉa, điểm lưu có thể chỉ là cận (bound), nên mỗi mục
//   ghi kèm loại: EXACT (đúng), LOWER (điểm thật >= số này), UPPER (điểm thật <= số này).
//   TT cũng nhớ nước tốt nhất của thế cờ để lần sau xét nước đó trước (cắt tỉa sớm hơn).
// =============================================================================

import { make, undo, opponent, moveToString, EMPTY } from './board.js';
import { legalMoves, inCheck } from './movegen.js';

/** Điểm gốc của chiếu hết. Lớn hơn hẳn mọi độ sâu có thể có. */
export const MATE = 100000;

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

/**
 * Tạo "ngữ cảnh tìm kiếm" cho một lần gọi hàm công khai:
 *   attacker: bên tấn công ('w' hoặc 'b'),
 *   tt      : bảng băm (Map từ khoá thế cờ sang kết quả),
 *   nodes   : đếm số thế cờ đã duyệt (dùng để chấm độ khó level, GDD mục 5.1).
 * Mỗi lần gọi tạo ngữ cảnh mới, nên TT không bao giờ dùng nhầm kết quả của
 * bên tấn công khác.
 */
function createContext(attacker) {
  return { attacker, tt: new Map(), nodes: 0 };
}

/**
 * Khoá của thế cờ cho bảng băm: mọi ô + lượt đi + quyền nhập thành + ô bắt tốt
 * qua đường. Hai thế cờ có cùng khoá thì có cùng các nước đi hợp lệ về sau.
 */
function positionKey(board) {
  const c = board.castling;
  return board.squares.join('') + board.turn +
    (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '') + board.ep;
}

/**
 * Sắp xếp nước đi để alpha-beta cắt tỉa sớm: nước tốt nhất đã biết (từ TT)
 * đứng đầu, sau đó là nước chiếu, rồi nước ăn quân, cuối cùng là các nước còn lại.
 * Sắp xếp KHÔNG làm thay đổi kết quả, chỉ làm tìm kiếm nhanh hơn.
 */
function orderMoves(board, moves, ttBest) {
  const score = (m) => {
    if (ttBest && m.from === ttBest.from && m.to === ttBest.to && m.promotion === ttBest.promotion) return 3;
    make(board, m);
    const check = inCheck(board);
    undo(board);
    if (check) return 2;
    return m.captured !== EMPTY ? 1 : 0;
  };
  const scored = moves.map((m) => ({ m, s: score(m) }));
  scored.sort((a, b) => b.s - a.s); // sort của JS ổn định: cùng điểm thì giữ thứ tự cũ
  return scored.map((x) => x.m);
}

/**
 * Lõi alpha-beta. Trả về điểm của thế cờ hiện tại (nhìn từ bên tấn công)
 * khi còn `depth` ply được phép đi.
 *
 * Các bước:
 *   1. Hết ply (depth <= 0): chỉ cần biết bên đang đi có bị chiếu hết không.
 *      Không bị chiếu thì chắc chắn không phải chiếu hết, trả 0 luôn mà không
 *      cần sinh nước (tiết kiệm nhiều thời gian vì đây là tầng đông nhất).
 *   2. Không còn nước hợp lệ: bị chiếu là chiếu hết, không bị chiếu là hòa pat.
 *   3. Tra bảng băm: đã có kết quả cùng thế cờ, cùng depth thì dùng lại.
 *   4. Duyệt từng nước (đã sắp xếp), đệ quy với depth - 1, cập nhật alpha/beta,
 *      cắt tỉa khi alpha >= beta.
 *   5. Lưu kết quả vào bảng băm.
 */
function alphabeta(ctx, board, depth, alpha, beta) {
  ctx.nodes++;
  const attackerToMove = board.turn === ctx.attacker;

  // Bước 1. (Dùng <= 0 để an toàn: lỡ được gọi với số ply âm thì coi như đã hết lượt.)
  if (depth <= 0) {
    if (!inCheck(board)) return 0;
    if (legalMoves(board).length > 0) return 0;
    return attackerToMove ? -MATE : MATE;
  }

  // Bước 2.
  const moves = legalMoves(board);
  if (moves.length === 0) {
    if (!inCheck(board)) return 0; // hòa pat
    return attackerToMove ? -(MATE + depth) : MATE + depth;
  }

  // Bước 3.
  const key = positionKey(board) + '|' + depth;
  const entry = ctx.tt.get(key);
  if (entry) {
    if (entry.flag === EXACT) return entry.score;
    if (entry.flag === LOWER && entry.score >= beta) return entry.score;
    if (entry.flag === UPPER && entry.score <= alpha) return entry.score;
  }

  // Bước 4.
  const alphaStart = alpha;
  const betaStart = beta;
  let best = attackerToMove ? -Infinity : Infinity;
  let bestMove = null;
  for (const m of orderMoves(board, moves, entry?.bestMove)) {
    make(board, m);
    const s = alphabeta(ctx, board, depth - 1, alpha, beta);
    undo(board);
    if (attackerToMove) {
      if (s > best) { best = s; bestMove = m; }
      alpha = Math.max(alpha, best);
    } else {
      if (s < best) { best = s; bestMove = m; }
      beta = Math.min(beta, best);
    }
    if (alpha >= beta) break; // cắt tỉa
  }

  // Bước 5. Điểm <= alpha ban đầu: chỉ biết điểm thật không cao hơn (UPPER).
  // Điểm >= beta ban đầu: chỉ biết điểm thật không thấp hơn (LOWER).
  let flag = EXACT;
  if (best <= alphaStart) flag = UPPER;
  else if (best >= betaStart) flag = LOWER;
  ctx.tt.set(key, { score: best, flag, bestMove });
  return best;
}

/**
 * Đổi điểm thành số ply từ lúc bắt đầu tìm tới khi chiếu hết.
 * Ví dụ: tìm với 3 ply, chiếu hết khi còn thừa 0 ply → điểm MATE + 0 → 3 ply.
 */
function matePlies(score, depth) {
  return depth - (Math.abs(score) - MATE);
}

/**
 * Chấm điểm TỪNG nước hợp lệ của bên đang đi, với `depth` ply còn lại
 * (tính cả chính nước đó). Dùng chung cho bestHint và bestDefense.
 * Mỗi nước được tìm với cửa sổ đầy đủ (-∞, +∞) để có điểm chính xác,
 * nhờ vậy so sánh được các nước bằng điểm nhau.
 */
function scoreRootMoves(ctx, board, depth) {
  return legalMoves(board).map((move) => {
    make(board, move);
    const score = alphabeta(ctx, board, depth - 1, -Infinity, Infinity);
    undo(board);
    return { move, score };
  });
}

/**
 * GỢI Ý: bên đang đi là bên tấn công, tìm nước đầu tiên của chuỗi chiếu hết
 * nhanh nhất trong `pliesLeft` ply (tính cả nước này).
 * Ví dụ đầu level "mate in 2": bestHint(board, 3). Sau khi đã đi đúng 1 nước
 * và đối thủ đáp lại: bestHint(board, 1). Nhờ vậy gợi ý luôn tính từ thế cờ
 * HIỆN TẠI (sửa lỗi UX của bản gốc, GDD mục 7.4).
 * Trả về nước đi, hoặc null nếu không còn chiếu hết được.
 * Có nhiều nước cùng nhanh nhất thì trả nước đầu tiên (gợi ý ổn định, không đổi qua lại).
 */
export function bestHint(board, pliesLeft) {
  const ctx = createContext(board.turn);
  let best = null;
  for (const r of scoreRootMoves(ctx, board, pliesLeft)) {
    if (r.score > 0 && (!best || r.score > best.score)) best = r;
  }
  return best ? best.move : null;
}

/**
 * ĐỐI THỦ ĐÁP TRẢ: bên đang đi là bên phòng thủ. Chọn nước làm bên tấn công
 * khó nhất: nếu có nước thoát hẳn chiếu hết thì chọn nước đó, nếu không thì
 * chọn nước bị chiếu hết MUỘN nhất. Nhiều nước bằng điểm nhau thì chọn ngẫu
 * nhiên, để mỗi lần chơi lại hơi khác (GDD mục 4.4).
 *
 * pliesLeft: số ply còn lại tính cả nước đáp này. Ví dụ mate in 2, người chơi
 * vừa đi nước 1 → bestDefense(board, 2).
 * random: hàm trả số trong [0, 1), mặc định Math.random; test truyền hàm cố định.
 * Trả về null nếu bên phòng thủ không còn nước nào (đã bị chiếu hết hoặc pat).
 */
export function bestDefense(board, pliesLeft, random = Math.random) {
  const ctx = createContext(opponent(board.turn));
  const results = scoreRootMoves(ctx, board, pliesLeft);
  if (results.length === 0) return null;
  const minScore = Math.min(...results.map((r) => r.score));
  const ties = results.filter((r) => r.score === minScore);
  return ties[Math.floor(random() * ties.length)].move;
}

/**
 * CHẤM NƯỚC NGƯỜI CHƠI: người chơi (bên tấn công) vừa đi xong, nên bên đang
 * đến lượt là bên phòng thủ. Hỏi: dù đối thủ đáp thế nào, người chơi vẫn chiếu
 * hết được trong `pliesLeft` ply còn lại không?
 * pliesLeft = 0 nghĩa là hết lượt: chỉ đúng khi thế hiện tại đã là chiếu hết.
 * Ví dụ mate in 2, người chơi vừa đi nước 1 → isStillWinning(board, 2).
 * Nước gây hòa pat sẽ trả false (GDD mục 3.4: pat tính là sai).
 */
export function isStillWinning(board, pliesLeft) {
  const ctx = createContext(opponent(board.turn));
  return alphabeta(ctx, board, pliesLeft, -Infinity, Infinity) > 0;
}

/**
 * KIỂM TRA LEVEL: bên đang đi là bên tấn công, tìm chiếu hết nhanh nhất trong
 * tối đa `n` nước (của bên tấn công).
 *
 * Dùng "tìm sâu dần" (iterative deepening): thử mate in 1, rồi mate in 2, ...
 * đến mate in n. Lần đầu tiên tìm thấy chính là số nước ít nhất, nên phát hiện
 * được level lỗi "có chiếu hết sớm hơn đề bài".
 *
 * Trả về null nếu không có chiếu hết trong n nước, ngược lại trả về:
 *   mateIn: số nước ít nhất để chiếu hết,
 *   move  : nước đầu tiên (đối tượng nước đi),
 *   line  : chuỗi nước dạng "d1a1" của một biến chính, bên phòng thủ đáp
 *           tốt nhất (khi hòa điểm thì lấy nước đầu tiên để kết quả ổn định),
 *   nodes : số thế cờ đã duyệt, dùng để ước lượng độ khó.
 */
export function findMate(board, n) {
  const ctx = createContext(board.turn);
  for (let k = 1; k <= n; k++) {
    const depth = 2 * k - 1;
    const score = alphabeta(ctx, board, depth, -Infinity, Infinity);
    if (score > 0) {
      const mateIn = (matePlies(score, depth) + 1) / 2;
      const line = principalVariation(board, depth);
      return { mateIn, move: line.moves[0], line: line.text, nodes: ctx.nodes };
    }
  }
  return null;
}

/**
 * Dựng một biến chính (chuỗi nước tiêu biểu) để in ra hoặc so với trường
 * `solution` của level: bên tấn công đi theo bestHint, bên phòng thủ đi theo
 * bestDefense (hòa điểm thì lấy nước đầu tiên). Đi xong thì undo hết để trả
 * bàn về như cũ.
 */
function principalVariation(board, depth) {
  const attacker = board.turn;
  const moves = [];
  const text = [];
  for (let left = depth; left > 0; left--) {
    const m = board.turn === attacker ? bestHint(board, left) : bestDefense(board, left, () => 0);
    if (!m) break; // bên phòng thủ đã bị chiếu hết
    text.push(moveToString(board, m));
    moves.push(m);
    make(board, m);
  }
  for (let i = 0; i < moves.length; i++) undo(board);
  return { moves, text };
}
