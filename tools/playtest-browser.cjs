#!/usr/bin/env node
// =============================================================================
// tools/playtest-browser.cjs — Chơi thử 60 level QUA GIAO DIỆN THẬT trên trình
// duyệt (Chromium điều khiển bằng Playwright), bấm vào ô cờ như người chơi.
//
// Cần Playwright (không nằm trong dự án vì dự án không có thư viện ngoài):
//   npm install --no-save playwright && npx playwright install chromium
// Cách chạy:  node tools/playtest-browser.cjs
//
// Script tự bật tools/serve.js ở cổng 8123, mở game với dữ liệu lưu trống, rồi:
//   - chơi lần lượt level 1 → 60: mỗi lượt hỏi bộ giải nước đúng (bestHint),
//     bấm ô đi và ô đến, chọn quân nếu phong cấp, chờ đối thủ đáp;
//   - bấm "Level tiếp" ở màn thắng, gặp quảng cáo xen giữa thì chờ hết giờ và bấm Đóng;
//   - chơi Daily hôm nay qua nút Daily;
//   - cuối cùng kiểm tra tiến trình và coin đã lưu đúng, không có lỗi JavaScript nào.
// File đuôi .cjs vì Playwright được nạp bằng require().
// =============================================================================

const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const PORT = 8123;
const ROOT = path.join(__dirname, '..');

/** Chờ `ms` mili-giây. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bên trong trình duyệt: tính nước đúng tiếp theo bằng bộ giải (giống gợi ý mức 2). */
async function nextMove(page) {
  return page.evaluate(async () => {
    const { bestHint } = await import('/src/solver.js');
    const { moveToString } = await import('/src/board.js');
    const p = window.rookChess.puzzle;
    const m = bestHint(p.board, 2 * p.movesLeft - 1);
    return m ? { from: m.from, to: m.to, promotion: m.promotion ?? null, text: moveToString(p.board, m) } : null;
  });
}

/** Bấm vào ô `sq` trên bàn cờ (chọn phần tử có data-sq, quân hoặc ô). */
async function tapSquare(page, sq) {
  const target = page.locator(`.board [data-sq="${sq}"]`).last();
  await target.click({ force: true });
}

/** Chơi hết level đang mở trên màn hình. Trả về số nước người chơi đã đi. */
async function playCurrentLevel(page) {
  for (let turn = 0; turn < 6; turn++) {
    const state = await page.evaluate(() => window.rookChess.puzzle.state);
    if (state === 'WON') return turn;
    const m = await nextMove(page);
    if (!m) throw new Error('bộ giải không tìm được nước');
    await tapSquare(page, m.from);
    await tapSquare(page, m.to);
    if (m.promotion) {
      const name = { q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã' }[m.promotion];
      await page.locator(`.promo-choice[aria-label="${name}"]`).click();
    }
    await page.waitForFunction(() => !window.rookChess.busy, null, { timeout: 15000 });
  }
  throw new Error('chưa thắng sau 6 lượt');
}

/** Sau khi thắng: bấm nút ở hộp thắng, xử lý quảng cáo xen giữa nếu có. Trả về true nếu có quảng cáo. */
async function continueAfterWin(page) {
  await page.locator('.win-dialog .btn.primary').click({ timeout: 5000 });
  await sleep(250);
  if (await page.locator('.ad-overlay').count()) {
    await page.locator('.ad-close:not([disabled])').click({ timeout: 8000 });
    await sleep(250);
    return true;
  }
  return false;
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await sleep(500);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const failures = [];
  const ads = [];
  const started = Date.now();

  try {
    await page.goto(`http://localhost:${PORT}/`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.board .square');
    const total = await page.evaluate(() => window.rookChess.data.levels.length);

    for (let id = 1; id <= total; id++) {
      const shown = await page.evaluate(() => window.rookChess.puzzle.level.id);
      if (shown !== id) { failures.push(`mong đợi level ${id}, màn hình đang là level ${shown}`); break; }
      const t = Date.now();
      try {
        await playCurrentLevel(page);
      } catch (e) {
        failures.push(`level ${id}: ${e.message}`);
        break;
      }
      const ms = Date.now() - t;
      if (id < total) {
        if (await continueAfterWin(page)) ads.push(id);
      }
      process.stdout.write(`level ${id} ✓ (${ms} ms)${ads.at(-1) === id ? ' + quảng cáo' : ''}\n`);
    }

    // Daily qua màn chọn level.
    await page.locator('.win-dialog .btn.primary').click({ timeout: 5000 }); // "Xong" ở level cuối
    await page.locator('.hub-btn.daily').click();
    await page.waitForSelector('.board .square');
    await playCurrentLevel(page);
    await page.locator('.win-dialog .btn.primary').click({ timeout: 5000 });

    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('the-rook-chess/save')));
    const solved = Object.keys(save.progress.solved).length;
    const expectedCoins = 100 + total * 15 + 25; // không gợi ý, không sai: 15/level; Daily hoàn hảo 25
    if (solved !== total) failures.push(`đã lưu ${solved}/${total} level`);
    if (save.economy.coins !== expectedCoins) failures.push(`coin ${save.economy.coins}, mong đợi ${expectedCoins}`);
    if (save.progress.daily.streak !== 1) failures.push(`streak Daily ${save.progress.daily.streak}, mong đợi 1`);
    const expectedAds = [];
    for (let id = 11, n = 0; id < total; id++) if (++n % 3 === 0) expectedAds.push(id);
    if (ads.join() !== expectedAds.join()) failures.push(`quảng cáo sau level ${ads.join(',')}, mong đợi ${expectedAds.join(',')}`);
    console.log(`Đã lưu: ${solved} level, ${save.economy.coins} coin, streak ${save.progress.daily.streak}; quảng cáo sau level ${ads.join(', ')}`);
  } catch (e) {
    failures.push(`lỗi: ${e.message}`);
  } finally {
    await browser.close();
    server.kill();
  }

  for (const f of [...failures, ...errors]) console.log('LỖI: ' + f);
  console.log(`${failures.length + errors.length} lỗi, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  process.exit(failures.length + errors.length ? 1 : 0);
})();
