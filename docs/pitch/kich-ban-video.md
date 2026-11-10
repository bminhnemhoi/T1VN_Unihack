NHÁP chờ Towfienes duyệt

# Kịch bản video demo HụiSafe (2:50)

Viết ngày 11/11/2026 (B14, pitch). Nền: `docs/12-pitch-demo-nop-bai.md` mục 5 (storyboard), mục 3 (kịch bản demo), mục 1 (khai báo dev toggle); số tiền lấy từ `docs/03-dac-ta-giao-thuc.md` mục 8, 8.1, 8.2; số mô phỏng lấy từ `sim/outputs/baseline.json` và `baseline.meta.json`.

## 1. Thông số

| Mục | Giá trị |
|---|---|
| Độ dài mục tiêu | 2:50. Giới hạn cứng 3:00 (luật nộp bài: 2-3 phút) |
| Tốc độ đọc dùng để chia thời gian | 3 từ mỗi giây (đã đếm số từ từng cảnh ở cột cuối bảng mục 2) |
| Phụ đề | Tiếng Việt và tiếng Anh. Không dùng nhạc có bản quyền |
| Đoạn tua nhanh | Ghi rõ trên hình ("Tua nhanh x4") |
| Dải băng chế độ demo | Hiện suốt video, đúng chữ của `docs/02` US-10 AC-10.1. Nếu quay trên bản số liệu mẫu thì dải băng tự thêm "Màn hình này dùng số liệu mẫu." và phải giữ nguyên trên hình |
| Tên màn hình | Đúng `docs/02` mục 7 (S01 đến S16). Giao diện B10-B12 đang chờ Towfienes duyệt: nếu tên màn hoặc nhãn cột đổi thì sửa lại cột "Màn hình" |

**Về số 100 USDC và 10 USDC.** Bảng dưới ghi số của dây mẫu N = 5, C = 100 USDC (docs/03 mục 8). Nếu quay dây demo thu nhỏ C = 10 USDC (faucet Circle chỉ cấp 20 USDC mỗi 2 giờ mỗi ví), mọi số tiền tỷ lệ thuận, chia 10 (docs/03 mục 8, phần "Thu nhỏ để chạy trên Fuji"): ký quỹ 48, thăm thắng kỳ 1 là 0,6, M4 nhận 28,848, M1 nhận 32,318, ký quỹ còn 16 ở nhánh B. Khi đó phải đọc đúng số đang hiện trên màn hình, thêm chữ "Demo thu nhỏ 10 lần vì giới hạn faucet" lên hình và thêm câu đó vào đầu cảnh 1. Các số khác (trần thăm, quỹ lãi, quỹ dự phòng) chia 10 và làm tròn xuống 6 chữ số, phải đối chiếu với màn hình lúc quay trước khi chốt lời.

## 2. Bảng cảnh

