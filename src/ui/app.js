// =============================================================================
// ui/app.js — Giao diện game: các màn hình và cách nối logic với hình ảnh.
//
// Màn hình (GDD mục 7.1):
//   - Màn chơi (level chính hoặc Daily) — màn mở đầu khi vào game.
//   - Chọn level: lưới số theo chương, kèm nút Daily, Shop, Settings.
//   - Shop, Settings.
//   Hộp nổi: gợi ý, phong cấp, chiến thắng, quảng cáo giả lập, xác nhận.
//
// Logic (puzzle / economy / progress / storage) nằm ở src/, không biết gì về
// giao diện. File này chỉ: nhận thao tác của người chơi → gọi logic → vẽ lại
// và chạy animation, âm thanh. Thứ tự gọi khi thắng xem CLAUDE.md.
// =============================================================================

import { h, wait, nextFrame } from './dom.js';
import { createBoardView } from './board-view.js';
import { pieceSvg } from './pieces.js';
import { sounds, setSoundEnabled } from './sound.js';
import { themeForLevel, DAILY_THEME, applyTheme } from './themes.js';
import { parseSquare, squareName, colorOf, opponent } from '../board.js';
import { inCheck, findKing } from '../movegen.js';
import {
  createPuzzle, playerMove, opponentMove, undoMove, getHint, legalTargets,
  needsPromotion, summary, canUndo, canHint, PLAYER_TURN, ENDED, WON,
} from '../puzzle.js';
import {
  HINT_COSTS, REWARD_AD, spendForHint, addSolveReward, onLevelWon, watchRewardedAd,
  adsRemaining, buyPack, SHOP_PACKS,
} from '../economy.js';
import {
  markSolved, levelStatus, currentLevel, dateKey, dailyIndex, completeDaily,
  isDailySolved, currentStreak,
} from '../progress.js';
import { loadSave, writeSave, resetSave } from '../storage.js';

/**
 * Khi ván dừng mà chưa thắng (puzzle ENDED): chữ thay cho "Mate in N" ở tiêu đề
 * và thông báo ngắn. Theo luật của bản này, đi sai thì không báo sai; chỉ khi
 * ván KHÔNG THỂ đi tiếp mới nhắc người chơi bấm Undo.
 */
const END_TEXT = {
  'out-of-moves': { title: 'Hết nước', toast: 'Chưa chiếu hết. Bấm Undo để thử lại' },
  stalemate: { title: 'Hoà pat', toast: 'Hoà pat! Bấm Undo để thử lại' },
  lost: { title: 'Bị chiếu hết', toast: 'Đối thủ chiếu hết bạn! Bấm Undo để thử lại' },
};

/** Thời gian chờ trước khi đối thủ đáp trả, để người chơi kịp nhìn (GDD 7.2). */
const OPPONENT_DELAY = 400;
/** Thời gian quảng cáo xen giữa (giây) trước khi nút đóng bấm được. */
const AD_SECONDS = 5;

/** Icon SVG nhỏ dùng trên nút (tự vẽ). */
const ICONS = {
  grid: `<svg viewBox="0 0 24 24"><g fill="currentColor">${[4, 12, 20].flatMap((y) => [4, 12, 20].map((x) => `<circle cx="${x}" cy="${y}" r="3"/>`)).join('')}</g></svg>`,
  back: '<svg viewBox="0 0 24 24"><path d="M15 3 L6 12 L15 21" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 16.5 C9 14 7 13 7 10 a5 5 0 0 1 10 0 c0 3 -2 4 -2 6.5 Z"/><path d="M9.5 19 h5"/><path d="M10.5 21.3 h3"/><path d="M12 1.6 v1.8 M4.2 4.4 l1.3 1.3 M19.8 4.4 l-1.3 1.3 M1.8 10.5 h1.8 M20.4 10.5 h1.8 M5.5 15.8 l-1.2 1.2 M18.5 15.8 l1.2 1.2"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4.5 L4.5 8.5 L8.5 12.5"/><path d="M4.8 8.5 H13 a6 6 0 0 1 0 12 H9"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f2c14e" stroke="#b9852a" stroke-width="1.6"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b9852a" stroke-width="1.3"/><path d="M12 8.2 v7.6" stroke="#b9852a" stroke-width="1.6" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10 h17 M8 3 v4 M16 3 v4" stroke-linecap="round"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8 h16 l-1.3 11.2 a2 2 0 0 1 -2 1.8 H7.3 a2 2 0 0 1 -2 -1.8 Z"/><path d="M8.5 10 V7 a3.5 3.5 0 0 1 7 0 v3" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 v2.6 M12 18.6 v2.6 M2.8 12 h2.6 M18.6 12 h2.6 M5.5 5.5 l1.8 1.8 M16.7 16.7 l1.8 1.8 M5.5 18.5 l1.8 -1.8 M16.7 7.3 l1.8 -1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="6.6"/></svg>',
};

