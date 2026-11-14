// =============================================================================
// ui/app.js — Giao diện game: các màn hình và cách nối logic với hình ảnh.
//
// Màn hình:
//   - Màn chơi: level chính, Daily, mode Obstacle, mode Blitz Mate (đua giờ).
//     Màn mở đầu khi vào game là level chính đang dở.
//   - Chọn level: lưới số theo chương, kèm nút Daily, Shop, Cài đặt, Obstacle,
//     Blitz Mate, Trophy.
//   - Obstacle (chọn bài), Blitz Mate (giới thiệu + kỷ lục), Trophy, Shop, Cài đặt.
//   Hộp nổi: gợi ý, phong cấp, chiến thắng, quảng cáo giả lập, Starter Bundle,
//   kết quả Blitz, xác nhận.
//
// Kiếm tiền theo "Kế hoạch MKT The Rook Chess": KHÔNG có quảng cáo xen giữa level,
// không thưởng coin bằng quảng cáo; rewarded chỉ 1 lượt/ngày khi đã sai 2 lần, đổi
// lấy 1 gợi ý. Rook Pass, Starter Bundle, skin, mode đều là mua GIẢ LẬP.
//
// Logic (puzzle / economy / store / progress / modes / trophies / storage) nằm ở
// src/, không biết gì về giao diện. File này chỉ: nhận thao tác của người chơi →
// gọi logic → vẽ lại và chạy animation, âm thanh. Thứ tự gọi khi thắng xem CLAUDE.md.
// =============================================================================

import { h, wait, nextFrame } from './dom.js';
import { createBoardView } from './board-view.js';
import { pieceSvg, SKIN_CONFETTI } from './pieces.js';
import { sounds, setSoundEnabled } from './sound.js';
import { themeForLevel, DAILY_THEME, BLITZ_THEME, applyTheme } from './themes.js';
import { parseSquare, squareName, colorOf, opponent } from '../board.js';
import { inCheck, findKing } from '../movegen.js';
import {
  createPuzzle, playerMove, opponentMove, undoMove, getHint, legalTargets,
  needsPromotion, summary, canUndo, canHint, PLAYER_TURN, ENDED, WON,
} from '../puzzle.js';
import { hintCost, spendForHint, addSolveReward, canWatchHintAd, useHintAd } from '../economy.js';
import {
  ensureInstallDate, hasPass, passDaysLeft, startPassTrial, subscribePass, owns, starterAvailable,
  starterDaysLeft, buy, equip, activeSkins, canPlayModeLevel, SKINS, MODES, PRODUCTS, FREE_MODE_LEVELS,
} from '../store.js';
import {
  markSolved, levelStatus, currentLevel, dateKey, dailyIndex, completeDaily,
  isDailySolved, currentStreak,
} from '../progress.js';
import { markObstacleSolved, obstacleSolvedCount, recordBlitz, blitzWeekBest, blitzQueue, BLITZ_SECONDS } from '../modes.js';
import { TROPHIES, TIERS, collectStats, evaluateTrophies, trophyCounts } from '../trophies.js';
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
/** Thời gian quảng cáo giả lập (giây) trước khi nút đóng bấm được. */
const AD_SECONDS = 5;
/** Màu huy chương Trophy theo hạng. */
const TIER_COLORS = { bronze: '#c98b4f', silver: '#c3ccd6', gold: '#f2c14e', platinum: '#a9e3f0' };

/** Icon SVG nhỏ dùng trên nút (tự vẽ). */
const ICONS = {
  grid: `<svg viewBox="0 0 24 24"><g fill="currentColor">${[4, 12, 20].flatMap((y) => [4, 12, 20].map((x) => `<circle cx="${x}" cy="${y}" r="3"/>`)).join('')}</g></svg>`,
  back: '<svg viewBox="0 0 24 24"><path d="M15 3 L6 12 L15 21" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 16.5 C9 14 7 13 7 10 a5 5 0 0 1 10 0 c0 3 -2 4 -2 6.5 Z"/><path d="M9.5 19 h5"/><path d="M10.5 21.3 h3"/><path d="M12 1.6 v1.8 M4.2 4.4 l1.3 1.3 M19.8 4.4 l-1.3 1.3 M1.8 10.5 h1.8 M20.4 10.5 h1.8 M5.5 15.8 l-1.2 1.2 M18.5 15.8 l1.2 1.2"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4.5 L4.5 8.5 L8.5 12.5"/><path d="M4.8 8.5 H13 a6 6 0 0 1 0 12 H9"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5 L13 12 L5 19 Z"/><path d="M13 5 L21 12 L13 19 Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f2c14e" stroke="#b9852a" stroke-width="1.6"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#b9852a" stroke-width="1.3"/><path d="M12 8.2 v7.6" stroke="#b9852a" stroke-width="1.6" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10 h17 M8 3 v4 M16 3 v4" stroke-linecap="round"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8 h16 l-1.3 11.2 a2 2 0 0 1 -2 1.8 H7.3 a2 2 0 0 1 -2 -1.8 Z"/><path d="M8.5 10 V7 a3.5 3.5 0 0 1 7 0 v3" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 v2.6 M12 18.6 v2.6 M2.8 12 h2.6 M18.6 12 h2.6 M5.5 5.5 l1.8 1.8 M16.7 16.7 l1.8 1.8 M5.5 18.5 l1.8 -1.8 M16.7 7.3 l1.8 -1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="6.6"/></svg>',
  stone: '<svg viewBox="0 0 24 24"><path d="M4 8 Q5 4 9 4 L16 3.6 Q20 4 20.5 8 L21 16 Q20.5 20 16.5 20.4 L7.5 20.4 Q3.6 20 3.6 16 Z" fill="currentColor"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2 L4.5 13.5 H11 L9.5 22 L19.5 9.5 H13 Z" fill="currentColor"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4 h10 v5 a5 5 0 0 1 -10 0 Z"/><path d="M7 6 H4 a3 3 0 0 0 3 4 M17 6 h3 a3 3 0 0 1 -3 4" stroke-linecap="round"/><path d="M12 14 v4 M8 21 h8 M9.5 18 h5" stroke-linecap="round"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8 L7.5 12 L12 5 L16.5 12 L21 8 L19 18 H5 Z" fill="currentColor"/><rect x="5" y="19.2" width="14" height="2" rx="1" fill="currentColor"/></svg>',
};

