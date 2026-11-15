// =============================================================================
// ui/board-view.js — Vẽ bàn cờ và quân cờ bằng phần tử HTML, làm animation.
//
// Bố cục:
//   - Mỗi ô là một <div> đặt tuyệt đối theo toạ độ. Lỗ ('x') thì KHÔNG vẽ gì.
//   - Độ dày 3D: dưới mỗi ô không có ô thật nào ngay bên dưới (mép bàn hoặc
//     lỗ), vẽ thêm một dải màu đậm hơn, nên bàn hình dạng lạ vẫn có cạnh dày đúng chỗ.
//   - Quân là <div> chứa SVG, đặt bằng transform: translate(x, y). Đổi toạ độ
//     là CSS tự làm hiệu ứng trượt (transition).
//   - Xoay bàn: khi người chơi cầm Đen, bàn xoay 180° để phía người chơi luôn ở dưới.
//   - Mode Obstacle: ô 'x' là VẬT CẢN, vẽ thành ô có khối đá (luật đi giống lỗ).
//   - Skin: skin bàn đặt bằng thuộc tính data-skin (CSS đổi màu ô), skin quân truyền
//     vào pieceSvg.
//   - Kéo thả: ngoài chạm-chạm, người chơi có thể giữ quân rồi kéo tới ô đến. Dùng
//     Pointer Events nên chạy cả chuột lẫn cảm ứng. Kéo chưa đủ xa thì vẫn coi là chạm.
//
// File này chỉ VẼ theo dữ liệu được đưa vào; không tự quyết định luật hay lượt đi.
// =============================================================================

import { h } from './dom.js';
import { pieceSvg } from './pieces.js';
import { HOLE, EMPTY, fileOf, rankOf, sqIndex, squareName, colorOf, typeOf } from '../board.js';

/** Thời gian quân trượt (ms), khớp với transition trong style.css. */
export const SLIDE_MS = 190;
/**
 * Hình vật cản (mode Obstacle): một khối đá bo góc, nổi khối giống quân cờ
 * (độ dày phía dưới + mặt trên sáng hơn). Màu lấy từ biến CSS để hợp mọi skin bàn.
 */
const OBSTACLE_SVG = `<svg class="obstacle-art" viewBox="0 0 100 100" aria-hidden="true">
  <path d="M18 34 Q20 20 34 18 L66 16 Q82 18 84 32 L86 70 Q84 84 70 86 L30 86 Q16 84 15 70 Z" fill="var(--stone-depth)" transform="translate(0 5)"/>
  <path d="M18 34 Q20 20 34 18 L66 16 Q82 18 84 32 L86 70 Q84 84 70 86 L30 86 Q16 84 15 70 Z" fill="var(--stone)" stroke="var(--stone-edge)" stroke-width="2"/>
  <path d="M28 30 Q40 24 58 26" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 52 L52 46 L60 58 M30 66 L42 70" fill="none" stroke="var(--stone-edge)" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
</svg>`;

/** Độ dày cạnh bàn so với cạnh ô. */
const THICKNESS = 0.16;
/** Phải kéo xa hơn ngần này (tính theo cạnh ô) mới thành kéo thả; ngắn hơn là chạm. */
const DRAG_START = 0.18;

/**
 * Tạo khung vẽ bàn cờ. Trả về đối tượng view gồm phần tử gốc `el` và các hàm
 * render / animateMove / topple / setSize.
 * onSquareTap(sq) được gọi khi người chơi chạm vào một ô (hoặc quân đứng trên ô đó).
 * Kéo thả (không bắt buộc, thiếu thì bàn chỉ nhận chạm):
 *   canDrag(sq)       → true nếu quân ở ô `sq` được phép kéo lúc này (quân mình, đúng lượt);
 *   onDragStart(sq)   khi bắt đầu kéo (nơi gọi chọn quân, hiện ô đi được);
 *   onDrop(from, to)  khi thả; `to` = -1 nếu thả ra ngoài bàn / vào lỗ / vật cản.
 */
