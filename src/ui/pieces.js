// =============================================================================
// ui/pieces.js — Quân cờ vẽ bằng SVG theo bộ artstyle "Ivory / Espresso" của
// chủ dự án (không dùng hình hay font bên ngoài).
//
// Đặc điểm của artstyle:
//   - Quân là một khối dẹt nhìn thẳng (như khắc nổi), góc bo tròn, viền mảnh
//     cùng tông màu (không viền đen).
//   - Hai màu: Ivory (ngà, quân Trắng) và Espresso (nâu cà phê, quân Đen).
//   - Cảm giác nổi khối nhờ 3 lớp: (1) một bản sao đậm hơn lệch xuống dưới làm
//     "độ dày", (2) thân phẳng, (3) bộ lọc ánh sáng (filter) làm mép trên-trái
//     sáng lên như có đèn chiếu chéo.
//   - Chi tiết khắc chìm (bờm Mã, khe mũ Tượng, gờ bệ) là nét mảnh màu đậm.
//
// Mỗi quân vẽ trong khung 100 × 120. Mỗi bộ phận (bệ, thân, đầu...) là một hình
// riêng có bộ lọc riêng, nên chỗ các bộ phận chồng lên nhau vẫn thấy đường gờ.
// Bóng đổ dưới quân làm bằng CSS (filter drop-shadow) trong style.css.
// =============================================================================

/** Bảng màu của 2 bên, lấy từ ảnh artstyle. */
const PALETTE = {
  w: { // Ivory
    top: '#fdeccf',
    bottom: '#f1d9b2',
    edge: '#a98a60',      // viền mảnh
    depth: '#c3a374',     // độ dày phía dưới
    groove: '#b8996b',    // nét khắc chìm
    grooveLight: 'rgba(255, 250, 238, 0.9)',
    shine: 0.55,          // độ mạnh ánh sáng ở mép
  },
  b: { // Espresso
    top: '#6c4a33',
    bottom: '#55382a',
    edge: '#2f1d12',
    depth: '#38241a',
    groove: '#3a2519',
    grooveLight: 'rgba(255, 226, 196, 0.16)',
    shine: 0.32,
  },
};

/** Bệ chung: một phiến dẹt bo góc ở dưới cùng. */
const BASE = '<rect x="15" y="96" width="70" height="16" rx="5"/>';

/**
 * Hình từng quân: `parts` là các bộ phận (vẽ từ sau ra trước), `grooves` là nét
 * khắc chìm, `dots` là chấm khoét (mắt, lỗ mũi). Toạ độ chọn tay trong khung 100 × 120.
 */
const SHAPES = {
  // Vua: thân hình trái tim (hai thuỳ tròn), chữ thập trên đỉnh, đứng trên bệ.
  k: {
    parts: [
      '<path d="M44 3 h12 a2 2 0 0 1 2 2 v8 h8 a2 2 0 0 1 2 2 v9 a2 2 0 0 1 -2 2 h-8 v9 h-16 v-9 h-8 a2 2 0 0 1 -2 -2 v-9 a2 2 0 0 1 2 -2 h8 v-8 a2 2 0 0 1 2 -2 Z"/>',
      '<path d="M25 97 C25 86 16.5 77 12.5 64 C7.5 47.5 17 33.5 32 33.5 C41 33.5 47 37.5 50 42.5 C53 37.5 59 33.5 68 33.5 C83 33.5 92.5 47.5 87.5 64 C83.5 77 75 86 75 97 Z"/>',
      BASE,
    ],
    grooves: ['M30 95.5 H70'],
  },
  // Hậu: vương miện 5 cánh, đầu mỗi cánh là một hạt tròn, cánh giữa cao nhất.
  q: {
    parts: [
      '<circle cx="8.5" cy="44" r="7"/><circle cx="30" cy="25" r="7"/><circle cx="50" cy="14.5" r="7.4"/><circle cx="70" cy="25" r="7"/><circle cx="91.5" cy="44" r="7"/>',
      '<path d="M24.5 97 L6 48.5 L10.5 43.5 L31.5 57 L27 28.5 L33 26 L45.5 51 L47.2 17 L52.8 17 L54.5 51 L67 26 L73 28.5 L68.5 57 L89.5 43.5 L94 48.5 L75.5 97 Z"/>',
      BASE,
    ],
    grooves: ['M28 95.5 H72'],
  },
  // Tượng: mũ hình giọt nước có khe xẻ chéo, vòng cổ, chân loe, bệ.
  b: {
    parts: [
      '<path d="M31 97 C35 90 39 83 40.5 76 L59.5 76 C61 83 65 90 69 97 Z"/>',
      '<rect x="32" y="67" width="36" height="10" rx="5"/>',
      '<path mask="url(#rc-slit)" d="M50 10 C61 21 69 35 68 49 C67 60 59 67.5 50 67.5 C41 67.5 33 60 32 49 C31 35 39 21 50 10 Z"/>',
      BASE,
    ],
    grooves: [],
    mask: '<mask id="rc-slit" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="120"><rect width="100" height="120" fill="#fff"/><path d="M71 20 L52.5 40" stroke="#000" stroke-width="5.5" stroke-linecap="round"/></mask>',
  },
  // Mã: đầu ngựa nhìn sang trái, tai dựng, bờm nhiều lớp phía sau.
  n: {
    parts: [
      '<path d="M27 97 C27 86 32 78 39 72 C33 71 27 70.5 21 70 C14 69.5 9.5 65 9.5 59 C9.5 54 12.5 50 17 47 C23 42.5 28 36.5 31.5 29.5 C33.5 24.5 36.5 19.5 39.5 16 L39.5 6 C39.5 2.8 42.6 1.5 44.6 3.6 C48 7 50.5 11 51.8 15 C66 15.5 79 24.5 84.5 39 C90 54 88 77 78 97 Z"/>',
      BASE,
    ],
    grooves: [
      'M56 18 C66 22 73 30 72 41',
      'M72 32 C81 40 83 51 77 61',
      'M80 52 C86 62 85 74 78 83',
      'M80 74 C84 82 83 90 79 95',
      'M41 72 C36 64 35 56 39 49',
      'M12.5 63 C17 65.5 21 65.5 25 63.5',
    ],
    grooveWidth: 2.2,
    dots: [[37, 32, 3.4], [16, 55, 2]],
  },
  // Xe: tháp có 3 khối châu mai, thân hơi thuôn, gờ trên bệ.
  r: {
    parts: [
      '<path d="M30 46 L70 46 L73 86 L27 86 Z"/>',
      '<path d="M21 20 a2 2 0 0 1 2 -2 h11 a2 2 0 0 1 2 2 v7 h7 v-7 a2 2 0 0 1 2 -2 h10 a2 2 0 0 1 2 2 v7 h7 v-7 a2 2 0 0 1 2 -2 h11 a2 2 0 0 1 2 2 v23 a3 3 0 0 1 -3 3 h-52 a3 3 0 0 1 -3 -3 Z"/>',
      '<rect x="20" y="84" width="60" height="12" rx="3.5"/>',
      BASE,
    ],
    grooves: [],
  },
  // Tốt: đầu tròn, vòng cổ, thân loe, bệ.
  p: {
    parts: [
      '<path d="M38 60 C39.5 72 33 85 27 97 L73 97 C67 85 60.5 72 62 60 Z"/>',
      '<rect x="33" y="52" width="34" height="10" rx="5"/>',
      '<circle cx="50" cy="38" r="15"/>',
      BASE,
    ],
    grooves: [],
  },
};

