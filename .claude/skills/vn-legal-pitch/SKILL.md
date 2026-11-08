---
name: vn-legal-pitch
description: Khung pháp lý và lời văn pitch của HụiSafe - 4 điểm luật Việt Nam BTC yêu cầu nêu, 3 câu hỏi bắt buộc (Why on-chain, Why Avalanche, tiền từ đâu), bảng ánh xạ Nghị định 19/2019 sang tính năng, quy tắc câu chữ, câu khai báo dev toggle đầu pitch, nguồn trích dẫn. Dùng khi viết slide, kịch bản video, bài nộp UniHack, README phần pháp lý, FAQ, nội dung explain_rule của trợ lý, hay bất kỳ câu chữ nào nói về luật, tiền, rủi ro.
---

# Pháp lý và lời văn pitch HụiSafe

Mục đích: nói đúng luật, đúng sự thật, không hứa quá, trả lời đủ câu BTC hỏi. Đọc trước khi viết bất kỳ chữ nào cho giám khảo hoặc người dùng về luật, tiền, rủi ro.
Chi tiết và nguồn đầy đủ: `docs/10-phap-ly-va-tuan-thu.md`; kịch bản, câu khai báo mẫu, checklist nộp bài: `docs/12-pitch-demo-nop-bai.md`; luật giao thức: skill `hui-protocol`. Khi file trong docs khác skill này, docs thắng.

## 1. Bốn điểm luật Việt Nam BTC yêu cầu nêu (topics.json)

| Điểm | Câu nên nói | Liên hệ HụiSafe | Nguồn (xem docs/10) |
|---|---|---|---|
| Crypto không phải phương tiện thanh toán | "Ở Việt Nam, tài sản mã hóa không phải phương tiện thanh toán; theo Nghị quyết 05/2025/NQ-CP, chào bán, giao dịch, thanh toán tài sản mã hóa phải bằng đồng Việt Nam." | MVP chỉ chạy trên testnet Fuji với USDC testnet, không nhận tiền thật. Bản thật ở Việt Nam cần quyết toán bằng VND hoặc qua đơn vị được cấp phép; nói như roadmap, không như việc đã làm | NQ 05/2025/NQ-CP Điều 4 khoản 7; Ngân hàng Nhà nước về tiền ảo |
| Lương trả bằng VND | "HụiSafe không trả lương và không thay thế thu nhập bằng tiền mã hóa." | Không có tính năng chi trả lương | Bộ luật Lao động 2019 Điều 95 khoản 2 (cần kiểm tra lại trên vbpl.vn) |
| Tư vấn có phí cần giấy phép | "Trợ lý chủ hụi chỉ tính toán và trích dẫn quy định, miễn phí, không phải tư vấn pháp luật hay tài chính." | Trợ lý chỉ đọc và tính bằng tool tất định; luôn có câu miễn trừ; không gọi là "luật sư AI" | Luật Luật sư Điều 4, 28; NĐ 77/2008; NĐ 82/2020 Điều 6 (docs/10) |
| Cổ phiếu token hóa bị chặn theo khu vực | "HụiSafe không phát hành token, không token hóa cổ phiếu hay chứng khoán." | Không có token riêng; USDC là tài sản có sẵn của Circle | NQ 05/2025/NQ-CP Điều 5 khoản 2 (tài sản bảo chứng không được là chứng khoán, tiền pháp định) |

Nói thêm khi được hỏi về chế tài: Nghị định 284/2026/NĐ-CP (hiệu lực 01/09/2026) phạt giao dịch ngoài đơn vị được cấp phép; nói "người cư trú được kỳ vọng chỉ giao dịch qua đơn vị được Bộ Tài chính cấp phép", không khẳng định ngày cưỡng chế cụ thể.

## 2. Ba câu hỏi bắt buộc

**Why on-chain?** Chủ hụi có hai vai trò: giữ tiền và bảo lãnh. Vỡ hụi đến từ vai trò giữ tiền (ôm tiền, hụi ảo, hụi chồng hụi). Contract bỏ vai trò giữ tiền (tiền nằm trong ví từng người tới lúc chi, kéo và chi trong cùng một giao dịch) nhưng giữ vai trò bảo lãnh bằng ký quỹ khóa trong code. Sổ họ công khai, không sửa được, dựng từ event (NĐ 19 Điều 12, 13). Trần lãi và lãi chậm góp chạy trong code (Điều 21, 22). Câu chốt: "Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh."

