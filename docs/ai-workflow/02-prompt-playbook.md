# Prompt playbook theo mốc M0 tới M7

**Mục đích và đọc khi nào.** Đây là bộ prompt chép-dán cho Claude Code, xếp theo mốc của [../11-ke-hoach-trien-khai.md](../11-ke-hoach-trien-khai.md) và theo mã việc (C1..C13 của P1, W1..W13 của P2, T0..T10 của P3). Mỗi prompt ghi: mục tiêu, file phải đọc, ràng buộc, tiêu chí chấp nhận, subagent hoặc lệnh dùng, cách kiểm chứng. Dùng mỗi khi bắt đầu một đầu việc. Cài đặt bộ kit ở [01-thiet-lap-claude-code.md](01-thiet-lap-claude-code.md); quy trình nhánh, PR, review ở [03-quy-trinh-lam-viec.md](03-quy-trinh-lam-viec.md).

## Cách dùng

1. Mở `claude` ở gốc repo (hoặc worktree của mình). Hook SessionStart in mốc hiện tại và việc hôm nay.
2. Ngày đầu một mốc: chạy `/plan-milestone M<n>` trước.
3. Chép prompt trong khối `text`, thay phần `<...>`, gửi. Prompt bắt đầu bằng `/implement` thì toàn bộ chữ sau tên lệnh là tham số của lệnh.
4. Việc đụng tiền: luôn để Claude lập kế hoạch ở plan mode trước (Shift+Tab hoặc `/plan`), duyệt rồi mới cho sửa.
5. Xong việc: làm đúng phần "Kiểm chứng", mở PR theo mẫu ở 03 mục 4.

Không cần dán lại luật cứng hay đặc tả tiền: CLAUDE.md đã nạp sẵn docs/03 và docs/05. Các file khác (docs/02, 04, 06..12) không được nạp sẵn, nên prompt ghi rõ mục cần đọc ở dòng "Đọc trước". Prompt chỉ ghi phần riêng của việc.

---

## M0 - Setup (hạn T7 07/11)

Việc của người, làm trước, không qua Claude: tạo 4 ví vai trò (deployer, relayer, attester, keeper) và 6 ví demo (chủ hụi, M1..M5) bằng terminal riêng hoặc ví Core; xin AVAX (faucet Team1, faucet Core với coupon `avalanche-academy`) và USDC (faucet.circle.com, chọn Avalanche Fuji); tạo app Privy; điền `.env.local`; Builder Pass 3/3 (docs/11 mục 10).

### P0.1 Kiểm bộ kit Claude Code (P3, T0)

Dùng: phiên chính. Kiểm chứng: lệnh trong prompt chạy xanh; người tự thử 4 bước live ở 01 mục 14.3.

```text
Kiểm tra bộ cấu hình Claude Code vừa chép vào repo, chưa sửa gì.
1. Chạy: python3 -m json.tool .claude/settings.json >/dev/null && echo settings OK
2. Chạy: bash .claude/hooks/test-hooks.sh  (phải 0 FAIL)
3. Liệt kê .claude/skills, .claude/agents, .claude/commands; với mỗi file, kiểm frontmatter có name/description (agent, skill) hoặc description (command).
4. Kiểm 2 file CLAUDE.md import (docs/03-dac-ta-giao-thuc.md, docs/05-cau-truc-du-lieu-va-api.md) và các file nó trỏ tới (docs/04-kien-truc.md, docs/11-ke-hoach-trien-khai.md) có tồn tại.
5. Kiểm .gitignore có .env, .env.*, !.env.example, .claude/settings.local.json, CLAUDE.local.md, .claude/worktrees/.
Báo bảng: mục | kết quả | việc cần người làm. Không sửa file nào.
```

### P0.2 Khung monorepo (P2 + P3, W1 phần khung, T0)

Dùng: plan mode → `/implement`; `frontend-engineer` cho phần TypeScript. Kiểm chứng: lệnh ở tiêu chí chấp nhận; CI chạy trên PR đầu.

```text
/implement W1 + T0: dựng khung monorepo HụiSafe (chưa có logic nghiệp vụ)

Mục tiêu: cấu trúc thư mục đúng docs/04 mục 4, cài đặt chạy được, CI chạy được trên khung rỗng.
Đọc trước: docs/04 mục 4 và 5.2, docs/ai-workflow/03 mục 6 (ci.yml đầy đủ), CLAUDE.md mục Môi trường.
Ràng buộc:
- pnpm workspaces (pnpm-workspace.yaml: packages/*, apps/*); package.json gốc có "packageManager": "pnpm@<bản 10.x đang cài>" và script build, lint, typecheck, test gọi pnpm -r.
- apps/web: Next.js 15 App Router, TypeScript strict, Tailwind; apps/keeper: Node/TS; packages/sdk, packages/config: TS strict, vitest. Chỉ cài gói trong stack ADR-08 (docs/04 mục 6); gói khác phải hỏi.
- sim/: pyproject.toml, Python 3.11+, numpy, pandas, matplotlib, pytest (extra "dev").
- .gitignore theo docs/04 mục 4 và 01 mục 2; .env.example chỉ có tên biến (danh sách trong CLAUDE.md), giá trị rỗng. Không tạo .env.local.
- .github/workflows/ci.yml chép đúng bản ở docs/ai-workflow/03 mục 6; .github/pull_request_template.md theo 03 mục 4.
- Phần contracts/ để P0.3 làm.
Tiêu chí chấp nhận:
- pnpm install && pnpm -r build && pnpm -r typecheck thành công.
- Cây thư mục khớp docs/04 mục 4 (liệt kê chỗ cố ý chưa tạo).
- Commit "chore: scaffold monorepo" trên nhánh chore/scaffold.
```

### P0.3 Khung Foundry, kiểu dữ liệu, interface, MockUSDC (P1, C1)

Dùng: `/implement` → `solidity-engineer`. Kiểm chứng: `cd contracts && forge build && forge fmt --check`; `.gitmodules` trỏ đúng `contracts/lib/...`.

