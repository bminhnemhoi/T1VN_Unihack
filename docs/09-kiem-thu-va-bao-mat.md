# 09. Kiểm thử và bảo mật

**Mục đích và đọc khi nào.** File này là kế hoạch kiểm thử và hồ sơ bảo mật của HụiSafe: kim tự tháp test, test từng hàm, fuzz, invariant với Handler gắn với INV-01..INV-13, test tích hợp tái hiện ví dụ của 03 mục 8, differential ba ngôn ngữ, ngân sách gas, phân tích tĩnh, threat model, checklist trước deploy, bảo mật backend, kiểm thử riêng tư, runbook sự cố và cách dùng subagent `security-auditor`. Đọc trước khi viết test, trước mỗi PR đụng đường tiền, trước khi deploy và khi có sự cố. Luật ở [03](03-dac-ta-giao-thuc.md), tên ở [05](05-cau-truc-du-lieu-va-api.md), kiến trúc ở [04](04-kien-truc.md), lệnh Foundry đầy đủ ở skill `foundry-fuji`.

---

## 1. Chiến lược

BTC ghi trong stack: "tests are mandatory on the money paths". HụiSafe định nghĩa **đường tiền** là mọi hàm làm USDC đi vào hay ra contract, hoặc đổi một số trong sổ cái: `depositBond`, `withdrawBond`, `join` (permit), `commitBid` (kéo cọc), `revealBid` (trả cọc), `settleRound`, `payLate`, `markDefault` (chuyển tiền công vào quỹ dự phòng), `repayDebt`, `finalize`, `claim`, `emergencyUnwind`.

Luật: mỗi hàm trên có unit test, có fuzz test, được Handler gọi trong invariant, và xuất hiện trong ít nhất một test tích hợp. PR có nhãn `money-path` thiếu một trong bốn thứ đó thì không merge.

| Tầng | Công cụ | Mục tiêu | Chạy khi |
|---|---|---|---|
| Tĩnh | `forge fmt --check`, cảnh báo của solc, Slither, ESLint, `tsc` | Không lỗi, không High | Mỗi commit |
| Unit | `forge test` (`test/unit`), vitest (`packages/sdk`), pytest (`sim`) | Mỗi hàm public, mỗi lỗi custom | Mỗi commit |
| Fuzz | Fuzz của Foundry: 256 run ở máy, 5.000 run ở CI | Khoảng 20 tính chất (mục 3) | Mỗi commit |
| Invariant | Invariant của Foundry + `Handler.sol` | INV-01..INV-09 và INV-11..INV-13 tự động, INV-10 tĩnh | Mỗi PR |
| Differential | Vector JSON chung cho Solidity, TS, Python | Khoảng 2.000 vector | Mỗi PR |
| Tích hợp | `WorkedExample.t.sol`, `GasBudget.t.sol` | Đúng từng đơn vị; gas trong ngân sách | Mỗi PR |
| E2E | Anvil + web, Playwright tùy chọn; thử tay trên Fuji | Các tiêu chí chấp nhận của 02 | Trước M3 và trước demo |
| Người thật | `/demo-check`, buổi thử 15–16/11 | 5–10 người | M4 |

Quy ước tên (skill `foundry-fuji`): `test_<Hàm>_<TìnhHuống>`, `testFuzz_<...>`, `invariant_INVxx_<tên>`. Test revert dùng `vm.expectRevert(HuiCircle.<Error>.selector)` hoặc `abi.encodeWithSelector(...)` khi lỗi có tham số.

**Tên lỗi tạm dừng.** Event là `CirclePaused(uint64 at)`, còn lỗi là `CircleIsPaused()` (05 mục 4.2). Hai tên phải khác nhau vì solc 0.8.28 báo `DeclarationError: Identifier already declared` khi event và lỗi trùng tên trong cùng contract (đã thử ngày 06/11/2026). Test revert khi dây đang dừng dùng `HuiCircle.CircleIsPaused.selector`.

---

## 2. Unit test theo hàm