| # | Thời gian | Màn hình và hành động | Lời thoại | Số tiền hiện ra | Chữ trên hình | Số từ |
|---|---|---|---|---|---|---|
| 1 | 0:00-0:24 | Logo HụiSafe, nền S01 Đăng nhập mờ. Dải băng chế độ demo bám trên cùng. Người nói hiện mặt hoặc chỉ giọng (không dùng ảnh người thử nghiệm) | "Trước khi bắt đầu, chúng em xin khai báo dev toggle: bản demo chạy ở chế độ demo trên Avalanche Fuji testnet. Thời gian được tua nhanh: mỗi kỳ hụi 3 phút thay vì 30 ngày, ân hạn 2 phút thay vì 48 giờ; trần lãi và lãi chậm góp vẫn tính như kỳ 30 ngày. Tiền trong demo là USDC thử nghiệm, không có giá trị, và sản phẩm không sinh lãi." (nguyên văn docs/12 mục 1) | Không có | Dải băng: "Chế độ demo: 1 kỳ = 3 phút, lãi tính như hụi tháng. Ân hạn 2 phút. Tiền là USDC thử nghiệm trên Fuji, không có giá trị." Dòng phụ: "Phí mạng do relayer HụiSafe trả thay. Ký quỹ không sinh lãi." | 73 |
| 2 | 0:24-0:34 | Ba thẻ chữ nối tiếp (không phải màn hình app) | "Ba vụ vỡ hụi: Bình Thuận hơn 100 tỷ đồng, Trà Vinh 12 năm tù, Tây Ninh gần 500 triệu. Điểm chung: một người cầm tiền của cả dây." | Thẻ 1: hơn 100 tỷ đồng, 167 người bị hại. Thẻ 2: 12 năm tù. Thẻ 3: gần 500 triệu đồng. (đơn vị đồng, số báo nêu; không phải số USDC của sản phẩm) | Nguồn dưới từng thẻ: "Báo Pháp luật, 20/09/2024", "VOV, 13/03/2025", "VietnamPlus, 06/10/2026" | 29 |
| 3 | 0:34-0:47 | Hoạt họa hai cột: "Giữ tiền" gạch chéo, "Bảo lãnh" giữ lại | "Chủ hụi có hai vai: giữ tiền và bảo lãnh. HụiSafe bỏ vai giữ tiền, giữ vai bảo lãnh bằng ký quỹ khóa trong hợp đồng thông minh. Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh." | Không có | "Không cầm tiền. Vẫn bảo lãnh." | 38 |
| 4 | 0:47-1:01 | S03 Tạo dây: người quay gõ ký quỹ 480, đồng hồ chỉ số bảo chứng chạy lên 100%. Mở ngăn kéo S13 Trợ lý chủ hụi: hỏi "Ký quỹ bao nhiêu để bảo chứng 100%?", tool trả 480, có dẫn NĐ 19 Điều 18 khoản 4 và câu miễn trừ | "Dây 5 người, mỗi kỳ 100 USDC. Gõ ký quỹ 480, đồng hồ lên 100 phần trăm. Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc." | N = 5, C = 100 USDC, ký quỹ 480 USDC, chỉ số 100%; rủi ro lớn nhất 600 USDC (nếu màn hình S03 hiện) | "Ký quỹ 480 USDC -> chỉ số 100%". Trên khung trợ lý: "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý." | 41 |
| 5 | 1:01-1:07 | Điện thoại: S05 Trang mời -> S01 Đăng nhập (Google) -> tick đủ 18 tuổi -> ký một lần -> S04 Dây đang gom người hiện tên mới | "Thành viên mới đăng nhập Google, tick đủ 18 tuổi, ký một lần. Không ví, không AVAX." | Không có | "1 chữ ký. 0 AVAX." | 17 |
| 6 | 1:07-1:20 | S06 Phòng bỏ thăm (nộp thăm kín, hiện trần thăm; nút "Sao lưu thăm") -> S07 Kết quả kỳ (kỳ 1). Tua nhanh x4 giữa nộp và chốt | "Kỳ 1. Thăm kín. Trần thăm 6,575342 USDC theo Điều 21, cách hiểu đề xuất, cần luật sư xác nhận. Thăm cao nhất thắng, không bốc thăm. M4 thăm 6, nhận 288,48 USDC, bị giữ lại 80." | Trần thăm kỳ 1: 6,575342 USDC. M4 thăm 6 USDC, nhận 288,48 USDC, tiền giữ lại 80 USDC (kỳ 1: góp 376, tiền công 3,76, quỹ dự phòng 3,76) | "Trần thăm: diễn giải Điều 21, đề xuất, cần luật sư xác nhận". "Tua nhanh x4" | 37 |
| 7 | 1:20-1:39 | S07 Kết quả kỳ (kỳ 2) -> S08 Khoản thiếu (M4 thiếu 100) -> S09 Bảo chứng (thác bù dạng thanh; ký quỹ 460 -> 360 -> 260 -> 160). Dây "Demo Hoàn Tất" đã chạy sáng cùng ngày | "Kỳ 2. M4 đã hốt nhưng không đóng 100 USDC. Hệ thống bù ngay: 80 từ tiền giữ lại của M4, 20 từ ký quỹ. M1 vẫn nhận đủ 323,18. Quá ân hạn, M4 bị ghi vỡ nợ; ký quỹ bù tiếp: 460, 360, 260, 160. Trong kịch bản này, người góp trung thực nhận đủ." | M4 thiếu 100 USDC = 80 (tiền giữ lại) + 20 (ký quỹ). M1 nhận 323,18 USDC. Ký quỹ còn 460, 360, 260, 160 USDC. Tổng M4 gây thiếu: 400 USDC (80 + 320) | "Kịch bản này: người góp trung thực nhận đủ". "Dây đã chạy sáng nay (Fuji)" | 56 |
| 8 | 1:39-1:56 | Ví dụ v1.2, dây hoa hồng trong trần (φ = 50%): S03 Tạo dây (ô hoa hồng, bảng trần thăm) -> S07 Kết quả kỳ 2 -> S12 Tổng kết (cột thưởng đúng hạn). Gắn nhãn "Ví dụ khác" khi chuyển giữa hai dây | "Bản 1.2. Một: hoa hồng chủ hụi nằm trong trần lãi. Ví dụ kỳ 2: thăm cộng hoa hồng là 14,597259, không vượt quỹ lãi 14,794518 USDC. Hai: quỹ dự phòng chia theo đúng hạn. Người trễ một kỳ nhận 3,110115 thay vì 4,146820 USDC; người vỡ nợ nhận 0." | Dây φ = 50%, kỳ 2: thăm thắng 2,4; tiền công 7,397259; thăm x 3 người + tiền công = 14,597259 <= quỹ lãi 14,794518; M1 nhận 321,474741 USDC. Dây ví dụ 8.2 (nhánh A): quỹ dự phòng cuối dây 19,697396 USDC; M4 trễ một kỳ nhận 3,110115, người đúng hạn nhận 4,146820 (M1 4,146821 do dư lẻ) | "Ví dụ khác: hoa hồng 7,397259 + thăm 7,2 = 14,597259 <= 14,794518". "Quỹ dự phòng: M4 trễ 1 kỳ 3,110115 | đúng hạn 4,146820". "Người vỡ nợ: 0" | 50 |
| 9 | 1:56-2:03 | S11 Sổ họ: cuộn bảng dòng, bấm một dòng mở Snowtrace | "Sổ họ theo Nghị định 19 dựng từ sự kiện trên chuỗi. Dòng nào cũng có mã giao dịch trên Snowtrace." | Không có | Link Snowtrace của HuiFactory: `https://testnet.snowtrace.io/address/0x5004477143F8Db65f80992A0BD79c1DAb75C8b21` | 21 |
| 10 | 2:03-2:21 | Chụp màn hình terminal `forge test` (kết quả thật lúc quay) -> S16 Phòng mô phỏng (`/lab`): biểu đồ ba thiết kế, khung "Giả định" mở | "Bằng chứng: 617 bài test hợp đồng, 54 bài bất biến. Mô phỏng 10.000 dây, giả định bỏ đóng theo Klonner và Rai: người hốt sau mất kỳ vọng 0,0003 phần trăm, so với 4,99 phần trăm ở hụi truyền thống. Đây là kết quả của giả định, không phải dự báo." | Mô phỏng baseline (N = 10, C = 100 USDC, seed 42, 10.000 dây): người hốt sau trung thực mất kỳ vọng: truyền thống 4,99%, on-chain đơn giản 6,37%, HụiSafe 0,0003%. Dây có người nhận thiếu: 23,33% / 62,46% / 0,01%. 617 test (54 invariant) | "Mô phỏng với tham số giả định, không phải dự báo." "Giả định: bỏ đóng 2,04% / 0,59% mỗi kỳ (Klonner & Rai 2008), sốc chung 2% x 5." "Test: 10/11/2026" | 52 |
| 11 | 2:21-2:46 | Ba thẻ chữ rồi thẻ pháp lý (lấy từ slide 10 và 11) | "Vì sao on-chain: không ai cầm tiền giữa các kỳ. Vì sao Avalanche: USDC native có permit, phí thấp để relayer trả thay. Tiền từ đâu: từ chính thành viên, không in token. Pháp lý: tiền mã hóa không phải phương tiện thanh toán hợp pháp ở Việt Nam, nên chỉ có USDC testnet. HụiSafe không trả lương, không có cổ phiếu token hóa, không bán token; trợ lý miễn phí, không phải tư vấn." | Không có | Thẻ 1: "Vì sao on-chain?" Thẻ 2: "Vì sao Avalanche?" Thẻ 3: "Tiền từ đâu?" Thẻ pháp lý: 4 điểm BTC (NQ 05/2025 Điều 4.7; BLLĐ 2019 Điều 95.2; Luật Luật sư; không token) | 75 |
| 12 | 2:46-2:50 | Thẻ cuối: logo, link | "Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh." | Không có | `[CHƯA CÓ: link app]` `[CHƯA CÓ: link repo GitHub]` `[CHƯA CÓ: link slide]` | 10 |

