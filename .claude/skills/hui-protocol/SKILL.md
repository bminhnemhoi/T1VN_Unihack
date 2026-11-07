---
name: hui-protocol
description: Luật giao thức HụiSafe - ký hiệu, công thức HuiMath (O(k), holdback, Coverage Index, maxBid theo NĐ 19 Điều 21, lateFee), máy trạng thái dây và kỳ, chọn người hốt tất định, thác bù và hoàn lại, Frozen, pull-payment, bất biến INV-01..INV-10, ràng buộc pháp lý. Dùng khi viết, test hoặc review HuiMath, HuiCircle, HuiFactory, ReputationRegistry, huiMath.ts, mô phỏng, hay khi cần số liệu tiền chính xác cho UI, trợ lý hoặc pitch.
---

# Giao thức HụiSafe (tóm tắt để làm việc)

Mục đích: nhắc đủ luật để code và test đúng mà không phải đoán. Đọc khi đụng tới tiền, lịch kỳ, trạng thái hay số liệu.
Nguồn sự thật: `docs/03-dac-ta-giao-thuc.md` (luật, ví dụ số, trường hợp biên) và `docs/05-cau-truc-du-lieu-va-api.md` (tên struct, hàm, event, lỗi). Skill này chỉ tóm tắt; khi nghi ngờ hoặc khi skill và docs khác nhau, docs thắng và phải báo cho người.

## 1. Ký hiệu

- N = số phần hụi, 3 ≤ N ≤ 30 (`memberCount`). C = mức góp mỗi kỳ, USDC 6 decimals (`contribution`). k = kỳ, 1..N.
- P = `periodSeconds`: kỳ danh nghĩa theo hợp đồng hụi, dùng cho trần lãi và lãi chậm góp.
- `roundDuration`: thời gian thật giữa hai kỳ trên chuỗi. Bản thật: `roundDuration = periodSeconds`.
- Mỗi kỳ đúng 1 người hốt, nhận tiền góp của N−1 người còn lại. Tổng tiền góp cả dây = N(N−1)C.
- Hụi sống (Live) = chưa hốt, chưa vỡ nợ; hụi chết (Dead) = đã hốt. Frozen = chưa hốt mà vỡ nợ; DefaultedDead = đã hốt rồi vỡ nợ. Trong code suy từ hai cờ `received`, `defaulted`.
- Kỳ k, thăm thắng b: mỗi hụi sống (trừ người thắng) góp C − b; mỗi hụi chết góp C.

## 2. Công thức chuẩn (thư viện `HuiMath`; bản TS `packages/sdk/src/huiMath.ts`, bản Python `sim/huisim/math.py` phải khớp từng đơn vị)

```text
O(k)      = k(N − k)C                              nghĩa vụ chưa đóng sau kỳ k
O_max     = ⌊N/2⌋·⌈N/2⌉·C                           đỉnh tại k = ⌊N/2⌋ (≈ N²C/4)
                                                    vd N=10, C=2 triệu: 50 triệu; N=5, C=100 USDC: 600 USDC
H(k)      = α·(N − k)·C                             holdback của người hốt kỳ k; nhả α·C sau mỗi kỳ người đó đóng đúng hạn
                                                    hệ quả: khi mọi người đóng đúng hạn, tổng holdback = α·O(k)
CI        = min(100%, α + (B + R)/O_max)            B = ký quỹ chủ hụi, R = quỹ dự phòng hiện có
CI_bps    = min(10_000, alphaBps + (B + R)·10_000/O_max)
                                                    hiển thị trước khi tham gia với R = 0 (bảo đảm tối thiểu)
B (100%)  = O_max khi không holdback;  B = (1 − α)·O_max khi có holdback α  (α = 20% → B = 0,8·O_max)
maxBid(k) = capBps·D·(N−k)·P / (10_000·365 days·L),  D = (N − k)·C,  L = số hụi sống trả tiền kỳ đó (không tính người thắng)
            không ai bị đóng băng: L = N − k → maxBid(k) = capBps·C·(N−k)·P / (10_000·365 days)
            đồng thời b < C; L = 0 thì maxBid = 0; HuiMath.maxBid trả min(…, C − 1)
timeScale = periodSeconds / roundDuration           (bản thật = 1)
lateFee   = amount·lateRateBps·elapsedSeconds·timeScale / (10_000·365 days)
            (bản thật, lateRateBps = 1000: lateFee = amount·1000·số ngày trễ/(10_000·365))
fee       = commissionMode ? pot·feeBps/10_000 : 0  → escrow theo kỳ
premium   = pot·reserveBps/10_000                    → quỹ dự phòng
revealBond        = revealBondBps·C/10_000
requiredAllowance = (N − 1)·(C + revealBond)          → allowance ký permit khi vào dây
```

