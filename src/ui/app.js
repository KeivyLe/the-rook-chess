// =============================================================================
// ui/app.js — Giao diện game: các màn hình và cách nối logic với hình ảnh.
//
// Thiết kế cho ĐIỆN THOẠI, một tay:
//   - Thanh tab cố định ở đáy trên mọi màn: Chơi · Daily · Mode · Trophy · Shop,
//     để các tính năng chính luôn trong tầm một chạm (yêu cầu chủ dự án).
//   - Góc trên: bánh răng Cài đặt; viên coin bấm vào là sang Shop.
//   - Màn chơi: tiêu đề "Mate in N", bàn cờ tự co theo chiều cao còn lại của màn
//     hình, 2 nút tròn: Gợi ý và Undo.
//   - Gợi ý chỉ có MỘT loại: mỗi lần bấm, bóng mờ của quân cần đi trượt tới ô đích
//     (lặp lại), quân đó được chọn sẵn; không ghi tên ô. Mate in N → tối đa N lần.
//
// Màn hình: chơi (level chính / Daily / Obstacle / Blitz), chọn level, Mode
// (Daily + Blitz + Obstacle chung một màn), Trophy, Shop, Cài đặt (có chọn ngôn ngữ).
// Mọi chữ hiển thị đi qua t() của ui/i18n.js (15 ngôn ngữ, mặc định tiếng Anh).
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
import { createTranslator, formatDayMonth, formatShortDate, LANGUAGES, normalizeLanguage } from './i18n.js';
import { parseSquare, squareName, colorOf, opponent } from '../board.js';
import { inCheck, findKing } from '../movegen.js';
import {
  createPuzzle, playerMove, opponentMove, undoMove, getHint, legalTargets, needsPromotion,
  summary, canUndo, canHint, rewindToTrack, PLAYER_TURN, ENDED, WON,
} from '../puzzle.js';
import { hintCost, spendForHint, addSolveReward, canWatchHintAd, useHintAd } from '../economy.js';
import {
  ensureInstallDate, hasPass, passDaysLeft, startPassTrial, subscribePass, owns, starterAvailable,
  starterDaysLeft, buy, equip, activeSkins, canPlayModeLevel, SKINS, PRODUCTS, FREE_MODE_LEVELS,
} from '../store.js';
import {
  markSolved, levelStatus, currentLevel, dateKey, dailyIndex, completeDaily,
  isDailySolved, currentStreak,
} from '../progress.js';
import { markObstacleSolved, obstacleSolvedCount, recordBlitz, blitzWeekBest, blitzQueue, BLITZ_SECONDS } from '../modes.js';
import { TROPHIES, collectStats, evaluateTrophies, trophyCounts } from '../trophies.js';
import { loadSave, writeSave, resetSave } from '../storage.js';

