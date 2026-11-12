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
| 2 | Ô lỗ `x`, bộ giải alpha-beta + bảng băm `solver.js` | **Đang làm**: solver xong; còn `levels.json`, script kiểm tra, soạn 50 level |
| 3 | Màn chơi: vẽ bàn, chọn quân, máy trạng thái, đối thủ đáp trả | Chưa |
| 4 | Tiến trình: Home, chọn level, mở khoá, Daily, lưu localStorage | Chưa |
| 5 | Kinh tế: coin, gợi ý 3 mức, quảng cáo/Shop giả lập | Chưa |
| 6 | Trau chuốt: animation, âm thanh, Settings, phân tích so sánh | Chưa |

## Cấu trúc thư mục

```
CLAUDE.md          # file này
package.json       # "type": "module", script `npm test`
src/
  board.js         # trạng thái bàn, FEN mở rộng, make/undo (không biết luật đi)
  movegen.js       # sinh nước hợp lệ, inCheck, isCheckmate, isStalemate, perft
  solver.js        # alpha-beta + bảng băm: findMate, isStillWinning, bestDefense, bestHint
tests/
  board.test.js    # FEN (kể cả lỗ 'x'), đánh số ô, make/undo
  movegen.test.js  # level mẫu, 6 thế đếm tay, pat, phong cấp, nhập thành, lỗ, perft
  solver.test.js   # 3 thế cờ chép từ ảnh game gốc + chấm nước, đáp trả, gợi ý
```

Các file sẽ thêm ở mốc sau (theo GDD mục 8.1): `src/puzzle.js`,
`src/economy.js`, `src/progress.js`, `src/storage.js`, `src/ui/*.js`,
`levels.json`, `index.html`.

**Nguyên tắc kiến trúc:** phần luật và AI (`board.js`, `movegen.js`, `solver.js`,
`puzzle.js`, ...) **không được** đụng tới DOM, `window`, `localStorage`, để chạy
được cả trên trình duyệt lẫn Node test. Chỉ `src/ui/` mới được dùng DOM.

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
npm test          # = node --test, chạy mọi file tests/*.test.js
```

Test hiện có 50 ca, chạy khoảng 1,5 giây. Perft 8×8 (khai cuộc, Kiwipete, thế số 3)
là bằng chứng mạnh nhất rằng movegen + make/undo đúng; đừng xoá.