Tên hàm và thứ tự tham số (docs/05 mục 3.5; bản TS và Python dùng cùng tên): `exposure(n, k, c)`, `maxExposure(n, c)`, `holdbackFor(alphaBps, n, k, c)`, `releasePerRound(alphaBps, c)`, `coverageIndexBps(alphaBps, bond, reserve_, n, c)`, `maxBid(capBps, n, k, c, periodSec, payers)`, `lateFee(amount, lateRateBps, elapsedSec, periodSec, roundDuration)`, `bpsOf(amount, bps)`.

Mọi phép chia: chia nguyên làm tròn xuống. Phần dư lẻ về người hốt kỳ đó; kết thúc dây quét dư vào quỹ dự phòng trước khi chia. Diễn giải trần lãi Điều 21 là ĐỀ XUẤT, cần luật sư xác nhận; giữ riêng trong `HuiMath.maxBid` để thay được.

Kiểm chứng Bản án 48/2024/DS-ST (Tây Ninh): 25 phần × 2 triệu, kỳ 5 (20 sống + 4 chết), thăm 450.000. Hụi tháng: maxBid ≈ 0,2·2.000.000·20·30/365 ≈ 657.534 > 450.000 → hợp lệ.

## 3. Tham số mặc định (factory và `CircleParams`)

| Tham số | Mặc định | Giới hạn |
|---|---|---|
| `alphaBps` | 2000 | 0..10_000 |
| `capBps` (trần lãi năm, Điều 21) | 2000 | ≤ `maxCapBps` = 2000 |
| `lateRateBps` (Điều 22 k1: 50% trần) | 1000 | factory |
| `minCoverageBps` | 5000 | `activate()` cần CI ≥ mức này |
| `feeBps` (chỉ dây "họ hưởng hoa hồng") | 100 | ≤ 300; = 0 nếu không phải họ hưởng hoa hồng |
| `reserveBps` | 100 | ≤ 300 |
| `revealBondBps` | 100 (1% C) | ≤ 500 |
| `graceSeconds` | 172.800 (48 giờ) | ≥ 60 |
| `mode` | `Bidding` (họ có lãi) | `Fixed` = họ không lãi, hốt theo `joinIndex` |

Chế độ demo (dev toggle, PHẢI khai báo đầu pitch): `roundDuration = 180 s`, `commitWindow = 90 s`, `revealWindow = 60 s`, `graceSeconds = 120 s`, `periodSeconds` giữ 30 ngày. Bản thật mặc định: `commitWindow = roundDuration − 2 ngày`, `revealWindow = 1 ngày`.

## 4. Lịch và máy trạng thái

```text
roundStart(k) = startTime + (k − 1)·roundDuration + pausedTotal
commit : [roundStart, roundStart + commitWindow)
reveal : [roundStart + commitWindow, roundStart + commitWindow + revealWindow)
settleRound() gọi được khi now ≥ roundStart(k) + roundDuration (= deadline(k)), kỳ k−1 đã chi
```

- Dây: `Forming → Active → Completed`; `Forming → Cancelled` (quá `joinDeadline`); `Active ⇄ Paused`; `Paused → Unwound` (admin gọi `factory.unwindCircle(circle)`, factory gọi `emergencyUnwind()`; chỉ sau 48 giờ tạm dừng liên tục). Kỳ: `NotStarted → Commit → Reveal → AwaitingSettle → Done`, đi theo mốc thời gian, không cần ai "mở".
- Forming: `depositBond` (chủ hụi, nạp thêm được), `join(att, attSig, permit)` (permit trong `try`; permit lỗi vẫn nhận nếu allowance đủ), `leave` (người vào sau lùi lên, `joinIndex` luôn liên tục từ 0; rời rồi không vào lại được dây đó vì `attestationId` đã dùng), `activate` (đủ N, trước hạn, CI ≥ min; thiếu người thì `CircleNotFull`), `cancel` + `withdrawBond` (rút hết rồi thì `NothingToWithdraw`).
- Sau `activate()` không tham số nào đổi được. Factory đếm `activeCirclesOf[organizer]`.

