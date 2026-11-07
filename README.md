# Bộ tài liệu triển khai HụiSafe

Phiên bản 1.1, ngày 06/11/2026. Dự án dự thi Team1 Vietnam UniHack 2026 (Avalanche). Hạn nộp: 23:59 thứ Bảy 21/11/2026; mục tiêu nộp: tối 20/11.

Bộ tài liệu này đủ để một đội 3 người cùng AI lập trình (Claude Code) dựng HụiSafe từ con số không đến bài nộp. Gồm:

- Đặc tả sản phẩm, đặc tả giao thức, kiến trúc, cấu trúc dữ liệu.
- Phần Avalanche, AI agentic, phòng mô phỏng, kiểm thử và bảo mật.
- Pháp lý, kế hoạch, pitch, tài liệu tham khảo.
- Bộ cấu hình Claude Code dùng ngay: `CLAUDE.md`, skill, subagent, lệnh, hook, settings.

Thư mục được sắp đúng như gốc repo, nên chỉ cần chép vào là dùng.

---

## 1. Cách dùng trong 5 bước

1. **Chép vào repo.** Chép toàn bộ nội dung thư mục này vào gốc repo `Towfienes/T1VN_Unihack`, giữ nguyên `CLAUDE.md`, `.claude/` và `docs/`. Chuyển file cũ `docs/MASTER_RESEARCH_REPORT.md` vào `docs/archive/`; file đó có nhiều chỗ sai, xem mục 6. Commit một lần: `docs: add HuiSafe implementation pack v1.1`.
2. **Cài Claude Code** và mở trong thư mục repo. Đọc [docs/ai-workflow/01-thiet-lap-claude-code.md](docs/ai-workflow/01-thiet-lap-claude-code.md) để bật hook, quyền và MCP. Cấp quyền chạy cho các script hook: `chmod +x .claude/hooks/*.sh`.
3. **Chạy prompt khởi động** ở mục 2, rồi đi lần lượt từng mốc theo [docs/ai-workflow/02-prompt-playbook.md](docs/ai-workflow/02-prompt-playbook.md).
4. **Giữ tài liệu là nguồn sự thật.** Muốn đổi luật vận hành: sửa `docs/03` trước, rồi `docs/05`, rồi test, rồi mới đến code. Claude Code được dặn làm đúng thứ tự này trong `CLAUDE.md`.
5. **Trước khi nộp:** chạy `/demo-check` và đi hết checklist trong [docs/11-ke-hoach-trien-khai.md](docs/11-ke-hoach-trien-khai.md).

## 2. Prompt khởi động (dán vào Claude Code)

`CLAUDE.md` tự nạp kèm `docs/03` và `docs/05`, nên không cần bảo Claude đọc lại hai file đó. Cách nhanh nhất là gõ `/plan-milestone M0`. Nếu muốn mở đầu bằng lời, dán prompt sau:

```text
Bạn là kỹ sư chính của dự án HụiSafe. CLAUDE.md, docs/03 và docs/05 đã được nạp sẵn.
Đọc thêm docs/00-tong-quan.md, docs/04-kien-truc.md mục 4 (cây thư mục) và mục 5 (pipeline, CI),
docs/11-ke-hoach-trien-khai.md mục 1, 3 và 4.
Sau đó vào plan mode và lập kế hoạch cho mốc M0: setup monorepo (Foundry, pnpm workspaces,
Next.js, sim Python, CI, deployments rỗng). Liệt kê file sẽ tạo và lệnh kiểm tra.
Chưa viết code cho tới khi tôi duyệt kế hoạch.
Mọi luật vận hành phải khớp docs/03; mọi tên hàm, struct, event, lỗi phải khớp docs/05.
```

## 3. Thứ tự đọc theo vai trò

