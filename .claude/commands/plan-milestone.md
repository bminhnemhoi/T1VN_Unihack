---
description: Lập kế hoạch cho một mốc M0-M7 ở plan mode - đọc docs/11, kiểm hiện trạng repo, chia việc P1/P2/P3 theo mã C/W/T, tiêu chí chấp nhận đo được, rủi ro, việc cắt. Không sửa file trước khi người duyệt.
argument-hint: "[M0..M7] [ghi chú thêm]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git log *)
  - Bash(true)
---

Lập kế hoạch cho mốc: $ARGUMENTS
(Trống thì dùng mốc hiện tại mà hook SessionStart đã in ra đầu phiên.)

Hiện trạng repo lúc gọi lệnh:
- Nhánh và thay đổi: !`git status --short --branch || true`
- Commit gần đây: !`git log --oneline -8 || true`
(Dòng nào trống: tự chạy lại lệnh git tương ứng.)

Các bước:

1. Nếu phiên chưa ở plan mode, chuyển sang plan mode trước (chỉ đọc, chạy lệnh đọc, không sửa file).
2. Đọc `docs/11-ke-hoach-trien-khai.md`: bảng mốc (mục 1), kế hoạch từng ngày (mục 3), việc từng người với mã C1..C13, W1..W13, T0..T10 (mục 4), định nghĩa xong của mốc (mục 5), rủi ro (mục 6), danh sách cắt (mục 7).
3. Đọc tài liệu theo mốc: contract thì `docs/03`, `docs/05`, `docs/09`; web, relayer, keeper thì `docs/02`, `docs/04`, `docs/05`; trợ lý, mô phỏng thì `docs/07`, `docs/08`; pitch, nộp bài thì `docs/10`, `docs/12`.
4. Kiểm hiện trạng so với `docs/04-kien-truc.md` mục 4: file nào đã có, file nào thiếu; nếu đã có `contracts/` thì chạy `cd contracts && forge build && forge test` để biết đang xanh hay đỏ; nếu đã có `package.json` thì chạy `pnpm -r typecheck`.
5. Viết kế hoạch gồm:
   - Bảng việc: mã, mô tả, người (P1/P2/P3), giờ ước tính, phụ thuộc, file sẽ tạo/sửa, tiêu chí chấp nhận đo được (lệnh kiểm, con số), subagent hoặc lệnh dùng (`solidity-engineer`, `test-engineer`, `security-auditor`, `frontend-engineer`, `simulation-analyst`, `pitch-writer`, `/implement`, `/audit`, `/sync-abi`, `/deploy-fuji`, `/demo-check`).
   - Thứ tự làm và điểm kiểm giữa ngày; việc có thể chạy song song bằng worktree (`claude --worktree <tên>`).
   - Rủi ro của mốc (lấy từ docs/11 mục 6) và cách giảm; việc sẽ cắt trước nếu trễ (theo đúng thứ tự docs/11 mục 7, không cắt mục "Không bao giờ cắt").
   - Quyết định cần người chốt (ai, hạn).
6. Đối chiếu kế hoạch với định nghĩa xong của mốc (docs/11 mục 5) và luật cứng trong CLAUDE.md; ghi rõ chỗ nào chưa phủ.
7. Trình kế hoạch để người duyệt. Chưa duyệt thì không tạo hay sửa file. Sau khi duyệt, chỉ ra prompt tương ứng trong `docs/ai-workflow/02-prompt-playbook.md` cho từng việc.

Định dạng trả lời: tiêu đề "Kế hoạch <mốc> - hạn <ngày>", bảng việc, thứ tự, rủi ro, việc cắt, quyết định cần chốt. Tiếng Việt, không emoji.