Tổng số từ lời thoại: 499 (cảnh 1-12), tương ứng khoảng 166 giây ở 3 từ mỗi giây, cộng khoảng 4 giây chuyển cảnh, ra 2:50. Đọc nhanh hơn thì dư, đọc chậm hơn thì cắt theo mục 3.

## 3. Cắt khi vượt 3:00 (theo thứ tự cắt trước)

1. Cảnh 9 (sổ họ): giữ link Snowtrace ở thẻ cảnh 12, tiết kiệm 7 giây.
2. Cảnh 5 (vào dây): đổi thành một dòng chữ, tiết kiệm 6 giây.
3. Câu trợ lý ở cảnh 4 (chỉ giữ cảnh S03), không cần cắt lời vì lời không nhắc trợ lý.

Không cắt: cảnh 1 (khai báo dev toggle), cảnh 7 (bù vỡ nợ), cảnh 11 (3 câu hỏi và 4 điểm luật). `docs/11` mục 7 ghi đây là phần không bao giờ cắt.

## 4. Bảng nguồn số trong video

| Số (cảnh) | Nguồn | Ngày, ghi chú |
|---|---|---|
| 3 phút/kỳ, 30 ngày, 2 phút, 48 giờ (1) | docs/12 mục 1; docs/03 mục 3.3 | Chế độ demo |
| Hơn 100 tỷ đồng, 167 người bị hại (2) | docs/12 mục 2 slide 2; Báo Pháp luật | 20/09/2024. Chưa mở lại bài báo ở lượt viết này |
| 12 năm tù (2) | docs/12 mục 2 slide 2; VOV | 13/03/2025 |
| Gần 500 triệu đồng (2) | docs/12 mục 2 slide 2; VietnamPlus | 06/10/2026 |
| N = 5, C = 100, ký quỹ 480, CI 100% (4) | docs/03 mục 8; mục 2.3 | O_max = 2 x 3 x 100 = 600; CI = 20% + 480/600 |
| 6,575342 (6) | docs/03 mục 8, bảng trần thăm | Kỳ 1 |
| 288,48; 80; 376; 3,76 (6) | docs/03 mục 8, bảng Kỳ 1 | |
| 80 + 20; 323,18; 460, 360, 260, 160; 400 (7) | docs/03 mục 8, Kỳ 2 và nhánh B | Nhánh B: 80 từ holdback + 320 từ ký quỹ |
| 2,4; 7,397259; 14,597259; 14,794518; 321,474741 (8) | docs/03 mục 8.1, bảng Kỳ 2 | φ = 5000, feeBps = 300 |
| 19,697396; 3,110115; 4,146820; 4,146821 (8) | docs/03 mục 8.2 (vector V1) | Quỹ dự phòng cuối dây, nhánh A |
| Vỡ nợ nhận 0 (8) | docs/03 mục 5.3 bước 5; INV-12 | w = 0 khi vỡ nợ |
| 617 test, 54 invariant (10) | docs/TIEN-DO.md (cập nhật 10/11/2026) | Phải chạy lại `forge test` và thay số nếu khác lúc quay |
| 0,0003%; 4,99%; 6,37% (10) | sim/outputs/baseline.json, trường `lateReceiverExpectedLossPct` (0,000324; 4,987086; 6,37065) | Sinh 08/11/2026, seed 42, 10.000 dây. Mô phỏng, giả định |
| 0,01%; 23,33%; 62,46% (10) | baseline.json, trường `circleFailureProb` (0,0001; 0,2333; 0,6246) | Như trên |
| 2,04%, 0,59%, sốc 2% x 5 (10) | sim/scenarios/baseline.json; docs/08 mục 2.2, 2.3 | Giả định lấy cảm hứng từ Klonner & Rai (2008); baseline đọc hai số này là xác suất MỖI KỲ (bi quan, gấp khoảng 8,3 lần mốc nguồn theo docs/08 mục 2.2) |
| Địa chỉ HuiFactory (9) | contracts/deployments/fuji.json | Deploy 10/11/2026, commit 494e923 |