const icon = (name, cls = 'icon') => h('span', { class: cls, html: ICONS[name] });

/** Huy chương Trophy (vòng tròn màu theo hạng, có ngôi sao). */
const medal = (tier, dim = false) => h('span', {
  class: `medal ${tier}${dim ? ' dim' : ''}`,
  html: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${TIER_COLORS[tier]}" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/><path d="M12 6.2 L13.7 10 L17.8 10.3 L14.6 12.9 L15.7 16.9 L12 14.7 L8.3 16.9 L9.4 12.9 L6.2 10.3 L10.3 10 Z" fill="rgba(255,255,255,.85)"/></svg>`,
});

/** Tách chuỗi nước như "d1a1" hoặc "a5a6q" thành chỉ số ô { from, to }. */
function parseMoveText(board, text) {
  const [, from, to] = /^([a-z]\d+)([a-z]\d+)/.exec(text);
  return { from: parseSquare(board, from), to: parseSquare(board, to) };
}

/** Tên tháng tiếng Việt cho tiêu đề Daily, ví dụ "12 tháng 11". */
function dailyTitle(key) {
  return `${Number(key.slice(6, 8))} tháng ${Number(key.slice(4, 6))}`;
}

/** Hôm nay dạng "yyyymmdd" theo giờ máy người chơi. */
const today = () => dateKey(new Date());

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
    mode: 'main',          // 'main' | 'daily' | 'obstacle' | 'blitz'
    modeIndex: 0,          // chỉ số bài Obstacle đang chơi
    dailyKey: null,
    previewSkin: null,     // { board } hoặc { pieces }: skin đang xem thử trong Daily
    blitz: null,           // lượt Blitz đang chạy (xem startBlitzRun)
    selected: null,        // ô quân đang chọn
    targets: [],           // các ô đi được của quân đang chọn
    hint: null,            // { from, to } đang tô sáng
    lastMove: null,
    busy: false,           // đang chạy animation / bộ giải: khoá thao tác (trạng thái ANIMATING)
    view: null,
  };
  ensureInstallDate(save.store, today());
  setSoundEnabled(save.settings.sound);

  const persist = () => writeSave(app.save);
  persist();
  const totalLevels = data.levels.length;
  const store = () => app.save.store;
  const passActive = () => hasPass(store(), today());

  // -------------------------------------------------------------------------
  // Tiện ích hiển thị
  // -------------------------------------------------------------------------

  /** Hiện thông báo ngắn ở giữa màn hình. */
  function toast(text) {
    document.querySelector('.toast')?.remove();
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.remove(), 1600);
  }

  /** Mở một hộp nổi (overlay). Trả về hàm đóng. */
  function openOverlay(content, { onClose, dismissable = true, cls = '' } = {}) {
    const overlay = h('div', { class: `overlay ${cls}` }, content);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
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

  /** Tính cỡ ô để bàn vừa màn hình: rộng tối đa trừ lề, cao tối đa ~50% màn hình. */
  function cellSize(board) {
    const w = Math.min(window.innerWidth, 520) - 48;
    const hgt = window.innerHeight * 0.5;
    return Math.max(36, Math.floor(Math.min(w / board.width, hgt / board.height, 118)));
  }

  /**
   * Skin đang vẽ: skin người chơi đã trang bị (store.activeSkins), riêng trong Daily
   * có thể đang "xem thử" một skin chưa mua (app.previewSkin) — theo kế hoạch MKT:
   * "Xem thử miễn phí trong Daily Mate".
   */
  function skinsNow() {
    const base = activeSkins(store(), today());
    return app.mode === 'daily' && app.previewSkin ? { ...base, ...app.previewSkin } : base;
  }

  /**
   * Xét lại Trophy sau khi có kết quả mới; trophy nào vừa đạt thì hiện thông báo
   * (lần lượt từng cái). Trả về danh sách trophy vừa đạt.
   */
  function checkTrophies() {
    const fresh = evaluateTrophies(app.save.trophies, collectStats(app.save, data), today());
    if (fresh.length) persist();
    fresh.forEach((t, i) => setTimeout(() => {
      const el = h('div', { class: `trophy-toast ${t.tier}`, role: 'status' },
        medal(t.tier), h('span', {}, h('small', {}, `Trophy ${TIERS[t.tier]}`), h('strong', {}, t.name)));
      document.body.append(el);
      sounds.coin();
      setTimeout(() => el.remove(), 2600);
    }, 1200 + i * 2000));
    return fresh;
  }

  // -------------------------------------------------------------------------
  // Mở màn chơi
  // -------------------------------------------------------------------------

  /** Dừng lượt Blitz đang chạy (nếu có) mà không ghi kết quả, ví dụ khi rời màn hình. */
  function abandonBlitz() {
    if (app.blitz && !app.blitz.over) {
      app.blitz.over = true;
      clearInterval(app.blitz.timer);
    }
  }

  /** Bắt đầu level chính `id`. */
  function startLevel(id) {
    abandonBlitz();
    app.mode = 'main';
    app.previewSkin = null;
    openPuzzle(data.levels[id - 1], themeForLevel(id));
  }

  /**
   * Bắt đầu Daily Puzzle của hôm nay. `preview` (không bắt buộc) là skin muốn
   * xem thử, ví dụ { board: 'neon' } — chỉ áp trong ván Daily này.
   */
  function startDaily(preview = null) {
    abandonBlitz();
    app.mode = 'daily';
    app.previewSkin = preview;
    app.dailyKey = today();
    const level = data.daily[dailyIndex(app.dailyKey, data.daily.length)];
    openPuzzle(level, DAILY_THEME);
  }

  /** Bắt đầu bài Obstacle thứ `index` (đếm từ 0). Chưa mở khoá thì về màn Obstacle. */
  function startObstacle(index) {
    abandonBlitz();
    if (!canPlayModeLevel(store(), 'obstacle', index, today())) {
      toast('Bài này cần mở khoá mode Obstacle');
      showObstacle();
      return;
    }
    app.mode = 'obstacle';
    app.modeIndex = index;
    app.previewSkin = null;
    openPuzzle(data.modes.obstacle[index], themeForLevel(index + 3));
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

  /** Dòng chữ nhỏ trên tiêu đề, tuỳ mode. */
  function subtitleText() {
    const p = app.puzzle;
    if (app.mode === 'daily') {
      // Đang xem thử skin thì ghi tên skin thay cho ngày (cho gọn một dòng).
      if (app.previewSkin) {
        const [kind, id] = Object.entries(app.previewSkin)[0];
        return `Xem thử: ${kind === 'board' ? 'bàn' : 'quân'} ${SKINS[kind][id].name}`;
      }
      return dailyTitle(app.dailyKey);
    }
    if (app.mode === 'obstacle') return `Obstacle ${app.modeIndex + 1}/${data.modes.obstacle.length}`;
    if (app.mode === 'blitz') {
      const left = Math.max(0, Math.ceil((app.blitz.endsAt - Date.now()) / 1000));
      const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      return `Blitz · ${clock} · ${app.blitz.score} thế`;
    }
    return `Level ${p.level.id}`;
  }

  /** Vẽ khung màn chơi: thanh trên, bàn cờ, 2 nút dưới. */
  function renderGameScreen() {
    const p = app.puzzle;
    const backTo = { daily: showLevelSelect, obstacle: showObstacle, blitz: () => { abandonBlitz(); showBlitz(); } }[app.mode];
    const left = backTo
      ? h('button', { class: 'icon-btn', 'aria-label': 'Quay lại', onclick: () => { sounds.tap(); backTo(); } }, icon('back'))
      : h('button', { class: 'icon-btn', 'aria-label': 'Chọn level', onclick: () => { sounds.tap(); showLevelSelect(); } }, icon('grid'));

    const view = createBoardView({ onSquareTap });
    app.view = view;
    view.setSize(cellSize(p.board));
    view.setStyle({ ...skinsNow(), obstacles: app.mode === 'obstacle' });

    // Blitz: không có gợi ý (đua giờ), thay bằng nút "Bỏ qua" sang thế tiếp theo.
    const hintBtn = app.mode === 'blitz'
      ? h('button', { class: 'round-btn hint-btn skip-btn', 'aria-label': 'Bỏ qua thế này', onclick: onBlitzSkip }, icon('skip', 'round-icon'))
      : h('button', { class: 'round-btn hint-btn', 'aria-label': 'Gợi ý', onclick: openHintSheet }, icon('bulb', 'round-icon'));
    const undoBtn = h('button', { class: 'round-btn undo-btn', 'aria-label': 'Đi lại', onclick: onUndo }, icon('undo', 'round-icon'));

    const screen = h('main', { class: `screen game-screen mode-${app.mode}` },
      h('header', { class: 'game-top' },
        h('div', { class: 'top-left' }, left),
        h('div', { class: 'title-block' },
          h('div', { class: 'subtitle' }, subtitleText()),
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
    h('span', { class: 'side-pawn', html: pieceSvg(color === 'w' ? 'P' : 'p', skinsNow().pieces) }),
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
    // Ván dừng: vòng sáng quanh nút Undo để người chơi biết bấm vào đâu.
    app.buttons.undoBtn.classList.toggle('attention', p.state === ENDED && !app.busy && app.mode !== 'blitz');
    app.buttons.hintBtn.disabled = app.mode === 'blitz' ? app.busy : (p.state !== PLAYER_TURN || app.busy);
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
      app.selected = null; // chạm lại quân đang chọn, ô trống hoặc vật cản → bỏ chọn
      app.targets = [];
    }
    drawBoard();
  }

  /** Hỏi quân phong cấp. Trả về Promise với chữ 'q' | 'r' | 'b' | 'n', hoặc null nếu huỷ. */
  function askPromotion() {
    return new Promise((resolve) => {
      let chosen = null;
      const color = playerColor();
      const skin = skinsNow().pieces;
      const choice = (t) => h('button', {
        class: 'promo-choice',
        'aria-label': { q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã' }[t],
        onclick: () => { chosen = t; close(); },
      }, h('span', { class: 'promo-piece', html: pieceSvg(color === 'w' ? t.toUpperCase() : t, skin) }));
      const close = openOverlay(
        h('div', { class: 'dialog promo-dialog' }, h('h2', {}, 'Phong cấp thành'), h('div', { class: 'promo-row' }, ['q', 'r', 'b', 'n'].map(choice))),
        { onClose: () => resolve(chosen) },
      );
    });
  }

  /** Đi nước từ `from` tới `to`: animation → gọi logic → phản hồi. */
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
    // Sau mỗi lần chờ, kiểm tra người chơi chưa rời màn chơi này (bấm quay lại,
    // hết giờ Blitz...). Rời rồi thì dừng, không đụng tới bàn cờ cũ nữa.
    const stillHere = () => app.puzzle === p && app.screen === 'game';

    // ANIMATING: cho quân trượt trước, rồi mới gọi logic (bộ giải có thể mất vài trăm ms).
    await app.view.animateMove(from, to);
    if (!stillHere()) return;
    capture ? sounds.capture() : sounds.move();
    await nextFrame();
    if (!stillHere()) return;
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
    if (!stillHere()) return;
    // opponentMove() đổi dữ liệu bàn ngay, nhưng màn hình vẫn đang vẽ thế cũ,
    // nên cho quân trên màn hình trượt theo nước vừa đi rồi mới vẽ lại.
    const reply = opponentMove(p);
    const { from: rFrom, to: rTo } = parseMoveText(p.board, reply.move);
    const replyCaptures = app.view.pieces.has(rTo);
    await app.view.animateMove(rFrom, rTo);
    if (!stillHere()) return;
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
   * đổi tiêu đề, nhắc nhẹ bấm Undo. Blitz thì tự sang thế tiếp theo.
   */
  function onEnded(reason) {
    app.busy = false;
    drawBoard();
    sounds.wrong();
    if (app.mode === 'blitz') {
      toast('Bỏ qua, sang thế tiếp theo');
      app.busy = true;
      setTimeout(() => { if (app.mode === 'blitz') nextBlitzPuzzle(); }, 700);
      return;
    }
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
  // Gợi ý (coin) và rewarded (1 lượt/ngày khi đã sai 2 lần)
  // -------------------------------------------------------------------------

  /** Mở bảng chọn mức gợi ý. */
  function openHintSheet() {
    if (app.busy || app.puzzle.state !== PLAYER_TURN) return;
    sounds.tap();
    // Đã đi lệch thì thế cờ này không còn nước đúng nào để gợi ý: nhắc Undo,
    // không mở bảng mua gợi ý (không để người chơi mất coin vô ích).
    if (!canHint(app.puzzle)) {
      toast('Từ thế này không còn chiếu hết kịp. Bấm Undo để quay lại');
      return;
    }
    const eco = app.save.economy;
    const pass = passActive();
    const option = (level, title, desc) => {
      const cost = hintCost(level, pass);
      return h('button', {
        class: 'sheet-option',
        disabled: eco.coins < cost,
        onclick: () => { close(); useHint(level); },
      }, h('span', { class: 'opt-text' }, h('strong', {}, title), h('small', {}, desc)),
      pass
        ? h('span', { class: 'price free' }, 'Rook Pass')
        : h('span', { class: 'price' }, icon('coin', 'coin-icon'), String(cost)));
    };
    // Rewarded theo kế hoạch MKT: chỉ hiện khi đã sai ≥ 2 lần ở bài này, 1 lượt/ngày,
    // người có Rook Pass không thấy (gợi ý của họ đã miễn phí).
    const showAdOption = canWatchHintAd(eco, today(), { wrongMoves: app.puzzle.wrongMoves, hasPass: pass });
    const close = openOverlay(h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h2', {}, 'Gợi ý'), coinPill()),
      option(1, 'Quân cần đi', 'Tô sáng quân bạn nên đi'),
      option(2, 'Nước tiếp theo', 'Hiện ô đi và ô đến'),
      option(3, 'Toàn bộ lời giải', 'Mọi nước còn lại, cả nước đáp của đối thủ'),
      showAdOption && h('button', {
        class: 'sheet-option ad-option',
        onclick: () => { close(); showAd({ label: 'Xem hết để nhận 1 gợi ý', then: rewardHint }); },
      }, h('span', { class: 'opt-text' }, h('strong', {}, 'Xem quảng cáo, nhận 1 gợi ý'), h('small', {}, 'Bạn đã thử nhiều lần · 1 lượt mỗi ngày')),
      h('span', { class: 'price free' }, 'Miễn phí'))), { cls: 'sheet-overlay' });
  }

  /** Xem xong rewarded: trừ lượt hôm nay và hiện gợi ý "nước tiếp theo" miễn phí. */
  function rewardHint() {
    if (!useHintAd(app.save.economy, today()).ok) { toast('Hôm nay đã dùng lượt quảng cáo'); return; }
    persist();
    showHint(2);
  }

  /** Trả coin (hoặc miễn phí với Rook Pass) và hiện gợi ý mức `level`. */
  function useHint(level) {
    const pay = spendForHint(app.save.economy, level, passActive());
    if (!pay.ok) { toast('Không đủ coin'); return; }
    persist();
    refreshCoins();
    showHint(level);
  }

  /** Lấy gợi ý mức `level` từ puzzle và tô lên bàn (mức 3 thì hiện hộp lời giải). */
  function showHint(level) {
    const hint = getHint(app.puzzle, level);
    if (hint.offTrack) return;
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

  /**
   * Màn quảng cáo giả lập 5 giây (chỉ dùng cho rewarded đổi gợi ý). Nút đóng to,
   * đặt ở dưới, dễ bấm; xem hết mới gọi `then`.
   */
  function showAd({ label, then } = {}) {
    let left = AD_SECONDS;
    const counter = h('span', { class: 'ad-count' }, String(left));
    const closeBtn = h('button', { class: 'btn primary ad-close', disabled: true, onclick: () => finish() }, 'Nhận gợi ý');
    const close = openOverlay(h('div', { class: 'ad-box' },
      h('div', { class: 'ad-label' }, 'Quảng cáo (giả lập)'),
      h('div', { class: 'ad-art', html: pieceSvg('N', skinsNow().pieces) }),
      h('p', {}, label ?? 'Đây là quảng cáo giả lập cho bài tập.'),
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
      then?.();
    }
  }

  // -------------------------------------------------------------------------
  // Thắng
  // -------------------------------------------------------------------------

  /** Chiếu hết: Vua đổ, pháo giấy, cộng coin, lưu tiến trình, Trophy, hộp chiến thắng. */
  async function onWin() {
    const p = app.puzzle;
    const s = summary(p);
    sounds.win();
    vibrate(60);
    app.view.topple(findKing(p.board, opponent(playerColor())));

    if (app.mode === 'blitz') {
      onBlitzSolved();
      return;
    }
    confetti();

    let firstTime;
    let extra = null;
    let nextLabel = 'Level tiếp';
    let goNext;
    let offerStarter = false;
    if (app.mode === 'daily') {
      const d = completeDaily(app.save.progress, app.dailyKey);
      firstTime = d.firstTime;
      extra = `Chuỗi ${d.streak} ngày liên tiếp`;
      nextLabel = 'Xong';
      goNext = showLevelSelect;
      // Kế hoạch MKT: hiện Starter Bundle sau Daily Mate đầu tiên.
      offerStarter = firstTime && app.save.progress.daily.solvedDates.length === 1;
    } else if (app.mode === 'obstacle') {
      firstTime = markObstacleSolved(app.save.modes, app.modeIndex, { perfect: s.perfect }).firstTime;
      const next = app.modeIndex + 1;
      const hasNext = next < data.modes.obstacle.length && canPlayModeLevel(store(), 'obstacle', next, today());
      nextLabel = hasNext ? 'Bài tiếp' : 'Xong';
      goNext = hasNext ? () => startObstacle(next) : showObstacle;
    } else {
      firstTime = markSolved(app.save.progress, p.level.id, { hintUsed: s.hintUsed, perfect: s.perfect, totalLevels }).firstTime;
      const isLast = p.level.id >= totalLevels;
      nextLabel = isLast ? 'Xong' : 'Level tiếp';
      goNext = isLast ? showLevelSelect : () => startLevel(p.level.id + 1);
      // Kế hoạch MKT: hiện Starter Bundle khi giải xong bài thứ 10.
      offerStarter = firstTime && p.level.id === 10;
    }
    const gained = addSolveReward(app.save.economy, { firstTime, perfect: s.perfect, daily: app.mode === 'daily' });
    persist();
    checkTrophies();

    await wait(900);
    const next = () => {
      close();
      if (offerStarter && starterAvailable(store(), today())) showStarterOffer(goNext);
      else goNext();
    };
    const close = openOverlay(h('div', { class: 'dialog win-dialog' },
      h('div', { class: 'win-crown', html: pieceSvg(playerColor() === 'w' ? 'K' : 'k', skinsNow().pieces) }),
      h('h2', {}, 'Chiếu hết!'),
      h('p', { class: 'win-sub' }, s.perfect ? 'Hoàn hảo: không gợi ý, không đi lệch' : 'Giỏi lắm!'),
      extra && h('p', { class: 'streak' }, extra),
      h('div', { class: 'reward' }, icon('coin', 'coin-icon big'), h('span', {}, gained > 0 ? `+${gained}` : 'Đã giải trước đó')),
      h('button', { class: 'btn primary', onclick: next }, nextLabel)),
    { dismissable: false, cls: 'win-overlay' });
    if (gained > 0) {
      sounds.coin();
      refreshCoins();
    }
  }

  /** Pháo giấy rơi khi chiến thắng; màu theo skin quân đang dùng ("hiệu ứng chiếu hết" của skin). */
  function confetti() {
    const colors = SKIN_CONFETTI[skinsNow().pieces] ?? SKIN_CONFETTI.ivory;
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
  // Blitz Mate
  // -------------------------------------------------------------------------

  /**
   * Bắt đầu một lượt Blitz: trộn bộ bài, đặt đồng hồ BLITZ_SECONDS giây. Chưa có
   * mode Blitz thì là lượt chơi thử, dừng sau FREE_MODE_LEVELS thế.
   */
  function startBlitzRun() {
    abandonBlitz();
    app.previewSkin = null;
    app.blitz = {
      queue: blitzQueue(data.modes.blitz.length),
      pos: 0,
      score: 0,
      endsAt: Date.now() + BLITZ_SECONDS * 1000,
      trial: !owns(store(), 'mode:blitz', today()),
      over: false,
      timer: null,
    };
    app.blitz.timer = setInterval(tickBlitz, 250);
    nextBlitzPuzzle();
  }

  /** Mỗi 1/4 giây: cập nhật đồng hồ trên tiêu đề, hết giờ thì kết thúc. */
  function tickBlitz() {
    const b = app.blitz;
    if (!b || b.over) return;
    if (Date.now() >= b.endsAt) { endBlitz('time'); return; }
    const sub = document.querySelector('.mode-blitz .subtitle');
    if (sub) {
      sub.textContent = subtitleText();
      sub.classList.toggle('hurry', b.endsAt - Date.now() < 20000);
    }
  }

  /** Mở thế Blitz tiếp theo (hết lượt chơi thử thì kết thúc). */
  function nextBlitzPuzzle() {
    const b = app.blitz;
    if (!b || b.over) return;
    if (b.trial && b.pos >= FREE_MODE_LEVELS) { endBlitz('trial'); return; }
    const level = data.modes.blitz[b.queue[b.pos % b.queue.length]];
    b.pos++;
    app.mode = 'blitz';
    openPuzzle(level, BLITZ_THEME);
  }

  /** Giải xong một thế Blitz: +1 điểm, sang thế tiếp theo ngay. */
  function onBlitzSolved() {
    const b = app.blitz;
    if (!b || b.over) return; // hết giờ đúng lúc vừa chiếu hết: không tính nữa
    b.score++;
    toast(`+1 · ${b.score} thế`);
    sounds.coin();
    setTimeout(() => { if (app.mode === 'blitz' && !b.over) nextBlitzPuzzle(); }, 550);
  }

  /** Nút "Bỏ qua" trong Blitz. */
  function onBlitzSkip() {
    if (app.busy) return;
    sounds.tap();
    nextBlitzPuzzle();
  }

  /** Kết thúc lượt Blitz (`reason` 'time' hoặc 'trial'): ghi kỷ lục, Trophy, hộp kết quả. */
  function endBlitz(reason) {
    const b = app.blitz;
    if (!b || b.over) return;
    b.over = true;
    clearInterval(b.timer);
    app.busy = true; // khoá bàn cờ phía sau hộp kết quả
    const r = recordBlitz(app.save.modes, b.score, today());
    persist();
    checkTrophies();
    sounds.win();
    const close = openOverlay(h('div', { class: 'dialog blitz-result' },
      h('h2', {}, reason === 'time' ? 'Hết giờ!' : 'Hết lượt chơi thử'),
      h('div', { class: 'blitz-score' }, String(b.score), h('small', {}, 'thế cờ')),
      r.newBest && b.score > 0 ? h('p', { class: 'streak' }, 'Kỷ lục mới!') : null,
      h('p', {}, `Kỷ lục: ${r.best} · Tuần này: ${r.weekBest}`),
      reason === 'trial' && h('p', { class: 'note' }, `Bạn đã chơi thử ${FREE_MODE_LEVELS} thế. Mở khoá Blitz Mate để chơi trọn ${BLITZ_SECONDS / 60} phút.`),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn', onclick: () => { close(); showBlitz(); } }, 'Về menu'),
        reason === 'trial'
          ? h('button', { class: 'btn primary', onclick: () => { close(); showShop(); } }, 'Mở khoá')
          : h('button', { class: 'btn primary', onclick: () => { close(); startBlitzRun(); } }, 'Chơi lại'))),
    { dismissable: false });
  }

  // -------------------------------------------------------------------------
  // Màn chọn level (trung tâm)
  // -------------------------------------------------------------------------

  /** Màn chọn level: lưới số theo chương; nút Daily, Shop, Cài đặt, Obstacle, Blitz, Trophy. */
  function showLevelSelect() {
    abandonBlitz();
    app.screen = 'levels';
    app.previewSkin = null;
    applyTheme(themeForLevel(currentLevel(app.save.progress, totalLevels)));
    const progress = app.save.progress;
    const day = today();
    const streak = currentStreak(progress, day);
    const tcount = Object.keys(app.save.trophies.unlocked).length;

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

    const hub = (cls, ic, title, sub, onclick) => h('button', { class: `hub-btn ${cls}`, onclick: () => { sounds.tap(); onclick(); } },
      icon(ic), h('span', {}, h('strong', {}, title), sub && h('small', {}, sub)));

    root.replaceChildren(h('main', { class: 'screen list-screen' },
      h('header', { class: 'list-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Về màn chơi', onclick: () => { sounds.tap(); startLevel(currentLevel(progress, totalLevels)); } }, icon('back')),
        h('h1', {}, 'Chọn level'),
        coinPill()),
      h('div', { class: 'hub-row' },
        hub('daily', 'calendar', 'Daily', isDailySolved(progress, day) ? 'Đã giải hôm nay' : streak > 0 ? `Chuỗi ${streak} ngày` : 'Hôm nay', () => startDaily()),
        hub('', 'shop', 'Shop', passActive() ? 'Rook Pass' : starterAvailable(store(), day) ? 'Ưu đãi' : null, showShop),
        hub('', 'gear', 'Cài đặt', null, showSettings)),
      h('div', { class: 'hub-row' },
        hub('', 'stone', 'Obstacle', `${obstacleSolvedCount(app.save.modes)}/${data.modes.obstacle.length}`, showObstacle),
        hub('', 'bolt', 'Blitz', `Tuần ${blitzWeekBest(app.save.modes, day)}`, showBlitz),
        hub('', 'trophy', 'Trophy', `${tcount}/${TROPHIES.length}`, showTrophies)),
      h('div', { class: 'chapters' }, chapters)));
  }

  // -------------------------------------------------------------------------
  // Màn phụ: Obstacle, Blitz, Trophy, Shop, Cài đặt
  // -------------------------------------------------------------------------

  /** Khung chung cho màn phụ: nút back, tiêu đề, nội dung. */
  function subScreen(title, body, onBack = showLevelSelect) {
    root.replaceChildren(h('main', { class: 'screen list-screen' },
      h('header', { class: 'list-top' },
        h('button', { class: 'icon-btn', 'aria-label': 'Quay lại', onclick: () => { sounds.tap(); onBack(); } }, icon('back')),
        h('h1', {}, title),
        coinPill()),
      body));
  }

  /** Thẻ "mở khoá mode": chưa có mode thì mời mua / dùng Rook Pass. */
  function unlockCard(mode) {
    if (owns(store(), `mode:${mode}`, today())) return null;
    return h('div', { class: 'info-card' },
      h('p', {}, `Chơi thử miễn phí ${FREE_MODE_LEVELS} ${mode === 'blitz' ? 'thế đầu mỗi lượt' : 'bài đầu'}. Mở khoá cả mode: ${PRODUCTS[`mode:${mode}`].price} (giả lập) hoặc dùng Rook Pass.`),
      h('button', { class: 'btn primary', onclick: () => { sounds.tap(); showShop(); } }, 'Đến Shop'));
  }

  /** Màn mode Obstacle: lưới 20 bài, 5 bài đầu miễn phí. */
  function showObstacle() {
    abandonBlitz();
    app.screen = 'obstacle';
    app.mode = 'obstacle';
    applyTheme(themeForLevel(3));
    const list = data.modes.obstacle;
    const tile = (level, i) => {
      const playable = canPlayModeLevel(store(), 'obstacle', i, today());
      const solved = Boolean(app.save.modes.obstacle.solved[i]);
      const st = solved ? 'solved' : playable ? 'open' : 'locked';
      return h('button', {
        class: `level-tile ${st}`,
        'aria-label': `Obstacle ${i + 1}, mate in ${level.mateIn}${st === 'locked' ? ', cần mở khoá' : st === 'solved' ? ', đã giải' : ''}`,
        onclick: () => { sounds.tap(); startObstacle(i); },
      }, st === 'locked' ? icon('lock', 'tile-icon') : String(i + 1),
      st === 'solved' && icon('check', 'tile-check'),
      h('span', { class: 'tile-sub' }, `M${level.mateIn}`));
    };
    subScreen('Obstacle', h('div', { class: 'list-body' },
      h('p', { class: 'note' }, MODES.obstacle.desc + '. Mã vẫn nhảy qua vật cản được.'),
      unlockCard('obstacle'),
      h('div', { class: 'level-grid' }, list.map(tile))));
  }

  /** Màn giới thiệu Blitz Mate: luật, kỷ lục, nút bắt đầu. */
  function showBlitz() {
    abandonBlitz();
    app.screen = 'blitz';
    app.mode = 'blitz';
    applyTheme(BLITZ_THEME);
    const m = app.save.modes.blitz;
    subScreen('Blitz Mate', h('div', { class: 'list-body' },
      h('div', { class: 'info-card big' },
        h('p', {}, `Giải càng nhiều thế cờ càng tốt trong ${BLITZ_SECONDS / 60} phút. Thế mate in 1–2, đi lệch tới khi ván dừng thì tự sang thế khác; bấm ⏭ để bỏ qua. Không có gợi ý.`),
        h('div', { class: 'stat-row' },
          h('span', {}, h('small', {}, 'Kỷ lục'), h('strong', {}, String(m.best))),
          h('span', {}, h('small', {}, 'Tuần này'), h('strong', {}, String(blitzWeekBest(app.save.modes, today())))),
          h('span', {}, h('small', {}, 'Số lượt'), h('strong', {}, String(m.runs)))),
        h('button', { class: 'btn primary', onclick: () => { sounds.tap(); startBlitzRun(); } }, 'Bắt đầu')),
      unlockCard('blitz'),
      h('p', { class: 'note' }, 'Bảng xếp hạng tuần với người chơi khác cần máy chủ, bản web chỉ lưu kỷ lục của bạn.')));
  }

  /** Màn Trophy: theo hạng, đã đạt (ngày đạt) / chưa đạt. */
  function showTrophies() {
    app.screen = 'trophies';
    const t = app.save.trophies;
    const counts = trophyCounts(t);
    const item = (tr) => {
      const date = t.unlocked[tr.id];
      return h('div', { class: `trophy-item${date ? ' got' : ''}` },
        medal(tr.tier, !date),
        h('span', { class: 'opt-text' }, h('strong', {}, tr.name), h('small', {}, tr.desc)),
        h('span', { class: 'trophy-date' }, date ? `${Number(date.slice(6, 8))}/${Number(date.slice(4, 6))}` : '—'));
    };
    subScreen('Trophy', h('div', { class: 'list-body' },
      h('div', { class: 'trophy-summary' }, ...['bronze', 'silver', 'gold', 'platinum'].map((tier) =>
        h('span', {}, medal(tier), h('strong', {}, String(counts[tier])), h('small', {}, TIERS[tier])))),
      ...['platinum', 'gold', 'silver', 'bronze'].map((tier) => h('section', { class: 'trophy-group' },
        h('h2', {}, TIERS[tier]), ...TROPHIES.filter((tr) => tr.tier === tier).map(item))),
      h('p', { class: 'note' }, 'Trophy lưu trên máy này. Phần "% người chơi đạt" cần máy chủ hoặc Game Center / Play Games, chưa có ở bản web.')));
  }

  /** Hộp mời mua Starter Bundle (hiện sau Daily đầu tiên và khi giải xong level 10). */
  function showStarterOffer(then) {
    const p = PRODUCTS['starter-bundle'];
    const close = openOverlay(h('div', { class: 'dialog' },
      h('h2', {}, 'Starter Bundle'),
      h('p', {}, `Mode Obstacle + bàn Cẩm thạch + quân Cẩm thạch. ${p.price} (giả lập), chỉ còn ${starterDaysLeft(store(), today())} ngày.`),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn', onclick: () => { close(); then(); } }, 'Để sau'),
        h('button', { class: 'btn primary', onclick: () => { buyProduct('starter-bundle'); close(); then(); } }, 'Mua'))),
    { onClose: () => {} });
  }

  /** "Mua" một sản phẩm (giả lập) và báo kết quả. */
  function buyProduct(id) {
    const r = buy(store(), id, today());
    if (!r.ok) {
      toast(r.reason === 'expired' ? 'Ưu đãi đã hết hạn' : r.reason === 'owned' ? 'Bạn đã có rồi' : 'Không mua được');
      return false;
    }
    persist();
    sounds.coin();
    toast(`Đã mua ${PRODUCTS[id].name} (giả lập)`);
    return true;
  }

  /** Mẫu xem trước skin: bàn 2 ô hoặc cặp quân Mã trắng / đen. */
  function skinSwatch(kind, id) {
    if (kind === 'board') {
      return h('span', { class: 'skin-swatch board-swatch', 'data-skin': id },
        h('i', { class: 'sw light' }), h('i', { class: 'sw dark' }), h('i', { class: 'sw dark' }), h('i', { class: 'sw light' }));
    }
    return h('span', { class: 'skin-swatch piece-swatch' },
      h('span', { html: pieceSvg('N', id) }), h('span', { html: pieceSvg('n', id) }));
  }

  /**
   * Cửa hàng giả lập theo kế hoạch MKT: Rook Pass, Starter Bundle (7 ngày đầu),
   * skin bàn / skin quân / bộ skin, mode. Kèm trang bị skin và xem thử trong Daily.
   */
  function showShop() {
    abandonBlitz();
    app.screen = 'shop';
    const s = store();
    const day = today();
    const pass = hasPass(s, day);
    const refresh = () => showShop();

    const passCard = h('div', { class: 'shop-card pass-card' },
      h('div', { class: 'card-head' }, icon('crown'), h('strong', {}, 'Rook Pass'), h('span', { class: 'price' }, PRODUCTS['rook-pass'].price)),
      h('ul', {},
        h('li', {}, 'Mở mọi mode (Obstacle, Blitz Mate)'),
        h('li', {}, 'Gợi ý không giới hạn, không tốn coin'),
        h('li', {}, 'Skin quân độc quyền "Hoàng gia"'),
        h('li', {}, 'Không thấy quảng cáo')),
      pass
        ? h('p', { class: 'status' }, `Đang dùng · còn ${passDaysLeft(s, day)} ngày`)
        : null,
      h('div', { class: 'dialog-row' },
        !s.pass.trialUsed && h('button', { class: 'btn', onclick: () => { startPassTrial(s, day); persist(); toast('Đã bắt đầu dùng thử 7 ngày'); refresh(); } }, 'Dùng thử 7 ngày'),
        h('button', { class: 'btn primary', onclick: () => { subscribePass(s, day); persist(); sounds.coin(); toast('Đã đăng ký Rook Pass (giả lập)'); refresh(); } }, pass ? 'Gia hạn 30 ngày' : 'Đăng ký')));

    const starter = starterAvailable(s, day) && h('div', { class: 'shop-card starter-card' },
      h('div', { class: 'card-head' }, h('strong', {}, 'Starter Bundle'), h('span', { class: 'price' }, PRODUCTS['starter-bundle'].price)),
      h('p', {}, `Mode Obstacle + bàn Cẩm thạch + quân Cẩm thạch. Chỉ bán ${starterDaysLeft(s, day)} ngày nữa.`),
      h('button', { class: 'btn primary', onclick: () => { buyProduct('starter-bundle'); refresh(); } }, 'Mua (giả lập)'));

    // Một dòng skin: mẫu, tên, trạng thái / nút.
    const skinRow = (kind, id) => {
      const skin = SKINS[kind][id];
      const productId = `${kind}:${id}`;
      const have = owns(s, productId, day);
      const using = activeSkins(s, day)[kind] === id;
      let action;
      if (using) action = h('span', { class: 'price free' }, 'Đang dùng');
      else if (have) action = h('button', { class: 'btn small', onclick: () => { equip(s, kind, id, day); persist(); sounds.tap(); refresh(); } }, 'Dùng');
      else if (skin.exclusive === 'pass') action = h('span', { class: 'price' }, 'Rook Pass');
      else action = h('button', { class: 'btn small primary', onclick: () => { buyProduct(productId); refresh(); } }, PRODUCTS[productId].price);
      const tryIt = !have && !skin.exclusive && h('button', {
        class: 'link-btn',
        onclick: () => { sounds.tap(); startDaily({ [kind]: id }); },
      }, 'Xem thử trong Daily');
      return h('div', { class: 'skin-row' }, skinSwatch(kind, id),
        h('span', { class: 'opt-text' }, h('strong', {}, skin.name), tryIt), action);
    };

    const setRow = (id) => {
      const p = PRODUCTS[id];
      const done = p.grants.every((g) => owns(s, g, day));
      return h('div', { class: 'skin-row' },
        h('span', { class: 'opt-text' }, h('strong', {}, p.name), h('small', {}, 'Rẻ hơn mua lẻ')),
        done ? h('span', { class: 'price free' }, 'Đã có') : h('button', { class: 'btn small primary', onclick: () => { buyProduct(id); refresh(); } }, p.price));
    };

    const modeRow = (mode) => {
      const id = `mode:${mode}`;
      const have = owns(s, id, day);
      return h('div', { class: 'skin-row' },
        h('span', { class: 'mode-icon', html: ICONS[mode === 'obstacle' ? 'stone' : 'bolt'] }),
        h('span', { class: 'opt-text' }, h('strong', {}, MODES[mode].name), h('small', {}, MODES[mode].desc)),
        have ? h('span', { class: 'price free' }, pass && !s.owned.includes(id) ? 'Rook Pass' : 'Đã có')
          : h('button', { class: 'btn small primary', onclick: () => { buyProduct(id); refresh(); } }, PRODUCTS[id].price));
    };

    subScreen('Shop', h('div', { class: 'list-body' },
      h('p', { class: 'note' }, 'Cửa hàng giả lập cho bài tập: bấm mua chỉ mở khoá trong game, không có thanh toán thật.'),
      passCard,
      starter,
      h('h2', { class: 'section-title' }, 'Mode'),
      modeRow('obstacle'), modeRow('blitz'),
      h('h2', { class: 'section-title' }, 'Skin bàn cờ'),
      ...Object.keys(SKINS.board).map((id) => skinRow('board', id)),
      h('h2', { class: 'section-title' }, 'Skin quân cờ'),
      ...Object.keys(SKINS.pieces).map((id) => skinRow('pieces', id)),
      h('h2', { class: 'section-title' }, 'Bộ skin (bàn + quân)'),
      setRow('set:marble'), setRow('set:neon')));
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
      h('p', {}, 'Mọi level đã giải, coin, chuỗi Daily, Trophy và món đã mua (giả lập) sẽ mất. Không thể hoàn tác.'),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn', onclick: () => close() }, 'Huỷ'),
        h('button', {
          class: 'btn danger',
          onclick: () => {
            app.save = resetSave();
            ensureInstallDate(app.save.store, today());
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
  app.actions = {
    startLevel, startDaily, startObstacle, startBlitzRun, endBlitz, showLevelSelect,
    showObstacle, showBlitz, showTrophies, showShop, showSettings, onSquareTap,
  };
  return app;
}