| Hàm | Ca chính | Lỗi phải bắt |
|---|---|---|
| `HuiMath.exposure`, `maxExposure` | k = 0 và k = N cho 0; đối xứng O(k) = O(N − k); N = 5, C = 100 USDC cho O_max = 600 USDC; N = 10 cho 25·C | |
| `HuiMath.holdbackFor`, `releasePerRound` | (2000, 5, 1, 100 USDC) = 80 USDC; k = N cho 0; release = 20 USDC | |
| `HuiMath.coverageIndexBps` | (2000, 480, 0, 5, 100 USDC) = 10.000; chặn ở 10.000; ký quỹ 0 cho đúng α | |
| `HuiMath.maxBid` | Bảng 03 mục 8: 6.575.342; 4.931.506; 3.287.671; 1.643.835; `payers` = 0 cho 0; luôn ≤ C − 1. Bản án 48/2024 (đơn vị VND): N = 25, kỳ 5, 2.000.000, P = 30 ngày cho 657.534 | |
| `HuiMath.lateFee` | 100 USDC, 1000 bps, 1 ngày danh nghĩa = 27.397 ở bản thật (`roundDuration` = P) và ở demo (trễ thật 6 giây, `roundDuration` = 180) | |
| `HuiMath.bpsOf` | 376 USDC, 100 bps = 3,76 USDC; làm tròn xuống | |
| `HuiMath.bidCapAfterShare`, `commissionRoom`, `commission` (v1.2) | Bảng 03 mục 8.1: φ = 5000 cho `bidCap` 3.287.671 / 2.465.753 / 1.643.835 / 821.917; `room` 26.301.368 / 14.794.518 / 6.575.342 / 1.643.835; `commission(388 USDC, 300, 5000, 26.301.368)` = 11.640.000 (trần 3% chặn), `commission(392,8 USDC, 300, 5000, 14.794.518)` = 7.397.259; φ = 0 cho `bpsOf(pot, feeBps)`; L = 0 cho 0 | |
| `HuiMath.reserveShare`, `onTimeWeight` (v1.2) | Vector V1: R = 19.697.396, w = (4, 4, 4, 3, 4) cho 4.146.820 / 4.146.820 / 4.146.820 / 3.110.115 / 4.146.820, dư 1; `onTimeWeight(5, 6, false)` = 0 (kẹp, không tràn); vỡ nợ = 0 | |
| `HuiFactory.createCircle` | Tham số hợp lệ: `CircleCreated`, `isCircle`, `circlesOf`; clone đã khởi tạo và phát `CircleTermsSet(termsHash, φ)`; qua forwarder thì chủ hụi là người ký | `InvalidParams(1..16)`, mỗi mã một ca; mã 15: φ > 5000, φ > 0 với dây `Fixed`, φ > 0 khi `commissionMode` tắt, φ > 0 với `feeBps` = 0; mã 16: `termsHash` = 0 |
| `HuiFactory.setConfig` | Chỉ áp dụng cho dây tạo sau; dây cũ giữ `lateRateBps` cũ; `ConfigUpdated` | `NotAdmin` |
| `onActivated`, `onFinished` | `activeCirclesOf` tăng rồi giảm | Gọi từ địa chỉ không phải circle bị revert |
| `pauseCircle`, `unpauseCircle` | `CirclePausedByAdmin`, `CircleUnpausedByAdmin` | `NotAdmin` |
| `initialize` | Chỉ factory, một lần; implementation không khởi tạo được | `NotFactory`; lỗi initializer của OpenZeppelin |
| `depositBond` | Permit thành công; permit bị gửi trước nhưng allowance đủ; nạp nhiều lần; `BondDeposited.bondTotal` đúng | `NotOrganizer`, `WrongState` |
| `withdrawBond` | Chỉ sau `Cancelled`; `BondWithdrawn`; `bondRemaining` về 0 | `NotOrganizer`, `WrongState`, `NothingToWithdraw` (gọi lần hai) |
| `join` | Thành công, `joinIndex` tăng; permit bị gửi trước vẫn vào được | `BadAttestation` (sai member, sai circle, sai người ký), `AttestationExpired`, `AttestationUsed`, `AlreadyMember`, `CircleFull`, `JoinClosed`, `InsufficientAllowance(needed, actual)` |
| `leave` | Chỉ Forming; `MemberLeft`; người vào sau lùi lên một bậc, `joinIndex` liên tục từ 0, thứ tự tương đối giữ nguyên (03 mục 5.1); vào lại cùng dây bị `AttestationUsed` | `NotMember`, `WrongState` |
| `activate` | Đủ N người, CI ≥ `minCoverageBps` (10.000 ở cấu hình Fuji; ký quỹ 479,999999 cho `CoverageTooLow(9999, 10000)`, B_min làm tròn lên cho α = 10% là 540): `CircleActivated(startTime, guaranteedCoverageBps)`, factory tăng bộ đếm | `NotOrganizer`, `CoverageTooLow(bps, minBps)`, `JoinClosed`, `CircleNotFull(have, need)` |
| `cancel` | Sau `joinDeadline`: `CircleCancelled` | `TooEarly(at)`, `WrongState` |
| `commitBid` | Kéo đúng `revealBond`; ghi đè giữ cọc, `commitIndex` mới lớn hơn; `BidCommitted` | `NotInCommitWindow`, `NotEligibleToBid` (đã hốt, đóng băng, còn khoản thiếu, không phải thành viên); dây Fixed |
| `revealBid` | Trả cọc; cập nhật dẫn đầu theo thăm, rồi số lần trễ, rồi `commitIndex`; `BidRevealed` | `NotInRevealWindow`, `NoCommit`, `CommitMismatch`, `AlreadyRevealed`, `BidTooHigh(bid, max)` (vượt trần, và b ≥ C; với φ > 0 `max` là `bidCap_k`, thăm đúng bằng `bidCap_k` hợp lệ, thêm 1 đơn vị thì revert) |
| `settleRound` | Không ai thăm: `joinIndex` nhỏ nhất, b = 0; một người sống; Fixed theo `joinIndex`, người đóng băng bị đẩy cuối; chỉ còn người đóng băng; cọc không mở vào quỹ dự phòng; từng nguồn của thác bù; `uncovered` khi cạn; người hốt bị chặn thì `claimable`; `H = min(...)`; nhả holdback; các event đúng thứ tự | `TooEarly(at)`, `RoundAlreadySettled`, `PreviousRoundNotSettled`, `CircleIsPaused`; **v1.2:** φ = 0 giữ tiền công cố định; φ > 0 theo 03 mục 2.7 (kỳ 1 và 2 của mục 8.1: 11,64 và 7,397259); chủ hụi hốt thì `fee` = 0; kỳ không có khoản thiếu phát `FeePaid` và `feeEscrow[k]` = 0, kỳ có khoản thiếu thì không có `FeePaid`; chủ hụi bị chặn nhận tiền thì `claimable[organizer]` tăng và kỳ vẫn chi |
| `payLate` | Trả `s + lateFee`; hoàn theo thứ tự 03 mục 6.8 (`uncovered` trả người hốt kỳ đó trước, rồi quỹ dự phòng, ký quỹ, holdback), mỗi phần phát `ShortfallRestored`; người đã hốt được nhả α·C của kỳ đó (`HoldbackReleased`); `LatePaid` | `NoShortfall`, `GraceExpired` |
| `markDefault` | Đã hốt thành DefaultedDead, chưa hốt thành Frozen; `FeeForfeited`; `MemberDefaulted(m, r, frozen)` | `NoShortfall`, `GraceNotOver`, `AlreadyDefaulted`; kỳ không có khoản thiếu không có escrow nên không có gì để `FeeForfeited` |
| `repayDebt` | Trả một phần, trả hết; áp gốc theo thứ tự hoàn của 03 mục 6.8 (khoản cũ trước; trong mỗi khoản: `uncovered` cho người hốt kỳ đó, rồi quỹ dự phòng, ký quỹ, holdback); kéo đúng `amount + Σ lateFee`; không nhả holdback; mỗi phần hoàn phát `ShortfallRestored(round, member, source, amount)`; `DebtRepaid(member, principal, lateFee)`; `recordRepaid` khi hết nợ | `NoShortfall` (không có nợ), `RepayTooLarge(amount, debt)` |
| `finalize` | Đủ 8 bước của 03 mục 5.3; quỹ dự phòng chia theo đúng hạn (V1: nhánh A M1 4,146821 / M2, M3, M5 4,146820 / M4 3,110115; nhánh B 5,895 mỗi người; Σw = 0 chia đều; `ReserveShared` từng người); dư lẻ cho `joinIndex` nhỏ nhất có w > 0; `CircleFinalized`; số dư contract về 0 trừ `claimable` | `TooEarly`, `GraceNotOver`, `WrongState` |
| `claim` | Nhận đủ; chạy được khi Paused; `Claimed` | `NothingToClaim` |
| `pause`, `unpause` | `pausedTotal` cộng đúng; lịch dời; mọi hàm ghi trừ `claim` bị chặn | `NotFactory` |
| `emergencyUnwind` | Chỉ factory gọi, qua `HuiFactory.unwindCircle(circle)` của admin; sau 48 giờ Paused liên tục: trả theo sổ, quỹ dự phòng chia ĐỀU (không theo đúng hạn, không phát `ReserveShared`), không chuyển gì cho admin; `CircleUnwound` | `NotFactory`, `NotAdmin` (ở factory), `UnwindTooEarly`, `WrongState` |
| View | `maxBid` = `bidCap` khi φ > 0 và `statutoryMaxBid`, `commissionRoom`, `onTimeWeight` khớp HuiMath; `requiredAllowance` = (N − 1)(C + revealBond) = 404 USDC ở ví dụ; `guaranteedCoverageBps` dùng quỹ dự phòng = 0; `phase` đổi đúng tại biên; `roundStart` cộng `pausedTotal`; `dueOf`, `lateFeeOf` khớp HuiMath | |
| `ReputationRegistry.record*` | Chỉ circle có `factory.isCircle`; bộ đếm tăng; `ReputationUpdated` | Gọi từ EOA bị revert |
| Forwarder | `_msgSender()` là người ký; sửa `data` thì `ERC2771ForwarderInvalidSigner`; quá hạn thì `ERC2771ForwarderExpiredRequest`; phát lại thì hỏng vì nonce; selector `multicall(bytes[])` không tồn tại | |

Kéo và chi tiền dùng `SafeERC20.trySafeTransferFrom` và `trySafeTransfer` (trả `bool`, không revert; có trong `SafeERC20` của OpenZeppelin 5.x bản mới, kiểm tra tag đã cài) hoặc `try/catch`, để một người lỗi không làm hỏng cả kỳ.

---

## 3. Fuzz

Mọi đầu vào `bound()` về miền của 03: N 3..30, C 1..10.000 USDC, P 1..31 ngày, `alphaBps` ≤ 10.000, thời gian trễ tới 10 năm.

1. `maxBid` ≤ C − 1; giảm dần theo k khi `payers` = N − k; bằng 0 khi `payers` = 0; không tràn.
2. Σ holdbackFor của k người đã hốt sau kỳ m (mỗi người đã nhả m − k lần) = α·O(m), sai số ≤ N đơn vị.
3. `coverageIndexBps` ≤ 10.000; tăng theo ký quỹ.
4. `lateFee` tăng theo thời gian trễ; bằng 0 khi trễ 0; demo và bản thật cho cùng kết quả với cùng thời gian danh nghĩa.
5. `settleRound` với thăm ngẫu nhiên hợp lệ và một tập ngẫu nhiên người thiếu tiền: `payout + fee + premium + H (+ trả nợ) == pot` (INV-05); `uncovered > 0` chỉ khi cả holdback của người thiếu, ký quỹ và quỹ dự phòng đều về 0.
6. `payLate` ở thời điểm ngẫu nhiên trong ân hạn: các nguồn đã bù được hoàn đúng; quỹ dự phòng tăng đúng `lateFee`.
7. `join` với allowance có sẵn ngẫu nhiên và permit thành công hoặc lỗi: vào được khi và chỉ khi allowance cuối ≥ `requiredAllowance`.
8. `commitHash` Solidity khớp TS (qua vector, mục 6).
9. (v1.2) `testFuzz_commissionWithinCap`: N, C, P, k, φ, `feeBps`, pot, thăm hợp lệ ngẫu nhiên: `commission(...) + bid · L ≤ room` (INV-11), `commission ≤ ⌊pot · feeBps / 10_000⌋`, bằng 0 khi L = 0; thăm tối đa `bidCapAfterShare` + `commission` không bao giờ vượt `room`.
10. (v1.2) `testFuzz_reserveSplit`: R, N ≤ 30, `lateCount` và cờ vỡ nợ ngẫu nhiên: Σ phần chia = R; ai có w = 0 nhận 0 (trừ khi Σw = 0 thì chia đều); w lớn hơn không nhận ít hơn w nhỏ hơn quá 1 đơn vị; dư lẻ về `joinIndex` nhỏ nhất có w > 0.

