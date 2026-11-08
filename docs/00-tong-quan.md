# 00. Tổng quan HụiSafe

**Mục đích và đọc khi nào.** Một trang để hiểu HụiSafe là gì, vì sao nó khác các bản "hụi on-chain" khác, và bộ tài liệu này dẫn tới đâu. Đọc đầu tiên, trước mọi file khác. Ai cần chi tiết thì theo các liên kết ở cuối.

---

## Một câu

HụiSafe là hụi bỏ thăm chạy trên Avalanche. Tiền nằm trong ví từng người cho đến lúc chi. Chủ hụi không cầm tiền nhưng phải ký quỹ để bảo lãnh. Luật về họ, hụi (Nghị định 19/2019) chạy ngay trong code.

**Khẩu hiệu:** Chơi hụi không sợ vỡ.
**Câu chốt khi pitch:** Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh.

## Vấn đề

- Vỡ hụi xảy ra thường xuyên và lớn:
  - Bình Thuận: hơn 100 tỷ đồng, 167 nạn nhân (9/2024).
  - Lào Cai: một dây 937 thành viên, hơn 100 tỷ.
  - Trà Vinh: 157 phần hụi ảo trên Zalo, án 12 năm (3/2025).

  Nguồn và chi tiết ở [01-nghien-cuu-nen-tang.md](01-nghien-cuu-nen-tang.md).
- Người chơi không kiểm tra được tiền đang ở đâu. Chủ hụi có thể ôm tiền, dựng thành viên ảo, hoặc lấy tiền dây này đắp dây kia.
- Rủi ro mà ít ai nói tới: **người đã hốt bỏ đóng**. Ở dữ liệu hụi (chit fund) tại Chennai, người hốt sớm bỏ đóng 2,04%, người hốt muộn 0,59% (Klonner & Rai 2008).

## Phát hiện then chốt

Chủ hụi truyền thống làm hai việc:

1. **Giữ tiền.** Đây là gốc của ôm tiền, hụi ảo và hụi chồng hụi.
2. **Bảo lãnh.** Chủ hụi bù khi người đã hốt bỏ đóng. Nghị định 19/2019 Điều 18 khoản 4 giao đúng nghĩa vụ này cho chủ hụi.

Bản hụi on-chain thông thường ("contract giữ tiền") bỏ cả hai việc, nên người hốt sau gánh hết rủi ro. Các dự án hụi on-chain trước đây hoặc bốc thăm ngẫu nhiên, hoặc đòi thế chấp gấp N lần, và chưa dự án nào định giá rủi ro người hốt sớm. **HụiSafe bỏ việc giữ tiền nhưng giữ việc bảo lãnh, bằng ký quỹ khóa trong contract.**

## Giải pháp: năm quy tắc

1. **Không ai cầm tiền.** Mỗi người ký permit một lần khi vào dây. Đến hạn, contract kéo tiền góp và chi cho người hốt trong cùng một giao dịch.
2. **Chủ hụi ký quỹ.** Ký quỹ tự động bù cho người bỏ đóng. Tiền công bị giữ lại; kỳ nào có khoản thiếu dẫn tới vỡ nợ thì tiền công kỳ đó chuyển vào quỹ dự phòng.
3. **Giữ lại một phần của người hốt sớm.** Phần này được nhả dần mỗi kỳ người đó đóng đúng hạn. Khi có người thiếu, tiền bù lấy lần lượt từ phần giữ lại của chính người đó, rồi ký quỹ, rồi quỹ dự phòng.
4. **Đấu thăm kín, không ngẫu nhiên.** Commit-reveal; trần lãi 20%/năm theo Điều 21 nằm trong code; hòa thì xét lịch sử đóng đúng hạn rồi thứ tự commit.
5. **Sổ họ số và Chỉ số bảo chứng.** Mọi sự kiện đều on-chain, xuất được sổ họ PDF. Trước khi vào dây, người chơi thấy dây được bảo chứng bao nhiêu phần trăm.

