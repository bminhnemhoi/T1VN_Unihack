# HụiSafe: giải thích đầy đủ để phân tích

> Tài liệu này tóm tắt dự án HụiSafe từ bộ tài liệu triển khai v1.1 của trưởng nhóm, viết để một người (hoặc một AI khác) chưa đọc bộ tài liệu vẫn hiểu được bài toán và phân tích được. Cuối file có danh sách câu hỏi cần phân tích thêm.

---

## 1. Bối cảnh cuộc thi

- Cuộc thi: **Team1 Vietnam UniHack 2026**, hackathon xây dApp trên blockchain **Avalanche**, dành cho sinh viên Việt Nam. Nhà tài trợ: MEXC Ventures. Giải: Nhất 30 triệu, Nhì 20 triệu, Ba 11 triệu, 7 giải Khuyến khích 2 triệu.
- **Hạn nộp: 23:59 ngày 21/11/2026.** Hôm nay là 07/11, còn khoảng 14 ngày. Top 10 thuyết trình trực tiếp ngày 30/11.
- Thang điểm 100: Kỹ thuật 25, **Tích hợp Avalanche 25** (5 phần × 5: dùng có ý nghĩa, có contract on-chain, dùng hạ tầng phù hợp, chất lượng tích hợp, thể hiện rõ giá trị của Avalanche), Sáng tạo 15, Tác động 15, Thuyết trình 10, UI/UX và Demo 10.
- Luật bắt buộc:
  - Không có yếu tố may rủi: không bốc thăm, xổ số, phần thưởng ngẫu nhiên.
  - Không nhận tiền thật của người dùng, không bán token.
  - Tiền người dùng nằm trong ví của họ; chỉ gom quỹ khi đề tài cho phép và phải có multisig.
  - Agent AI không được quyết định chuyển tiền.
  - Không lưu dữ liệu cá nhân on-chain.
  - Dev toggle (giả lập thời gian, vị trí...) phải khai báo đầu buổi pitch.
  - Pitch phải nói về luật Việt Nam: tiền mã hóa không phải phương tiện thanh toán, lương trả bằng VND, tư vấn tài chính hoặc pháp lý có phí cần giấy phép.
  - Phải trả lời 3 câu: vì sao on-chain, vì sao Avalanche, tiền hoặc lãi đến từ đâu.
- HụiSafe thuộc track **Social finance**, phát triển từ đề tài gợi ý số 1 "Hụi on-chain" của BTC. Theo dữ liệu công khai ngày 07/11, trong 181 đội chưa đội nào công bố làm hụi.

---

## 2. Hụi là gì (cho người chưa biết)

Hụi (còn gọi là họ, biêu, phường) là hình thức góp vốn xoay vòng phổ biến ở Việt Nam, quốc tế gọi là **ROSCA** (Rotating Savings and Credit Association).

- Một nhóm N người, mỗi kỳ (thường mỗi tháng) mỗi người góp một khoản C.
- Mỗi kỳ có **đúng một người "hốt"**, tức nhận cả cục tiền góp của kỳ đó. Sau N kỳ, ai cũng đã hốt đúng một lần.
- **Hụi bỏ thăm (hụi có lãi):** ai cần tiền sớm thì "bỏ thăm", tức chấp nhận nhận ít hơn. Người bỏ thăm cao nhất được hốt. Tiền thăm là khoản mỗi người chưa hốt được giảm khi góp kỳ đó. Thực chất người hốt sớm đi vay, người hốt muộn cho vay và hưởng lãi.
- Thuật ngữ:
  - **Hụi sống:** người chưa hốt; mỗi kỳ góp C trừ tiền thăm.
  - **Hụi chết:** người đã hốt; mỗi kỳ phải góp đủ C cho tới hết dây.
- **Chủ hụi** là người tổ chức. Theo truyền thống, chủ hụi làm 2 việc:
  1. **Giữ và chuyển tiền.**
  2. **Bảo lãnh:** ai bỏ đóng thì chủ hụi bù. Nghị định 19/2019 Điều 18 khoản 4 giao đúng nghĩa vụ này cho chủ hụi.
- Hụi hợp pháp theo Bộ luật Dân sự 2015 Điều 471 và Nghị định 19/2019/NĐ-CP. Lãi không quá 20%/năm (Điều 21), lãi chậm góp mặc định bằng 50% trần (Điều 22), phải thông báo UBND xã khi một kỳ từ 100 triệu đồng hoặc chủ hụi tổ chức từ 2 dây (Điều 14).

