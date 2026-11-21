# Đề xuất sửa luật nợ sau vỡ nợ (21/11/2026)

**Trạng thái:** hướng A ĐÃ LÀM 21/11 (Hiếu duyệt): docs/05 mục 8.1, docs/03 mục 6.8, `apps/web/lib/server/entryGuard.ts` + test, `env.ts`. Hướng B (contract) vẫn CHỜ nhóm quyết định.
**Người viết:** Hiếu (cùng Claude Code), rà soát backend lần 2, PR #16.
**Cần duyệt:** Towfienes (giữ `contracts/` và `/api/attest`), leader.

Theo CLAUDE.md, đổi luật tiền phải hỏi người trước rồi sửa docs/03, docs/05, sau đó mới tới code, test và audit. Tài liệu này là bước "hỏi người": nêu ba lỗ hổng đã tái hiện bằng test, hai hướng sửa và những việc cần làm cho từng hướng.

---

## 1. Ba lỗ hổng (đều đã có test tái hiện, đều đạt)

Cả ba đều xoay quanh luật vào dây của `/api/attest` (docs/05 mục 8.1, dòng "Điều kiện vào dây"): ví bị chặn khi registry ghi `defaults > repaid`. Registry chỉ có hai bộ đếm toàn cục. Luật này giả định "trả hết nợ của một dây" luôn sinh đúng một `recordRepaid`, nhưng contract không bảo đảm điều đó.

| Mã | Lỗ hổng | Test | Hệ quả |
|---|---|---|---|
| G1 | Nợ còn lại sau `finalize` không trả được trên chuỗi: `repayDebt` cần dây `Active` (docs/03 mục 6.8 ghi rõ "khoản đòi công khai ngoài chuỗi"). | `HuiCircleFinalize.t.sol` `test_Gap_DebtLeftAtFinalize_CannotBeRepaidOnChain_Documented` (nhánh B mục 8: M4 còn 320 USDC, có tiền và allowance, `repayDebt` revert `WrongState(Active, Completed)`) | Ví muốn trả cũng không trả được, `repaid` không bao giờ tăng, nên bị chặn **vĩnh viễn** ở mọi dây sau. Người nhận thiếu cũng không bao giờ được trả trên chuỗi. |
| G2 | Nợ được trả hết bằng đường khác `repayDebt` (pot của người bị đóng băng ở mục 6.6, holdback lúc `finalize` ở mục 5.3 bước 2) không ghi `recordRepaid`. | `HuiCircleFinalize.t.sol` `test_Gap_FrozenPotClearsDebt_RegistryStillShowsUnrepaidDefault_Documented` (M5 đóng băng, hốt kỳ 5, `debt = 0`, `repaid = 0`) | Ví **không còn nợ** vẫn bị chặn vĩnh viễn. |
| G3 | Nợ của người vỡ nợ có thể tăng trở lại sau khi đã trả hết (người bị đóng băng bị ghi khoản thiếu ảo mỗi kỳ; người đã hốt vỡ nợ vẫn bị thử trích mỗi kỳ), và `repayDebt` ghi `recordRepaid` mỗi lần nợ về 0. | `HuiCircleLate.t.sol` `test_Gap_RepaidRecordedTwiceInOneCircle_Documented` (một `defaults`, hai `repaid`) | `repaid > defaults` **che** một khoản vỡ nợ chưa trả ở dây khác: ví đang nợ vẫn vào được dây mới. Đây là lỗ ngược chiều của G1, G2 và nguy hiểm hơn vì làm hỏng chính lớp bảo vệ. |

Ví thử `0xb70D…E62D` trên Fuji đang ở tình trạng G1 (`defaults 1, repaid 0`, bị `/api/attest` trả 422 ngày 21/11).

---

## 2. Hướng sửa

### Hướng A: chỉ sửa backend (`/api/attest`), không đổi contract

Bỏ bộ đếm của registry khỏi luật vào dây; đọc thẳng nợ thật:

> Ví bị chặn khi có ít nhất một dây của factory mà ví là thành viên, `memberInfo.defaulted = true` và `memberInfo.debt > 0`.

- Đọc `factory.allCircles()` rồi `memberInfo(wallet)` của mọi dây trong một lần multicall (hiện 16 dây; N dây là N lệnh gộp trong một request). Đặt trần (ví dụ 500 dây mới nhất) và báo lỗi cấu hình khi vượt, để không âm thầm bỏ sót.
- Không đọc được chuỗi thì chặn (fail closed), như luật hiện tại (audit B28 L-02).
- **Sửa được:** G2, G3 ngay cho mọi dây đã triển khai, không deploy lại.
- **Không sửa được:** G1. Ví vẫn bị chặn vĩnh viễn vì nợ thật còn và không có cách trả trên chuỗi. Bộ đếm `defaults`/`repaid` vẫn sai, nên nơi nào hiển thị chúng (huy hiệu uy tín) vẫn có thể sai.
- **Chi phí:** khoảng 1 ngày (route, test, docs/05 mục 8.1). Phải đổi câu luật ở docs/05 mục 8.1 vì đây là API công khai.

### Hướng B: sửa contract (cần deploy lại)

**B1. `recordRepaid` đúng một lần mỗi dây, khi nợ đã chắc chắn hết** (sửa G2, G3):

