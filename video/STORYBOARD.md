# HụiSafe demo video: storyboard (B30, v1, chờ duyệt)

Phim 1920×1080, 60 fps, H.264, mục tiêu 2:42 (trần 3:00). Lời đọc tiếng Anh theo `video/script.md` (mã L01 đến L31),
phụ đề tiếng Anh in sẵn và file `.srt`. Khung tham khảo: `video/storyboard/frames/01.jpg` đến `14.jpg`, tấm tổng
`video/storyboard/sheet.png`. Mốc thời gian dưới đây là ước lượng; khi có `public/vo/timing.json` sẽ dời theo giọng thật
(mọi mốc nằm trong một file cấu hình, đổi nhịp là sửa một dòng).

## Luật chung của phim

- **Hai sân khấu.** Nền mực `#151313` cho phần mở, vấn đề, ý tưởng, bằng chứng, ba câu hỏi, kết. Nền ngà `#F4F0E8` và
  giấy `#FBF9F4` cho phần sản phẩm (S05 đến S11). Đỏ `#F84131` chỉ ở S02 (hũ nứt), S03 (vạch dưới vụ án), S10 (dòng Thành viên 4
  thiếu tiền). Xanh chanh là màu tiền và hành động, không làm chữ nhỏ trên nền sáng.
- **Không cắt cảnh.** Mỗi cảnh biến thành cảnh sau qua một vật có thật trong khung (cột "Biến sang cảnh sau"). Không
  cross-dissolve. Hướng chính của phim là sang TRÁI (chuyển cảnh thường); đi LÊN dành cho kết luận (S12 sang S13, S13
  sang S14); đẩy tới trước (zoom-through) cho "đi sâu vào" (S04 sang S05, S11 sang S12); lùi ra cho "cái lớn hơn hiện ra"
  (S01 sang S02).
- **Vật dẫn mắt xuyên suốt:** phong bì lá thăm (logo app). Nó đóng dấu ở S01, thành năm thành viên ở S02, niêm phong thăm
  ở S08, bay vào bàn khui kỳ ở S09, và về làm logo ở S14.
- **Viên trạng thái** giữ suốt phần sản phẩm (S05 đến S11), góc trên trái, giống video mẫu: logo, ngữ cảnh, thanh 5 đoạn
  như thanh kỳ trong app, nhãn `DEMO · Fuji` luôn hiện.
- **Chữ:** Inter Tight 900 cho tiêu đề 84 đến 150 px trên nền mực, mỗi khung tối đa khoảng 6 từ; IBM Plex Mono
  `tabular-nums` cho mọi con số (đếm lên). Chữ hiện từng từ, mờ sang nét kèm nhích lên; không nảy, không phóng to bật.
- **Luôn có chuyển động:** camera trôi rất chậm hoặc UI đang làm việc; trước mỗi kết quả lớn có 0,3 đến 0,75 giây đứng yên
  (cú bấm khui, số tiền, ô bù chuyển chanh).
- **3D vừa phải:** cửa sổ app và điện thoại nghiêng tối đa 8°, một nguồn sáng trên trái, bóng mềm, phông sau mờ nhẹ khi
  đổi tiêu điểm. Ba vật 3D của Astra (phong bì, đồng xu trơn, hũ đất) chỉ làm điểm nhấn nhỏ; vật nào trông giả thì thay
  bằng hình vector dựng bằng code.
- **UI dựng lại đúng app thật:** màu, font, bố cục và chữ tiếng Việt lấy từ `apps/web` (SettleDesk, MyRoundCard,
  CircleRoom, CreateCircle, InviteView, Landing). Lời đọc và phụ đề giải thích bằng tiếng Anh.
- **Phụ đề:** Inter Tight 35 px, tối đa 2 dòng, ≤ 42 ký tự mỗi dòng, viên tối `rgba(21,19,19,.72)`, cách đáy 64 px. Bố cục
  căn giữa khung thật; không đặt nút hay số tiền quan trọng trong khoảng 160 px dưới cùng.
