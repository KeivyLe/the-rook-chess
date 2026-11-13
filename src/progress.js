// =============================================================================
// progress.js — Tiến trình người chơi (tài liệu thiết kế mục 5).
//
//   - Chuỗi level chính tuyến tính: thắng level n thì mở level n+1.
//   - Ghi lại level nào đã giải, có dùng gợi ý hay không.
//   - Daily Puzzle: mỗi ngày một level chọn theo ngày, giữ chuỗi ngày liên tiếp (streak).
//
// Trạng thái tiến trình là một đối tượng thường (lưu được bằng JSON):
//   unlockedLevel : level cao nhất đã mở (bắt đầu từ 1).
//   solved        : { "<id>": { hintUsed } } các level chính đã giải.
//   daily         : { lastDate, streak, bestStreak, solvedDates: [...] }
//                   lastDate là ngày gần nhất giải Daily, dạng "yyyymmdd".
// Ngày luôn được truyền vào dưới dạng chuỗi "yyyymmdd" để test cố định được ngày;
// dùng dateKey(new Date()) để lấy ngày hôm nay.
// =============================================================================

/** Tạo tiến trình cho người chơi mới: chỉ mở level 1, chưa giải gì. */
export function createProgress() {
  return {
    unlockedLevel: 1,
    solved: {},
    daily: { lastDate: null, streak: 0, bestStreak: 0, solvedDates: [] },
  };
}

// ---------------------------------------------------------------------------
// Chuỗi level chính
// ---------------------------------------------------------------------------

/** Level `id` đã mở chưa (được phép vào chơi)? */
export function isUnlocked(progress, id) {
  return id >= 1 && id <= progress.unlockedLevel;
}

/**
 * Trạng thái level cho màn hình chọn level (GDD mục 7.1):
 * 'solved' (đã giải), 'open' (đã mở, chưa giải), 'locked' (khoá, hiện ổ khoá).
 */
export function levelStatus(progress, id) {
  if (progress.solved[id]) return 'solved';
  return isUnlocked(progress, id) ? 'open' : 'locked';
}

/**
 * Ghi nhận người chơi vừa thắng level chính `id`.
 *   hintUsed  : lần này có dùng gợi ý không.
 *   totalLevels: tổng số level, để không mở quá level cuối.
 * Mở khoá level kế tiếp. Nếu giải lại level cũ: giữ kết quả TỐT nhất
 * (đã từng giải không gợi ý thì vẫn tính là không gợi ý).
 * Trả về { firstTime, unlocked } với unlocked là id level vừa được mở (hoặc null).
 */
export function markSolved(progress, id, { hintUsed = false, totalLevels = Infinity } = {}) {
  if (!isUnlocked(progress, id)) throw new Error(`Level ${id} chưa mở, không thể ghi là đã giải`);
  const before = progress.solved[id];
  const firstTime = !before;
  progress.solved[id] = { hintUsed: before ? before.hintUsed && hintUsed : hintUsed };

  let unlocked = null;
  if (id === progress.unlockedLevel && id < totalLevels) {
    progress.unlockedLevel = id + 1;
    unlocked = id + 1;
  }
  return { firstTime, unlocked };
}

/**
 * Level người chơi nên vào khi bấm nút Play lớn ở màn Home: level đã mở cao
 * nhất (level đang dở). Đã giải hết thì trả level cuối.
 */
export function currentLevel(progress, totalLevels) {
  return Math.min(progress.unlockedLevel, totalLevels);
}

// ---------------------------------------------------------------------------
// Ngày tháng (dạng "yyyymmdd")
// ---------------------------------------------------------------------------

/**
 * Đổi một Date thành chuỗi "yyyymmdd" theo GIỜ ĐỊA PHƯƠNG của người chơi,
 * ví dụ 12/11/2026 → "20261112". Daily đổi level lúc nửa đêm theo giờ máy.
 */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Đổi "yyyymmdd" thành số thứ tự ngày (số ngày kể từ 01/01/1970).
 * Dùng UTC để phép trừ ngày luôn chính xác, không bị lệch do giờ mùa hè.
 */
function dayNumber(key) {
  if (!/^\d{8}$/.test(key)) throw new Error(`Ngày phải có dạng yyyymmdd, nhận được "${key}"`);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(4, 6));
  const d = Number(key.slice(6, 8));
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Ngày liền trước của một ngày "yyyymmdd", ví dụ "20261201" → "20261130". */
export function previousDateKey(key) {
  const date = new Date((dayNumber(key) - 1) * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// ---------------------------------------------------------------------------
// Daily Puzzle
// ---------------------------------------------------------------------------

/**
 * Chọn level Daily cho ngày `key` trong danh sách có `count` level.
 * Lấy số thứ tự ngày chia lấy dư cho count: ngày liên tiếp nhận level liên
 * tiếp, và sau đúng `count` ngày thì mới lặp lại. Mọi người chơi cùng ngày
 * nhận cùng một level (giống "seed = yyyymmdd" trong GDD mục 5.3).
 * Trả về chỉ số 0..count-1 trong mảng daily của levels.json.
 */
export function dailyIndex(key, count) {
  if (!(count > 0)) throw new Error('Danh sách Daily rỗng');
  return ((dayNumber(key) % count) + count) % count;
}

/** Hôm nay (ngày `key`) đã giải Daily chưa? */
export function isDailySolved(progress, key) {
  return progress.daily.solvedDates.includes(key);
}

/**
 * Ghi nhận đã giải Daily của ngày `key` và cập nhật streak:
 *   - đã giải hôm nay rồi: không đổi gì (firstTime = false, không thưởng lần 2);
 *   - lần giải trước là hôm qua: streak + 1;
 *   - còn lại (bỏ lỡ ít nhất 1 ngày, hoặc lần đầu): streak về 1.
 * Trả về { firstTime, streak }.
 */
export function completeDaily(progress, key) {
  const daily = progress.daily;
  if (isDailySolved(progress, key)) return { firstTime: false, streak: daily.streak };
  daily.streak = daily.lastDate === previousDateKey(key) ? daily.streak + 1 : 1;
  daily.bestStreak = Math.max(daily.bestStreak, daily.streak);
  daily.lastDate = key;
  daily.solvedDates.push(key);
  return { firstTime: true, streak: daily.streak };
}

/**
 * Streak hiển thị ở ngày `key`: còn giữ nếu lần giải gần nhất là hôm nay hoặc
 * hôm qua (hôm nay vẫn còn kịp giải để nối chuỗi); nếu đã bỏ lỡ thì hiện 0.
 */
export function currentStreak(progress, key) {
  const { lastDate, streak } = progress.daily;
  if (lastDate === key || lastDate === previousDateKey(key)) return streak;
  return 0;
}
