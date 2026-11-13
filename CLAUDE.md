# CLAUDE.md — the-rook-chess

Đọc file này trước khi làm việc trong repo.

## Dự án

Bài tập làm lại một game **giải đố chiếu hết** trên bàn cờ nhỏ, lấy cảm hứng từ
Pocket Chess. Mỗi level là một thế cờ dựng sẵn trên bàn kích thước tùy ý
(đề xuất 4×4 đến 8×8); người chơi phải chiếu hết trong N nước, đối thủ tự
phòng thủ tốt nhất.

- Tài liệu thiết kế (GDD): https://claude.ai/artifact/WATw3q4aNJhM5RwDJohtJ9
  (luật ở mục 3, AI ở mục 4, kiến trúc ở mục 8, kế hoạch các mốc ở mục 9).
- Công nghệ: **HTML + CSS + JavaScript thuần**, không framework, không bundler,
  không thư viện ngoài. Test bằng test runner có sẵn của Node (`node --test`).
- Level, hình ảnh, âm thanh phải là của mình; không sao chép từ bản gốc.

## Tiến độ

| Mốc | Nội dung | Trạng thái |
|-----|----------|------------|
| 1 | Luật cờ: `board.js`, `movegen.js`, test | **Xong** |
| 2 | Ô lỗ `x`, bộ giải alpha-beta + bảng băm `solver.js` | **Xong** |
| 2b | Sinh level tự động, `levels.json` (60 chính + 30 Daily), `verify-levels` | **Xong** (chủ dự án gọi là "Mốc 3") |
| 3 | Màn chơi: máy trạng thái `puzzle.js` | **Logic xong**; còn giao diện (vẽ bàn, chạm, hộp phong cấp) |
| 4 | Tiến trình: `progress.js`, `storage.js` (mở khoá, Daily, streak, localStorage) | **Logic xong**; còn màn Home, chọn level, chiến thắng |
| 5 | Kinh tế: `economy.js` (coin, gợi ý 3 mức, quảng cáo/Shop giả lập) | **Logic xong**; còn màn Ad, Shop |
| 5b | Giao diện: `index.html`, `css/style.css`, `src/ui/` (chủ dự án gọi là "Mốc 5") | **Xong**: màn chơi, chọn level, Daily, Shop, Settings, gợi ý, phong cấp, thắng, Ad |
| 6 | Chơi thử tự động 60 level (Node + trình duyệt), README, `docs/so-sanh.md`, chuẩn bị GitHub Pages | **Xong** |
| Sau | Kéo thả quân, nút "Xem lại", bộ giải sang Web Worker, chơi thử với người thật | Chưa |

## Cấu trúc thư mục