## 3. Bài toán

1. **Vỡ hụi:** chủ hụi ôm tiền bỏ trốn, dựng thành viên ảo, lấy tiền dây này đắp dây kia. Các vụ tài liệu dẫn: Bình Thuận hơn 100 tỷ đồng với 167 nạn nhân (9/2024); Lào Cai một dây 937 người hơn 100 tỷ; Trà Vinh 157 phần hụi ảo trên Zalo, án 12 năm (3/2025).
2. **Không kiểm tra được** tiền đang ở đâu.
3. **Rủi ro ít người nói tới: người đã hốt bỏ đóng.** Họ đã nhận tiền rồi bỏ, người hốt sau chịu thiệt. Nghiên cứu về chit fund ở Chennai (Ấn Độ): người hốt sớm bỏ đóng 2,04%, người hốt muộn 0,59% (Klonner & Rai 2008).

**Luận điểm cốt lõi của HụiSafe:** các bản "hụi on-chain" thông thường cho contract giữ tiền, tức bỏ cả 2 vai trò của chủ hụi. Bỏ vai trò giữ tiền thì tốt, nhưng bỏ luôn vai trò bảo lãnh thì người hốt sau gánh hết rủi ro. **HụiSafe bỏ vai trò giữ tiền nhưng giữ vai trò bảo lãnh, bằng một khoản ký quỹ bị khóa trong contract.**

Câu chốt: *"Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh."*

---

## 4. HụiSafe hoạt động thế nào

### 4.1. Năm quy tắc

1. **Không ai cầm tiền.** Khi vào dây, mỗi người ký một lần "permit" (EIP-2612) cho phép contract trích tối đa một số USDC từ ví mình. Đến kỳ, contract kéo tiền góp từ ví từng người và chi ngay cho người hốt **trong cùng một giao dịch**. Giữa các kỳ, tiền góp nằm trong ví của chính thành viên.
2. **Chủ hụi ký quỹ.** Chủ hụi nạp ký quỹ B vào contract trước khi dây chạy. Ai bỏ đóng thì ký quỹ tự động bù. Chủ hụi không rút được ký quỹ cho tới khi dây kết thúc.
3. **Giữ lại một phần tiền của người hốt sớm (holdback).** Người hốt kỳ k bị giữ lại α·(N−k)·C (α mặc định 20%). Mỗi kỳ người đó đóng đúng hạn, contract nhả lại α·C. Nếu họ bỏ đóng, phần giữ lại dùng để bù trước tiên.
4. **Đấu thăm kín, không ngẫu nhiên.** Bỏ thăm theo kiểu commit-reveal (nộp thăm đã mã hóa, hết giờ mới mở) nên không ai thấy thăm của người khác. Trần lãi 20%/năm nằm trong code. Hòa thăm thì người ít lần trễ hơn thắng, vẫn hòa thì người nộp thăm sớm hơn thắng.
5. **Sổ họ số và Chỉ số bảo chứng.** Mọi sự kiện đều ghi on-chain, xuất được sổ họ (Nghị định 19 Điều 12 yêu cầu chủ hụi giữ sổ họ). Trước khi vào dây, người chơi thấy dây được bảo chứng bao nhiêu phần trăm.

### 4.2. Các vai

| Vai | Làm gì | Không được làm |
|---|---|---|
| Chủ hụi | Tạo dây, nạp ký quỹ, kích hoạt dây, nhận tiền công (1% mỗi pot), nhận lại ký quỹ còn lại khi kết thúc | Chạm vào tiền góp, đổi luật sau khi kích hoạt, chọn người hốt |
| Thành viên | Vào dây, bỏ thăm, góp, trả trễ, trả nợ, nhận tiền | Bỏ thăm khi đã hốt, đang nợ hoặc bị đóng băng |
| Relayer (dịch vụ của HụiSafe) | Gửi giao dịch hộ người dùng và trả gas (meta-transaction ERC-2771), nên người dùng không cần mua AVAX | Sửa nội dung giao dịch, cầm tiền |
| Keeper (bất kỳ ai, thường là bot) | Gọi "chốt kỳ", "đánh dấu vỡ nợ", "kết thúc dây" khi đến hạn | Không có quyền đặc biệt |
| Attester (khóa của HụiSafe) | Ký xác nhận "một người một ví, tự xác nhận đủ 18 tuổi" | Ghi dữ liệu cá nhân lên chuỗi |
| Admin (multisig) | Tạm dừng dây; giải thể khẩn cấp sau 48 giờ tạm dừng, trả tiền theo sổ | Rút tiền người dùng, đổi luật dây đang chạy |

