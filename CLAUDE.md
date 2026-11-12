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
| 2 | Bộ giải alpha-beta `solver.js`, kiểm tra `levels.json`, soạn 50 level | Chưa |
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
tests/
  board.test.js    # FEN, đánh số ô, make/undo
  movegen.test.js  # level mẫu, 6 thế đếm tay, pat, phong cấp, nhập thành, perft
```

Các file sẽ thêm ở mốc sau (theo GDD mục 8.1): `src/solver.js`, `src/puzzle.js`,
`src/economy.js`, `src/progress.js`, `src/storage.js`, `src/ui/*.js`,
`levels.json`, `index.html`.

**Nguyên tắc kiến trúc:** phần luật và AI (`board.js`, `movegen.js`, `solver.js`,
`puzzle.js`, ...) **không được** đụng tới DOM, `window`, `localStorage`, để chạy
được cả trên trình duyệt lẫn Node test. Chỉ `src/ui/` mới được dùng DOM.

## Mô hình dữ liệu (đã chốt ở Mốc 1)

- **Ô cờ:** chỉ số `sq = rank * width + file`. `file` 0..width-1 từ trái
  (cột a), `rank` 0..height-1 từ **dưới lên** (hàng 1 là phía Trắng).
- **Quân:** 1 ký tự như FEN: hoa = Trắng `KQRBNP`, thường = Đen `kqrbnp`,
  `'.'` = trống.
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

Test hiện có 28 ca, chạy dưới 1 giây. Perft 8×8 (khai cuộc, Kiwipete, thế số 3)
là bằng chứng mạnh nhất rằng movegen + make/undo đúng; đừng xoá.
