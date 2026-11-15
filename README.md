# The Rook Chess

Game **giải đố chiếu hết** trên bàn cờ nhỏ, viết bằng HTML + CSS + JavaScript thuần
(không framework, không thư viện ngoài). Đây là bài tập làm lại một game kiểu
Pocket Chess: mỗi level là một thế cờ dựng sẵn, bạn phải chiếu hết trong N nước.

- 60 level chính trong 4 chương (mate in 1 → 4) và 30 Daily Puzzle.
- 2 mode thêm: **Obstacle** (20 thế cờ có vật cản trên bàn) và **Blitz Mate** (giải càng
  nhiều càng tốt trong 3 phút, giữ kỷ lục tuần). Mỗi mode chơi thử miễn phí 5 bài.
- **Trophy** Đồng / Bạc / Vàng / Bạch kim, **skin** bàn cờ và quân cờ (Cẩm thạch, Neon,
  Hoàng gia), **Rook Pass** — theo "Kế hoạch MKT The Rook Chess".
- Bàn từ 3×4 đến 6×6, có bàn hình dạng lạ (khuyết ô), có level bạn cầm quân Đen.
- Mọi level do máy **tự sinh và tự kiểm tra** bằng bộ giải alpha-beta: chắc chắn có
  chiếu hết đúng N nước, không có cách chiếu hết sớm hơn, nước đầu là duy nhất.
- Đối thủ luôn phòng thủ tốt nhất; mọi cách giải đúng đều được chấp nhận.