---

## 4. Invariant

### 4.1. Dựng

`setUp()` dựng `RecordingUSDC` (bản `MockUSDC` ghi lại mọi lần chuyển, đặt trong `test/utils/`), forwarder, registry, factory, một dây Bỏ thăm N = 5 với tham số demo (180, 90, 60, 120 giây; P = 30 ngày), cấp USDC và allowance cho các tác nhân, kích hoạt dây, rồi `targetContract(address(handler))` và `targetSelector(FuzzSelector({ addr: address(handler), selectors: ... }))`. Hai hợp đồng test trong `Invariants.t.sol`:

- `HuiInvariants`: CI = 80% (α 20%, ký quỹ 0,6·O_max), mọi loại bỏ đóng.
- `HuiInvariantsFullCoverage`: ký quỹ (1 − α)·O_max, Handler chỉ cho người đã hốt bỏ đóng, tất cả cùng một lần (`stopReceivers`, cú sốc đồng thời lớn nhất). Dùng cho INV-08. Trường hợp bỏ đóng lần lượt vượt ký quỹ không nằm trong INV-08; nó được ghi lại bằng test `test_INV08_SequentialDefaults_ExceedBond_Documented` (N = 5, tổng thiếu 1000 > O_max 600, kỳ 5 `uncovered` 304, M5 nhận 94,08 thay vì 392) và teeth `test_Teeth_INV08_FailsOnSequentialDefaults_Documented`.

### 4.2. Tác nhân và hành động của Handler

| Tác nhân | Hành động (hàm của Handler) |
|---|---|
| Thành viên M1..M5 | `commit(seed, bid, salt)` với bid bị chặn ≤ `min(maxBid(k), C − 1)`; `reveal(seed, skip)` mở đúng hoặc cố ý bỏ; `payLate(seed, round)`; `repayDebt(seed, amount)`; `claim(seed)` |
| Thành viên gặp khó | `drainWallet(seed)` chuyển hết USDC đi; `revokeAllowance(seed)`; `refund(seed, amount)` trả lại USDC để có thể trả trễ |
| Circle (bên phát USDC) | `toggleBlacklist(seed)` dùng blacklist giả lập của mock |
| Keeper (địa chỉ bất kỳ) | `settle()` trong `try/catch`; `advanceRound()` warp tới `deadline` rồi chi; nếu đã chi kỳ N thì warp qua ân hạn và gọi `finalize`; `markDefault(seed)`; `finalize()` |
| Thời gian | `warp(secs)` với `bound(secs, 1, 300)` |
| Admin | `pause()`, `unpause()`, `unwind()` qua factory; tần suất thấp |
| Kẻ tấn công | `attackPrivileged(sel)` gọi `initialize`, `pause`, `emergencyUnwind`, `withdrawBond`, `depositBond` khi không có quyền; `attackForgedRequest(...)` gửi ForwardRequest ký bằng khóa của kẻ tấn công với `from` là nạn nhân; `attackMulticall()` gọi selector `multicall(bytes[])`. Mọi lần thành công đều tăng `ghostUnauthorizedSuccess` |

`afterInvariant()` in số lần gọi từng hàm và kiểm trạng thái cuối, để biết mọi hành động đều được chạy tới.

### 4.3. Biến ghost

| Biến | Ý nghĩa |
|---|---|
| `ghostPaidOut` | Tổng đã chi cho người hốt |
| `ghostWins[m]` | Số lần m hốt |
| `ghostMaxBidAtSettle[k]` | `maxBid(k)` đọc ngay trước khi chi kỳ k |
| `ghostPulledInCall[m]`, `ghostAllowedInCall[m]` | Số đã kéo của m trong lời gọi vừa rồi (từ `RecordingUSDC`) và số được phép (`dueOf`, `revealBond`, `s + lateFee`, khoản trả nợ) |
| `ghostUnexpectedRecipient` | Số lần contract chuyển USDC tới địa chỉ ngoài thành viên, chủ hụi và người có `claimable` |
| `ghostAdminReceived` | Tổng USDC admin nhận (admin là địa chỉ riêng, không là thành viên hay chủ hụi) |
| `ghostSettledBeforeDeadline` | Số lần chi kỳ thành công trước `deadline(k)` hoặc khi kỳ trước chưa chi |
| `ghostParamsHash` | `keccak256(abi.encode(params()))` lúc `activate()` |
| `ghostAnyShortfall`, `ghostAnyLate` | Đã có khoản thiếu nào, đã có trả trễ nào |
| `ghostUnauthorizedSuccess` | Số lần kẻ tấn công gọi thành công hàm có quyền |

### 4.4. Ánh xạ INV-01..INV-13

| Mã | Hàm invariant | Kiểm |
|---|---|---|
| INV-01 | `invariant_INV01_ledger` | `usdc.balanceOf(circle) == bondRemaining + reserve + totalHoldback + totalFeeEscrow + revealBondsHeld + totalClaimable` (giữ đúng khi tiền công trả ngay mỗi kỳ, kể cả khi chủ hụi bị chặn nhận và khoản đó thành `claimable`); thêm Σ `holdback` của thành viên = `totalHoldback`, Σ `claimable` = `totalClaimable`, Σ `feeEscrow` = `totalFeeEscrow` |
| INV-02 | `invariant_INV02_oneWinEach` | `ghostWins[m] ≤ 1` với mọi m; `settledRounds ≤ N`; nếu Completed thì `settledRounds == N` và Σ `ghostWins` = N |
| INV-03 | `invariant_INV03_bidCap` | Mọi kỳ đã chi: `winningBid ≤ ghostMaxBidAtSettle[k]` (với φ > 0 là `bidCap_k`, ghost đọc view `maxBid` trước khi chi) và `winningBid < C` |
| INV-04 | `invariant_INV04_noOverPull` | `ghostPulledInCall[m] ≤ ghostAllowedInCall[m]` sau mỗi lời gọi |
| INV-05 | `invariant_INV05_potSplit` | Mọi kỳ: `pot − (payout + fee + premium + holdback)` = 0 nếu người hốt không đóng băng, ≥ 0 và bằng phần trả nợ nếu đóng băng (`RoundInfo` không có trường trả nợ nên Handler tính) |
| INV-06 | `invariant_INV06_holdback` | Với mọi d đã hốt chưa vỡ nợ, m = `settledRounds`: `holdback[d] ≤ α·(N − m)·C/10_000` (cộng sai số ≤ N đơn vị). Bằng nhau khi d không có khoản thiếu đang mở và `ghostFullH[d]` (lúc hốt nhận đủ H). Nếu chưa từng có khoản thiếu: Σ holdback = α·O(m) |
| INV-07 | `invariant_INV07_noAdminPayout` | `ghostAdminReceived == 0` và `ghostUnexpectedRecipient == 0`; `ghostUnauthorizedSuccess == 0` (chủ hụi là người nhận hợp lệ của `FeePaid`) |
| INV-08 | `invariant_INV08_fullCoverage` (trong `HuiInvariantsFullCoverage`) | Σ `uncovered` của mọi kỳ = 0 khi mọi người đã hốt ngừng đóng trong cùng một kỳ (cú sốc đồng thời; bỏ đóng lần lượt: xem 03 mục 7.3) |
| INV-09 | `invariant_INV09_schedule` | `ghostSettledBeforeDeadline == 0`; sau `activate()`, hash của `params()` không đổi |
| INV-10 | Tĩnh | Job `privacy` của CI và rà soát (mục 8.3, mục 12) |
| INV-11 | `invariant_INV11_commissionInRoom` | Mọi kỳ đã chi của dây φ > 0: `fee + winningBid · ghostPayers[k] ≤ ghostRoom[k]`, `fee ≤ pot · feeBps / 10_000`, `fee = 0` nếu người hốt là chủ hụi (`ghostPayers`, `ghostRoom` ghi lúc commit đầu tiên hoặc lúc chi, từ view `commissionRoom`) |
| INV-12 | `invariant_INV12_reserveSplit` | Sau `finalize`: Σ `ghostReserveShare[m]` = `ghostReserveBeforeFinalize`; người vỡ nợ nhận 0; `lateCount` lớn hơn thì `ghostReserveShare` không lớn hơn (trừ dư lẻ 1 đơn vị) |
| INV-13 | `invariant_INV13_feeTiming` | Mỗi `FeePaid(k, …)` chỉ xuất hiện ở kỳ có `ghostShortfallCount[k] = 0` và đi kèm `feeEscrow[k] = 0`; kỳ có khoản thiếu có `feeEscrow[k] > 0` hoặc `feeForfeited` (hoặc fee = 0); `ghostFeesToOrganizer` = Σ `FeePaid` + `feesPaid` của `finalize` ≤ Σ `RoundInfo.fee` |