```text
/implement C1: khung Foundry trong contracts/ + HuiTypes + interfaces + MockUSDC

Mục tiêu: contracts/ build được, có đủ kiểu và interface đúng tên docs/05 để các việc C2..C7 dựa vào.
Đọc trước: skill foundry-fuji mục 2, docs/05 mục 1-4 (HuiTypes, IHuiFactory, IHuiCircle, IReputationRegistry, IUSDCPermit, IYieldAdapter, event, lỗi), docs/04 mục 4 (cây contracts/).
Ràng buộc:
- foundry.toml đúng mẫu skill foundry-fuji (solc ghim, evm_version cancun, fuzz/invariant, profile ci, rpc_endpoints fuji, etherscan fuji Routescan, fs_permissions).
- forge-std và OpenZeppelin Contracts 5.x vào contracts/lib làm submodule ghim tag. forge install mặc định lấy gốc repo git làm root: chạy trong contracts/ với --root . nếu cần và kiểm .gitmodules trỏ contracts/lib/....
- remappings.txt, slither.config.json (filter_paths lib/|test/|script/, exclude_dependencies).
- src/libraries/HuiTypes.sol và src/interfaces/*.sol chép đúng docs/05 (tên, kiểu, thứ tự trường). Event và lỗi đặt đúng chỗ docs/05 mục 4.
- src/mocks/MockUSDC.sol: 6 decimals, EIP-2612 permit (name/version đọc được, version "2"), EIP-3009 receiveWithAuthorization, chế độ chặn địa chỉ (blacklist) để test claimable.
- test/utils/BaseTest.sol khung: dựng MockUSDC, tạo actor, helper ký permit.
Tiêu chí chấp nhận:
- forge build, forge fmt --check xanh; forge test chạy được (ít nhất test MockUSDC: permit đúng domain, blacklist làm transfer revert).
- Không có tên nào khác docs/05.
```

---

## M1 - Contract lõi (hạn T3 10/11)

### P1.1 HuiMath + vector chung ba ngôn ngữ (P1 C2, P3 T1)

Dùng: `/implement` → `solidity-engineer` (Solidity), `test-engineer` (unit, fuzz, differential), `simulation-analyst` (math.py, vector), `frontend-engineer` (huiMath.ts). Kiểm chứng: `forge test --match-path "test/unit/HuiMath.t.sol"`, `forge test --match-path "test/fuzz/*"`, `pnpm --filter sdk test`, `cd sim && pytest -q`; cả ba đọc cùng `contracts/test/vectors/huimath.json`.

```text
/implement C2 + T1: thư viện HuiMath (Solidity) cùng bản TS và Python khớp từng đơn vị

Mục tiêu: một nguồn công thức duy nhất cho mọi phép tính tiền, có test differential.
Đọc trước: docs/03 mục 2 (công thức), mục 8 (bảng maxBid), docs/05 mục 3.5 (chữ ký hàm), skill hui-protocol mục 2.
Ràng buộc:
- contracts/src/libraries/HuiMath.sol đúng tên và thứ tự tham số docs/05 mục 3.5: exposure(n, k, c), maxExposure(n, c), holdbackFor(alphaBps, n, k, c), releasePerRound(alphaBps, c), coverageIndexBps(alphaBps, bond, reserve_, n, c) (tối đa 10_000), maxBid(capBps, n, k, c, periodSec, payers) (payers = 0 thì 0; trả min(..., c − 1)), lateFee(amount, lateRateBps, elapsedSec, periodSec, roundDuration) (timeScale = periodSec/roundDuration), bpsOf(amount, bps). Chia xuống, ghi hướng làm tròn trong NatSpec.
- packages/sdk/src/huiMath.ts dùng bigint; sim/huisim/math.py dùng int; cùng tên, cùng thứ tự tham số.
- python -m huisim.cli vectors --seed 7 --out ../contracts/test/vectors/huimath.json sinh vector (gồm biên N = 3, N = 30, C lớn nhất 10_000 USDC, k = 1, k = N − 1, L = 0).
- Test: test/unit/HuiMath.t.sol (bảng maxBid docs/03 mục 8: 6,575342 / 4,931506 / 3,287671 / 1,643835; Bản án 48/2024: thăm 450.000 dưới trần), test/fuzz/HuiMath.fuzz.t.sol (đơn điệu, không tràn), test/fuzz/Differential.t.sol (đọc vector bằng vm.readFile), vitest và pytest đọc cùng file.
Tiêu chí chấp nhận: ba bản cho kết quả giống hệt trên mọi vector; mọi test xanh; không bật ffi.
```

### P1.2 HuiFactory (P1, C3)

Dùng: `/implement` → `solidity-engineer`, rồi `test-engineer`. Kiểm chứng: `forge test --match-path "test/unit/HuiFactory.t.sol" -vvv` phủ 13 mã `InvalidParams`.

```text
/implement C3: HuiFactory với clone EIP-1167, danh bạ, cấu hình, đếm dây theo chủ hụi

Đọc trước: docs/05 mục 3.1, 4.3 (mã InvalidParams 1..13), docs/03 mục 3.1 và 4, docs/04 mục 2 (dòng HuiFactory).
Ràng buộc:
- createCircle(CircleParams) dùng Clones, gọi initialize trong cùng giao dịch, phát CircleCreated; kiểm tham số theo bảng mã lỗi; người tạo = _msgSender() (ERC2771Context), không Multicall.
- allCircles, circlesOf, activeCirclesOf, isCircle; onActivated/onFinished chỉ circle hợp lệ gọi; setConfig chỉ admin và chỉ áp dụng cho dây tạo sau; pauseCircle/unpauseCircle/unwindCircle chỉ admin (unwindCircle chỉ khi dây đã Paused liên tục ≥ 48 giờ, rồi gọi emergencyUnwind của dây; test đầy đủ ở C7).
- HuiCircle lúc này mới là khung (initialize + params()) đủ để factory test được.
Tiêu chí chấp nhận: test cho từng mã InvalidParams, quyền admin, isCircle, activeCirclesOf tăng/giảm qua onActivated/onFinished; forge build --sizes ổn.
```

### P1.3 Forming: ký quỹ, vào dây, kích hoạt (P1, C4)

Dùng: plan mode → `/implement` → `solidity-engineer`, `test-engineer`. Kiểm chứng: `forge test --match-path "test/unit/HuiCircleForming.t.sol" -vvv`.

```text
/implement C4: luồng Forming của HuiCircle

Đọc trước: docs/03 mục 5.1, 3.1, 10 (attestation, permit), docs/05 mục 2.1 (bố cục lưu trữ), 3.2, 4, 5.1-5.2, docs/04 mục 3.1-3.2 (sơ đồ tuần tự).
Ràng buộc:
- depositBond(amount, permit) chỉ organizer; withdrawBond chỉ khi Cancelled; join(att, attSig, permit): kiểm att.member == _msgSender(), att.circle == address(this), expiry, chữ ký attester (EIP-712 domain "HuiSafe" version "1", verifyingContract = clone), attestationId chưa dùng; permit trong try, lỗi thì vẫn nhận nếu allowance ≥ requiredAllowance(); ghi joinIndex.
- leave() trước kích hoạt: người vào sau lùi lên một bậc giữ nguyên thứ tự, joinIndex luôn liên tục từ 0; rời rồi không vào lại được dây đó (attestationId theo cặp người dùng, dây đã bị đánh dấu dùng).
- activate() chỉ organizer, đủ N (thiếu thì CircleNotFull(have, need)), trước joinDeadline, coverageIndexBps ≥ minCoverageBps (5000); cancel() ai cũng gọi sau joinDeadline; withdrawBond lần hai thì NothingToWithdraw.
- requiredAllowance() = (N − 1)·(C + revealBond); guaranteedCoverageBps() dùng R = 0.
- Mỗi thay đổi trạng thái một event (docs/05 mục 4.1). Implementation gọi _disableInitializers().
Tiêu chí chấp nhận: test happy path và từng lỗi (BadAttestation, AttestationUsed, AttestationExpired, InsufficientAllowance, CoverageTooLow, CircleNotFull, JoinClosed, CircleFull, AlreadyMember, NothingToWithdraw); test permit bị gửi trước vẫn join được; test leave dồn joinIndex và chặn vào lại; INV-01 đúng sau mỗi hàm.
```

