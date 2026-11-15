// =============================================================================
// store.js — Cửa hàng GIẢ LẬP theo "Kế hoạch MKT The Rook Chess" (tab Kiếm tiền):
// Rook Pass (thuê bao), Starter Bundle, skin bàn cờ, skin quân cờ, bộ skin, mode.
// Bấm "mua" chỉ ghi quyền sở hữu vào dữ liệu lưu: KHÔNG có thanh toán thật.
//
// File này chỉ quyết định "ai được dùng cái gì": đã mua chưa, Rook Pass còn hạn
// không, Starter Bundle còn bán không, bài thứ mấy của một mode được chơi thử.
// Không biết gì về giao diện. Ngày luôn được truyền vào dạng "yyyymmdd".
//
// Trạng thái cửa hàng (lưu được bằng JSON):
//   installDate : ngày cài game (đặt lần đầu mở game), để tính Starter Bundle 7 ngày đầu.
//   owned       : danh sách id món đã mua lẻ, ví dụ ['board:marble', 'mode:obstacle'].
//   pass        : { until, trialUsed } — Rook Pass có hiệu lực tới hết ngày `until`
//                 (null = chưa từng có); trialUsed = đã dùng thử 7 ngày chưa.
//   equipped    : { board, pieces } — skin đang dùng.
// =============================================================================

import { daysBetween, addDays } from './progress.js';

/** Số bài mỗi mode cho chơi thử miễn phí trước khi phải mua. */
export const FREE_MODE_LEVELS = 5;
/** Starter Bundle chỉ bán trong số ngày này kể từ khi cài. */
export const STARTER_DAYS = 7;
/** Rook Pass: dùng thử 7 ngày, mỗi kỳ thuê bao 30 ngày. */
export const PASS_TRIAL_DAYS = 7;
export const PASS_PERIOD_DAYS = 30;

/**
 * Danh mục skin. `exclusive: 'pass'` = skin độc quyền của Rook Pass (chỉ dùng
 * được khi Pass còn hạn). Skin mặc định (default) ai cũng có.
 */
export const SKINS = {
  board: {
    classic: { name: 'Gỗ cổ điển', default: true },
    marble: { name: 'Cẩm thạch' },
    neon: { name: 'Neon' },
  },
  pieces: {
    ivory: { name: 'Ivory / Espresso', default: true },
    marble: { name: 'Cẩm thạch' },
    neon: { name: 'Neon' },
    royal: { name: 'Hoàng gia', exclusive: 'pass' },
  },
};

/** Danh mục mode bán thêm. */
export const MODES = {
  obstacle: { name: 'Obstacle', desc: 'Thế cờ có vật cản trên bàn: ô bị khoá, quân không đi qua được' },
  blitz: { name: 'Blitz Mate', desc: 'Giải càng nhiều thế cờ càng tốt trong 3 phút' },
};

/**
 * Danh mục sản phẩm. `grants` là các món nhận được khi mua. Giá chỉ để hiển thị
 * (giá đề xuất trong kế hoạch), không có thanh toán thật.
 */
export const PRODUCTS = {
  'rook-pass': { name: 'Rook Pass', price: '$4.99', kind: 'pass' /* mỗi tháng; giao diện ghi "/month" theo ngôn ngữ (khoá pass.price) */ },
  'starter-bundle': {
    name: 'Starter Bundle', price: '$9.99', kind: 'bundle',
    grants: ['mode:obstacle', 'board:marble', 'pieces:marble'],
  },
  'board:marble': { name: 'Bàn Cẩm thạch', price: '$2.99', kind: 'skin', grants: ['board:marble'] },
  'board:neon': { name: 'Bàn Neon', price: '$2.99', kind: 'skin', grants: ['board:neon'] },
  'pieces:marble': { name: 'Quân Cẩm thạch', price: '$2.99', kind: 'skin', grants: ['pieces:marble'] },
  'pieces:neon': { name: 'Quân Neon', price: '$2.99', kind: 'skin', grants: ['pieces:neon'] },
  'set:marble': { name: 'Bộ Cẩm thạch (bàn + quân)', price: '$4.99', kind: 'set', grants: ['board:marble', 'pieces:marble'] },
  'set:neon': { name: 'Bộ Neon (bàn + quân)', price: '$4.99', kind: 'set', grants: ['board:neon', 'pieces:neon'] },
  'mode:obstacle': { name: 'Mode Obstacle', price: '$3.99', kind: 'mode', grants: ['mode:obstacle'] },
  'mode:blitz': { name: 'Mode Blitz Mate', price: '$3.99', kind: 'mode', grants: ['mode:blitz'] },
};

/** Tạo cửa hàng cho người chơi mới. `installDate` đặt sau bằng ensureInstallDate. */
export function createStore() {
  return {
    installDate: null,
    owned: [],
    pass: { until: null, trialUsed: false },
    equipped: { board: 'classic', pieces: 'ivory' },
  };
}

/** Ghi ngày cài game nếu chưa có (gọi mỗi lần mở game, chỉ có tác dụng lần đầu). */
export function ensureInstallDate(store, today) {
  if (!store.installDate) store.installDate = today;
}

// ---------------------------------------------------------------------------
// Rook Pass
// ---------------------------------------------------------------------------

