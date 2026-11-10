NHÁP chờ Towfienes duyệt

# Dàn ý slide HụiSafe (12 slide)

Viết ngày 11/11/2026 (B14, pitch). Nền: `docs/12-pitch-demo-nop-bai.md` mục 2, cập nhật theo v1.2. Mỗi slide một ý. Mỗi slide có: tiêu đề, nội dung trên slide, lời nói ngắn, gợi ý hình, nguồn của từng số.

**Quy ước số.** Số mô phỏng là kết quả của giả định (hazard Klonner & Rai, thăm 50% trần thực thi), không phải dự báo, và luôn có nhãn đó trên slide. Số ví dụ N = 5, C = 100 USDC là dây mẫu của docs/03 mục 8; demo live có thể chạy thu nhỏ 10 lần (C = 10), khi đó ghi lên slide "demo thu nhỏ 10 lần vì giới hạn faucet" (docs/12 mục 3.3). Mọi tiền là USDC testnet trên Fuji, không có giá trị.

**Thời lượng gợi ý** (docs/12 mục 2): bản đủ 7:00 gồm demo live 3:00 ở slide 5 và 4:00 cho 11 slide còn lại. Bản 3 phút: slide 1, 2, 3, 5 (clip 0:40), 10 (ba câu), 11, 12.

---

## Slide 1. HụiSafe: chơi hụi không sợ vỡ (0:25)

**Trên slide**
- Tiêu đề: "HụiSafe: hụi bỏ thăm on-chain trên Avalanche"
- Câu chốt: "Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh."
- Track Social finance, đề #01 (Hụi on-chain) nâng cấp. Tên đội và 3 vai: `[CHƯA CÓ: tên đội và tên ba thành viên]`
- Hộp khai báo dev toggle (góc dưới, chữ đọc được): "Chế độ demo trên Avalanche Fuji testnet. 1 kỳ = 3 phút (thật: 30 ngày). Ân hạn 2 phút (thật: 48 giờ). Trần lãi, lãi chậm góp vẫn tính như kỳ 30 ngày. USDC thử nghiệm, không có giá trị. Phí mạng do relayer HụiSafe trả. Ký quỹ không sinh lãi."

**Lời nói.** Đọc nguyên văn docs/12 mục 1: "Trước khi bắt đầu, chúng em xin khai báo dev toggle: bản demo chạy ở chế độ demo trên Avalanche Fuji testnet. Thời gian được tua nhanh: mỗi kỳ hụi 3 phút thay vì 30 ngày, ân hạn 2 phút thay vì 48 giờ; trần lãi và lãi chậm góp vẫn tính như kỳ 30 ngày. Tiền trong demo là USDC thử nghiệm, không có giá trị, và sản phẩm không sinh lãi." Rồi đọc câu chốt. Nếu demo thu nhỏ: thêm "Demo thu nhỏ 10 lần vì giới hạn faucet."

**Hình.** Logo, dải băng chế độ demo màu nổi (chữ khớp `docs/02` US-10 AC-10.1).

**Nguồn số.** 3 phút, 30 ngày, 2 phút, 48 giờ: docs/12 mục 1, docs/03 mục 3.3.

## Slide 2. Vỡ hụi là chuyện có thật (0:25)

**Trên slide**
- Bình Thuận: hơn 100 tỷ đồng, 167 người bị hại (Báo Pháp luật, 20/09/2024).
- Trà Vinh: hụi Zalo, khống 157 phần hụi, 12 năm tù (VOV, 13/03/2025).
- Tây Ninh: tài khoản Zalo ảo bỏ thăm và hốt, gần 500 triệu đồng (VietnamPlus, 06/10/2026).
- Phía thành viên: ở chit fund Chennai, người hốt sớm bỏ đóng 2,04%, hốt muộn 0,59% (Klonner & Rai, 2008; tỷ lệ trên mỗi khoản vay trong cả vòng đời dây, dữ liệu Chennai chứ không phải hụi Việt Nam).

