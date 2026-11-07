---
description: Làm một đầu việc từ đầu đến cuối - hiểu đặc tả, kế hoạch ngắn, giao subagent đúng chuyên môn, test, audit nếu đụng luồng tiền, kiểm Definition of Done, commit (không push).
argument-hint: "<mã việc hoặc mô tả, ví dụ: C6 settleRound>"
disable-model-invocation: true
---

Đầu việc: $ARGUMENTS

Các bước:

1. **Hiểu việc.** Nếu có mã (C.., W.., T..), đọc dòng tương ứng ở `docs/11-ke-hoach-trien-khai.md` mục 4 và định nghĩa xong của mốc (mục 5). Đọc đặc tả liên quan: `docs/03` và `docs/05` cho tiền và contract; `docs/02`, `docs/04` cho web, relayer, keeper; `docs/07`, `docs/08` cho trợ lý, mô phỏng. Thiếu thông tin quyết định luật tiền thì hỏi người, không đoán.
2. **Kế hoạch ngắn** (5-10 dòng): file sẽ đổi, test sẽ thêm, lệnh kiểm, tiêu chí chấp nhận. Việc lớn (nhiều khu vực, đổi interface, đổi luật) thì chuyển sang plan mode và chờ người duyệt.
3. **Nhánh.** Đang ở `main` thì tạo nhánh: `git switch -c <loại>/<khu-vực>-<mô-tả-ngắn>` (ví dụ `feat/contracts-settle-round`).
4. **Giao việc** cho subagent, mỗi lần giao ghi rõ mục tiêu, file, docs cần đọc, tiêu chí chấp nhận, lệnh kiểm:
   - `contracts/src`, `contracts/script` → `solidity-engineer`
   - `contracts/test` → `test-engineer`
   - `apps/web`, `apps/keeper`, `packages/*` → `frontend-engineer`
   - `sim/` → `simulation-analyst`
   - slide, video, README, form → `pitch-writer`
5. **Test.** Đụng luồng tiền (contracts, `/api/relay`, `/api/attest`, keeper, `huiMath`) thì `test-engineer` phải thêm unit + fuzz (+ invariant nếu đổi trạng thái tiền). Chạy:
   - contracts: `cd contracts && forge fmt --check && forge build --sizes && forge test -vvv && forge test --match-path "test/invariant/*"`
   - TypeScript: `pnpm -r lint && pnpm -r typecheck && pnpm -r test`
   - sim: `cd sim && pytest -q`
6. **Audit.** Đụng `contracts/` hoặc luồng tiền thì giao `security-auditor` (chỉ đọc) xem diff; sửa hết Critical/High rồi lặp lại bước 4-6.
7. **Đồng bộ.** Đổi interface hoặc event thì chạy quy trình `/sync-abi` (forge build, `pnpm --filter sdk generate`, typecheck).
8. **Definition of Done** trong CLAUDE.md: tick từng mục, ghi mục nào chưa đạt và vì sao. Hành vi đổi thì cập nhật docs (hỏi trước khi sửa `docs/03`, `docs/05`).
9. **Commit** theo Conventional Commits tiếng Anh (`feat(contracts): settle round with waterfall coverage`), mỗi commit một ý; `git add` + `git commit` được phép. KHÔNG `git push`, không mở PR: người làm việc đó, dùng template PR ở `docs/ai-workflow/03-quy-trinh-lam-viec.md`.

Báo cáo cuối (tiếng Việt):

```text
## Việc: <mã> <tên>
## Đã đổi: <file> - <tóm tắt>
## Test: lệnh đã chạy, kết quả (số test, invariant, coverage nếu có)
## Audit: Critical n | High n | Medium n (đã sửa / còn lại)
## Definition of Done: đạt n/7, chưa đạt: ...
## Commit: <hash> <message>
## Việc tiếp theo hoặc cần người quyết
```