```
CLAUDE.md          # file này
README.md          # cho người đọc: cách chơi, cách chạy, cấu trúc, GitHub Pages
.nojekyll          # GitHub Pages phục vụ file nguyên trạng (không chạy Jekyll)
docs/so-sanh.md    # so sánh với Pocket Chess: học được gì, cải thiện gì (phần nộp bài)
package.json       # "type": "module", script test / levels:generate / levels:verify
levels.json        # 60 level chính + 30 level Daily (SINH bằng tools/, không sửa tay)
index.html         # trang duy nhất, nạp css/style.css và src/ui/main.js (module)
css/style.css      # toàn bộ giao diện; biến màu ở :root, màu nền do themes.js đặt
src/
  board.js         # trạng thái bàn, FEN mở rộng, make/undo (không biết luật đi)
  movegen.js       # sinh nước hợp lệ, inCheck, isCheckmate, isStalemate, perft
  solver.js        # alpha-beta + bảng băm: findMate, isStillWinning, bestDefense, bestHint
  puzzle.js        # máy trạng thái 1 level: chấm đúng/sai, đối thủ đáp, undo, restart, gợi ý
  economy.js       # coin, giá gợi ý, quảng cáo thưởng/xen giữa giả lập, Shop giả lập
  progress.js      # mở khoá level, Daily theo ngày, streak, ngày dạng "yyyymmdd"
  storage.js       # save data { version, progress, economy, settings } ↔ localStorage
  ui/              # CHỈ thư mục này được dùng DOM
    main.js        # fetch levels.json → startApp
    app.js         # các màn hình + nối logic với hình ảnh (luồng chơi, gợi ý, thắng, Ad, Shop, Settings)
    board-view.js  # vẽ bàn/quân bằng div tuyệt đối, cạnh dày 3D, xoay bàn, animation trượt/rung/đổ Vua
    pieces.js      # quân cờ SVG tự vẽ (khung 100×120)
    sound.js       # âm thanh tổng hợp Web Audio (không file ngoài)
    themes.js      # bảng màu nền theo level, màu Daily
    dom.js         # h() tạo phần tử, wait(), nextFrame()
tests/
  board.test.js    # FEN (kể cả lỗ 'x'), đánh số ô, make/undo
  movegen.test.js  # level mẫu, 6 thế đếm tay, pat, phong cấp, nhập thành, lỗ, perft
  solver.test.js   # 3 thế cờ chép từ ảnh game gốc + chấm nước, đáp trả, gợi ý
  levels.test.js   # chạy verify-levels trên levels.json + test bộ kiểm tra bắt được lỗi
  puzzle.test.js   # trạng thái, pat, cách giải khác, undo, gợi ý, chơi hết level thật bằng gợi ý
  economy.test.js  # thưởng, giá gợi ý, 5 quảng cáo/ngày, quảng cáo xen giữa, Shop
  progress.test.js # mở khoá, dateKey/previousDateKey, Daily xoay vòng, streak
  storage.test.js  # localStorage giả, JSON hỏng, bị chặn, save cũ thiếu trường
tools/
  level-check.js   # tiêu chuẩn puzzle dùng chung: analyzePuzzle, positionProblem, difficultyScore
  generate-levels.js  # sinh thế ngẫu nhiên có seed → lọc → rút gọn → chọn → levels.json
  verify-levels.js # kiểm tra toàn bộ levels.json, thoát mã 1 nếu có lỗi
  serve.js         # server tĩnh không phụ thuộc (npm start), chặn đọc file ngoài dự án
  playtest.js      # máy chơi hết 90 level × N ván qua puzzle.js (nước sai, Undo, gợi ý 3)
  playtest-browser.cjs  # chơi 60 level + Daily qua giao diện thật (Playwright, .cjs vì require)
```


**Nguyên tắc kiến trúc:** phần luật và AI (`board.js`, `movegen.js`, `solver.js`,
`puzzle.js`, ...) **không được** đụng tới DOM, `window`, `localStorage`, để chạy
được cả trên trình duyệt lẫn Node test. Chỉ `src/ui/` mới được dùng DOM.
Ngoại lệ duy nhất: `storage.js` đọc/ghi localStorage, nhưng nhận `storage` qua
tham số (test truyền đối tượng giả) và bọc mọi thao tác trong try/catch.
Ngày luôn truyền vào dạng `"yyyymmdd"` (`dateKey(new Date())` ở giao diện), không
gọi `new Date()` bên trong logic, để test cố định được ngày.

## Mô hình dữ liệu (đã chốt ở Mốc 1)

- **Ô cờ:** chỉ số `sq = rank * width + file`. `file` 0..width-1 từ trái
  (cột a), `rank` 0..height-1 từ **dưới lên** (hàng 1 là phía Trắng).
- **Quân:** 1 ký tự như FEN: hoa = Trắng `KQRBNP`, thường = Đen `kqrbnp`,
  `'.'` = trống, `'x'` = **lỗ** (ô không tồn tại, cho bàn hình dạng lạ).
- **Lỗ:** `onBoard(board, f, r)` trả `false` tại lỗ, nên với luật đi lỗ giống
  mép bàn (không đứng, đi vào, trượt qua). Mã vẫn nhảy QUA lỗ được.
  `inBounds()` chỉ xét toạ độ, không xét lỗ. Lỗ không gộp vào số trong FEN.
