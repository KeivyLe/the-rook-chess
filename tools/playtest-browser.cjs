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
//     bấm ô đi và ô đến (level chẵn: KÉO THẢ quân bằng chuột; trước đó thử thả ra
//     ngoài bàn một lần, quân phải về ô cũ), chọn quân nếu phong cấp, chờ đối thủ đáp;
//   - bấm "Next level" ở màn thắng; gặp hộp mời Starter Bundle (sau level 10 và
//     sau Daily đầu tiên) thì bấm "Later";
//   - KHÔNG được có quảng cáo nào xuất hiện (kế hoạch MKT: không quảng cáo xen giữa);
//   - chơi Daily hôm nay qua tab Daily ở thanh tab đáy;
//   - kiểm tra tiến trình, coin và Trophy đã lưu đúng, không có lỗi JavaScript nào;
//   - cuối cùng thử GỢI Ý như người chơi: mở một level mate in 2, chỉ bấm nút gợi ý
//     rồi đi theo bóng quân; sau đúng 2 lần gợi ý phải thắng, mỗi lần trừ 20 coin.
// Mọi nút được tìm bằng class / data-*, không theo chữ, nên chạy được ở mọi ngôn ngữ.
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

/** Toạ độ giữa ô `sq` trên màn hình (đọc từ phần tử ô, nên đã tính xoay bàn). */
async function squareCenter(page, sq) {
  const box = await page.locator(`.board .square[data-sq="${sq}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Kéo quân từ ô `from` thả xuống điểm `to` ({x, y} trên màn hình) bằng chuột. */
async function dragTo(page, from, to) {
  const a = await squareCenter(page, from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/**
 * Kéo thả nước from → to. Lần đầu (`tryOffBoard`) thả ra ngoài bàn trước: quân phải
 * về ô cũ, vẫn được chọn, chưa có nước nào được đi.
 */
async function dragMove(page, from, to, tryOffBoard) {
  if (tryOffBoard) {
    const board = await page.locator('.board').boundingBox();
    const before = await page.evaluate(() => window.rookChess.puzzle.board.history.length);
    await dragTo(page, from, { x: board.x + board.width / 2, y: board.y - 24 }); // phía trên bàn
    const after = await page.evaluate(() => ({
      moves: window.rookChess.puzzle.board.history.length,
      selected: window.rookChess.selected,
      held: !!document.querySelector('.board .piece.dragging, .board .piece.dropped'),
    }));
    if (after.moves !== before || after.selected !== from || after.held) {
      throw new Error(`thả ra ngoài bàn: quân không về ô cũ (${JSON.stringify(after)})`);
    }
  }
  await dragTo(page, from, await squareCenter(page, to));
}

/** Chơi hết level đang mở trên màn hình. Trả về số nước người chơi đã đi. */
async function playCurrentLevel(page, { drag = false } = {}) {
  for (let turn = 0; turn < 6; turn++) {
    const state = await page.evaluate(() => window.rookChess.puzzle.state);
    if (state === 'WON') return turn;
    const m = await nextMove(page);
    if (!m) throw new Error('bộ giải không tìm được nước');
    if (drag) {
      await dragMove(page, m.from, m.to, turn === 0);
    } else {
      await tapSquare(page, m.from);
      await tapSquare(page, m.to);
    }
    if (m.promotion) {
      await page.locator(`.promo-choice[data-piece="${m.promotion}"]`).click();
    }
    await page.waitForFunction(() => !window.rookChess.busy, null, { timeout: 15000 });
  }
  throw new Error('chưa thắng sau 6 lượt');
}

/**
 * Sau khi thắng: bấm nút ở hộp thắng. Nếu hiện hộp mời Starter Bundle thì bấm
 * "Để sau". Trả về { ad, starter }: có quảng cáo xuất hiện không (phải là false),
 * có hộp Starter Bundle không.
 */
async function continueAfterWin(page) {
  await page.locator('.win-dialog .win-next').click({ timeout: 5000 });
  await sleep(250);
  const ad = (await page.locator('.ad-overlay').count()) > 0;
  const starter = (await page.locator('.starter-offer').count()) > 0;
  if (starter) {
    await page.locator('.starter-offer .later-btn').click();
    await sleep(250);
  }
  return { ad, starter };
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
  const starters = [];
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
        await playCurrentLevel(page, { drag: id % 2 === 0 });
      } catch (e) {
        failures.push(`level ${id}: ${e.message}`);
        break;
      }
      const ms = Date.now() - t;
      if (id < total) {
        const r = await continueAfterWin(page);
        if (r.ad) ads.push(id);
        if (r.starter) starters.push(id);
      }
      process.stdout.write(`level ${id} ✓ (${ms} ms)${starters.at(-1) === id ? ' + hộp Starter Bundle' : ''}\n`);
    }

    // Daily qua tab Daily ở thanh tab đáy.
    await page.locator('.win-dialog .win-next').click({ timeout: 5000 }); // "Done" ở level cuối
    await page.locator('.tab-bar .tab-daily').click();
    await page.waitForSelector('.board .square');
    await playCurrentLevel(page);
    const afterDaily = await continueAfterWin(page);
    if (afterDaily.ad) ads.push('daily');
    if (afterDaily.starter) starters.push('daily');

    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('the-rook-chess/save')));
    const solved = Object.keys(save.progress.solved).length;
    const expectedCoins = 100 + total * 15 + 25; // không gợi ý, không sai: 15/level; Daily hoàn hảo 25
    if (solved !== total) failures.push(`đã lưu ${solved}/${total} level`);
    if (save.economy.coins !== expectedCoins) failures.push(`coin ${save.economy.coins}, mong đợi ${expectedCoins}`);
    if (save.progress.daily.streak !== 1) failures.push(`streak Daily ${save.progress.daily.streak}, mong đợi 1`);
    if (ads.length) failures.push(`có quảng cáo xuất hiện sau ${ads.join(', ')} (kế hoạch: không quảng cáo xen giữa)`);
    // Starter Bundle: mời sau level 10 và sau Daily đầu tiên (đang trong 7 ngày đầu).
    if (starters.join() !== '10,daily') failures.push(`hộp Starter Bundle sau ${starters.join(',') || 'không lần nào'}, mong đợi 10,daily`);
    const trophies = Object.keys(save.trophies.unlocked);
    for (const t of ['first-mate', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'daily-1', 'no-hint-10', 'perfect-25']) {
      if (!trophies.includes(t)) failures.push(`chưa có Trophy ${t}`);
    }
    console.log(`Đã lưu: ${solved} level, ${save.economy.coins} coin, streak ${save.progress.daily.streak}; quảng cáo: ${ads.length}; Starter Bundle sau: ${starters.join(', ')}; Trophy: ${trophies.length}`);

    // Gợi ý như người chơi: level mate in 2, chỉ bấm nút gợi ý rồi chạm ô bóng quân
    // trượt tới (quân đã được chọn sẵn). Mate in 2 phải thắng sau đúng 2 lần gợi ý.
    // (Hộp thắng Daily đã được đóng trong continueAfterWin ở trên.)
    const hintLevel = await page.evaluate(() => window.rookChess.data.levels.find((l) => l.mateIn === 2).id);
    await page.evaluate((id) => window.rookChess.actions.startLevel(id), hintLevel);
    const coinsBefore = await page.evaluate(() => window.rookChess.save.economy.coins);
    let hints = 0;
    while (hints < 4 && (await page.evaluate(() => window.rookChess.puzzle.state)) !== 'WON') {
      await page.locator('.hint-btn').click();
      await page.waitForSelector('.hint-ghost', { timeout: 15000 });
      hints++;
      const hint = await page.evaluate(() => window.rookChess.hint);
      await tapSquare(page, hint.to);
      if (hint.promotion) await page.locator(`.promo-choice[data-piece="${hint.promotion}"]`).click();
      await page.waitForFunction(() => !window.rookChess.busy, null, { timeout: 15000 });
    }
    const coinsAfter = await page.evaluate(() => window.rookChess.save.economy.coins);
    const won = (await page.evaluate(() => window.rookChess.puzzle.state)) === 'WON';
    if (!won || hints !== 2) failures.push(`gợi ý level ${hintLevel} (mate in 2): ${hints} lần gợi ý, ${won ? 'thắng' : 'chưa thắng'}; mong đợi thắng sau 2 lần`);
    if (coinsBefore - coinsAfter !== 40) failures.push(`2 lần gợi ý trừ ${coinsBefore - coinsAfter} coin, mong đợi 40`);
    console.log(`Gợi ý: level ${hintLevel} thắng sau ${hints} lần bấm gợi ý, trừ ${coinsBefore - coinsAfter} coin`);
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