- **Nhãn dữ liệu:** số trong S08 đến S11 là dữ liệu thật của dây `0xc62828b2…5Bfc` trên Fuji (viên trạng thái ghi địa chỉ
  dây). S05 đến S07 là luồng tạo và vào dây trên web với cùng tham số (đã chạy thật ngày 20/11 ở dây `0xa428…8f5a`).
  Không có dữ liệu mẫu nào trong phim; nếu sau này phải dùng thì gắn nhãn "sample data".
- **Tên thành viên như app:** trên màn sản phẩm ghi "Thành viên 1" đến "Thành viên 5" (cách app đặt tên theo thứ tự vào
  dây); lời đọc và phụ đề nói "Member 1", "Member 4". Cảnh minh họa nền mực (S02, S04) dùng nhãn ngắn M1 đến M5.
- **Con trỏ:** mũi tên lớn (khoảng 96 px) trên laptop, chấm chạm trên điện thoại. Vào từ ngoài khung, mỗi cú bấm gây ra
  việc tiếp theo ngay trong khung đó, không che chữ của nút.

## Các cảnh

| # | Thời gian | Lời đọc | Khung hình (asset thật) | Chữ trên màn | Cái gì chuyển động | Biến sang cảnh sau |
|---|---|---|---|---|---|---|
| 01 | 0:00–0:07 | L01 | Nền mực. Phong bì lá thăm (3D Astra hoặc vector của `logo.svg`) ở tâm. | Viên khai báo: `DEMO · Fuji` + "Avalanche Fuji testnet · test USDC · rounds sped up to ~2 minutes" (Plex Mono 30 px, giữ ≥ 4 giây) | Phong bì rơi nhẹ vào tâm, nắp gập, con dấu U xanh chanh đóng xuống (cộp, 1,2 s); dòng khai báo hiện từng từ; camera đẩy rất chậm. | Lùi ra (cái lớn hơn hiện ra): phong bì nhỏ lại và bốn phong bì khác trượt vào thành vòng năm người. |
| 02 | 0:07–0:17 | L02–L04 | Nền mực. Vòng 5 phong bì M1–M5, hũ đất (3D Astra) ở giữa. | "One person holds the pot." (Inter Tight 900, 96 px); nhãn `Organizer` dưới hũ | Mỗi phong bì gửi một đồng xu vào hũ (lệch nhau 60 ms); hũ trượt tới M1 rồi quay về giữa; nhãn Organizer hiện, hũ "nằm" trong tay chủ hụi. | Hũ nứt một đường đỏ; vết nứt kéo dài thành vạch đỏ chạy sang trái, thành vạch dưới vụ án đầu tiên. |
| 03 | 0:17–0:32 | L05–L07 | Nền mực. Ba dòng vụ án, mỗi dòng một câu đọc. | "100+ billion VND · taken from 167 people" (Bình Thuận · 2024, Báo Pháp luật 20/09/2024); "157 fake shares · 4+ billion VND · 12 years in prison" (Trà Vinh · 2025, VOV 13/03/2025); "Fake Zalo accounts · nearly 500 million VND" (Tây Ninh · 2026, VietnamPlus 06/10/2026) | Mỗi vụ vào bằng waterfall cut sang trái; vụ trước thu nhỏ lên trên và mờ đi; vạch đỏ dưới số lớn của vụ đang đọc. Nguồn nhỏ bằng mono dưới mỗi vụ. | Ba dòng ép lại thành một thẻ "Organizer"; thẻ tách đôi thành hai thẻ việc. |
| 04 | 0:32–0:45 | L08–L10 | Nền mực. Hai thẻ việc; hàng 5 ví M1–M5 phía dưới. | "An organizer has two jobs."; thẻ "Hold the money" và "Cover the loss" | Thẻ "Hold the money" nhấc lên, gạch ngang, vỡ thành 5 đồng xu bay về 5 ví (tiền ở ví từng người); thẻ "Cover the loss" nền xanh rừng, con dấu U đóng lên, dòng "Bond locked in a smart contract". | Con dấu xanh chanh nén 8% rồi lớn ra phủ kín khung, đổi sang ngà: vào sân khấu sản phẩm (đẩy tới trước). |
| 05 | 0:45–0:53 | L11 | Laptop: landing thật, cắt vào cột phải (đoạn giới thiệu, nút "Chơi hụi ngay", dòng "Đăng nhập bằng Google hoặc email. Không cần ví crypto, không cần AVAX."). Điện thoại bên phải: màn đăng nhập (Google hoặc email), rồi thẻ ví `0x6e55…5A63 · 0 AVAX`. Viên trạng thái "HụiSafe · Fuji testnet". | Chữ UI tiếng Việt như app | Con trỏ vào từ dưới, bấm "Chơi hụi ngay"; điện thoại trượt vào từ phải; chạm "Tiếp tục với Google"; thẻ ví mọc lên từ đáy màn hình. Không đặt câu tiêu đề "không sợ giựt" của landing ở tâm khung (luật không câu tuyệt đối). | Nút chanh của landing kéo dài thành thanh tiêu đề của form "Tạo dây hụi"; điện thoại trượt xuống một nửa ra khỏi khung. |
| 06 | 0:53–1:09 | L12–L14 | Laptop: form "Tạo dây hụi" (Kiểu dây Bỏ thăm, Số phần 5, Mức góp 10 USDC, Ký quỹ 48 USDC). Thẻ vệ tinh bên phải: vòng "Chỉ số bảo chứng". Viên trạng thái "5 members · 10 USDC · Forming". | Vòng đếm 0 → 20% (giữ lại, màu mực) → 100% (ký quỹ 48/60, chanh); chú thích "20% giữ lại · 80% ký quỹ 48/60" | Giá trị form điền lần lượt theo con trỏ; ô ký quỹ gõ "48"; vòng quét và số đếm lên; nút "Kích hoạt khi đủ 5 người và bảo chứng 100%" chuyển từ xám sang sẵn sàng. Câu điều kiện L14 hiện bằng phụ đề, đọc chậm. | Camera trôi sang trái: laptop lùi ra sau và mờ (độ sâu trường ảnh), điện thoại thành viên đi vào tiêu điểm từ phải. |
| 07 | 1:09–1:17 | L15 | Điện thoại: "Lời mời vào dây · 5 người × 10 USDC · Bỏ thăm", "Chỉ số bảo chứng 100%", "Trần thăm kỳ 1 0,65 USDC", ô "Cho phép dây trích tối đa 40,40 USDC · Tiền vẫn nằm trong ví của bạn tới lúc khui kỳ", nút "Ký và vào dây". Laptop mờ phía sau: hàng 5 ghế. | Chữ UI tiếng Việt; "Ví đang có 10,10 USDC · 0 AVAX" | Chạm "Ký và vào dây" → ghế thứ 5 trên laptop lấp đầy, các ghế khác đã đủ; số dư ví đứng yên (tiền không rời ví); chủ hụi bấm Kích hoạt, viên trạng thái sang "Round 1/5". | Nút chanh "Ký và vào dây" co lại thành viên đếm ngược của phòng bỏ thăm (cùng điện thoại, không cắt). |
| 08 | 1:17–1:28 | L16–L17 | Điện thoại: "Kỳ 1 · Phòng bỏ thăm", ba bước "Nộp thăm kín · Mở thăm · Khui kỳ", đếm ngược, ô "Thăm của bạn (số tiền bớt cho mọi người)" = 0,60, dòng "Trần kỳ này 0,65 USDC · thăm cao nhất thắng, bằng nhau thì ít trễ hơn", nút "Niêm phong thăm". Phong bì lớn bên phải. Viên trạng thái thêm địa chỉ dây. | "keccak256 → 0x8f3a…c21e"; "Phong bì thăm kín kỳ 1 · 2/5 người" | Gõ 0,60; chạm "Niêm phong thăm"; con số trượt vào phong bì, nắp gập, con dấu đóng (cộp); mặt phong bì hiện mã băm; bước 2 "Mở thăm": hai phong bì mở, "Thành viên 2 · 0,40" và "Thành viên 4 · 0,60", Thành viên 4 sáng lên. | Phong bì của Thành viên 4 bay lên trái, đáp xuống bàn khui kỳ trên laptop; camera lùi ra thành cặp laptop và điện thoại. |
| 09 | 1:28–1:41 | L18–L20 | Laptop: "Bàn khui kỳ 1", "Thành viên 4 hốt với thăm 0,60 USDC, nhận 28,848 USDC.", danh sách Thành viên 1, 2, 3, 5 "đủ 9,40 USDC", nút chanh "Khui kỳ 1, mở kỳ 2", dòng "Bạn còn 04:52 để khui; sau đó keeper khui thay". Điện thoại của Thành viên 4 bên phải: thẻ "Kết quả kỳ 1 · Bạn (Thành viên 4) hốt kỳ này · Thực nhận 28,848 USDC · thăm thắng 0,6 USDC mỗi phần · Xem giao dịch trên Snowtrace" và dòng "Bạn đã hốt ở Kỳ 1… nhả lại 2,00 USDC tiền giữ lại" (chữ thật của CircleRoom). | Toast "Kỳ 1 đã chốt · Thành viên 4 nhận 28,848 USDC" | Con trỏ vào, dừng 0,5 s, bấm Khui; bốn đồng xu bay từ bốn dòng vào giữa, rồi sang điện thoại (số đếm lên đúng lúc xu chạm); 8,00 tách ra rơi vào phần tiền giữ lại của Thành viên 4 (gieo cho S10). Viên trạng thái: đoạn 1 đầy, "Round 2/5". | Đoạn thanh kỳ tiến lên; nội dung bàn khui cuộn sang kỳ 2 trong cùng cửa sổ. |
| 10 | 1:41–1:58 | L21–L24 | Laptop: "Bàn khui kỳ 2", "Thành viên 1 hốt với thăm 0,30 USDC.", dòng Thành viên 4 đỏ "thiếu 10,00 / 10,00 USDC", cảnh báo "Thành viên 4 chưa đủ tiền… bù theo thác", nút "Khui kỳ 2, mở kỳ 3". Thẻ vệ tinh: thác bù 4 bậc, "Thành viên 1 nhận đủ 32,318 USDC", biểu đồ ký quỹ 48, 46, 36, 26, 16. | Bậc 1 "Tiền giữ lại của Thành viên 4 8,00", bậc 2 "Ký quỹ của chủ hụi 2,00", bậc 3 "Quỹ dự phòng 0", bậc 4 "Người hốt nhận thiếu 0" | Dòng Thành viên 4 chuyển đỏ (một lần, không nhấp nháy); bấm Khui; thanh thiếu 10,00 màu đỏ được lấp bằng hai mảng chanh 8 rồi 2, đổi hẳn sang chanh; "32,318" đếm lên; tua nhanh kỳ 3 đến 5: cột ký quỹ hạ 46 → 36 → 26 → 16, viên trạng thái chạy tới "Completed", ghế Thành viên 4 gắn nhãn đỏ "Vỡ nợ". | Các dòng của bàn khui gập thành các dòng sổ hụi; cửa sổ rộng ra. |
| 11 | 1:58–2:04 | L25 | Laptop: "Sổ hụi · Dây 0xc628…5Bfc · Avalanche Fuji · dựng từ event on-chain"; dòng Kỳ 2 Thành viên 4 Thiếu 10,00 / Bù từ tiền giữ lại 8,00 / Bù từ ký quỹ 2,00 / Thành viên 1 Hốt 32,318 / Kỳ 3 Thành viên 4 Vỡ nợ, mỗi dòng một chip mã giao dịch. | Chữ UI tiếng Việt; mã giao dịch thật lấy từ chuỗi lúc dựng | Các dòng ghi vào từ trên xuống (lệch 60 ms); con trỏ bấm chip mã giao dịch của dòng Thành viên 1. | Đẩy tới trước (zoom-through) vào chip mã giao dịch, mở ra trang explorer thật. |
| 12 | 2:04–2:18 | L26–L27 | **Quay thật:** Avalanche Explorer (subnets-test.avax.network, trang Fuji của dây 0xc628…5Bfc, danh sách giao dịch settleRound) trong khung trình duyệt; tiếp theo vài giây landing đang chạy (mục Sổ cái Fuji). Bên phải: ba con số. | "Real capture · Avalanche Explorer (Fuji)"; "5 contracts verified on Fuji"; "634 Foundry tests · 17 invariants fuzzed"; "0 critical or high in internal review"; "Nov 20 · circle run from the web · contract balance 0 · 0xa428…8f5a" | Bản quay cuộn chậm tới danh sách giao dịch; ba con số vào bằng waterfall, đếm lên. Hộp cookie của explorer đóng (Decline) trước khi quay. Snowtrace chặn trình duyệt tự động (Cloudflare), nên dùng explorer chính thức của Avalanche. | Cửa sổ quay thật trượt sang trái ra khỏi khung; câu hỏi thứ nhất đi lên vào tâm (kết luận). |
| 13 | 2:18–2:35 | L28–L30 | Nền mực. Ba câu hỏi xếp chồng, câu đang đọc sáng và lớn, câu trước mờ và nhỏ lên trên. Logo Avalanche chính thức cạnh câu 2. | "Why on-chain?" / "Nobody holds the money. Rules can't change mid-circle. Public ledger." · "Why Avalanche?" / "Native USDC with permit: sign once. Fees low enough for our relayer to pay." · "Where does the money come from?" / "Only the members. Commission inside Decree 19's interest cap.* No token, no yield." Chú thích nhỏ: "* commission-share mode (φ > 0). Demo circles use a fixed 1% fee." | Mỗi câu vào bằng waterfall từ dưới; câu trước trượt lên theo đường cong nudge rồi mờ đi. | Cả ba câu trượt lên ra khỏi khung; phong bì lá thăm đi lên vào tâm. |
| 14 | 2:35–2:42 | L31 | Thẻ kết nền mực, căn giữa theo hộp bao thật, không trôi camera. | Logo + "HụiSafe"; nút "Try it on Fuji testnet"; mã QR + `lamng.tail3abf4e.ts.net:8443`; "Built on [logo Avalanche] · [logo Team1 Vietnam] UniHack 2026"; "Ngô Bình Minh (leader) · Ngô Lâm Tiến · Ngô Đặng Trọng Hiếu" | Logo đáp vào tâm, con dấu đóng lần cuối; các dòng dưới hiện từng nhóm; giữ yên 2 giây cuối. | Hết phim. |