export function createBoardView({ onSquareTap, canDrag = () => false, onDragStart = () => {}, onDrop = () => {}, t = (key) => key }) {
  // `t` là hàm dịch (ui/i18n.js) để nhãn trợ năng theo ngôn ngữ người chơi chọn.
  const el = h('div', { class: 'board', role: 'grid', 'aria-label': t('aria.board') });
  const view = {
    el,
    board: null,
    flipped: false,
    cell: 64,
    pieces: new Map(), // ô → phần tử quân đang vẽ
    pieceSkin: 'ivory',
    obstacles: false,  // true: ô 'x' là vật cản (vẽ khối đá), false: là lỗ (không vẽ)
    // Kéo thả. press: đã nhấn xuống quân nhưng chưa kéo đủ xa. drag: đang kéo,
    // { sq, x, y } với x, y là toạ độ (px, trong bàn) góc trên-trái của quân.
    // hold: quân vừa thả, giữ nguyên chỗ thả cho tới khi animateMove đưa vào ô.
    press: null,
    drag: null,
    hold: null,
  };

  /** Ô `sq` có được vẽ thành một ô trên bàn không (ô thật, hoặc vật cản ở mode Obstacle). */
  const isCell = (sq) => view.board.squares[sq] !== HOLE || view.obstacles;

  /** Toạ độ góc trên-trái (px) của ô `sq` trên màn hình, có tính xoay bàn. */
  view.position = (sq) => {
    const b = view.board;
    const f = fileOf(b, sq);
    const r = rankOf(b, sq);
    const col = view.flipped ? b.width - 1 - f : f;
    const row = view.flipped ? r : b.height - 1 - r;
    return { x: col * view.cell, y: row * view.cell, row };
  };

  /** Ô liền dưới ô `sq` trên MÀN HÌNH (có tính xoay), hoặc -1 nếu là mép bàn. */
  const squareBelowOnScreen = (sq) => {
    const b = view.board;
    const r = rankOf(b, sq) + (view.flipped ? 1 : -1);
    if (r < 0 || r >= b.height) return -1;
    return sqIndex(b, fileOf(b, sq), r);
  };

  // Sau một lần kéo thả, trình duyệt vẫn bắn sự kiện click: bỏ qua lần click đó
  // để thả quân không bị hiểu thêm thành một lần chạm.
  let swallowClick = false;
  el.addEventListener('click', (e) => {
    if (swallowClick) { swallowClick = false; return; }
    const target = e.target.closest('[data-sq]');
    if (target) onSquareTap(Number(target.dataset.sq));
  });

  /** Toạ độ con trỏ (px) tính từ góc trên-trái của bàn. */
  const pointerXY = (e) => {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /** Ô nằm dưới điểm (x, y) trong bàn, có tính xoay; -1 nếu ngoài bàn, lỗ hoặc vật cản. */
  view.squareAt = (x, y) => {
    const b = view.board;
    const col = Math.floor(x / view.cell);
    const row = Math.floor(y / view.cell);
    if (col < 0 || col >= b.width || row < 0 || row >= b.height) return -1;
    const f = view.flipped ? b.width - 1 - col : col;
    const r = view.flipped ? row : b.height - 1 - row;
    const sq = sqIndex(b, f, r);
    return b.squares[sq] === HOLE ? -1 : sq;
  };

  /** Đặt phần tử quân đang kéo đúng vị trí ngón tay và tô ô nằm dưới nó. */
  const placeDragged = () => {
    const { drag } = view;
    const piece = view.pieces.get(drag.sq);
    if (piece) piece.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    const over = view.squareAt(drag.x + view.cell / 2, drag.y + view.cell / 2);
    for (const node of el.querySelectorAll('.square.drag-over')) node.classList.remove('drag-over');
    if (over !== -1) el.querySelector(`.square[data-sq="${over}"]`)?.classList.add('drag-over');
  };

  el.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    if (e.button !== 0 || view.drag || !view.board) return;
    const target = e.target.closest('.piece[data-sq]');
    if (!target) return;
    const sq = Number(target.dataset.sq);
    if (!canDrag(sq)) return;
    const { x, y } = pointerXY(e);
    view.press = { sq, x, y, id: e.pointerId };
  });

  el.addEventListener('pointermove', (e) => {
    const { press } = view;
    if (view.drag) {
      if (e.pointerId !== view.drag.id) return;
      const { x, y } = pointerXY(e);
      view.drag.x = x - view.cell / 2;
      view.drag.y = y - view.cell / 2;
      placeDragged();
      return;
    }
    if (!press || e.pointerId !== press.id) return;
    const { x, y } = pointerXY(e);
    if (Math.hypot(x - press.x, y - press.y) < DRAG_START * view.cell) return;
    // Đủ xa: bắt đầu kéo. Giữ con trỏ trên bàn để vẫn nhận sự kiện khi ra ngoài bàn.
    view.press = null;
    view.drag = { sq: press.sq, x: x - view.cell / 2, y: y - view.cell / 2, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch { /* trình duyệt cũ: bỏ qua */ }
    onDragStart(press.sq); // nơi gọi thường render() lại; render giữ quân theo view.drag
    placeDragged();
  });

  /** Kết thúc kéo: thả (`drop` = true) hoặc huỷ (pointercancel). */
  const endDrag = (e, drop) => {
    if (view.press && e.pointerId === view.press.id) view.press = null;
    const { drag } = view;
    if (!drag || e.pointerId !== drag.id) return;
    view.drag = null;
    swallowClick = true;
    if (!drop) { onDrop(drag.sq, -1); return; }
    const to = view.squareAt(drag.x + view.cell / 2, drag.y + view.cell / 2);
    view.hold = { sq: drag.sq, x: drag.x, y: drag.y };
    onDrop(drag.sq, to);
  };
  el.addEventListener('pointerup', (e) => endDrag(e, true));
  el.addEventListener('pointercancel', (e) => endDrag(e, false));

  /** Bỏ vị trí thả đang giữ: lần render() sau quân về đúng ô của nó. */
  view.clearHold = () => { view.hold = null; };

  /**
   * Vẽ lại toàn bộ bàn theo trạng thái hiện tại.
   * marks: { selected, targets: [{to, capture}], lastMove: {from,to}, hintFrom, hintTo, checkSq }
   * Tất cả là chỉ số ô; trường nào không có thì không vẽ.
   */
  view.render = (board, flipped, marks = {}) => {
    view.board = board;
    view.flipped = flipped;
    const { cell } = view;
    const t = Math.round(cell * THICKNESS);
    el.replaceChildren();
    el.style.width = `${board.width * cell}px`;
    el.style.height = `${board.height * cell + t}px`;
    el.style.setProperty('--cell', `${cell}px`);
    view.pieces.clear();

    // 1. Ô cờ và cạnh dày.
    for (let sq = 0; sq < board.squares.length; sq++) {
      if (!isCell(sq)) continue;
      const { x, y } = view.position(sq);
      const dark = (fileOf(board, sq) + rankOf(board, sq)) % 2 === 0;
      const classes = ['square', dark ? 'dark' : 'light'];
      if (marks.lastMove && (sq === marks.lastMove.from || sq === marks.lastMove.to)) classes.push('last');
      if (sq === marks.selected) classes.push('selected');
      if (sq === marks.hintFrom) classes.push('hint-from');
      if (sq === marks.hintTo) classes.push('hint-to');
      if (sq === marks.checkSq) classes.push('in-check');
      const obstacle = board.squares[sq] === HOLE;
      if (obstacle) classes.push('obstacle');
      el.append(h('div', {
        class: classes.join(' '),
        'data-sq': sq,
        role: 'gridcell',
        'aria-label': obstacle ? t('aria.obstacle', { sq: squareName(board, sq) }) : squareName(board, sq),
        style: { transform: `translate(${x}px, ${y}px)` },
        html: obstacle ? OBSTACLE_SVG : null,
      }));
      const below = squareBelowOnScreen(sq);
      if (below === -1 || !isCell(below)) {
        el.append(h('div', {
          class: `edge ${dark ? 'dark' : 'light'}`,
          style: { transform: `translate(${x}px, ${y + cell}px)`, height: `${t}px` },
        }));
      }
    }

    // 2. Chấm tròn ô đi được (ô trống) và vòng tròn (ô ăn được).
    for (const target of marks.targets ?? []) {
      const { x, y } = view.position(target.to);
      el.append(h('div', {
        class: target.capture ? 'target capture' : 'target',
        'data-sq': target.to,
        style: { transform: `translate(${x}px, ${y}px)` },
      }));
    }

    // 3. Quân cờ. Quân ở hàng dưới vẽ đè lên quân hàng trên (z-index theo hàng).
    for (let sq = 0; sq < board.squares.length; sq++) {
      const p = board.squares[sq];
      if (p === EMPTY || p === HOLE) continue;
      const piece = makePiece(p, sq);
      if (sq === marks.selected) piece.classList.add('lifted');
      // Quân đang kéo / vừa thả: vẽ ở chỗ ngón tay, không ở ô của nó.
      const held = view.drag?.sq === sq ? view.drag : view.hold?.sq === sq ? view.hold : null;
      if (held) {
        piece.classList.add(view.drag ? 'dragging' : 'dropped');
        piece.style.transform = `translate(${held.x}px, ${held.y}px)`;
      }
      el.append(piece);
      view.pieces.set(sq, piece);
    }
    if (view.drag) placeDragged();

    // 4. Gợi ý: bóng mờ của quân cần đi trượt từ ô đi tới ô đến, lặp lại liên tục,
    //    để người chơi THẤY nước cần đi mà không phải đọc tên ô (yêu cầu chủ dự án).
    if (marks.hintFrom !== undefined && marks.hintTo !== undefined && board.squares[marks.hintFrom] !== EMPTY) {
      const a = view.position(marks.hintFrom);
      const b = view.position(marks.hintTo);
      el.append(h('div', {
        class: 'hint-ghost',
        'aria-hidden': 'true',
        style: {
          transform: `translate(${a.x}px, ${a.y}px)`,
          '--dx': `${b.x - a.x}px`,
          '--dy': `${b.y - a.y}px`,
        },
      }, h('div', { class: 'piece-inner', html: pieceSvg(board.squares[marks.hintFrom], view.pieceSkin) })));
    }
  };

  /** Tạo phần tử một quân đứng ở ô `sq`. */
  const makePiece = (p, sq) => {
    const { x, y, row } = view.position(sq);
    const white = colorOf(p) === 'w';
    return h('div', {
      class: `piece ${white ? 'white' : 'black'}`,
      'data-sq': sq,
      'aria-label': t('aria.piece', {
        color: t(white ? 'side.white' : 'side.black'),
        piece: t(`piece.${typeOf(p)}`),
        sq: squareName(view.board, sq),
      }),
      style: { transform: `translate(${x}px, ${y}px)`, zIndex: 10 + row },
    }, h('div', { class: 'piece-inner', html: pieceSvg(p, view.pieceSkin) }));
  };

  /**
   * Cho quân ở ô `from` trượt tới ô `to` (chỉ hiệu ứng, không đổi dữ liệu).
   * Quân đang đứng ở `to` (nếu có) mờ đi như bị ăn. Trả về Promise xong khi trượt xong.
   * Sau đó nơi gọi nên render() lại theo dữ liệu thật.
   */
  view.animateMove = (from, to) => {
    const piece = view.pieces.get(from);
    if (!piece) return Promise.resolve();
    const victim = view.pieces.get(to);
    if (victim && victim !== piece) victim.classList.add('captured');
    const { x, y, row } = view.position(to);
    // Quân vừa thả bằng kéo thả: chỉ trượt nốt đoạn ngắn từ chỗ thả vào giữa ô.
    if (view.hold?.sq === from) {
      view.hold = null;
      piece.classList.remove('dropped');
      piece.getBoundingClientRect(); // ép trình duyệt tính vị trí cũ để transition chạy
    }
    piece.classList.remove('lifted');
    piece.style.zIndex = 40 + row;
    piece.style.transform = `translate(${x}px, ${y}px)`;
    view.pieces.delete(from);
    view.pieces.set(to, piece);
    return new Promise((resolve) => setTimeout(resolve, SLIDE_MS + 20));
  };

  /** Vua ở ô `sq` đổ xuống (chiếu hết). */
  view.topple = (sq) => view.pieces.get(sq)?.classList.add('toppled');

  /** Đặt cỡ ô (px). Gọi trước render(). */
  view.setSize = (cell) => { view.cell = cell; };

  /**
   * Đặt skin và kiểu bàn. Gọi trước render().
   *   board : id skin bàn ('classic', 'marble', 'neon') — CSS đọc data-skin;
   *   pieces: id skin quân ('ivory', 'marble', 'neon', 'royal');
   *   obstacles: true nếu là mode Obstacle (ô 'x' vẽ thành vật cản).
   */
  view.setStyle = ({ board = 'classic', pieces = 'ivory', obstacles = false } = {}) => {
    el.dataset.skin = board;
    view.pieceSkin = pieces;
    view.obstacles = obstacles;
  };

  return view;
}