- **Đối tượng bàn:** `{ width, height, squares, turn, castling: {K,Q,k,q}, ep, pawnDoubleStep, history }`.
- **FEN mở rộng:** `"<hàng trên cùng>/.../<hàng dưới cùng> [w|b] [KQkq|-] [ô ep|-]"`.
  Số hàng = height, số ô mỗi hàng = width; số ô trống có thể nhiều chữ số.
  Ví dụ level 1: `"k3/2K1/4/3R w"`.
  `parseFen(fen, { width, height, pawnDoubleStep })` — `pawnDoubleStep` mặc định
  bật khi `height >= 8`.
- **Nước đi:** `{ from, to, piece, captured, promotion?, flag? }`,
  `flag` ∈ `'double' | 'ep' | 'castleK' | 'castleQ'`. Dạng chuỗi (dùng trong
  `solution` của level): `"d1a1"`, `"a7a8n"`. Đổi qua lại bằng
  `moveToString(board, m)` và `findMove(board, "d1a1")`.
- **make/undo:** `make(board, m)` sửa trực tiếp bàn và đẩy trạng thái cũ vào
  `board.history`; `undo(board)` luôn hoàn tác nước cuối. Luôn gọi theo cặp.
- **Nhập thành tổng quát:** Vua đi 2 ô về phía Xe ở góc, Xe đứng sát bên kia.
- **Không có Vua** (thế puzzle dựng tay) thì bên đó không bao giờ bị chiếu.
- **Chép level từ game gốc:** khi người chơi cầm Đen, game gốc xoay bàn 180°
  (phía người chơi luôn ở dưới). Khi chép thành FEN phải xoay lại để Trắng ở
  dưới (Tốt trắng đi lên). Ví dụ Level 90: `5/q2n1/2PN1/3PP/1R2K b`.

## Solver (src/solver.js)

- **Bên tấn công = bên đi trước** của level (Trắng hoặc Đen).
- Đơn vị là **ply** (nửa nước). Mate in N = `2N - 1` ply.
- Điểm nhìn từ bên tấn công: chiếu hết khi còn `d` ply = `MATE + d`
  (hết sớm thì điểm cao); bị phản chiếu hết = `-(MATE + d)`; còn lại = 0.
- Bảng băm: khoá = thế cờ + số ply còn lại; lưu điểm, loại (EXACT/LOWER/UPPER)
  và nước tốt nhất (để sắp xếp nước). Tạo mới cho mỗi lần gọi hàm công khai.
- API, với `p` là số ply còn lại **tính cả nước sắp đi**:
  - `findMate(board, n)` → `{ mateIn, move, line, nodes }` hoặc `null`; tìm sâu
    dần từ 1 nên `mateIn` là số nước ít nhất.
  - `isStillWinning(board, p)`: gọi khi bên phòng thủ đến lượt (người chơi vừa đi).
  - `bestDefense(board, p, random?)`: thoát được thì thoát, không thì kéo dài lâu
    nhất; hòa điểm thì chọn ngẫu nhiên.
  - `bestHint(board, p)`: nước đầu của chuỗi chiếu hết nhanh nhất, tính từ thế hiện tại.
  - Ví dụ mate in 2: đầu level `bestHint(b, 3)`; người chơi đi xong
    `isStillWinning(b, 2)`, rồi `bestDefense(b, 2)`; tới nước cuối `bestHint(b, 1)`.

## Level (levels.json)

- **Không chép level từ game gốc.** Mọi level do `tools/generate-levels.js` sinh
  ngẫu nhiên rồi lọc bằng bộ giải. `verify-levels` còn so với `ORIGINAL_POSITIONS`
  (3 thế chép từ ảnh, chỉ dùng trong test solver) để chắc không trùng.
- **Tiêu chuẩn puzzle** (`tools/level-check.js`): mỗi bên 1 Vua, không bên nào
  đang bị chiếu, Tốt không ở hàng đầu/cuối; chiếu hết ĐÚNG N nước (không sớm
  hơn); nước đầu duy nhất. Sau khi lọc còn bước rút gọn: bỏ mọi quân thừa.
