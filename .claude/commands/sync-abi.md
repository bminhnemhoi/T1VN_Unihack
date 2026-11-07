---
description: Đồng bộ ABI và địa chỉ từ contracts sang packages/sdk và packages/config sau khi đổi interface, event hoặc deploy - forge build, pnpm --filter sdk generate, kiểm lệch, typecheck, test vector.
argument-hint: "[ghi chú, ví dụ: sau deploy M2]"
disable-model-invocation: true
allowed-tools:
  - Bash(forge build *)
  - Bash(pnpm --filter sdk generate)
  - Bash(pnpm --filter sdk test)
  - Bash(pnpm -r typecheck)
  - Bash(git diff *)
  - Bash(jq *)
---

Đồng bộ ABI và địa chỉ. Ghi chú: $ARGUMENTS

Các bước:

1. **Build contract:** `cd contracts && forge build` để `contracts/out` mới nhất.
2. **Sinh ABI:** `pnpm --filter sdk generate` (`@wagmi/cli` với plugin foundry đọc `contracts/out`, ghi `packages/sdk/src/generated.ts`). Không sửa tay `generated.ts`.
3. **Xem thay đổi:** `git diff --stat packages/sdk/src/generated.ts` rồi tóm tắt hàm, event, lỗi được thêm, bớt, đổi chữ ký. So với `docs/05-cau-truc-du-lieu-va-api.md`: tên lệch thì dừng và báo người (sửa contract hoặc sửa docs/05, không "chữa" trong SDK).
4. **Kiểm an toàn ABI:**
   - Không có hàm `multicall` (ADR-06): `jq -r '.abi[] | select(.name == "multicall") | .name' contracts/out/HuiCircle.sol/HuiCircle.json contracts/out/HuiFactory.sol/HuiFactory.json` phải rỗng.
   - Không có tham số `string` trong event hay hàm ghi (INV-10): `jq -r '.abi[] | select(.type == "event" or (.type == "function" and .stateMutability != "view" and .stateMutability != "pure")) | select([.inputs[]?.type] | index("string")) | .name' contracts/out/HuiCircle.sol/HuiCircle.json contracts/out/HuiFactory.sol/HuiFactory.json contracts/out/ReputationRegistry.sol/ReputationRegistry.json` phải rỗng.
5. **Địa chỉ:** `packages/config/src/addresses.ts` đọc `contracts/deployments/fuji.json` (docs/04 mục 4); kiểm file tồn tại, đúng schema docs/05 mục 6.2, `chainId` = 43113. Không hard-code địa chỉ ở nơi khác.
6. **Kiểm kiểu và vector:** `pnpm -r typecheck` và `pnpm --filter sdk test` (vector `HuiMath` dùng chung `contracts/test/vectors/huimath.json`, `commitHash`). Chỗ gãy kiểu ở `apps/web`, `apps/keeper`: sửa nếu nhỏ, nhiều thì giao `frontend-engineer`.
7. **Commit:** đề xuất `chore(sdk): regenerate ABI` (kèm `chore(config): update Fuji addresses` nếu đổi địa chỉ). Không push.

Báo cáo: thay đổi ABI (bảng), kết quả hai kiểm an toàn, typecheck/test, file đã đổi, commit.