## 5. Kiểm tra trước khi quay

- Dev toggle: có (cảnh 1, nguyên văn docs/12 mục 1; thêm dòng phụ về relayer và ký quỹ không sinh lãi).
- Ba câu hỏi (on-chain, Avalanche, tiền từ đâu): có (cảnh 11, cộng cảnh 3).
- Bốn điểm luật: có (cảnh 11: tiền mã hóa/VND; lương; tư vấn có phí; cổ phiếu token hóa/không token).
- Điều 21 kèm "đề xuất, cần luật sư xác nhận": có (cảnh 6, cả lời và chữ).
- Cảnh v1.2: có (cảnh 8: hoa hồng trong trần, quỹ dự phòng chia theo đúng hạn).
- Số mô phỏng ghi là kết quả của giả định, không phải dự báo: có (cảnh 10, lời và chữ).
- Chưa dùng ảnh, tên, giọng người thử nghiệm: đúng (docs/11 mục 11 yêu cầu phiếu đồng ý trước; buổi thử chưa diễn ra).
- Cần người làm trước khi quay: (a) chạy lại `forge test` và thay số 617/54 nếu khác; (b) xác nhận dây φ = 50% đã tạo trên Fuji (TIEN-DO nói script `CreateDemoCircles` có dây Bidding φ = 5000, chưa nói đã chạy), nếu chưa thì cảnh 8 quay trên anvil và phải ghi "chạy cục bộ"; (c) thay ba link ở cảnh 12.