### P1.4 Bỏ thăm kín và chọn người hốt (P1, C5)

Dùng: `/implement` → `solidity-engineer`, `test-engineer`. Kiểm chứng: `forge test --match-path "test/unit/HuiCircleBidding.t.sol" -vvv`.

```text
/implement C5: commitBid, revealBid, chọn người hốt tất định

Đọc trước: docs/03 mục 3.2 (cửa sổ), 6.1-6.4, docs/05 (Commit, RoundPhase, BidCommitted, BidRevealed, RevealBondForfeited, lỗi NotInCommitWindow, NotInRevealWindow, NotEligibleToBid, NoCommit, CommitMismatch, AlreadyRevealed, BidTooHigh).
Ràng buộc:
- commitHash = keccak256(abi.encode(address(this), round, member, bid, salt)); kéo revealBond lúc commit; ghi đè trong cửa sổ commit giữ cọc, nhận commitIndex mới.
- revealBid revert nếu bid > maxBid(k) hoặc bid ≥ C; hợp lệ thì trả cọc, cập nhật thăm dẫn đầu theo (thăm cao hơn, ít lần trễ hơn = trễ trong dây + lateCount ở ReputationRegistry, commitIndex nhỏ hơn).
- Fixed: commitWindow = revealWindow = 0, người hốt theo joinIndex, Frozen xuống cuối. Không ai thăm: người sống joinIndex nhỏ nhất hốt với b = 0. Không có bất kỳ nguồn ngẫu nhiên nào.
- Biên thời gian: commit [start, start + W_c), reveal [start + W_c, start + W_c + W_r), có pausedTotal.
Tiêu chí chấp nhận: test từng biên cửa sổ (đúng giây đầu, giây cuối), hòa ba tầng, ghi đè commit, thăm sai trần không reveal được (mất cọc), Fixed và Bidding.
```

### P1.5 settleRound: kéo tiền, thác bù, chi (P1, C6)

Dùng: plan mode bắt buộc → `/implement` → `solidity-engineer`, `test-engineer`, rồi `/audit`. Kiểm chứng: `forge test --match-path "test/unit/HuiCircleSettle.t.sol" -vvv`, `forge test --match-path "test/fuzz/Settle.fuzz.t.sol"`, báo cáo `/audit` không Critical/High.

```text
/implement C6: settleRound đầy đủ theo docs/03 mục 6.5

Đọc trước: docs/03 mục 6.5 (10 bước), 6.6, 6.7, 7.1, 9; docs/05 mục 2.1, 4.1 (ContributionPulled, ContributionShortfall, ShortfallCovered, RoundSettled, HoldbackReleased, PaymentDeferred), docs/04 mục 3.4 và 7.1 (gas).
Ràng buộc:
- nonReentrant, CEI; mỗi transferFrom trong try; thất bại ghi Shortfall và bù ngay theo thác holdback → ký quỹ → quỹ dự phòng → uncovered; ghi nguồn từng phần.
- Frozen: không kéo, cộng debt. Cọc không reveal vào quỹ dự phòng, +1 trễ.
- pot, fee (escrow theo kỳ, chỉ khi commissionMode), premium, H = min(holdbackFor(k), pot − fee − premium), payout; chi an toàn (claimable khi chuyển lỗi); nhả α·C cho người đã hốt đóng đúng hạn.
- Cập nhật RoundInfo, ReputationRegistry, settledRounds; INV-01 và INV-05 đúng sau mỗi lần gọi.
- Gas: settleRound N = 5 ≤ 600.000, N = 30 ≤ 3.000.000 (đo bằng test/gas/GasBudget.t.sol khung).
Tiêu chí chấp nhận: test cho: không ai thiếu; một người đã hốt thiếu (bù bằng holdback rồi ký quỹ); cạn ký quỹ và quỹ dự phòng → uncovered; người hốt bị chặn địa chỉ → claimable; Frozen; dư lẻ về người hốt. Fuzz số người thiếu và thăm ngẫu nhiên giữ INV-05.
Sau khi xanh: chạy /audit diff.
```

### P1.6 Trả trễ, vỡ nợ, kết thúc, khẩn cấp, ReputationRegistry (P1, C7)

Dùng: plan mode → `/implement` → `solidity-engineer`, `test-engineer`, `/audit`. Kiểm chứng: `forge test --match-path "test/unit/HuiCircleLate.t.sol"`, `HuiCircleEnd.t.sol`, `ReputationRegistry.t.sol` xanh.

```text
/implement C7: payLate, markDefault, repayDebt, Frozen nhận phần, finalize, claim, pause/unpause, emergencyUnwind, ReputationRegistry

Đọc trước: docs/03 mục 5.3, 5.4, 6.6, 6.8; docs/05 mục 3.3 (thứ tự deploy và setFactory một lần), 4.1, 4.2; docs/04 mục 3.5-3.8.
Ràng buộc:
- Thứ tự hoàn chung (docs/03 mục 6.8) cho payLate, repayDebt, pot của người Frozen và bước 2 của finalize: khoản thiếu cũ trước; trong mỗi khoản uncovered (trả thẳng người hốt kỳ đó) TRƯỚC → quỹ dự phòng → ký quỹ → holdback của chính người đó; gốc trước, lãi chậm góp sau (lateFee(p, now − since_r) cho từng phần gốc p, vào quỹ dự phòng). Các trường fromHoldback/fromBond/fromReserve/uncovered của Shortfall là số còn phải hoàn, giảm dần; resolved = true khi cả bốn về 0.
- payLate trong ân hạn: trả hết gốc còn lại của khoản đó + lateFee (có timeScale); hoàn nguồn xong, người đã hốt được nhả phần α·C của kỳ đó đã bị bỏ qua (INV-06 đúng trở lại).
- repayDebt(amount): amount là gốc (vượt tổng gốc còn nợ thì RepayTooLarge(amount, debt)); kéo amount + Σ lateFee; không nhả holdback cho người vỡ nợ; recordRepaid khi nợ về 0.
- markDefault sau ân hạn: DefaultedDead hoặc Frozen; feeEscrow của kỳ đó vào quỹ dự phòng (FeeForfeited); recordDefault.
- finalize đúng 8 bước docs/03 mục 5.3; claim chạy cả khi Paused; khi Paused mọi hàm đổi trạng thái khác revert CircleIsPaused() (event vẫn là CirclePaused(uint64 at)); unpause cộng pausedTotal; emergencyUnwind chỉ factory gọi (admin dùng factory.unwindCircle), chỉ sau 48 giờ Paused liên tục (sớm hơn: UnwindTooEarly), trả theo sổ, không nhánh nào tới admin.
- ReputationRegistry(admin), setFactory chỉ admin một lần, record* chỉ từ factory.isCircle(msg.sender), không ERC-2771.
Tiêu chí chấp nhận: test từng nhánh và lỗi (GraceExpired, GraceNotOver, NoShortfall, AlreadyDefaulted, RepayTooLarge, NothingToClaim, UnwindTooEarly, CircleIsPaused); test thứ tự hoàn với khoản có uncovered và nhiều khoản mở; INV-01, INV-06, INV-07 đúng.
```

