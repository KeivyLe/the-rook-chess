// =============================================================================
// board.js — Lưu trạng thái bàn cờ, đọc/ghi FEN mở rộng, đi quân (make) và
// lùi quân (undo).
//
// File này KHÔNG biết luật đi của quân (việc đó ở movegen.js). Nó chỉ biết:
//   - bàn cờ có width cột × height hàng,
//   - ô nào đang có quân gì,
//   - đến lượt bên nào, quyền nhập thành, ô bắt tốt qua đường,
//   - cách áp dụng một nước đi đã có sẵn lên bàn và cách hoàn tác nó.
//
// Cách đánh số ô (rất quan trọng, mọi file khác đều dùng):
//   - Cột (file) đánh số 0..width-1 từ trái sang phải, tên là a, b, c, ...
//   - Hàng (rank) đánh số 0..height-1 từ DƯỚI lên TRÊN, tên là 1, 2, 3, ...
//     (hàng 0 là phía quân Trắng, giống bàn cờ thật).
//   - Mỗi ô có một chỉ số duy nhất: sq = rank * width + file.
//     Ví dụ bàn 4×4: a1 = 0, d1 = 3, a2 = 4, d4 = 15.
//
// Quân cờ lưu dưới dạng 1 ký tự giống FEN:
//   Chữ HOA = quân Trắng (K Q R B N P), chữ thường = quân Đen (k q r b n p),
//   dấu chấm '.' = ô trống.
// =============================================================================

export const WHITE = 'w';
export const BLACK = 'b';
export const EMPTY = '.';

// Tên cột: a..z. Giới hạn bàn rộng tối đa 26 cột để tên ô luôn là 1 chữ cái.
const FILE_NAMES = 'abcdefghijklmnopqrstuvwxyz';
const PIECE_LETTERS = 'KQRBNPkqrbnp';

/**
 * Cho biết một quân thuộc bên nào.
 * Trả về 'w' nếu là chữ hoa, 'b' nếu là chữ thường, null nếu là ô trống.
 * Ví dụ: colorOf('R') = 'w', colorOf('k') = 'b', colorOf('.') = null.
 */
export function colorOf(piece) {
  if (piece === EMPTY) return null;
  return piece === piece.toUpperCase() ? WHITE : BLACK;
}

/**
 * Trả về loại quân, không phân biệt màu, luôn ở dạng chữ thường.
 * Ví dụ: typeOf('R') = 'r', typeOf('r') = 'r'. Dùng để hỏi "đây có phải Xe không"
 * mà không cần quan tâm Xe trắng hay Xe đen.
 */
export function typeOf(piece) {
  return piece.toLowerCase();
}

/**
 * Trả về bên còn lại: 'w' -> 'b', 'b' -> 'w'.
 */
export function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}

/**
 * Tạo một bàn cờ trống kích thước width × height, lượt Trắng đi,
 * không có quyền nhập thành, không có ô bắt tốt qua đường.
 *
 * Các trường của đối tượng bàn cờ:
 *   width, height  : kích thước bàn.
 *   squares        : mảng width*height ký tự, squares[sq] là quân ở ô sq.
 *   turn           : 'w' hoặc 'b', bên đang đến lượt đi.
 *   castling       : quyền nhập thành {K, Q, k, q} (true = còn quyền).
 *                    K/Q là Trắng nhập thành cánh Vua (phải) / cánh Hậu (trái),
 *                    k/q tương tự cho Đen.
 *   ep             : chỉ số ô có thể bắt tốt qua đường, -1 nếu không có.
 *   pawnDoubleStep : true nếu Tốt được đi 2 ô ở nước đầu (do level quyết định).
 *   history        : ngăn xếp (stack) lưu thông tin để undo() hoàn tác.
 */
export function createBoard(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`Kích thước bàn không hợp lệ: ${width}×${height}`);
  }
  if (width > FILE_NAMES.length) {
    throw new Error(`Bàn rộng tối đa ${FILE_NAMES.length} cột`);
  }
  return {
    width,
    height,
    squares: new Array(width * height).fill(EMPTY),
    turn: WHITE,
    castling: { K: false, Q: false, k: false, q: false },
    ep: -1,
    pawnDoubleStep: false,
    history: [],
  };
}

/**
 * Đổi (cột, hàng) thành chỉ số ô. Ví dụ bàn 4×4: sqIndex(board, 3, 0) = 3 (ô d1).
 */
