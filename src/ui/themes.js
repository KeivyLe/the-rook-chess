// =============================================================================
// ui/themes.js — Màu nền thay đổi theo level.
//
// Mỗi level chính lấy một màu trong bảng theo thứ tự xoay vòng, nên hai level
// liền nhau luôn khác màu. Daily luôn dùng một màu riêng để người chơi nhận ra.
// Màu ghi ở dạng HSL (sắc độ, độ bão hoà, độ sáng) để dễ tính màu đậm/nhạt hơn
// cho chữ phụ và nút.
// =============================================================================

/** Bảng màu nền: [sắc độ, độ bão hoà %, độ sáng %]. */
export const THEMES = [
  { name: 'rượu vang', hsl: [356, 30, 38] },
  { name: 'lục rêu', hsl: [160, 22, 40] },
  { name: 'xanh xám', hsl: [207, 26, 42] },
  { name: 'tím mận', hsl: [282, 18, 40] },
  { name: 'nâu đất', hsl: [24, 30, 38] },
  { name: 'xanh mòng két', hsl: [186, 26, 36] },
  { name: 'chàm', hsl: [228, 22, 42] },
  { name: 'ô liu', hsl: [70, 20, 36] },
];

/** Màu riêng cho Daily Puzzle. */
export const DAILY_THEME = { name: 'xanh biển', hsl: [210, 32, 44] };

/** Màu nền cho level chính `id` (id bắt đầu từ 1). */
export function themeForLevel(id) {
  return THEMES[(id - 1) % THEMES.length];
}

/**
 * Áp màu vào trang: đặt các biến CSS --bg (nền), --bg-deep (vùng tối hơn cho
 * hiệu ứng ánh sáng giữa màn hình) và --ink-soft (chữ phụ như "Level 8").
 */
export function applyTheme(theme) {
  const [hue, sat, light] = theme.hsl;
  const root = document.documentElement.style;
  root.setProperty('--bg', `hsl(${hue} ${sat}% ${light}%)`);
  root.setProperty('--bg-glow', `hsl(${hue} ${sat}% ${light + 8}%)`);
  root.setProperty('--bg-deep', `hsl(${hue} ${sat}% ${light - 8}%)`);
  root.setProperty('--ink-soft', `hsl(${hue} ${sat}% ${Math.max(light - 18, 12)}% / 0.85)`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `hsl(${hue} ${sat}% ${light}%)`);
}