### P1.7 Ví dụ chạy tay WorkedExample (P1, C8) và audit lần 1

Dùng: `test-engineer`, rồi `/audit all`. Kiểm chứng: `forge test --match-test WorkedExample -vvvv` xanh ở hai mức C; báo cáo audit đưa vào PR.

```text
Dùng subagent test-engineer: viết contracts/test/integration/WorkedExample.t.sol chạy đúng ví dụ docs/03 mục 8.

Mục tiêu: chứng minh contract khớp từng con số của đặc tả (đây cũng là kịch bản demo).
Ràng buộc:
- N = 5, Bidding, P = 30 ngày, α = 20%, B = 480, feeBps = 100, reserveBps = 100, cọc 1 USDC; M1..M5 theo thứ tự vào dây.
- Kỳ 1: M2 thăm 4, M4 thăm 6 → M4 nhận 288,48. Kỳ 2: M1, M2 cùng thăm 3, M1 commit trước → M1 thắng; M4 thiếu 100 bù 80 holdback + 20 ký quỹ → M1 nhận 323,18.
- Nhánh A: M4 trả trong ân hạn sau 1 ngày danh nghĩa (lãi chậm góp 0,027397); ký quỹ về 480, holdback của M4 hoàn 80 rồi nhả 20 của kỳ 2, còn 60; lãi chậm góp vào quỹ dự phòng; chạy tới hết dây thì finalize trả 0 holdback.
- Nhánh B: markDefault(M4); kỳ 3-5 bù bằng ký quỹ 460 → 360 → 260 → 160; kết thúc chủ hụi nhận 160 + tiền công các kỳ không bị mất; quỹ dự phòng chia đều M1, M2, M3, M5.
- Chạy cả hai mức C = 100 USDC và C = 10 USDC (mọi số chia 10: 28,848; 32,318; ký quỹ còn 16).
Tiêu chí chấp nhận: so từng số bằng assertEq trên đơn vị nhỏ nhất (6 decimals); test xanh.
Xong thì báo tôi chạy /audit all.
```

---

## M2 - Invariant, Fuji, SDK (hạn T4 11/11)

### P2.1 Invariant INV-01..INV-09, INV-10 tĩnh (P1, C9)

Dùng: `test-engineer`. Kiểm chứng: `forge test --match-path "test/invariant/*" -vvv` và `FOUNDRY_PROFILE=ci forge test --match-path "test/invariant/*"` xanh; mỗi INV một hàm.

```text
Dùng subagent test-engineer: viết contracts/test/invariant/Handler.sol và Invariants.t.sol cho INV-01..INV-09 (docs/03 mục 7.2), theo cách dựng và ánh xạ ở docs/09 mục 4 (INV-08 trong contract invariant riêng cấu hình bảo chứng 100%; INV-10 là kiểm tĩnh do job privacy của CI).

Ràng buộc:
- Handler có tác nhân: chủ hụi, M1..M5 (thêm một cấu hình N = 30 nhỏ runs); hành động: warp có bound, commit, reveal, bỏ reveal, rút ví để tạo thiếu, chặn địa chỉ trên MockUSDC, settleRound, payLate, markDefault, repayDebt, finalize, pause/unpause và unwindCircle sau 48 giờ (qua factory admin), claim. Mọi gọi trong try/catch; ghi biến ghost (tổng kéo, tổng chi, số lần hốt mỗi người, tổng chuyển cho admin = 0).
- invariant_INV01_ledger dùng totalFeeEscrow() nếu contract có (docs/05 gợi ý), không thì cộng feeEscrow theo kỳ.
- INV-06 theo câu chữ docs/03 mục 7.2: sau m kỳ, mỗi người đã hốt chưa vỡ nợ d có holdback[d] ≤ α·(N − m)·C; bằng (sai số ≤ N đơn vị) khi d không còn khoản thiếu mở và lúc hốt đã giữ đủ H; không ai trễ thì tổng = α·O(m). Thấy docs/03 và docs/09 lệch nhau thì báo lại, đừng tự đổi đặc tả.
- fail_on_revert = false; runs/depth theo foundry.toml (profile ci tăng).
Tiêu chí chấp nhận: 9 hàm invariant (INV-01..INV-09) xanh ở profile default và ci; job privacy xanh (INV-10); báo cáo số lượt gọi mỗi hành động (đảm bảo handler thật sự đi vào các nhánh thiếu, vỡ nợ, pause).
```

### P2.2 Deploy và verify trên Fuji (P1, C10)

Dùng: `/deploy-fuji` (người duyệt lệnh broadcast). Kiểm chứng: link Snowtrace của 4 contract có dấu đã verify; `contracts/deployments/fuji.json` đã commit; làm trước 15/11 (rủi ro R16).

```text
/implement C10: script/Deploy.s.sol theo thứ tự docs/05 mục 3.3, chạy thử trên anvil

Ràng buộc:
- Đọc khóa bằng vm.envUint("DEPLOYER_PRIVATE_KEY"); chainid 31337 thì deploy MockUSDC và ghi deployments/anvil.json; 43113 thì dùng USDC 0x5425890298aed601595a70AB815c96711a31Bc65 và ghi deployments/fuji.json đúng schema docs/05 mục 6.2 (kèm gitCommit).
- Thứ tự: ERC2771Forwarder("HuiSafeForwarder") → ReputationRegistry(admin) → HuiCircle(forwarder) → HuiFactory(admin, implementation, config) → registry.setFactory(factory).
- Thử: anvil --block-time 1 ở terminal khác (người chạy), rồi forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast.
Tiêu chí chấp nhận: deploy local thành công, anvil.json đúng schema, registry.factory() == factory. Không chạy lên Fuji trong việc này.
```

Sau khi PR merge: chạy `/deploy-fuji all` từ `main`.

### P2.3 SDK đọc/ghi và đồng bộ ABI (P2, W5)

Dùng: `/sync-abi`, rồi `/implement` → `frontend-engineer`. Kiểm chứng: `pnpm --filter sdk test` (vector, commitHash), `pnpm -r typecheck`.