- Thêm `mapping(address => bool) internal _repaidRecorded;` **nối vào cuối** bố cục lưu trữ của `HuiCircleBase` (docs/05 mục 2.1 cho phép nối thêm; phải chạy `HuiCircleLens.t.sol`).
- Một hàm nội bộ `_settleRepaid(m)`: nếu `mi.defaulted && mi.debt == 0 && settledRounds == N && !_repaidRecorded[m]` thì đặt cờ và gọi `_record(m, recordRepaid)`.
- Gọi ở cuối `repayDebt`, cuối `_repayFromPot` (pot người bị đóng băng; `settledRounds` đã tăng ở dòng 383 trước khi trả nợ ở dòng 435) và trong `finalize` sau khi xử lý holdback (dòng 797).
- Điều kiện `settledRounds == N` là vì trước kỳ cuối nợ còn có thể tăng (G3). Hệ quả: người vỡ nợ đã trả hết giữa chừng chỉ được ghi `repaid` khi kỳ cuối đã chi, và chỉ vào được dây mới từ lúc đó. Phương án khác là ghi ngay lần đầu nợ về 0 rồi khóa cờ; cách đó nhanh hơn cho người trả nhưng mở lại G3 trong chính dây đó (nợ mới phát sinh sau khi đã ghi `repaid`), nên không đề xuất.

**B2. Cho trả nợ sau `finalize`** (sửa G1):

- `repayDebt` chấp nhận `Active` hoặc `Completed`.
- Khi `Completed`, ký quỹ và quỹ dự phòng đã trả hết nên không thể "hoàn nguồn" như cũ. Thứ tự hoàn giữ nguyên, nhưng tiền đi thẳng tới người được hưởng qua chi an toàn (mục 6.7):
  - phần `uncovered`: người hốt kỳ đó (như hiện nay);
  - phần `fromBond`: chủ hụi;
  - phần `fromReserve` và lãi chậm góp: chia cho thành viên không vỡ nợ theo trọng số đúng hạn của ADR-24 (dùng lại `_weightSum`), dư lẻ theo luật hiện tại, phát `ReserveShared`; không ghi `recordCompleted` lần nữa.
- **Cần quyết định thêm:** lãi chậm góp sau `finalize` có tiếp tục chạy không. Đề xuất chặn mốc tính lãi ở thời điểm `finalize` (lưu `completedAt`), để khoản đòi không tăng vô hạn và người trả biết đúng số phải trả.
- Bất biến INV-01 vẫn giữ vì mọi khoản đi ra ngay trong giao dịch hoặc vào `claimable`; INV-07 không đổi (không tới admin).

**Phạm vi và rủi ro của B:**

- Cỡ `HuiCircle` hiện 23.128 B, trần 24.576 B (EIP-170): còn khoảng 1,4 KB. B2 là phần tốn chỗ nhất; nếu vượt thì đưa phần chia quỹ của B2 sang hàm dùng chung với `_shareReserve`.
- Clone đã triển khai không nâng cấp được; `admin` và `implementation` của factory là `immutable`; registry chỉ `setFactory` được một lần. Áp dụng B nghĩa là **deploy lại toàn bộ** (forwarder giữ được, registry mới, lịch sử uy tín bắt đầu lại), cập nhật `contracts/deployments/fuji.json`, `packages/config`, SDK, dây demo, và chứng cứ Fuji trong README và pitch.
- Phải có: unit + fuzz + invariant (Handler) cho luồng tiền mới (CLAUDE.md luật cứng 6), thêm một bất biến kiểu "mỗi (dây, thành viên) có `repaid ≤ defaults`" và "nợ về 0 sau kỳ N thì có đúng một `recordRepaid`", chạy `security-auditor`, Slither.
- **Chi phí:** 2 đến 3 ngày gồm audit, cộng một buổi deploy và cập nhật chứng cứ.

---

## 3. Khuyến nghị

1. **Bây giờ: làm hướng A.** Nó đóng G3 (lỗ cho ví đang nợ lọt vào dây mới) và G2 (ví hết nợ bị chặn) cho các dây đang chạy, không đụng contract đã audit và chứng cứ Fuji đã nộp.
2. **G1:** giữ nguyên luật hiện tại ("khoản đòi công khai ngoài chuỗi", docs/03 mục 6.8) cho bản thi, nhưng giao diện và pitch phải nói rõ: vỡ nợ mà không trả trước khi dây kết thúc thì bị chặn vào dây mới, không có cách gỡ trên chuỗi.
3. **Roadmap (lần deploy sau):** hướng B (B1 + B2), làm đúng quy trình docs-first và audit.

## 4. Thay đổi tài liệu cần duyệt trước khi code

**Nếu chọn A:**

- docs/05 mục 8.1, câu điều kiện vào dây: thay "`defaults ≤ repaid`" bằng "không có dây nào của factory mà ví đã vỡ nợ và còn `debt > 0`", ghi trần số dây đọc và luật fail closed; thêm mã lỗi nếu vượt trần.
- docs/03 mục 6.8: thêm một câu rằng bộ đếm `repaid` của registry chỉ là lịch sử hiển thị, không phải điều kiện vào dây.

**Nếu chọn B (thêm vào A):**

- docs/03 mục 6.8: `repayDebt` chạy được khi `Active` hoặc `Completed`; đường đi của tiền khi `Completed` (mục B2); mốc dừng lãi chậm góp.
- docs/03 mục 5.3: bước 6 và một bước mới cho `recordRepaid` cuối dây; mục 7.2 thêm bất biến.
- docs/05 mục 2.1 (biến lưu trữ mới), 3.2 (`repayDebt` ở trạng thái `Completed`), 3.3 (ngữ nghĩa `repaid`: mỗi dây tối đa một lần), 4.1 (event nếu thêm).

## 5. Câu hỏi cho nhóm

1. Chọn A ngay, B cho lần deploy sau, như khuyến nghị? Hay làm B trước Demo Day?
2. Với B2: lãi chậm góp sau `finalize` có dừng ở mốc `finalize` không?
3. Với B1: chấp nhận việc người vỡ nợ đã trả hết giữa dây chỉ được vào dây mới sau khi kỳ cuối đã chi?