**Lời nói.** "Ba vụ, một điểm chung: một người cầm tiền của cả dây. Và ngay cả khi chủ hụi tử tế, người hốt sớm vẫn có thể bỏ đóng, người hốt sau gánh lỗ."

**Hình.** Ba thẻ tin, dưới mỗi thẻ ghi nguồn và ngày. Không dùng tên người trong các vụ án.

**Nguồn số.** Bốn dòng trên: docs/12 mục 2 (slide 2) và mục 9 (liên kết Báo Pháp luật, VOV, VietnamPlus, PDF Klonner & Rai). 2,04% và 0,59% là tỷ lệ trọn đời theo docs/08 mục 2.2. Chưa mở lại các bài báo ở lượt viết này, cần mở xác nhận trước khi dựng slide.

## Slide 3. Chủ hụi có hai vai (0:20)

**Trên slide**
- Hai cột. Giữ tiền: gốc của ôm tiền, hụi ảo, hụi chồng hụi. Bảo lãnh: bù khi người đã hốt bỏ đóng (Nghị định 19/2019/NĐ-CP Điều 18 khoản 4).
- Hụi on-chain thông thường: bỏ cả hai vai, nên người hốt sau gánh rủi ro.
- HụiSafe: bỏ vai giữ tiền, giữ vai bảo lãnh bằng ký quỹ khóa trong hợp đồng.

**Lời nói.** "Các bản hụi on-chain trước đây bỏ luôn người chủ hụi, nên không còn ai bù cho người hốt sau. Chúng em giữ lại đúng phần tốt của chủ hụi."

**Hình.** Hai cột, cột "Giữ tiền" gạch chéo, cột "Bảo lãnh" tô đậm.

**Nguồn số.** Không có số. Luận điểm: docs/03 (đầu file); điều luật: docs/10 mục 1 dòng 18.4.

## Slide 4. Một kỳ HụiSafe chạy thế nào (0:30)

**Trên slide**
1. Tiền ở ví từng người. Vào dây ký một lần, cho phép trích đúng (N - 1) x (C + cọc mở thăm): dây mẫu 404 USDC.
2. Nộp thăm kín, mở thăm. Thăm cao nhất thắng, không bốc thăm. Trần thăm theo Điều 21 (cách hiểu đề xuất, cần luật sư xác nhận).
3. Hợp đồng kéo tiền góp và chi người hốt trong một giao dịch (`settleRound`).
4. Có người thiếu: bù ngay theo thác: tiền giữ lại của chính họ, ký quỹ, quỹ dự phòng, sau cùng là khoản đòi công khai.
5. Chỉ số bảo chứng hiện trước khi vào dây. Dây mẫu N = 5, C = 100 USDC: rủi ro lớn nhất 600 USDC; giữ lại 20% cộng ký quỹ 480 USDC = 100%.

**Lời nói.** "Không ai bốc thăm, không ai bấm chi. Đến giờ là hợp đồng tự chạy, ai gọi cũng được. Dây 5 người, 100 USDC: rủi ro lớn nhất là 600 USDC. Giữ lại 20% cộng ký quỹ 480 là 100%. Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc."

**Hình.** Sơ đồ ngang 5 hộp (mermaid ở docs/12 slide 5): Vào dây, Thăm, settleRound, Bù ngay, Sổ họ.

**Nguồn số.** 404 = (5 - 1) x (100 + 1): docs/03 mục 2.6 và docs/12 mục 3.3. 600 = 2 x 3 x 100: docs/03 mục 2.1. 480, 20%, 100%: docs/03 mục 2.3 và mục 8. Chỉ có điều kiện "cú sốc đồng thời" là cam kết (docs/03 mục 7.3).

## Slide 5. Demo (3:00 live, hoặc clip 1:00) (3:00)