## 5. Bỏ thăm và chọn người hốt (không có yếu tố ngẫu nhiên)

- Được bỏ thăm: hụi sống (chưa hốt, không Frozen) và không còn khoản thiếu chưa trả.
- `commitBid(hash)`: hash = `keccak256(abi.encode(circle, round, member, bid, salt))`; kéo `revealBond`; ghi đè được trong cửa sổ commit (giữ cọc, nhận `commitIndex` mới).
- `revealBid(bid, salt)`: hash khớp; revert nếu `bid > maxBid(k)` hoặc `bid ≥ C` (người commit thăm sai mất cọc; UI phải chặn trước). Hợp lệ thì trả cọc. Không reveal: mất cọc vào quỹ dự phòng, +1 lần trễ trong ReputationRegistry.
- Salt 32 byte sinh phía người dùng bằng `crypto.getRandomValues` chỉ để GIỮ BÍ MẬT thăm, lưu IndexedDB; mất salt thì không mở được thăm.
- So sánh: (1) thăm cao hơn; (2) ít lần trễ hơn (trong dây + `lateCount` toàn cục ở ReputationRegistry); (3) `commitIndex` nhỏ hơn. NĐ 19 Điều 20 mặc định bốc thăm khi bằng thăm; HụiSafe dùng luật chia hòa tất định này như thỏa thuận khác của dây (cần luật sư xác nhận, docs/10 mục 7).
- Không ai thăm hợp lệ: hụi sống có `joinIndex` nhỏ nhất hốt với b = 0. Còn một hụi sống: người đó hốt với b = 0. `Fixed`: người có `joinIndex = k − 1` nếu còn sống; Frozen bị đẩy xuống cuối. Không còn hụi sống mà còn Frozen chưa hốt: Frozen có `joinIndex` nhỏ nhất hốt.

## 6. `settleRound()` (một giao dịch, `nonReentrant`; chi tiết docs/03 mục 6.5)

1. Chọn người hốt w, thăm b; xử lý cọc không reveal.
2. `due`: sống C − b; đã hốt C; Frozen C − b nhưng không kéo, cộng vào `debt`.
3. Kéo `transferFrom` từng người trong `try`; thất bại thì ghi `Shortfall`.
4. Bù ngay theo thác: (1) holdback của chính người đó → (2) ký quỹ → (3) quỹ dự phòng → (4) `uncovered` (người hốt nhận ít hơn, ghi khoản đòi công khai). Ghi rõ từng nguồn.
5. pot = kéo được + đã bù; trích `fee` (escrow kỳ k) và `premium` (quỹ dự phòng).
6. Holdback của w: `H = min(H(k), pot − fee − premium)`; w là Frozen thì H = 0 và trả nợ trước (mục 7).
7. Chi `payout = pot − fee − premium − H` bằng chi an toàn: thử chuyển thẳng, thất bại thì cộng `claimable[addr]`, phát `PaymentDeferred`, người nhận tự `claim()`. Một người thất bại không làm hỏng cả kỳ.
8. Nhả holdback α·C cho người đã hốt vừa đóng đủ, đúng hạn; ghi ReputationRegistry; phát event.

## 7. Trả trễ, vỡ nợ, Frozen, kết thúc, khẩn cấp