### 4.3. Vòng đời một dây

1. **Gom người (Forming):** chủ hụi tạo dây với các tham số N, C, chu kỳ, α, phí, trần lãi..., rồi nạp ký quỹ. Thành viên vào dây bằng giấy xác nhận của attester cộng chữ ký permit. Được rời dây trước khi dây chạy.
2. **Kích hoạt (Active):** cần đủ N người và **Chỉ số bảo chứng ≥ 50%**. Sau đó mọi tham số bị khóa.
3. **Mỗi kỳ:** cửa sổ nộp thăm kín, rồi cửa sổ mở thăm, rồi đến hạn thì ai cũng gọi được hàm chốt kỳ (`settleRound`).
4. **Kết thúc:** sau kỳ N và hết thời gian ân hạn. Trả lại phần giữ lại, tiền công cho chủ hụi, ký quỹ còn lại cho chủ hụi, quỹ dự phòng chia đều cho thành viên không vỡ nợ.
5. Ngoài ra có trạng thái Hủy (không đủ người trước hạn), Tạm dừng và Giải thể khẩn cấp.

### 4.4. Hàm chốt kỳ làm gì (tất cả trong một giao dịch)

1. **Chọn người hốt:** thăm hợp lệ cao nhất. Không ai bỏ thăm thì người vào dây sớm nhất hốt với thăm 0. Kỳ cuối, người còn lại hốt với thăm 0.
2. **Tính phần phải góp:**
   - Hụi sống: C − b.
   - Hụi chết: C.
   - Người bị "đóng băng" (chưa hốt mà đã vỡ nợ): không kéo tiền, ghi nợ.
3. **Kéo tiền** từ ví từng người. Ai không đủ tiền hoặc đã thu hồi quyền trích thì ghi là "khoản thiếu".
4. **Bù khoản thiếu theo thác:** phần giữ lại của chính người thiếu → ký quỹ chủ hụi → quỹ dự phòng → nếu vẫn thiếu thì người hốt nhận ít hơn và có quyền đòi công khai đối với người thiếu.
5. **Trích từ pot:** 1% tiền công (giữ lại tới cuối dây, mất nếu kỳ đó có vỡ nợ), 1% vào quỹ dự phòng, phần giữ lại của người hốt.
6. **Chi phần còn lại** cho người hốt. Nếu chuyển thất bại thì ghi để người đó tự rút sau.
7. **Nhả α·C phần giữ lại** cho mỗi người đã hốt trước đó mà kỳ này đóng đúng hạn.

### 4.5. Trả trễ và vỡ nợ

- **Ân hạn 48 giờ:** trả trễ trong ân hạn thì trả gốc cộng lãi chậm góp (10%/năm). Các nguồn đã bù được hoàn lại, người hốt bị nhận thiếu (nếu có) được trả trước.
- **Quá ân hạn:** bất kỳ ai cũng gọi được "đánh dấu vỡ nợ".
  - Người **đã hốt** vỡ nợ: các kỳ sau vẫn thử kéo tiền của họ, thiếu thì thác bù.
  - Người **chưa hốt** vỡ nợ bị **đóng băng**: tới lượt họ hốt, pot của họ dùng trả nợ trước, còn dư mới đến tay họ. Vì vậy người chưa hốt bỏ đóng không gây lỗ ròng cho ai.
- Lịch sử đúng hạn, trễ, vỡ nợ ghi vào một sổ uy tín dùng chung giữa các dây.

### 4.6. Toán cốt lõi

- **Rủi ro chưa đóng** sau kỳ k: O(k) = k·(N−k)·C. Cao nhất ở giữa dây: O_max ≈ N²C/4.
  - Ví dụ N = 5, C = 100: O_max = 2·3·100 = 600 USDC.
- **Tổng phần giữ lại** luôn bằng α·O(k), tức tự che được α phần rủi ro.
- **Chỉ số bảo chứng:** CI = α + (ký quỹ + quỹ dự phòng) / O_max, tối đa 100%.
- **CI = 100% thì người trung thực không lỗ đồng nào**, kể cả khi mọi người đã hốt cùng bỏ đóng đúng lúc rủi ro đỉnh. Lý do: phần giữ lại che α·O, ký quỹ che phần (1−α)·O còn lại. Ký quỹ cần cho 100% là B = (1−α)·O_max = 0,8·O_max.
- **Trần thăm theo Nghị định 19 Điều 21** (nhóm tự diễn giải, cần luật sư xác nhận): maxBid(k) = 20% × C × (N−k) × P / 365 ngày, với P là chu kỳ.
  - Ví dụ hụi tháng 5 người × 100 USDC, kỳ 1: tối đa 6,58 USDC.

