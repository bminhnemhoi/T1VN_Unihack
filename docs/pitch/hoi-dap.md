NHÁP chờ Towfienes duyệt

# Hỏi đáp giám khảo HụiSafe: 15 câu

Viết ngày 11/11/2026 (B14, pitch). Nền: `docs/12-pitch-demo-nop-bai.md` mục 7 (20 câu cũ), cập nhật theo bản v1.2 và số liệu đã có. Mỗi câu: trả lời 2-4 câu, dòng "Nguồn:". Chỗ chưa đo thì ghi "chưa đo".

**Hai câu cam kết phải thuộc** (docs/03 mục 7.3), dùng nguyên văn:
- (a) "Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc."
- (b) "Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản (OTP, attestation), và mọi người thấy trước rủi ro tối đa của mình."

**Quy ước.** Số mô phỏng là kết quả của giả định, không phải dự báo. Tiền là USDC testnet trên Fuji, không có giá trị. Không nói "luật sư", không nói đã được cấp phép hay đã được luật sư xác nhận.

---

## Nhóm pháp lý và thị trường

**1. Hụi on-chain có hợp pháp không? Nghị định 19 nằm ở đâu trong sản phẩm?**
Hụi là giao dịch dân sự hợp pháp (Bộ luật Dân sự 2015 Điều 471; Nghị định 19/2019/NĐ-CP). HụiSafe đưa vào code: đủ 18 tuổi (Điều 5, 6), sổ họ và biên nhận (Điều 12, 13), cảnh báo thông báo UBND cấp xã khi một kỳ từ 100 triệu đồng hoặc chủ hụi từ hai dây (Điều 14), ký quỹ bù phần thiếu (Điều 18 khoản 4), lãi chậm góp bằng 50% mức trần (Điều 22 khoản 1, tham số 10% một năm). Điều 20 và Điều 21 là cách hiểu đề xuất của nhóm, cần luật sư xác nhận. Chưa luật sư nào xác nhận và HụiSafe chưa được cơ quan nào cấp phép.
Nguồn: docs/10 mục 1 (bảng điều khoản) và mục 7 (câu hỏi mở); docs/03 mục 2.4, 2.5.

**2. Tiền mã hóa không phải phương tiện thanh toán ở Việt Nam, sao các bạn dùng USDC?**
Đúng, nên bản này chỉ chạy trên Fuji testnet với USDC testnet không có giá trị, không nhận tiền thật. Nghị quyết 05/2025/NQ-CP Điều 4 khoản 7 yêu cầu giao dịch, thanh toán tài sản mã hóa phải bằng đồng Việt Nam; Nghị định 284/2026/NĐ-CP (hiệu lực 01/09/2026) phạt giao dịch ngoài đơn vị được cấp phép. Hướng cho người cư trú là chế độ VND (tiền qua ngân hàng, chuỗi giữ sổ họ và luật chơi), chưa làm. USDC có thuộc "tài sản mã hóa" theo Nghị quyết 05 hay không: chưa rõ, cần kiểm tra.
Nguồn: docs/10 mục 3 (bảng văn bản) và mục 5, 6.

**3. Bỏ bốc thăm có trái Điều 20 không? Trần thăm có đúng Điều 21 không?**
Điều 20 cho phép "thỏa thuận khác" thay vì bốc thăm, và luật cuộc thi cấm yếu tố ngẫu nhiên. Vì vậy khi thăm bằng nhau, HụiSafe chia hòa tất định (ít lần trễ hơn thắng, rồi nộp thăm sớm hơn) và ghi vào thỏa thuận dây (mã băm `termsHash`). Công thức trần thăm là cách hiểu đề xuất của nhóm, tách riêng trong `HuiMath.maxBid` để thay được ngay; cả hai điểm cần luật sư xác nhận. Kiểm tra bằng Bản án 48/2024/DS-ST: thăm 450.000 đồng nằm dưới trần ước tính 657.534 đồng của dây hụi tháng 25 phần x 2 triệu đồng (ví dụ vụ án, không phải số tiền của sản phẩm).
Nguồn: docs/03 mục 2.4, 6.4; docs/10 mục 1 (dòng Điều 20, 21) và mục 7 (câu 1, 2).

