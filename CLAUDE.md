# HụiSafe - hướng dẫn cho Claude Code

<!-- Nạp vào mọi phiên và mọi subagent. Giữ dưới 200 dòng. Quy trình dài đặt trong skills/commands. -->

## Tổng quan

HụiSafe (mã nguồn `huisafe`) là hụi bỏ thăm (ROSCA đấu thăm) on-chain trên Avalanche Fuji C-Chain (chainId 43113), dự thi Team1 Vietnam UniHack 2026, track Social finance. Tiền nằm trong ví từng thành viên cho đến lúc chi: lúc vào dây thành viên ký EIP-2612 `permit`, đến hạn `settleRound()` kéo tiền góp bằng `transferFrom` và chi cho người hốt trong cùng giao dịch. Chủ hụi không cầm tiền nhưng phải ký quỹ bảo lãnh; người hốt sớm bị giữ lại một phần (holdback); có quỹ dự phòng nhỏ; Nghị định 19/2019 chạy trong code (trần lãi, lãi chậm góp, ngưỡng thông báo UBND). Người dùng đăng nhập Privy embedded wallet, không trả gas nhờ meta-transaction ERC-2771 qua relayer. Câu chốt: "Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh."

## Nguồn sự thật

Hai file sau được nạp kèm file này (kể cả trong subagent). Code mâu thuẫn với tài liệu thì tài liệu thắng. Muốn đổi luật hay công thức: hỏi người trước, sửa tài liệu trước (03 rồi 05), rồi mới sửa code và test.

- Đặc tả giao thức (công thức, trạng thái, thác bù, bất biến): @docs/03-dac-ta-giao-thuc.md
- Dữ liệu, tên hàm, event, lỗi, typed data, API routes, tool trợ lý: @docs/05-cau-truc-du-lieu-va-api.md

Đọc khi cần (không nạp sẵn để tiết kiệm ngữ cảnh; chỉ mở mục đang cần):
- `docs/14-nang-cap-v1.2.md` và `docs/BAO-CAO-LEADER-09-11.md`: bản v1.2 của Minh và phản hồi; đã nhập vào 03/05 ở gói A13 (ADR-22, 24, 27 và hoa hồng trong trần, ADR-30); ADR-23, 25 không làm, đừng mở lại.
- `docs/04-kien-truc.md`: thành phần (mục 2), sơ đồ tuần tự (mục 3), cây thư mục (mục 4), pipeline và CI (mục 5), ADR-01..ADR-30 (mục 6), gas, log, biến môi trường (mục 7), sự cố (mục 8).
- `docs/11-ke-hoach-trien-khai.md`: mốc M0-M7 (mục 1), việc từng ngày (mục 3), mã việc C1..C13, W1..W13, T0..T10 (mục 4), định nghĩa xong (mục 5), rủi ro (mục 6), danh sách cắt (mục 7). Hook SessionStart in sẵn mốc và việc hôm nay.
- `docs/00-tong-quan.md`, `docs/02-dac-ta-san-pham.md` (PRD, màn hình S01-S15, quy tắc chữ), `docs/06-avalanche-va-blockchain.md`, `docs/07-ai-agentic.md` (trợ lý, eval), `docs/08-phong-mo-phong.md`, `docs/09-kiem-thu-va-bao-mat.md`, `docs/10-phap-ly-va-tuan-thu.md`, `docs/12-pitch-demo-nop-bai.md`, `docs/13-tai-lieu-tham-khao.md`, `docs/ai-workflow/01..03`.

## Bản đồ monorepo (pnpm workspaces)

```text
contracts/        Foundry. src/HuiFactory.sol, HuiCircle.sol, ReputationRegistry.sol,
                  src/libraries/{HuiMath,HuiTypes}.sol, src/interfaces/, src/yield/, src/mocks/MockUSDC.sol,
                  test/{unit,fuzz,invariant,integration}/, script/{Deploy,CreateDemoCircle}.s.sol,
                  deployments/fuji.json
packages/sdk/     ABI sinh bằng @wagmi/cli (plugin foundry), client đọc/ghi, typed data, src/huiMath.ts
packages/config/  chains, addresses, constants
apps/web/         Next.js 15 App Router; app/api/{relay,attest,copilot}
apps/keeper/      Node/TS theo lịch: settleRound, markDefault, finalize, cancel, nhắc hụi
sim/              Python: huisim/{model,policies,scenarios,metrics,cli,math}.py, scenarios/*.json, tests/, outputs/
docs/             tài liệu 00..13 + ai-workflow/
.claude/          settings.json, hooks/, skills/, agents/, commands/
```

