# Tiến độ dự án The Rook Chess

Cập nhật: 15/11/2026, sau khi merge PR #6 và làm kéo thả quân.
Bản chơi online: https://keivyle.github.io/the-rook-chess/ (GitHub Pages, nhánh `main`, thư mục gốc).

File này ghi lại **đã làm gì, đã chốt gì, còn lại gì**. Chi tiết kỹ thuật nằm trong
`CLAUDE.md`; cách chơi và cách chạy nằm trong `README.md`; phần so sánh với bản gốc để
nộp bài nằm trong `docs/so-sanh.md`.

## 1. Các mốc đã xong

| Mốc | Nội dung | Pull request |
|---|---|---|
| 1 | Luật cờ trên bàn kích thước tùy ý: `board.js` (FEN mở rộng, make/undo), `movegen.js` (6 loại quân, phong cấp, nhập thành, bắt tốt qua đường, chiếu hết, pat, perft) | #1 |
| 2 | Ô lỗ `x` (bàn hình dạng lạ); bộ giải alpha-beta + bảng băm `solver.js` | #1 |
| 3 (2b) | Sinh level tự động có seed, lọc bằng bộ giải: `levels.json` 60 level chính + 30 Daily; `verify-levels` | #1 |
| 4 | Logic: `puzzle.js` (máy trạng thái), `economy.js`, `progress.js`, `storage.js` | #1 |
| 5 | Giao diện HTML/CSS/JS thuần, quân SVG tự vẽ, âm thanh Web Audio | #1 |
| 6 | Chơi thử tự động (Node + trình duyệt), README, `docs/so-sanh.md`, GitHub Pages | #2 |
| — | Artstyle quân Ivory / Espresso theo mẫu của chủ dự án; quân gọn trong ô; luật "đi sai thì kệ" | #3 |
| — | Nhãn hai phía bàn: bên nào ở đâu, Tốt đi hướng nào | #4 |
| 7 | Theo "Kế hoạch MKT": kinh tế mới, Rook Pass, Starter Bundle, skin bàn/quân, mode Obstacle + Blitz Mate, Trophy; thêm 20 level Obstacle + 40 Blitz | #5 |
| 8 | Tối ưu điện thoại: thanh tab đáy, màn Modes gộp, bàn tự co; gợi ý một loại (bóng quân, 20 coin); 15 ngôn ngữ, mặc định tiếng Anh | #6 |
| 8b | Kéo thả quân (chuột + cảm ứng), vẫn giữ chạm-chạm; playtest trình duyệt chơi level chẵn bằng kéo thả | (chưa mở PR) |