export function sqIndex(board, file, rank) {
  return rank * board.width + file;
}

/** Lấy số cột (0..width-1) của ô sq. */
export function fileOf(board, sq) {
  return sq % board.width;
}

/** Lấy số hàng (0..height-1) của ô sq. */
export function rankOf(board, sq) {
  return Math.floor(sq / board.width);
}

/** Kiểm tra (cột, hàng) có nằm trong bàn không. Dùng khi sinh nước để không đi ra ngoài mép. */
export function onBoard(board, file, rank) {
  return file >= 0 && file < board.width && rank >= 0 && rank < board.height;
}

/**
 * Đổi chỉ số ô thành tên dễ đọc, ví dụ 3 -> 'd1' trên bàn 4×4.
 * Hàng được đánh số từ 1 nên cộng thêm 1.
 */
export function squareName(board, sq) {
  return FILE_NAMES[fileOf(board, sq)] + String(rankOf(board, sq) + 1);
}

/**
 * Ngược lại với squareName: 'd1' -> 3 (bàn 4×4).
 * Báo lỗi nếu tên ô sai hoặc nằm ngoài bàn.
 */
export function parseSquare(board, name) {
  const m = /^([a-z])(\d+)$/.exec(name);
  if (!m) throw new Error(`Tên ô không hợp lệ: "${name}"`);
  const file = FILE_NAMES.indexOf(m[1]);
  const rank = Number(m[2]) - 1;
  if (!onBoard(board, file, rank)) throw new Error(`Ô ${name} nằm ngoài bàn ${board.width}×${board.height}`);
  return sqIndex(board, file, rank);
}

/**
 * Đọc chuỗi FEN mở rộng và tạo bàn cờ.
 *
 * Định dạng: "<các hàng> [lượt] [nhập thành] [bắt tốt qua đường]"
 *   - <các hàng>: các hàng ngăn bởi '/', viết từ hàng TRÊN CÙNG xuống hàng dưới cùng.
 *     Trong mỗi hàng: chữ cái là quân, số là số ô trống liên tiếp (có thể nhiều
 *     chữ số, ví dụ "10" trên bàn rộng). Số hàng chính là height, số ô trong
 *     một hàng chính là width, mọi hàng phải dài bằng nhau.
 *   - [lượt]: 'w' (Trắng đi) hoặc 'b' (Đen đi). Mặc định 'w'.
 *   - [nhập thành]: tổ hợp các chữ K Q k q, hoặc '-' nếu không có. Mặc định '-'.
 *   - [bắt tốt qua đường]: tên ô đích (ví dụ 'd6') hoặc '-'. Mặc định '-'.
 * Các trường đếm nước (halfmove, fullmove) của FEN chuẩn nếu có thì bỏ qua.
 *
 * Ví dụ: "k3/2K1/4/3R w" là bàn 4×4: Vua đen a4, Vua trắng c3, Xe trắng d1, Trắng đi.
 *
 * options (tùy chọn, thường lấy từ dữ liệu level):
 *   - width, height: nếu có thì kiểm tra FEN có đúng kích thước này không.
 *   - pawnDoubleStep: Tốt được đi 2 ô ở nước đầu hay không.
 *     Mặc định: bật nếu bàn cao từ 8 hàng trở lên (giống cờ vua chuẩn), tắt
 *     với bàn nhỏ, vì trên bàn nhỏ Tốt đi 2 ô có thể nhảy thẳng tới hàng cuối.
 */
