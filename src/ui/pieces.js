// =============================================================================
// ui/pieces.js — Quân cờ tự vẽ bằng SVG (không dùng hình hay font bên ngoài).
//
// Mỗi quân vẽ trong khung 100 × 120 (cao hơn rộng để quân "đứng" nhô lên khỏi
// ô cờ, nhìn có chiều sâu). Mọi quân có chung một bệ tròn ở dưới; phần thân
// và đầu khác nhau theo loại quân. Quân trắng tô dải màu sáng, quân đen tô dải
// màu tối; cả hai có viền đậm và một vệt sáng bên trái để trông như khối tròn.
// Bóng đổ dưới quân làm bằng CSS (filter drop-shadow) trong style.css.
// =============================================================================

/** Màu của từng bên: dải màu thân (trên → dưới), viền, vệt sáng. */
const COLORS = {
  w: { top: '#ffffff', bottom: '#d8d4cc', stroke: '#2d2a26', shine: 'rgba(255,255,255,0.9)' },
  b: { top: '#6a6662', bottom: '#2a2725', stroke: '#141210', shine: 'rgba(255,255,255,0.28)' },
};

/** Bệ chung: một đĩa dẹt và một vòng nhỏ phía trên. */
const BASE = `
  <rect x="17" y="99" width="66" height="13" rx="6.5"/>
  <rect x="25" y="91" width="50" height="11" rx="5.5"/>`;

/**
 * Phần riêng của từng quân (vẽ sau bệ, nên thân đè lên vòng bệ).
 * Toạ độ chọn tay; đổi số ở đây để chỉnh dáng quân.
 */
const SHAPES = {
  // Tốt: đầu tròn, cổ áo, thân loe.
  p: `
    <path d="M31 93 C35 81 41 74 42.5 66 L57.5 66 C59 74 65 81 69 93 Z"/>
    <rect x="35" y="59" width="30" height="9" rx="4.5"/>
    <circle cx="50" cy="45" r="15"/>`,
  // Xe: tháp có lỗ châu mai.
  r: `
    <path d="M30 93 L34.5 55 L65.5 55 L70 93 Z"/>
    <rect x="30" y="50" width="40" height="9" rx="3"/>
    <path d="M27 52 L27 27 Q27 25 29 25 L37 25 Q39 25 39 27 L39 33 L44.5 33 L44.5 27 Q44.5 25 46.5 25 L53.5 25 Q55.5 25 55.5 27 L55.5 33 L61 33 L61 27 Q61 25 63 25 L71 25 Q73 25 73 27 L73 52 Z"/>`,
  // Mã: đầu ngựa nhìn sang trái, có bờm.
  n: `
    <path d="M33 93 C33 82 37 74 40 68 C34 66 25 61 25 54 C25 49 29 46 33 44 L45 33 C46 25 51 17 59 16 L61 10 L66 19 C77 26 80 41 77 56 C75 69 70 80 69 93 Z"/>
    <circle cx="51" cy="31" r="2.8" class="detail-fill"/>
    <path d="M62 24 C69 34 71 48 67 62" class="detail" fill="none"/>`,
  // Tượng: mũ nhọn có khe xẻ chéo, chóp có hạt tròn.
  b: `
    <path d="M32 93 C36 81 42 74 43 67 L57 67 C58 74 64 81 68 93 Z"/>
    <rect x="35" y="60" width="30" height="9" rx="4.5"/>
    <path d="M50 21 C64 31 67 46 60 61 L40 61 C33 46 36 31 50 21 Z"/>
    <circle cx="50" cy="17" r="5.5"/>
    <path d="M57 32 L48 45" class="detail" fill="none"/>`,
  // Hậu: vương miện 5 cánh, mỗi cánh có hạt tròn.
  q: `
    <path d="M30 93 C34 79 40 71 42 63 L58 63 C60 71 66 79 70 93 Z"/>
    <rect x="32" y="56" width="36" height="9" rx="4.5"/>
    <path d="M30 59 L24 28 L37 44 L42 22 L50 41 L58 22 L63 44 L76 28 L70 59 Z"/>
    <circle cx="24" cy="25" r="4.5"/><circle cx="42" cy="19" r="4.5"/><circle cx="58" cy="19" r="4.5"/><circle cx="76" cy="25" r="4.5"/>`,
  // Vua: mái vòm và cây thánh giá trên đỉnh.
  k: `
    <path d="M30 93 C34 79 40 71 42 63 L58 63 C60 71 66 79 70 93 Z"/>
    <rect x="32" y="56" width="36" height="9" rx="4.5"/>
    <path d="M32 59 C26 47 28 36 38 33 L62 33 C72 36 74 47 68 59 Z"/>
    <rect x="45.5" y="6" width="9" height="28" rx="2"/>
    <rect x="37" y="12" width="26" height="8.5" rx="2"/>`,
};

/**
 * Trả về chuỗi SVG của một quân. `piece` là ký tự FEN ('K', 'q', ...).
 * Mỗi lời gọi tạo id dải màu riêng của bên đó (dùng chung được vì giống nhau).
 */
export function pieceSvg(piece) {
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  const type = piece.toLowerCase();
  const c = COLORS[color];
  const grad = `rc-grad-${color}`;
  const shine = `rc-shine-${color}`;
  return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/>
    </linearGradient>
    <linearGradient id="${shine}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${c.shine}"/><stop offset="0.35" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <g fill="url(#${grad})" stroke="${c.stroke}" stroke-width="3.2" stroke-linejoin="round" class="piece-body">
    ${BASE}${SHAPES[type]}
  </g>
  <g fill="url(#${shine})" stroke="none" class="piece-shine" style="--detail:${c.stroke}">
    ${BASE}${SHAPES[type]}
  </g>
</svg>`.replace(/class="detail"/g, `stroke="${c.stroke}" stroke-width="3" stroke-linecap="round"`)
    .replace(/class="detail-fill"/g, `fill="${c.stroke}" stroke="none"`);
}

/** Tên tiếng Việt của quân (cho hộp phong cấp và nhãn trợ năng). */
export const PIECE_NAMES = { k: 'Vua', q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã', p: 'Tốt' };