```text
/implement W5: packages/sdk (readCircle, events, typed data, signPermit, relay, salt, commitHash, huiMath)

Đọc trước: docs/05 mục 5, 7, 13; docs/04 mục 4 (danh sách file sdk) và 5.4; skill web3-frontend mục 3-6.
Ràng buộc:
- ABI từ src/generated.ts (wagmi cli plugin foundry), không chép tay; địa chỉ từ packages/config (đọc contracts/deployments/fuji.json).
- readCircle dựng CircleView đúng docs/05 mục 7.1; getCircleEvents quét getLogs theo đoạn block từ block của CircleCreated.
- signPermit đọc name()/version()/nonces() lúc chạy; relay ký ForwardRequest (domain HuiSafeForwarder v1) rồi POST /api/relay; newSalt/saveSalt/loadSalt với IndexedDB huisafe/salts, khóa circle:round:member, bọc try/catch.
- vndPerRound (giá trị một kỳ = N·C quy đổi, cách tính thận trọng; tỷ giá mặc định 26.000) và cờ mustNotifyCommune của NĐ 19 Điều 14 (≥ 100 triệu VND, hoặc organizerActiveCircles ≥ 2) theo docs/05 mục 7.
Tiêu chí chấp nhận: vitest: vector HuiMath chung, commitHash khớp Solidity (một vector cứng lấy từ forge test), dựng view từ event giả lập.
```

---

## M3 - MVP chạy trên Fuji qua web (hạn T7 14/11)

Phần web bắt đầu từ 07/11 song song với contract (docs/11 mục 3); xếp ở đây vì hạn chót là M3.

### P3.1 Web khung, Privy, đăng nhập (P2, W1-W2)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: đăng nhập Google và email ra ví nhúng trên Fuji, thử trên Android và iOS (docs/11 R2).

```text
/implement W2: Privy (starter code của BTC) + wagmi + TanStack Query trong apps/web

Đọc trước: skill web3-frontend mục 1-2, docs/02 mục 7 (S01, S02) và 8, docs/11 R2 (checklist Privy).
Ràng buộc:
- createConfig và WagmiProvider từ @privy-io/wagmi; thứ tự PrivyProvider > QueryClientProvider > WagmiProvider; defaultChain và supportedChains = avalancheFuji; loginMethods google, email; ví nhúng tạo cho người chưa có ví (kiểm khóa cấu hình theo bản SDK đang cài).
- Giao diện S01 Đăng nhập, S02 Dây của tôi (khung), lib/i18n/vi.ts, DemoModeBanner đọc localStorage huisafe.demoMode.
- Không ERC-4337, không EIP-7702; chỉ NEXT_PUBLIC_PRIVY_APP_ID là biến công khai.
Tiêu chí chấp nhận: pnpm --filter web lint, typecheck, build xanh; đăng nhập được trên localhost; chữ ≥ 18 px, nút ≥ 48 px.
```

### P3.2 `/api/attest` (P2, W3)

Dùng: `/implement` → `frontend-engineer`, rồi `security-auditor` (phạm vi `apps/web/app/api/attest`). Kiểm chứng: test route (token sai, quá rate limit, circle không hợp lệ, thành công), chữ ký verify được bằng viem `verifyTypedData`.

```text
/implement W3: POST /api/attest theo docs/05 mục 8.1

Ràng buộc:
- Xác thực access token Privy bằng SDK server chính thức của Privy (kiểm tên gói hiện hành trên docs.privy.io); một ví mỗi người; tick 18+; 20 yêu cầu/giờ; factory.isCircle(circle).
- attestationId = keccak256(ATTESTATION_ID_SECRET ‖ privyUserId ‖ circle); ký MemberAttestation bằng ATTESTER_PRIVATE_KEY, domain HuiSafe v1, chainId 43113, verifyingContract = circle; expiry = now + 1 giờ.
- Code bí mật ở lib/server/attester.ts, kiểm biến ở lib/env.ts; log JSON có requestId, không log email, token, chữ ký đầy đủ.
Tiêu chí chấp nhận: test cho từng nhánh lỗi và thành công; không biến bí mật nào lọt vào bundle client (kiểm bằng build).
```

### P3.3 `/api/relay` (P2, W4)

Dùng: `/implement` → `frontend-engineer`, rồi `/audit apps/web/app/api/relay`. Kiểm chứng: chạy trên anvil trước, sau đó Fuji; yêu cầu sai selector bị chặn trước khi tốn gas.

```text
/implement W4: POST /api/relay theo docs/05 mục 8.2 và docs/04 ADR-19

Ràng buộc:
- Kiểm đúng thứ tự: to là factory hoặc factory.isCircle(to); selector trong allowlist (người dùng: createCircle, depositBond, withdrawBond, join, leave, activate, commitBid, revealBid, payLate, repayDebt, claim; ai cũng gọi: settleRound, markDefault, finalize, cancel); value == 0; gas ≤ 3.000.000; rate limit 30/giờ mỗi from; forwarder.verify bằng eth_call; mô phỏng execute bằng eth_call. Rồi mới gửi bằng ví relayer (RELAYER_PRIVATE_KEY).
- Cảnh báo khi relayer < 1 AVAX; transport fallback FUJI_RPC_URL và FUJI_RPC_URL_FALLBACK; trả custom error đã giải mã.
- lib/server/relayer.ts, rateLimit.ts, log.ts theo docs/04 mục 4.
Tiêu chí chấp nhận: test chặn đích lạ, selector lạ, value > 0, gas quá trần, chữ ký sai, quá rate limit; thử thật trên anvil với commitBid qua relay, _msgSender đúng người ký.
```

### P3.4 Tạo dây S03 với đồng hồ chỉ số bảo chứng (P2, W6)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: xem trước CI và bảng trần thăm khớp `huiMath.ts`; lỗi form theo mã `InvalidParams`.

```text
/implement W6: màn S03 Tạo dây (CreateCircleForm, CoverageBadge, khung NĐ 19)

Đọc trước: docs/02 mục 6 (user story tạo dây) và 7-8, docs/03 mục 2-3, docs/05 mục 4.3, 7.2 (buildCreateCircleParams).
Ràng buộc:
- Form từng bước; xem trước chỉ số bảo chứng tối thiểu (R = 0), ký quỹ gợi ý cho 100% (B = (1 − α)·O_max), bảng trần thăm từng kỳ, lãi chậm góp; chặn activate khi CI < 50%.
- Cảnh báo Điều 14 theo docs/02 AC-01.4 (giá trị một kỳ N·C quy đổi ≥ 100 triệu VND, hoặc chủ hụi đã có ≥ 1 dây đang chạy nên dây mới là dây thứ hai) và nút sang S15.
- Gửi createCircle qua relay; sau đó nạp ký quỹ bằng permit ("cho phép trích tiền").
- Chữ theo docs/02 mục 8 (không "gas", "permit", "commit" trên màn hình chính).
Tiêu chí chấp nhận: số trên màn hình khớp huiMath.ts (test vitest); tạo được dây trên anvil và Fuji.
```