**Trên slide** (nền demo; số của dây mẫu N = 5, C = 100 USDC)
- Kỳ 1: M4 thăm 6 (trần 6,575342) thắng, nhận 288,48, bị giữ lại 80.
- Kỳ 2: M4 không đóng 100. Bù 80 từ tiền giữ lại của M4 và 20 từ ký quỹ. M1 nhận đủ 323,18.
- Quá ân hạn: M4 bị ghi vỡ nợ. Ký quỹ: 460, 360, 260, 160.
- Dòng cuối: "Trong kịch bản này, người góp trung thực nhận đủ."

**Lời nói.** Theo bảng bấm giờ docs/12 mục 3.2.

**Hình.** Ảnh chụp S07 Kết quả kỳ, S09 Bảo chứng, S11 Sổ họ của dây "Demo Hoàn Tất".

**Nguồn số.** docs/03 mục 8 (bảng trần thăm, Kỳ 1, Kỳ 2, nhánh B). Nếu demo C = 10: 28,848; 32,318; ký quỹ 48 và còn 16; thăm thắng 0,6 (docs/03 mục 8, phần thu nhỏ).

## Slide 6. Mới ở bản 1.2 (0:30)

**Trên slide**
- Hoa hồng nằm trong trần lãi. Chủ hụi nhận tối đa φ phần của quỹ lãi luật cho phép (φ tối đa 50%), người bỏ thăm giữ phần còn lại. Dù hoa hồng tính riêng hay tính gộp vào lãi, người hốt không trả quá trần. Trần theo Điều 21 là cách hiểu đề xuất, cần luật sư xác nhận.
- Ví dụ φ = 50%, kỳ 2: thăm thắng 2,4; tiền công 7,397259; thăm x 3 người + tiền công = 14,597259, không vượt quỹ lãi 14,794518 USDC. Thăm 3,3 ở kỳ 1 bị chặn (trần thực thi 3,287671).
- Chân chủ hụi hốt: tiền công bằng 0. Kỳ không có người thiếu: tiền công trả ngay chủ hụi; kỳ có người thiếu: giữ chờ.
- Tất toán có thưởng đúng hạn: quỹ dự phòng cuối dây chia theo số kỳ đóng đúng hạn. Ví dụ: M4 trễ một kỳ nhận 3,110115, người đúng hạn nhận 4,146820 USDC. Người vỡ nợ nhận 0.
- Thỏa thuận dây có mã băm bất biến (`termsHash`), nhân thân ở ngoài chuỗi.

**Lời nói.** "Chủ hụi cũng phải sống được, nhưng không được ăn vào trần lãi của người hốt. Và ai đóng đúng hạn thì được chia nhiều hơn ở cuối dây."

**Hình.** Hai khung: bảng "thăm + hoa hồng <= quỹ lãi" (kỳ 2) và cột "đúng hạn / trễ một kỳ" (quỹ dự phòng).

**Nguồn số.** docs/03 mục 2.7 và mục 8.1 (kỳ 1: bidCap 3,287671; kỳ 2: 2,4, 7,397259, 14,597259, 14,794518). Quỹ dự phòng: docs/03 mục 8.2 (vector V1: 3,110115; 4,146820; quỹ 19,697396). Vỡ nợ w = 0: docs/03 mục 5.3 bước 5, INV-11, INV-12.

## Slide 7. Bằng chứng: kiểm thử và mô phỏng (0:30)

**Trên slide**
- Bảng mô phỏng (N = 10, C = 100 USDC, 10.000 dây, seed 42), ba thiết kế:

| | Truyền thống | On-chain đơn giản | HụiSafe |
|---|---|---|---|
| Người hốt sau trung thực mất, trung bình | 4,99% | 6,37% | 0,0003% |
| Mất ở mức xấu (phân vị 95) | 24,04% | 23,90% | 0,00% |
| Dây có người nhận thiếu | 23,33% | 62,46% | 0,01% |
| Khoản không bù được, trung bình (USDC) | 58,42 | 313,89 | 0,03 |