**4. Tiền và lãi đến từ đâu? Có token không? HụiSafe kiếm tiền thế nào?**
Tiền hốt là tiền góp của chính thành viên. Tiền thăm do người hốt sớm trả cho người hốt sau, nằm trong trần. Tiền công chủ hụi tối đa 3% mỗi pot (dây hoa hồng trong trần thì nằm trong trần lãi). Quỹ dự phòng 1% mỗi pot, cuối dây chia theo đúng hạn. Bản này không sinh lãi trên tiền khóa; nếu có sau này, nguồn lãi thật là cho vay như Aave v3 trên mainnet, còn trên Fuji chỉ là giả lập có khai báo. Không token, không bán token. Mô hình doanh thu của HụiSafe chưa chốt: giả thuyết là gói cho hội nhóm thu bằng VND và một phần tiền công (cần kiểm tra pháp lý); chưa có con số.
Nguồn: docs/03 mục 2.6, 2.7, 3.1; docs/12 mục 8; docs/10 mục 5.

## Nhóm kinh tế chủ hụi và an toàn của cam kết

**5. Chủ hụi lời ở đâu? Sao họ chịu ký quỹ?**
Từ tiền công/hoa hồng nằm trong trần lãi. Mô phỏng với hazard giả định: hụi tháng 10 người, φ = 50%, hoa hồng cả dây 150,37 USDC, ròng sau rủi ro 86,16 USDC, khoảng 5,24% một năm trên ký quỹ 2.000 USDC (7,19% nếu hazard giảm một nửa). Hụi tuần 5 người thì chủ hụi lỗ, -15,51% một năm. Số này nhạy với giả định, không phải lời hứa, và chưa đo với chủ hụi thật. Điều 18 khoản 4 vốn đã bắt chủ hụi bù phần thiếu; HụiSafe giới hạn trách nhiệm đó bằng đúng ký quỹ công khai trước (việc giới hạn này cần luật sư xác nhận).
Nguồn: sim/outputs/organizer_economics.json (ô tháng, N = 10, shareBps 5000) và `.meta.json`; docs/08 mục 2.7, 9; docs/10 mục 7 (câu 6).

**6. Chủ hụi dùng ví ảo để lấy tiền thì sao?**
Câu (b). Với một ví ảo hốt kỳ 1 rồi bỏ, cọc 100%, chủ hụi lỗ 18,04 USDC và người hốt kỳ 5 vẫn nhận đủ 392 USDC. Với hai ví ảo, chủ hụi lời 41,47 USDC, có 56,56 USDC không bù được và người hốt kỳ 5 nhận 336,57 thay vì 392. Vì vậy phải chặn nhiều ví ảo bằng xác thực mỗi người một tài khoản; MVP chỉ dùng đăng nhập Privy, tự xác nhận 18 tuổi và attestation một ví một người, không thu CCCD, nên chưa phải kiểm danh tính bằng giấy tờ.
Nguồn: sim/outputs/organizer_sybil.json (các trường `organizerNetUsdc`, `uncoveredUsdc`, `lastReceiverPayoutUsdc`); docs/03 mục 7.3; docs/10 mục 4.

**7. Chỉ số 100% có nghĩa là người góp không thể mất tiền?**
Không. Câu (a): ký quỹ chịu được cú sốc lớn nhất, tức mọi người đã hốt cùng bỏ đóng một lúc. Nếu họ bỏ đóng lần lượt qua nhiều kỳ, tổng thiếu có thể vượt ký quỹ: dây mẫu thiếu 1.000 USDC so với rủi ro đỉnh 600, kỳ 5 còn 304 USDC không bù được, người hốt cuối nhận 94,08 thay vì 392. Người chưa hốt mà bỏ đóng thì ký quỹ chỉ ứng thanh khoản. Bù đủ cả trường hợp lần lượt cần ký quỹ 800 USDC với dây mẫu, tùy chọn ở roadmap, chưa làm. Mô phỏng N = 10: cùng bỏ một kỳ thì 0% dây có khoản không bù được; bỏ lần lượt thì 15,43% dây ở q = 50%.
Nguồn: docs/03 mục 7.3 (phản ví dụ, B_seq); sim/outputs/inv08.json (`peak_all_at_once`, `peak_sequential`, bondRatio 0,8).

**8. Mô phỏng dựa trên giả định gì? Có tin được không?**
10.000 dây mỗi kịch bản, seed 42, ba thiết kế chạy cùng luật kế toán. Tỷ lệ bỏ đóng là giả định lấy cảm hứng từ Klonner & Rai (2008), dữ liệu chit fund Chennai chứ không phải hụi Việt Nam. Baseline đọc 2,04% và 0,59% là MỖI KỲ, bi quan: với người hốt kỳ 1 của dây N = 10, xác suất bỏ trọn đời thành khoảng 16,9%, gấp khoảng 8,3 lần mốc 2,04%; bản hiệu chỉnh (khoảng 0,29% mỗi kỳ) cho HụiSafe 0,00% tổn thất. Xác suất chủ hụi bỏ trốn 0,5% mỗi kỳ và ngân sách bù 30% của hụi truyền thống không có số đo. Kết quả dùng để so sánh thiết kế, không phải dự báo tổn thất thật.
Nguồn: sim/outputs/baseline.json, baseline.meta.json, baseline_calibrated.json; docs/08 mục 2.2 và mục 9.