/** Rook Pass còn hạn vào ngày `today` không. */
export function hasPass(store, today) {
  return Boolean(store.pass.until) && daysBetween(today, store.pass.until) >= 0;
}

/** Số ngày Pass còn lại (tính cả hôm nay), 0 nếu không có. */
export function passDaysLeft(store, today) {
  return hasPass(store, today) ? daysBetween(today, store.pass.until) + 1 : 0;
}

/**
 * Bắt đầu dùng thử Rook Pass 7 ngày (mỗi người chỉ một lần).
 * Trả về { ok, until } hoặc { ok: false, reason: 'trial-used' }.
 */
export function startPassTrial(store, today) {
  if (store.pass.trialUsed) return { ok: false, reason: 'trial-used' };
  store.pass.trialUsed = true;
  store.pass.until = addDays(today, PASS_TRIAL_DAYS - 1);
  return { ok: true, until: store.pass.until };
}

/**
 * "Đăng ký" Rook Pass (giả lập): thêm một kỳ 30 ngày, nối tiếp hạn hiện tại nếu
 * còn hạn. Trả về { ok, until }.
 */
export function subscribePass(store, today) {
  const start = hasPass(store, today) ? addDays(store.pass.until, 1) : today;
  store.pass.until = addDays(start, PASS_PERIOD_DAYS - 1);
  store.pass.trialUsed = true; // đã trả tiền thì không cần dùng thử nữa
  return { ok: true, until: store.pass.until };
}

// ---------------------------------------------------------------------------
// Sở hữu và mua
// ---------------------------------------------------------------------------

/**
 * Người chơi có quyền dùng món `itemId` (ví dụ 'board:marble', 'mode:blitz') không:
 *   - skin mặc định: luôn có;
 *   - đã mua lẻ / qua bộ: có;
 *   - Rook Pass còn hạn: có MỌI mode và skin độc quyền của Pass.
 */
export function owns(store, itemId, today) {
  const [kind, id] = itemId.split(':');
  if (kind === 'board' || kind === 'pieces') {
    const skin = SKINS[kind][id];
    if (!skin) return false;
    if (skin.default) return true;
    if (skin.exclusive === 'pass') return hasPass(store, today);
  }
  if (store.owned.includes(itemId)) return true;
  return kind === 'mode' && hasPass(store, today);
}

/** Starter Bundle còn bán không: trong 7 ngày đầu kể từ khi cài và chưa mua. */
export function starterAvailable(store, today) {
  if (store.owned.includes('starter-bundle') || !store.installDate) return false;
  return daysBetween(store.installDate, today) < STARTER_DAYS;
}

/** Số ngày Starter Bundle còn bán (0 nếu hết). */
export function starterDaysLeft(store, today) {
  return starterAvailable(store, today) ? STARTER_DAYS - daysBetween(store.installDate, today) : 0;
}

/**
 * "Mua" sản phẩm `productId` (giả lập). Trả về { ok, granted } với granted là các
 * món vừa nhận, hoặc { ok: false, reason } với reason:
 *   'unknown' (không có sản phẩm này), 'expired' (Starter Bundle đã hết hạn bán),
 *   'owned' (đã có đủ mọi món trong sản phẩm này).
 * Rook Pass mua bằng subscribePass, không qua hàm này.
 */
export function buy(store, productId, today) {
  const product = PRODUCTS[productId];
  if (!product || product.kind === 'pass') return { ok: false, reason: 'unknown' };
  if (productId === 'starter-bundle' && !starterAvailable(store, today)) return { ok: false, reason: 'expired' };
  const granted = product.grants.filter((g) => !store.owned.includes(g));
  if (granted.length === 0 && productId !== 'starter-bundle') return { ok: false, reason: 'owned' };
  store.owned.push(...granted);
  if (productId === 'starter-bundle') store.owned.push('starter-bundle');
  return { ok: true, granted };
}

// ---------------------------------------------------------------------------
// Skin đang dùng và mode
// ---------------------------------------------------------------------------

/**
 * Trang bị skin `skinId` cho `kind` ('board' hoặc 'pieces'). Phải có quyền dùng.
 * Trả về true nếu đổi được.
 */
export function equip(store, kind, skinId, today) {
  if (!SKINS[kind]?.[skinId] || !owns(store, `${kind}:${skinId}`, today)) return false;
  store.equipped[kind] = skinId;
  return true;
}

/**
 * Skin thực sự được vẽ hôm nay. Nếu skin đang trang bị không còn quyền dùng (ví dụ
 * skin độc quyền mà Rook Pass đã hết hạn) thì quay về skin mặc định.
 */
export function activeSkins(store, today) {
  const pick = (kind) => {
    const id = store.equipped[kind];
    if (SKINS[kind][id] && owns(store, `${kind}:${id}`, today)) return id;
    return Object.keys(SKINS[kind]).find((k) => SKINS[kind][k].default);
  };
  return { board: pick('board'), pieces: pick('pieces') };
}

/**
 * Bài thứ `index` (đếm từ 0) của mode `mode` có được chơi không: 5 bài đầu miễn
 * phí, từ bài thứ 6 phải sở hữu mode (mua lẻ, Starter Bundle hoặc Rook Pass).
 */
export function canPlayModeLevel(store, mode, index, today) {
  return index < FREE_MODE_LEVELS || owns(store, `mode:${mode}`, today);
}