- Chân bảng, chữ đậm: "Kết quả của giả định, không phải dự báo. Giả định: người hốt bỏ đóng 2,04% (sớm) và 0,59% (muộn) MỖI KỲ, lấy cảm hứng từ Klonner & Rai (2008); sốc chung 2% x 5; thăm ngẫu nhiên dưới trần. Cách đọc mỗi kỳ là kịch bản bi quan."
- Bản hiệu chỉnh (hazard quy đổi khoảng 0,29% mỗi kỳ): HụiSafe 0,00% tổn thất và 0,00% dây có người nhận thiếu; truyền thống 3,82% và 9,42%; on-chain đơn giản 1,06% và 26,81%.
- Kiểm thử (10 đến 11/11/2026): 617 forge test, trong đó 54 bài bất biến; sdk 105, web 352, keeper 18 test; Slither mức cao 0; rà soát bảo mật nội bộ không còn Critical, High, Medium. Chưa có audit độc lập.
- Chạy thật trên Fuji (11/11/2026): dây Fixed N = 3 `0xABA89dFfA4e157927710419b01C32bD307bF2461` chạy trọn trên Fuji ngày 11/11/2026: vào dây qua relay (thành viên không cần AVAX), keeper chốt 3 kỳ (`0xecfcfaeb…4669`, `0xc7e8f352…c4bb`, `0xba1208d7…79d6`) và `finalize` (`0x7159ec48…b290`); trạng thái Completed, 3 kỳ đã chi, số dư USDC của dây về 0 (đọc lại bằng lệnh chỉ đọc). Hash viết tắt theo `docs/TIEN-DO.md`; tra đủ trên Snowtrace theo địa chỉ dây.
- Người dùng thật thử: chưa có số (kế hoạch 15-16/11, `docs/11` mục 11).

**Lời nói.** "Trong cùng giả định, hụi truyền thống có 23% dây khiến ai đó nhận thiếu, on-chain đơn giản 62%, HụiSafe 0,01%. Đây là kết quả của giả định, không phải dự báo."

**Hình.** Biểu đồ cột `sim/outputs/baseline_loss.png` (kèm chú thích giả định và seed) và bảng trên.

**Nguồn số.** `sim/outputs/baseline.json` (sinh 08/11/2026), `baseline.meta.json` (seed 42, 10.000 dây, commit 9699239; khoảng tin cậy 95% của HụiSafe: dây nhận thiếu 0,0018% đến 0,0566%). Bản hiệu chỉnh: `baseline_calibrated.json`; phép quy đổi hazard: docs/08 mục 2.2. Truyền thống: xác suất chủ hụi bỏ trốn 0,5% mỗi kỳ và ngân sách bù 30% rủi ro đỉnh là giả định không có số đo (docs/08 mục 9, điểm 4). Test: docs/TIEN-DO.md (10/11/2026).

## Slide 8. Chủ hụi lời ở đâu? (0:30)

**Trên slide**
- Tiền công sau rủi ro của chủ hụi, tính trên ký quỹ, quy theo năm (mô phỏng, hazard giả định; trong ngoặc: hazard giảm một nửa). N người, C = 100 USDC, ký quỹ cho chỉ số 100%.

| Chu kỳ, N | Cố định 1% (v1.1) | φ = 33% | φ = 50% |
|---|---|---|---|
| Tuần, 5 người | 14,97% (29,15%) | -19,64% (-5,65%) | -15,51% (-1,50%) |
| Tháng, 5 người | 3,40% (6,71%) | 1,75% (5,04%) | 5,19% (8,51%) |
| Tháng, 10 người | 1,50% (3,42%) | 3,88% (5,83%) | 5,24% (7,19%) |
| Thăm + hoa hồng trong trần lãi? | Không, ở cả 8 dây | Có | Có |