## Lệnh chuẩn

```bash
pnpm install && pnpm -r build && pnpm -r lint && pnpm -r typecheck
cd contracts && forge build && forge test -vvv
forge test --match-path "test/invariant/*"
forge fmt --check && forge coverage && slither .
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify    # CHỈ Fuji, qua /deploy-fuji
pnpm --filter sdk generate      # sinh ABI
pnpm --filter web dev
pnpm --filter keeper start
cd sim && python -m huisim.cli run --scenario baseline --seed 42
```

## Quy ước code

Chung: code, tên biến, commit message tiếng Anh; tài liệu và UI tiếng Việt (ADR-15). Không emoji.

Solidity (0.8.x pin một bản, ví dụ 0.8.28; OpenZeppelin 5.x; Foundry):
- Custom errors, không `require` kèm chuỗi. Event cho MỌI thay đổi trạng thái và mọi dòng tiền.
- Checks-effects-interactions; `SafeERC20` cho mọi chuyển token; `nonReentrant` ở hàm chuyển tiền ra ngoài.
- Contract dùng `ERC2771Context` thì luôn `_msgSender()`, không `msg.sender`. KHÔNG `Multicall` cùng `ERC2771Context` (ADR-06).
- Mỗi dây là clone EIP-1167 (`Clones`) + `initialize()`; implementation gọi `_disableInitializers()`; factory tạo và khởi tạo clone trong cùng giao dịch.
- Vòng lặp qua thành viên chỉ chấp nhận vì N ≤ 30; một khoản chuyển thất bại không được làm hỏng cả kỳ (ghi `claimable`).
- USDC 6 decimals; bps chia 10_000; ghi rõ hướng làm tròn ở mỗi phép chia trong `HuiMath`.
- Không `block.prevrandao`, `blockhash` hay bất kỳ nguồn ngẫu nhiên nào để chọn người hốt.
- NatSpec cho mọi hàm public/external; tên hàm, event, lỗi đúng như docs/05 (`HuiMath`: đúng tên và thứ tự tham số ở docs/05 mục 3.5).

TypeScript: `strict: true`; viem v2 + wagmi v2 + TanStack Query; số tiền là `bigint`; ABI và địa chỉ chỉ lấy từ `packages/sdk` và `packages/config` (không chép tay); typed data EIP-712 domain name "HuiSafe", version "1"; domain của USDC permit đọc `name()`/`version()` từ contract lúc chạy. Biến bí mật chỉ đọc ở API routes và keeper, không bao giờ có tiền tố `NEXT_PUBLIC_`.

Python: 3.11+, type hints đầy đủ, `numpy.random.default_rng(seed)`; mọi kịch bản nhận `--seed`; kết quả ghi vào `sim/outputs/`. Ngẫu nhiên chỉ có trong mô phỏng ngoại tuyến (ADR-11).

## LUẬT CỨNG (không ngoại lệ)

1. Chỉ Avalanche Fuji (43113). Không bao giờ broadcast lên mainnet (43114, `api.avax.network`). Mainnet chỉ nói trong roadmap.
2. Không đọc, ghi, in, log hay commit bí mật: `.env*` (trừ `.env.example`), khóa riêng, keystore, API key. Con người tự điền `.env.local` và export trước khi mở `claude`.
3. Không có yếu tố ngẫu nhiên nào trong sản phẩm (contract, web, keeper, AI). Chia hòa thăm theo luật tất định.
4. Không dữ liệu cá nhân on-chain: chỉ địa chỉ ví và mã băm attestation.
5. LLM không bao giờ ký, không quyết định chuyển tiền. Trợ lý chủ hụi chỉ đọc và tính bằng hàm tất định (ADR-12).
6. Mọi luồng tiền có test: unit + fuzz + invariant (Handler) trước khi merge.
7. Admin (Safe; testnet: ví deployer) không có hàm rút tiền người dùng; chỉ thao tác qua factory: `pauseCircle`, `unpauseCircle`, `unwindCircle`. Pause chỉ chặn; `emergencyUnwind()` chỉ factory gọi, chỉ sau 48 giờ tạm dừng liên tục, trả tiền theo sổ.
8. Không tự build ERC-4337, không dùng EIP-7702 (ADR-03). Không bán token, không nhận tiền thật.

## Bất biến tiền (docs/03 mục 7.2; INV-01..INV-09 và INV-11..INV-13 mỗi cái một hàm invariant, INV-10 kiểm tĩnh bằng job `privacy` của CI)

