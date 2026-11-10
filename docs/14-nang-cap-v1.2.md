# HụiSafe v1.2: giải quyết vấn đề và nâng cấp

Bản bổ sung cho bộ tài liệu v1.1. File này trả lời tài liệu "HụiSafe: câu hỏi, thảo luận và việc cần leader quyết (07/11/2026)" và nâng cấp dự án cho sát đề Topic 1 của UniHack. Khi đưa vào repo, lưu tại `docs/14-nang-cap-v1.2.md`.

| Mục | Nội dung |
|---|---|
| Ngày | 09/11/2026 |
| Trạng thái | Chốt để áp dụng. Điểm ghi "cần xác nhận" chờ luật sư, BTC hoặc buổi phỏng vấn dì |
| Ai áp dụng | Điều phối Claude Code của đội, theo prompt ở mục 10 |
| Khi lệch với v1.1 | File này thắng ở các điểm liệt kê, cho tới khi đã vá xong vào `docs/03` và `docs/05` (mục 6). Sau đó hai file đó lại là nguồn sự thật |
| Giữ nguyên | Kiến trúc, thác bù, thứ tự hoàn, INV-01 đến INV-10, ví dụ số ở `docs/03` mục 8 (trừ dòng chia quỹ dự phòng của nhánh A, xem ADR-24) |
| Quy ước số | Tiền tính bằng USDC (6 chữ số thập phân); dấu phẩy là dấu thập phân |

---

## 0. Tóm tắt

Lời hứa của đề: *"so an organiser can no longer run off with the money"*. v1.1 giữ được lời hứa này ở dây có chỉ số bảo chứng (CI) 100%, nhưng còn bốn chỗ hở:

1. **Dây có CI dưới 100% vẫn bị chủ hụi dùng ví ảo rút tiền.** Ở dây 5 người, CI 50% (ký quỹ 180), chủ hụi cho một ví ảo hốt kỳ 1 rồi bỏ. Kết quả: chủ hụi lời khoảng 120 USDC, người hốt cuối bị thiếu khoảng 125 USDC.
2. **Chủ hụi khóa ký quỹ lớn mà chỉ được tiền công 1%.** Ở dây 12 người, lời kỳ vọng chỉ khoảng 1,3%/năm trên vốn khóa, nên khó có ai chịu làm chủ hụi.
3. **Hai phần MVP bắt buộc của đề yếu hoặc có thể bị cắt.** Phạt trễ tự động gần như không thấy (trễ 1 ngày mất 0,027 USDC). Giao diện chế độ Fixed lại đang nằm trong danh sách cắt.
4. **Admin trên testnet là ví đơn.** Luật cuộc thi lại yêu cầu quỹ gom chung phải đặt sau multisig.

v1.2 xử lý bằng 8 quyết định:

| Ưu tiên | Quyết định | Sửa contract? | Công sức |
|---|---|---|---|
| P0 | ADR-22. CI tối thiểu 100% trên Fuji | Không, chỉ cấu hình deploy | 0,5 giờ |
| P0 | ADR-26. Admin factory là Safe 2/3 ngay trên Fuji | Không, chỉ cách deploy | 0,5 giờ |
| P0 | ADR-28. Bám MVP của đề trên giao diện: giữ Fixed, form 4 trường, hiện chi phí, phạt trễ, lãi thăm | Không, chỉ web | 0,5 ngày |
| P1 | ADR-23. Tùy chọn chủ hụi hốt kỳ đầu | Có, nhỏ | 0,5 đến 1 ngày |
| P1 | ADR-24. Thưởng đúng hạn: chia quỹ dự phòng theo số kỳ đóng đúng hạn | Có, nhỏ | 2 đến 3 giờ |
| P1, tùy chọn | ADR-27. Mã băm thỏa thuận dây lên chuỗi | Có, nhỏ | 3 giờ |
| P2, bonus | ADR-25. Lãi trên ký quỹ của chủ hụi | Có, vừa | 1 ngày, làm sau M3, cắt được |
| Không code | ADR-29. Cắm được attestation của Team1 | Không | Hỏi BTC |

Ngoài 8 quyết định trên, còn hai việc phải làm: chuyển repo sang private và mời `tuantqse90`; vá hai lỗi tài liệu (`docs/02` AC-07.2, và `docs/05` chưa khớp code).

**Kết quả sau nâng cấp:**
- Người góp trung thực không mất tiền ở mọi dây, kể cả khi chủ hụi dùng ví ảo.
- Chủ hụi dây 12 người lời kỳ vọng từ khoảng 1,3% lên khoảng 4,4%/năm khi bật hốt kỳ đầu. Có thêm lãi ký quỹ thì lên khoảng 8,4%/năm.
- Phủ đủ MVP của đề, và có đường cho cả 4 mục bonus. Lãi ký quỹ là P2; attestation Team1 chờ BTC trả lời.

Công sức thêm khoảng 1,5 ngày cho P0 và P1, cộng khoảng 1 ngày nếu làm P2. Đội đang sớm 1 đến 2 ngày so với lịch, nên vẫn kịp mốc đóng băng tính năng 17/11.

### 0.1. Trả lời 7 điểm cần quyết

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Admin là ví đơn, luật cần multisig | Dùng Safe 2/3 trên Fuji, tạo **trước** khi deploy vì admin không đổi được sau deploy (ADR-26) |
| 2 | Thêm luật chủ hụi hốt kỳ đầu? | Có, làm tùy chọn của dây, mặc định tắt (ADR-23). Làm cùng lúc với C6 |
| 3 | Hoa hồng tối đa 3% có thấp không? | Giữ trần 3%, mặc định 1%. Vụ Tây Ninh suy ra tiền thảo khoảng 2,6% pot, nằm trong trần. Tăng mặc định lên 2% thì người hốt cuối dây 5 người chỉ còn lời 0,2%/năm. Số liệu của dì dùng cho pitch |
| 4 | `alphaBps` 20%, `minCoverageBps` 50% | Giữ α 20%. Nâng CI tối thiểu lên 100% (ADR-22) |
| 5 | Bậc uy tín và OTP: bonus hay roadmap? | Roadmap |
| 6 | Đồng bộ `docs/05` với code | Đồng ý, vá theo code hiện tại (mục 6) |
| 7 | Repo đang public | Chuyển private, mời `tuantqse90`; kiểm mọi link (slide, video) mở được cho giám khảo |

Các ý ở mục "Chốt hiện tại" của tài liệu 07/11 vẫn giữ:
- Không đổi luật lõi: v1.2 chỉ thêm một tùy chọn và đổi cách chia quỹ dự phòng cuối dây.
- Ý ở Q6 và Q7 đưa vào slide roadmap.
- Phỏng vấn dì như kế hoạch, thêm câu hỏi ở mục 11.

---

## 1. Phương pháp

1. Đối chiếu từng dòng của đề Topic 1 (MVP, bonus, kiến trúc, ba câu hỏi pitch, luật Việt Nam) với v1.1 (mục 2).
2. Mô hình đe dọa theo vai: chủ hụi, người hốt sớm, ví ảo, admin, relayer. Với mỗi vai, đặt câu hỏi "có lấy được tiền của người khác không?" rồi tính bằng số.
3. Mô phỏng dòng tiền từng người và lãi suất thực (IRR) cho dây 5 và 12 người. Giả định và script ở phụ lục A.
4. Ánh xạ pháp lý theo `docs/10`.
5. Chọn phương án theo thứ tự ưu tiên: an toàn tiền của người góp, bám đề BTC, công bằng giữa các bên, pháp lý, công sức trước 17/11.

Hai lựa chọn khó nhất được chấm như sau (thang 1 đến 5, 5 là tốt nhất):

**Sàn chỉ số bảo chứng**

| Phương án | An toàn | Bám đề | Công bằng | Pháp lý | Công sức | Kết luận |
|---|---|---|---|---|---|---|
| Giữ 50% | 2 | 2 | 3 | 3 | 5 | Loại: chủ hụi còn đường rút tiền |
| 100% cho mọi dây | 5 | 5 | 3 | 4 | 5 | **Chọn** |
| Hai hạng: dây công khai 100%, dây người quen 50% có cam kết | 4 | 4 | 4 | 3 | 2 | Roadmap |

**Cách trả công cho chủ hụi**