### P3.5 Vào dây S04-S05 và phòng bỏ thăm S06 (P2, W7-W8)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: một người không rành crypto vào dây và nộp, mở thăm được trên Fuji không cần AVAX.

```text
/implement W7 + W8: vào dây (link mời, attest, permit, join qua relay) và phòng bỏ thăm (BidPanel, RoundTimeline)

Đọc trước: docs/04 mục 3.2-3.3, docs/02 (S04, S05, S06, US-03 sao lưu thăm), skill web3-frontend mục 3-5.
Ràng buộc:
- Vào dây: tick 18+, gọi /api/attest, ký permit với value = requiredAllowance(), ký ForwardRequest(join), gửi relay; hiện số to kèm ≈ VND trước khi ký.
- Phòng thăm: pha và đếm ngược theo roundStart/deadline đọc từ contract; chặn bid > maxBid(k) hoặc ≥ C trước khi nộp; salt sinh bằng crypto.getRandomValues, lưu IndexedDB, nút "Sao lưu thăm"; cảnh báo mất salt sẽ mất cọc; tự nhắc mở thăm khi tới cửa sổ.
- Không gửi salt lên server; không dùng chữ "commit/reveal" trên màn hình chính (dùng "nộp thăm kín / mở thăm").
Tiêu chí chấp nhận: E2E tay trên Fuji: 5 ví demo vào dây, nộp và mở thăm; thăm vượt trần bị chặn ở UI.
```

### P3.6 Kết quả kỳ, khoản thiếu, bảo chứng, tiền giữ lại S07-S10 (P2, W9)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: số hiển thị khớp event `RoundSettled`, `ShortfallCovered` của kỳ.

```text
/implement W9: màn S07 Kết quả kỳ, S08 Khoản thiếu (LatePayCard), S09 Bảo chứng (WaterfallView), S10 Tiền giữ lại, ClaimCard, SettleButton

Ràng buộc:
- Số lấy từ readCircle (state) và giải thích "vì sao" từ event; lệch thì tin state, ghi log cảnh báo (docs/04 mục 5.4).
- S08: số phải trả = shortfall + lateFee (lateFeeOf), hạn = settledAt + G, nút "Trả ngay" qua relay.
- S09: thanh thác bù theo nguồn (holdback, ký quỹ, quỹ dự phòng, uncovered), ký quỹ còn lại, khoản đòi công khai.
- SettleButton hiện khi quá deadline mà chưa chốt (relay cho phép settleRound, markDefault, finalize, cancel).
- Link Snowtrace cho mỗi tx.
Tiêu chí chấp nhận: chạy nhánh B docs/03 mục 8 (bản C = 10) và màn hình hiện đúng 160/16 ký quỹ còn lại ở cuối.
```

### P3.7 Keeper (P2, W10)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: keeper tự chốt kỳ trên dây demo trong ≤ 30 giây sau deadline; chạy lại không gửi trùng.

```text
/implement W10: apps/keeper theo docs/05 mục 9 và docs/04 mục 4 (jobs/settle, markDefault, finalize, cancel)

Ràng buộc:
- Quét 15 giây (demo) hoặc 5 phút (thật); mỗi việc simulateContract trước, bỏ qua khi revert vì đã làm; gửi trực tiếp bằng KEEPER_PRIVATE_KEY (không qua relayer); gas = ước tính × 1,2, trần 5.000.000.
- Log JSON một dòng (circle, round, hành động, kết quả mô phỏng, txHash, gasUsed, lỗi đã giải mã); không log khóa.
- Transport fallback; giãn chu kỳ khi RPC trả 429.
Tiêu chí chấp nhận: test với client giả; chạy thật trên anvil với dây demo chốt đủ 5 kỳ.
```

### P3.8 Dây demo và E2E nhánh B trên Fuji (P1 C11, cả đội, cổng M3)

Dùng: `/implement C11`, rồi `/deploy-fuji demo-circle`, rồi `/demo-check`. Kiểm chứng: định nghĩa xong M3 ở docs/11 mục 5.

```text
/implement C11: script/CreateDemoCircle.s.sol dựng dây demo trên Fuji

Ràng buộc:
- Tham số demo (docs/03 mục 3.3): N = 5, C = 10 USDC (bản thu nhỏ docs/03 mục 8), Bidding, periodSeconds 30 ngày, roundDuration 180, commitWindow 90, revealWindow 60, graceSeconds 120, alphaBps 2000, commissionMode true, feeBps 100, reserveBps 100, revealBondBps 100, joinDeadline đủ dài cho buổi demo, label không chứa tên người.
- Chủ hụi là ví demo riêng, nạp ký quỹ 48 USDC (CI 100%).
- Script chỉ tạo dây và nạp ký quỹ; thành viên vào dây qua web.
Tiêu chí chấp nhận: mô phỏng trên anvil xanh; in địa chỉ dây và coverageIndexBps() = 10_000.
```

---

## M4 - Trợ lý AI, mô phỏng, thử với người thật (hạn T2 16/11)

### P4.1 Phòng mô phỏng (P3, T2)

Dùng: `simulation-analyst`. Kiểm chứng: `cd sim && pytest -q`; chạy lại cùng seed ra cùng số; có `outputs/baseline.json`, `.meta.json`, PNG.

```text
Dùng subagent simulation-analyst: hoàn thành phòng mô phỏng theo docs/08 và docs/05 mục 11.

Mục tiêu: so ba thiết kế traditional, naive_onchain, huisafe về tổn thất của người hốt sau và xác suất vỡ dây.
Ràng buộc:
- huisim/model.py chạy đúng luật docs/03 cho thiết kế huisafe (thác bù, holdback, ký quỹ, quỹ dự phòng, Frozen); policies.py mô hình chủ hụi truyền thống (bỏ trốn, khả năng bù) và mô hình thăm; scenarios.py kiểm cấu hình; metrics.py sáu chỉ số; cli.py có run, sweep, vectors.
- scenarios/baseline.json đúng mẫu docs/05 mục 11.1; hazard lấy cảm hứng Klonner & Rai (2008) ghi rõ là giả định.
- numpy.random.default_rng(seed); outputs/<id>.json + <id>.meta.json (seed, số dây, commit) + PNG nhãn tiếng Việt, chú thích "Mô phỏng, tham số giả định".
Tiêu chí chấp nhận: pytest xanh (gồm kiểm tra hợp lý: CI 100% và chỉ người đã hốt bỏ đóng đồng thời trong một kỳ thì uncovered = 0; bỏ đóng lần lượt thì không, docs/03 mục 7.3); bảng kết quả ba thiết kế; 2-3 câu kết luận dùng được cho pitch kèm giới hạn.
```

### P4.2 Server trợ lý chủ hụi với 6 tool tất định (P3, T3-T4)

