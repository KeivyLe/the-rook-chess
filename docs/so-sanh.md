# So sánh với Pocket Chess: học được gì và đã cải thiện gì

Tài liệu này là phần phân tích cuối của bài tập (GDD mục 9, Mốc 6). Thông tin về
bản gốc lấy từ tài liệu thiết kế, gồm mô tả trên cửa hàng ứng dụng và đánh giá của
người chơi, cùng 3 ảnh chụp màn hình bản gốc mà nhóm dùng làm mẫu. Số liệu bên trong
bản gốc (giá gợi ý, số coin, kích thước bàn chính xác) không được công bố, nên chỗ nào
nói về bản gốc ở dưới đều chỉ dựa trên những nguồn đó.

## 1. Học được gì từ Pocket Chess

### Thiết kế game

- **Vòng lặp ngắn giữ chân người chơi.** Mỗi level chỉ vài chục giây đến vài phút:
  nhìn thế cờ → tính → đi → đối thủ đáp → chiếu hết → coin → level tiếp. Ngắn đến mức
  người chơi dễ "thêm một level nữa".
- **Bàn nhỏ, ít quân là chính ý tưởng của game.** Bỏ hết quân thừa để người chơi chỉ
  tập trung vào một mẫu chiếu hết. Đây cũng là cách dạy cờ: học nhận ra hình mẫu nhanh.
- **Độ khó điều khiển bằng số nước N** (mate in 1 → 4) mạnh hơn mọi yếu tố khác. Sau đó
  mới tới số quân, cỡ bàn, nước "yên lặng" (không chiếu, không ăn) và nước hy sinh.
- **Bàn hình dạng lạ** (ô khuyết) tạo puzzle mới mà không cần luật mới: ô khuyết chặn
  quân trượt giống hệt mép bàn.
- **Khi người chơi cầm Đen, bàn xoay 180°** để phía người chơi luôn ở dưới. Nhóm phát
  hiện điều này khi chép thế cờ "Level 90" từ ảnh: chép thẳng thì bộ giải báo không có
  chiếu hết; xoay lại thì ra đúng mate in 4 (một đòn chiếu hết ngộp thở có hy sinh Hậu).
- **Giao diện tối giản:** một tiêu đề lớn "Mate in N", bàn cờ ở giữa, hai nút tròn
  (gợi ý, đi lại). Không có gì làm người chơi xao nhãng khỏi bàn cờ.

### Kỹ thuật

- **Game puzzle cần một bộ giải, không chỉ một đáp án lưu sẵn.** Cùng một bộ giải
  alpha-beta làm được 4 việc: kiểm tra level, chấm nước người chơi, cho đối thủ phòng
  thủ, và đưa gợi ý.
- **Alpha-beta không phải thuật toán khác minimax:** cùng kết quả, chỉ bỏ qua các nhánh
  chắc chắn không được chọn. Điểm chiếu hết = `MATE + số nửa nước còn thừa`, nên bên
  tấn công tự ưu tiên chiếu hết nhanh, bên phòng thủ tự chọn kéo dài.
- **Bảng băm (transposition table)** nhớ các thế cờ đã tính. Ở level mate in 4 Đen tấn
  công, số thế cờ phải duyệt giảm từ 8164 xuống 4313.
- **Kiểm chứng trước, giao diện sau.** Luật đi được kiểm bằng *perft* (đếm số chuỗi nước)
  trên 3 thế cờ 8×8 chuẩn, khớp con số đã công bố tới gần 100.000 nước. Nhờ vậy khi làm
  bộ giải và giao diện, mọi lỗi đều nằm ở phần mới chứ không phải ở luật cờ.
- **Tách luật khỏi giao diện.** Mọi file logic chạy được bằng Node, nên 90 test chạy trong
  khoảng 10 giây mà không cần mở trình duyệt.

## 2. Những điểm người chơi bản gốc phàn nàn, và bản này đã sửa thế nào

