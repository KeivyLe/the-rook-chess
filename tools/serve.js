#!/usr/bin/env node
// =============================================================================
// tools/serve.js — Server tĩnh rất nhỏ để chạy game trên trình duyệt.
//
// Vì sao cần: mở index.html trực tiếp (file://) thì trình duyệt chặn fetch()
// levels.json và chặn import module. Server này chỉ phục vụ file trong thư mục
// dự án, không cần cài thêm gì.
//
// Cách chạy:  npm start            (mặc định cổng 8080)
//             node tools/serve.js 3000
// Rồi mở http://localhost:8080 (điện thoại cùng mạng wifi: http://<IP máy>:8080).
// =============================================================================

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

/** Kiểu nội dung theo đuôi file, để trình duyệt hiểu đúng (đặc biệt là .js module). */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Đổi đường dẫn trong URL thành đường dẫn file. Chặn "../" để không ai đọc
 * được file nằm ngoài thư mục dự án.
 */
function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const file = normalize(join(ROOT, clean === '/' ? 'index.html' : clean));
  return file.startsWith(ROOT + sep) || file === ROOT ? file : null;
}

createServer(async (req, res) => {
  const file = resolvePath(req.url);
  if (!file) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`The Rook Chess: http://localhost:${PORT}`);
});
