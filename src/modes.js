// =============================================================================
// modes.js — Tiến trình của các mode bán thêm (Kế hoạch MKT, tab Tính năng):
//   - Obstacle: bộ thế cờ có vật cản trên bàn (ô bị khoá). Luật đi giống hệt ô
//     "lỗ" 'x' đã có: quân không đứng, đi vào hay trượt qua; Mã nhảy qua được.
//     Khác ở cách vẽ: lỗ của bàn thường thì không vẽ, còn vật cản vẽ thành khối đá.
//   - Blitz Mate: giải càng nhiều thế cờ càng tốt trong BLITZ_SECONDS giây. Giữ
//     kỷ lục cá nhân và kỷ lục tuần (bảng xếp hạng tuần cần máy chủ, chưa làm).
// File này chỉ ghi kết quả; quyền chơi (5 bài thử) nằm ở store.js.
//
// Trạng thái (lưu được bằng JSON):
//   obstacle: { solved: { "<chỉ số bài>": { perfect } } }
//   blitz   : { best, weekKey, weekBest, runs }
// =============================================================================

import { weekKey } from './progress.js';

/** Thời gian một lượt Blitz (giây). */
export const BLITZ_SECONDS = 180;

/** Tạo tiến trình mode cho người chơi mới. */
export function createModes() {
  return {
    obstacle: { solved: {} },
    blitz: { best: 0, weekKey: null, weekBest: 0, runs: 0 },
  };
}

/**
 * Ghi nhận đã giải bài Obstacle thứ `index` (đếm từ 0). Giữ kết quả tốt nhất.
 * Trả về { firstTime }.
 */
export function markObstacleSolved(modes, index, { perfect = false } = {}) {
  const before = modes.obstacle.solved[index];
  modes.obstacle.solved[index] = { perfect: Boolean(before?.perfect) || perfect };
  return { firstTime: !before };
}

/** Số bài Obstacle đã giải. */
export function obstacleSolvedCount(modes) {
  return Object.keys(modes.obstacle.solved).length;
}

/**
 * Ghi kết quả một lượt Blitz: `score` = số thế cờ giải được, `today` = "yyyymmdd".
 * Sang tuần mới thì kỷ lục tuần bắt đầu lại từ 0.
 * Trả về { best, weekBest, newBest, newWeekBest } để màn kết quả hiện "Kỷ lục mới!".
 */
export function recordBlitz(modes, score, today) {
  const b = modes.blitz;
  const wk = weekKey(today);
  if (b.weekKey !== wk) {
    b.weekKey = wk;
    b.weekBest = 0;
  }
  b.runs++;
  const newBest = score > b.best;
  const newWeekBest = score > b.weekBest;
  if (newBest) b.best = score;
  if (newWeekBest) b.weekBest = score;
  return { best: b.best, weekBest: b.weekBest, newBest, newWeekBest };
}

/** Kỷ lục tuần hiển thị ở ngày `today` (tuần khác thì là 0). */
export function blitzWeekBest(modes, today) {
  return modes.blitz.weekKey === weekKey(today) ? modes.blitz.weekBest : 0;
}

/**
 * Thứ tự bài cho một lượt Blitz: trộn ngẫu nhiên chỉ số 0..count-1 (Fisher–Yates).
 * `random` là hàm số ngẫu nhiên trong [0, 1) (test truyền hàm cố định).
 */
export function blitzQueue(count, random = Math.random) {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