| Vai trò | Đọc theo thứ tự |
|---|---|
| Trưởng nhóm / điều phối | 00 → 11 → 02 → 12 → 10 |
| Người làm contract (P1) | 00 → 03 → 05 → 09 → 06 → `.claude/skills/hui-protocol`, `foundry-fuji` |
| Người làm frontend, ví, relayer, keeper (P2) | 00 → 02 → 04 → 05 → 06 → `.claude/skills/web3-frontend` |
| Người làm mô phỏng, AI, pitch (P3) | 00 → 01 → 08 → 07 → 12 → 10 |
| AI (Claude Code) | `CLAUDE.md` tự nạp cùng `docs/03` và `docs/05` (dẫn bằng `@`); các file khác chỉ mở khi cần, theo danh sách trong `CLAUDE.md` |

## 4. Bản đồ file

| File | Nội dung |
|---|---|
| `CLAUDE.md` | Bộ nhớ dự án cho Claude Code: tổng quan, lệnh, quy ước, luật cứng, quy trình, định nghĩa xong |
| `docs/00-tong-quan.md` | Một trang tổng quan |
| `docs/01-nghien-cuu-nen-tang.md` | Kinh tế học ROSCA, vụ vỡ hụi, dự án trước, phương pháp SOTA, cơ hội viết paper |
| `docs/02-dac-ta-san-pham.md` | PRD: persona, user story có tiêu chí nghiệm thu, màn hình, phạm vi |
| `docs/03-dac-ta-giao-thuc.md` | **Nguồn sự thật**: ký hiệu, công thức, vòng đời, từng bước một kỳ, thác bù, bất biến, ví dụ số |
| `docs/04-kien-truc.md` | Kiến trúc C4, sơ đồ tuần tự, cây thư mục, pipeline, ADR, yêu cầu phi chức năng |
| `docs/05-cau-truc-du-lieu-va-api.md` | **Nguồn sự thật**: struct, interface, event, lỗi, EIP-712, SDK, API, keeper, sổ họ, schema mô phỏng, tool của trợ lý |
| `docs/06-avalanche-va-blockchain.md` | Fuji, USDC, phí, chuẩn EIP/ERC, deploy và verify, kế hoạch L1 bonus |
| `docs/07-ai-agentic.md` | Trợ lý chủ hụi, guardrail, bộ eval, bot nhắc hụi |
| `docs/08-phong-mo-phong.md` | Mô hình mô phỏng, thí nghiệm, chỉ số, cách dùng kết quả |
| `docs/09-kiem-thu-va-bao-mat.md` | Unit, fuzz, invariant, differential test, Slither, threat model, checklist |
| `docs/10-phap-ly-va-tuan-thu.md` | Nghị định 19, luật tiền mã hóa, dữ liệu cá nhân, câu nói khi pitch |
| `docs/11-ke-hoach-trien-khai.md` | Mốc, lịch từng ngày, phân việc, rủi ro, danh sách cắt giảm, checklist nộp |
| `docs/12-pitch-demo-nop-bai.md` | Slide, kịch bản demo, video, nội dung form nộp, chuẩn bị hỏi đáp |
| `docs/13-tai-lieu-tham-khao.md` | Toàn bộ nguồn, có link |
| `docs/ai-workflow/01-thiet-lap-claude-code.md` | Cài đặt, settings, hook, MCP, plugin, quản lý ngữ cảnh |
| `docs/ai-workflow/02-prompt-playbook.md` | Prompt dán sẵn cho từng mốc M0 đến M7 |
| `docs/ai-workflow/03-quy-trinh-lam-viec.md` | Nhánh, PR, vòng review với subagent, CI, nhịp làm việc |
| `.claude/settings.json` | Quyền và hook |
| `.claude/hooks/` | Script hook: chặn đọc/ghi file bí mật, chặn broadcast ngoài Fuji, tự format và build file .sol, in mốc và việc hôm nay khi mở phiên. `test-hooks.sh` tự kiểm cả bộ (`bash .claude/hooks/test-hooks.sh`, cần `jq`) |
| `.claude/skills/` | Kiến thức chuyên môn: `hui-protocol`, `foundry-fuji`, `web3-frontend`, `vn-legal-pitch` |
| `.claude/agents/` | Subagent: `solidity-engineer`, `test-engineer`, `security-auditor`, `frontend-engineer`, `simulation-analyst`, `pitch-writer` |
| `.claude/commands/` | Lệnh: `/plan-milestone`, `/implement`, `/audit`, `/deploy-fuji`, `/demo-check`, `/sync-abi` |