- **Định dạng một level:** `{ id, chapter, width, height, fen, mateIn, attacker, solution, difficulty }`.
  `fen` dạng gọn `"rows w"`; `solution` là biến chính đủ `2N-1` ply (bên phòng
  thủ đáp tốt nhất, hòa điểm lấy nước đầu); game thật chấm bằng `isStillWinning`
  nên cách giải khác vẫn được tính. Daily có `id` dạng `"daily-01"`, không có `chapter`.
- **Bố cục:** chương 1–4 = mate in 1–4 (15/20/15/10 level). 5 level đầu giới thiệu
  R, Q, N, B, P (Trắng đi, chỉ 1 quân tấn công, level Tốt giải bằng phong cấp).
  Trong chương: chọn trải đều theo `difficulty`, xếp tăng dần kiểu răng cưa
  (cứ 3 level chèn 1 level dễ). Daily: 8/14/8 level mate in 1/2/3.
- **Sinh lại:** `npm run levels:generate` (seed mặc định 20261112, khoảng 100 giây,
  cùng seed ra cùng file), rồi `npm run levels:verify`. Đổi tiêu chuẩn trong
  `level-check.js` thì phải sinh lại và chạy test.

## Logic game (puzzle / economy / progress / storage)

- **Máy trạng thái `puzzle.js`:** `PLAYER_TURN` → `playerMove()` →
  `WON` | `WRONG_MOVE` (bàn vẫn hiện nước sai; giao diện rung rồi gọi `retry()`)
  | `OPPONENT_TURN` (giao diện chờ ~400 ms rồi gọi `opponentMove()`).
  `ANIMATING` là việc của giao diện. Gọi sai trạng thái thì ném lỗi.
- **Chấm đúng/sai:** bằng `isStillWinning`, không so đáp án; hòa pat là sai
  (`reason: 'stalemate'`), mất chiếu hết là sai (`'no-mate'`). Sai không trừ nước.
- **Gợi ý:** `getHint(p, 1|2|3)` → `{from}` / `{from,to,move}` / `{line}`, tính từ thế
  hiện tại. Trừ coin KHÔNG nằm trong puzzle: giao diện gọi `spendForHint` trước.
- **Các file độc lập:** economy/progress không import lẫn nhau; giao diện ghép lại.
  Khi thắng level chính: `s = summary(p)` → `markSolved(progress, id, {hintUsed: s.hintUsed, totalLevels})`
  → `addSolveReward(economy, {firstTime, perfect: s.perfect})` → `onLevelWon(economy, id)`
  (true thì hiện Ad) → `writeSave(save)`. Daily: `completeDaily(progress, today)`
  → `addSolveReward(economy, {firstTime, perfect, daily: true})`.
- **Số liệu kinh tế** là hằng số đầu `economy.js` (GDD 6.2): khởi đầu 100, giải lần đầu
  +10, perfect +5, Daily +20, quảng cáo +25 (5 lần/ngày), gợi ý 20/40/100, giải lại 0.
  Quảng cáo xen giữa: không ở level 1–10, sau đó cứ 3 level thắng thì hiện 1 lần.
- **Daily:** `dailyIndex(today, daily.length)` = số ngày từ 1970 chia dư số level,
  nên 30 ngày liên tiếp đi qua đủ 30 level. Streak giữ tới hết ngày hôm sau.
- **Save data:** `loadSave()` không bao giờ ném lỗi, trả `{save, status}`
  (`'loaded' | 'new' | 'corrupt' | 'unavailable'`); thiếu trường thì lấy mặc định.
  Đổi cấu trúc save thì tăng `SAVE_VERSION` và viết bước chuyển đổi.

## Giao diện (src/ui/)

- **Chạy:** `npm start` rồi mở http://localhost:8080 (mở file:// thì fetch bị chặn).
  `window.rookChess` là đối tượng app để kiểm thử trên trình duyệt
  (`.puzzle`, `.save`, `.actions.startLevel(id)`...).
- **Bố cục màn chơi:** icon lưới 9 chấm (trái, mở chọn level; Daily thì là nút back),
  "Level N" nhỏ (Daily: "12 tháng 11"), "Mate in N" to (N = số nước còn lại,
  đổi màu khi còn 1 ở level nhiều nước; thắng rồi thì giữ đề bài), coin (phải),
  bàn cờ, 2 nút tròn: gợi ý và Undo (mờ khi không dùng được).