### 4.7. Ví dụ số (cũng là kịch bản demo)

Dây 5 người × 100 USDC, hụi tháng, α = 20%, ký quỹ 480 (CI = 20% + 480/600 = 100%), phí 1%, quỹ dự phòng 1%.

- **Kỳ 1:** M4 bỏ thăm 6 và thắng.
  - 4 người sống góp 94 mỗi người = 376.
  - Trừ phí 3,76, quỹ dự phòng 3,76, giữ lại 80 (20% × 4 × 100).
  - **M4 nhận 288,48.**
- **Kỳ 2:** M1 thắng với thăm 3. M4 (đã hốt) không đóng, thiếu 100: bù 80 từ phần giữ lại của M4 và 20 từ ký quỹ.
  - Pot = 3 × 97 + 100 = 391.
  - **M1 nhận 323,18**, người hốt vẫn nhận đủ.
- **Nhánh A, M4 trả trễ trong ân hạn:** trả 100 cộng lãi chậm góp. Ký quỹ và phần giữ lại được hoàn, như chưa có gì xảy ra.
- **Nhánh B, M4 bỏ hẳn:** các kỳ 3, 4, 5 ký quỹ bù 100 mỗi kỳ (460 → 160). Mọi người trung thực nhận đủ. Chủ hụi mất 320 ký quỹ, M4 bị ghi vỡ nợ.
- Trên testnet, demo thu nhỏ 10 lần (C = 10 USDC), vì faucet USDC chỉ cho 20 USDC mỗi 2 giờ mỗi ví.

---

## 5. Công nghệ

| Lớp | Lựa chọn |
|---|---|
| Chain | Avalanche Fuji C-Chain (testnet, chainId 43113), USDC testnet của Circle (có permit) |
| Smart contract | Solidity + Foundry + OpenZeppelin 5. `HuiFactory` tạo mỗi dây là một bản clone EIP-1167 của `HuiCircle`; `ReputationRegistry`; thư viện toán `HuiMath` |
| Ví | Privy (đăng nhập Google hoặc email, tự tạo ví nhúng). Không tự build ERC-4337; C-Chain chưa hỗ trợ EIP-7702 |
| Gas | Meta-transaction ERC-2771: người dùng chỉ ký, relayer của HụiSafe trả gas |
| Web | Next.js 15, TypeScript, Tailwind, shadcn/ui, wagmi, viem; khoảng 15 màn hình, mobile-first, tiếng Việt |
| Backend | API routes: `/api/relay` (gửi giao dịch hộ), `/api/attest` (ký xác nhận một người một ví), `/api/copilot` (trợ lý AI); `apps/keeper` tự gọi chốt kỳ theo lịch |
| Mô phỏng | Python: so sánh 3 thiết kế (hụi on-chain thường, hụi thế chấp, HụiSafe) dưới các mức vỡ nợ, ra biểu đồ cho pitch |
| AI | "Trợ lý chủ hụi" dùng Claude API với 6 tool chỉ đọc và tính: gợi ý mức ký quỹ, giải thích luật, soạn mẫu thông báo UBND. Mọi con số do hàm tất định tính, AI không ký và không chạm vào tiền. Có bộ kiểm thử 30 tình huống |
| Bonus | L1 riêng cho từng hội hụi (chỉ thành viên đã xác thực được giao dịch), sinh lãi giả lập trên ký quỹ, huy hiệu, bot nhắc hụi Telegram |

**Chế độ demo (dev toggle, khai báo đầu pitch):** mỗi kỳ 180 giây (90 giây nộp thăm, 60 giây mở thăm), ân hạn 120 giây, còn trần lãi vẫn tính như hụi tháng. Một dây 5 người chạy hết khoảng 15 phút.

## 6. Trả lời 3 câu bắt buộc

- **Vì sao on-chain:** lỗi gốc của hụi là phải tin người giữ tiền. Làm app dùng cơ sở dữ liệu thì người vận hành app thành chủ hụi mới. Ký quỹ chỉ đáng tin khi bị khóa bằng code mà chính chủ hụi không rút được.
- **Vì sao Avalanche:** chuyển token tốn khoảng $0,001; giao dịch chốt dưới 1 giây; có USDC native với permit; về sau mỗi hội có thể có L1 riêng chỉ cho thành viên đã xác thực.
- **Tiền đến từ đâu:**
  - Tiền thăm do người hốt sớm trả cho người hốt sau.
  - Tiền công trả cho chủ hụi vì gánh rủi ro.
  - Lãi trên ký quỹ (mainnet lấy từ cho vay blue-chip, testnet là giả lập).
  - Nền tảng lấy một phần nhỏ tiền công.
  - Không phát hành token.

