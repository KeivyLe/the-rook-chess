// =============================================================================
// ui/dom.js — Vài hàm nhỏ để tạo phần tử HTML gọn hơn, không cần framework.
// =============================================================================

/**
 * Tạo một phần tử HTML. Ví dụ:
 *   h('button', { class: 'btn', onclick: play }, 'Chơi')
 * attrs: thuộc tính bắt đầu bằng "on" là sự kiện (onclick → addEventListener('click')),
 * "class" là className, "style" có thể là chuỗi hoặc đối tượng, "html" là innerHTML
 * (chỉ dùng cho SVG do chính game tạo ra, không bao giờ cho chữ người dùng nhập).
 * children: chuỗi (thành chữ), phần tử, hoặc mảng; null/false thì bỏ qua.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

/** Thêm các con vào phần tử (chuỗi, phần tử, mảng lồng nhau). */
function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Chờ `ms` mili-giây (dùng với await để xếp các bước animation). */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Chờ 2 khung hình: để trình duyệt vẽ xong trước khi chạy tiếp việc nặng (bộ giải). */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