Về INV-06: bản đầu của 03 viết "tổng bằng α·O(m)", đẳng thức này sai khi có người trả trễ. 03 đã sửa theo hai điểm. Thứ nhất, INV-06 giờ phát biểu theo từng người như hàng trên. Thứ hai, `payLate` nhả phần holdback bị bỏ qua của kỳ trễ (03 mục 6.8, bước 4), nên ở nhánh A, sau `payLate(2)` holdback của M4 là 60 và tổng về đúng α·O(2) = 120 USDC. Ở nhánh B, M4 vỡ nợ nên bị loại khỏi tổng.

### 4.5. Cấu hình `foundry.toml`

Giá trị khớp skill `foundry-fuji`:

```toml
[fuzz]
runs = 256

[invariant]
runs = 256
depth = 64
fail_on_revert = false   # Handler tự bắt lỗi bằng try/catch và bound()

[profile.ci.fuzz]
runs = 5000

[profile.ci.invariant]
runs = 512
depth = 128
```

Mặc định của Foundry nếu không ghi: `runs` 256, `depth` 500, `fail_on_revert` false, `shrink_run_limit` 5000, `show_metrics` true. Với khoảng 20 hành động được chọn đều nhau, depth 64 thường chỉ đi được vài kỳ. Profile `ci` (depth 128) cùng `advanceRound()` giúp nhiều lượt chạy đi hết dây N = 5. Số lần gọi từng hàm (`show_metrics`) và `afterInvariant()` cho biết tỷ lệ lượt chạy tới `finalize`; thấp quá thì tăng depth hoặc thu hẹp `targetSelector`. Chạy: `forge test --match-path "test/invariant/*"`, ở CI thêm `FOUNDRY_PROFILE=ci`.

---

## 5. Test tích hợp `WorkedExample.t.sol`

Tái hiện 03 mục 8, so từng đơn vị (USDC có 6 chữ số thập phân). Mỗi nhánh chạy hai lần: bản thật (`roundDuration` = P = 30 ngày, commit 28 ngày, reveal 1 ngày, ân hạn 48 giờ) và demo (180, 90, 60, 120 giây; P = 30 ngày). Tên test: `test_WorkedExample_BranchA_PayLate`, `test_WorkedExample_BranchB_MarkDefault`, mỗi tên có bản `_Demo`.

**Dựng:** N = 5, C = 100, Bỏ thăm, α = 2000, ký quỹ 480, `commissionMode` bật, `feeBps` = 100, `reserveBps` = 100, `revealBondBps` = 100 (1 USDC), `capBps` = 2000, `lateRateBps` = 1000. Thành viên M1..M5 theo thứ tự vào dây. Kiểm trước kỳ 1: `requiredAllowance` = 404 USDC; `guaranteedCoverageBps` = 10.000; bảng `maxBid` như mục 2.

03 không nói kỳ 3 đến 5 ai thăm. Test chọn "không ai thăm" để số tất định. Đây là bổ sung của file này.

**Kỳ chung cho hai nhánh (USDC):**

| Kỳ | Thăm | Người hốt, b | Kéo được | Bù | pot | Tiền công | Quỹ dự phòng | H | Nhận |
|---|---|---|---|---|---|---|---|---|---|
| 1 | M2 4, M4 6 | M4, 6 | 376 | 0 | 376 | 3,76 (kỳ không có khoản thiếu: trả ngay chủ hụi, `FeePaid`) | 3,76 | 80 | 288,48 |
| 2 | M1 3, M2 3, M1 commit trước | M1, 3 | 291 (M4 thiếu 100) | 100: 80 holdback của M4, 20 ký quỹ (còn 460) | 391 | 3,91 (kỳ có khoản thiếu: escrow) | 3,91 (cộng dồn 7,67) | 60 | 323,18 |

**Nhánh A: M4 trả trong ân hạn, sau 1 ngày danh nghĩa** (bản thật: 86.400 giây; demo: 6 giây).

| Bước | Kết quả |
|---|---|
| `payLate(2)` | M4 trả 100 + 0,027396 (lãi tính riêng từng phần gốc 80 và 20, mỗi phần làm tròn xuống, nên lệch 1 đơn vị so với 100 × 10% / 365 = 0,027397); ký quỹ về 480; holdback của M4 về 80 rồi nhả 20 cho M4 (bước 4 của `payLate`), còn 60; quỹ dự phòng 7,697396; khoản thiếu `resolved` |
| Kỳ 3, M2 hốt, b = 0 | Kéo 400; tiền công 4; quỹ dự phòng 4; H 40; nhận 352; nhả 20 cho M1 và M4 |
| Kỳ 4, M3 hốt | Kéo 400; 4; 4; H 20; nhận 372; nhả 20 cho M1, M2, M4 |
| Kỳ 5, M5 hốt | Kéo 400; 4; 4; H 0; nhận 392; nhả 20 cho M1, M2, M3, M4 |
| `FeePaid` các kỳ 3, 4, 5 | 4 + 4 + 4 trả ngay chủ hụi lúc chi (không có khoản thiếu mới từ kỳ 3); `feeEscrow[3..5]` = 0 |
| `finalize()` | Holdback còn lại 0 (M4 đã được nhả 20 lúc `payLate`); tiền công còn trong escrow 3,91 (kỳ 2) về chủ hụi, cộng 3,76 + 12 đã trả ngay là 19,67 tổng; ký quỹ 480 về chủ hụi; quỹ dự phòng 19,697396 chia theo đúng hạn (vector V1, w = 4, 4, 4, 3, 4): M1 4,146821, M2, M3, M5 4,146820, M4 3,110115 |
| Sổ cái | Vào 2.447,027397 = ra 2.447,027397; số dư contract 0 |

**Nhánh B: M4 không trả, ai đó gọi `markDefault(M4)` sau ân hạn.**

| Bước | Kết quả |
|---|---|
| `markDefault(M4)` | `FeeForfeited(2, 3,91)`; quỹ dự phòng 11,58; `MemberDefaulted(M4, 2, false)` |
| Kỳ 3, M2 hốt, b = 0 | Kéo 300; phần của M4 bù 100 từ ký quỹ (còn 360); pot 400; 4; 4; H 40; nhận 352; nhả 20 cho M1 |
| Kỳ 4, M3 hốt | Kéo 300; ký quỹ còn 260; pot 400; 4; 4; H 20; nhận 372; nhả 20 cho M1, M2 |
| Kỳ 5, M5 hốt | Kéo 300; ký quỹ còn 160; pot 400; 4; 4; H 0; nhận 392; nhả 20 cho M1, M2, M3 |
| `finalize()` | Ký quỹ 160 và tiền công 12 (kỳ 3, 4, 5, đang trong escrow vì có khoản thiếu của M4) về chủ hụi; tiền công kỳ 1 (3,76) đã trả ngay; quỹ dự phòng 23,58 chia theo đúng hạn (cùng trọng số 4) M1, M2, M3, M5, mỗi người 5,895; M4 không nhận gì; `recordCompleted` cho 4 người |
| Khoản thiếu của M4 | Kỳ 2: 100 = 80 holdback + 20 ký quỹ; kỳ 3 đến 5: mỗi kỳ 100 từ ký quỹ; tổng 400 = 80 + 320, đúng 03; `uncovered` = 0 mọi kỳ |
| Sổ cái | Vào 2.047 = ra 2.047; số dư contract 0 |