## 7. Pháp lý

- Hụi hợp pháp. HụiSafe đưa các Điều 12, 14, 18, 20, 21, 22 của Nghị định 19/2019 vào code và giao diện.
- Góp hụi bằng USDC giữa người cư trú tại Việt Nam hiện **không hợp pháp**: tiền mã hóa không phải phương tiện thanh toán; Nghị quyết 05/2025 yêu cầu giao dịch tài sản mã hóa bằng VND và qua tổ chức được cấp phép. Vì vậy cuộc thi chỉ demo trên testnet.
- Hướng ra thị trường: chế độ VND trong nước, chế độ USDC cho cộng đồng người Việt ở nước ngoài.
- Còn 15 câu hỏi mở cần luật sư, nhóm định hỏi mentor ngày 19/11. Ví dụ:
  - Diễn giải trần lãi có đúng Điều 21 không?
  - Chia hòa không bốc thăm có hợp lệ không?
  - Phần giữ lại có bị tính là lãi không?
  - Nền tảng có bị coi là bên tổ chức họ không?

## 8. Kế hoạch của trưởng nhóm (thiết kế cho 3 người)

| Mốc | Ngày | Nội dung |
|---|---|---|
| M0 | 07/11 | Dựng khung repo, ví testnet, gom USDC testnet |
| M1 | 10/11 | Contract lõi có unit test và fuzz test |
| M2 | 11/11 | Deploy và verify trên Fuji, có test bất biến |
| M3 | 14/11 | Chạy trọn luồng qua web trên Fuji (có relayer, keeper) |
| M4 | 16/11 | Trợ lý AI, mô phỏng, 5–10 người dùng thật thử |
| M5 | 17/11 | Đóng băng tính năng |
| M6 | 18–19/11 | README, slide, video |
| M7 | 20/11 | Nộp bài (21/11 dự phòng) |

Tổng ước tính khoảng 204 giờ công: contract 66, web và hạ tầng 70, mô phỏng, AI và pitch 68. **Thực tế một người (dùng AI viết code) có thể sẽ làm cả 3 phần.**

---

## 9. Câu hỏi nhờ phân tích

1. **Động lực của chủ hụi:** ở ví dụ trên, chủ hụi khóa 480 USDC để kiếm khoảng 20 USDC tiền công cả dây, nhưng có thể mất tới 480 nếu có người bỏ. Ai sẽ chịu làm chủ hụi? Nên thêm gì để hấp dẫn hơn (ví dụ chủ hụi hốt kỳ đầu không lãi như tập quán, phí cao hơn, CI thấp hơn 100%)?
2. **Gánh nặng cho người hốt sớm:** người cần tiền gấp lại bị giữ lại khoảng 20% (M4 nhận 288 thay vì 368). Có làm hụi bỏ thăm kém hấp dẫn không? α bao nhiêu là hợp lý?
3. **Vốn ký quỹ:** với N = 10, C = 2 triệu, rủi ro đỉnh 50 triệu, ký quỹ cho 100% khoảng 40 triệu. Có thực tế với chủ hụi ở Việt Nam không? Mức CI tối thiểu nên đặt bao nhiêu?
4. **Trải nghiệm:** người lớn tuổi có dùng nổi commit-reveal (phải quay lại mở thăm đúng khung giờ, lỡ là mất cọc) không? Có cách đơn giản hơn mà vẫn kín và không ngẫu nhiên?
5. **Điểm Avalanche:** lập luận "phí rẻ, nhanh, có USDC" có đủ khác biệt so với các chain EVM khác không? L1 riêng cho mỗi hội có đáng làm trong 14 ngày không?
6. **Phạm vi:** với 1 người và khoảng 14 ngày, nên giữ và cắt gì để vẫn thắng điểm Kỹ thuật và Demo?
7. **Rủi ro bảo mật** trong logic chốt kỳ và thác bù: những lỗi nào dễ xảy ra nhất?
8. **Pitch:** câu chuyện nào thuyết phục nhất với giám khảo (Team1, giảng viên CNTT, quỹ đầu tư MEXC Ventures, founder startup)?