export function parseFen(fen, options = {}) {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split('/');
  const height = rows.length;

  // Bước 1: đọc từng hàng thành một mảng ký tự, kiểm tra cùng độ rộng.
  const parsedRows = rows.map((row, i) => {
    const cells = [];
    let j = 0;
    while (j < row.length) {
      const ch = row[j];
      if (ch >= '0' && ch <= '9') {
        // Đọc hết dãy chữ số liền nhau, ví dụ "10" = 10 ô trống.
        let num = '';
        while (j < row.length && row[j] >= '0' && row[j] <= '9') num += row[j++];
        const n = Number(num);
        if (n === 0) throw new Error(`FEN sai: số ô trống bằng 0 ở hàng ${i + 1} (tính từ trên)`);
        for (let k = 0; k < n; k++) cells.push(EMPTY);
      } else if (PIECE_LETTERS.includes(ch)) {
        cells.push(ch);
        j++;
      } else {
        throw new Error(`FEN sai: ký tự "${ch}" không phải quân cờ`);
      }
    }
    return cells;
  });

  const width = parsedRows[0].length;
  parsedRows.forEach((cells, i) => {
    if (cells.length !== width) {
      throw new Error(`FEN sai: hàng ${i + 1} (tính từ trên) có ${cells.length} ô, mong đợi ${width}`);
    }
  });
  if (options.width !== undefined && options.width !== width) {
    throw new Error(`FEN có width ${width}, level ghi ${options.width}`);
  }
  if (options.height !== undefined && options.height !== height) {
    throw new Error(`FEN có height ${height}, level ghi ${options.height}`);
  }

  // Bước 2: đặt quân lên bàn. Hàng đầu tiên trong FEN là hàng trên cùng
  // (rank = height-1), nên phải đảo thứ tự khi ghi vào mảng.
  const board = createBoard(width, height);
  parsedRows.forEach((cells, i) => {
    const rank = height - 1 - i;
    cells.forEach((piece, file) => {
      board.squares[sqIndex(board, file, rank)] = piece;
    });
  });

  // Bước 3: các trường phụ.
  const turn = parts[1] ?? WHITE;
  if (turn !== WHITE && turn !== BLACK) throw new Error(`FEN sai: lượt đi "${turn}" phải là w hoặc b`);
  board.turn = turn;

  const castling = parts[2] ?? '-';
  if (castling !== '-') {
    for (const c of castling) {
      if (!'KQkq'.includes(c)) throw new Error(`FEN sai: quyền nhập thành "${castling}"`);
      board.castling[c] = true;
    }
  }

  const ep = parts[3] ?? '-';
  board.ep = ep === '-' ? -1 : parseSquare(board, ep);

  board.pawnDoubleStep = options.pawnDoubleStep ?? height >= 8;
  return board;
}

/**
 * Ghi bàn cờ ngược lại thành chuỗi FEN mở rộng (dạng đầy đủ 4 trường).
 * Dùng để in ra khi debug, hoặc so sánh trong test: sau make() rồi undo()
 * thì toFen phải giống hệt lúc đầu.
 */