Toán cốt lõi:
- Tiền chưa đóng sau kỳ k là k(N − k)C, cao nhất ở giữa dây, bằng khoảng N²C/4.
- Chỉ số bảo chứng = tỷ lệ giữ lại + (ký quỹ + quỹ dự phòng) chia cho mức đỉnh đó.
- Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc. Nếu họ bỏ đóng lần lượt qua nhiều kỳ thì tổng thiếu có thể vượt ký quỹ (03 mục 7.3).

Chi tiết ở [03-dac-ta-giao-thuc.md](03-dac-ta-giao-thuc.md).

## Demo trong 30 giây

Dây 5 người × 100 USDC trên Fuji, chủ hụi ký quỹ 480 USDC, chỉ số bảo chứng 100%.

1. Kỳ 1: M4 bỏ thăm 6 USDC và thắng, nhận 288,48 USDC; 80 USDC bị giữ lại.
2. Kỳ 2: M4 không đóng. Contract lấy 80 USDC giữ lại của M4 và 20 USDC từ ký quỹ để bù. Người hốt kỳ 2 vẫn nhận đủ.
3. Đến hết dây, mọi người trung thực đều nhận đủ phần của mình (trong kịch bản này, một người đã hốt bỏ đóng).

Kịch bản đầy đủ ở [12-pitch-demo-nop-bai.md](12-pitch-demo-nop-bai.md).

## Ba câu hỏi bắt buộc của BTC

- **Why on-chain?** Lỗi gốc của hụi là phải tin người giữ tiền. Ứng dụng dùng cơ sở dữ liệu thì người vận hành thành chủ hụi mới. Ký quỹ chỉ đáng tin khi bị khóa bằng code mà chính chủ hụi không rút được.
- **Why Avalanche?**
  - Chuyển ERC-20 tốn khoảng $0,001.
  - Finality dưới 1 giây, hợp với phiên mở thăm trực tiếp.
  - Có USDC native với permit.
  - Sau này mỗi hội có thể có L1 riêng chỉ cho thành viên đã xác thực.
- **Tiền đến từ đâu?**
  - Tiền thăm do người hốt sớm trả cho người hốt sau.
  - Tiền công trả cho chủ hụi vì gánh rủi ro.
  - Lãi trên ký quỹ đến từ cho vay blue-chip trên mainnet (trên Fuji là giả lập).
  - Nền tảng thu một phần nhỏ tiền công. Không phát hành token.

## Pháp lý trong một đoạn

Hụi hợp pháp theo Bộ luật Dân sự 2015 Điều 471 và Nghị định 19/2019. HụiSafe đưa các điều 12, 14, 18, 21, 22 vào code và giao diện.

Góp hụi bằng USDC giữa người cư trú ở Việt Nam thì chưa hợp pháp:
- Nghị quyết 05/2025 chỉ cho thanh toán bằng VND.
- Nghị định 284/2026 phạt giao dịch ngoài tổ chức được cấp phép.
- Tiền mã hóa không phải phương tiện thanh toán.

Vì vậy cuộc thi chỉ demo trên testnet. Khi ra thị trường, sản phẩm sẽ có chế độ VND tại Việt Nam và chế độ USDC cho cộng đồng người Việt ở nước ngoài. Chi tiết ở [10-phap-ly-va-tuan-thu.md](10-phap-ly-va-tuan-thu.md).

## Công nghệ

| Lớp | Lựa chọn |
|---|---|
| Chuỗi | Avalanche Fuji C-Chain (43113), USDC của Circle |
| Contract | Solidity, Foundry, OpenZeppelin 5.x; `HuiFactory`, `HuiCircle` (clone EIP-1167), `ReputationRegistry`, `HuiMath` |
| Ví và gas | Privy embedded wallet; meta-transaction ERC-2771 nên người dùng không cần AVAX; USDC permit EIP-2612. Không tự build ERC-4337, không dùng EIP-7702 (C-Chain chưa hỗ trợ) |
| Web | Next.js 15, TypeScript, Tailwind, shadcn/ui, wagmi v2, viem v2 |
| Backend | API routes Next.js (`/api/relay`, `/api/attest`, `/api/copilot`) và `apps/keeper` |
| Mô phỏng | Python (numpy, pandas, matplotlib) |
| AI | Trợ lý chủ hụi dùng Claude API, chỉ đọc và tính, không ký, không chuyển tiền |