Sau mỗi giao dịch, test gọi lại kiểm INV-01. Cùng bảng này là kỳ vọng của `sim/tests/test_worked_example.py` (08 mục 7).

**Biến thể v1.2 (hoa hồng nằm trong trần lãi, φ = 5000, `feeBps` = 300):** test `test_WorkedExample_CommissionShare` tái hiện 03 mục 8.1 (kỳ 1: thăm 3, tiền công 11,64, M4 nhận 292,48; kỳ 2: thăm 2,4, tiền công 7,397259, M1 nhận 321,474741), kiểm `RevealBid` thăm 3,3 ở kỳ 1 bị `BidTooHigh(3_300_000, 3_287_671)`, kiểm biến thể chủ hụi là M1 (kỳ 2 tiền công 0, M1 nhận 328,872) và biến thể M4 thiếu 100 ở kỳ 2 (tiền công kỳ 2 vào escrow). Hai nhánh gốc ở trên chạy với φ = 0 để các số tiền công, pot, nhận không đổi.

---

## 6. Differential: Solidity, TypeScript, Python

1. `python -m huisim.cli vectors --seed 7 --out ../contracts/test/vectors/huimath.json` sinh khoảng 2.000 bộ đầu vào (biên, ngẫu nhiên có seed, các số của 03) cùng kết quả của `sim/huisim/math.py` cho mọi hàm `HuiMath`, và đầu vào của `commitHash`.
2. `test/fuzz/Differential.t.sol` đọc file bằng `vm.readFile(string.concat(vm.projectRoot(), "/test/vectors/huimath.json"))` và `vm.parseJson`, so từng giá trị với `HuiMath` và với `keccak256(abi.encode(...))`. Cần `fs_permissions` đọc `./test/vectors`. Không bật `ffi`.
3. `packages/sdk/test/huiMath.test.ts` (vitest) đọc cùng file, so với `huiMath.ts` và `commitHash`.
4. CI sinh lại file và chạy `git diff --exit-code`. Lệch ở bất kỳ bản nào là lỗi.

---

## 7. Gas và coverage

**Ngân sách:** bảng ở 04 mục 7.1; mốc chính là `settleRound` ở N = 30 ≤ 3.000.000 gas, cảnh báo từ 2.500.000.

`test/gas/GasBudget.t.sol` đo bốn ca ở N = 30: kỳ 1 và kỳ 29, mỗi kỳ có và không có 3 khoản thiếu. Kỳ 1 tốn vì ghi ReputationRegistry lần đầu; kỳ 29 tốn vì nhả holdback cho 28 người.

```solidity
vm.startSnapshotGas("settleRound", "N30_k29_shortfall3");
circle.settleRound();
uint256 used = vm.stopSnapshotGas();
assertLe(used, 3_000_000);
```

Cheatcode ghi vào `snapshots/settleRound.json`. Theo tài liệu Foundry, snapshot gas chỉ chính xác ở chế độ test cô lập, chế độ này bật sẵn; không tắt nó.

```bash
forge test --match-path "test/gas/GasBudget.t.sol" --gas-report
forge snapshot            # cập nhật .gas-snapshot
forge snapshot --diff     # so với bản trước
forge snapshot --check    # CI: lỗi nếu test nào tốn hơn bản đã ghi
```

**Coverage:** `HuiMath` 100% dòng và nhánh. `HuiCircle`, `HuiFactory`, `ReputationRegistry` ≥ 90% dòng, ≥ 85% nhánh. Mọi lỗi custom của đường tiền có ít nhất một test revert. Lệnh: `forge coverage --report summary`; xem chi tiết bằng `forge coverage --report lcov`. Gặp lỗi "stack too deep" khi đo thì thử `--ir-minimum` (số dòng có thể lệch, cần kiểm tra). Ghi số test và coverage vào README.

### 7.1. Kết quả kiểm thử (11/11/2026, commit `bc4ed07`, trước đóng băng M5)

Mã `contracts/src` bằng đúng bản đã deploy lên Fuji (`git diff 494e923 HEAD -- contracts/src` rỗng).

| Hạng mục | Kết quả | Lệnh |
|---|---|---|
| Test Foundry | **617 đạt, 0 đỏ**, 41 suite; gồm 54 invariant (INV-01..INV-13, mỗi cái một hàm, kèm `InvariantsTeeth` chứng minh từng cái đỏ khi bị phá) | `cd contracts && forge test` |
| Test script triển khai | Fund 12, DemoCircles 13 (đủ `Create`, `Join`, dây Fixed chạy tới `finalize`), Deploy, CreateSafe; fork Fuji 2 + 4 (`HUISAFE_FORK_TESTS=true`) | `forge test --match-path "test/{unit,fork}/*Script*"` |
| Coverage dòng / nhánh / hàm | `HuiCircle` 98,46% / 98,30% / 100%; `HuiCircleBase` 100%; `HuiCircleViews` 98,18% / 98,31% / 100%; `HuiFactory` 100% / 100% / 100%; `ReputationRegistry` 100%; `HuiMath` 100% / 100% / 100%; tổng 98,68% dòng, 98,61% câu lệnh, 100% hàm (`HuiCircleLens` 1/2 dòng: chỉ có constructor, các hàm view chạy qua `delegatecall` từ `HuiCircle`) | `forge coverage --ir-minimum --report summary --no-match-coverage "script\|test\|mocks"` |
| Slither 0.11.6 | **High 0.** Medium 24: `reentrancy-no-eth` 17 (mọi hàm đều `nonReentrant`), `uninitialized-local` 5 (biến đếm), `divide-before-multiply` 1 (`HuiMath.maxExposure`, ⌊N/2⌋·⌈N/2⌉ theo docs/03 mục 2.1), `unused-return` 1 (`ECDSA.tryRecover` kiểm `err` riêng). Low 15, Informational 20, Optimization 19 (`constable-states` là báo nhầm do biến lưu trữ được ghi qua `delegatecall`/`initialize`) | `slither .` trong `contracts/` (cấu hình `slither.config.json`) |
| Audit `security-auditor` (toàn bộ `src`, relay, attest, keeper) | **0 Critical, 0 High**; 1 Medium và 2 Low ngoài chuỗi (xem `.handover/REPORT-A16.md`), 7 Info | `/audit` |
| Gas | xem 04 mục 7.1; số đo lại bằng `--gas-report` khớp bảng cũ trong 1% | `forge test --match-path test/gas/GasBudget.t.sol --gas-report` |

Ghi chú coverage: `forge coverage` mặc định gặp "stack too deep" với `via_ir`, nên đo bằng `--ir-minimum` (mã không tối ưu, số dòng có thể lệch nhẹ). Dưới `--ir-minimum` các test ngân sách gas (`GasBudget`) báo đỏ vì gas không tối ưu (8 test); đó là hiện tượng của chế độ đo, không phải lỗi: `forge test` bình thường 617/617 đạt.

---

## 8. Phân tích tĩnh, fuzzer ngoài và job riêng tư

### 8.1. Slither

```bash
cd contracts && forge build
slither . --filter-paths "lib/|test/|script/"
slither . --filter-paths "lib/|test/|script/" --fail-high           # cổng chặn ở máy
slither . --filter-paths "lib/|test/|script/" --checklist > slither-report.md
slither . --filter-paths "lib/|test/|script/" --sarif slither.sarif
```

Slither cần Python 3.10+. CI dùng `crytic/slither-action@v0.4.2` với `target: contracts/` và `fail-on: high` (04 mục 5.2). Phát hiện dự kiến và cách xử lý:

| Detector | Vì sao xuất hiện | Xử lý |
|---|---|---|
| `calls-loop` | `settleRound`, `finalize` gọi USDC trong vòng lặp | Chấp nhận: N ≤ 30, mỗi lời gọi không revert, một người lỗi không làm hỏng kỳ. Ghi lý do bằng `// slither-disable-next-line calls-loop` |
| `arbitrary-send-erc20` | `transferFrom(member, ...)` với `from` lấy từ storage | Xác nhận `from` luôn là thành viên trong `_members` và số tiền là `dueOf`; không bao giờ lấy `from` từ tham số người gọi |
| `timestamp` | So `block.timestamp` với cửa sổ | Chấp nhận: cửa sổ ≥ 30 giây (03 mục 9) |
| `reentrancy-*` | Event phát sau lời gọi ngoài | `nonReentrant` và CEI; mức `reentrancy-eth` hay `reentrancy-no-eth` thật thì phải sửa |
| `divide-before-multiply` | Công thức trong `HuiMath` | Phải sửa: nhân trước, chia sau (03 mục 1) |

### 8.2. Echidna, Medusa, Halmos (tùy chọn, không chặn mốc)

| Công cụ | Tình trạng | Dùng cho HụiSafe |
|---|---|---|
| Halmos | 0.3.3 (31/07/2025), Python ≥ 3.11; kiểm thử ký hiệu (symbolic) trên test Foundry; hỗ trợ invariant từ 0.3.0 | Nên thử nếu còn giờ: chứng minh có giới hạn cho `HuiMath` (`maxBid ≤ C − 1`, không tràn, CI ≤ 10.000). `uv tool install --python 3.12 halmos`; `halmos --function check_`; `halmos --function invariant_ --invariant-depth 4` |
| Medusa | v1 (Trail of Bits, 14/02/2025), viết bằng Go, theo độ phủ, chạy song song | Tùy chọn: chạy lại các tính chất của Handler; cấu hình cho Foundry cần kiểm tra. `medusa init`, `medusa fuzz` |
| Echidna | 2.4.0 trên GitHub releases (ngày 04/11, năm cần kiểm tra), ghi "Better Foundry compatibility"; Trail of Bits (02/2025) nói Echidna chủ yếu chỉ còn sửa lỗi nhỏ | Không ưu tiên |

### 8.3. Job `privacy` của CI

```bash
cd contracts
for c in HuiCircle HuiFactory ReputationRegistry; do
  n=$(jq '[.abi[] | select(.type=="event" or (.type=="function" and .stateMutability!="view" and .stateMutability!="pure")) | .inputs[]? | .. | objects | select(.type? == "string")] | length' "out/$c.sol/$c.json")
  test "$n" -eq 0 || { echo "$c có tham số string"; exit 1; }
done
grep -rn "Multicall" src/ && { echo "Cấm Multicall (ADR-06)"; exit 1; } || true
```

Không có tham số `string` trong event hay hàm ghi thì không có chỗ để ai đó vô tình đưa tên, số điện thoại lên chuỗi. `eip712Domain()` có trả `string` nhưng là hàm view nên không bị tính.

---

## 9. Threat model

| Mã | Tác nhân | Tài sản | Mối đe dọa | Giảm thiểu | Test |
|---|---|---|---|---|---|
| T01 | Kẻ tấn công | Tiền, danh tính thành viên | Giả mạo `_msgSender()` qua `Multicall` + ERC-2771 (OpenZeppelin công bố 07/12/2023) | Không contract nào có `Multicall` (ADR-06); OpenZeppelin ≥ 5.0.1; relayer chỉ nhận selector trong allowlist | `test_Forwarder_NoMulticallSelector`; grep trong job `privacy` |
| T02 | Kẻ phá | Lượt vào dây | Gửi trước permit để `join` revert | `try permit` rồi kiểm allowance, đúng khuyến nghị trong `IERC20Permit` | `test_Join_PermitFrontRun_StillJoins` |
| T03 | Relayer hoặc người chiếm relayer | Quyền tham gia, thứ tự commit | Từ chối chuyển tiếp; giữ `payLate` tới quá ân hạn; trì hoãn commit để đổi `commitIndex` khi thăm hòa (ghi chú nghiên cứu cảnh báo chia hòa theo thời điểm nộp nhạy với thứ tự) | Chữ ký ràng buộc nội dung; relayer không có quyền trên chuỗi; luôn có đường gọi trực tiếp (người có AVAX; thành viên Privy không có AVAX nên dựa vào hạn mức: ngân sách chung chỉ bị trừ cho yêu cầu đã qua mọi bước kiểm, bộ đếm chặn trên 10.000 khóa); relayer xử lý theo thứ tự đến và ghi giờ nhận; cửa sổ commit bản thật dài nhiều ngày; số lần trễ xét trước `commitIndex` | E2E gọi trực tiếp; `ForwardRequest` sửa `data` bị từ chối |
| T04 | Kẻ spam | AVAX của relayer | Nhiều yêu cầu hợp lệ từ nhiều khóa để đốt gas | Allowlist đích và selector; `value = 0`; gas ≤ 3.000.000; mô phỏng trước; 30 yêu cầu/giờ mỗi `from`; thêm hạn mức theo IP và ngân sách gas mỗi ngày; cảnh báo < 0,02 AVAX | Test API: vượt hạn mức trả 429; yêu cầu mô phỏng lỗi không được gửi |
| T05 | Keeper ngừng | Tính kịp thời | Kỳ không được chi đúng hạn | Ai cũng gọi được các hàm đến hạn; nút "Chi kỳ"; chậm không mất tiền | Người lạ gọi `settleRound` muộn cho cùng số tiền |
| T06 | Người lấy được khóa attester | Một người một ví | Ký attestation cho ví ảo | Khóa chỉ ở server; hạn 1 giờ; `attestationId` dùng một lần; xoay khóa bằng `setConfig` cho dây mới; dây Forming bị ảnh hưởng thì `cancel` | `BadAttestation`, `AttestationUsed`, `AttestationExpired`; runbook mục 13 |
| T07 | Chủ hụi | Pot của người khác | Thăm mồi bằng ví ảo để đẩy giá, hoặc hốt sớm bằng ví ảo rồi bỏ | Một người một ví qua Privy và attestation; khai báo `organizerIsMember`; thăm kín; trần thăm; ghế ảo bỏ đóng thì ký quỹ của chính chủ hụi bù | Unit: chủ hụi là thành viên bỏ đóng, `ShortfallCovered` nguồn `Bond` |
| T08 | Người nhiều tài khoản Google | Dây | Nhiều ghế ảo (sybil) | Như T07; 20 yêu cầu attest/giờ; ví lấy từ phiên Privy, không lấy từ client; holdback và ký quỹ bù phần người đã hốt bỏ; rủi ro còn lại nói rõ trong pitch | Test API attest |
| T09 | Thành viên | Cọc mở thăm | Mất salt, không mở được thăm | IndexedDB; "Sao lưu thăm" mã hóa bằng mật khẩu; cảnh báo trước khi rời trang; chỉ mất 1% C | Test SDK salt; E2E xóa IndexedDB thì UI báo đúng |
| T10 | Người bỏ thăm | Kết quả đấu | Commit rồi cố ý không mở để quấy hay dò | Cọc vào quỹ dự phòng, +1 lần trễ; thăm cao nhất thắng nên không ảnh hưởng người khác | `RevealBondForfeited`, `lateCount` tăng |
| T11 | Circle (bên phát USDC) | Tiền chi | Ví người nhận bị chặn làm `transfer` lỗi; ví người góp bị chặn làm kéo lỗi | Chi an toàn ghi `claimable` + `PaymentDeferred`; kéo lỗi đi thác bù | Blacklist của mock: kỳ vẫn chi xong |
| T12 | Validator | Cửa sổ thăm | Lệch timestamp vài giây | Cửa sổ ≥ 30 giây; khoảng nửa mở `[start, start + W)` | Biên t = start − 1, start, start + W − 1, start + W |
| T13 | Kẻ phá | Khả năng chi kỳ | Làm vòng lặp hết gas | N ≤ 30; mỗi lời gọi không revert; ngân sách gas | `GasBudget.t.sol` |
| T14 | Token hoặc người nhận độc | Sổ cái | Gọi ngược khi đang chuyển tiền | `nonReentrant` cho hàm có chuyển tiền; CEI; USDC không có hook nhưng vẫn phòng | `ReentrantToken` |
| T15 | Ai cũng có thể | Từng đơn vị USDC | Làm tròn sai, bụi kẹt | Nhân trước chia; dư về người hốt; kết thúc quét dư vào quỹ dự phòng trước khi chia | INV-01, INV-05; fuzz; differential |
| T16 | Admin | Tiền đang khóa | Tạm dừng kéo dài để giữ tiền | Không có hàm rút cho admin; `pausedTotal`; `claim()` vẫn chạy; sau 48 giờ `emergencyUnwind()` trả theo sổ | Pause rồi unwind; INV-07 |
| T17 | Người lấy được khóa admin | Dây mới, tính sẵn sàng | Pause hàng loạt; `setConfig` đưa attester hay forwarder độc cho dây mới | Không có đường rút; `setConfig` chỉ áp dụng dây mới; `setConfig` revert nếu `forwarder` khác forwarder của implementation (đề xuất, cần thêm vào 05); theo dõi `ConfigUpdated`; mainnet dùng Safe | `setConfig` không đổi dây cũ; INV-07 |
| T18 | Frontend bị chiếm, gói npm độc, trang giả | Chữ ký người dùng | Lừa ký permit hay `ForwardRequest` độc. ScamSniffer: permit chiếm 56,7% thiệt hại vụ lớn năm 2024; Permit/Permit2 chiếm 38% năm 2025 | Permit giới hạn spender và số tiền; màn hình ký nói rõ bằng tiếng Việt; CSP; lockfile; domain EIP-712 riêng | `signPermit` dùng đúng `requiredAllowance` và spender |
| T19 | Bất kỳ ai | Dữ liệu cá nhân | Lộ email, tên qua chuỗi, log hay LLM | INV-10; `attestationId` băm có secret; log không chứa token, chữ ký; trợ lý không nhận địa chỉ thành viên | Mục 12 |
| T20 | Kẻ chèn lệnh vào trợ lý | Lời khuyên | Prompt injection xúi người dùng ký hay chuyển tiền | Trợ lý không có tool ghi, không có khóa; bộ kiểm đầu ra; cách ly import ([07](07-ai-agentic.md)) | Eval nhóm Injection ở 07 |
| T21 | Kẻ phát lại | Yêu cầu cũ | Phát lại `ForwardRequest` hay permit | Nonce và deadline của forwarder; nonce của USDC; `chainId` trong domain | Phát lại bị `ERC2771ForwarderInvalidSigner`; quá hạn bị `ERC2771ForwarderExpiredRequest` |
| T22 | Kẻ tấn công | Implementation | Khởi tạo implementation hay khởi tạo lại clone | `_disableInitializers()`; `initialize` chỉ factory gọi, một lần | Gọi `initialize` lần hai bị revert |
| T23 | Chính thành viên | Khả năng trả trễ không tốn gas | Allowance còn lại không đủ cho `lateFee`, mà `payLate`, `repayDebt` không nhận permit | UI kiểm allowance trước, rồi ký permit và gửi qua `POST /api/relay/permit` (docs/05 mục 8.2b, không cần AVAX, quyết định theo allowance đọc lại từ chuỗi); người có AVAX vẫn gọi `approve` trực tiếp; bonus EIP-3009 (06 mục 4) | E2E anvil: ví đã thu hồi allowance trả trễ chỉ bằng permit + relay, không `approve`, không tốn gas; route từ chối ví lạ, dây giả, giá trị và hạn sai |