export function toFen(board) {
  const rows = [];
  for (let rank = board.height - 1; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < board.width; file++) {
      const p = board.squares[sqIndex(board, file, rank)];
      if (p === EMPTY) {
        empty++;
      } else {
        if (empty > 0) { row += empty; empty = 0; }
        row += p;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  const castling = ['K', 'Q', 'k', 'q'].filter((c) => board.castling[c]).join('') || '-';
  const ep = board.ep === -1 ? '-' : squareName(board, board.ep);
  return `${rows.join('/')} ${board.turn} ${castling} ${ep}`;
}

/**
 * Đổi một nước đi thành chuỗi dạng "ô đi + ô đến + quân phong cấp",
 * ví dụ "d1a1", hoặc "a7a8n" (Tốt phong cấp thành Mã).
 * Đây cũng là định dạng trường "solution" trong levels.json.
 */
export function moveToString(board, move) {
  return squareName(board, move.from) + squareName(board, move.to) + (move.promotion ?? '');
}

/**
 * Tìm ô góc chứa Xe dùng để nhập thành.
 * side 'K' = cánh Vua (góc phải), 'Q' = cánh Hậu (góc trái).
 * Trắng dùng hàng dưới cùng, Đen dùng hàng trên cùng.
 */
export function castlingRookSquare(board, color, side) {
  const rank = color === WHITE ? 0 : board.height - 1;
  const file = side === 'K' ? board.width - 1 : 0;
  return sqIndex(board, file, rank);
}

/**
 * Thực hiện nước đi `move` lên bàn (thay đổi trực tiếp board).
 *
 * `move` là đối tượng do movegen.js sinh ra, gồm:
 *   from, to   : ô đi, ô đến.
 *   piece      : quân di chuyển.
 *   captured   : quân bị ăn (EMPTY nếu không ăn).
 *   promotion  : 'q' | 'r' | 'b' | 'n' nếu là nước phong cấp, không có thì undefined.
 *   flag       : nước đặc biệt: 'double' (Tốt đi 2 ô), 'ep' (bắt tốt qua đường),
 *                'castleK' / 'castleQ' (nhập thành), hoặc undefined.
 *
 * Trước khi đổi bàn, hàm lưu lại những gì KHÔNG suy ra được từ move
 * (quyền nhập thành, ô bắt tốt qua đường) vào board.history, để undo() trả lại.
 * Hàm không kiểm tra nước đi có hợp lệ không: việc đó là của movegen.js.
 */
export function make(board, move) {
  const { from, to, piece, flag } = move;
  const color = colorOf(piece);

  // 1. Lưu trạng thái cũ để hoàn tác.
  board.history.push({ move, castling: { ...board.castling }, ep: board.ep });

  // 2. Bắt tốt qua đường: quân bị ăn KHÔNG nằm ở ô đến mà nằm ngay sau nó
  //    (cùng cột với ô đến, cùng hàng với ô đi).
  if (flag === 'ep') {
    board.squares[sqIndex(board, fileOf(board, to), rankOf(board, from))] = EMPTY;
  }

  // 3. Di chuyển quân. Nếu phong cấp thì đặt quân mới (đúng màu) thay cho Tốt.
  let placed = piece;
  if (move.promotion) {
    placed = color === WHITE ? move.promotion.toUpperCase() : move.promotion.toLowerCase();
  }
  board.squares[to] = placed;
  board.squares[from] = EMPTY;

  // 4. Nhập thành: Vua đã đi 2 ô ở bước 3, giờ đưa Xe từ góc sang ô
  //    mà Vua vừa đi qua (ngay cạnh Vua, phía trong).
  if (flag === 'castleK' || flag === 'castleQ') {
    const side = flag === 'castleK' ? 'K' : 'Q';
    const rookFrom = castlingRookSquare(board, color, side);
    const rookTo = side === 'K' ? to - 1 : to + 1;
    board.squares[rookTo] = board.squares[rookFrom];
    board.squares[rookFrom] = EMPTY;
  }

  // 5. Ô bắt tốt qua đường chỉ tồn tại ngay sau nước Tốt đi 2 ô:
  //    đó là ô ở giữa ô đi và ô đến.
  board.ep = flag === 'double' ? (from + to) / 2 : -1;

  // 6. Cập nhật quyền nhập thành:
  //    - Vua đã đi thì mất cả hai quyền của bên đó.
  //    - Có quân rời khỏi hoặc bị ăn tại ô góc thì mất quyền nhập thành phía đó.
  if (typeOf(piece) === 'k') {
    if (color === WHITE) { board.castling.K = false; board.castling.Q = false; }
    else { board.castling.k = false; board.castling.q = false; }
  }
  for (const [right, c, side] of [['K', WHITE, 'K'], ['Q', WHITE, 'Q'], ['k', BLACK, 'K'], ['q', BLACK, 'Q']]) {
    const corner = castlingRookSquare(board, c, side);
    if (from === corner || to === corner) board.castling[right] = false;
  }

  // 7. Đổi lượt.
  board.turn = opponent(board.turn);
}

/**
 * Hoàn tác nước đi gần nhất (lấy ra từ đỉnh board.history).
 * Làm ngược lại từng bước của make(): đưa quân về ô cũ, trả lại quân bị ăn,
 * đưa Xe về góc nếu là nhập thành, khôi phục quyền nhập thành, ô bắt tốt
 * qua đường và lượt đi.
 *
 * Tham số thứ hai (move) không bắt buộc, chỉ để viết được undo(board, m)
 * giống pseudocode trong tài liệu thiết kế; hàm luôn hoàn tác nước cuối cùng.
 * Trả về nước vừa được hoàn tác.
 */
export function undo(board, _move) {
  const entry = board.history.pop();
  if (!entry) throw new Error('Không còn nước nào để undo');
  const { move } = entry;
  const { from, to, piece, captured, flag } = move;
  const color = colorOf(piece);

  // Đưa quân về ô cũ (nếu là phong cấp thì đặt lại đúng quân Tốt ban đầu).
  board.squares[from] = piece;

  if (flag === 'ep') {
    // Ô đến vốn trống; Tốt bị ăn nằm ở cạnh ô đi.
    board.squares[to] = EMPTY;
    board.squares[sqIndex(board, fileOf(board, to), rankOf(board, from))] = captured;
  } else {
    board.squares[to] = captured;
  }

  if (flag === 'castleK' || flag === 'castleQ') {
    const side = flag === 'castleK' ? 'K' : 'Q';
    const rookFrom = castlingRookSquare(board, color, side);
    const rookTo = side === 'K' ? to - 1 : to + 1;
    board.squares[rookFrom] = board.squares[rookTo];
    board.squares[rookTo] = EMPTY;
  }

  board.castling = entry.castling;
  board.ep = entry.ep;
  board.turn = color;
  return move;
}