**Chơi online:** sau khi bật GitHub Pages (xem [Đưa lên GitHub Pages](#đưa-lên-github-pages)),
link là `https://keivyle.github.io/the-rook-chess/`.

## Cách chơi

1. Đầu màn hình ghi **"Mate in N"**: bạn phải chiếu hết Vua đối phương trong N nước của mình.
   Số N giảm dần sau mỗi nước của bạn, và đổi màu khi chỉ còn 1 nước.
2. Bàn luôn xoay để **phía bạn ở dưới**: Tốt của bạn đi lên, Tốt đối thủ đi xuống. Nhãn ở
   mép trên và mép dưới bàn ghi rõ bên nào ở đâu (ví dụ "Đen ↓" ở trên, "Trắng (bạn) ↑" ở
   dưới), kể cả khi Vua của bạn đang đứng ở hàng trên cùng.
3. **Chạm một quân** của bạn: các ô đi được hiện chấm tròn, ô ăn được hiện vòng tròn.
   **Chạm ô đích** để đi. Chạm lại quân đang chọn hoặc ô trống để bỏ chọn.
   Hoặc **giữ và kéo** quân tới ô đích rồi thả; thả ra ngoài bàn hay vào ô không đi được
   thì quân về chỗ cũ (vẫn được chọn).
4. Đi xong thì đối thủ tự đáp trả. Game **không báo đúng/sai**: đi lệch thì ván cứ tiếp
   tục, chỉ khi bạn thật sự chiếu hết mới có hiệu ứng chiến thắng. Nếu đi hết N nước mà
   chưa chiếu hết (hoặc gây hòa pat, hoặc bị đối thủ chiếu hết ngược), ván dừng lại và
   nút **Undo** sáng lên: bấm Undo để đi lại, bao nhiêu lần cũng được, tới khi thắng.
5. Tốt tới hàng cuối thì chọn phong Hậu, Xe, Tượng hoặc Mã (có level phải phong Mã!).
6. Bí thì bấm **bóng đèn** (gợi ý, 20 coin một lần): một bóng mờ của quân cần đi trượt từ ô
   đứng tới đúng ô cần đến, lặp lại liên tục, quân đó được chọn sẵn, bạn chỉ việc chạm ô đến.
   Mỗi lần bấm chỉ chỉ **một** nước, nên level "Mate in N" cần tối đa N lần bấm là thắng.
   Nếu bạn đã đi lệch, gợi ý tự lùi về thế còn thắng gần nhất (không tốn thêm) rồi mới chỉ.
7. Thắng level đầu tiên được coin; không dùng gợi ý và chưa từng đi lệch thì được thêm coin.
8. **Thanh tab ở đáy** luôn có sẵn trên mọi màn: Chơi · Daily · Mode (Daily, Blitz Mate,
   Obstacle trên cùng một màn) · Trophy · Shop. Chạm viên coin cũng mở Shop; bánh răng mở Cài đặt.
9. **15 ngôn ngữ**, mặc định tiếng Anh, đổi trong Cài đặt: English, Deutsch, Français, 日本語,
   Español, Português, 한국어, Русский, Bahasa Indonesia, हिन्दी, Italiano, Türkçe, 简体中文,
   Polski, Tiếng Việt.

| | Coin |
|---|---|
| Khởi đầu | 100 |
| Giải level lần đầu | +10 (thêm +5 nếu hoàn hảo) |
| Daily Puzzle | +20 (thêm +5 nếu hoàn hảo) |
| Gợi ý (chỉ đúng 1 nước bằng hình động) | −20 |

Không có quảng cáo xen giữa level. Khi không đủ coin mà bạn đã đi sai 2 lần ở bài đang chơi,
hộp "Không đủ coin" có thêm nút **xem quảng cáo để nhận 1 gợi ý** (tối đa 1 lần mỗi ngày,
không thưởng coin).

**Shop** (đều là **giả lập** cho bài tập, bấm mua chỉ mở khoá trong game, không có thanh toán thật):

| Món | Giá đề xuất | Nhận được |
|---|---|---|
| Rook Pass | $4.99/tháng, dùng thử 7 ngày | Mọi mode, gợi ý miễn phí không giới hạn, skin quân "Hoàng gia", không thấy quảng cáo |
| Starter Bundle | $9.99, chỉ 7 ngày đầu | Mode Obstacle + bàn và quân Cẩm thạch |
| Skin bàn / skin quân | $2.99 mỗi skin | Cẩm thạch, Neon (xem thử miễn phí trong Daily) |
| Bộ skin (bàn + quân) | $4.99 | Rẻ hơn mua lẻ |
| Mode Obstacle / Blitz Mate | $3.99 mỗi mode | Chơi hết mode (5 bài đầu miễn phí) |

Tiến trình, Trophy và món đã mua được lưu trong trình duyệt (localStorage).

## Chạy trên máy

Cần [Node.js](https://nodejs.org) 18 trở lên. Không cần `npm install`.

```bash
npm start
```

Rồi mở http://localhost:8080. Điện thoại cùng mạng wifi mở `http://<IP máy tính>:8080`.
(Mở thẳng file `index.html` sẽ không chạy, vì trình duyệt chặn tải `levels.json` từ file://.)

### Các lệnh

| Lệnh | Việc làm |
|---|---|
| `npm start` | Server tĩnh ở cổng 8080 |
| `npm test` | Chạy toàn bộ test (khoảng 10 giây) |
| `npm run levels:verify` | Kiểm tra lại mọi level trong `levels.json` bằng bộ giải |
| `npm run levels:generate` | Sinh lại `levels.json` (khoảng 3 phút; cùng seed ra cùng file) |
| `npm run playtest` | "Người chơi máy" chơi hết 150 bài (cả 2 mode) × 3 ván, thử cả đi lệch tới khi ván dừng rồi Undo |
| `npm run playtest:browser` | Chơi 60 level + Daily qua giao diện thật trên Chromium, rồi thắng một level mate in 2 chỉ bằng 2 lần bấm gợi ý (cần Playwright) |

## Cấu trúc code

```
index.html            trang duy nhất
css/style.css         toàn bộ giao diện
levels.json           60 level chính + 30 Daily + 20 Obstacle + 40 Blitz (do tools/generate-levels.js sinh ra)
src/
  board.js            bàn cờ kích thước tùy ý, FEN mở rộng (có ô lỗ 'x'), make/undo
  movegen.js          luật đi 6 loại quân, phong cấp, nhập thành, bắt tốt qua đường,
                      chiếu, chiếu hết, hòa pat
  solver.js           bộ giải alpha-beta + bảng băm: tìm chiếu hết, chấm nước,
                      đối thủ phòng thủ, gợi ý
  puzzle.js           máy trạng thái một level (lượt mình → chấm → đối thủ → thắng)
  economy.js          coin, giá gợi ý, rewarded giả lập (1 lần/ngày khi sai 2 lần)
  store.js            cửa hàng giả lập: Rook Pass, Starter Bundle, skin, mode, chơi thử 5 bài
  modes.js            tiến trình mode Obstacle, kỷ lục Blitz (theo tuần)
  trophies.js         Trophy Đồng / Bạc / Vàng / Bạch kim
  progress.js         mở khoá level, Daily theo ngày, chuỗi ngày (streak)
  storage.js          lưu/đọc tiến trình (localStorage, chịu lỗi)
  ui/                 giao diện: vẽ bàn, quân cờ SVG, âm thanh Web Audio, các màn hình
  ui/i18n.js, ui/i18n/ 15 ngôn ngữ (mỗi ngôn ngữ một file, cùng bộ khoá với en.js)
tools/
  generate-levels.js  sinh thế cờ ngẫu nhiên → lọc bằng bộ giải → bỏ quân thừa → xếp độ khó
  verify-levels.js    kiểm tra levels.json
  level-check.js      tiêu chuẩn một puzzle tốt (dùng chung cho 2 file trên)
  playtest.js         chơi thử tự động qua puzzle.js
  playtest-browser.cjs chơi thử tự động qua giao diện thật
  serve.js            server tĩnh không phụ thuộc
tests/                test bằng node --test (luật cờ, perft, bộ giải, level, logic game)
docs/so-sanh.md       so sánh với Pocket Chess: học được gì, cải thiện gì
```

Kiến trúc theo một nguyên tắc: **phần luật và AI không biết gì về giao diện.** Mọi file
trong `src/` ngoài `src/ui/` không đụng tới DOM, nên chạy và test được bằng Node.
Giao diện chỉ nhận thao tác của người chơi, gọi logic, rồi vẽ lại.

Chi tiết quy ước (cách đánh số ô, định dạng FEN, điểm số của bộ giải, định dạng level...)
nằm trong [CLAUDE.md](CLAUDE.md).

## Đưa lên GitHub Pages

Game là trang tĩnh nên chạy thẳng trên GitHub Pages, không cần bước build:

1. Trên GitHub, vào **Settings → Pages** của repo.
2. **Source:** *Deploy from a branch*; **Branch:** `main`, thư mục `/ (root)`; bấm **Save**.
3. Sau khoảng 1 phút, game có ở `https://keivyle.github.io/the-rook-chess/`.

File `.nojekyll` ở gốc repo báo GitHub phục vụ file nguyên trạng (không chạy Jekyll).
Lưu ý: với repo **private**, GitHub chỉ cho bật Pages nếu tài khoản có gói trả phí
(GitHub Pro trở lên); với tài khoản miễn phí thì phải chuyển repo sang public.
