// =============================================================================
// economy.js — Nền kinh tế coin (tài liệu thiết kế mục 6).
//
// Chỉ có một loại tiền là coin. Coin kiếm được khi giải level và khi "xem quảng
// cáo" (giả lập), và chỉ dùng để mua gợi ý. Quảng cáo và cửa hàng đều là giả
// lập: không có SDK quảng cáo, không có thanh toán thật.
//
// Trạng thái kinh tế là một đối tượng thường (lưu được bằng JSON):
//   coins          : số coin hiện có.
//   adsDate        : ngày (dạng "yyyymmdd") của lần đếm lượt xem quảng cáo gần nhất.
//   adsWatched     : số lần đã xem quảng cáo thưởng trong ngày adsDate.
//   noAds          : true nếu đã "mua" gói Remove Ads (tắt quảng cáo xen giữa level).
//   levelsSinceAd  : số level đã thắng kể từ quảng cáo xen giữa gần nhất.
// Các hàm bên dưới sửa trực tiếp đối tượng này và trả về kết quả để giao diện hiển thị.
// File này không biết gì về bàn cờ hay giao diện.
// =============================================================================

/** Bảng số của GDD mục 6.2 (đề xuất, chỉnh ở đây khi cân bằng lại game). */
export const START_COINS = 100;
export const REWARD_FIRST_SOLVE = 10;   // giải level lần đầu
export const REWARD_PERFECT_BONUS = 5;  // thêm nếu không dùng gợi ý, không đi sai
export const REWARD_DAILY = 20;         // giải Daily Puzzle (gấp đôi level thường)
export const REWARD_AD = 25;            // mỗi lần "xem quảng cáo"
export const MAX_ADS_PER_DAY = 5;

/** Giá 3 mức gợi ý. */
export const HINT_COSTS = {
  1: 20,  // tô sáng quân cần đi
  2: 40,  // hiện nước đi tiếp theo
  3: 100, // hiện toàn bộ lời giải
};

/** Quảng cáo xen giữa level: không hiện ở 10 level đầu, sau đó cứ 3 level hiện 1 lần. */
export const INTERSTITIAL_FREE_LEVELS = 10;
export const INTERSTITIAL_EVERY = 3;

/** Các gói trong cửa hàng giả lập. Bấm mua chỉ cộng coin hoặc bật noAds. */
export const SHOP_PACKS = {
  small: { coins: 200 },
  medium: { coins: 500 },
  large: { coins: 1200 },
  removeAds: { noAds: true },
};

/** Tạo trạng thái kinh tế ban đầu cho người chơi mới. */
export function createEconomy() {
  return { coins: START_COINS, adsDate: null, adsWatched: 0, noAds: false, levelsSinceAd: 0 };
}

/**
 * Tính số coin thưởng khi giải xong một level (chưa cộng vào ví).
 *   firstTime: lần đầu giải level này? Giải lại level cũ không được coin
 *              (tránh "cày coin", GDD mục 6.2).
 *   perfect  : không dùng gợi ý và không đi sai nước nào.
 *   daily    : là Daily Puzzle (chỉ tính lần đầu trong ngày; progress.js quyết định firstTime).
 */
export function solveReward({ firstTime, perfect = false, daily = false }) {
  if (!firstTime) return 0;
  const base = daily ? REWARD_DAILY : REWARD_FIRST_SOLVE;
  return base + (perfect ? REWARD_PERFECT_BONUS : 0);
}

/**
 * Cộng coin thưởng giải level vào ví. Trả về số coin vừa được cộng
 * (giao diện dùng số này cho hiệu ứng "coin bay vào ví").
 */
export function addSolveReward(economy, info) {
  const gained = solveReward(info);
  economy.coins += gained;
  return gained;
}

/** Đủ coin để mua gợi ý mức `hintLevel` (1, 2 hoặc 3) không? */
export function canAffordHint(economy, hintLevel) {
  const cost = HINT_COSTS[hintLevel];
  if (cost === undefined) throw new Error(`Mức gợi ý không hợp lệ: ${hintLevel} (chỉ có 1, 2, 3)`);
  return economy.coins >= cost;
}

/**
 * Trả coin để mua gợi ý. Nếu không đủ coin thì không trừ gì.
 * Trả về { ok, cost, coins } với coins là số dư sau giao dịch.
 */
export function spendForHint(economy, hintLevel) {
  const cost = HINT_COSTS[hintLevel];
  if (!canAffordHint(economy, hintLevel)) return { ok: false, cost, coins: economy.coins };
  economy.coins -= cost;
  return { ok: true, cost, coins: economy.coins };
}

/**
 * Đưa bộ đếm quảng cáo về 0 nếu đã sang ngày mới. Gọi trước khi đọc hoặc
 * tăng adsWatched. `today` là chuỗi "yyyymmdd" (xem progress.js dateKey).
 */
function refreshAdCounter(economy, today) {
  if (economy.adsDate !== today) {
    economy.adsDate = today;
    economy.adsWatched = 0;
  }
}

/** Hôm nay còn được xem bao nhiêu lần quảng cáo thưởng. */
export function adsRemaining(economy, today) {
  refreshAdCounter(economy, today);
  return MAX_ADS_PER_DAY - economy.adsWatched;
}

/**
 * Người chơi bấm "Xem quảng cáo +25" và xem hết (giả lập). Hết lượt trong
 * ngày thì không được thưởng. Trả về { ok, gained, remaining }.
 */
export function watchRewardedAd(economy, today) {
  refreshAdCounter(economy, today);
  if (economy.adsWatched >= MAX_ADS_PER_DAY) return { ok: false, gained: 0, remaining: 0 };
  economy.adsWatched++;
  economy.coins += REWARD_AD;
  return { ok: true, gained: REWARD_AD, remaining: MAX_ADS_PER_DAY - economy.adsWatched };
}

/**
 * Gọi mỗi khi người chơi thắng một level CHÍNH (không tính Daily).
 * Trả về true nếu ngay lúc này phải hiện quảng cáo xen giữa (màn hình "Ad" 5 giây).
 * Quy tắc (GDD mục 6.3): không hiện ở 10 level đầu, đã mua Remove Ads thì không
 * bao giờ hiện, còn lại cứ thắng đủ 3 level thì hiện 1 lần rồi đếm lại.
 */
export function onLevelWon(economy, levelId) {
  if (economy.noAds || levelId <= INTERSTITIAL_FREE_LEVELS) return false;
  economy.levelsSinceAd++;
  if (economy.levelsSinceAd >= INTERSTITIAL_EVERY) {
    economy.levelsSinceAd = 0;
    return true;
  }
  return false;
}

/**
 * "Mua" một gói trong cửa hàng giả lập: cộng coin hoặc bật noAds.
 * Trả về { ok, coins, noAds } sau khi mua; gói không tồn tại thì báo lỗi.
 */
export function buyPack(economy, packId) {
  const pack = SHOP_PACKS[packId];
  if (!pack) throw new Error(`Không có gói "${packId}" trong cửa hàng`);
  if (pack.coins) economy.coins += pack.coins;
  if (pack.noAds) economy.noAds = true;
  return { ok: true, coins: economy.coins, noAds: economy.noAds };
}