- Trạng thái dây: `Forming → Active → Completed`, cộng `Cancelled`, `Paused`, `Unwound`. Thành viên: Live, Dead, Frozen, DefaultedDead (suy từ `received`, `defaulted`).
- Sổ cái: `usdc.balanceOf(circle) == bondRemaining + reserve + totalHoldback + Σ feeEscrow + revealBondsHeld + totalClaimable`. Tiền góp chỉ đi qua contract trong cùng giao dịch `settleRound()`.
- Mỗi thành viên hốt đúng một lần, mỗi kỳ đúng một người hốt; kỳ k chỉ chi sau kỳ k − 1 và sau `deadline(k)`; tham số bất biến sau `activate()`.
- Thăm thắng: 0 ≤ b ≤ `maxBid(k)` và b < C. Hoa hồng nằm trong trần lãi (INV-11, docs/03 mục 2.7): với `commissionShareBps` φ > 0, `maxBid(k)` thực thi là `⌊maxBid_luật·(10000 − φ)/10000⌋`, `fee_k = min(φ·room_k, feeBps·pot)` với `room_k = maxBid_luật·L_k`, nên `fee + b·L_k ≤ room_k`; φ = 0 giữ tiền công cố định `feeBps·pot`. Chân của chủ hụi hốt thì `fee = 0`. Kỳ không có khoản thiếu: tiền công trả thẳng chủ hụi lúc chi kỳ (`FeePaid`); kỳ có khoản thiếu: escrow như cũ. `payout + fee + premium + H (+ trả nợ) == pot`; chia làm tròn xuống, phần dư lẻ về người hốt kỳ đó.
- Holdback (INV-06): sau m kỳ, mỗi người đã hốt chưa vỡ nợ có holdback ≤ α·(N − m)·C, bằng (sai số ≤ N đơn vị) khi người đó không còn khoản thiếu mở và lúc hốt đã giữ đủ H; mọi người đóng đúng hạn thì tổng = α·O(m), O(m) = m(N − m)C. `payLate` hoàn nguồn xong thì nhả phần α·C đã bị bỏ qua của kỳ đó.
- Thác bù: holdback của chính người thiếu → ký quỹ → quỹ dự phòng → `uncovered` (khoản đòi công khai). Thứ tự hoàn (docs/03 mục 6.8; cho `payLate`, `repayDebt`, pot của người Frozen, `finalize`): khoản cũ trước; trong mỗi khoản `uncovered` (trả thẳng người hốt kỳ đó) → quỹ dự phòng → ký quỹ → holdback; gốc trước, lãi chậm góp sau.
- CI = 100% và chỉ người đã hốt bỏ đóng, tất cả cùng bỏ đóng trong một kỳ (cú sốc đồng thời lớn nhất), thì `uncovered == 0` ở mọi kỳ; bỏ đóng lần lượt qua nhiều kỳ có thể vượt ký quỹ (docs/03 mục 7.3, cận bù đủ B_seq = (1 − α)·N(N−1)/2·C là roadmap). `activate()` cần `coverageIndexBps ≥ minCoverageBps` (10_000 trên Fuji, bắt buộc, ADR-22; 5000 chỉ anvil/test). Câu cam kết về ví ảo: "Cọc 100% chặn được chủ hụi dùng một ví ảo (tự lỗ); nhiều ví ảo thì chặn bằng xác thực mỗi người một tài khoản và mọi người thấy trước rủi ro tối đa" (docs/03 mục 7.3); không viết "cọc 100% chặn gian lận". Allowance vào dây = (N − 1)·(C + revealBond).
- Quỹ dự phòng cuối dây chia theo đúng hạn (ADR-24, INV-12): `w = max(0, (N − 1) − lateCount)`, vỡ nợ w = 0, dư lẻ cho `joinIndex` nhỏ nhất có w > 0; `emergencyUnwind` chia đều. Thỏa thuận dây có `termsHash` bất biến (ADR-27, `InvalidParams(16)` nếu 0).
- USDC chỉ đi tới thành viên, chủ hụi (ký quỹ, tiền công hợp lệ, kể cả trả ngay mỗi kỳ) và người có `claimable`; không bao giờ tới admin. Khi `Paused` chỉ `claim()` chạy, hàm khác revert `CircleIsPaused()` (event vẫn là `CirclePaused`); thời gian dừng cộng vào `pausedTotal`.

## Tiến độ và làm việc nhóm