| Phương án | An toàn | Bám đề | Công bằng | Pháp lý | Công sức | Kết luận |
|---|---|---|---|---|---|---|
| Tăng tiền công mặc định lên 2–3% | 5 | 4 | 2 | 4 | 5 | Loại: người hốt cuối dây nhỏ hết lời |
| Hốt kỳ đầu theo tập quán | 5 | 4 | 3 | 3 | 4 | **Chọn**, là tùy chọn |
| Lãi trên ký quỹ của chính chủ hụi | 4 | 5 | 5 | 4 | 3 | **Chọn**, là bonus |
| Quỹ bảo hiểm chung cho nhiều dây | 4 | 3 | 4 | 2 | 1 | Roadmap |

---

## 2. Đối chiếu với đề Topic 1

| Đề yêu cầu | v1.1 | v1.2 |
|---|---|---|
| Tạo dây: số người, mức góp, chu kỳ, kiểu chia | Có, form có thêm nhiều tham số nâng cao | Form 2 bước: bước 1 đúng 4 trường của đề, bước 2 "Bảo chứng"; tham số khác ẩn ở "Nâng cao" (ADR-28) |
| Góp tiền, hốt | Có: kéo tiền và chi trong một giao dịch | Giữ |
| Phạt trễ tự động (*"missing a round triggers an automatic penalty"*) | Có nhưng gần như vô hình | Gói phạt trễ nhìn thấy được: lãi chậm góp, mất thưởng đúng hạn, ghi uy tín, thua khi hòa thăm; quá ân hạn thì vỡ nợ (ADR-24) |
| Tất toán, trả lãi thăm | Có: lãi thăm trả ngay mỗi kỳ dưới dạng giảm tiền góp cho người sống | Màn tất toán hiện "lãi thăm đã nhận" của từng người (ADR-28) |
| Dashboard trạng thái từng người, lịch sử giao dịch | Có | Giữ |
| Chế độ Fixed | Contract có; giao diện nằm trong danh sách cắt | Không được cắt; chạy sẵn một dây Fixed (ADR-28) |
| Bonus: thăm kín commit-reveal | Có, nằm trong lõi | Giữ |
| Bonus: sinh lãi phần chưa giải ngân | Bonus cuối danh sách cắt | Lãi trên ký quỹ của chủ hụi (ADR-25) |
| Bonus: mời bằng link | Có | Giữ |
| Bonus: chống tài khoản ảo bằng attestation của Team1 | Attestation do server HụiSafe ký | Cắm được attester của Team1 bằng cấu hình; hỏi BTC (ADR-29) |
| Kiến trúc RoscaFactory, Rosca, frontend ví nhúng | `HuiFactory`, `HuiCircle`, Next.js + Privy | Ghi rõ tương ứng trong README và slide: `HuiFactory` = RoscaFactory, `HuiCircle` = Rosca |
| *"The organiser becomes a contract, so nobody holds the money"* | Contract giữ luật và tiền; người thật rủ người và bảo lãnh | CI 100% bắt buộc nên chủ hụi không chạm được tiền của ai, kể cả qua ví ảo (ADR-22) |
| Why Avalanche: 10–20 người góp hằng tuần không mất tiền vì phí | Có số cho dây 5 người | Thêm số cho dây 20 người góp hằng tuần (mục 8) |
| Ba câu hỏi pitch và luật Việt Nam | Có (`docs/10`, `docs/12`) | Sửa câu "trần 20%/năm"; cập nhật nguồn tiền (mục 8) |

**Vì sao vẫn có chủ hụi người thật khi đề viết "the organiser becomes a contract"?** Contract thay chủ hụi ở hai việc dễ gian lận nhất là cầm tiền và ghi sổ. Người thật chỉ giữ hai việc code không làm được: rủ người vào dây, và đứng ra bảo lãnh bằng ký quỹ. Nghị định 19 Điều 18 khoản 4 cũng giao việc bảo lãnh cho chủ họ. Với ADR-22, người thật này không chạm được tiền của ai.

---

## 3. Vấn đề và cách giải

| # | Vấn đề | Bằng chứng | Mức | Giải bằng |
|---|---|---|---|---|
| V1 | Dây CI dưới 100% cho chủ hụi rút tiền bằng ví ảo (Q6, "hụi ảo") | Dây 5 người, ký quỹ 180 (CI 50%). Ví ảo thắng kỳ 1 với thăm trần, nhận 286,22, rồi bỏ. Chủ hụi lời khoảng 120; người hốt cuối thiếu khoảng 125 | Cao, ngược lời hứa của đề | ADR-22 |
| V2 | Chủ hụi gần như không có lời (Q2) | Dây 12 người: ký quỹ 2.880, tiền công 128 (4,4%/năm); trừ tổn thất kỳ vọng khoảng 90 còn khoảng 1,3%/năm | Cao, khó có người làm chủ hụi | ADR-23, ADR-25 |
| V3 | Người hốt sớm trả lãi cả trên phần tiền bị giữ lại (Q3) | Dây 12 người, thăm nửa trần: chi phí vốn người hốt kỳ 1 tăng từ 24,0% lên 31,7%/năm | Trung bình | Mục 5.2 (chỉnh α), ADR-28 (hiện nhận ngay, nhận dần), roadmap bảo lãnh thay holdback |
| V4 | Phạt trễ gần như vô hình (MVP của đề) | Trễ 1 ngày ở kỳ 100 USDC: lãi chậm góp 0,027397 | Trung bình, giám khảo khó thấy | ADR-24, ADR-28 |
| V5 | Giao diện chế độ Fixed nằm trong danh sách cắt (MVP của đề) | `docs/11` mục 7, dòng 6 | Cao: *"If it cannot be demoed, it is not submitted"* | ADR-28 |
| V6 | Admin là ví đơn | LEADER_BRIEF: "Chỉ gom quỹ khi đề tài yêu cầu, và phải đặt sau multisig" | Cao | ADR-26 |
| V7 | Repo public lộ chiến lược | Trang BTC cho phép repo private nếu mời `tuantqse90` | Trung bình | Chuyển private ngay |
| V8 | `docs/02` AC-07.2 ghi luật cũ về nhả tiền giữ lại khi trả trễ | Mâu thuẫn `docs/03` mục 6.8 bước 4 | Thấp, nhưng agent web sẽ làm sai | Vá (mục 6) |
| V9 | `docs/05` chưa khớp code | Thiếu `NotCircle`, `ZeroAddress`, `InvalidConfig`; mã lỗi 2 chưa ghi mức góp tối thiểu 1 USDC | Thấp | Vá theo code (mục 6) |
| V10 | Câu "trần lãi 20%/năm" dễ bị bắt bẻ | Đọc theo câu chữ Điều 21 (cách nhóm hiểu), lãi thực của người hốt kỳ 1 ở mức trần là khoảng 40–70%/năm (dây 5 đến 25 người) | Trung bình, rủi ro khi pitch | Đổi câu nói (mục 8); hỏi luật sư (mục 11) |
| V11 | "Attestation của Team1" chưa rõ là gì (Q8) | Trang BTC không mô tả | Thấp | ADR-29 |
| V12 | Một người nhiều tài khoản, đổi ví để lách sổ đen (Q6, Q7) | Privy định danh theo email; uy tín ghi theo ví | Trung bình | ADR-22 làm ví ảo vô hại với người góp; phần còn lại để roadmap |

---

## 4. Quyết định

### ADR-22. Chỉ số bảo chứng tối thiểu 100%

- **Bối cảnh.** Với `minCoverageBps = 5000`, chủ hụi được mở dây chỉ bảo chứng một nửa rủi ro đỉnh. Cách tấn công:
  1. Chủ hụi cho một ví ảo vào dây (một tài khoản Google nữa là đủ).
  2. Ví ảo bỏ thăm trần ở kỳ 1. Nếu hòa thăm, ví ảo vẫn thắng vì commit sớm nhất.
  3. Ví ảo hốt rồi bỏ.

  Phần thiếu vượt quá tiền giữ lại và ký quỹ rơi vào những người hốt cuối (bảng ở mục 5.4).
- **Quyết định.**
  - Factory trên Fuji deploy với `minCoverageBps = 10_000`. Code giữ nguyên tham số.
  - Form tạo dây điền sẵn ký quỹ tối thiểu `B_min = ⌈(10_000 − alphaBps) · O_max / 10_000⌉`. Phải làm tròn lên, vì công thức CI chia làm tròn xuống: thiếu 1 đơn vị là CI chỉ đạt 9.999.