/** Thời gian chờ trước khi đối thủ đáp trả, để người chơi kịp nhìn (GDD 7.2). */
const OPPONENT_DELAY = 400;
/** Thời gian quảng cáo giả lập (giây) trước khi nút nhận thưởng bấm được. */
const AD_SECONDS = 5;
/** Màu huy chương Trophy theo hạng. */
const TIER_COLORS = { bronze: '#c98b4f', silver: '#c3ccd6', gold: '#f2c14e', platinum: '#a9e3f0' };
/** Khoá chuỗi (i18n) cho tiêu đề / thông báo khi ván dừng mà chưa thắng. */
const END_KEYS = { 'out-of-moves': 'end.outOfMoves', stalemate: 'end.stalemate', lost: 'end.lost' };

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
  play: '<svg viewBox="0 0 24 24"><path d="M9 3.5 h6 l-1 4 h2.5 l-1.5 5 h-1.5 l1.5 6.5 h-8 l1.5 -6.5 H7 l-1.5 -5 H8 Z" fill="currentColor"/><rect x="5" y="19.5" width="14" height="2.4" rx="1.2" fill="currentColor"/></svg>',
  modes: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".55"/><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".55"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
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
    t: null,               // hàm dịch theo ngôn ngữ đang chọn
    // Trạng thái màn chơi:
    puzzle: null,
    mode: 'main',          // 'main' | 'daily' | 'obstacle' | 'blitz'
    modeIndex: 0,          // chỉ số bài Obstacle đang chơi
    dailyKey: null,
    previewSkin: null,     // { board } hoặc { pieces }: skin đang xem thử trong Daily
    blitz: null,           // lượt Blitz đang chạy (xem startBlitzRun)
    selected: null,        // ô quân đang chọn
    targets: [],           // các ô đi được của quân đang chọn
    hint: null,            // { from, to, promotion } của gợi ý đang hiện
    lastMove: null,
    busy: false,           // đang chạy animation / bộ giải: khoá thao tác (trạng thái ANIMATING)
    view: null,
  };
  ensureInstallDate(save.store, today());
  setSoundEnabled(save.settings.sound);

  const persist = () => writeSave(app.save);
  const totalLevels = data.levels.length;
  const store = () => app.save.store;
  const passActive = () => hasPass(store(), today());
  const lang = () => normalizeLanguage(app.save.settings.language);
  /** Dịch: t('khoá', { tham số }). */
  const t = (key, params) => app.t(key, params);

  /** Đặt ngôn ngữ: tạo hàm dịch mới và cập nhật thuộc tính lang, tiêu đề của trang. */
  function applyLanguage() {
    app.t = createTranslator(lang());
    document.documentElement.lang = lang();
    document.title = t('app.title');
  }
  applyLanguage();
  persist();

  // -------------------------------------------------------------------------
  // Tiện ích hiển thị
  // -------------------------------------------------------------------------

  /** Hiện thông báo ngắn ở giữa màn hình. */
  function toast(text) {
    document.querySelector('.toast')?.remove();
    const el = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(el);
    setTimeout(() => el.remove(), 1700);
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

  /** Viên coin (bấm vào là sang Shop). */
  const coinPill = () => h('button', {
    class: 'coin-pill',
    'aria-label': t('aria.coins', { n: app.save.economy.coins }),
    onclick: () => { sounds.tap(); showShop(); },
  }, icon('coin', 'coin-icon'), h('span', { class: 'coin-count' }, String(app.save.economy.coins)));

  /** Nút bánh răng mở Cài đặt. */
  const gearBtn = () => h('button', { class: 'icon-btn small', 'aria-label': t('settings.title'), onclick: () => { sounds.tap(); showSettings(); } }, icon('gear'));

  /** Cập nhật mọi viên coin đang hiện trên màn hình. */
  function refreshCoins() {
    for (const el of document.querySelectorAll('.coin-count')) el.textContent = String(app.save.economy.coins);
    refreshHintBadge();
  }

  /** Rung điện thoại (nếu người chơi bật và máy hỗ trợ). */
  function vibrate(ms) {
    if (app.save.settings.vibration) navigator.vibrate?.(ms);
  }

  /**
   * Thanh tab cố định ở đáy: các tính năng chính luôn trong tầm một chạm.
   * `active` là tab đang mở: 'play' | 'daily' | 'modes' | 'trophies' | 'shop' | null.
   * Chấm đỏ nhỏ: Daily hôm nay chưa giải / Shop đang có Starter Bundle.
   */
  function tabBar(active) {
    const day = today();
    const tab = (id, ic, label, onclick, badge = false) => h('button', {
      class: `tab tab-${id}${active === id ? ' active' : ''}`,
      'aria-current': active === id ? 'page' : null,
      onclick: () => { sounds.tap(); onclick(); },
    }, h('span', { class: 'tab-icon' }, icon(ic), badge && h('i', { class: 'tab-dot', 'aria-hidden': 'true' })), h('span', { class: 'tab-label' }, label));
    return h('nav', { class: 'tab-bar', 'aria-label': t('aria.tabs') },
      tab('play', 'play', t('tab.play'), () => startLevel(currentLevel(app.save.progress, totalLevels))),
      tab('daily', 'calendar', t('tab.daily'), () => startDaily(), !isDailySolved(app.save.progress, day)),
      tab('modes', 'modes', t('tab.modes'), showModes),
      tab('trophies', 'trophy', t('tab.trophies'), showTrophies),
      tab('shop', 'shop', t('tab.shop'), showShop, starterAvailable(store(), day)));
  }

  /**
   * Skin đang vẽ: skin người chơi đã trang bị (store.activeSkins), riêng trong Daily
   * có thể đang "xem thử" một skin chưa mua (app.previewSkin).
   */
  function skinsNow() {
    const base = activeSkins(store(), today());
    return app.mode === 'daily' && app.previewSkin ? { ...base, ...app.previewSkin } : base;
  }

  /** Tên skin theo ngôn ngữ. */
  const skinName = (kind, id) => t(`skin.${kind}.${id}`);

  /**
   * Xét lại Trophy sau khi có kết quả mới; trophy nào vừa đạt thì hiện thông báo
   * (lần lượt từng cái).
   */
  function checkTrophies() {
    const fresh = evaluateTrophies(app.save.trophies, collectStats(app.save, data), today());
    if (fresh.length) persist();
    fresh.forEach((tr, i) => setTimeout(() => {
      const el = h('div', { class: `trophy-toast ${tr.tier}`, role: 'status' },
        medal(tr.tier), h('span', {}, h('small', {}, t('trophy.toast', { tier: t(`tier.${tr.tier}`) })), h('strong', {}, t(`trophy.${tr.id}.name`))));
      document.body.append(el);
      sounds.coin();
      setTimeout(() => el.remove(), 2600);
    }, 1200 + i * 2000));
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
    // Level còn khoá (chỉ xảy ra khi gọi từ ngoài, ví dụ window.rookChess khi kiểm thử):
    // mở level đang chơi dở thay vì để lúc thắng mới báo lỗi "chưa mở".
    if (levelStatus(app.save.progress, id) === 'locked') id = currentLevel(app.save.progress, totalLevels);
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

  /** Bắt đầu bài Obstacle thứ `index` (đếm từ 0). Chưa mở khoá thì về màn Mode. */
  function startObstacle(index) {
    abandonBlitz();
    if (!canPlayModeLevel(store(), 'obstacle', index, today())) {
      toast(t('obstacle.locked'));
      showModes();
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
        return t(kind === 'board' ? 'daily.previewBoard' : 'daily.previewPieces', { name: skinName(kind, id) });
      }
      return `${t('daily.name')} · ${formatDayMonth(lang(), app.dailyKey)}`;
    }
    if (app.mode === 'obstacle') return t('obstacle.subtitle', { i: app.modeIndex + 1, n: data.modes.obstacle.length });
    if (app.mode === 'blitz') {
      const left = Math.max(0, Math.ceil((app.blitz.endsAt - Date.now()) / 1000));
      const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      return t('blitz.subtitle', { time: clock, n: app.blitz.score });
    }
    return t('level.n', { n: p.level.id });
  }

  /** Tab đang mở tương ứng với mode chơi. */
  const tabForMode = () => ({ main: 'play', daily: 'daily', obstacle: 'modes', blitz: 'modes' })[app.mode];

  /** Vẽ khung màn chơi: thanh trên, bàn cờ, 2 nút, thanh tab. */
  function renderGameScreen() {
    const p = app.puzzle;
    const backTo = { obstacle: showModes, blitz: () => { abandonBlitz(); showModes(); } }[app.mode];
    const left = backTo
      ? h('button', { class: 'icon-btn', 'aria-label': t('aria.back'), onclick: () => { sounds.tap(); backTo(); } }, icon('back'))
      : app.mode === 'main'
        ? h('button', { class: 'icon-btn', 'aria-label': t('levels.title'), onclick: () => { sounds.tap(); showLevelSelect(); } }, icon('grid'))
        : h('span', { class: 'icon-btn spacer' });

    const view = createBoardView({ onSquareTap, canDrag, onDragStart, onDrop, t });
    app.view = view;
    view.setStyle({ ...skinsNow(), obstacles: app.mode === 'obstacle' });

    // Blitz: không có gợi ý (đua giờ), thay bằng nút "Bỏ qua" sang thế tiếp theo.
    const hintBtn = app.mode === 'blitz'
      ? h('button', { class: 'round-btn hint-btn skip-btn', 'aria-label': t('aria.skip'), onclick: onBlitzSkip }, icon('skip', 'round-icon'))
      : h('button', { class: 'round-btn hint-btn', 'aria-label': t('hint.aria'), onclick: onHintTap },
        icon('bulb', 'round-icon'), h('span', { class: 'hint-badge' }));
    const undoBtn = h('button', { class: 'round-btn undo-btn', 'aria-label': t('aria.undo'), onclick: onUndo }, icon('undo', 'round-icon'));

    const screen = h('main', { class: `screen game-screen mode-${app.mode}` },
      h('header', { class: 'game-top' },
        h('div', { class: 'top-left' }, left),
        h('div', { class: 'title-block' },
          h('div', { class: 'subtitle' }, subtitleText()),
          h('h1', { class: 'title' })),
        h('div', { class: 'top-right' }, coinPill(), gearBtn())),
      h('section', { class: 'board-area' }, sideLabel('top'), view.el, sideLabel('bottom')),
      h('footer', { class: 'game-bottom' }, hintBtn, undoBtn),
      tabBar(tabForMode()));
    root.replaceChildren(screen);
    app.buttons = { hintBtn, undoBtn };
    fitBoard();
    drawBoard();
  }

  /**
   * Tính cỡ ô để bàn vừa đúng khoảng trống còn lại: đo vùng `.board-area` (đã trừ
   * thanh trên, nút và thanh tab), bớt chỗ cho 2 nhãn hai phía, rồi chia cho số
   * hàng / cột (cộng độ dày cạnh bàn 0,16 ô). Tối đa 118 px để bàn nhỏ không quá to.
   */
  function fitBoard() {
    const area = document.querySelector('.board-area');
    if (!area) return;
    const b = app.puzzle.board;
    const labels = [...area.querySelectorAll('.side-label')].reduce((sum, el) => sum + el.offsetHeight + 12, 0);
    const availH = area.clientHeight - labels - 12;
    const availW = Math.min(area.clientWidth, 520) - 8;
    const cell = Math.floor(Math.min(availW / b.width, availH / (b.height + 0.16), 118));
    app.view.setSize(Math.max(30, cell));
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
    const name = t(color === 'w' ? 'side.white' : 'side.black');
    return h('div', {
      class: `side-label ${edge} ${color === 'w' ? 'white' : 'black'}`,
      'aria-label': t(edge === 'bottom' ? 'aria.sideBottom' : 'aria.sideTop', { color: name }),
    },
    h('span', { class: 'side-pawn', html: pieceSvg(color === 'w' ? 'P' : 'p', skinsNow().pieces) }),
    h('span', { class: 'side-name' }, name, edge === 'bottom' && h('small', {}, ` ${t('side.you')}`)),
    h('span', { class: 'side-arrow', 'aria-hidden': 'true' }, edge === 'bottom' ? '↑' : '↓'));
  }

  /** Nhãn giá trên nút gợi ý: "PASS" nếu có Rook Pass, ngược lại số coin. */
  function refreshHintBadge() {
    const badge = document.querySelector('.hint-badge');
    if (!badge) return;
    badge.replaceChildren(passActive()
      ? h('span', {}, 'PASS')
      : h('span', {}, icon('coin', 'coin-icon'), String(hintCost(false))));
  }

  /** Vẽ lại bàn cờ và trạng thái các nút theo dữ liệu hiện tại. */
  function drawBoard() {
    const p = app.puzzle;
    const board = p.board;
    const checkSq = inCheck(board) ? findKing(board, board.turn) : undefined;
    app.view.render(board, playerColor() === 'b', {
      selected: app.selected ?? undefined,
      targets: app.save.settings.showLegalMoves || app.hint ? app.targets : [],
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
        title.textContent = t(`${END_KEYS[p.endReason]}.title`);
        title.classList.add('ended');
        title.classList.remove('urgent');
      } else {
        title.textContent = t('mateIn', { n: p.state === WON ? p.level.mateIn : p.movesLeft });
        title.classList.toggle('urgent', p.movesLeft <= 1 && p.level.mateIn > 1 && p.state !== WON);
        title.classList.remove('ended');
      }
    }
    app.buttons.undoBtn.disabled = !canUndo(p) || app.busy;
    // Ván dừng: vòng sáng quanh nút Undo để người chơi biết bấm vào đâu.
    app.buttons.undoBtn.classList.toggle('attention', p.state === ENDED && !app.busy && app.mode !== 'blitz');
    app.buttons.hintBtn.disabled = app.mode === 'blitz' ? app.busy : (p.state === WON || app.busy);
    refreshHintBadge();
  }

  /** Người chơi chạm vào ô `sq`. */
  function onSquareTap(sq) {
    const p = app.puzzle;
    if (app.busy || p.state !== PLAYER_TURN) return;
    const piece = p.board.squares[sq];
    const own = colorOf(piece) === playerColor();

    if (app.selected !== null && app.targets.some((x) => x.to === sq)) {
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

  /** Quân ở ô `sq` có kéo được lúc này không: đúng lượt mình, không đang chạy animation. */
  function canDrag(sq) {
    const p = app.puzzle;
    return !app.busy && p.state === PLAYER_TURN && colorOf(p.board.squares[sq]) === playerColor();
  }

  /** Bắt đầu kéo quân ở ô `sq`: chọn quân đó như khi chạm (hiện ô đi được). */
  function onDragStart(sq) {
    if (app.selected !== sq) {
      app.selected = sq;
      app.targets = legalTargets(app.puzzle, sq);
      sounds.tap();
    }
    drawBoard();
  }

  /**
   * Thả quân kéo từ `from` xuống ô `to` (-1 = ngoài bàn). Ô đi được thì đi như chạm-chạm;
   * không thì quân về chỗ cũ và vẫn được chọn, để người chơi chạm ô đến nếu muốn.
   */
  function onDrop(from, to) {
    const p = app.puzzle;
    const ok = !app.busy && p.state === PLAYER_TURN && app.selected === from && app.targets.some((x) => x.to === to);
    if (ok) { tryMove(from, to); return; }
    app.view.clearHold();
    drawBoard();
  }

  /** Hỏi quân phong cấp. Trả về Promise với chữ 'q' | 'r' | 'b' | 'n', hoặc null nếu huỷ. */
  function askPromotion() {
    return new Promise((resolve) => {
      let chosen = null;
      const color = playerColor();
      const skin = skinsNow().pieces;
      const choice = (k) => h('button', {
        class: 'promo-choice',
        'aria-label': t(`piece.${k}`),
        'data-piece': k, // mã quân (q/r/b/n), để script chơi thử bấm được ở mọi ngôn ngữ
        onclick: () => { chosen = k; close(); },
      }, h('span', { class: 'promo-piece', html: pieceSvg(color === 'w' ? k.toUpperCase() : k, skin) }));
      const close = openOverlay(
        h('div', { class: 'dialog promo-dialog' }, h('h2', {}, t('promo.title')), h('div', { class: 'promo-row' }, ['q', 'r', 'b', 'n'].map(choice))),
        { onClose: () => resolve(chosen) },
      );
    });
  }

  /** Đi nước từ `from` tới `to`: animation → gọi logic → phản hồi. */
  async function tryMove(from, to) {
    const p = app.puzzle;
    let promo = '';
    if (needsPromotion(p, from, to)) {
      // Đang theo gợi ý (đúng ô gợi ý) thì phong đúng quân gợi ý, khỏi hỏi.
      const fromHint = app.hint && app.hint.from === from && app.hint.to === to ? app.hint.promotion : null;
      promo = fromHint ?? await askPromotion();
      if (!promo) { app.view.clearHold(); drawBoard(); return; } // huỷ: quân kéo thả về chỗ cũ
    }
    const text = squareName(p.board, from) + squareName(p.board, to) + promo;
    const capture = p.board.squares[to] !== '.';
    app.busy = true;
    app.selected = null;
    app.targets = [];
    app.hint = null;
    drawBoard();
    // Sau mỗi lần chờ, kiểm tra người chơi chưa rời màn chơi này (đổi tab, hết giờ
    // Blitz...). Rời rồi thì dừng, không đụng tới bàn cờ cũ nữa.
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
   * đổi tiêu đề, nhắc nhẹ bấm Undo (hoặc Gợi ý). Blitz thì tự sang thế tiếp theo.
   */
  function onEnded(reason) {
    app.busy = false;
    drawBoard();
    sounds.wrong();
    if (app.mode === 'blitz') {
      toast(t('blitz.skipped'));
      app.busy = true;
      setTimeout(() => { if (app.mode === 'blitz') nextBlitzPuzzle(); }, 700);
      return;
    }
    toast(t(`${END_KEYS[reason]}.toast`));
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
  // Gợi ý: một loại duy nhất, mỗi lần bấm chỉ ra nước tiếp theo bằng animation
  // -------------------------------------------------------------------------

  /**
   * Bấm nút gợi ý:
   *   1. Đã đi lệch (hoặc ván đã dừng) → tự Undo về thế còn thắng gần nhất (miễn phí).
   *   2. Trả HINT_COST coin (Rook Pass: miễn phí). Không đủ coin → hộp mời xem
   *      quảng cáo / Rook Pass.
   *   3. Hiện nước tiếp theo: bóng mờ quân trượt tới ô đích, quân đó được chọn sẵn.
   */
  function onHintTap() {
    const p = app.puzzle;
    if (app.busy || p.state === WON || app.mode === 'blitz') return;
    sounds.tap();
    if (!canHint(p)) {
      rewindToTrack(p);
      app.selected = null;
      app.targets = [];
      app.hint = null;
      app.lastMove = null;
      drawBoard();
      toast(t('hint.rewound'));
      if (!canHint(p)) return;
    }
    const pay = spendForHint(app.save.economy, passActive());
    if (!pay.ok) {
      openNeedCoins();
      return;
    }
    persist();
    refreshCoins();
    showHint();
  }

  /** Lấy nước tiếp theo từ bộ giải và hiện bằng animation (không ghi tên ô). */
  function showHint() {
    const hint = getHint(app.puzzle, 2);
    if (hint.offTrack) return;
    const b = app.puzzle.board;
    const from = parseSquare(b, hint.from);
    const to = parseSquare(b, hint.to);
    const promotion = /[qrbn]$/.exec(hint.move.slice(4))?.[0];
    app.hint = { from, to, promotion };
    app.selected = from;
    app.targets = legalTargets(app.puzzle, from);
    drawBoard();
  }

  /**
   * Không đủ coin cho gợi ý: mời xem quảng cáo (chỉ khi đã sai ≥ 2 lần, 1 lần/ngày,
   * theo kế hoạch MKT) hoặc dùng Rook Pass (gợi ý không giới hạn).
   */
  function openNeedCoins() {
    const eco = app.save.economy;
    const adOk = canWatchHintAd(eco, today(), { wrongMoves: app.puzzle.wrongMoves, hasPass: passActive() });
    const close = openOverlay(h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h2', {}, t('hint.needCoins.title')), coinPill()),
      h('p', { class: 'sheet-text' }, t('hint.needCoins.text', { cost: hintCost(false), coins: eco.coins })),
      adOk && h('button', {
        class: 'sheet-option ad-option',
        onclick: () => { close(); showAd({ then: rewardHint }); },
      }, h('span', { class: 'opt-text' }, h('strong', {}, t('hint.watchAd')), h('small', {}, t('hint.watchAdNote'))),
      h('span', { class: 'price free' }, t('common.free'))),
      h('button', {
        class: 'sheet-option pass-option',
        onclick: () => { close(); showShop(); },
      }, h('span', { class: 'opt-text' }, h('strong', {}, t('pass.name')), h('small', {}, t('hint.passNote'))),
      h('span', { class: 'price' }, t('pass.price', { price: PRODUCTS['rook-pass'].price })))), { cls: 'sheet-overlay' });
  }

  /** Xem xong rewarded: trừ lượt hôm nay và hiện gợi ý miễn phí. */
  function rewardHint() {
    if (!useHintAd(app.save.economy, today()).ok) { toast(t('ad.usedToday')); return; }
    persist();
    showHint();
  }

  /**
   * Màn quảng cáo giả lập 5 giây (chỉ dùng cho rewarded đổi gợi ý). Nút nhận to,
   * đặt ở dưới, dễ bấm; xem hết mới gọi `then`.
   */
  function showAd({ then } = {}) {
    let left = AD_SECONDS;
    const counter = h('span', { class: 'ad-count' }, t('ad.timer', { n: left }));
    const closeBtn = h('button', { class: 'btn primary ad-close', disabled: true, onclick: () => finish() }, t('ad.claim'));
    const close = openOverlay(h('div', { class: 'ad-box' },
      h('div', { class: 'ad-label' }, t('ad.label')),
      h('div', { class: 'ad-art', html: pieceSvg('N', skinsNow().pieces) }),
      h('p', {}, t('ad.text')),
      h('p', { class: 'ad-timer' }, counter),
      closeBtn), { dismissable: false, cls: 'ad-overlay' });
    const timer = setInterval(() => {
      left--;
      counter.textContent = t('ad.timer', { n: Math.max(left, 0) });
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
    let nextLabel;
    let goNext;
    let offerStarter = false;
    if (app.mode === 'daily') {
      const d = completeDaily(app.save.progress, app.dailyKey);
      firstTime = d.firstTime;
      extra = t('win.streak', { n: d.streak });
      nextLabel = t('btn.done');
      goNext = showModes;
      // Kế hoạch MKT: hiện Starter Bundle sau Daily Mate đầu tiên.
      offerStarter = firstTime && app.save.progress.daily.solvedDates.length === 1;
    } else if (app.mode === 'obstacle') {
      firstTime = markObstacleSolved(app.save.modes, app.modeIndex, { perfect: s.perfect }).firstTime;
      const next = app.modeIndex + 1;
      const hasNext = next < data.modes.obstacle.length && canPlayModeLevel(store(), 'obstacle', next, today());
      nextLabel = t(hasNext ? 'btn.nextPuzzle' : 'btn.done');
      goNext = hasNext ? () => startObstacle(next) : showModes;
    } else {
      firstTime = markSolved(app.save.progress, p.level.id, { hintUsed: s.hintUsed, perfect: s.perfect, totalLevels }).firstTime;
      const isLast = p.level.id >= totalLevels;
      nextLabel = t(isLast ? 'btn.done' : 'btn.nextLevel');
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
      h('h2', {}, t('win.title')),
      h('p', { class: 'win-sub' }, t(s.perfect ? 'win.perfect' : 'win.good')),
      extra && h('p', { class: 'streak' }, extra),
      h('div', { class: 'reward' }, icon('coin', 'coin-icon big'), h('span', {}, gained > 0 ? `+${gained}` : t('win.solvedBefore'))),
      h('button', { class: 'btn primary win-next', onclick: next }, nextLabel)),
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
    toast(t('blitz.plusOne', { n: b.score }));
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
      h('h2', {}, t(reason === 'time' ? 'blitz.timeUp' : 'blitz.trialOver')),
      h('div', { class: 'blitz-score' }, String(b.score), h('small', {}, t('blitz.solved', { n: b.score }))),
      r.newBest && b.score > 0 ? h('p', { class: 'streak' }, t('blitz.newRecord')) : null,
      h('p', {}, t('blitz.records', { best: r.best, week: r.weekBest })),
      reason === 'trial' && h('p', { class: 'note' }, t('blitz.trialNote', { n: FREE_MODE_LEVELS, m: BLITZ_SECONDS / 60 })),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn', onclick: () => { close(); showModes(); } }, t('btn.menu')),
        reason === 'trial'
          ? h('button', { class: 'btn primary', onclick: () => { close(); showShop(); } }, t('btn.unlock'))
          : h('button', { class: 'btn primary', onclick: () => { close(); startBlitzRun(); } }, t('btn.playAgain')))),
    { dismissable: false });
  }

  // -------------------------------------------------------------------------
  // Màn danh sách (có thanh tab): chọn level, Mode, Trophy, Shop, Cài đặt
  // -------------------------------------------------------------------------

  /**
   * Khung chung cho màn danh sách: thanh trên (nút quay lại nếu có, tiêu đề, coin,
   * bánh răng), nội dung, thanh tab.
   */
  function listScreen(screen, title, body, { tab = null, onBack = null } = {}) {
    abandonBlitz();
    app.screen = screen;
    root.replaceChildren(h('main', { class: `screen list-screen screen-${screen}` },
      h('header', { class: 'list-top' },
        onBack
          ? h('button', { class: 'icon-btn', 'aria-label': t('aria.back'), onclick: () => { sounds.tap(); onBack(); } }, icon('back'))
          : h('span', { class: 'icon-btn spacer' }),
        h('h1', {}, title),
        h('div', { class: 'top-right' }, coinPill(), screen === 'settings' ? null : gearBtn())),
      body,
      tabBar(tab)));
    window.scrollTo(0, 0);
  }

  /** Ô số level (dùng chung cho level chính và Obstacle). */
  function levelTile(label, status, aria, onclick, sub = null) {
    return h('button', {
      class: `level-tile ${status === 'locked-hard' ? 'locked' : status}`,
      disabled: status === 'locked-hard',
      'aria-label': aria,
      onclick: () => { sounds.tap(); onclick(); },
    }, status.startsWith('locked') ? icon('lock', 'tile-icon') : label,
    status === 'solved' && icon('check', 'tile-check'),
    sub && h('span', { class: 'tile-sub' }, sub));
  }

  /** Màn chọn level: lưới số theo chương. */
  function showLevelSelect() {
    applyTheme(themeForLevel(currentLevel(app.save.progress, totalLevels)));
    app.mode = 'main';
    app.previewSkin = null;
    const progress = app.save.progress;
    const chapters = data.chapters.map((ch) => {
      const levels = data.levels.filter((l) => l.chapter === ch.chapter);
      const solved = levels.filter((l) => progress.solved[l.id]).length;
      return h('section', { class: 'chapter' },
        h('div', { class: 'chapter-head' }, h('h2', {}, `${ch.chapter}. ${t(`chapter.${ch.chapter}`)}`),
          h('span', { class: 'chapter-meta' }, `${t('mateIn', { n: ch.mateIn })} · ${solved}/${levels.length}`)),
        h('div', { class: 'level-grid' }, levels.map((l) => {
          const st = levelStatus(progress, l.id);
          return levelTile(String(l.id), st === 'locked' ? 'locked-hard' : st,
            t(`aria.level.${st}`, { n: l.id }), () => startLevel(l.id));
        })));
    });
    listScreen('levels', t('levels.title'), h('div', { class: 'chapters' }, chapters), {
      tab: 'play',
      onBack: () => startLevel(currentLevel(progress, totalLevels)),
    });
  }

  /** Thẻ "mở khoá mode": chưa có mode thì mời mua / dùng Rook Pass. */
  function unlockCard(mode) {
    if (owns(store(), `mode:${mode}`, today())) return null;
    return h('div', { class: 'unlock-card' },
      h('p', {}, t(mode === 'blitz' ? 'modes.freeBlitz' : 'modes.freeObstacle', { n: FREE_MODE_LEVELS, price: PRODUCTS[`mode:${mode}`].price })),
      h('button', { class: 'btn small primary', onclick: () => { sounds.tap(); showShop(); } }, t('btn.unlock')));
  }

  /**
   * Màn Mode: Daily, Blitz Mate và Obstacle trên cùng một màn, để người chơi thấy
   * hết các cách chơi mà không phải tìm.
   */
  function showModes() {
    applyTheme(themeForLevel(3));
    app.mode = 'obstacle';
    const day = today();
    const progress = app.save.progress;
    const streak = currentStreak(progress, day);
    const m = app.save.modes.blitz;

    const dailyCard = h('button', { class: 'mode-card daily-card', onclick: () => { sounds.tap(); startDaily(); } },
      h('span', { class: 'mode-icon', html: ICONS.calendar }),
      h('span', { class: 'opt-text' }, h('strong', {}, t('daily.name')),
        h('small', {}, isDailySolved(progress, day) ? t('daily.done') : streak > 0 ? t('daily.streak', { n: streak }) : formatDayMonth(lang(), day))),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));

    const blitzCard = h('div', { class: 'mode-card blitz-card' },
      h('div', { class: 'mode-head' }, h('span', { class: 'mode-icon', html: ICONS.bolt }),
        h('span', { class: 'opt-text' }, h('strong', {}, t('blitz.name')), h('small', {}, t('blitz.desc', { m: BLITZ_SECONDS / 60 })))),
      h('div', { class: 'stat-row' },
        h('span', {}, h('small', {}, t('blitz.best')), h('strong', {}, String(m.best))),
        h('span', {}, h('small', {}, t('blitz.week')), h('strong', {}, String(blitzWeekBest(app.save.modes, day)))),
        h('span', {}, h('small', {}, t('blitz.runs')), h('strong', {}, String(m.runs)))),
      h('button', { class: 'btn primary blitz-start', onclick: () => { sounds.tap(); startBlitzRun(); } }, t('btn.start')),
      unlockCard('blitz'));

    const list = data.modes.obstacle;
    const obstacleCard = h('div', { class: 'mode-card obstacle-card' },
      h('div', { class: 'mode-head' }, h('span', { class: 'mode-icon', html: ICONS.stone }),
        h('span', { class: 'opt-text' }, h('strong', {}, t('obstacle.name')), h('small', {}, t('obstacle.desc'))),
        h('span', { class: 'mode-count' }, `${obstacleSolvedCount(app.save.modes)}/${list.length}`)),
      unlockCard('obstacle'),
      h('div', { class: 'level-grid' }, list.map((level, i) => {
        const playable = canPlayModeLevel(store(), 'obstacle', i, day);
        const solved = Boolean(app.save.modes.obstacle.solved[i]);
        const st = solved ? 'solved' : playable ? 'open' : 'locked';
        return levelTile(String(i + 1), st, t(`aria.obstacle.${st}`, { n: i + 1 }), () => startObstacle(i), `M${level.mateIn}`);
      })));

    listScreen('modes', t('modes.title'), h('div', { class: 'list-body' }, dailyCard, blitzCard, obstacleCard), { tab: 'modes' });
  }

  /** Màn Trophy: theo hạng, đã đạt (ngày đạt) / chưa đạt. */
  function showTrophies() {
    const tr = app.save.trophies;
    const counts = trophyCounts(tr);
    const item = (x) => {
      const date = tr.unlocked[x.id];
      return h('div', { class: `trophy-item${date ? ' got' : ''}` },
        medal(x.tier, !date),
        h('span', { class: 'opt-text' }, h('strong', {}, t(`trophy.${x.id}.name`)), h('small', {}, t(`trophy.${x.id}.desc`))),
        h('span', { class: 'trophy-date' }, date ? formatShortDate(lang(), date) : '—'));
    };
    listScreen('trophies', t('trophies.title'), h('div', { class: 'list-body' },
      h('div', { class: 'trophy-summary' }, ...['bronze', 'silver', 'gold', 'platinum'].map((tier) =>
        h('span', {}, medal(tier), h('strong', {}, String(counts[tier])), h('small', {}, t(`tier.${tier}`))))),
      ...['platinum', 'gold', 'silver', 'bronze'].map((tier) => h('section', { class: 'trophy-group' },
        h('h2', {}, t(`tier.${tier}`)), ...TROPHIES.filter((x) => x.tier === tier).map(item))),
      h('p', { class: 'note' }, t('trophies.note'))), { tab: 'trophies' });
  }

  /** Hộp mời mua Starter Bundle (hiện sau Daily đầu tiên và khi giải xong level 10). */
  function showStarterOffer(then) {
    const close = openOverlay(h('div', { class: 'dialog starter-offer' },
      h('h2', {}, t('starter.name')),
      h('p', {}, `${t('starter.desc')} ${PRODUCTS['starter-bundle'].price} · ${t('starter.daysLeft', { n: starterDaysLeft(store(), today()) })}`),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn later-btn', onclick: () => { close(); then(); } }, t('btn.later')),
        h('button', { class: 'btn primary', onclick: () => { buyProduct('starter-bundle'); close(); then(); } }, t('btn.buy')))));
  }

  /** "Mua" một sản phẩm (giả lập) và báo kết quả. */
  function buyProduct(id) {
    const r = buy(store(), id, today());
    if (!r.ok) {
      toast(t(r.reason === 'expired' ? 'buy.expired' : r.reason === 'owned' ? 'buy.owned' : 'buy.failed'));
      return false;
    }
    persist();
    sounds.coin();
    toast(t('buy.done', { name: t(`product.${id}`) }));
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
   * mode, skin bàn / skin quân / bộ skin. Kèm trang bị skin và xem thử trong Daily.
   */
  function showShop() {
    const s = store();
    const day = today();
    const pass = hasPass(s, day);
    const refresh = () => { const y = window.scrollY; showShop(); window.scrollTo(0, y); };

    const passCard = h('div', { class: 'shop-card pass-card' },
      h('div', { class: 'card-head' }, icon('crown'), h('strong', {}, t('pass.name')), h('span', { class: 'price' }, t('pass.price', { price: PRODUCTS['rook-pass'].price }))),
      h('ul', {}, h('li', {}, t('pass.b1')), h('li', {}, t('pass.b2')), h('li', {}, t('pass.b3')), h('li', {}, t('pass.b4'))),
      pass ? h('p', { class: 'status' }, t('pass.active', { n: passDaysLeft(s, day) })) : null,
      h('div', { class: 'dialog-row' },
        !s.pass.trialUsed && h('button', { class: 'btn pass-trial', onclick: () => { startPassTrial(s, day); persist(); toast(t('pass.trialStarted')); refresh(); } }, t('pass.trial')),
        h('button', { class: 'btn primary', onclick: () => { subscribePass(s, day); persist(); sounds.coin(); toast(t('pass.subscribed')); refresh(); } }, t(pass ? 'pass.extend' : 'pass.subscribe'))));

    const starter = starterAvailable(s, day) && h('div', { class: 'shop-card starter-card' },
      h('div', { class: 'card-head' }, h('strong', {}, t('starter.name')), h('span', { class: 'price' }, PRODUCTS['starter-bundle'].price)),
      h('p', {}, `${t('starter.desc')} ${t('starter.daysLeft', { n: starterDaysLeft(s, day) })}`),
      h('button', { class: 'btn primary', onclick: () => { buyProduct('starter-bundle'); refresh(); } }, t('btn.buy')));

    // Một dòng skin: mẫu, tên, trạng thái / nút.
    const skinRow = (kind, id) => {
      const skin = SKINS[kind][id];
      const productId = `${kind}:${id}`;
      const have = owns(s, productId, day);
      const using = activeSkins(s, day)[kind] === id;
      let action;
      if (using) action = h('span', { class: 'price free' }, t('shop.using'));
      else if (have) action = h('button', { class: 'btn small', onclick: () => { equip(s, kind, id, day); persist(); sounds.tap(); refresh(); } }, t('shop.use'));
      else if (skin.exclusive === 'pass') action = h('span', { class: 'price' }, t('pass.name'));
      else action = h('button', { class: 'btn small primary', onclick: () => { buyProduct(productId); refresh(); } }, PRODUCTS[productId].price);
      const tryIt = !have && !skin.exclusive && h('button', {
        class: 'link-btn',
        onclick: () => { sounds.tap(); startDaily({ [kind]: id }); },
      }, t('shop.tryDaily'));
      return h('div', { class: 'skin-row' }, skinSwatch(kind, id),
        h('span', { class: 'opt-text' }, h('strong', {}, skinName(kind, id)), tryIt), action);
    };

    const setRow = (id) => {
      const done = PRODUCTS[id].grants.every((g) => owns(s, g, day));
      return h('div', { class: 'skin-row' },
        h('span', { class: 'opt-text' }, h('strong', {}, t(`product.${id}`)), h('small', {}, t('shop.cheaper'))),
        done ? h('span', { class: 'price free' }, t('shop.owned')) : h('button', { class: 'btn small primary', onclick: () => { buyProduct(id); refresh(); } }, PRODUCTS[id].price));
    };

    const modeRow = (mode) => {
      const id = `mode:${mode}`;
      const have = owns(s, id, day);
      return h('div', { class: 'skin-row' },
        h('span', { class: 'mode-icon', html: ICONS[mode === 'obstacle' ? 'stone' : 'bolt'] }),
        h('span', { class: 'opt-text' }, h('strong', {}, t(`${mode}.name`)), h('small', {}, t(`${mode}.desc`, { m: BLITZ_SECONDS / 60 }))),
        have ? h('span', { class: 'price free' }, pass && !s.owned.includes(id) ? t('pass.name') : t('shop.owned'))
          : h('button', { class: 'btn small primary', onclick: () => { buyProduct(id); refresh(); } }, PRODUCTS[id].price));
    };

    listScreen('shop', t('shop.title'), h('div', { class: 'list-body' },
      h('p', { class: 'note' }, t('shop.note')),
      passCard,
      starter,
      h('h2', { class: 'section-title' }, t('shop.modes')),
      modeRow('obstacle'), modeRow('blitz'),
      h('h2', { class: 'section-title' }, t('shop.boardSkins')),
      ...Object.keys(SKINS.board).map((id) => skinRow('board', id)),
      h('h2', { class: 'section-title' }, t('shop.pieceSkins')),
      ...Object.keys(SKINS.pieces).map((id) => skinRow('pieces', id)),
      h('h2', { class: 'section-title' }, t('shop.sets')),
      setRow('set:marble'), setRow('set:neon')), { tab: 'shop' });
  }

  /** Màn cài đặt: ngôn ngữ, âm thanh, rung, hiện nước hợp lệ, reset tiến trình. */
  function showSettings() {
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
    const select = h('select', {
      class: 'lang-select',
      'aria-label': t('settings.language'),
      onchange: (e) => {
        st.language = normalizeLanguage(e.target.value);
        persist();
        applyLanguage();
        showSettings();
      },
    }, LANGUAGES.map((l) => h('option', { value: l.code, selected: l.code === lang() }, l.name)));
    listScreen('settings', t('settings.title'), h('div', { class: 'list-body' },
      h('label', { class: 'setting' }, h('span', { class: 'opt-text' }, h('strong', {}, t('settings.language'))), select),
      toggle('sound', t('settings.sound'), t('settings.soundDesc')),
      toggle('vibration', t('settings.vibration'), t('settings.vibrationDesc')),
      toggle('showLegalMoves', t('settings.legal'), t('settings.legalDesc')),
      h('button', { class: 'btn danger', onclick: confirmReset }, t('settings.reset')),
      app.saveStatus === 'unavailable' && h('p', { class: 'note' }, t('settings.blocked'))),
    { onBack: () => startLevel(currentLevel(app.save.progress, totalLevels)) });
  }

  /** Hỏi lại trước khi xoá tiến trình. Ngôn ngữ đang chọn được giữ lại. */
  function confirmReset() {
    const close = openOverlay(h('div', { class: 'dialog' },
      h('h2', {}, t('reset.title')),
      h('p', {}, t('reset.text')),
      h('div', { class: 'dialog-row' },
        h('button', { class: 'btn', onclick: () => close() }, t('btn.cancel')),
        h('button', {
          class: 'btn danger',
          onclick: () => {
            const keep = lang();
            app.save = resetSave();
            app.save.settings.language = keep;
            ensureInstallDate(app.save.store, today());
            persist();
            close();
            toast(t('reset.done'));
            showSettings();
          },
        }, t('btn.reset')))));
  }

  // Khi xoay màn hình / đổi cỡ cửa sổ: tính lại cỡ ô và vẽ lại bàn.
  window.addEventListener('resize', () => {
    if (app.screen !== 'game' || app.busy) return;
    fitBoard();
    drawBoard();
  });

  // Vào game: mở thẳng level đang dở (giống nút Play lớn, GDD 7.1).
  startLevel(currentLevel(app.save.progress, totalLevels));
  app.actions = {
    startLevel, startDaily, startObstacle, startBlitzRun, endBlitz, showLevelSelect,
    showModes, showTrophies, showShop, showSettings, onSquareTap, onHintTap,
  };
  return app;
}
