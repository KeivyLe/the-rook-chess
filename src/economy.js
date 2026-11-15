// =============================================================================
// economy.js — Coin, giá gợi ý và quảng cáo thưởng (rewarded) giả lập.
//
// Theo "Kế hoạch MKT The Rook Chess" (tab Kiếm tiền), thay cho GDD mục 6:
//   - Coin chỉ kiếm được khi giải level / Daily, và chỉ dùng để mua gợi ý.
//   - KHÔNG có quảng cáo xen giữa level, KHÔNG có banner, KHÔNG thưởng coin bằng
//     quảng cáo, KHÔNG có gói "bỏ quảng cáo", KHÔNG bán gói coin.
//   - Rewarded tối đa 1 lượt/ngày, chỉ hiện khi người chơi đã đi sai 2 lần ở
//     cùng một bài, đổi lấy 1 gợi ý (miễn phí). Người có Rook Pass không thấy
//     rewarded (vì gợi ý của họ đã miễn phí).
// Tiền thật (Rook Pass, skin, mode) nằm ở store.js; tất cả đều là giả lập.
//
// Trạng thái kinh tế là một đối tượng thường (lưu được bằng JSON):
//   coins       : số coin hiện có.
//   hintAdDate  : ngày ("yyyymmdd") của lần đếm lượt rewarded gần nhất.
//   hintAdsUsed : số lượt rewarded đã dùng trong ngày hintAdDate.
// Các hàm bên dưới sửa trực tiếp đối tượng này và trả về kết quả để giao diện hiển thị.
// File này không biết gì về bàn cờ hay giao diện.
// =============================================================================

/** Bảng số (chỉnh ở đây khi cân bằng lại game). */
export const START_COINS = 100;
export const REWARD_FIRST_SOLVE = 10;   // giải level lần đầu
export const REWARD_PERFECT_BONUS = 5;  // thêm nếu không dùng gợi ý, chưa từng đi lệch
export const REWARD_DAILY = 20;         // giải Daily Puzzle (gấp đôi level thường)

/**
 * Giá một lần gợi ý (coin). Chỉ có MỘT loại gợi ý: mỗi lần bấm, game cho xem nước
 * tiếp theo cần đi (bằng animation, không ghi tên ô). Mate in N thì tối đa N lần
 * gợi ý là giải xong. Người có Rook Pass dùng gợi ý miễn phí.
 */
export const HINT_COST = 20;

/** Rewarded: tối đa 1 lượt mỗi ngày, chỉ khi đã sai ít nhất 2 lần ở bài đang chơi. */
export const HINT_ADS_PER_DAY = 1;
export const HINT_AD_MIN_WRONG = 2;

/** Tạo trạng thái kinh tế ban đầu cho người chơi mới. */
export function createEconomy() {
  return { coins: START_COINS, hintAdDate: null, hintAdsUsed: 0 };
}

/**
 * Tính số coin thưởng khi giải xong một level (chưa cộng vào ví).
 *   firstTime: lần đầu giải level này? Giải lại level cũ không được coin (tránh "cày coin").
 *   perfect  : không dùng gợi ý và chưa từng đi lệch.
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

/** Giá thật phải trả cho một lần gợi ý: 0 nếu có Rook Pass. */
export function hintCost(hasPass = false) {
  return hasPass ? 0 : HINT_COST;
}

/** Đủ coin để mua một lần gợi ý không (có Rook Pass thì luôn đủ)? */
export function canAffordHint(economy, hasPass = false) {
  return economy.coins >= hintCost(hasPass);
}

/**
 * Trả coin cho một lần gợi ý. Không đủ coin thì không trừ gì.
 * Có Rook Pass thì miễn phí (cost = 0).
 * Trả về { ok, cost, coins } với coins là số dư sau giao dịch.
 */
export function spendForHint(economy, hasPass = false) {
  const cost = hintCost(hasPass);
  if (economy.coins < cost) return { ok: false, cost, coins: economy.coins };
  economy.coins -= cost;
  return { ok: true, cost, coins: economy.coins };
}

/** Sang ngày mới thì đếm lại lượt rewarded. `today` là "yyyymmdd". */
function refreshHintAds(economy, today) {
  if (economy.hintAdDate !== today) {
    economy.hintAdDate = today;
    economy.hintAdsUsed = 0;
  }
}

/**
 * Có được hiện nút "Xem quảng cáo để nhận 1 gợi ý" không? Cần đủ cả 3 điều kiện:
 *   - không có Rook Pass (người đăng ký không thấy rewarded),
 *   - đã đi sai ít nhất 2 lần ở bài đang chơi (`wrongMoves` lấy từ puzzle),
 *   - hôm nay chưa dùng hết lượt (1 lượt/ngày).
 */
export function canWatchHintAd(economy, today, { wrongMoves, hasPass = false }) {
  if (hasPass || wrongMoves < HINT_AD_MIN_WRONG) return false;
  refreshHintAds(economy, today);
  return economy.hintAdsUsed < HINT_ADS_PER_DAY;
}

/**
 * Người chơi đã xem hết quảng cáo (giả lập): trừ 1 lượt của hôm nay.
 * Trả về { ok } — ok = false nếu hôm nay đã hết lượt. Gợi ý thì giao diện tự lấy
 * từ puzzle.getHint (không trừ coin).
 */
export function useHintAd(economy, today) {
  refreshHintAds(economy, today);
  if (economy.hintAdsUsed >= HINT_ADS_PER_DAY) return { ok: false };
  economy.hintAdsUsed++;
  return { ok: true };
}