## Yếu tố AI agentic

1. **Lúc làm.** Claude Code với CLAUDE.md, các subagent chuyên trách, skill, hook và lệnh riêng, giúp ba người làm như một đội lớn. Hướng dẫn ở [ai-workflow/01-thiet-lap-claude-code.md](ai-workflow/01-thiet-lap-claude-code.md).
2. **Trong sản phẩm.** Trợ lý chủ hụi gợi ý ký quỹ, giải thích luật và soạn thông báo gửi UBND xã. Mọi con số do hàm tất định tính; trợ lý không bao giờ chạm vào tiền. Đúng luật agent của BTC. Chi tiết ở [07-ai-agentic.md](07-ai-agentic.md).

## Mốc chính

| Mốc | Ngày |
|---|---|
| Setup xong | 07/11 |
| Contract lõi có test | 10/11 |
| Deploy Fuji, workshop | 11/11 |
| MVP chạy đủ luồng trên Fuji | 14/11 |
| AI và thử với người dùng thật | 16/11 |
| Đóng băng tính năng | 17/11 |
| Nộp bài (dự phòng 21/11, hạn 23:59) | 20/11 |
| Demo Day nếu vào top 10 | 30/11 |

Kế hoạch đầy đủ ở [11-ke-hoach-trien-khai.md](11-ke-hoach-trien-khai.md).

## Đọc tiếp

| File | Nội dung |
|---|---|
| [01-nghien-cuu-nen-tang.md](01-nghien-cuu-nen-tang.md) | Kinh tế học hụi, các vụ vỡ hụi, dự án trước, phương pháp và paper |
| [02-dac-ta-san-pham.md](02-dac-ta-san-pham.md) | Người dùng, câu chuyện người dùng, màn hình, phạm vi |
| [03-dac-ta-giao-thuc.md](03-dac-ta-giao-thuc.md) | Luật vận hành, công thức, bất biến, ví dụ số (nguồn sự thật) |
| [04-kien-truc.md](04-kien-truc.md) | Kiến trúc, sơ đồ, thư mục, pipeline, ADR |
| [05-cau-truc-du-lieu-va-api.md](05-cau-truc-du-lieu-va-api.md) | Struct, interface, event, lỗi, EIP-712, API |
| [06-avalanche-va-blockchain.md](06-avalanche-va-blockchain.md) | Mạng, phí, chuẩn, deploy, verify, L1 bonus |
| [07-ai-agentic.md](07-ai-agentic.md) | Trợ lý chủ hụi, guardrail, bộ eval |
| [08-phong-mo-phong.md](08-phong-mo-phong.md) | Mô hình mô phỏng, thí nghiệm, chỉ số |
| [09-kiem-thu-va-bao-mat.md](09-kiem-thu-va-bao-mat.md) | Test, invariant, threat model, checklist |
| [10-phap-ly-va-tuan-thu.md](10-phap-ly-va-tuan-thu.md) | Nghị định 19, luật tiền mã hóa, dữ liệu cá nhân |
| [11-ke-hoach-trien-khai.md](11-ke-hoach-trien-khai.md) | Lịch, phân việc, rủi ro, checklist nộp |
| [12-pitch-demo-nop-bai.md](12-pitch-demo-nop-bai.md) | Slide, kịch bản demo, video, form nộp, hỏi đáp |
| [13-tai-lieu-tham-khao.md](13-tai-lieu-tham-khao.md) | Toàn bộ nguồn |