## Nhóm kỹ thuật và Avalanche

**9. Vì sao on-chain? Làm bằng database có phải đơn giản hơn không?**
Lỗi gốc của hụi là phải tin người giữ tiền. App dùng database thì người vận hành app thành chủ hụi mới. Ở HụiSafe, tiền nằm trong ví từng người và chỉ đi qua hợp đồng trong cùng giao dịch `settleRound`; ký quỹ bị khóa bằng code; admin không có hàm rút tiền (chỉ tạm dừng, mở lại, và dừng khẩn cấp sau 48 giờ qua factory). Sổ họ dựng từ sự kiện, không sửa được, mỗi dòng có mã giao dịch (Điều 12, 13).
Nguồn: docs/00 (Why on-chain); docs/03 mục 4, 5.4, 7.1; INV-07.

**10. Vì sao Avalanche? Gas một kỳ là bao nhiêu?**
USDC native của Circle có `permit` nên góp tiền chỉ ký một lần; phí đủ thấp để relayer trả thay; giao dịch chốt dưới 1 giây theo Avalanche; là EVM nên 3 người làm kịp bằng Foundry; sau này mỗi hội có thể có L1 riêng. Gas thực thi đo bằng test: `settleRound` N = 5 khoảng 520.000 khi không ai thiếu và khoảng 746.000 khi 4 khoản thiếu; N = 30 kỳ cuối ai cũng đóng khoảng 1.486.000 (chưa gồm 21.000 gas cơ bản của giao dịch). Chưa đo phí bằng USD trên Fuji; ước tính của docs/06 là tối đa khoảng 0,065 USD cho N = 30 ở giá ngày 05/11/2026 (suy ra, cần đo lại).
Nguồn: docs/04 mục 7.1 (số đo A7); docs/06 (bảng 5 phần điểm Avalanche); docs/12 mục 2 (slide 9).

**11. Relayer là ai, ai trả gas? Có bị lạm dụng hay kiểm duyệt không?**
Relayer là ví của HụiSafe, trả phí mạng thay người dùng theo ERC-2771; người dùng ký yêu cầu nên relayer không đổi được nội dung. Trên Fuji AVAX của relayer lấy từ faucet. Relayer chỉ gửi lệnh tới dây hợp lệ, hàm nằm trong danh sách, không kèm tiền, gas tối đa 3.000.000 (riêng `settleRound` và `finalize` 5.000.000), 30 yêu cầu mỗi giờ mỗi ví, và mô phỏng trước khi gửi. Rủi ro tập trung có thật, nên luôn có đường "Gửi trực tiếp". Ai trả phí khi chạy thật: chưa chốt.
Nguồn: docs/05 mục 8.2; docs/04 (ADR-04); docs/12 mục 7 (câu 2).

**12. Quyền riêng tư: ai biết tôi chơi hụi?**
Trên chuỗi chỉ có địa chỉ ví, mã băm attestation và mã băm thỏa thuận; không tên, không giấy tờ. Biệt danh chỉ lưu trên máy chủ hụi; trợ lý không nhận dữ liệu cá nhân. Địa chỉ ví và lịch sử góp vẫn công khai, nên chỉ là ẩn danh một phần; liên kết ví với tài khoản chỉ attester biết. Việc địa chỉ ví có là dữ liệu cá nhân khi attester giữ liên kết hay không là câu hỏi mở cho luật sư.
Nguồn: docs/10 mục 4 (Nghị định 356/2025/NĐ-CP Điều 11 khoản 2) và mục 7 (câu 12); docs/05 mục 8.1; docs/03 INV-10.

**13. Ký một lần cho dây trích 404 USDC có nguy hiểm không?**
Chữ ký chỉ cho phép đúng một hợp đồng dây đã xác minh, đúng (N - 1) x (C + cọc) = 404 USDC với dây mẫu, không vô hạn. Mỗi kỳ hợp đồng chỉ kéo phần góp của kỳ đó (INV-04), và không có hàm nào cho admin hay chủ hụi rút tiền. Thu hồi quyền thì khoản đó thành khoản thiếu và đi vào thác bù. Rủi ro còn lại là lỗi hợp đồng: có 617 test (54 bài bất biến), Slither mức cao 0 và rà soát bảo mật nội bộ; chưa có audit độc lập.
Nguồn: docs/03 mục 2.6, 5.1, 7.2 (INV-04, INV-07); docs/TIEN-DO.md (10/11/2026).