/**
 * Bộ lọc ánh sáng "khắc nổi": làm mờ hình (SourceAlpha) để có bề mặt cong ở mép,
 * chiếu một nguồn sáng xa từ góc trên-trái (feSpecularLighting) rồi cộng phần
 * sáng đó lên màu gốc, chỉ trong phạm vi hình. Kết quả: mép trên-trái sáng,
 * mặt giữa phẳng, giống ảnh mẫu.
 */
function reliefFilter(id, shine) {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="3.2" specularConstant="${shine}" specularExponent="16" lighting-color="#ffffff" result="spec">
      <feDistantLight azimuth="225" elevation="42"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0"/>
  </filter>`;
}

/**
 * Trả về chuỗi SVG của một quân. `piece` là ký tự FEN ('K', 'q', ...).
 * id của gradient/bộ lọc trùng nhau giữa các quân cùng màu là cố ý: nội dung
 * giống hệt nhau nên trình duyệt dùng cái nào cũng được.
 */
export function pieceSvg(piece) {
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  const shape = SHAPES[piece.toLowerCase()];
  const c = PALETTE[color];
  const grad = `rc-fill-${color}`;
  const relief = `rc-relief-${color}`;
  const parts = shape.parts.join('');
  const grooves = shape.grooves.map((d) => `<path d="${d}"/>`).join('');
  const dots = (shape.dots ?? []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const mask = shape.mask ? shape.mask.replace('rc-slit', `rc-slit-${color}`) : '';
  const fixMask = (s) => s.replace('url(#rc-slit)', `url(#rc-slit-${color})`);

  return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/>
    </linearGradient>
    ${reliefFilter(relief, c.shine)}
    ${mask}
  </defs>
  <g transform="translate(0 2.6)" fill="${c.depth}" stroke="${c.depth}" stroke-width="1.4" stroke-linejoin="round">${fixMask(parts)}</g>
  <g fill="url(#${grad})" stroke="${c.edge}" stroke-width="1.3" stroke-linejoin="round">
    ${fixMask(parts).replace(/<(path|rect|circle)/g, `<$1 filter="url(#${relief})"`)}
  </g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g transform="translate(0.6 0.8)" stroke="${c.grooveLight}" stroke-width="${shape.grooveWidth ?? 1.6}">${grooves}</g>
    <g stroke="${c.groove}" stroke-width="${shape.grooveWidth ?? 1.6}">${grooves}</g>
  </g>
  <g fill="${c.edge}">${dots}</g>
</svg>`;
}

/** Tên tiếng Việt của quân (cho hộp phong cấp và nhãn trợ năng). */
export const PIECE_NAMES = { k: 'Vua', q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã', p: 'Tốt' };
