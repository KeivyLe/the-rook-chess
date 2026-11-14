// =============================================================================
// trophies.js — Trophy kiểu PS5: Đồng / Bạc / Vàng / Bạch kim (Kế hoạch MKT,
// tab Tính năng, mục 4).
//
// - Mỗi trophy có điều kiện tính từ "thống kê" của người chơi (collectStats).
// - Bạch kim đạt được khi đã có MỌI trophy khác.
// - Lưu trên máy. Kế hoạch còn muốn hiện "% người chơi đạt" và đồng bộ Game Center /
//   Play Games: phần đó cần máy chủ hoặc app di động, bản web chưa làm được.
// - Không bán trophy, không thưởng coin cho trophy (theo kế hoạch).
//
// Trạng thái (lưu được bằng JSON): { unlocked: { "<id>": "yyyymmdd" } }
// =============================================================================

/** Thứ tự và tên các hạng. */
export const TIERS = {
  bronze: 'Đồng',
  silver: 'Bạc',
  gold: 'Vàng',
  platinum: 'Bạch kim',
};

/**
 * Danh sách trophy. `test(stats)` trả true khi đạt. Bạch kim xét riêng
 * (cần mọi trophy khác) nên không có test.
 */
export const TROPHIES = [
  { id: 'first-mate', tier: 'bronze', name: 'Nước chiếu đầu tiên', desc: 'Giải 1 level', test: (s) => s.levelsSolved >= 1 },
  { id: 'chapter-1', tier: 'bronze', name: 'Làm quen', desc: 'Giải hết chương 1', test: (s) => s.chaptersDone.includes(1) },
  { id: 'daily-1', tier: 'bronze', name: 'Mỗi ngày một thế', desc: 'Giải 1 Daily Puzzle', test: (s) => s.dailySolved >= 1 },
  { id: 'obstacle-1', tier: 'bronze', name: 'Vượt chướng ngại', desc: 'Giải 1 bài mode Obstacle', test: (s) => s.obstacleSolved >= 1 },
  { id: 'blitz-3', tier: 'bronze', name: 'Nhanh tay', desc: 'Giải 3 thế trong một lượt Blitz', test: (s) => s.blitzBest >= 3 },
  { id: 'chapter-2', tier: 'silver', name: 'Phối hợp', desc: 'Giải hết chương 2', test: (s) => s.chaptersDone.includes(2) },
  { id: 'no-hint-10', tier: 'silver', name: 'Tự lực', desc: 'Giải 10 level không dùng gợi ý', test: (s) => s.hintlessSolved >= 10 },
  { id: 'streak-3', tier: 'silver', name: 'Ba ngày liền', desc: 'Chuỗi Daily 3 ngày', test: (s) => s.bestStreak >= 3 },
  { id: 'blitz-8', tier: 'silver', name: 'Chớp nhoáng', desc: 'Giải 8 thế trong một lượt Blitz', test: (s) => s.blitzBest >= 8 },
  { id: 'chapter-3', tier: 'gold', name: 'Tính toán', desc: 'Giải hết chương 3', test: (s) => s.chaptersDone.includes(3) },
  { id: 'chapter-4', tier: 'gold', name: 'Cao thủ', desc: 'Giải hết chương 4', test: (s) => s.chaptersDone.includes(4) },
  { id: 'perfect-25', tier: 'gold', name: 'Hoàn hảo', desc: 'Giải hoàn hảo 25 level (không gợi ý, không đi lệch)', test: (s) => s.perfectSolved >= 25 },
  { id: 'streak-7', tier: 'gold', name: 'Một tuần không nghỉ', desc: 'Chuỗi Daily 7 ngày', test: (s) => s.bestStreak >= 7 },
  { id: 'platinum', tier: 'platinum', name: 'Vua cờ thế', desc: 'Đạt mọi trophy khác' },
];

/** Tạo dữ liệu trophy cho người chơi mới. */
export function createTrophies() {
  return { unlocked: {} };
}

/**
 * Gom thống kê từ save data (progress, modes) và dữ liệu level (để biết level
 * nào thuộc chương nào). Hàm thuần: chỉ đọc, không sửa gì.
 */
export function collectStats(save, levelData) {
  const solved = save.progress.solved;
  const records = Object.values(solved);
  const chaptersDone = levelData.chapters
    .map((ch) => ch.chapter)
    .filter((n) => levelData.levels.filter((l) => l.chapter === n).every((l) => solved[l.id]));
  return {
    levelsSolved: records.length,
    chaptersDone,
    hintlessSolved: records.filter((r) => !r.hintUsed).length,
    perfectSolved: records.filter((r) => r.perfect).length,
    dailySolved: save.progress.daily.solvedDates.length,
    bestStreak: save.progress.daily.bestStreak,
    obstacleSolved: Object.keys(save.modes.obstacle.solved).length,
    blitzBest: save.modes.blitz.best,
  };
}

/**
 * Xét lại mọi trophy với thống kê `stats`; trophy nào mới đạt thì ghi ngày `today`.
 * Trả về danh sách trophy VỪA đạt (để giao diện hiện thông báo), theo thứ tự trong TROPHIES.
 */
export function evaluateTrophies(trophies, stats, today) {
  const fresh = [];
  for (const t of TROPHIES) {
    if (t.tier === 'platinum' || trophies.unlocked[t.id]) continue;
    if (t.test(stats)) {
      trophies.unlocked[t.id] = today;
      fresh.push(t);
    }
  }
  const platinum = TROPHIES.find((t) => t.tier === 'platinum');
  const allOthers = TROPHIES.every((t) => t.tier === 'platinum' || trophies.unlocked[t.id]);
  if (allOthers && !trophies.unlocked[platinum.id]) {
    trophies.unlocked[platinum.id] = today;
    fresh.push(platinum);
  }
  return fresh;
}

/** Đếm số trophy đã đạt theo từng hạng, ví dụ { bronze: 2, silver: 0, gold: 0, platinum: 0 }. */
export function trophyCounts(trophies) {
  const counts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  for (const t of TROPHIES) if (trophies.unlocked[t.id]) counts[t.tier]++;
  return counts;
}