- Tiến độ chung nằm ở `docs/TIEN-DO.md`; hook SessionStart in sẵn phần TÓM TẮT. Câu trả lời đầu tiên của mỗi phiên báo tiến độ đó cho người dùng trong tối đa 5 dòng, không mở thêm file chỉ để báo.
- Xong một việc đáng kể (mốc, mã việc C/W/T, PR) thì sửa phần TÓM TẮT của `docs/TIEN-DO.md` trong cùng commit/PR, giữ dưới 15 dòng; nhận việc thì ghi tên vào bảng Thành viên.
- Thành viên làm qua nhánh riêng và PR vào `main` (Towfienes review, merge); không push thẳng `main`.

## Quy trình làm việc

1. Lập kế hoạch ở plan mode (Shift+Tab hoặc `/plan`; theo mốc: `/plan-milestone M1`). Đọc docs liên quan trước khi đề xuất.
2. Thực hiện từng phần nhỏ (`/implement <việc>`), giao cho subagent đúng chuyên môn.
3. Test: `forge test -vvv`, invariant, `pnpm -r typecheck`, `pnpm -r test`, `pytest`. Hook tự chạy `forge fmt` + `forge build` sau mỗi lần sửa `.sol`.
4. Audit: mọi thay đổi trong `contracts/` hoặc luồng tiền phải qua subagent `security-auditor` (`/audit`). Sửa hết mức Critical/High.
5. Commit theo Conventional Commits tiếng Anh (`feat(contracts): ...`), mở PR, người review rồi mới merge.

## Definition of Done

- [ ] Đúng đặc tả docs/03, đúng tên trong docs/05; tài liệu đã cập nhật nếu hành vi đổi.
- [ ] `forge fmt --check`, `forge build`, `forge test` (gồm invariant) xanh; luồng tiền mới có unit + fuzz + invariant.
- [ ] `pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test` xanh; `pytest` xanh nếu đụng `sim/`.
- [ ] `security-auditor` không còn Critical/High; Slither sạch mức high.
- [ ] Không bí mật trong diff; không địa chỉ hard-code ngoài `packages/config` và `contracts/deployments/fuji.json`.
- [ ] UI tiếng Việt, mobile-first; mọi số tiền hiển thị kèm đơn vị USDC.
- [ ] Có ghi chú cách kiểm chứng (lệnh đã chạy, tx hash Fuji nếu có).

## Khi nào dùng gì

| Việc | Dùng |
|---|---|
| Lập kế hoạch một mốc | `/plan-milestone M<n>` |
| Làm một đầu việc từ đầu đến cuối | `/implement <mô tả>` |
| Viết/sửa contract | subagent `solidity-engineer` + skill `hui-protocol`, `foundry-fuji` |
| Unit/fuzz/invariant, differential test | subagent `test-engineer` |
| Review bảo mật, Slither (chỉ đọc) | subagent `security-auditor` hoặc `/audit` |
| Web, ví Privy, permit, relay, keeper | subagent `frontend-engineer` + skill `web3-frontend` |
| Mô phỏng Python, số liệu pitch | subagent `simulation-analyst` |
| Slide, kịch bản video, bài nộp, pháp lý | subagent `pitch-writer` + skill `vn-legal-pitch` |
| Deploy + verify Fuji | `/deploy-fuji` (người duyệt lệnh broadcast) |
| Đồng bộ ABI/địa chỉ sang sdk | `/sync-abi` |
| Kiểm tra trước demo/nộp bài | `/demo-check` |

## Môi trường và bí mật

Biến trong `.env.local` (không commit; mẫu ở `.env.example` với giá trị rỗng): `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY` (chỉ ví testnet), `RELAYER_PRIVATE_KEY`, `ATTESTER_PRIVATE_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN` (bonus), `SNOWTRACE_API_KEY` (nếu cần); thêm theo docs/04 mục 7.4: `KEEPER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `FUJI_RPC_URL_FALLBACK`. Mỗi vai một ví testnet riêng (ADR-21).
- Claude không mở các file này. Kiểm tra biến có hay chưa mà không in giá trị: `for v in FUJI_RPC_URL DEPLOYER_PRIVATE_KEY; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done`.
- Foundry đọc khóa trong script bằng `vm.envUint("DEPLOYER_PRIVATE_KEY")`, không truyền khóa trên dòng lệnh.
- USDC Fuji: `0x5425890298aed601595a70AB815c96711a31Bc65` (kiểm lại tại developers.circle.com); test dùng `MockUSDC`.
- Hook trong `.claude/hooks/` chặn đọc/ghi file bí mật, chặn broadcast ngoài Fuji và chạy fmt/build sau khi sửa `.sol`. Không tắt hook để "cho nhanh".