const icon = (name, cls = 'icon') => h('span', { class: cls, html: ICONS[name] });

/** Tách chuỗi nước như "d1a1" hoặc "a5a6q" thành chỉ số ô { from, to }. */
function parseMoveText(board, text) {
  const [, from, to] = /^([a-z]\d+)([a-z]\d+)/.exec(text);
  return { from: parseSquare(board, from), to: parseSquare(board, to) };
}

/** Tên tháng tiếng Việt cho tiêu đề Daily, ví dụ "12 tháng 11". */
function dailyTitle(key) {
  return `${Number(key.slice(6, 8))} tháng ${Number(key.slice(4, 6))}`;
}

/**
 * Khởi động giao diện. `data` là nội dung levels.json, `root` là phần tử chứa app.
 * Trả về đối tượng app (để kiểm thử trên trình duyệt có thể đọc trạng thái).
 */
export function startApp(root, data) {
  const { save, status } = loadSave();
  const app = {
    root,
    data,
    save,
    saveStatus: status,
    screen: null,
    // Trạng thái màn chơi:
    puzzle: null,
    mode: 'main',          // 'main' hoặc 'daily'
    dailyKey: null,
    selected: null,        // ô quân đang chọn
    targets: [],           // các ô đi được của quân đang chọn
    hint: null,            // { from, to } đang tô sáng
    lastMove: null,
    busy: false,           // đang chạy animation / bộ giải: khoá thao tác (trạng thái ANIMATING)
    view: null,
  };
  setSoundEnabled(save.settings.sound);

  const persist = () => writeSave(app.save);
  const totalLevels = data.levels.length;

  // -------------------------------------------------------------------------
  // Tiện ích hiển thị
  // -------------------------------------------------------------------------

  /** Hiện thông báo ngắn ở giữa màn hình (ví dụ "Chưa đúng, thử lại"). */
  function toast(text) {
    document.querySelector('.toast')?.remove();
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.remove(), 1600);
  }

  /** Mở một hộp nổi (overlay). Trả về hàm đóng. */
  function openOverlay(content, { onClose, dismissable = true, cls = '' } = {}) {
    const overlay = h('div', { class: `overlay ${cls}` }, content);
    const close = () => {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 180);
      onClose?.();
    };
    if (dismissable) overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.append(overlay);
    return close;
  }

  /** Viên hiển thị số coin. */
  const coinPill = () => h('div', { class: 'coin-pill', 'aria-label': `${app.save.economy.coins} coin` },
    icon('coin', 'coin-icon'), h('span', { class: 'coin-count' }, String(app.save.economy.coins)));

  /** Cập nhật mọi viên coin đang hiện trên màn hình. */
  function refreshCoins() {
    for (const el of document.querySelectorAll('.coin-count')) el.textContent = String(app.save.economy.coins);
  }

  /** Rung điện thoại (nếu người chơi bật và máy hỗ trợ). */
  function vibrate(ms) {
    if (app.save.settings.vibration) navigator.vibrate?.(ms);
  }

  /** Tính cỡ ô để bàn vừa màn hình: rộng tối đa trừ lề, cao tối đa ~52% màn hình. */
  function cellSize(board) {
    const w = Math.min(window.innerWidth, 520) - 48;
    const hgt = window.innerHeight * 0.5;
    return Math.max(36, Math.floor(Math.min(w / board.width, hgt / board.height, 118)));
  }

  // -------------------------------------------------------------------------
  // Màn chơi
  // -------------------------------------------------------------------------

  /** Bắt đầu level chính `id`. */
  function startLevel(id) {
    app.mode = 'main';
    openPuzzle(data.levels[id - 1], themeForLevel(id));
  }

  /** Bắt đầu Daily Puzzle của hôm nay. */
  function startDaily() {
    app.mode = 'daily';
    app.dailyKey = dateKey(new Date());
    const level = data.daily[dailyIndex(app.dailyKey, data.daily.length)];
    openPuzzle(level, DAILY_THEME);
  }

  /** Mở màn chơi cho một level. */
  function openPuzzle(level, theme) {
    app.puzzle = createPuzzle(level);
    app.selected = null;
    app.targets = [];
    app.hint = null;
    app.lastMove = null;
    app.busy = false;
    app.screen = 'game';
    applyTheme(theme);
    renderGameScreen();
  }

  /** Bên người chơi cầm (bên tấn công = bên đi trước của level). */
  const playerColor = () => app.puzzle.level.attacker;

  /** Vẽ khung màn chơi: thanh trên, bàn cờ, 2 nút dưới. */
  function renderGameScreen() {
    const p = app.puzzle;
    const isDaily = app.mode === 'daily';
    const left = isDaily
      ? h('button', { class: 'icon-btn', 'aria-label': 'Quay lại', onclick: () => { sounds.tap(); showLevelSelect(); } }, icon('back'))
      : h('button', { class: 'icon-btn', 'aria-label': 'Chọn level', onclick: () => { sounds.tap(); showLevelSelect(); } }, icon('grid'));

    const view = createBoardView({ onSquareTap });
    app.view = view;
    view.setSize(cellSize(p.board));

    const hintBtn = h('button', { class: 'round-btn hint-btn', 'aria-label': 'Gợi ý', onclick: openHintSheet }, icon('bulb', 'round-icon'));
    const undoBtn = h('button', { class: 'round-btn undo-btn', 'aria-label': 'Đi lại', onclick: onUndo }, icon('undo', 'round-icon'));

    const screen = h('main', { class: 'screen game-screen' },
      h('header', { class: 'game-top' },
        h('div', { class: 'top-left' }, left),
        h('div', { class: 'title-block' },
          h('div', { class: 'subtitle' }, isDaily ? dailyTitle(app.dailyKey) : `Level ${p.level.id}`),
          h('h1', { class: 'title' }, 'Mate in ', h('span', { class: 'moves-left' }, String(p.movesLeft)))),
        h('div', { class: 'top-right' }, coinPill())),
      h('section', { class: 'board-area' }, sideLabel('top'), view.el, sideLabel('bottom')),
      h('footer', { class: 'game-bottom' }, hintBtn, undoBtn));
    root.replaceChildren(screen);
    app.buttons = { hintBtn, undoBtn };
    drawBoard();
  }

  /**
   * Nhãn cho biết bên nào ở phía nào của bàn và Tốt đi hướng nào, đặt ở mép trên
   * và mép dưới bàn cờ. Bàn luôn xoay để phía người chơi ở dưới, nên:
   *   - mép dưới: bên của người chơi, Tốt đi LÊN (↑), ghi "(bạn)";
   *   - mép trên: bên đối thủ, Tốt đi XUỐNG (↓).
   * Nhờ vậy dù Vua trắng đứng ở hàng trên cùng (thế cờ puzzle hay có), người chơi
   * vẫn biết ngay Tốt nào đi về đâu.
   */
  function sideLabel(edge) {
    const mine = playerColor();
    const color = edge === 'bottom' ? mine : opponent(mine);
    const name = color === 'w' ? 'Trắng' : 'Đen';
    const arrow = edge === 'bottom' ? '↑' : '↓';
    const dir = edge === 'bottom' ? 'đi lên' : 'đi xuống';
    return h('div', {
      class: `side-label ${edge} ${color === 'w' ? 'white' : 'black'}`,
      'aria-label': `Phía ${edge === 'bottom' ? 'dưới' : 'trên'}: quân ${name}${edge === 'bottom' ? ' của bạn' : ' của đối thủ'}, Tốt ${dir}`,
    },
    h('span', { class: 'side-pawn', html: pieceSvg(color === 'w' ? 'P' : 'p') }),
    h('span', { class: 'side-name' }, name, edge === 'bottom' && h('small', {}, ' (bạn)')),
    h('span', { class: 'side-arrow', 'aria-hidden': 'true' }, arrow));
  }

  /** Vẽ lại bàn cờ và trạng thái các nút theo dữ liệu hiện tại. */
  function drawBoard() {
    const p = app.puzzle;
    const board = p.board;
    const checkSq = inCheck(board) ? findKing(board, board.turn) : undefined;
    app.view.render(board, playerColor() === 'b', {
      selected: app.selected ?? undefined,
      targets: app.save.settings.showLegalMoves ? app.targets : [],
      lastMove: app.lastMove ?? undefined,
      hintFrom: app.hint?.from,
      hintTo: app.hint?.to,
      checkSq,
    });
    // Tiêu đề: "Mate in N" với N là số nước còn lại (còn 1 nước ở level nhiều nước
    // thì đổi màu); đã thắng thì giữ đề bài ban đầu; ván dừng thì ghi lý do.
    const title = document.querySelector('.game-screen .title');
    if (title) {
      if (p.state === ENDED) {
        title.replaceChildren(END_TEXT[p.endReason].title);
        title.classList.add('ended');
      } else {
        const n = h('span', { class: 'moves-left' }, String(p.state === WON ? p.level.mateIn : p.movesLeft));
        n.classList.toggle('urgent', p.movesLeft <= 1 && p.level.mateIn > 1 && p.state !== WON);
        title.replaceChildren('Mate in ', n);
        title.classList.remove('ended');
      }
    }
    app.buttons.undoBtn.disabled = !canUndo(p) || app.busy;
    // Ván dừng: nút Undo nhấp nháy nhẹ để người chơi biết bấm vào đâu.
    app.buttons.undoBtn.classList.toggle('attention', p.state === ENDED && !app.busy);
    app.buttons.hintBtn.disabled = p.state !== PLAYER_TURN || app.busy;
  }

  /** Người chơi chạm vào ô `sq`. */
  function onSquareTap(sq) {
    const p = app.puzzle;
    if (app.busy || p.state !== PLAYER_TURN) return;
    const piece = p.board.squares[sq];
    const own = colorOf(piece) === playerColor();

    if (app.selected !== null && app.targets.some((t) => t.to === sq)) {
      tryMove(app.selected, sq);
      return;
    }
    if (own && sq !== app.selected) {
      app.selected = sq;
      app.targets = legalTargets(p, sq);
      sounds.tap();
    } else {
      app.selected = null; // chạm lại quân đang chọn hoặc ô trống → bỏ chọn
      app.targets = [];
    }
    drawBoard();
  }

  /** Hỏi quân phong cấp. Trả về Promise với chữ 'q' | 'r' | 'b' | 'n', hoặc null nếu huỷ. */
  function askPromotion() {
    return new Promise((resolve) => {
      let chosen = null;
      const color = playerColor();
      const choice = (t) => h('button', {
        class: 'promo-choice',
        'aria-label': { q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã' }[t],
        onclick: () => { chosen = t; close(); },
      }, h('span', { class: 'promo-piece', html: pieceSvg(color === 'w' ? t.toUpperCase() : t) }));
      const close = openOverlay(
        h('div', { class: 'dialog promo-dialog' }, h('h2', {}, 'Phong cấp thành'), h('div', { class: 'promo-row' }, ['q', 'r', 'b', 'n'].map(choice))),
        { onClose: () => resolve(chosen) },
      );
    });
  }

  /** Đi nước từ `from` tới `to`: animation → chấm điểm → phản hồi. */
  async function tryMove(from, to) {
    const p = app.puzzle;
    let promo = '';
    if (needsPromotion(p, from, to)) {
      promo = await askPromotion();
      if (!promo) return;
    }
    const text = squareName(p.board, from) + squareName(p.board, to) + promo;
    const capture = p.board.squares[to] !== '.';
    app.busy = true;
    app.selected = null;
    app.targets = [];
    app.hint = null;
    drawBoard();

    // ANIMATING: cho quân trượt trước, rồi mới gọi logic (bộ giải có thể mất vài trăm ms).
    await app.view.animateMove(from, to);
    capture ? sounds.capture() : sounds.move();
    await nextFrame();
    const r = playerMove(p, text);

    if (r.result === 'illegal') { app.busy = false; drawBoard(); return; }
    app.lastMove = { from, to };

    // Chỉ khi chiếu hết thật mới có hiệu ứng chiến thắng.
    if (r.result === 'win') {
      drawBoard();
      await onWin();
      app.busy = false; // trạng thái WON đã tự khoá bàn cờ
      return;
    }

    // Đi sai thì KỆ: không rung, không báo sai, không tự lùi. Chỉ khi ván không
    // thể đi tiếp (hết nước / hòa pat) mới nhắc bấm Undo.
    if (r.result === 'ended') {
      onEnded(r.reason);
      return;
    }

    // Chưa xong: OPPONENT_TURN.
    drawBoard();
    if (inCheck(p.board)) sounds.check();
    await wait(OPPONENT_DELAY);
    await nextFrame();
    // opponentMove() đổi dữ liệu bàn ngay, nhưng màn hình vẫn đang vẽ thế cũ,
    // nên cho quân trên màn hình trượt theo nước vừa đi rồi mới vẽ lại.
    const reply = opponentMove(p);
    const { from: rFrom, to: rTo } = parseMoveText(p.board, reply.move);
    const replyCaptures = app.view.pieces.has(rTo);
    await app.view.animateMove(rFrom, rTo);
    replyCaptures ? sounds.capture() : sounds.move();
    app.lastMove = { from: rFrom, to: rTo };
    if (reply.result === 'ended') {
      onEnded(reply.reason);
      return;
    }
    if (inCheck(p.board)) sounds.check();
    app.busy = false;
    drawBoard();
  }

  /**
   * Ván dừng mà chưa thắng (hết nước, hòa pat, hoặc bị chiếu hết ngược): vẽ lại,
   * đổi tiêu đề, nhắc nhẹ bấm Undo. Không rung bàn, không tính là "thua" gì cả.
   */
  function onEnded(reason) {
    app.busy = false;
    drawBoard();
    sounds.wrong();
    toast(END_TEXT[reason].toast);
  }

  /** Nút Undo. */
  function onUndo() {
    const p = app.puzzle;
    if (app.busy || !canUndo(p)) return;
    if (undoMove(p)) {
      sounds.tap();
      app.selected = null;
      app.targets = [];
      app.hint = null;
      app.lastMove = null;
      drawBoard();
    }
  }

  // -------------------------------------------------------------------------
  // Gợi ý
  // -------------------------------------------------------------------------

  /** Mở bảng chọn mức gợi ý (GDD 6.2: 20 / 40 / 100 coin). */
  function openHintSheet() {
    if (app.busy || app.puzzle.state !== PLAYER_TURN) return;
    sounds.tap();
    // Đã đi lệch thì thế cờ này không còn nước đúng nào để gợi ý: nhắc Undo,
    // không mở bảng mua gợi ý (không để người chơi mất coin vô ích).
    if (!canHint(app.puzzle)) {
      toast('Từ thế này không còn chiếu hết kịp. Bấm Undo để quay lại');
      return;
    }
    const coins = app.save.economy.coins;
    const option = (level, title, desc) => h('button', {
      class: 'sheet-option',
      disabled: coins < HINT_COSTS[level],
      onclick: () => { close(); useHint(level); },
    }, h('span', { class: 'opt-text' }, h('strong', {}, title), h('small', {}, desc)),
    h('span', { class: 'price' }, icon('coin', 'coin-icon'), String(HINT_COSTS[level])));
    const today = dateKey(new Date());
    const adsLeft = adsRemaining(app.save.economy, today);
    const close = openOverlay(h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h2', {}, 'Gợi ý'), coinPill()),
      option(1, 'Quân cần đi', 'Tô sáng quân bạn nên đi'),
      option(2, 'Nước tiếp theo', 'Hiện ô đi và ô đến'),
      option(3, 'Toàn bộ lời giải', 'Mọi nước còn lại, cả nước đáp của đối thủ'),
      h('button', {
        class: 'sheet-option ad-option',
        disabled: adsLeft <= 0,
        onclick: () => { close(); showAd({ rewarded: true }); },
      }, h('span', { class: 'opt-text' }, h('strong', {}, `Xem quảng cáo +${REWARD_AD}`), h('small', {}, `Hôm nay còn ${adsLeft} lượt`)),
      h('span', { class: 'price free' }, 'Miễn phí'))), { cls: 'sheet-overlay' });
  }

  /** Trả coin và hiện gợi ý mức `level`. */
  function useHint(level) {
    const pay = spendForHint(app.save.economy, level);
    if (!pay.ok) { toast('Không đủ coin'); return; }
    persist();
    refreshCoins();
    const hint = getHint(app.puzzle, level);
    const b = app.puzzle.board;
    if (level === 3) {
      app.hint = { from: parseMoveText(b, hint.line[0]).from };
      drawBoard();
      showSolution(hint.line);
      return;
    }
    app.hint = { from: parseSquare(b, hint.from), to: hint.to ? parseSquare(b, hint.to) : undefined };
    drawBoard();
  }

  /** Hộp hiện toàn bộ lời giải còn lại, viết dễ đọc: "d1 → a1". */
  function showSolution(line) {
    const pretty = (m, i) => {
      const [, from, to, promo] = /^([a-z]\d+)([a-z]\d+)([qrbn]?)$/.exec(m);
      const who = i % 2 === 0 ? 'Bạn' : 'Đối thủ';
      return h('li', { class: i % 2 === 0 ? 'mine' : 'theirs' }, h('span', { class: 'who' }, who),
        `${from} → ${to}${promo ? ` (phong ${{ q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã' }[promo]})` : ''}`);
    };
    const close = openOverlay(h('div', { class: 'dialog' },
      h('h2', {}, 'Lời giải'),
      h('ol', { class: 'solution' }, line.map(pretty)),
      h('p', { class: 'note' }, 'Đối thủ có thể đáp khác; khi đó hãy xem gợi ý lại.'),
      h('button', { class: 'btn primary', onclick: () => close() }, 'Đã hiểu')));
  }

  // -------------------------------------------------------------------------
  // Thắng level
  // -------------------------------------------------------------------------

  /** Chiếu hết: Vua đổ, pháo hoa, cộng coin, lưu tiến trình, hiện màn chiến thắng. */
  async function onWin() {
    const p = app.puzzle;
    const s = summary(p);
    sounds.win();
    vibrate(60);
    app.view.topple(findKing(p.board, opponent(playerColor())));
    confetti();

    let firstTime;
    let extra = null;
    if (app.mode === 'daily') {
      const d = completeDaily(app.save.progress, app.dailyKey);
      firstTime = d.firstTime;
      extra = `Chuỗi ${d.streak} ngày liên tiếp`;
    } else {
      firstTime = markSolved(app.save.progress, p.level.id, { hintUsed: s.hintUsed, totalLevels }).firstTime;
    }
    const gained = addSolveReward(app.save.economy, { firstTime, perfect: s.perfect, daily: app.mode === 'daily' });
    const showAdNext = app.mode === 'main' && onLevelWon(app.save.economy, p.level.id);
    persist();

    await wait(900);
    const isLast = app.mode === 'main' && p.level.id >= totalLevels;
    const next = () => {
      close();
      const go = () => (app.mode === 'daily' || isLast ? showLevelSelect() : startLevel(p.level.id + 1));
      showAdNext ? showAd({ rewarded: false, then: go }) : go();
    };
    const close = openOverlay(h('div', { class: 'dialog win-dialog' },
      h('div', { class: 'win-crown', html: pieceSvg(playerColor() === 'w' ? 'K' : 'k') }),
      h('h2', {}, 'Chiếu hết!'),
      h('p', { class: 'win-sub' }, s.perfect ? 'Hoàn hảo: không gợi ý, không đi sai' : 'Giỏi lắm!'),
      extra && h('p', { class: 'streak' }, extra),
      h('div', { class: 'reward' }, icon('coin', 'coin-icon big'), h('span', {}, gained > 0 ? `+${gained}` : 'Đã giải trước đó')),
      h('button', { class: 'btn primary', onclick: next }, app.mode === 'daily' || isLast ? 'Xong' : 'Level tiếp')),
    { dismissable: false, cls: 'win-overlay' });
    if (gained > 0) {
      sounds.coin();
      refreshCoins();
    }
  }

  /** Pháo giấy rơi khi chiến thắng (thuần CSS animation). */
  function confetti() {
    const colors = ['#f2c14e', '#f78c6b', '#83d483', '#4cc9f0', '#f4f1de', '#e76f51'];
    const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
    for (let i = 0; i < 46; i++) {
      box.append(h('i', {
        style: {
          left: `${Math.random() * 100}%`,
          background: colors[i % colors.length],
          animationDelay: `${Math.random() * 0.35}s`,
          animationDuration: `${1.3 + Math.random() * 1.1}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        },
      }));
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 2800);
  }

  // -------------------------------------------------------------------------
  // Quảng cáo giả lập (GDD 6.3)
  // -------------------------------------------------------------------------

  /**
   * Hiện màn quảng cáo giả lập 5 giây. rewarded = true: quảng cáo thưởng
   * (+25 coin khi xem hết). Nút đóng to, đặt ở dưới, dễ bấm (sửa lỗi bản gốc).
   */
  function showAd({ rewarded, then } = {}) {
    let left = AD_SECONDS;
    const counter = h('span', { class: 'ad-count' }, String(left));
    const closeBtn = h('button', { class: 'btn primary ad-close', disabled: true, onclick: () => finish() }, 'Đóng');
    const close = openOverlay(h('div', { class: 'ad-box' },
      h('div', { class: 'ad-label' }, 'Quảng cáo (giả lập)'),
      h('div', { class: 'ad-art', html: pieceSvg('N') }),
      h('p', {}, 'Đây là quảng cáo giả lập cho bài tập. Không có quảng cáo thật.'),
      h('p', { class: 'ad-timer' }, 'Còn ', counter, ' giây'),
      closeBtn), { dismissable: false, cls: 'ad-overlay' });
    const timer = setInterval(() => {
      left--;
      counter.textContent = String(Math.max(left, 0));
      if (left <= 0) {
        clearInterval(timer);
        closeBtn.disabled = false;
      }
    }, 1000);
    function finish() {
      clearInterval(timer);
      close();
      if (rewarded) {
        const r = watchRewardedAd(app.save.economy, dateKey(new Date()));
        persist();
        if (r.ok) { sounds.coin(); toast(`+${r.gained} coin`); } else toast('Hôm nay đã hết lượt xem quảng cáo');
        refreshCoins();
      }
      then?.();
    }
  }

  // -------------------------------------------------------------------------
  // Màn chọn level
  // -------------------------------------------------------------------------

  /** Màn chọn level: lưới số theo chương; nút Daily, Shop, Settings. */
  function showLevelSelect() {
    app.screen = 'levels';
    applyTheme(themeForLevel(currentLevel(app.save.progress, totalLevels)));
    const progress = app.save.progress;
    const today = dateKey(new Date());
    const streak = currentStreak(progress, today);

    const tile = (level) => {
      const st = levelStatus(progress, level.id);
      return h('button', {
        class: `level-tile ${st}`,
        disabled: st === 'locked',
        'aria-label': `Level ${level.id}${st === 'locked' ? ', đang khoá' : st === 'solved' ? ', đã giải' : ''}`,
        onclick: () => { sounds.tap(); startLevel(level.id); },
      }, st === 'locked' ? icon('lock', 'tile-icon') : String(level.id),
      st === 'solved' && icon('check', 'tile-check'));
    };

    const chapters = data.chapters.map((ch) => {
      const levels = data.levels.filter((l) => l.chapter === ch.chapter);
      const solved = levels.filter((l) => progress.solved[l.id]).length;
      return h('section', { class: 'chapter' },
        h('div', { class: 'chapter-head' }, h('h2', {}, `${ch.chapter}. ${ch.name}`),
          h('span', { class: 'chapter-meta' }, `Mate in ${ch.mateIn} · ${solved}/${levels.length}`)),
        h('div', { class: 'level-grid' }, levels.map(tile)));
    });

    root.replaceChildren(h('main', { class: 'screen list-screen' },
      h('header', { class: 'list-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Về màn chơi', onclick: () => { sounds.tap(); startLevel(currentLevel(progress, totalLevels)); } }, icon('back')),
        h('h1', {}, 'Chọn level'),
        coinPill()),
      h('div', { class: 'hub-row' },
        h('button', { class: 'hub-btn daily', onclick: () => { sounds.tap(); startDaily(); } },
          icon('calendar'), h('span', {}, h('strong', {}, 'Daily'), h('small', {}, isDailySolved(progress, today) ? 'Đã giải hôm nay' : streak > 0 ? `Chuỗi ${streak} ngày` : 'Hôm nay'))),
        h('button', { class: 'hub-btn', onclick: () => { sounds.tap(); showShop(); } }, icon('shop'), h('span', {}, h('strong', {}, 'Shop'))),
        h('button', { class: 'hub-btn', onclick: () => { sounds.tap(); showSettings(); } }, icon('gear'), h('span', {}, h('strong', {}, 'Cài đặt')))),
      h('div', { class: 'chapters' }, chapters)));
  }

  // -------------------------------------------------------------------------
  // Shop và Settings
  // -------------------------------------------------------------------------

  /** Khung chung cho màn phụ: nút back, tiêu đề, nội dung. */
  function subScreen(title, body) {
    root.replaceChildren(h('main', { class: 'screen list-screen' },
      h('header', { class: 'list-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Quay lại', onclick: () => { sounds.tap(); showLevelSelect(); } }, icon('back')),
        h('h1', {}, title),
        coinPill()),
      body));
  }

  /** Cửa hàng giả lập: gói coin, Remove Ads, xem quảng cáo +25. */
  function showShop() {
    app.screen = 'shop';
    const eco = app.save.economy;
    const today = dateKey(new Date());
    const pack = (id, title, desc) => h('button', {
      class: 'shop-item',
      disabled: id === 'removeAds' && eco.noAds,
      onclick: () => {
        buyPack(eco, id);
        persist();
        sounds.coin();
        toast(id === 'removeAds' ? 'Đã tắt quảng cáo xen giữa' : `+${SHOP_PACKS[id].coins} coin`);
        showShop();
      },
    }, h('span', { class: 'opt-text' }, h('strong', {}, title), h('small', {}, desc)),
    h('span', { class: 'price' }, id === 'removeAds' && eco.noAds ? 'Đã mua' : 'Mua (giả lập)'));
    subScreen('Shop', h('div', { class: 'list-body' },
      h('p', { class: 'note' }, 'Cửa hàng giả lập cho bài tập: bấm mua chỉ cộng coin, không có thanh toán thật.'),
      h('button', {
        class: 'shop-item ad-option',
        disabled: adsRemaining(eco, today) <= 0,
        onclick: () => showAd({ rewarded: true, then: showShop }),
      }, h('span', { class: 'opt-text' }, h('strong', {}, `Xem quảng cáo +${REWARD_AD}`), h('small', {}, `Hôm nay còn ${adsRemaining(eco, today)} lượt`)),
      h('span', { class: 'price free' }, 'Miễn phí')),
      pack('small', `Gói nhỏ: ${SHOP_PACKS.small.coins} coin`, 'Đủ cho 10 gợi ý mức 1'),
      pack('medium', `Gói vừa: ${SHOP_PACKS.medium.coins} coin`, 'Đủ cho 12 gợi ý mức 2'),
      pack('large', `Gói lớn: ${SHOP_PACKS.large.coins} coin`, 'Đủ cho 12 lời giải đầy đủ'),
      pack('removeAds', 'Remove Ads', 'Tắt quảng cáo xen giữa các level')));
  }

  /** Màn cài đặt: âm thanh, rung, hiện nước hợp lệ, reset tiến trình. */
  function showSettings() {
    app.screen = 'settings';
    const st = app.save.settings;
    const toggle = (key, title, desc) => h('label', { class: 'setting' },
      h('span', { class: 'opt-text' }, h('strong', {}, title), h('small', {}, desc)),
      h('input', {
        type: 'checkbox',
        class: 'switch',
        checked: st[key],
        onchange: (e) => {
          st[key] = e.target.checked;
          if (key === 'sound') setSoundEnabled(st.sound);
          persist();
          sounds.tap();
        },
      }));
    subScreen('Cài đặt', h('div', { class: 'list-body' },
      toggle('sound', 'Âm thanh', 'Tiếng đi quân, ăn quân, chiến thắng'),
      toggle('vibration', 'Rung', 'Rung nhẹ khi chiếu hết'),
      toggle('showLegalMoves', 'Hiện nước đi được', 'Chấm tròn trên các ô quân đi tới được'),
      h('button', { class: 'btn danger', onclick: confirmReset }, 'Xoá toàn bộ tiến trình'),
      app.saveStatus === 'unavailable' && h('p', { class: 'note' }, 'Trình duyệt đang chặn lưu dữ liệu: tiến trình sẽ mất khi đóng trang.')));
  }

  /** Hỏi lại trước khi xoá tiến trình. */
  function confirmReset() {
    const close = openOverlay(h('div', { class: 'dialog' },
      h('h2', {}, 'Xoá tiến trình?'),
      h('p', {}, 'Mọi level đã giải, coin và chuỗi Daily sẽ mất. Không thể hoàn tác.'),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn', onclick: () => close() }, 'Huỷ'),
        h('button', {
          class: 'btn danger',
          onclick: () => {
            app.save = resetSave();
            persist();
            close();
            toast('Đã xoá tiến trình');
            showSettings();
          },
        }, 'Xoá'))));
  }

  // Khi xoay màn hình / đổi cỡ cửa sổ: tính lại cỡ ô và vẽ lại bàn.
  window.addEventListener('resize', () => {
    if (app.screen !== 'game' || app.busy) return;
    app.view.setSize(cellSize(app.puzzle.board));
    drawBoard();
  });

  // Vào game: mở thẳng level đang dở (giống nút Play lớn, GDD 7.1).
  startLevel(currentLevel(app.save.progress, totalLevels));
  app.actions = { startLevel, startDaily, showLevelSelect, showShop, showSettings, onSquareTap };
  return app;
}
