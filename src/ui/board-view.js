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

/**
 * Tạo khung vẽ bàn cờ. Trả về đối tượng view gồm phần tử gốc `el` và các hàm
 * render / animateMove / topple / setSize.
 * onSquareTap(sq) được gọi khi người chơi chạm vào một ô (hoặc quân đứng trên ô đó).
 */
export function createBoardView({ onSquareTap, t = (key) => key }) {
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

  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-sq]');
    if (target) onSquareTap(Number(target.dataset.sq));
  });

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
      el.append(piece);
      view.pieces.set(sq, piece);
    }

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