**14. AI có cần không?**
Không cần cho luồng chính: tắt AI thì tạo dây, nộp thăm, chi kỳ vẫn chạy. Trợ lý chủ hụi giúp chọn ký quỹ và hiểu Nghị định 19; mọi con số do hàm tất định tính, mô hình chỉ chọn công cụ và giải thích, không ký, không chuyển tiền. Trợ lý miễn phí, gắn nhãn "Trợ lý AI" và luôn ghi "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý". Bộ kiểm tra giả lập đạt 33/33; chưa chạy bộ kiểm tra với mô hình thật.
Nguồn: docs/02 (US-11); docs/05 mục 8.4, 12; docs/TIEN-DO.md (M4); docs/10 mục 4.

## Nhóm hiện trạng

**15. Hôm nay cái gì chạy thật? Người dùng thử nói gì?**
Đã chạy: hợp đồng triển khai và xác minh trên Fuji ngày 10/11/2026 (`HuiFactory` 0x5004…8b21), 617 test. Giao diện đang trong giai đoạn duyệt nội bộ. Chưa có: lãi thật, passkey, chế độ VND, mainnet, audit độc lập, ý kiến luật sư. Thử với người dùng thật dự kiến 15-16/11 (5-10 người, không bỏ tiền thật, có phiếu đồng ý); chưa diễn ra nên chưa có số về thời gian vào dây, tỷ lệ tự làm được, điểm tin tưởng: chưa đo.
Nguồn: contracts/deployments/fuji.json; docs/TIEN-DO.md; docs/11 mục 11.

---

## Bảng nguồn số

| Số | Câu | Nguồn |
|---|---|---|
| 100 triệu đồng, 18 tuổi, 50%, 10% | 1 | docs/10 mục 1; docs/03 mục 2.5 |
| 450.000; 657.534; 25 phần x 2 triệu | 3 | docs/03 mục 2.4 (Bản án 48/2024/DS-ST) |
| 3%, 1% | 4 | docs/03 mục 3.1 |
| 150,37; 86,16; 5,24; 7,19; -15,51; 2.000 | 5 | sim/outputs/organizer_economics.json |
| -18,04; 392; 41,47; 56,56; 336,57 | 6 | sim/outputs/organizer_sybil.json |
| 1.000; 600; 304; 94,08; 392; 800 | 7 | docs/03 mục 7.3 |
| 0%; 15,43% | 7 | sim/outputs/inv08.json |
| 10.000 dây, seed 42, 2,04%, 0,59%, 16,9%, 8,3 lần, 0,29%, 0,5%, 30% | 8 | baseline.meta.json; docs/08 mục 2.2, 9; baseline_calibrated.json |
| 520.000; 746.000; 1.486.000; 21.000; 0,065 USD | 10 | docs/04 mục 7.1; docs/06 |
| 3.000.000; 5.000.000; 30 yêu cầu | 11 | docs/05 mục 8.2 |
| 404 | 13 | docs/03 mục 2.6 |
| 617; 54 | 13, 15 | docs/TIEN-DO.md (10/11/2026) |
| 33/33 | 14 | docs/TIEN-DO.md (M4) |
| 0x5004…8b21; 10/11/2026 | 15 | contracts/deployments/fuji.json |

## Kiểm tra

- Dev toggle: câu 15 và các câu mô phỏng nhắc rõ Fuji, USDC testnet; dev toggle đầy đủ nằm ở video và slide 1.
- Ba câu bắt buộc: câu 9 (on-chain), 10 (Avalanche), 4 (tiền từ đâu).
- Bốn điểm luật BTC: câu 2 (tiền mã hóa), câu 4 (không token), câu 14 (tư vấn có phí); lương: không áp dụng, đã có ở slide 11, thêm khi bị hỏi: "HụiSafe không trả lương" (docs/10 mục 5).
- Điều 21 kèm "đề xuất, cần luật sư xác nhận": câu 1, 3.
- Chỗ chưa đo: phí bằng USD trên Fuji (câu 10), chủ hụi thật (câu 5), eval với mô hình thật (câu 14), thử người dùng (câu 15), ai trả phí khi chạy thật (câu 11).