- Hụi tháng 10 người, φ = 50%: hoa hồng cả dây 150,37 USDC, ròng sau rủi ro 86,16 USDC; người hốt kỳ 1 ròng -59,07, kỳ 10 ròng +18,38 USDC. Với φ > 0, người hốt ở 1/3 cuối không lỗ ở cả 16 dây trong bảng.
- Nói thẳng: hụi tuần ít người, chủ hụi lỗ sau rủi ro; giao diện sẽ cảnh báo. Ở baseline (N = 10, hazard bi quan, tiền công cố định 1%) chủ hụi HụiSafe -8,60% trên ký quỹ, tính cho cả dây, không quy theo năm.
- Không hứa lời cho chủ hụi.

**Lời nói.** "Cố định 1% trông cao ở hụi tuần vì nó ăn vượt trần lãi của người hốt. Đưa hoa hồng vào trong trần thì chủ hụi hụi tháng còn khoảng 5% một năm trên vốn khóa, ở giả định này, và chịu lỗ ở hụi tuần ít người. Số này nhạy với giả định."

**Hình.** `sim/outputs/organizer_economics.png`, kèm nhãn "Kết quả mô phỏng với tham số giả định, không phải dự báo."

**Nguồn số.** `sim/outputs/organizer_economics.json` (sinh 10/11/2026; trường `annualReturnPctByHazardScale`, `grossFeeUsdc`, `netAfterRiskUsdc`, `firstSeatNetUsdc`, `lastSeatNetUsdc`, `insideInterestCap`, `lastThirdNeverLoses`) và `.meta.json` (giả định: hazard Klonner & Rai áp một lần, thăm 50% trần thực thi, không dùng số ngẫu nhiên). Bảng đầy đủ 24 ô: docs/08 mục 2.7. Baseline -8,60%: `baseline.json`, `organizerNetReturnPct`.

## Slide 9. Hai giới hạn nói thẳng: ví ảo và bỏ đóng lần lượt (0:30)

**Trên slide**
- Cam kết: "Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản (OTP, attestation), và mọi người thấy trước rủi ro tối đa của mình."

| Dây mẫu N = 5, C = 100 | Chủ hụi (USDC) | Không bù được (USDC) | Người hốt kỳ 5 nhận (USDC) |
|---|---|---|---|
| 1 ví ảo, cọc 100% | -18,04 | 0 | 392 |
| 2 ví ảo, cọc 100% | +41,47 | 56,56 | 336,57 |
| 1 ví ảo, cọc 50% (luật cũ v1.1) | +120,76 | 120,51 | 297,68 |

- Chỉ số 100% là cho cú sốc đồng thời. Nếu người đã hốt bỏ đóng lần lượt: dây mẫu thiếu tổng cộng 1.000 USDC so với rủi ro đỉnh 600; kỳ 5 còn khoản không bù được 304 USDC, người hốt cuối nhận 94,08 thay vì 392. Bù đủ cần ký quỹ 800 (tùy chọn, roadmap).
- Mô phỏng (N = 10, C = 100, ký quỹ 0,8 x rủi ro đỉnh): gọi q là tỷ lệ người hốt ở nửa đầu dây bỏ đóng. Cùng bỏ trong CÙNG một kỳ, q = 25%, 50%, 100%: 0% dây có khoản không bù được. Bỏ đóng lần lượt, mỗi người ngay sau kỳ mình hốt: 15,43% dây ở q = 50% và 100% dây ở q = 100%.

**Lời nói.** "Chúng em không nói cọc 100% là hết gian lận. Một ví ảo thì chủ hụi tự lỗ. Hai ví ảo thì lời, nên phải chặn bằng xác thực mỗi người một tài khoản. Và nếu người đã hốt bỏ đóng lần lượt, ký quỹ có thể không đủ. Chúng em nói trước điều đó."

**Hình.** Hai biểu đồ: `sim/outputs/organizer_sybil.png` và `sim/outputs/inv08_uncovered.png`.

