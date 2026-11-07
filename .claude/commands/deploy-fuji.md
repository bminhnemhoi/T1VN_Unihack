---
description: Deploy và verify contract HụiSafe lên Avalanche Fuji (chainId 43113) - kiểm tra trước, mô phỏng, broadcast có người duyệt, verify qua Routescan, ghi deployments/fuji.json, đồng bộ ABI, tạo dây demo. Chỉ Fuji, không bao giờ mainnet.
argument-hint: "[all | demo-circle | verify-only]"
disable-model-invocation: true
---

Deploy lên Fuji. Chế độ: $ARGUMENTS (trống = `all`: deploy hệ thống, verify, đồng bộ ABI, tạo dây demo).
Skill tham chiếu: `foundry-fuji`. Đặc tả deploy: `docs/05-cau-truc-du-lieu-va-api.md` mục 3.3 (thứ tự) và mục 6.2 (schema `fuji.json`); mạng và xác minh: `docs/06-avalanche-va-blockchain.md` mục 6.

Các bước (dừng ngay và báo người nếu bước nào thất bại):

1. **Kiểm tra trước.**
   - `git status --porcelain` rỗng và commit hiện tại đã qua review (thường là `main`).
   - `cd contracts && forge build && forge test && forge test --match-path "test/invariant/*"` xanh.
   - Biến môi trường đã được NGƯỜI export trước khi mở `claude` (không đọc `.env.local`, không in giá trị): `for v in FUJI_RPC_URL DEPLOYER_PRIVATE_KEY SNOWTRACE_API_KEY; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done`. Thiếu `SNOWTRACE_API_KEY` thì lệnh verify dùng chuỗi giữ chỗ `verifyContract`.
   - Đúng mạng: `cast chain-id --rpc-url fuji` phải ra `43113`.
   - Số dư deployer: `cast balance <địa chỉ deployer> --rpc-url fuji --ether` (người cho địa chỉ, hoặc `cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY"`, lệnh này sẽ hỏi người duyệt). Thiếu AVAX thì dừng, chỉ faucet trong skill `foundry-fuji` mục 6.
2. **Mô phỏng (không broadcast):** `cd contracts && forge script script/Deploy.s.sol --rpc-url fuji`. Đọc kết quả: thứ tự deploy đúng docs/05 mục 3.3, gas ước tính, địa chỉ USDC là `0x5425890298aed601595a70AB815c96711a31Bc65`.
3. **Broadcast + verify** (lệnh này hỏi người duyệt; nói rõ cho người biết sẽ tốn AVAX testnet):

   ```bash
   cd contracts && forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify \
     --verifier etherscan \
     --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
     --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}"
   ```

4. **Verify bù** (chế độ `verify-only` bắt đầu từ đây): lấy địa chỉ từ `contracts/deployments/fuji.json`; contract nào chưa verify thì chạy `forge verify-contract <địa chỉ> <đường dẫn>:<tên> --chain 43113 --watch --verifier etherscan --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}" --guess-constructor-args`.
5. **Kiểm sau deploy:** `deployments/fuji.json` đúng schema docs/05 mục 6.2 (có `gitCommit`); `cast code <địa chỉ> --rpc-url fuji` khác `0x` với forwarder, registry, implementation, factory; `cast call <registry> "factory()(address)" --rpc-url fuji` bằng địa chỉ factory; liệt kê link `https://testnet.snowtrace.io/address/<địa chỉ>` để người mở xem dấu đã verify.
6. **Đồng bộ ABI và địa chỉ:** làm theo `/sync-abi`.
7. **Dây demo** (chế độ `all` hoặc `demo-circle`): `cd contracts && forge script script/CreateDemoCircle.s.sol --rpc-url fuji --broadcast` (hỏi người duyệt). Tham số demo: N = 5, C = 10 USDC (bản thu nhỏ docs/03 mục 8), `roundDuration` 180 s, `commitWindow` 90 s, `revealWindow` 60 s, `graceSeconds` 120 s, `periodSeconds` 30 ngày, `joinDeadline` đủ dài. Kiểm `coverageIndexBps()` và `state()`.
8. **Ghi lại:** đề xuất commit `contracts/deployments/fuji.json` (thư mục `broadcast/` theo `.gitignore` của repo); cập nhật README (địa chỉ, link Snowtrace) và ghi cách verify đã dùng vào `docs/06` mục 6. Không push.

Không bao giờ: dùng RPC hay chain khác Fuji; đưa khóa riêng lên dòng lệnh dạng hex; in hay đọc file bí mật; bỏ bước mô phỏng; broadcast khi test đỏ.

Báo cáo: bảng contract → địa chỉ → tx hash → đã verify (có/chưa) → link Snowtrace; số AVAX đã dùng; việc còn lại.