- **Hệ quả.**
  - Câu "người góp trung thực không mất đồng nào khi người đã hốt bỏ đóng" đúng với mọi dây, không còn điều kiện. Cùng tấn công trên với ký quỹ 480: chủ hụi lỗ khoảng 18 USDC, không ai bị thiếu.
  - Ký quỹ cần khoảng 1/5 tổng tiền cả dây khi α = 20%. α thấp hơn thì cần nhiều ký quỹ hơn (mục 5.2).
  - Người chưa hốt mà bỏ đóng (Frozen) vẫn tự gánh bằng phần hốt của chính họ (`docs/03` mục 6.6), nên CI không cần tính phần này.
  - Dây người quen chấp nhận CI thấp hơn: để roadmap, kèm màn cam kết "Bạn có thể mất tối đa X USDC".
- **Việc cần làm.** Đổi cấu hình deploy, sửa chữ trong tài liệu (mục 6), thêm test V3 (mục 7). Không sửa contract.

### ADR-23. Tùy chọn chủ hụi hốt kỳ đầu

- **Bối cảnh.** Ngoài đời, chủ hụi thường được trả công bằng tiền thảo, có nơi bằng quyền hốt kỳ đầu không lãi. Các công ty chit fund ở Chennai (Ấn Độ) lấy pot đầu với thăm 0, thu hoa hồng 5–6%, và bắt người hốt sớm có người bảo lãnh ([Klonner & Rai](https://web.williams.edu/Economics/rai/adverse-08-9-1.pdf); [Eeckhout & Munshi](https://pmc.ncbi.nlm.nih.gov/articles/PMC3766900)). v1.1 chỉ có tiền công 1%.
- **Quyết định.** Thêm `CircleParams.organizerTakesFirst` (bool, mặc định false). Luật:
  1. Chỉ hợp lệ khi `organizerIsMember = true`, nếu không thì `InvalidParams(14)`. `activate()` revert `NotMember()` nếu chủ hụi chưa vào dây.
  2. Kỳ 1 không mở thăm: `commitBid` và `revealBid` ở kỳ 1 revert `NotEligibleToBid()`.
  3. `settleRound(1)` chọn chủ hụi, b = 0, tiền công kỳ 1 = 0 (không tự trả công cho mình). Quỹ dự phòng và tiền giữ lại tính như thường.
  4. Từ kỳ 2 dùng luật cũ. Chủ hụi là hụi chết: không được thăm, được nhả tiền giữ lại khi đóng đúng hạn.
  5. Dây Fixed: chủ hụi hốt trước, những người khác hốt theo thứ tự `joinIndex`.
  6. CI, thác bù, các bất biến giữ nguyên, vì chủ hụi chỉ là người hốt kỳ 1.
- **Hệ quả** (số ở mục 5.1).
  - Dây 12 người: chủ hụi được thêm khoảng 90 USDC/năm, lời gộp tăng từ 4,4% lên 7,5%/năm trên ký quỹ. Người hốt cuối giảm từ 8,5% xuống 6,6%/năm.
  - Dây 5 người: người hốt cuối gần như hết lời (5,2% xuống 1,1%/năm). Vì vậy giao diện cảnh báo khi bật tùy chọn này ở dây dưới 10 người.
  - Dây demo chính để tắt, nên ví dụ số không đổi.
- **Pháp lý (cần xác nhận).**
  - Họ có lãi: Điều 20 cho người đưa lãi cao nhất lĩnh họ. Lĩnh kỳ đầu không qua thăm phải ghi trong thỏa thuận dây và hỏi luật sư.
  - Họ không lãi (Fixed): thứ tự lĩnh theo thỏa thuận, nên không vướng.
- **Việc cần làm.** Sửa `HuiTypes`; thêm kiểm tham số ở `HuiFactory`; thêm nhánh kỳ 1 trong `commitBid`, `revealBid`, `settleRound`; xếp thứ tự hốt cho Fixed. Test V2 và T2–T5 (mục 7).

### ADR-24. Thưởng đúng hạn: phạt trễ tự động nhìn thấy được

- **Bối cảnh.** Đề yêu cầu phạt trễ tự động. v1.1 phạt bằng lãi chậm góp theo Điều 22 (10%/năm). Trễ 1 ngày ở kỳ 100 USDC chỉ mất 0,027 USDC, giám khảo khó thấy. Tăng lãi chậm góp cũng không giúp nhiều: kể cả khi thỏa thuận lên bằng trần 20%/năm, trễ 1 ngày chỉ mất khoảng 0,055 USDC.
- **Quyết định.** Bước 5 của `finalize()` chia quỹ dự phòng còn lại theo trọng số đúng hạn, thay vì chia đều:
  - `w_i = (N − 1) − lateCount_i` với thành viên không vỡ nợ; người vỡ nợ có w = 0.
  - `share_i = ⌊R · w_i / Σw⌋`. Phần dư lẻ cho người có `joinIndex` nhỏ nhất trong số những người có w > 0.
  - Nếu Σw = 0 thì chia đều như v1.1.
  - Mỗi khoản phát `ReserveShared(member, amount, weight)`.
- **Gói phạt trễ hiện trên giao diện.** Banner hiện khi trễ, không thêm phí mới, liệt kê:
  1. Lãi chậm góp theo Điều 22, tính tới thời điểm xem.
  2. Mất 1/(N − 1) phần thưởng đúng hạn.
  3. `lateCount` tăng, thua khi hòa thăm.
  4. Bị ghi vào sổ uy tín.
  5. Quá ân hạn thì vỡ nợ: tiền giữ lại bị dùng để bù, mất phần quỹ dự phòng, có khoản nợ công khai.
- **Hệ quả.**
  - Nhánh B của ví dụ số không đổi, vì mọi người còn lại đều đóng đúng hạn.
  - Nhánh A: M4 trễ một kỳ nên nhận 3,110115 thay vì 3,939479 USDC (vector V1).
  - Quy tắc chia phải ghi trong thỏa thuận dây (`docs/10` câu hỏi mở 9).
- **Việc cần làm.** Sửa bước 5 của `finalize`, thêm event và view `onTimeWeight`. Test V1, T6–T8.

### ADR-25. Lãi trên ký quỹ của chủ hụi (bonus "yield on the undisbursed part of the pool")

- **Bối cảnh.** Đây là bonus của đề, và là nguồn thu thêm cho chủ hụi mà không lấy của người góp. Trong HụiSafe, tiền góp không nằm chờ vì được kéo và chi trong cùng một giao dịch. Phần "chưa giải ngân" chỉ gồm ký quỹ, tiền giữ lại và quỹ dự phòng.
- **Quyết định.**
  - **Chỉ ký quỹ của chủ hụi được đưa đi sinh lãi, và lãi trả cho chủ hụi.** Tiền giữ lại và quỹ dự phòng thì không, vì là tiền của người khác hoặc tiền chung. Như vậy tránh được rủi ro bị coi là dùng tiền góp để sinh lời (NĐ 19 Điều 3 khoản 3, `docs/10`).
  - Thêm `FactoryConfig.yieldVault` kiểu ERC-4626; `address(0)` nghĩa là không sinh lãi. Nguồn lãi theo môi trường:
    - Fuji: `MockYieldVault`, lãi giả lập, phải khai báo đầu pitch.
    - Mainnet: adapter Aave v3.
    - Bản VND: lãi tiền gửi của tài khoản phong tỏa ở ngân hàng đối tác.
  - Dòng tiền ký quỹ:
    - `depositBond` gửi ký quỹ vào vault.
    - Khi thác bù cần dùng ký quỹ thì `withdraw` đúng số cần.
    - `finalize`, `withdrawBond` và `emergencyUnwind` rút hết, trả chủ hụi gốc còn lại cộng lãi, phát `BondYieldPaid`.
  - CI chỉ tính trên gốc `bondRemaining`, không tính lãi.
  - Khi có vault, INV-01 thành hai điều kiện:
    - `usdc.balanceOf(circle) == reserve + totalHoldback + Σ feeEscrow + revealBondsHeld + totalClaimable`.
    - `vault.convertToAssets(bondShares) ≥ bondRemaining − số lần rút`, để chừa sai số làm tròn của ERC-4626.
  - `MockYieldVault`:
    - Dựa trên ERC-4626 của OpenZeppelin 5.x, dùng `_decimalsOffset()` để chống tấn công lạm phát.
    - Lãi tuyến tính theo `ratePerSecond` do deployer đặt.
    - Lãi trả từ USDC testnet nạp sẵn vào vault; khoảng 5 USDC là đủ cho demo.
- **Hệ quả.** Dây 12 người, giả định lãi 4%/năm: chủ hụi lời gộp khoảng 11,5%/năm, sau tổn thất kỳ vọng còn khoảng 8,4%/năm.
- **Việc cần làm.** Khoảng 1 ngày. Chỉ làm sau M3 và cắt được (mục 9). Deploy lại sau 15/11 thì verify qua Routescan (ADR-16), vì Etherscan ngừng hỗ trợ API cho Fuji từ ngày đó.

### ADR-26. Admin là Safe 2/3 ngay trên Fuji

- **Bối cảnh.**
  - Luật cuộc thi: quỹ gom chung phải đặt sau multisig.
  - HụiSafe giữ ký quỹ, tiền giữ lại và quỹ dự phòng trong contract không có hàm rút. Quyền đặc biệt duy nhất là tạm dừng, mở lại và trả theo sổ, và quyền này đang nằm ở ví deployer.
  - Admin của factory không đổi được sau deploy, nên phải chọn trước.
- **Quyết định.**
  - Tạo Safe 2/3 trên Fuji bằng Ash Wallet (`wallet.ash.center`), giao diện tương thích Safe mà [Avalanche Academy](https://docs.avax.network/academy/avalanche-l1/permissioned-l1s/06-multisig-setup/03-create-safe-wallet) hướng dẫn dùng trên Fuji. Ba người ký là ba ví testnet riêng của ba thành viên. Không dùng ví deployer, relayer, keeper hay attester làm người ký (ADR-21).
  - Deploy `HuiFactory(admin = Safe, ...)`.
  - Deploy `ReputationRegistry(admin = ví deployer)`. Quyền duy nhất của admin này là gọi `setFactory` một lần, ngay trong `Deploy.s.sol`, nên lúc deploy không cần chữ ký Safe. Không có thay đổi nào trong contract.
  - Địa chỉ Safe lưu ở `packages/config` và `contracts/deployments/fuji.json`. `Deploy.s.sol` đọc bằng `vm.envAddress("ADMIN_SAFE_ADDRESS")`; đây là địa chỉ công khai, không phải bí mật.
  - `/demo-check` kiểm `factory.admin() == Safe`.
  - Ash Wallet lỗi trên Fuji thì dùng Protocol Kit của Safe; cần kiểm địa chỉ các contract Safe trên chain 43113.
- **Câu pitch.** "Tiền nằm trong contract không có hàm rút. Quyền khẩn cấp duy nhất là tạm dừng và trả theo sổ, và quyền đó nằm sau Safe 2/3."

### ADR-27. Mã băm thỏa thuận dây lên chuỗi (tùy chọn)

- **Bối cảnh.**
  - Nghị định 19 yêu cầu thỏa thuận bằng văn bản và sổ họ.
  - Nhiều luật của HụiSafe chỉ hợp lệ khi "có thỏa thuận khác": giới hạn bảo lãnh ở mức ký quỹ (Điều 18 khoản 4), chia hòa tất định (Điều 20), hốt kỳ đầu, thưởng đúng hạn.
  - Nhân thân không được lên chuỗi (NĐ 356/2025 Điều 11).
- **Quyết định.**
  - Thêm `CircleParams.termsHash` = `keccak256` của văn bản thỏa thuận dây (UTF-8). `termsHash = 0` thì `InvalidParams(15)`.
  - Web dựng văn bản từ tham số dây và bộ điều khoản chuẩn có phiên bản (`apps/web/content/thoa-thuan/v1.2.md`). Văn bản không chứa nhân thân.
  - Clone phát `CircleTermsSet(termsHash, organizerTakesFirst)` trong `initialize`.
  - Màn vào dây hiện văn bản và mã băm. Ký giao dịch vào dây nghĩa là đồng ý đúng văn bản đó. Sổ họ xuất kèm văn bản và mã băm.
  - Phần nhân thân theo Điều 8 do chủ hụi giữ ngoài chuỗi.
- **Việc cần làm.** Khoảng 1 giờ contract, 2 giờ web. Nếu cắt: giữ màn văn bản thỏa thuận trên web, bỏ trường trên chuỗi.

### ADR-28. Bám MVP của đề trên giao diện

Không đổi contract. Khoảng 0,5 ngày web.

- **Form tạo dây 2 bước.**
  - Bước 1 đúng 4 trường của đề: số người, mức góp mỗi kỳ, chu kỳ, kiểu chia (Fixed hoặc Bỏ thăm).
  - Bước 2 "Bảo chứng": ký quỹ điền sẵn `B_min`, kèm đồng hồ CI.
  - Tham số khác nằm trong "Nâng cao", mặc định theo `docs/03` mục 3.1.
- **Chế độ Fixed không được cắt.** Form có lựa chọn kiểu chia. Trước buổi pitch, chạy sẵn một dây Fixed 3 người tới lúc kết thúc, để trong demo mở dashboard của nó khoảng 10 giây.
- **Bảng chi phí trước khi bỏ thăm,** tính theo thăm đang nhập:
  - tiền nhận ngay;
  - tiền nhận dần (tiền giữ lại, nhả bao nhiêu mỗi kỳ);
  - lãi thăm trả cho người khác (b × L_k);
  - tiền công;
  - phần trích vào quỹ dự phòng.

  Xem vector V5.
- **Banner phạt trễ** theo ADR-24.
- **Màn tất toán.** Với mỗi người hiện:
  - "lãi thăm đã nhận": tổng (C − số bị kéo) ở các kỳ người đó còn sống, lấy từ event `ContributionPulled`;
  - "thưởng đúng hạn";
  - tiền giữ lại được trả.

  Xem vector V6. Đây là phần "close out and pay bidding interest" của đề.

### ADR-29. Attestation cắm được (Team1)

- Trang BTC chưa mô tả "Team1 attestation".
- Không cần đổi code, vì đã có hai chỗ để cắm:
  - `FactoryConfig.attester` đổi được bằng `setConfig`, áp dụng cho dây tạo sau đó.
  - Server `/api/attest` có thể kiểm thêm điều kiện trước khi ký.
- Khi BTC trả lời:
  - Team1 có khóa ký hoặc API: server kiểm thêm, hoặc trỏ `attester` về signer của Team1.
  - Team1 có registry on-chain: cân nhắc thêm kiểm tra on-chain sau M3.
- Tin nhắn hỏi BTC ở mục 11.

---

## 5. Quyền lợi các bên sau nâng cấp

Giả định chung: dây góp 100 USDC mỗi tháng, thăm bằng nửa trần, tiền công 1%, quỹ dự phòng 1%, α = 20%, CI 100%, không ai vỡ nợ. Riêng dòng "sau tổn thất kỳ vọng" dùng tỷ lệ bỏ đóng của Klonner & Rai: người hốt nửa đầu 2,04%, nửa sau 0,59%, và giả định họ bỏ ngay sau khi hốt. Đây là ước tính thô. Script ở phụ lục A.

### 5.1. Dây 12 người (ký quỹ 2.880 USDC, một năm)

| | v1.1 | v1.2 bật hốt kỳ đầu | v1.2 bật hốt kỳ đầu và lãi ký quỹ 4%* |
|---|---|---|---|
| Chủ hụi: lời gộp trên ký quỹ | 128 USDC, 4,4%/năm | 217 USDC, 7,5%/năm | 333 USDC, 11,5%/năm |
| Chủ hụi: sau tổn thất kỳ vọng khoảng 90 USDC | khoảng 1,3%/năm | khoảng 4,4%/năm | khoảng 8,4%/năm |
| Người hốt cuối: lời | 8,5%/năm | 6,6%/năm | 6,6%/năm |
| Người hốt muộn: bảo vệ | Tùy dây, CI có thể chỉ 50% | 100% | 100% |

\* Lãi 4%/năm là giả định để minh họa. Trên Fuji lãi là giả lập.

Với dây 5 người (dây demo), v1.1 cho chủ hụi khoảng 10%/năm gộp, khoảng 3,5%/năm sau tổn thất kỳ vọng. Bật hốt kỳ đầu làm người hốt cuối giảm từ 5,2% xuống 1,1%/năm, nên dây nhỏ không nên bật.

### 5.2. Núm chỉnh tiền giữ lại (dây 12 người, CI 100%)

| α | Ký quỹ cần | Người hốt kỳ 1 nhận ngay (nếu không giữ: 981) | Chi phí vốn người hốt kỳ 1 | Lời gộp của chủ hụi trên ký quỹ |
|---|---|---|---|---|
| 10% | 3.240 | 871 | 27,3%/năm | 3,9%/năm |
| 20% (mặc định) | 2.880 | 761 | 31,7%/năm | 4,4%/năm |
| 30% | 2.520 | 651 | 37,7%/năm | 5,1%/năm |

Đây là trade-off không tránh được: chủ hụi không bỏ vốn, người hốt sớm nhận đủ, người hốt muộn chắc chắn không mất, chỉ đạt được hai trong ba. α là núm chia gánh nặng giữa chủ hụi và người hốt sớm.

Tiền giữ lại không phải tiền phạt, vì được trả lại dần. Cái mất thật là phần lãi trả trên khoản chưa được cầm: ở α = 20%, chi phí vốn tăng khoảng 7,7 điểm %. Khi đấu thăm, người cần tiền sẽ tự bỏ thăm thấp hơn, nên một phần chi phí chuyển sang người hốt muộn. Họ là người được bảo vệ, nên gánh là hợp lý.

### 5.3. Khác hụi ngoài đời ở đâu

| | Hụi ngoài đời | HụiSafe v1.2 |
|---|---|---|
| Giữ tiền | Chủ hụi thu, giữ, chi | Không ai giữ. Tới kỳ, contract kéo tiền từ ví từng người và chi ngay trong một giao dịch |
| Sổ sách | Sổ tay chủ hụi, dựng được phần ảo | Dựng từ giao dịch on-chain. Phần ảo cũng phải góp tiền thật, và với CI 100% thì vô hại |
| Bỏ thăm | Thăm giấy do chủ hụi mở; hòa thì bốc thăm | Thăm kín commit-reveal; hòa thì chia theo luật cố định ghi trong thỏa thuận (Điều 20 cho phép) |
| Trần lãi | Ít ai kiểm | Code chặn thăm vượt trần theo Điều 21 |
| Công chủ hụi | Tiền thảo (vụ Tây Ninh khoảng 2,6% pot, suy từ phiếu chi); có nơi hốt kỳ đầu | Tiền công 1–3%, mất nếu kỳ đó có vỡ nợ; tùy chọn hốt kỳ đầu; lãi trên ký quỹ của chính mình |
| Người bỏ ngang | Luật bắt chủ hụi góp thay; thực tế hay vỡ hụi | Bù theo thứ tự có sẵn: tiền giữ lại, ký quỹ, quỹ dự phòng |
| Phạt trễ | Nhắc, nể, phạt miệng | Tự động: lãi chậm góp, mất thưởng đúng hạn, ghi uy tín |
| Linh hoạt | Dời kỳ, cho khất, sang phần | Luật khóa khi dây chạy; ân hạn 48 giờ; chưa cho sang phần |
| Tiền | VND | USDC testnet; muốn chạy thật phải dùng VND (`docs/10` mục 6) |

### 5.4. Tấn công ví ảo của chủ hụi (dây 5 người, α 20%)

| | CI 50% (ký quỹ 180) | CI 100% (ký quỹ 480) |
|---|---|---|
| Ví ảo nhận ở kỳ 1 (thăm trần 6,575342) | 286,22 | 286,22 |
| Chủ hụi mất ký quỹ | 180 | 320 |
| Tiền công chủ hụi giữ được (kỳ 1, 3, 4, 5) | khoảng 15,7 | 15,74 |
| Lời, lỗ của chủ hụi (gộp với ví ảo) | khoảng +120 | −18,04 |
| Người hốt cuối bị thiếu | khoảng 125 | 0 |

---

## 6. Bảng vá tài liệu

Điều phối áp đúng các điểm dưới đây, giữ nguyên phần còn lại. Đoạn code dùng chung cho `docs/05`:

```solidity
// CircleParams: thêm 2 trường ở CUỐI struct
bool    organizerTakesFirst;  // ADR-23; cần organizerIsMember = true
bytes32 termsHash;            // ADR-27; keccak256 văn bản thỏa thuận dây, khác 0 (bỏ nếu không làm ADR-27)

// FactoryConfig
uint16  minCoverageBps;       // 10_000 trên Fuji (ADR-22)
address yieldVault;           // ADR-25; address(0) = không sinh lãi

// Lỗi: ghi đúng chữ ký đang có trong code (code là chuẩn cho riêng 3 lỗi này)
error NotCircle();
error ZeroAddress();
error InvalidConfig(/* đúng như code */);

// Event mới của HuiCircle
event CircleTermsSet(bytes32 termsHash, bool organizerTakesFirst);    // phát trong initialize
event ReserveShared(address indexed member, uint256 amount, uint16 weight);
event BondYieldPaid(address indexed organizer, uint256 amount);       // chỉ khi làm ADR-25

// View mới của HuiCircle
function onTimeWeight(address m) external view returns (uint16);     // (N − 1) − lateCount; 0 nếu vỡ nợ
function bondAssets() external view returns (uint256);               // = bondRemaining nếu không có vault
```

| File | Chỗ | Sửa thành |
|---|---|---|
| `docs/03` | Bảng ký hiệu (dòng `minCoverageBps`), mục 2.3 | Mặc định 10_000 trên Fuji (ADR-22); thêm công thức `B_min` |
| `docs/03` | Mục 3.1, bảng tham số | Thêm `organizerTakesFirst` (bool, false, cần `organizerIsMember`) và `termsHash` (bytes32, khác 0) |
| `docs/03` | Mục 4, hàng Admin | "Admin (Safe 2/3, cả trên Fuji)" |
| `docs/03` | Mục 5.1, bước 5 `activate()` | Thêm điều kiện chủ hụi đã vào dây khi `organizerTakesFirst`; thứ tự hốt của dây Fixed |
| `docs/03` | Mục 5.3, bước 5 `finalize()` | Chia theo trọng số đúng hạn (ADR-24) |
| `docs/03` | Mục 6.1 (ai được bỏ thăm) và 6.4 (chọn người hốt) | Thêm luật "Kỳ 1 khi `organizerTakesFirst`" (ADR-23) |
| `docs/03` | Mục 7.1 (sổ cái) và 7.2 (INV-01) | Thêm biến thể khi có vault (ADR-25) |
| `docs/03` | Mục 8 | Thêm mục "8.x Biến thể v1.2" gồm vector V1, V2, V3 |
| `docs/05` | `CircleParams`, `FactoryConfig`, 4.1 event, 4.2 lỗi, view | Theo đoạn code trên |
| `docs/05` | 3.3 thứ tự deploy | `ReputationRegistry(deployer)`; `HuiFactory(Safe, implementation, config)`; `setFactory` vẫn gọi ngay trong script |
| `docs/05` | 4.3 mã `InvalidParams` | Mã 2: `contribution` < 1 USDC (1_000_000) hoặc > `maxContribution`. Thêm mã 14 (`organizerTakesFirst` mà không `organizerIsMember`) và 15 (`termsHash` = 0) |
| `docs/05` | 7, SDK | Thêm `costBreakdown(view, member, bid)` (V5) và `bidInterestReceived(view, member)` (V6) |
| `docs/02` | AC-01.2 | "Given ký quỹ 0, Then hiện 20% và 'Chưa đủ để bắt đầu dây (tối thiểu 100%). Cần thêm 480 USDC ký quỹ.'" |
| `docs/02` | AC-07.2 | "Trả trễ trong ân hạn (`payLate`): sau khi hoàn nguồn bù, vẫn được nhả 20 USDC của kỳ đó (`docs/03` mục 6.8 bước 4). Quá ân hạn thì vỡ nợ, tiền giữ lại bị dùng để bù." |
| `docs/02` | Sơ đồ màn hình (nhãn "chỉ số ≥ 50%") | "chỉ số 100%" |
| `docs/02` | Thêm user story mới | AC cho ADR-28: form 2 bước, lựa chọn Fixed, bảng chi phí, banner phạt trễ, màn tất toán; màn thỏa thuận (ADR-27) |
| `docs/02` | Bảng thuật ngữ, dòng `reserve` | "Trích 1% mỗi kỳ; cuối dây trả lại theo số kỳ đóng đúng hạn" |
| `docs/04` | Sơ đồ C4, nút admin | "Admin: Safe 2/3 (Fuji và mainnet)" |
| `docs/04` | Mục 5.3, bước 2 | Thứ tự deploy mới như `docs/05` mục 3.3 |
| `docs/04` | Sơ đồ tuần tự `finalize` | "Quỹ dự phòng chia theo trọng số đúng hạn" |
| `docs/04` | Bảng ADR | Thêm ADR-22 đến ADR-29 (tóm tắt từ mục 4) |
| `docs/06` | Checklist deploy | `minCoverageBps` 10_000; `admin()` là Safe; registry admin là deployer |
| `docs/01` | Dòng `minCoverageBps` và ví dụ B = 180 | Ghi sàn 100%; ví dụ B = 180 giờ dùng để minh họa tấn công ví ảo |
| `docs/08` | Kịch bản mô phỏng | Thêm `organizer_sybil` và `organizer_economics` (mục 7) |
| `docs/09` | Bảng hàm (`activate`, `finalize`); nhánh A dòng `finalize`; thêm mục test v1.2 | Theo mục 7 |
| `docs/10` | Bảng NĐ 19, dòng 18.4 ("CI ≥ 50%"); câu hỏi mở | Sửa thành 100%; thêm câu hỏi ở mục 11 |
| `docs/11` | Lịch, danh sách cắt | Theo mục 9 |
| `docs/12` | Slide 9, 10, 11; hỏi đáp; kịch bản demo | Theo mục 8 |
| `CLAUDE.md` | Dòng "`activate()` cần ... (5000)"; luật cứng 7 "testnet: ví deployer"; danh sách "Đọc khi cần" | 10_000; "Safe 2/3, cả trên Fuji"; thêm `docs/14-nang-cap-v1.2.md` |
| `.claude/skills/hui-protocol/SKILL.md` | Bảng tham số (`minCoverageBps` 5000); dòng `finalize`; dòng `Paused` | Như trên |
| `.claude/skills/vn-legal-pitch/SKILL.md` | "quỹ dự phòng ... chia đều"; câu về trần lãi | Theo mục 8 |
| `docs/ai-workflow/02` | Prompt `activate` (5000); prompt deploy (registry admin) | Như trên |

Sau khi vá, grep lại các chuỗi sau để chắc không còn câu cũ: `5000`, `50%`, `chia đều`, `ví deployer`, `testnet: deployer`, `trần 20%/năm`, `Giao diện dây Fixed`.

---

## 7. Test và vector số

Mọi vector dùng tham số dây demo ở `docs/03` mục 8: N = 5, C = 100, P = 30 ngày, α = 20%, tiền công 1%, quỹ dự phòng 1%, cọc mở thăm 1%. Riêng V3 ghi rõ tham số khác.

**V1. Thưởng đúng hạn, nhánh A** (ADR-24). Quỹ dự phòng 19,697397 (19.697.397 đơn vị). Trọng số: M1 4, M2 4, M3 4, M4 3 (trễ kỳ 2), M5 4; tổng 19.

| | M1 | M2 | M3 | M4 | M5 | Tổng |
|---|---|---|---|---|---|---|
| v1.1 (chia đều) | 3,939481 | 3,939479 | 3,939479 | 3,939479 | 3,939479 | 19,697397 |
| v1.2 | 4,146822 | 4,146820 | 4,146820 | 3,110115 | 4,146820 | 19,697397 |

M1 nhận thêm phần dư lẻ 0,000002 ở cả hai bản. M4 mất 0,829364 USDC vì trễ một kỳ. Nhánh B không đổi: M1, M2, M3, M5 mỗi người 5,895.

**V2. Chủ hụi hốt kỳ đầu** (ADR-23). `organizerIsMember = true`, `organizerTakesFirst = true`. Kỳ 1:

| Thăm | Pot | Tiền công | Quỹ dự phòng | Giữ lại | Chủ hụi nhận |
|---|---|---|---|---|---|
| 0 | 400,000000 | 0 | 4,000000 | 80,000000 | 316,000000 |

Từ kỳ 2 dùng luật thường; trần thăm kỳ 2 là 4,931506. Chủ hụi được nhả 20 mỗi kỳ đóng đúng hạn.

**V3. Sàn CI 100%** (ADR-22).

| Dây | α | O_max | B_min |
|---|---|---|---|
| N = 5, C = 100 | 20% | 600 | 480 |
| N = 5, C = 100 | 10% | 600 | 540 |
| N = 12, C = 100 | 20% | 3.600 | 2.880 |

Với ký quỹ 479,999999: `activate()` revert `CoverageTooLow(9999, 10000)`.

**V4. Tấn công ví ảo ở CI 100%** (test tích hợp).
1. Ví ảo của chủ hụi commit sớm nhất và thắng kỳ 1 với thăm 6,575342.
2. Kỳ 1: pot 373,698632, tiền công 3,736986, quỹ dự phòng 3,736986, giữ lại 80, ví ảo nhận 286,224660.
3. Ví ảo bỏ đóng. Kỳ 2 bù 80 từ tiền giữ lại và 20 từ ký quỹ. Kỳ 3 đến 5, mỗi kỳ bù 100 từ ký quỹ.
4. Kiểm: `uncovered == 0` ở mọi kỳ; ký quỹ còn 160.
5. Lời, lỗ của phía chủ hụi = 286,224660 − 320 + 15,736986 = −18,038354 USDC. Giả định kỳ 3 đến 5 thăm 0; tiền công kỳ 2 bị chuyển vào quỹ dự phòng.

**V5. Bảng chi phí trước khi bỏ thăm** (ADR-28). M4, thăm 6 ở kỳ 1:
- nhận ngay 288,48;
- nhận dần 80 (20 mỗi kỳ đóng đúng hạn);
- lãi thăm trả cho 4 người: 24;
- tiền công 3,76;
- quỹ dự phòng 3,76, cuối dây chia lại theo thưởng đúng hạn.

**V6. Lãi thăm đã nhận** (ADR-28), ví dụ gốc: M1 6, M2 9, M3 9, M4 0, M5 9. Tổng 33, bằng 24 (kỳ 1) cộng 9 (kỳ 2).

**Test mới** (thêm vào `docs/09`):

| Mã | Test | Kiểm |
|---|---|---|
| T1 | `test_activate_RevertWhen_CoverageBelow100` | V3 |
| T2 | `test_createCircle_RevertWhen_TakesFirstWithoutMember` | `InvalidParams(14)` |
| T3 | `test_activate_RevertWhen_OrganizerNotJoined_TakesFirst` | `NotMember()` |
| T4 | `test_commitBid_RevertWhen_Round1_TakesFirst` | `NotEligibleToBid()` |
| T5 | `test_settleRound1_TakesFirst_Vector` và `test_fixedOrder_TakesFirst` | V2; thứ tự Fixed: chủ hụi trước, rồi theo `joinIndex` |
| T6 | `test_finalize_OnTimeWeights_BranchA` | V1 |
| T7 | `test_finalize_BranchB_Unchanged` | 5,895 mỗi người |
| T8 | `testFuzz_reserveSplit` | Σ phần chia = R; ai có w = 0 nhận 0 (trừ khi Σw = 0) |
| T9 | `test_OrganizerSybil_CI100_Unprofitable` | V4 |
| T10 | `test_bondVault_*` (chỉ khi làm ADR-25) | Gửi vào vault; rút khi thác bù; `finalize` trả gốc cộng lãi; CI không tính lãi; INV-01 biến thể |
| T11 | `test_createCircle_RevertWhen_TermsHashZero` (chỉ khi làm ADR-27) | `InvalidParams(15)`; event `CircleTermsSet` |

**Mô phỏng** (thêm vào `docs/08`):
- `organizer_sybil`: CI 50% so với 100%. Kỳ vọng lời của chủ hụi khoảng +120 so với −18; người hốt cuối thiếu khoảng 125 so với 0.
- `organizer_economics`: ba cấu hình chỉ tiền công, thêm hốt kỳ đầu, thêm lãi ký quỹ. Kỳ vọng như bảng 5.1.

---

## 8. Pitch: câu trả lời nâng cấp

### Câu 1. Vì sao on-chain?

1. **Không ai cầm tiền.** Tới kỳ, contract kéo tiền từ ví từng người và chi cho người hốt trong cùng một giao dịch; không có "két" để ôm.
2. **Mọi dòng tiền công khai** (đúng câu *"every cash flow is public"* của đề). Sổ họ dựng từ giao dịch nên không sửa được.
3. **Luật chạy bằng code.** Gồm trần thăm theo Điều 21, lãi chậm góp theo Điều 22, thác bù và CI 100%. Chủ hụi dùng ví ảo cũng chỉ đốt ký quỹ của chính mình: lỗ 18 USDC trong ví dụ, không ai bị thiếu.
4. **Có chứng cứ.** Mỗi khoản có mã giao dịch và chữ ký, như phiếu chi có chữ ký trong Bản án 48/2024/DS-ST.

### Câu 2. Vì sao Avalanche?

| Dây | Gas mỗi kỳ (ngân sách hoặc ước tính) | Chi phí |
|---|---|---|
| 5 người, hằng tháng (dây demo) | Chi kỳ ≤ 600.000 gas (`docs/04` mục 7.1) | Khoảng 0,013 USD mỗi lần chi kỳ |
| 20 người, hằng tuần (đúng câu của đề) | Chi kỳ khoảng 2 triệu gas, cộng khoảng 170.000 gas thăm kín cho mỗi người bỏ thăm | Khoảng 0,006 USD mỗi người mỗi tuần, khoảng 0,3 USD mỗi người mỗi năm; dưới 0,1% tiền góp nếu góp 10 USDC mỗi tuần |

Giả định 2,5 nAVAX và 8,73 USD/AVAX (Snowtrace, 05/11/2026). Phải đo lại bằng `forge test --gas-report` và receipt trên Fuji, rồi cập nhật số trước pitch.

Thêm ba ý:
- USDC native của Circle có `permit`, nên vào dây chỉ cần một chữ ký.
- Finality dưới 1 giây, nên tiền về ví người hốt ngay khi kỳ chốt.
- Relayer trả gas, nên người dùng không cần AVAX.

### Câu 3. Tiền và lãi đến từ đâu?

| Dòng tiền | Từ đâu | Đến đâu |
|---|---|---|
| Tiền hốt | Tiền góp của chính các thành viên | Người hốt kỳ đó |
| Lãi thăm | Người cần tiền sớm (giảm tiền góp cho người còn sống) | Người hốt sau; trần theo Điều 21 |
| Tiền công | 1% (tối đa 3%), trừ từ pot người hốt; mất nếu kỳ đó có vỡ nợ | Chủ hụi |
| Hốt kỳ đầu (tùy chọn) | Kỳ 1 không đấu thăm, như tập quán | Chủ hụi |
| Quỹ dự phòng | 1% mỗi pot | Bù vỡ nợ; còn dư thì trả lại người đóng đúng hạn |
| Lãi ký quỹ (bonus) | Fuji: giả lập, có khai báo. Mainnet: người vay trên Aave v3. Bản VND: lãi tiền gửi của tài khoản phong tỏa | Chủ hụi; chỉ tính trên tiền của chính chủ hụi |
| Gas | Relayer của HụiSafe | Mạng Avalanche |

Câu chốt của slide: "Không token, không hứa lợi nhuận, không đồng nào từ trên trời rơi xuống."

### Luật Việt Nam

Giữ bốn điểm BTC yêu cầu ở `docs/10` mục 5, thêm ba câu:
- "Trần thăm theo Nghị định 19 Điều 21, theo cách hiểu của nhóm, đang chờ luật sư xác nhận." Không nói "lãi tối đa 20%/năm" (V10).
- "Thỏa thuận dây được băm lên chuỗi; nhân thân giữ ngoài chuỗi theo NĐ 356/2025 Điều 11." Chỉ nói khi đã làm ADR-27.
- "Lãi trên ký quỹ ở bản demo là giả lập; chỉ tính trên tiền của chính chủ hụi, không dùng tiền góp." Chỉ nói khi đã làm ADR-25, và thêm vào câu khai báo dev toggle.

### Nhịp demo mới (chèn vào kịch bản 3 phút, không kéo dài thời gian)

1. Lúc tạo dây: chỉ vào lựa chọn Fixed hoặc Bỏ thăm, đồng hồ CI 100% và dòng "ký quỹ tối thiểu". Câu nói: "Chủ hụi có dựng ví ảo cũng không lấy được tiền của ai."
2. Lúc M4 trễ: banner liệt kê năm hậu quả tự động.
3. Lúc tất toán: cột "lãi thăm đã nhận" và "thưởng đúng hạn"; M4 nhận ít hơn người khác.
4. Mở dashboard dây Fixed đã chạy sẵn trong 10 giây.

### Hỏi đáp thêm

| Câu hỏi | Trả lời ngắn |
|---|---|
| Ai chịu làm chủ hụi khi phải khóa ký quỹ? | Chủ hụi có tiền công, có thể hốt kỳ đầu như tập quán, và ký quỹ sinh lãi cho chính họ. Dây 12 người lời kỳ vọng khoảng 8%/năm trên vốn khóa. Đổi lại, người góp được bảo đảm 100% |
| Tiền giữ lại có phải phạt hai lần? | Không. Tiền vẫn là của người hốt, nhả dần mỗi kỳ đóng đúng hạn. Người hốt sẽ tự bỏ thăm thấp hơn để bù. Mức giữ lại chỉnh được |
| Chủ hụi dùng ví ảo thì sao? | Mọi dây bảo chứng 100%, nên ví ảo hốt rồi bỏ thì chủ hụi tự trả bằng ký quỹ của mình |
| Đề nói chủ hụi là contract, sao vẫn có người thật? | Contract làm hai việc dễ gian lận: giữ tiền và ghi sổ. Người thật chỉ rủ người và bảo lãnh, như Điều 18 khoản 4 |
| Lãi thực có vượt 20%/năm không? | Trần tính theo câu chữ Điều 21, trên dư nợ còn lại và thời gian còn lại. Lãi thực tính theo dư nợ giảm dần cao hơn con số đó, nên nhóm đã gửi câu hỏi cho luật sư. Code tách công thức riêng để thay được ngay |

---

## 9. Lịch áp dụng và danh sách cắt

| Ngày | Việc |
|---|---|
| T2 09/11 | Gửi file này. Điều phối vá tài liệu (mục 6). Tạo Safe 2/3 trên Fuji. Repo sang private, mời `tuantqse90`. Hỏi BTC về attestation Team1 |
| T2–T3 09–10/11 | Agent contract làm ADR-23, ADR-24 (và ADR-27 nếu chọn) cùng lúc với C5, C6; viết test T1–T9, T11 |
| T3 10/11 | M1: toàn bộ test cũ và mới xanh |
| T4 11/11 | M2 deploy: factory admin là Safe, `minCoverageBps` 10_000, registry admin là deployer; verify xong trước 15/11 |
| T5–T7 12–14/11 | M3 web: ADR-28 (form 2 bước, Fixed, bảng chi phí, banner phạt trễ, màn tất toán); màn thỏa thuận (ADR-27); chạy sẵn dây Fixed |
| CN–T2 15–16/11 | P2: ADR-25 nếu M3 xanh; mô phỏng hai kịch bản mới; slide 9, 10, 11 |
| T3 17/11 | M5 đóng băng tính năng |

**Danh sách cắt mới** (cắt từ trên xuống):

1. Paper DeFi'27.
2. "Đấu thăm hộ".
3. Bot nhắc hụi Telegram.
4. ADR-25 lãi ký quỹ. Nếu cắt thì slide nói lãi ký quỹ là roadmap.
5. Bonus còn lại: ERC-5192, Ponder, passkey, EIP-3009.
6. ADR-27 trên chuỗi; vẫn giữ màn văn bản thỏa thuận.
7. PDF sổ họ phía server (thay bằng trang HTML in được).
8. Kịch bản mô phỏng độ nhạy.
9. Bớt eval của trợ lý.
10. Thử nghiệm 5 người thay vì 10.

**Không bao giờ cắt.** Giữ toàn bộ danh sách cũ, thêm bốn mục:
- lựa chọn Fixed hoặc Bỏ thăm, và một dây Fixed chạy được;
- CI 100%;
- admin là Safe;
- banner phạt trễ.

---

## 10. Prompt cho Claude Code

```text
Bạn là điều phối dự án HụiSafe. Đọc toàn bộ docs/14-nang-cap-v1.2.md.
1. Áp bảng vá ở mục 6 vào docs/01, 02, 03, 04, 05, 06, 08, 09, 10, 11, 12, CLAUDE.md,
   .claude/skills/hui-protocol/SKILL.md, .claude/skills/vn-legal-pitch/SKILL.md và
   docs/ai-workflow/02. Chỉ sửa đúng các điểm trong bảng. Với 3 lỗi NotCircle,
   ZeroAddress, InvalidConfig thì chép đúng chữ ký đang có trong code.
   Vá xong, grep các chuỗi ở cuối mục 6 và báo những chỗ còn sót.
2. Thêm vector V1–V6, test T1–T11 và hai kịch bản mô phỏng ở mục 7 vào docs/09 và docs/08.
   Mọi con số lấy đúng từ mục 7; không tự suy ra số khác.
3. Vào plan mode, lập kế hoạch code cho ADR-23 và ADR-24 (và ADR-27 nếu leader chọn),
   gắn vào việc C5, C6 đang làm. Liệt kê file sẽ sửa, test sẽ thêm, lệnh kiểm tra.
   Chưa code cho tới khi tôi duyệt.
4. Sửa script deploy theo ADR-22 và ADR-26: minCoverageBps = 10_000, admin factory
   đọc từ ADMIN_SAFE_ADDRESS, ReputationRegistry nhận admin là ví deployer.
   Không broadcast cho tới khi tôi duyệt (/deploy-fuji).
5. ADR-25 chỉ lập kế hoạch, làm sau M3.
Sau mỗi thay đổi contract: forge fmt, forge build, forge test (gồm invariant), rồi /audit.
```

---

## 11. Câu hỏi còn mở

**Luật sư**
1. Điều 20: trong họ có lãi, chủ hụi lĩnh kỳ đầu không qua thăm (ADR-23) có hợp lệ nếu ghi trong thỏa thuận không?
2. Điều 21: trần tính trên dư nợ còn lại và thời gian còn lại theo câu chữ (cách đang dùng), hay theo dư nợ giảm dần?
   - Theo câu chữ, lãi thực của người hốt kỳ 1 ở mức trần là khoảng 40–70%/năm.
   - Theo dư nợ giảm dần thì khoảng 23–26%/năm, và trần thăm giảm khoảng 35–50%. Khi đó thăm 450.000 trong vụ Tây Ninh sẽ vượt trần (trần mới khoảng 345.000).
   - Công thức thay thế, nằm sẵn trong `HuiMath.maxBid` để đổi: `maxBid(k) = capBps · C · P · (N − k)(N − k + 1) / (2 · 10_000 · 365 ngày · L_k)`. Ví dụ dây demo kỳ 1: 4,109589 thay vì 6,575342.
3. Chia quỹ dự phòng theo số kỳ đúng hạn (ADR-24) có bị coi là phạt vi phạm cần thỏa thuận riêng không? Câu này bổ sung cho câu hỏi 9 ở `docs/10`.
4. Mã băm thỏa thuận cùng chữ ký ví có đáp ứng yêu cầu văn bản và chữ ký của Điều 8 và Điều 12 không, theo Luật Giao dịch điện tử 2023 Điều 23?

**BTC** (dán vào nhóm Telegram Builders)

> Chào BTC, đề Hụi on-chain có bonus "sybil resistance with a Team1 attestation". Cho nhóm em hỏi Team1 có dịch vụ attestation nào để tích hợp không (registry on-chain trên Fuji, schema, API hoặc khóa ký)? Hiện nhóm dùng attestation EIP-712 do server ký sau khi xác thực tài khoản, và có thể chuyển sang attester của Team1 bằng cấu hình. Ngoài ra, quỹ nằm trong contract không có hàm rút, quyền tạm dừng đặt sau Safe 2/3 trên Fuji: như vậy đã đạt yêu cầu "quỹ gom chung phải sau multisig" chưa ạ? Em cảm ơn.

**Phỏng vấn dì** (bổ sung vào bộ câu hỏi)
1. Chủ hụi có hốt kỳ đầu không? Có lấy lãi kỳ đó không?
2. Tiền thảo bao nhiêu mỗi kỳ, ai trả, trả lúc nào?
3. Ai trễ thì bị phạt thế nào? Có ai từng mất phần vì trễ không?
4. Nếu phải khóa khoảng 1/5 tổng tiền cả dây làm ký quỹ, có chủ hụi nào chịu không? Cần được trả công bao nhiêu thì chịu?
5. Có khi nào dời kỳ, cho khất, hay sang phần cho người khác không?

---

## Phụ lục A. Cách tính số liệu

Giả định:
- Kỳ 30 ngày, C = 100 USDC, α = 20%, tiền công 1%, quỹ dự phòng 1%, CI 100%, không ai vỡ nợ.
- Thăm mỗi kỳ bằng θ × `maxBid(k)` theo cách hiểu hiện tại của Điều 21, với θ = 0,5.
- Lãi suất năm là IRR theo tháng của dòng tiền từng người, quy ra năm.
- Tổn thất kỳ vọng của chủ hụi = Σ p_k × (1 − α) × (N − k) × C. Trong đó p_k = 2,04% với nửa đầu và 0,59% với nửa sau (Klonner & Rai), giả định bỏ ngay sau khi hốt.

Script kiểm lại (Python 3, không cần thư viện ngoài):

```python
def irr_year(cfs):
    f = lambda r: sum(c / (1 + r) ** t for t, c in enumerate(cfs))
    lo, hi = -0.99, 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if f(lo) * f(mid) <= 0: hi = mid
        else: lo = mid
    return (1 + mid) ** 12 - 1

def circle(N, theta=0.5, fee=0.01, alpha=0.2, prem=0.01, C=100.0, organizer_first=False):
    maxbid = lambda k: 0.2 * C * (N - k) * 30 / 365
    b = {k: (0.0 if organizer_first and k == 1 else theta * maxbid(k)) for k in range(1, N + 1)}
    pot = {k: (N - k) * (C - b[k]) + (k - 1) * C for k in b}
    fees = {k: (0.0 if organizer_first and k == 1 else fee * pot[k]) for k in b}
    H = {k: alpha * (N - k) * C for k in b}
    share = sum(prem * pot[k] for k in b) / N
    def member(r):  # dòng tiền của người hốt kỳ r, chỉ số = tháng
        cf = [0.0] * (N + 1)
        for k in b:
            if k == r: cf[k] += pot[k] - fees[k] - prem * pot[k] - H[k]
            elif k < r: cf[k] -= C - b[k]
            else: cf[k] -= C - alpha * C
        cf[N] += share
        return cf
    bond = (1 - alpha) * (N // 2) * ((N + 1) // 2) * C
    return dict(bond=bond, fees=sum(fees.values()),
                first=irr_year(member(1)), last=irr_year(member(N)))

print(circle(12))                        # bond 2880, fees ~128, first ~31,7%, last ~8,5%
print(circle(12, organizer_first=True))  # fees ~118, last ~6,6%
print(circle(12, alpha=0.0))             # first ~24,0%
```

Các vector ở mục 7 tính bằng số nguyên theo đơn vị 10⁻⁶ USDC, đúng cách làm tròn ở `docs/03`: mọi phép chia làm tròn xuống, phần dư lẻ cho `joinIndex` nhỏ nhất.

## Phụ lục B. Nguồn

- Đề Topic 1 và trang nộp bài: [team1vn.xyz](https://team1vn.xyz/). Trên trang có: hạn 23:59 ngày 21/11/2026 giờ Việt Nam; repo public, hoặc private có mời `tuantqse90`; video 2–3 phút; mọi link phải mở được cho giám khảo.
- [Avalanche Academy: Creating a Safe/Ash Wallet](https://docs.avax.network/academy/avalanche-l1/permissioned-l1s/06-multisig-setup/03-create-safe-wallet)
- [Bản án 48/2024/DS-ST (Tây Ninh)](https://static3.luatvietnam.vn/uploaded/LawJudgs/2024/07/31/ban-an-48-2024-ds-st-103207.pdf). Tiền thảo 1.000.000 đồng/kỳ là con số suy từ phiếu chi (`docs/01`).
- [Klonner & Rai, chit fund Chennai](https://web.williams.edu/Economics/rai/adverse-08-9-1.pdf): tỷ lệ bỏ đóng 2,04% và 0,59%; trần thăm gây lựa chọn bất lợi.
- [Eeckhout & Munshi 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC3766900): chit fund lấy pot đầu, hoa hồng, tác động của trần lãi.
- [Snowtrace gas tracker](https://snowtrace.io/gastracker): 2,5 nAVAX và 8,73 USD/AVAX ngày 05/11/2026 (ghi chú nghiên cứu).
- [Nghị định 19/2019/NĐ-CP](https://caselaw.vn/van-ban-phap-luat/339092-nghi-dinh-so-19-2019-nd-cp-ngay-19-02-2019-cua-chinh-phu-ve-ho-hui-bieu-phuong). Các văn bản khác xem `docs/10` và `docs/13`.