| Vấn đề ở bản gốc (theo đánh giá người chơi) | Bản này làm gì |
|---|---|
| Đi một nước đúng nhưng khác đáp án lưu sẵn thì bị báo sai | Không so với đáp án. Sau mỗi nước, bộ giải kiểm tra "còn chiếu hết bắt buộc trong số nước còn lại không". Mọi cách giải đúng đều được tính (có test riêng: level có hai cách chiếu hết ở nước cuối, cả hai đều thắng). |
| Bấm gợi ý sau khi đã đi đúng nước đầu, game lùi về và gợi ý lại nước người chơi đã biết | Gợi ý luôn tính từ thế cờ **hiện tại** (có test riêng cho gợi ý giữa ván). |
| Gợi ý quá đắt so với coin kiếm được, cảm giác bị ép mua | 3 mức gợi ý rõ giá: 20 / 40 / 100 coin. Người chơi trung bình kiếm 10–15 coin mỗi level, cộng 25 coin cho mỗi lần xem quảng cáo (tối đa 5 lần/ngày), nên cứ khoảng 2 level chơi tốt là đủ một gợi ý nhỏ. Bắt đầu với 100 coin. |
| Quảng cáo quá dày, giữa các level khoảng mỗi 1–2 level | Không có quảng cáo ở 10 level đầu, sau đó cứ 3 level mới có một lần. Có gói "Remove Ads". Chơi thử tự động 60 level xác nhận đúng 16 quảng cáo, sau level 13, 16, …, 58. |
| Nút đóng quảng cáo khó bấm, dễ bấm nhầm vào quảng cáo | Nút "Đóng" to, rộng hết hộp, đặt ở dưới cùng; hết 5 giây mới bấm được. |
| Kiểu khuyến mãi gấp ("giảm 50% trong thời gian có hạn") | Không có khuyến mãi gấp, không đếm ngược ép mua. Cửa hàng chỉ có gói coin cố định và Remove Ads. |
| Quảng cáo làm tắt nhạc của app khác | Không có nhạc nền; âm thanh hiệu ứng tổng hợp bằng Web Audio và tắt được trong Cài đặt. |
| Bị kẹt ở level khó, độ khó tăng đột ngột | Chương 1–4 tăng dần số nước; trong mỗi chương level được chấm điểm khó tự động rồi xếp **răng cưa**: cứ 3 level thì chèn 1 level dễ để nghỉ. 5 level đầu giới thiệu từng quân. |
| Puzzle bị lỗi (ví dụ "puzzle bị hòa pat") | Mọi level qua kiểm tra tự động: thế cờ hợp lệ, chiếu hết **đúng** N nước, không có cách chiếu hết sớm hơn, nước đầu duy nhất. Gây hòa pat bị chấm là sai và có thông báo riêng ("Hoà pat rồi!"). |
| Muốn giữ Undo sau khi thắng để xem lại ván | **Chưa làm** (xem mục 4). |

## 3. Những gì khác bản gốc do điều kiện bài tập

- **Level do máy sinh, không chép từ bản gốc.** `tools/generate-levels.js` đặt quân
  ngẫu nhiên, để bộ giải lọc, rồi tự bỏ mọi quân thừa. Script kiểm tra còn so với các thế
  cờ đã biết của bản gốc để chắc chắn không trùng. Cùng một seed luôn sinh ra cùng một bộ
  level.
- **Hình ảnh và âm thanh tự làm.** Quân cờ theo artstyle "Ivory / Espresso" do nhóm tự
  thiết kế (quân dẹt khắc nổi, hai màu ngà và nâu cà phê), dựng lại bằng SVG trong code;
  icon tự vẽ, màu nền tự chọn, âm thanh tổng hợp bằng code. Bố cục màn chơi thì theo bản gốc.
- **Quảng cáo và thanh toán chỉ là giả lập**, không có SDK thật.
- **Quy mô:** 60 level chính + 30 Daily, so với khoảng 1010 level của bản gốc. Daily xoay
  vòng 30 level theo ngày, có chuỗi ngày liên tiếp (streak), thay cho các event theo đợt.

## 4. Kiểm thử và những gì còn thiếu

**Đã kiểm thử:**

- 90 test tự động (`npm test`): luật cờ, perft, bộ giải, 3 thế cờ chép từ ảnh bản gốc,
  từng level trong `levels.json`, máy trạng thái màn chơi, kinh tế, tiến trình, lưu game.
- `npm run playtest`: máy chơi 90 level × 3 ván, đối thủ chọn ngẫu nhiên giữa các nước
  phòng thủ tốt nhất, thử cả nước sai, Undo, gợi ý mức 3. Kết quả 270/270 ván thắng đúng
  hạn, 0 lỗi. Lượt chậm nhất của bộ giải là khoảng 0,6 giây (level 60, mate in 4).
- `npm run playtest:browser`: chơi 60 level liên tục qua giao diện thật trên Chromium, bấm
  chuột như người thật, rồi chơi Daily. 0 lỗi JavaScript; coin, tiến trình, streak và lịch
  quảng cáo lưu đúng như thiết kế.

**Còn thiếu / nên làm tiếp:**

- **Chưa cho người thật chơi thử.** GDD đề xuất cho 3 người chơi thử, ghi lại level nào bị
  kẹt rồi chỉnh độ khó và giá gợi ý. Chơi thử tự động chỉ chứng minh game *đúng*, chưa
  chứng minh game *hay*: độ khó do máy chấm (số thế cờ bộ giải duyệt) có thể khác cảm nhận
  của người, và vài thế cờ do máy sinh trông kém tự nhiên hơn level người soạn.
- **Kéo thả quân:** hiện chỉ chạm hai lần (chọn quân, chọn ô).
- **Nút "Xem lại" ở màn thắng** để xem lại ván vừa giải.
- **Bộ giải chạy trên luồng chính:** ở level mate in 4, bàn có thể "đứng" khoảng nửa giây sau
  nước đi. Có thể chuyển bộ giải sang Web Worker.