**Kiểm thử ở thời điểm này** (đều xanh khi merge PR #6):
- `npm test`: 120 ca, khoảng 10 giây.
- `npm run playtest`: 450 ván (150 bài × 3), 0 lỗi.
- `npm run playtest:browser`: 60 level + Daily qua giao diện thật, 0 lỗi, 0 quảng cáo tự hiện,
  coin cuối đúng 1025, hộp Starter Bundle đúng 2 lần; level mate in 2 thắng sau đúng 2 lần
  bấm gợi ý, trừ 40 coin.

## 2. Các quyết định đã chốt

Những điều dưới đây do chủ dự án chọn hoặc yêu cầu. Đổi lại thì phải sửa code, test và
tài liệu cùng lúc.

### Công nghệ và quy ước
- HTML + CSS + JavaScript thuần, không framework, không bundler, không thư viện ngoài.
  Test bằng `node --test`. Playwright chỉ dùng cho script chơi thử, không nằm trong dự án.
- Phần luật và AI không dùng DOM, `window`, `localStorage`; chỉ `src/ui/` dùng DOM
  (`storage.js` là ngoại lệ, nhận `storage` qua tham số). Ngày truyền dạng `"yyyymmdd"`.
- Mỗi hàm có comment tiếng Việt; thông báo lỗi tiếng Việt; tên biến tiếng Anh.
- Trang tĩnh trên GitHub Pages: mọi đường dẫn là tương đối.

### Nội dung
- Không chép level, hình ảnh, âm thanh từ game gốc. Level do máy sinh và lọc: mỗi bên 1 Vua,
  chiếu hết đúng N nước, nước đầu duy nhất, bỏ quân thừa. Seed mặc định 20261112.
- Quân cờ theo artstyle "Ivory / Espresso" do chủ dự án thiết kế. Quân không vượt ra ngoài ô.
- Bàn luôn xoay để phía người chơi ở dưới; nhãn hai mép bàn ghi bên nào ở đâu.

### Luật chơi
- **Đi sai thì kệ:** không báo sai, không rung, không tự lùi. Ván tiếp tục, chỉ chiếu hết
  thật mới có hiệu ứng thắng. Người chơi tự Undo, không giới hạn.
- Mọi cách chiếu hết đều được tính (chấm bằng bộ giải, không so với đáp án lưu sẵn).

### Gợi ý (Mốc 8)
- Chỉ **một** loại gợi ý, 20 coin mỗi lần, có Rook Pass thì miễn phí.
- Mỗi lần bấm chỉ đúng một nước bằng hình động: bóng mờ của quân trượt từ ô đi tới ô đến,
  quân được chọn sẵn. Không hiện tên ô. Mate in N thì tối đa N lần bấm là thắng.
- Đã đi lệch thì gợi ý tự lùi về thế còn thắng gần nhất (miễn phí) rồi mới chỉ.

### Kiếm tiền (theo "Kế hoạch MKT", thay GDD mục 6)
- Không quảng cáo xen giữa, không banner, không bán coin, không thưởng coin bằng quảng cáo.
- Coin: khởi đầu 100; giải lần đầu +10, hoàn hảo +5; Daily +20; giải lại 0.
- Rewarded: tối đa 1 lần/ngày, chỉ khi đã sai ≥ 2 lần ở bài đang chơi, chỉ hiện trong hộp
  "không đủ coin", đổi lấy 1 gợi ý.
- Cửa hàng là **giả lập** (bài tập, không thanh toán thật): Rook Pass $4.99/tháng (dùng thử
  7 ngày), Starter Bundle $9.99 chỉ 7 ngày đầu (mời đúng 2 lần: sau Daily đầu tiên và sau
  level 10), skin $2.99, bộ skin $4.99, mode $3.99, mỗi mode chơi thử 5 bài.
- Trophy không bán, không thưởng coin.

### Giao diện (Mốc 8)
- Thiết kế cho điện thoại một tay. Thanh tab cố định ở đáy mọi màn:
  Play · Daily · Modes · Trophies · Shop. Chạm coin mở Shop, bánh răng mở Settings.
- Màn Modes gộp Daily, Blitz Mate, Obstacle. Không còn màn Home riêng.
- Màn chơi cao đúng một màn hình, bàn tự co theo chỗ còn lại.
- Đi quân bằng chạm-chạm hoặc kéo thả (cả hai luôn dùng được). Thả sai chỗ thì quân về ô cũ.
- 15 ngôn ngữ: EN (mặc định), DE, FR, JA, ES, PT, KO, RU, ID, HI, IT, TR, ZH, PL, VI.
  Tên sản phẩm (Rook Pass, Starter Bundle, Blitz Mate, Obstacle) giữ tiếng Anh. Tài liệu
  trong repo vẫn viết tiếng Việt.

## 3. Việc còn lại

### Nên làm tiếp (không cần máy chủ)
- **Người bản xứ đọc lại bản dịch.** 14 ngôn ngữ ngoài tiếng Anh do Claude dịch; test chỉ
  bảo đảm đủ khoá và đúng chỗ điền, không bảo đảm câu chữ tự nhiên.
- **Chơi thử với người thật** trên điện thoại: xem người chơi có hiểu bóng quân gợi ý, thanh
  tab, nhãn hai phía bàn không; chỉnh độ khó và giá gợi ý theo chỗ họ bị kẹt.
- **Nút "Xem lại"** sau khi thắng (giữ Undo để xem lại ván), người chơi bản gốc từng muốn có.
- **Đưa bộ giải sang Web Worker** để giao diện không khựng ở level 4 nước (lượt chậm nhất
  hiện khoảng 0,6 giây).
- Lỗi hiển thị nhỏ: thông báo Trophy ở đầu màn hình che viên coin trong khoảng 2,6 giây.

### Cần máy chủ hoặc app (từ "Kế hoạch MKT")
- Bạn cờ, bảng xếp hạng, "% người đạt" Trophy, Classic Masters, thẻ chia sẻ Daily Mate.
- Thanh toán thật cho Rook Pass / Starter Bundle / skin (hiện là giả lập).

### Dọn dẹp tài liệu và code
- `CLAUDE.md`, bảng Tiến độ: dòng Mốc 5 vẫn ghi "gợi ý 3 mức" (đúng ở thời điểm đó, nay
  giao diện chỉ còn 1 loại; xem dòng Mốc 8).
- `puzzle.js` còn `getHint` mức 1 và 3; giao diện không dùng, nhưng `tools/playtest.js` và
  test còn dùng mức 3 để kiểm tra lời giải đầy đủ. Giữ lại hay bỏ: chưa quyết.
- `store.js`: trường `name` của sản phẩm vẫn là tiếng Việt; giao diện không dùng (lấy tên từ
  `product.*` trong file ngôn ngữ), có thể bỏ cho gọn.

## 4. Lưu ý cho phiên sau

### Bắt đầu phiên
- Đọc `CLAUDE.md` trước (mô hình dữ liệu, API bộ giải, quy ước), rồi file này.
- Nhánh làm việc là `moc-1-luat-co` (phiên cloud có thể được giao nhánh `claude/...` khác:
  phần kéo thả quân nằm trên `claude/exciting-meitner-ktcoer`). Nếu PR trước đã merge: đưa nhánh về `origin/main` mới
  nhất trước khi làm tiếp (các commit cũ đã nằm trong `main`).
- Chạy `npm test` một lần để chắc môi trường ổn (120 ca, khoảng 10 giây).

### Khi sửa code
- `npm test` phải xanh trước mỗi commit. Sửa `puzzle.js`, bộ giải hoặc giao diện thì chạy thêm
  `npm run playtest` (khoảng 30 giây) và `npm run playtest:browser` (khoảng 3–5 phút).
- Đổi số liệu kinh tế (coin, giá gợi ý) thì sửa con số mong đợi trong
  `tools/playtest-browser.cjs` (hiện coin cuối = 100 + 60·15 + 25 = 1025, gợi ý trừ 40 coin).
- Thêm chữ mới trên giao diện: thêm khoá vào **cả 15 file** `src/ui/i18n/*.js` rồi gọi
  `t('khoá')`; `tests/i18n.test.js` báo nếu thiếu. Không viết cứng chữ trong `app.js`.
  Chữ số nhiều dùng đối tượng `{ one, few, many, other }` (bắt buộc có `other`).
- Script chơi thử tìm nút bằng class / `data-*`, không theo chữ hiển thị (vì đổi ngôn ngữ).
  Thêm nút mới mà script cần bấm thì gắn class hoặc `data-*` riêng.
- Đo giao diện ở khổ 320 px và 390 px: không cuộn ngang, tiêu đề và nhãn tab không bị cắt ở
  cả 15 ngôn ngữ (tiếng Nga, Đức, Indonesia, Việt thường dài nhất).
- Quân cờ không được vượt ra ngoài ô; đổi dáng quân thì đo lại bằng `getBBox`.
- Không sửa tay `levels.json`; muốn đổi thì sửa `tools/` rồi `npm run levels:generate`.
- Không xoá test perft 8×8.

### Môi trường phiên Claude trên cloud
- Tạo PR bằng REST (`gh api repos/KeivyLe/the-rook-chess/pulls --method POST --input <file json>`);
  `gh pr create` không chạy được vì GraphQL bị chặn.
- Không bật được GitHub Pages qua API; chủ repo tự bật trong Settings → Pages.
- Playwright và Chromium có sẵn trong container (không cần cài).
- Server thử nghiệm: `node tools/serve.js 8080`; script chơi thử trình duyệt tự dùng cổng 8123.
- Container có thể bị thu hồi khi không hoạt động: việc dở dang phải commit và push trước khi
  dừng, kể cả file nháp (ví dụ bản dịch đang soạn).

### Thói quen làm việc của chủ dự án
- Trao đổi bằng tiếng Việt; tài liệu trong repo viết tiếng Việt.
- Thường gửi ảnh chụp màn hình khi muốn sửa giao diện: đối chiếu đúng chỗ trong ảnh.
- Muốn thấy kết quả bằng ảnh chụp trên khổ điện thoại sau mỗi thay đổi giao diện.