- **Hình ảnh tự làm**, chỉ theo bố cục của game gốc: quân SVG, bảng màu, icon đều
  tự vẽ. Không dùng font/ảnh/âm thanh bên ngoài.
- **Bàn cờ:** ô là div đặt bằng `transform: translate`; lỗ không vẽ; dải cạnh dày
  vẽ dưới mỗi ô mà bên dưới (trên màn hình) là mép hoặc lỗ. Người chơi cầm Đen
  thì xoay 180° (phía người chơi luôn ở dưới). Quân hàng dưới có z-index cao hơn.
- **Luồng một nước:** `busy = true` (chính là trạng thái ANIMATING) → trượt quân →
  `playerMove` → sai: rung + toast + `retry` + trượt về; đúng: chờ 400 ms →
  `opponentMove` → trượt quân đối thủ; thắng: Vua đổ + pháo giấy + hộp thắng.
  Màn hình luôn vẽ lại từ dữ liệu sau animation (`drawBoard`), không giữ trạng thái riêng.
- **Màu nền** theo level xoay vòng 8 màu (`themes.js`), Daily luôn xanh biển.
- **Âm thanh** tạo AudioContext ở lần phát đầu (sau cú chạm); tắt bằng Settings.

## Kiểm thử và phát hành

- `npm test` phải luôn xanh trước khi commit. `npm run playtest` (~30 giây) và
  `npm run playtest:browser` (~4,5 phút, cần Playwright) chạy khi sửa puzzle.js, solver
  hoặc giao diện; không nằm trong `npm test` vì chậm.
- playtest-browser tự bật server cổng 8123, xoá localStorage, chơi 1 → 60 bằng
  bestHint, rồi kiểm tra save: 60 level, coin = 100 + 60·15 + 25, streak 1, quảng cáo
  sau level 13, 16, …, 58. Đổi số liệu kinh tế thì sửa con số mong đợi trong script.
- **GitHub Pages:** trang tĩnh, không build. Settings → Pages → Deploy from a branch →
  `main` / root. Mọi đường dẫn trong game phải là **tương đối** (`levels.json`,
  `css/style.css`) vì site nằm dưới `/the-rook-chess/`. Repo private cần gói GitHub trả phí
  mới bật được Pages. Phiên Claude cloud không có quyền gọi API Pages: chủ repo tự bật.

## Quy ước code

- ES module (`import`/`export`), đường dẫn import có đuôi `.js`.
- Mỗi hàm có **comment tiếng Việt** giải thích hàm làm gì và vì sao
  (chủ dự án cần hiểu để trình bày với giáo viên). Giữ quy ước này cho code mới.
- Thông báo lỗi (`throw new Error`) viết tiếng Việt, nói rõ sai ở đâu.
- Tên biến/hàm tiếng Anh, camelCase; hằng số UPPER_SNAKE_CASE.
- Hàm thuần, không dùng class; trạng thái nằm trong đối tượng bàn.
- Ưu tiên rõ ràng hơn tối ưu: bàn nhỏ, ít quân, không cần bitboard.
- Thêm luật mới thì thêm test; sửa movegen thì phải chạy lại perft.

## Lệnh

```bash
npm start                # server tĩnh, mở http://localhost:8080
npm test                 # = node --test, chạy mọi file tests/*.test.js
npm run levels:generate  # sinh lại levels.json (khoảng 100 giây)
npm run levels:verify    # kiểm tra levels.json (khoảng 8 giây)
npm run playtest         # chơi thử tự động 90 level × 3 ván (khoảng 30 giây)
npm run playtest:browser # chơi 60 level qua giao diện thật (khoảng 4,5 phút, cần Playwright)
```

Test hiện có 90 ca, chạy khoảng 9 giây (phần lớn là verify levels.json). Perft 8×8 (khai cuộc, Kiwipete, thế số 3)
là bằng chứng mạnh nhất rằng movegen + make/undo đúng; đừng xoá.