**Why Avalanche?** USDC native của Circle trên Fuji có `permit` (EIP-2612) và EIP-3009, nên góp tiền chỉ cần ký một lần; phí giao dịch thấp (chuyển ERC-20 trên C-Chain khoảng 0,001 USD, ước tính từ Snowtrace gas tracker 05/11/2026); finality dưới 1 giây theo trang hiệu năng của Avalanche; hệ công cụ quen thuộc (EVM, Foundry, Privy, faucet, Snowtrace) để 3 người làm xong trong 2 tuần; roadmap: mỗi hội hụi lớn có L1 riêng. Bám rubric Avalanche 25 điểm: dùng có ý nghĩa, smart contract thật on-chain, hạ tầng phù hợp, chất lượng tích hợp, giá trị khi xây trên Avalanche.

**Tiền từ đâu?** Không có lãi sinh ra từ hư không:
- Người hốt sau nhận nhiều hơn vì người hốt sớm trả tiền thăm (b cho mỗi phần sống), đúng cơ chế hụi truyền thống, bị chặn bởi trần lãi Điều 21.
- Tiền công chủ hụi (`feeBps`, mặc định 1% mỗi pot) chỉ có ở dây "họ hưởng hoa hồng" và chỉ trả cho kỳ không có vỡ nợ.
- Quỹ dự phòng trích 1% mỗi pot, cuối dây chia đều cho người không vỡ nợ.
- Ký quỹ là tiền của chủ hụi, khóa để bảo lãnh, cuối dây nhận lại phần không dùng tới.
- MVP không sinh lãi trên tiền bị khóa (`NoYield`). Nếu demo `MockYieldVault`: nói rõ là lãi giả lập, nguồn lãi thật trên mainnet sẽ là Aave v3 (Aave không có trên Fuji).
- Mô hình doanh thu của chính HụiSafe: chỉ nói theo docs/12; chưa chốt thì nói là định hướng, không đưa con số.

## 3. Ánh xạ Nghị định 19/2019/NĐ-CP sang tính năng

| Điều | Nội dung | Trong HụiSafe |
|---|---|---|
| 3 khoản 3 | Cấm dùng họ để cho vay nặng lãi, lừa đảo, huy động vốn trái phép | Không quỹ gom chung tự do; không sinh lãi trên tiền khóa ở MVP |
| 4 khoản 8, 8 | Hoa hồng chỉ ở "họ hưởng hoa hồng" | `commissionMode`, `feeBps` ≤ 300; tiền công escrow theo kỳ |
| 5, 6 | Thành viên, chủ họ từ đủ 18 tuổi | Tự xác nhận 18+ khi đăng nhập Privy; attester ký `MemberAttestation`; một người một ví |
| 12, 13 | Sổ họ (ngày góp, số tiền, chữ ký), biên nhận | Sổ họ số dựng từ event, xuất JSON/PDF; chữ ký ví thay chữ ký (giá trị pháp lý: câu hỏi mở cho luật sư) |
| 14 | Thông báo UBND cấp xã khi một kỳ ≥ 100 triệu đồng hoặc chủ họ có ≥ 2 dây | Cảnh báo trên UI + mẫu thông báo; giá trị một kỳ tính thận trọng = N·C quy đổi (tỷ giá cấu hình, mặc định 26.000 VND/USDC); N·C hay (N − 1)·C là câu hỏi mở cho luật sư; factory đếm `activeCirclesOf` |
| 18 khoản 4 | Chủ họ bù phần thiếu | Ký quỹ khóa trong contract, thác bù tự động |
| 20 | Lĩnh họ theo thỏa thuận; bằng thăm thì bốc thăm | Chia hòa tất định (ít lần trễ hơn, rồi nộp thăm sớm hơn) ghi như thỏa thuận khác của dây, vì luật cuộc thi cấm ngẫu nhiên; CẦN LUẬT SƯ XÁC NHẬN |
| 21 | Lãi ≤ 20%/năm trên phần còn phải góp, trong thời hạn còn lại | `maxBid(k)`; là diễn giải đề xuất, CẦN LUẬT SƯ XÁC NHẬN |
| 22 khoản 1 | Lãi chậm góp mặc định 50% mức trần | `lateRateBps = 1000` (10%/năm) |
| 25 | Tranh chấp: thương lượng, hòa giải, tòa án | Khoản "không được bù" ghi công khai làm bằng chứng xử lý ngoài chuỗi |