- **Thứ tự hoàn** (docs/03 mục 6.8; dùng chung cho `payLate`, `repayDebt`, pot của người Frozen và bước 2 của `finalize`): đi qua các khoản thiếu còn mở của người đó từ kỳ cũ đến kỳ mới; trong mỗi khoản hoàn ngược thác bù: `uncovered` (trả thẳng người hốt kỳ đó) TRƯỚC → quỹ dự phòng → ký quỹ → holdback của chính người đó. Gốc trước, lãi chậm góp sau: mỗi phần gốc p của khoản kỳ r kèm `lateFee(p, now − since_r)` vào quỹ dự phòng. Các trường `uncovered`, `fromReserve`, `fromBond`, `fromHoldback` của `Shortfall` là số CÒN PHẢI HOÀN, giảm dần khi trả; `resolved = true` khi cả bốn về 0.
- `payLate(round)` trong ân hạn G: trả toàn bộ gốc còn lại của khoản kỳ đó + `lateFee`, áp theo thứ tự hoàn; người trả đã hốt thì sau khi hoàn nguồn được nhả phần holdback α·C của kỳ đó đã bị bỏ qua (như đóng đúng hạn), nhờ vậy INV-06 đúng trở lại; ghi trễ, không vỡ nợ.
- `markDefault(member)` (ai cũng gọi, sau `settledAt + G`): đã hốt → DefaultedDead (các kỳ sau vẫn thử kéo C, thiếu thì bù theo thác); chưa hốt → Frozen. Tiền công escrow của kỳ có khoản thiếu đó chuyển vào quỹ dự phòng (`FeeForfeited`). Ghi `recordDefault`.
- Frozen: mỗi kỳ sau phần C − b của họ được bù theo thác và cộng vào `debt`; họ hốt sau cùng (theo `joinIndex`); pot của họ (H = 0, tính trên `pot − fee − premium`) trả gốc các khoản thiếu theo thứ tự hoàn, rồi lãi chậm góp vào quỹ dự phòng, phần còn lại mới chuyển cho họ; không đủ thì họ nhận 0 và nợ còn lại là khoản đòi công khai. Cam kết CI 100% áp dụng cho rủi ro chính là người đã hốt bỏ đóng; Frozen không gây lỗ ròng, ký quỹ chỉ ứng thanh khoản.
- `repayDebt(amount)`: `amount` là phần gốc muốn trả (vượt tổng gốc còn nợ thì `RepayTooLarge(amount, debt)`); áp theo thứ tự hoàn và kéo `amount + Σ lateFee` của các phần gốc đó (allowance thiếu thì revert); không nhả holdback cho người vỡ nợ; vẫn là vỡ nợ, `recordRepaid` khi nợ về 0.
- `finalize()` sau kỳ N + ân hạn: holdback còn lại của người không vỡ nợ trả chính họ; của người vỡ nợ thì trả gốc còn nợ theo thứ tự hoàn (`uncovered`, quỹ dự phòng, ký quỹ) rồi lãi chậm góp, dư trả lại họ; tiền công escrow hợp lệ trả chủ hụi; ký quỹ còn lại trả chủ hụi; quỹ dự phòng chia đều cho thành viên không vỡ nợ (dư lẻ cho `joinIndex` nhỏ nhất); `recordCompleted`; khoản `uncovered` còn lại giữ làm khoản đòi công khai.
- `Paused` (admin = Safe; testnet: ví deployer): mọi hàm đổi trạng thái revert `CircleIsPaused()` (event vẫn là `CirclePaused(uint64 at)`), trừ `claim()`; thời gian dừng cộng vào `pausedTotal`. Admin chỉ thao tác qua factory: `pauseCircle`, `unpauseCircle`, `unwindCircle`. `emergencyUnwind()` chỉ factory gọi, chỉ sau 48 giờ tạm dừng liên tục (sớm hơn: `UnwindTooEarly`), trả theo sổ: ký quỹ còn lại về chủ hụi, holdback về chủ của nó, tiền công escrow vào quỹ dự phòng, quỹ dự phòng chia đều cho người không vỡ nợ, cọc mở thăm về người nộp. Không có hàm nào cho admin rút tiền người dùng.

## 8. Bất biến (bảng đầy đủ docs/03 mục 7.2; INV-01..INV-09 mỗi cái một hàm invariant, INV-10 kiểm tĩnh; cách kiểm ở docs/09 mục 4.4)

- INV-01 sổ cái: `usdc.balanceOf(circle) == bondRemaining + reserve + totalHoldback + Σ feeEscrow + revealBondsHeld + totalClaimable`.
- INV-02 mỗi thành viên hốt đúng một lần; Completed thì đúng N kỳ đã chi.
- INV-03 không thăm thắng nào vượt `maxBid(k)` hay ≥ C.
- INV-04 không kéo của ai quá `due` + cọc + lãi chậm góp họ tự trả.
- INV-05 `payout + fee + premium + H (+ trả nợ) == pot`.
- INV-06 sau m kỳ đã chi, mỗi người đã hốt chưa vỡ nợ d có `holdback[d] ≤ α·(N − m)·C/10_000`; bằng (sai số ≤ N đơn vị) khi d không còn khoản thiếu mở và lúc hốt đã giữ đủ H = `holdbackFor(α, N, r_d, C)`; hệ quả: mọi người đóng đúng hạn thì tổng = α·O(m). Thấy docs/03 và docs/09 lệch nhau thì báo người.
- INV-07 USDC không bao giờ tới admin; chỉ tới thành viên, chủ hụi (ký quỹ, tiền công) và người có `claimable`.
- INV-08 CI ≥ 100% và chỉ người đã hốt bỏ đóng ⇒ `uncovered == 0` mọi kỳ.
- INV-09 kỳ k chỉ chi sau kỳ k − 1 và sau `deadline(k)`; tham số không đổi sau `activate()`.
- INV-10 không dữ liệu cá nhân on-chain (kiểm tĩnh: job `privacy` của CI quét ABI, không tham số `string` trong event và hàm ghi).

