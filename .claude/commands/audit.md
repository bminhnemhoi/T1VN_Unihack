---
description: Chạy subagent security-auditor (chỉ đọc) trên phạm vi chỉ định - Slither, test, checklist bảo mật HụiSafe, đối chiếu INV-01..INV-10 - và trả báo cáo theo mức Critical/High/Medium/Low/Info.
argument-hint: "[diff (mặc định) | all | <đường dẫn> | pr <số>]"
context: fork
agent: security-auditor
background: false
disable-model-invocation: true
allowed-tools:
  - Bash(git rev-parse *)
  - Bash(git log *)
  - Bash(git diff *)
  - Bash(true)
---

Kiểm toán bảo mật HụiSafe. Phạm vi: $ARGUMENTS
(Trống hoặc "diff": các thay đổi của nhánh hiện tại so với `origin/main`. "all": toàn bộ `contracts/src` cùng `apps/web/app/api/relay`, `apps/web/app/api/attest`, `apps/keeper`.)

Bối cảnh lúc gọi lệnh:
- Nhánh: !`git rev-parse --abbrev-ref HEAD || true`
- Commit: !`git log --oneline -1 || true`
- File đổi so với origin/main: !`git diff --stat origin/main...HEAD || git diff --stat HEAD || true`
(Dòng nào trống: tự chạy lại lệnh git tương ứng ở bước 1.)

Các bước:

1. Xác định file và hàm trong phạm vi; với "pr <số>" thì dùng `gh pr diff <số>`. Đọc `docs/03-dac-ta-giao-thuc.md` (mục 6, 7, 9), `docs/05-cau-truc-du-lieu-va-api.md` (quyền, event, lỗi, mục 8 API), `docs/09-kiem-thu-va-bao-mat.md`.
2. `cd contracts && forge build && slither .` (dùng `slither.config.json` nếu có). Phân loại từng phát hiện: thật, giả dương (lý do), đã chấp nhận.
3. `forge test -vvv` và `forge test --match-path "test/invariant/*"`; ghi test đỏ và bất biến chưa có test.
4. Rà checklist trong định nghĩa của bạn (reentrancy, quyền, ERC-2771, chữ ký, permit/allowance, làm tròn, DoS vòng lặp, cửa sổ thời gian, griefing bằng không mở thăm, pause/unwind, chọn người hốt tất định, riêng tư, off-chain). Mỗi nghi vấn cần kịch bản khai thác cụ thể hoặc bị loại.
5. Đối chiếu INV-01..INV-10: có test chưa, test có kiểm đúng không.
6. Viết báo cáo theo định dạng trong định nghĩa của bạn (tóm tắt theo mức, từng phát hiện có vị trí, kịch bản, đề xuất sửa, test chứng minh; bảng Slither; bảng INV).

Bạn KHÔNG sửa, tạo hay xóa file, không commit, không broadcast. Chỉ trả báo cáo.