---

## 10. Checklist bảo mật trước deploy

1. CI xanh trên commit sẽ deploy: fmt, build, unit, fuzz, invariant (profile `ci`), differential, `forge snapshot --check`, Slither không High, job `privacy`.
2. `/audit` không còn Critical hay High. Mọi Medium có quyết định ghi trong PR.
3. Không có `Multicall` trong `src/`; mọi hàm người dùng dùng `_msgSender()`.
4. Implementation đã `_disableInitializers()`; `initialize` chỉ factory gọi.
5. Không có hàm nào chuyển USDC tới `admin` hay tới địa chỉ do người gọi tự chọn (rà tay mọi `transfer`).
6. Mọi chuyển tiền ra ngoài không revert cả kỳ; lỗi thì vào `claimable`.
7. `forge build --sizes` dưới 24.576 byte.
8. `FactoryConfig` đúng giá trị ở 06 mục 6.3; `forwarder` khớp implementation; `attester` khớp khóa server.
9. Bốn khóa khác nhau, đều là ví testnet nạp tối thiểu; không khóa nào trong git (`git log -p` không có chuỗi khóa).
10. Script deploy dừng nếu `block.chainid` không phải 43113 hoặc 31337.
11. Đã chạy trọn `WorkedExample` trên Anvil fork của Fuji với USDC thật.
12. Ghi lại commit, địa chỉ, tx hash vào `fuji.json` và README.

---

## 11. Bảo mật backend

| Mục | `/api/attest` | `/api/relay` | `/api/copilot` | Keeper |
|---|---|---|---|---|
| Xác thực | Token Privy (SDK server `@privy-io/node`) | Chữ ký EIP-712 của người dùng; nên thêm token Privy để hạn mức theo người (đề xuất) | Phiên người dùng | Không có đầu vào ngoài |
| Hạn mức | 20 yêu cầu/giờ mỗi người; một ví mỗi người, lấy ví từ phiên Privy | 30 yêu cầu/giờ mỗi `from`; hạn mức theo IP; ngân sách gas mỗi ngày | Theo người, theo IP; giới hạn token mỗi lượt | Gas limit = ước tính × 1,2, trần 5.000.000 |
| Allowlist | `factory.isCircle(circle)` | Đích là factory hoặc circle hợp lệ; 15 selector của 05 mục 8.2 (11 hàm người dùng, 4 hàm ai cũng gọi); `value = 0`; gas ≤ 3.000.000 | Đúng 6 tool | Chỉ 4 hàm đến hạn |
| Trước khi ký hay gửi | Kiểm đủ điều kiện | `forwarder.verify`, mô phỏng `execute` bằng `eth_call` | Bộ kiểm đầu ra | Mô phỏng bằng `eth_call`, bỏ qua lỗi "đã làm" |
| Khóa | `ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET` | `RELAYER_PRIVATE_KEY` | `COPILOT_API_KEY`, `ANTHROPIC_API_KEY` | `KEEPER_PRIVATE_KEY` |

Quy tắc chung:

1. Kiểm mọi đầu vào bằng schema (địa chỉ, số dạng chuỗi, độ dài `data`). Số tiền là chuỗi bigint (05 mục 8).
2. Bí mật chỉ đọc ở route handler và keeper, không bao giờ có tiền tố `NEXT_PUBLIC_`. Code của trợ lý không được import module đọc khóa relayer hay attester (07, chặn bằng ESLint `no-restricted-imports` và test).
3. Log JSON có `requestId`. Không ghi khóa, chữ ký đầy đủ, access token, email, `privyUserId`. Chữ ký và địa chỉ nếu cần thì cắt ngắn.
4. Trả lỗi đã giải mã (tên lỗi custom), không trả stack trace.
5. Chỉ cùng origin; header bảo mật và CSP trong `next.config.ts`; khóa phiên bản bằng lockfile; chạy `pnpm audit` trước M5.
6. Bộ đếm hạn mức trong bộ nhớ chỉ đúng khi chạy một tiến trình. Quyết định cho MVP: dùng bộ đếm trong bộ nhớ, vì lớp chặn chính nằm ở chỗ khác (allowlist đích và selector, `value = 0`, trần gas mỗi yêu cầu, mô phỏng trước khi gửi, cảnh báo số dư ví relayer dưới 0,02 AVAX). `lib/server/rateLimit.ts` giữ một interface `limit(key, max, windowSec)`. Nếu web chạy trên nền tảng nhiều instance và bị spam thật thì chỉ thay phần lưu của interface này bằng kho đếm dùng chung, không sửa route.

---

## 12. Kiểm thử riêng tư