Thứ bậc khi có mâu thuẫn: `docs/03` > `docs/05` > `docs/04` > các file còn lại. `CLAUDE.md` và skill chỉ tóm tắt và dẫn về các file này.

## 5. Phải kiểm tra lại trước khi code

| Việc | Vì sao | Ở đâu |
|---|---|---|
| Địa chỉ USDC trên Fuji `0x5425890298aed601595a70AB815c96711a31Bc65` | Lấy từ tài liệu Avalanche và Circle; cần đối chiếu lần cuối | developers.circle.com, `docs/06` |
| `name()` và `version()` của USDC cho permit | Không hard-code domain EIP-712 | `docs/05` mục 5.2 |
| API `ERC2771Forwarder` của đúng phiên bản OpenZeppelin đã cài | Tên trường và typehash có thể khác giữa các bản | `docs/05` mục 5.3 |
| URL verify contract trên Snowtrace/Routescan | Định dạng có thể đổi | `docs/06` |
| Diễn giải trần lãi (Điều 21) và quy tắc chia hòa thay bốc thăm (Điều 20-21) | Cần luật sư hoặc mentor xác nhận | `docs/10` |
| Phiên bản Claude Code và định dạng hook | Claude Code cập nhật thường xuyên; hook mới được thử bằng JSON mẫu, chưa chạy trong phiên thật | `docs/ai-workflow/01` |
| Hook của repo có chạy trên runner GitHub Actions không | Chưa thử; CI không được dựa vào hook để chặn lỗi | `docs/ai-workflow/01` mục 15 |
| Cấu hình Privy tự tạo ví (`embeddedWallets.ethereum.createOnLogin`) | Tên khóa khác giữa các bản SDK | `.claude/skills/web3-frontend` |

## 6. Điểm khác so với tài liệu trước của nhóm

So với `docs/MASTER_RESEARCH_REPORT.md` (Gemini viết):

- **YieldGO không nên là lựa chọn số 1.** BTC xếp độ khó 5/5 và đã có đội làm.
- **Không làm tokenomics để niêm yết.** Luật cuộc thi cấm bán token cho công chúng.
- **Không có gì bảo đảm "L1 + ICM ăn trọn 25/25".**
- **Không dùng Avalanche-CLI.** Công cụ này chỉ còn chế độ bảo trì từ 12/2025; dùng Builder Console.
- **Dev toggle phải khai báo ngay đầu buổi pitch.**

So với bản phân tích top 5 ý tưởng trước đó:

- **Thang 25 điểm Avalanche Integration có chia 5 phần × 5 điểm**, ghi trong `topics.json`.
- **Demo x402 và Privy của BTC tải được dạng ZIP** ở trang demos, chỉ là không có repo GitHub.
- **Đổi lựa chọn ví.** Không dùng ví passkey ERC-4337 làm chính nữa, vì BTC dặn không tự build ERC-4337 và C-Chain chưa có EIP-7702. Thay bằng ví nhúng Privy cộng meta-transaction ERC-2771; passkey chỉ là bonus.
- **Mục tiêu nộp dời sang 20/11**, để 21/11 làm ngày dự phòng.

## 7. Ghi chú

- Mọi nội dung pháp lý là tổng hợp nghiên cứu, không phải tư vấn pháp lý.
- Số liệu mô phỏng trong tài liệu là chỗ trống cho tới khi đội chạy phòng mô phỏng; không đưa số chưa chạy vào slide.
- Ngẫu nhiên chỉ dùng trong mô phỏng ngoại tuyến (có seed) và để sinh salt giữ bí mật thăm. Sản phẩm không dùng ngẫu nhiên để chia tiền hay chọn người hốt.