## Âm thanh (làm sau khi hình được duyệt)

Nhạc nền CC0 nhẹ, nhịp vừa, có một đoạn lên ở S09 và S10; SFX tiết chế: tiếng cộp con dấu (S01, S08, S14), tiếng đồng xu
(S02, S04, S09), tiếng vút nhẹ chỉ cho chuyển động camera, tiếng click khi bấm. Kiểm bằng earshot: −14 LUFS tích hợp,
đỉnh ≤ −1 dBTP, giọng nổi trên nhạc.

## Quyết định cần anh duyệt

1. **Đổi dây cho cảnh khui kỳ (S08, S09).** Bản giao việc ghi số của dây web `0xa428…8f5a` (31,20 đến 39,20 USDC). Dây đó
   5 kỳ đều không ai bỏ thăm (b = 0, tính ngược từ tiền nhận), nên nếu dùng nó thì cảnh bỏ thăm 0,60 sẽ là số bịa. Đề xuất:
   S08 đến S11 dùng dây `0xc628…5Bfc` (cùng tham số 5 × 10 USDC, ký quỹ 48; có thăm thật 0,40 và 0,60, M4 nhận 28,848,
   rồi vỡ nợ ở kỳ 2), còn dây `0xa428…8f5a` (tạo trên web bằng Google, tự khui đủ 5 kỳ, số dư về 0) đưa vào S12 làm bằng
   chứng luồng web. Dây `0xc628` chạy bằng script và ví demo của đội; phim không nói đó là người dùng thật.
2. **Nhịp quay thật dùng Avalanche Explorer thay Snowtrace:** Snowtrace và Routescan chặn trình duyệt tự động
   (Cloudflare, 403). Nếu anh muốn đúng Snowtrace, anh tự quay 5 giây trang đó bằng trình duyệt của anh rồi đưa file.
3. **Landing:** chỉ dùng cột phải (đoạn giới thiệu, nút, dòng đăng nhập Google), không đưa câu "Chơi hụi không sợ giựt"
   và màn đăng nhập có khẩu hiệu vào phim.
4. **Hoa hồng trong trần lãi** chỉ đúng với chế độ φ > 0 (docs/03 mục 2.7); các dây demo dùng tiền công cố định 1%. S13
   có chú thích nhỏ nói rõ điều này.