| Mã | Kiểm | Cách |
|---|---|---|
| P1 | Không có chỗ chứa văn bản tự do trên chuỗi | Job `privacy` (mục 8.3) |
| P2 | `attestationId` không đảo ngược được | Test API: 32 byte; khác nhau giữa hai dây của cùng người; khác `keccak256(privyUserId)`; đổi `ATTESTATION_ID_SECRET` thì đổi giá trị; phản hồi không chứa `privyUserId` hay email |
| P3 | Log không chứa bí mật | Gửi yêu cầu có header `Authorization` và chữ ký, rồi tìm chuỗi đó trong log: không được thấy |
| P4 | Trợ lý không nhận dữ liệu thành viên | Chặn và kiểm payload gửi nhà cung cấp mô hình (router hoặc Claude API): không có địa chỉ ví thành viên, biệt danh (02, AC-11.4) |
| P5 | Biệt danh chỉ ở máy chủ hụi | Test web: biệt danh chỉ trong localStorage; không request nào gửi nó lên server |
| P6 | `label` không chứa tên người | UI nhắc khi tạo dây; sổ họ chỉ in địa chỉ, biệt danh chỉ có trên máy chủ hụi |

---

## 13. Runbook sự cố

| Mức | Ví dụ | Phản ứng |
|---|---|---|
| SEV1 | Bất biến tiền bị vi phạm trên Fuji; lộ khóa admin hay attester | Tạm dừng trong 15 phút |
| SEV2 | Relayer, keeper hay Privy ngừng (04 mục 8) | Bật đường dự phòng, báo người dùng |
| SEV3 | Lỗi giao diện, sai chữ | Sửa theo lịch thường |

Quy trình SEV1:

1. **Phát hiện:** cảnh báo, báo của người dùng, hoặc keeper đọc lại INV-01 bằng view mỗi chu kỳ và cảnh báo khi lệch (đề xuất thêm vào keeper).
2. **Tạm dừng:** admin chạy script, không truyền khóa trên dòng lệnh (CLAUDE.md):

```bash
cd contracts
forge script script/EmergencyPause.s.sol --sig "pause(address)" $CIRCLE --rpc-url fuji --broadcast
```

`script/EmergencyPause.s.sol` (thêm) đọc khóa bằng `vm.envUint("DEPLOYER_PRIVATE_KEY")` và gọi `HuiFactory.pauseCircle`; có thêm `unpause(address)` và `unwind(address)`.

3. **Báo tin** trong 30 phút, qua nhóm Telegram của người thử và README. Giao diện tự hiện "Dây đang tạm dừng" vì đọc `state` trên chuỗi. Mẫu: "Dây [label] đang tạm dừng để kiểm tra kỹ thuật. Tiền của bạn vẫn nằm trong contract và sổ cái công khai trên Snowtrace. Bạn vẫn nhận được các khoản đang chờ (nút Nhận tiền). Chúng tôi sẽ báo tiếp trước [giờ]."
4. **Điều tra:** tái hiện trên `anvil --fork-url $FUJI_RPC_URL` tại block xảy ra sự cố; viết test đỏ trước khi sửa.
5. **Sửa:** clone dùng implementation cố định, nên sửa nghĩa là deploy implementation và factory mới cho dây mới. Dây đang dừng: an toàn thì `unpause`; không an toàn thì chờ đủ 48 giờ dừng liên tục rồi admin gọi `HuiFactory.unwindCircle(circle)` (script `EmergencyPause.s.sol --sig "unwind(address)"`), factory gọi `emergencyUnwind()` của dây và tiền trả theo sổ (03 mục 5.4).
6. **Lộ khóa:** relayer, keeper: thay khóa, chuyển AVAX còn lại. Attester: `setConfig` với attester mới cho dây mới; dây Forming bị ảnh hưởng thì `cancel`. Admin trên testnet: deploy factory mới với admin mới, báo địa chỉ mới; dây cũ chỉ còn rủi ro bị tạm dừng.
7. **Sau sự cố:** ghi lại diễn biến, nguyên nhân, test mới và bài học vào README hoặc `docs/ai-workflow/`; chạy lại `/audit`.

---

## 14. Subagent `security-auditor`

**Khi nào:** mọi PR đụng `contracts/` hay đường tiền; trước deploy M2; trước khi đóng băng M5; sau mọi sự cố SEV1.

**Gọi:** `/audit`. Subagent chỉ đọc: không sửa code, không broadcast, không đọc `.env*`.

**Đầu vào:** diff của PR, 03 mục 6 và 7, bảng threat model ở mục 9, kết quả `forge test`, `slither . --filter-paths "lib/|test/|script/"` và `forge snapshot --diff`.

**Danh sách kiểm:**

1. Đường tiền nào cũng có đủ unit, fuzz, Handler, tích hợp (mục 1).
2. CEI và `nonReentrant` ở mọi hàm chuyển tiền ra.
3. `_msgSender()` ở mọi chỗ; không có `Multicall`.
4. Không đường nào chuyển USDC tới admin hay tới địa chỉ do người gọi chọn.
5. Mọi phép chia ghi rõ chiều làm tròn, nhân trước chia; dư đi đúng chỗ.
6. Vòng lặp chỉ qua thành viên, N ≤ 30; một lần chuyển lỗi không làm revert cả kỳ.
7. Quyền của từng hàm đúng bảng 03 mục 4; tham số không đổi sau `activate()`.
8. Mốc thời gian dùng `pausedTotal` đúng; biên cửa sổ là nửa mở.
9. Mỗi thay đổi trạng thái phát đúng event của 05.
10. Không dữ liệu cá nhân, không nguồn ngẫu nhiên.

**Đầu ra:** bảng phát hiện gồm mã, mức (Critical, High, Medium, Low, Info), file và dòng, mô tả, kịch bản khai thác, đề xuất sửa, test cần thêm. `solidity-engineer` sửa, `test-engineer` thêm test, rồi chạy lại `/audit` tới khi không còn Critical và High.

---

## Nguồn

- OpenZeppelin, công bố lỗ hổng ERC2771Context + Multicall, 07/12/2023: <https://www.openzeppelin.com/news/arbitrary-address-spoofing-vulnerability-erc2771context-multicall-public-disclosure>; ghi chú phát hành 5.0.1 (Multicall nhận biết context ERC-2771): <https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/releases/tag/v5.0.1>
- OpenZeppelin `ERC2771Forwarder.sol` v5.0.1 (lỗi, event, typehash): <https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.1/contracts/metatx/ERC2771Forwarder.sol>; `IERC20Permit`, Security Considerations; `SafeERC20` (`trySafeTransfer`, `trySafeTransferFrom`), xem 06/11/2026: <https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/utils/SafeERC20.sol>
- Foundry, Invariant testing: <https://getfoundry.sh/forge/invariant-testing>; giá trị mặc định `[invariant]`: <https://getfoundry.sh/config/reference/testing>; gas snapshot cheatcodes: <https://www.getfoundry.sh/reference/cheatcodes/gas-snapshots>; gas tracking: <https://www.getfoundry.sh/forge/gas-tracking> (xem 06/11/2026)
- Slither, README và mã nguồn tham số dòng lệnh: <https://github.com/crytic/slither>, <https://github.com/crytic/slither/blob/master/slither/__main__.py>; slither-action v0.4.2 (16/01/2026): <https://github.com/crytic/slither-action/releases>
- Medusa v1, Trail of Bits, 14/02/2025: <https://blog.trailofbits.com/2025/02/14/unleashing-medusa-fast-and-scalable-smart-contract-fuzzing/>; Echidna releases: <https://github.com/crytic/echidna/releases>; Halmos 0.3.3: <https://pypi.org/project/halmos/>; "Modern invariant testing with halmos", 28/07/2025: <https://a16zfrontier.com/posts/article/modern-invariant-testing-with-halmos/>
- Privy, Node.js SDK `@privy-io/node`: <https://docs.privy.io/basics/nodeJS/installation.md>
- Ghi chú nghiên cứu `wallet_security_legal_rag.md` (ScamSniffer 2024, 2025) và `rosca_economics_onchain.md` (chia hòa theo thời điểm nộp nhạy với thứ tự), 05/11/2026.