**Nguồn số.** Bảng ví ảo: `sim/outputs/organizer_sybil.json` (trường `organizerNetUsdc`, `uncoveredUsdc`, `lastReceiverPayoutUsdc`; sinh 10/11/2026; khớp docs/03 mục 7.3 vector V4). 1.000, 600, 304, 94,08, 392, 800: docs/03 mục 7.3 (phản ví dụ và cận B_seq). Mô phỏng bỏ đóng: `sim/outputs/inv08.json` (kịch bản `peak_all_at_once`, `peak_sequential`, bondRatio 0,8; sinh 08/11/2026); giả định hành vi (người bỏ đóng theo lịch cố định).

## Slide 10. Ba câu bắt buộc (0:40)

**Trên slide**
- **Vì sao on-chain?** Hụi cần tin người giữ tiền. App dùng database chỉ đổi người giữ tiền từ chủ hụi sang chúng em. Ở đây tiền không qua tay ai giữa các kỳ, ký quỹ bị khóa bằng code, luật không đổi sau khi dây bắt đầu, sổ họ có mã giao dịch (Nghị định 19 Điều 12, 13).
- **Vì sao Avalanche?** USDC native của Circle có permit: góp tiền chỉ ký một lần. Phí đủ thấp để relayer trả thay, người dùng không cần AVAX. Giao dịch chốt dưới 1 giây (theo Avalanche). Một kỳ N = 5 tốn khoảng 520.000 gas thực thi khi không ai thiếu (đo bằng test). Về sau: mỗi hội một L1 riêng.
- **Tiền từ đâu?** Tiền hốt là tiền góp của chính thành viên. Tiền thăm do người hốt sớm trả, nằm trong trần Điều 21. Tiền công chủ hụi: dây hoa hồng trong trần (φ > 0) nằm trong trần đó và tối đa 3% mỗi pot; dây φ = 0 là 1% mỗi pot cố định. Quỹ dự phòng 1% mỗi pot, cuối dây chia theo đúng hạn. Ký quỹ là tiền của chủ hụi, dùng đến đâu mất đến đó. Bản này không sinh lãi; mainnet có thể dùng Aave v3 (roadmap). Không token, không bán token.

**Lời nói.** "Không có đồng nào từ trên trời rơi xuống. Bài toán của hụi là niềm tin vào người giữ tiền; ở đây không có người giữ." Rồi dẫn câu của đề: "Low transaction fees mean a group of 10-20 people paying weekly does not lose the pot to fees. Native USDC on the C-Chain."

**Hình.** Ba cột. Cột Avalanche theo 5 phần điểm (docs/12 slide 9): dùng có ý nghĩa; smart contract thật (`HuiFactory`, `HuiCircle` clone EIP-1167, `ReputationRegistry`, `HuiMath`); hạ tầng; chất lượng tích hợp; giá trị.

**Nguồn số.** 520.000 gas: docs/04 mục 7.1 (số đo A7, `settleRound` N = 5 không thiếu ~520.000, gas thực thi chưa gồm 21.000 intrinsic; test `GasBudget.t.sol`). Phí quy ra tiền: chưa đo trên Fuji; docs/06 ước tính N = 30 tối đa khoảng 0,065 USD ở giá 05/11/2026 (suy ra, cần đo lại). Finality dưới 1 giây: trang hiệu năng Avalanche (docs/12 mục 9, trang không ghi ngày). Tiền công tối đa 3%, quỹ 1%: docs/03 mục 3.1. Ba câu trả lời: docs/00, docs/12 slide 8-10, docs/HUISAFE_GIAI_THICH.md mục 6.

## Slide 11. Pháp luật Việt Nam (0:30)

**Trên slide**

| Điểm BTC yêu cầu | HụiSafe |
|---|---|
| Tiền mã hóa không phải phương tiện thanh toán hợp pháp | Chỉ USDC testnet, không nhận tiền thật. Nghị quyết 05/2025/NQ-CP Điều 4 khoản 7: giao dịch, thanh toán tài sản mã hóa phải bằng đồng Việt Nam. Hướng thật: chế độ VND (roadmap) |
| Lương phải trả bằng VND | Không áp dụng: HụiSafe không trả lương (Bộ luật Lao động 2019 Điều 95 khoản 2, cần kiểm tra lại trên vbpl.vn) |
| Tư vấn có thu phí cần giấy phép | Trợ lý miễn phí, chỉ tính và trích dẫn, luôn ghi "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý" |
| Cổ phiếu token hóa bị chặn theo khu vực | Không áp dụng: không có cổ phiếu token hóa, không phát hành, không bán token |