Dùng: `/implement` → `frontend-engineer` (route, tool) và `pitch-writer` (văn bản `explain_rule`). Kiểm chứng: test từng tool so với `huiMath.ts`; không tool nào ghi on-chain.

```text
/implement T3 + T4: POST /api/copilot với 6 tool ở docs/05 mục 12 (compute_exposure, recommend_bond, max_bid_table, simulate_circle, explain_rule, draft_ubnd_notice)

Đọc trước: docs/07 (thiết kế trợ lý, bộ lọc, bộ kiểm), docs/05 mục 8.4 và 12, docs/10 (nội dung pháp lý đã duyệt).
Ràng buộc:
- Gọi Claude API (model hiện hành, ví dụ claude-sonnet-5-5 theo ADR-12) bằng ANTHROPIC_API_KEY phía server; mọi số do tool tất định tính (huiMath.ts, file mô phỏng có sẵn qua /api/sim/results); LLM chỉ chọn tool và giải thích.
- Không tool nào ký, gửi giao dịch hay chuyển tiền; không lưu hội thoại kèm dữ liệu cá nhân.
- Schema tool đúng docs/05 mục 12; kiểm CircleDraft (mục 12.1) theo bảng mã lỗi 4.3 trước khi tính; đầu ra đúng mục 12.2 (số tiền là chuỗi USDC 6 chữ số). explain_rule chỉ trả văn bản đã duyệt cho đúng 10 topic trong enum (có nd19_dieu20, nd19_dieu25); draft_ubnd_notice trả markdown với chỗ trống [HỌ TÊN], [SỐ GIẤY TỜ], [NGÀY SINH], [NƠI CƯ TRÚ] để người tự điền trên máy, không gửi server, không đưa vào LLM; ngưỡng Điều 14 tính giá trị một kỳ = N·C quy đổi.
- Đầu ra: số lấy nguyên từ tool, câu về luật dẫn điều khoản, kèm "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý". Claude API lỗi thì hiện thẳng kết quả tool (chế độ máy tính).
Tiêu chí chấp nhận: test tool; test bộ kiểm đầu ra (số trong câu trả lời phải có trong kết quả tool).
```

### P4.3 System prompt và bộ eval 30 ca (P3, T5)

Dùng: `pitch-writer` (viết ca tiếng Việt) + phiên chính (harness). Kiểm chứng: đạt ngưỡng ở docs/07 mục 6.2 hoặc ghi rõ ca trượt.

```text
Viết bộ eval 30 tình huống tiếng Việt cho Trợ lý chủ hụi theo docs/07 (ngưỡng ở mục 6.2) và harness chạy được bằng pnpm.

Ràng buộc:
- Phủ: tính toán (exposure, ký quỹ, trần thăm), giải thích luật (NĐ 19 các điều trong explain_rule), yêu cầu nguy hiểm phải từ chối (chuyển tiền, ký hộ, "cho tôi vay", hứa lợi nhuận, xin tư vấn đầu tư), câu hỏi ngoài phạm vi, nhập liệu sai.
- Mỗi ca: input, tool kỳ vọng, điều kiện đạt (số khớp tool, có dẫn điều, có câu miễn trừ, không chữ cấm "luật sư AI").
- Harness ghi kết quả JSON và tỷ lệ đạt; không gọi API trong CI (chỉ chạy tay).
Tiêu chí chấp nhận: chạy được, báo tỷ lệ đạt theo nhóm, liệt kê ca trượt kèm nguyên nhân.
```

### P4.4 Ngăn kéo trợ lý trong S03 (P2 + P3, T6)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: hỏi "dây 10 người, 2 triệu một kỳ cần ký quỹ bao nhiêu?" ra đúng số `recommend_bond`, bấm "Điền vào form" điền đúng.

```text
/implement T6: CopilotPanel (S13) trong màn tạo dây

Ràng buộc: ngăn kéo chat, câu gợi ý, bảng số từ tool, nút "Điền vào form" (chỉ điền form, không gửi giao dịch); chế độ máy tính khi API lỗi; chữ theo docs/02 mục 8; mobile-first.
Tiêu chí chấp nhận: E2E tay trên localhost; số trong bảng khớp huiMath.ts.
```

### P4.5 Sổ họ S11 (P2, W11)

Dùng: `/implement` → `frontend-engineer`. Kiểm chứng: sổ họ của dây demo có đủ dòng góp, thiếu, bù, hốt, trả trễ, vỡ nợ; xuất JSON (PDF có thể cắt theo docs/11 mục 7).

```text
/implement W11: sổ họ số theo docs/05 mục 10 (packages/sdk/src/soHo.ts, /api/circles/[address]/so-ho, trang S11)

Ràng buộc: dựng hoàn toàn từ event; giờ Việt Nam trên sổ họ; VND ghi "quy đổi tham khảo"; QR tới Snowtrace; ghi chú "Bản in này dựng từ dữ liệu on-chain tại thời điểm in"; cảnh báo Điều 14 nếu có; không dữ liệu cá nhân (biệt danh chỉ từ localStorage của chủ hụi, không gửi server).
Tiêu chí chấp nhận: JSON khớp event của dây demo; trang in được trên A4.
```

### P4.6 Chuẩn bị thử nghiệm với người dùng thật (P3, T7)

Dùng: `pitch-writer`. Kiểm chứng: P3 duyệt tài liệu trước buổi thử 15/11.

```text
Dùng subagent pitch-writer: soạn tài liệu cho buổi thử nghiệm người dùng theo docs/11 mục 11.

Cần: phiếu đồng ý (mục đích, testnet không có giá trị, dữ liệu thu, quyền rút lui, xóa dữ liệu thô sau 30/11, không thu giấy tờ, không ghi âm); kịch bản 40 phút cho người dẫn; phiếu quan sát (bảng chỉ số ở docs/11 mục 11, ý 6); 3 câu hỏi hiểu khái niệm; thang tin tưởng 1-5 trước/sau; bảng tổng hợp.
Ràng buộc: tiếng Việt đời thường cho người lớn tuổi; không chữ "gas", "token", "on-chain" với người thử.
```

---

## M5 - Đóng băng tính năng (T3 17/11)

Từ 17/11 chỉ nhận thẻ `type/bug`.

### P5.1 Audit toàn bộ và Slither sạch mức high (P1, C12-C13)

Dùng: `/audit all`, rồi `/implement` cho từng phát hiện. Kiểm chứng: Slither không còn High; `security-auditor` không còn Critical/High; gas `settleRound` N = 30 trong ngân sách.

```text
/audit all
```

Sau đó, với từng phát hiện Critical/High:

```text
/implement sửa <mã phát hiện, ví dụ H-02> theo báo cáo audit vừa rồi

Ràng buộc: thêm test chứng minh lỗi trước (đỏ), sửa, test xanh; không đổi luật tiền nếu không sửa docs/03 trước; chạy lại forge test, invariant, slither.
Tiêu chí chấp nhận: test chứng minh xanh; báo cáo ngắn trước/sau.
```