Bối cảnh khi kể chuyện: vỡ hụi thường bị khởi tố theo BLHS Điều 174 (lừa đảo chiếm đoạt tài sản) hoặc Điều 175 (lạm dụng tín nhiệm). Kiểm chứng trần lãi bằng Bản án 48/2024/DS-ST (Tây Ninh): thăm 450.000 dưới trần ≈ 657.534 của dây 25 phần × 2 triệu, hụi tháng.

## 4. Khai báo dev toggle (bắt buộc, ngay đầu pitch và đầu video)

Dùng câu mẫu trong docs/12 nếu có; nếu chưa có, dùng nội dung sau:

"Trước khi demo, chúng tôi khai báo: HụiSafe chạy trên Avalanche Fuji testnet với USDC testnet, không có tiền thật. Chúng tôi bật chế độ demo: mỗi kỳ 3 phút thay vì 30 ngày (nộp thăm 90 giây, mở thăm 60 giây, ân hạn 2 phút), còn trần lãi và lãi chậm góp vẫn tính theo kỳ 30 ngày. Phí mạng do relayer của HụiSafe trả thay người dùng. Ký quỹ không sinh lãi trong bản này."

Thêm nếu đúng với bản demo: dùng `MockUSDC` thay USDC của Circle; dùng `MockYieldVault` (lãi giả lập, nguồn thật là Aave v3 trên mainnet); ví admin là ví deployer thay vì Safe multisig. Mọi màn hình demo hiện nhãn "Chế độ demo".

## 5. Quy tắc câu chữ

- Tiếng Việt chuẩn, câu ngắn (dưới 20 chữ trên màn hình), thuật ngữ đời thường (bảng ở docs/02 mục 8). Không emoji.
- Không hứa: không "lợi nhuận", "đầu tư", "an toàn tuyệt đối", "không bao giờ mất tiền", "bảo hiểm". Nói "được bảo chứng X%" và nêu điều kiện (CI 100% = ký quỹ chịu được cú sốc lớn nhất, mọi người đã hốt cùng bỏ đóng một lúc; bỏ đóng lần lượt qua nhiều kỳ có thể vượt ký quỹ; người chưa hốt bỏ đóng thì ký quỹ chỉ ứng thanh khoản). Câu chuẩn: "Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc.".
- Không gọi trợ lý là "luật sư AI"; không mô tả dịch vụ là "tư vấn". Câu miễn trừ của trợ lý: "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý."
- Mọi số liệu có nguồn và ngày; số mô phỏng ghi rõ là mô phỏng với tham số giả định (seed, kịch bản); chưa chắc thì ghi "cần kiểm tra". Không bịa số.
- Nhắc luật thì dẫn điều, khoản. Diễn giải Điều 21 luôn kèm "đề xuất, cần luật sư xác nhận".
- Không nói về người thật cụ thể trong các vụ vỡ hụi; dùng số liệu vụ án đã đăng báo kèm nguồn.
- Bằng chứng rủi ro chính: Klonner & Rai (2008), chit fund Chennai: hốt sớm bỏ đóng 2,04%, hốt muộn 0,59%; Anderson, Baland & Moene (2009).

## 6. Nguồn hay dùng (xem 05/11/2026; danh sách đầy đủ ở docs/10 và docs/13)

- NĐ 19/2019/NĐ-CP: https://luatvietnam.vn/tai-chinh/nghi-dinh-19-2019-nd-cp-ve-ho-hui-bieu-phuong-170756-d1.html và https://caselaw.vn/van-ban-phap-luat/339092-nghi-dinh-so-19-2019-nd-cp-ngay-19-02-2019-cua-chinh-phu-ve-ho-hui-bieu-phuong
- NQ 05/2025/NQ-CP (toàn văn): https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm
- Luật cuộc thi: https://team1vn.xyz/topics.json
- Klonner & Rai (2008): https://web.williams.edu/Economics/rai/adverse-08-9-1.pdf ; Anderson, Baland & Moene (2009): https://ideas.repec.org/a/eee/deveco/v90y2009i1p14-23.html
- Hiệu năng Avalanche: https://docs.avax.network/solutions/performance ; phí: https://snowtrace.io/gastracker

## 7. Không bao giờ

- Nói hay ngụ ý HụiSafe nhận tiền thật, bán token, hay đã được cơ quan nào cấp phép.
- Giấu dev toggle, lãi giả lập, hay việc dùng mock.
- Đưa con số không có nguồn, hoặc trình bày kết quả mô phỏng như số liệu thực tế.
- Đưa dữ liệu cá nhân của người dùng thử vào slide, video hay repo.