- Hụi hợp pháp (Bộ luật Dân sự 2015 Điều 471; Nghị định 19/2019/NĐ-CP). Trong code: Điều 5, 6 (đủ 18 tuổi), Điều 12, 13 (sổ họ, biên nhận), Điều 14 (cảnh báo, mẫu thông báo UBND cấp xã), Điều 18 khoản 4 (ký quỹ), Điều 21 (trần thăm), Điều 22 khoản 1 (lãi chậm góp 10% một năm).
- Hai chỗ cần luật sư xác nhận: Điều 21 (công thức trần là cách hiểu đề xuất của nhóm) và Điều 20 (bằng thăm thì bốc thăm; luật cuộc thi cấm ngẫu nhiên nên HụiSafe chia hòa tất định và ghi vào thỏa thuận dây).
- Chưa có luật sư nào xác nhận. HụiSafe chưa được cơ quan nào cấp phép.

**Lời nói.** "Hụi hợp pháp. Tiền mã hóa làm phương tiện thanh toán thì không. Nên hôm nay chỉ có USDC testnet, không nhận tiền thật. Trần thăm và cách chia hòa là cách hiểu của nhóm, đang chờ luật sư xác nhận."

**Hình.** Bảng 4 dòng và một dải "Cần luật sư xác nhận: Điều 20, 21".

**Nguồn số.** Điều khoản và câu nói: docs/10 mục 1, 3, 5 (văn bản kiểm tra 06/11/2026). Mức phạt của Nghị định 284/2026/NĐ-CP (hiệu lực 01/09/2026) không đưa lên slide; chỉ trả lời nếu bị hỏi (docs/10 mục 3). Giá trị pháp lý của chữ ký ví trong sổ họ: câu hỏi mở (docs/10 mục 7, câu 3).

## Slide 12. Lộ trình, đội, đề nghị (0:20)

**Trên slide**
- Lộ trình (kế hoạch, chưa làm): thử testnet với 3-5 nhóm (từ 12/2026); xin ý kiến luật sư về Điều 14, 20, 21; chế độ VND; L1 riêng cho từng hội; mainnet với Safe multisig; bản cho kiều bào sau khi có ý kiến pháp lý ở nước sở tại.
- Đã chạy hôm nay: contract triển khai và xác minh trên Fuji (10/11/2026). `HuiFactory`: `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`. Chưa có: lãi thật, passkey, chế độ VND, mainnet, audit độc lập, thử nghiệm với người dùng thật.
- Đội: P1 contract, P2 giao diện và hạ tầng, P3 mô phỏng, AI, pitch. `[CHƯA CÓ: tên ba thành viên]`
- Đề nghị: mentor pháp lý; giới thiệu 3 nhóm hụi hoặc câu lạc bộ để thử; hướng dẫn nộp Team1 Mini Grant.
- Link: `[CHƯA CÓ: link app]` `[CHƯA CÓ: link repo]` `[CHƯA CÓ: link video]`

**Lời nói.** "Chúng em nói thẳng cái gì chưa có. Việc tiếp theo là ý kiến luật sư và thử với nhóm hụi thật bằng chế độ VND, không phải USDC."

**Hình.** Đường thời gian ngang; mã QR tới Snowtrace của `HuiFactory`.

**Nguồn số.** Địa chỉ, ngày: `contracts/deployments/fuji.json` (deployedAt 2026-11-10T16:49:03Z, gitCommit 494e923). Lộ trình và đề nghị: docs/12 mục 2 (slide 12) và mục 8. Thử người dùng: docs/11 mục 11 (kế hoạch, chưa diễn ra).