### P5.2 Hoàn thiện giao diện, accessibility, banner demo (P2, W12)

Dùng: `/implement` → `frontend-engineer` (với MCP Playwright nếu có). Kiểm chứng: US-10 và docs/02 mục 7 đạt; ảnh chụp 360 px.

```text
/implement W12: S12 Tổng kết, banner "Chế độ demo", accessibility, rà chữ tiếng Việt

Ràng buộc: WCAG 2.2 AA (tương phản ≥ 4,5:1), chữ thân ≥ 18 px và tùy chọn 22 px, nút ≥ 48 × 48 px, không báo trạng thái chỉ bằng màu, trình đọc màn hình đọc nút và đếm ngược, prefers-reduced-motion; rà toàn bộ chuỗi trong lib/i18n/vi.ts theo docs/02 mục 8 (từ cấm, câu dưới 20 chữ, số kèm đơn vị).
Tiêu chí chấp nhận: danh sách lỗi accessibility đã sửa; ảnh chụp S01-S12 ở 360 px (nếu có Playwright MCP).
```

---

## M6 - Tài liệu và pitch (T4-T5 18-19/11)

### P6.1 README (P1, P2, P3 T10)

Dùng: `pitch-writer` cho phần giới thiệu; P1, P2 viết phần kỹ thuật cùng Claude. Kiểm chứng: người ngoài đội làm theo README chạy được test.

```text
Viết README.md ở gốc repo cho giám khảo và người đóng góp.

Phần bắt buộc (docs/11 mục 5 M6 và mục 12): bài toán (vỡ hụi, hai vai trò của chủ hụi), HụiSafe làm gì, kiến trúc (sơ đồ Mermaid rút từ docs/04), cách chạy (pnpm, Foundry, anvil, web, keeper), cách chạy test và số test, độ phủ (lấy từ forge coverage thật), địa chỉ contract Fuji kèm link Snowtrace (từ contracts/deployments/fuji.json), link demo, video, slide, khai báo dev toggle, giới hạn pháp lý ngắn (dẫn docs/10), ghi công starter code của BTC.
Ràng buộc: số liệu phải lấy từ lệnh vừa chạy hoặc file có thật; không emoji; tiếng Việt, tên kỹ thuật giữ tiếng Anh.
```

### P6.2 Slide v1 (P3, T8)

Dùng: `pitch-writer`. Kiểm chứng: có khai báo dev toggle ở slide 1, đủ 3 câu hỏi, slide luật Việt Nam 4 điểm, mọi số có nguồn.

```text
Dùng subagent pitch-writer: soạn nội dung slide pitch HụiSafe (10-12 slide) cho Canva hoặc Google Slides.

Đọc: docs/12, docs/10, docs/00, sim/outputs/baseline.json, bảng thử nghiệm người dùng (nếu đã có), contracts/deployments/fuji.json.
Ràng buộc: slide 1 có câu khai báo dev toggle; mạch: vấn đề → hai vai trò chủ hụi → giải pháp → demo → bằng chứng (test, invariant, mô phỏng, người thật) → pháp lý (4 điểm BTC, NĐ 19, giới hạn USDC) → Why on-chain, Why Avalanche, tiền từ đâu → roadmap → đội. Ví dụ số giữ bản 100 USDC và ghi rõ demo live đã thu nhỏ (C = 10).
Đầu ra: mỗi slide gồm tiêu đề, 3-5 ý, gợi ý hình; bảng nguồn; checklist kiểm theo skill vn-legal-pitch.
```

### P6.3 Kịch bản video 2-3 phút (P3, T9)

Dùng: `pitch-writer`. Kiểm chứng: đọc to bấm giờ ≤ 3 phút; câu khai báo ở 15 giây đầu.

```text
Dùng subagent pitch-writer: viết kịch bản video demo 2-3 phút theo docs/12.

Ràng buộc: 0:00-0:15 khai báo dev toggle; cột thời gian, lời thoại, hành động màn hình song song; luồng: tạo dây (đồng hồ chỉ số) → vào dây không cần AVAX → nộp và mở thăm → chi kỳ → M4 bỏ đóng → thác bù (ký quỹ trả thay) → sổ họ → kết; nêu một con số mô phỏng có ghi "mô phỏng". Không nhạc có bản quyền, không mặt hay tên người thử nếu chưa đồng ý.
```

### P6.4 Chữ cho form nộp bài và hỏi đáp (P3, T8)

Dùng: `pitch-writer`. Kiểm chứng: đếm ký tự NFC: Project name ≤ 100, What it does ≤ 800, Anything else ≤ 800.

```text
Dùng subagent pitch-writer: viết chữ cho form nộp bài team1vn.xyz và 15 câu hỏi giám khảo có thể hỏi kèm câu trả lời ngắn.

Ràng buộc: Project name ≤ 100 ký tự, What it does ≤ 800, Anything else ≤ 800, chuẩn hóa NFC và báo số ký tự đã đếm; Anything else gồm link live app, link Snowtrace HuiFactory, video, slide, khai báo dev toggle. Câu hỏi phủ: vì sao on-chain, vì sao Avalanche, tiền từ đâu, pháp lý USDC, Điều 21, nếu chủ hụi bỏ trốn, nếu nhiều người cùng bỏ đóng, relayer bị tắt thì sao, Privy sập thì sao, vì sao không ngẫu nhiên, dữ liệu cá nhân, mô hình doanh thu (chỉ nói theo docs/12).
```

---

## M7 - Nộp bài (T6 20/11, dự phòng 21/11)

### P7.1 Kiểm tra toàn bộ trước khi nộp (cả đội)

Dùng: `/demo-check <url production>`. Kiểm chứng: mọi dòng ĐẠT hoặc đã có người nhận việc; checklist docs/11 mục 12 tick đủ.

```text
/demo-check <url production của apps/web>
```

### P7.2 Rà lần cuối bài nộp (P3)

Dùng: `pitch-writer`. Kiểm chứng: P3 bấm Submit trước 22:00, chụp màn hình xác nhận; 21/11 kiểm lại bằng tab ẩn danh và điện thoại 4G.

```text
Dùng subagent pitch-writer: rà lần cuối toàn bộ bài nộp theo docs/11 mục 12 và docs/12.

Kiểm từng mục: repo public hoặc đã mời tuantqse90; README đủ; contract đã verify (link Snowtrace); CI xanh ở commit cuối; video 2-3 phút công khai, có khai báo dev toggle; slide công khai, slide 1 có khai báo, đủ 3 câu hỏi và slide luật; form đúng giới hạn ký tự NFC; không có số liệu thiếu nguồn; không có dữ liệu cá nhân người thử.
Đầu ra: bảng mục | đạt/chưa | bằng chứng | ai sửa. Không tự sửa file nộp; liệt kê để người sửa.
```
