# The Rook Chess

Game **giải đố chiếu hết** trên bàn cờ nhỏ, viết bằng HTML + CSS + JavaScript thuần
(không framework, không thư viện ngoài). Đây là bài tập làm lại một game kiểu
Pocket Chess: mỗi level là một thế cờ dựng sẵn, bạn phải chiếu hết trong N nước.

- 60 level chính trong 4 chương (mate in 1 → 4) và 30 Daily Puzzle.
- Bàn từ 3×4 đến 6×6, có bàn hình dạng lạ (khuyết ô), có level bạn cầm quân Đen.
- Mọi level do máy **tự sinh và tự kiểm tra** bằng bộ giải alpha-beta: chắc chắn có
  chiếu hết đúng N nước, không có cách chiếu hết sớm hơn, nước đầu là duy nhất.
- Đối thủ luôn phòng thủ tốt nhất; mọi cách giải đúng đều được chấp nhận.

**Chơi online:** sau khi bật GitHub Pages (xem [Đưa lên GitHub Pages](#đưa-lên-github-pages)),
link là `https://keivyle.github.io/the-rook-chess/`.

## Cách chơi

1. Đầu màn hình ghi **"Mate in N"**: bạn phải chiếu hết Vua đối phương trong N nước của mình.
   Số N giảm dần sau mỗi nước đúng, và đổi màu khi chỉ còn 1 nước.
2. **Chạm một quân** của bạn: các ô đi được hiện chấm tròn, ô ăn được hiện vòng tròn.
   **Chạm ô đích** để đi. Chạm lại quân đang chọn hoặc ô trống để bỏ chọn.
3. Đi xong thì đối thủ tự đáp trả. Game **không báo đúng/sai**: đi lệch thì ván cứ tiếp
   tục, chỉ khi bạn thật sự chiếu hết mới có hiệu ứng chiến thắng. Nếu đi hết N nước mà
   chưa chiếu hết (hoặc gây hòa pat, hoặc bị đối thủ chiếu hết ngược), ván dừng lại và
   nút **Undo** sáng lên: bấm Undo để đi lại, bao nhiêu lần cũng được, tới khi thắng.
4. Tốt tới hàng cuối thì chọn phong Hậu, Xe, Tượng hoặc Mã (có level phải phong Mã!).
5. Bí thì bấm **bóng đèn** để mua gợi ý bằng coin, hoặc **Undo** để đi lại.
6. Thắng level đầu tiên được coin; không dùng gợi ý và chưa từng đi lệch thì được thêm coin.
   Đã đi lệch thì gợi ý không dùng được (không còn nước đúng để gợi ý): hãy Undo trước.

| | Coin |
|---|---|
| Khởi đầu | 100 |
| Giải level lần đầu | +10 (thêm +5 nếu hoàn hảo) |
| Daily Puzzle | +20 (thêm +5 nếu hoàn hảo) |
| Xem quảng cáo (giả lập, tối đa 5 lần/ngày) | +25 |
| Gợi ý 1: tô sáng quân cần đi | −20 |
| Gợi ý 2: hiện nước tiếp theo | −40 |
| Gợi ý 3: toàn bộ lời giải | −100 |

Quảng cáo và cửa hàng chỉ là **giả lập** cho bài tập: không có quảng cáo hay thanh toán thật.
Tiến trình được lưu trong trình duyệt (localStorage).

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
| `npm run levels:generate` | Sinh lại `levels.json` (khoảng 100 giây; cùng seed ra cùng file) |
| `npm run playtest` | "Người chơi máy" chơi hết 90 level × 3 ván, thử cả đi lệch tới khi ván dừng rồi Undo |
| `npm run playtest:browser` | Chơi 60 level qua giao diện thật trên Chromium (cần Playwright) |

## Cấu trúc code

```
index.html            trang duy nhất
css/style.css         toàn bộ giao diện
levels.json           60 level chính + 30 Daily (do tools/generate-levels.js sinh ra)
src/
  board.js            bàn cờ kích thước tùy ý, FEN mở rộng (có ô lỗ 'x'), make/undo
  movegen.js          luật đi 6 loại quân, phong cấp, nhập thành, bắt tốt qua đường,
                      chiếu, chiếu hết, hòa pat
  solver.js           bộ giải alpha-beta + bảng băm: tìm chiếu hết, chấm nước,
                      đối thủ phòng thủ, gợi ý
  puzzle.js           máy trạng thái một level (lượt mình → chấm → đối thủ → thắng)
  economy.js          coin, giá gợi ý, quảng cáo và cửa hàng giả lập
  progress.js         mở khoá level, Daily theo ngày, chuỗi ngày (streak)
  storage.js          lưu/đọc tiến trình (localStorage, chịu lỗi)
  ui/                 giao diện: vẽ bàn, quân cờ SVG, âm thanh Web Audio, các màn hình
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