---

## Phụ lục. Bảng nguồn tổng hợp

| Số trên slide | Slide | Nguồn | Ngày |
|---|---|---|---|
| 3 phút, 30 ngày, 2 phút, 48 giờ | 1, 5 | docs/12 mục 1; docs/03 mục 3.3 | |
| 100 tỷ, 167 người, 157 phần hụi, 12 năm tù, gần 500 triệu | 2 | docs/12 mục 2 và 9 (Báo Pháp luật, VOV, VietnamPlus) | 20/09/2024; 13/03/2025; 06/10/2026 |
| 2,04%, 0,59% | 2, 7 | docs/12 slide 2; docs/08 mục 2.2; Klonner & Rai (2008) | |
| 404, 600, 480, 20%, 100% | 4 | docs/03 mục 2.1, 2.3, 2.6, 8 | |
| 6,575342; 288,48; 80; 323,18; 20; 460, 360, 260, 160; 28,848; 32,318; 48; 16; 0,6 | 5 | docs/03 mục 8 | |
| 2,4; 7,397259; 14,597259; 14,794518; 3,3; 3,287671 | 6 | docs/03 mục 8.1 | |
| 3,110115; 4,146820 | 6 | docs/03 mục 8.2 | |
| 4,99; 6,37; 0,0003; 24,04; 23,90; 0,00; 23,33; 62,46; 0,01; 58,42; 313,89; 0,03 | 7 | sim/outputs/baseline.json | 08/11/2026 |
| 3,82; 9,42; 1,06; 26,81; 0,00 | 7 | sim/outputs/baseline_calibrated.json | 08/11/2026 |
| 617, 54 | 7 | docs/TIEN-DO.md | 10/11/2026 |
| sdk 105, web 352, keeper 18; dây Fixed Completed trên Fuji | 7 | docs/TIEN-DO.md dòng M3 và dòng Kiểm thử | 11/11/2026 |
| 14,97; 29,15; -19,64; -5,65; -15,51; -1,50; 3,40; 6,71; 1,75; 5,04; 5,19; 8,51; 1,50; 3,42; 3,88; 5,83; 5,24; 7,19; 150,37; 86,16; -59,07; 18,38 | 8 | sim/outputs/organizer_economics.json | 10/11/2026 |
| -8,60 | 8 | sim/outputs/baseline.json (`organizerNetReturnPct`) | 08/11/2026 |
| -18,04; 41,47; 120,76; 0; 56,56; 120,51; 392; 336,57; 297,68 | 9 | sim/outputs/organizer_sybil.json | 10/11/2026 |
| 1.000; 600; 304; 94,08; 800 | 9 | docs/03 mục 7.3 | |
| 0%; 15,43%; 100% | 9 | sim/outputs/inv08.json | 08/11/2026 |
| 520.000 gas | 10 | docs/04 mục 7.1 (đo A7) | |
| 3%, 1% | 10 | docs/03 mục 3.1 | |
| Địa chỉ HuiFactory, 10/11/2026 | 12 | contracts/deployments/fuji.json | 10/11/2026 |

## Kiểm tra

- Dev toggle ở slide 1 (hộp và lời nguyên văn): có.
- Ba câu hỏi: có (slide 10; slide 3 và 4 làm nền).
- Bốn điểm luật Việt Nam: có (slide 11).
- Điều 21 kèm "đề xuất, cần luật sư xác nhận": có (slide 4, 6, 11).
- Số mô phỏng ghi là kết quả của giả định: có (slide 7, 8, 9).
- Các cụm bị cấm theo `docs/02` mục 8 và skill `vn-legal-pitch` mục 5 (hứa lời, tuyệt đối hóa độ an toàn, "chặn gian lận", gọi trợ lý là luật sư): không có (đã tìm bằng grep sau khi viết; chữ "ngẫu nhiên" chỉ xuất hiện khi giải thích luật cuộc thi và mô hình mô phỏng).