Ví dụ số chuẩn (N = 5, C = 100, B = 480, α = 20%, maxBid kỳ 1..4 = 6,575342 / 4,931506 / 3,287671 / 1,643835 USDC; M4 nhận 288,48; M1 nhận 323,18; nhánh A trả trễ, nhánh B vỡ nợ, ký quỹ còn 160) ở docs/03 mục 8, là test `contracts/test/integration/WorkedExample.t.sol`. Demo live trên Fuji chạy cùng kịch bản thu nhỏ C = 10 USDC (mọi số chia 10: ký quỹ 48, thăm thắng kỳ 1 là 0,6, M4 nhận 28,848, M1 nhận 32,318, ký quỹ còn 16) vì faucet USDC có hạn; test tích hợp chạy cả hai mức.

## 9. Ràng buộc pháp lý phải giữ trong code và lời văn

| Quy định | Cách HụiSafe đáp ứng |
|---|---|
| NĐ 19/2019 Điều 5, 6: thành viên, chủ họ đủ 18 tuổi | Tự khai + điều khoản; attester ký `MemberAttestation`; một người một ví |
| Điều 12, 13: sổ họ, biên nhận | Sổ họ dựng từ event (mỗi thay đổi một event) |
| Điều 14: thông báo UBND cấp xã khi một kỳ ≥ 100.000.000 VND hoặc chủ hụi có ≥ 2 dây đang chạy | UI cảnh báo + sinh mẫu thông báo; giá trị một kỳ tính thận trọng = N·C quy đổi (docs/05 mục 12.2), tỷ giá cấu hình, mặc định 1 USDC = 26.000 VND; factory đếm `activeCirclesOf` |
| Điều 18 khoản 4: chủ họ bù phần thiếu | Ký quỹ khóa trong contract |
| Điều 20: lĩnh họ theo thỏa thuận; bằng thăm thì bốc thăm | Chia hòa tất định (mục 5) ghi như thỏa thuận khác của dây, vì luật cuộc thi cấm ngẫu nhiên; cần luật sư xác nhận |
| Điều 21: trần lãi 20%/năm | `maxBid` (diễn giải đề xuất, cần luật sư xác nhận) |
| Điều 22 khoản 1: lãi chậm góp 50% trần | `lateRateBps = 1000` |
| Điều 4 khoản 8, Điều 8: hoa hồng chỉ ở "họ hưởng hoa hồng" | `commissionMode`, `feeBps` |
| Điều 3 khoản 3: cấm cho vay nặng lãi, huy động vốn trái phép | MVP không sinh lãi trên tiền bị khóa (`NoYield`), không quỹ gom chung tự do |

Luật cuộc thi và tiền mã hóa: chỉ testnet Fuji, không nhận tiền thật, không bán token; không ngẫu nhiên; không dữ liệu cá nhân on-chain; LLM không quyết chuyển tiền; lãi giả lập phải nói nguồn lãi thật; crypto không phải phương tiện thanh toán ở Việt Nam. Lời văn pháp lý: dùng skill `vn-legal-pitch`.

## 10. Không bao giờ

- Dùng ngẫu nhiên để chọn người hốt, hay để bất kỳ quyết định nào trong sản phẩm.
- Thêm đường cho admin, chủ hụi hay relayer rút tiền người dùng; thêm quỹ gom chung không bị khóa theo luật.
- Đổi công thức, thứ tự thác bù hay thứ tự hoàn lại mà không cập nhật docs/03 trước và hỏi người.
- Tự đặt tên hàm, event, lỗi khác docs/05.
