// =============================================================================
// ui/main.js — Điểm khởi động: tải levels.json rồi mở giao diện.
// index.html nạp file này bằng <script type="module">.
// =============================================================================

import { startApp } from './app.js';

/**
 * Tải dữ liệu level và khởi động app. Lỗi (ví dụ mở index.html trực tiếp bằng
 * file:// nên trình duyệt chặn fetch) thì hiện hướng dẫn chạy bằng server.
 */
async function main() {
  const root = document.getElementById('app');
  try {
    const res = await fetch('levels.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Gắn vào window chỉ để kiểm thử / gỡ lỗi trên trình duyệt.
    window.rookChess = startApp(root, data);
  } catch (e) {
    root.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'loading';
    p.textContent = `Không tải được levels.json (${e.message}). Hãy chạy "npm start" rồi mở http://localhost:8080.`;
    root.append(p);
  }
}

main();
