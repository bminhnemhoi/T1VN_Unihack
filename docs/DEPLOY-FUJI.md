# Runbook deploy HụiSafe lên Fuji (tối nay, một lèo)

Người đọc: Towfienes (chạy các lệnh và duyệt từng lệnh broadcast), Minh (ký Safe sau). Chỉ Fuji (43113). Tài liệu chỉ ghi TÊN biến, không ghi giá trị khóa. Khóa do người tự nạp vào `.env.local` và export trước khi mở `claude`; agent không đọc `.env*`.

Đã diễn tập đúng trình tự này trên một anvil FORK của Fuji giữ chain id 43113 (Safe thật v1.4.1 và USDC thật của Circle trên bản sao, khóa công khai mặc định của anvil, không gửi gì lên Fuji): `pnpm --filter web rehearse:fuji-fork`, nhật ký ở `.handover/REHEARSAL-A15.log`. Trình tự dưới đây là trình tự của buổi diễn tập.

## Trạng thái (10/11/2026)

Bước 3, 4, 5 (Safe, chuẩn bị, deploy) đã XONG trên Fuji thật, 5/5 contract đã verify, `contracts/deployments/fuji.json` đã vào `main` (9df0ba7). KHÔNG chạy lại bước 3 và 5. Còn lại: bước 6 (chia tiền), 7 (tạo 3 dây), 8 (vào dây), 9 (keeper), 10 (web), 11 (kiểm tra) do điều phối chạy.

| Thành phần | Địa chỉ |
|---|---|
| Safe 2/3 (admin của factory) | `0xc7BeE5Cc787833C8Fd76b9066d334Ab131E7c3F5` |
| HuiFactory | `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21` |
| ReputationRegistry | `0xf8F05aa2804144F5aC71485614480f801927E5c3` |
| ERC2771Forwarder | `0x789621cFD56Cc79ec47eF6C449B6C53c40516b2C` |
| HuiCircleLens | `0xb4Ebda56d43db9e629C1FD6b226ac828BE0637a6` |
| HuiCircle (implementation) | `0x3A72591e0d451802F051789497eD5f2B2256673d` |
| Attester | `0x112bda0e04AdB60E6e6d2039498aE1B66a1b95B9` |
| Relayer | `0x6C03fDfD5aB26Aea68878a62942E9E80811055DB` |
| USDC (Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` |

`deployBlock` 60843937. Từ đây `DEPLOY_FILE` mặc định (`deployments/fuji.json`) đã đúng cho các bước còn lại.

Quy ước mỗi bước: (a) mô phỏng, không `--broadcast`; (b) người duyệt rồi mới chạy lệnh `--broadcast`; (c) kiểm. Mọi lệnh chạy từ thư mục `contracts/` (`cd contracts`). Trong bước nào cũng chỉ cần tên biến ở bảng của bước đó.

## 0. Việc cần có trước khi chạy

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| 3 địa chỉ chủ Safe | ĐÃ CHỐT 10/11 | Mục 2. Địa chỉ công khai, cả ba ví do Towfienes giữ; trước khi thi thay một chủ bằng ví của Minh (`docs/HUONG-DAN-VI-SAFE.md` bước 5, địa chỉ Safe không đổi) |
| Bảy ví testnet riêng (ADR-21) | Towfienes | deployer, attester, relayer, keeper, organizer demo, M1..M5. Ví vai trò KHÔNG được là chủ Safe |
| Số dư | xem `.handover/FAUCET.md` | AVAX: deployer 0,05 và relayer 0,05 là đủ (script chia thêm cho keeper và organizer); USDC: deployer 800 (cần 754 cho 3 dây). Chủ Safe số 1 có 1,5 AVAX để thực thi lệnh Safe |
| Nhánh sạch | Towfienes | `git status --porcelain` rỗng, `forge test` xanh, đã gộp vào `main` |
| App Privy | Towfienes | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` (secret mới); chỉ cần cho web, không cần cho lệnh forge |

Kiểm biến có hay chưa mà không in giá trị (chạy sau khi nạp khóa, đổi danh sách tên theo bước):

```bash
for v in FUJI_RPC_URL DEPLOYER_PRIVATE_KEY ATTESTER_ADDRESS RELAYER_ADDRESS SAFE_OWNER_1 SAFE_OWNER_2 SAFE_OWNER_3; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done
cd contracts && cast chain-id --rpc-url fuji        # phải ra 43113
```

## 1. Biến cần có theo bước

| Bước | Biến bắt buộc | Biến tùy chọn |
|---|---|---|
| 3 Safe | `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `SAFE_OWNER_1..3` | `SAFE_SALT` (mặc định 43113) |
| 5 Deploy | `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `ADMIN` (= địa chỉ Safe), `ATTESTER_ADDRESS` (khác deployer và khác Safe), `WRITE_DEPLOYMENT=true` | `RELAYER_ADDRESS` (ghi vào `fuji.json`), `GIT_COMMIT`, `SNOWTRACE_API_KEY`. KHÔNG đặt `MIN_COVERAGE_BPS` (mặc định 10000 trên Fuji, đặt khác thì script revert) |
| 6 Chia tiền | `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `RELAYER_ADDRESS`, `KEEPER_ADDRESS`, `ORGANIZER_ADDRESS`, `M1_ADDRESS`..`M5_ADDRESS` | `FUND_TARGET` (`single` mặc định, `demoday` cho 3 dây), `DEPLOY_FILE` |
| 7 Tạo 3 dây | `FUJI_RPC_URL`, `DEMO_ORGANIZER_PRIVATE_KEY` | `JOIN_WINDOW_SECONDS` (mặc định 7 ngày), `DEPLOY_FILE` |
| 8 Vào dây | `FUJI_RPC_URL`, `DEMO_ORGANIZER_PRIVATE_KEY`, `DEMO_M1_PRIVATE_KEY`..`DEMO_M5_PRIVATE_KEY`, `ATTESTER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY` | `DEMO_JOIN` (`all` mặc định hoặc `fixed`), `DEMO_ACTIVATE` (`true` mặc định), `M1_ADDRESS`..`M5_ADDRESS` (nếu đặt phải khớp khóa) |
| 9 Keeper | `FUJI_RPC_URL`, `KEEPER_PRIVATE_KEY` | `KEEPER_INTERVAL_SECONDS` (15 khi demo) |
| 10 Web | `FUJI_RPC_URL`, `RELAYER_PRIVATE_KEY`, `ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | `FUJI_RPC_URL_FALLBACK`, `TRUST_PROXY`, biến trợ lý (`COPILOT_*` hoặc `ANTHROPIC_API_KEY`) |

`HUISAFE_NETWORK` để trống nghĩa là `fuji`.

## 2. Ba chủ Safe (đã chốt)

```bash
export SAFE_OWNER_1=0x37fB0D48F2e4eBF2B0aE4349C062440df5f3C088   # có 1,5 AVAX, người thực thi lệnh Safe
export SAFE_OWNER_2=0x5FdeB3A06f0717E9a97946C54E64C2fF3327546A
export SAFE_OWNER_3=0xFEBcE5767fdC2fbE26fC9F020CaF4CF497912AD3
```

Ba địa chỉ này công khai, có thể đặt trong `.env.local`. Script từ chối chủ Safe trùng nhau, bằng 0, là hợp đồng, hoặc trùng ví deployer.

## 3. Tạo Safe 2/3 (ADR-26) - XONG 10/11, Safe `0xc7BeE5Cc787833C8Fd76b9066d334Ab131E7c3F5`

```bash
# (a) mô phỏng
forge script script/CreateSafe.s.sol --rpc-url fuji
# (b) người duyệt rồi mới broadcast (qua /deploy-fuji hoặc trực tiếp)
forge script script/CreateSafe.s.sol --rpc-url fuji --broadcast
```

(c) Kiểm: dòng `Safe (2/3) created at: 0x...`. Đặt ngay `export ADMIN=<địa chỉ Safe>` rồi:

```bash
cast call $ADMIN "getThreshold()(uint256)" --rpc-url fuji        # 2
cast call $ADMIN "getOwners()(address[])" --rpc-url fuji         # đúng ba địa chỉ ở mục 2
```

Mở `https://app.safe.global` với chủ số 1 để chắc chắn Safe hiện ra (hướng dẫn: `docs/HUONG-DAN-VI-SAFE.md`).

## 4. Chuẩn bị deploy - XONG 10/11

```bash
export GIT_COMMIT=$(git rev-parse --short HEAD) WRITE_DEPLOYMENT=true
# ADMIN = địa chỉ Safe ở bước 3; ATTESTER_ADDRESS, RELAYER_ADDRESS = địa chỉ công khai của hai ví vai trò
```

## 5. Deploy (ADMIN = Safe, registry admin = deployer, script tự nối) - XONG 10/11, factory `0x5004477143F8Db65f80992A0BD79c1DAb75C8b21`

```bash
# (a) mô phỏng: xem thứ tự deploy, usdc = 0x5425...Bc65, admin = Safe, dòng "registry.setFactory: done"
forge script script/Deploy.s.sol --rpc-url fuji
# (b) người duyệt rồi mới broadcast + verify (Routescan)
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify \
  --verifier etherscan \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}"
```

Script revert trước khi gửi gì nếu chain không phải 43113/31337, attester trùng deployer hoặc admin, hoặc USDC không có code. Registry nhận admin là deployer và được nối ngay trong script (`setFactory` một lần), nên KHÔNG cần chữ ký Safe lúc deploy. Kết quả: `contracts/deployments/fuji.json` (ghi vì `WRITE_DEPLOYMENT=true`, có `deployBlock`) và `contracts/broadcast/Deploy.s.sol/43113/`.

(c) Kiểm:

```bash
F=$(jq -r .factory deployments/fuji.json); R=$(jq -r .reputation deployments/fuji.json)
for a in forwarder reputation circleLens circleImplementation factory; do
  echo "$a: $(cast code $(jq -r .$a deployments/fuji.json) --rpc-url fuji | head -c 12)"   # khác 0x
done
cast call $F "admin()(address)" --rpc-url fuji            # == địa chỉ Safe (KHÔNG phải deployer)
cast call $R "factory()(address)" --rpc-url fuji          # == $F
cast call $R "admin()(address)" --rpc-url fuji            # == deployer
cast call $F "config()((address,address,address,address,uint16,uint16,uint16,uint16,uint16,uint8,uint8,uint96))" --rpc-url fuji
# phần tử thứ 7 (minCoverageBps) phải là 10000
```

Mở `https://testnet.snowtrace.io/address/<địa chỉ>` cho từng contract để xem dấu verified; thiếu thì chạy `/deploy-fuji verify-only`.

Ghi vào repo: commit `contracts/deployments/fuji.json` và `contracts/broadcast/Deploy.s.sol/43113/run-latest.json` (theo `/deploy-fuji`), rồi đồng bộ SDK:

```bash
cd .. && pnpm --filter sdk generate        # forge build + wagmi generate, không đổi file nếu ABI không đổi
pnpm -r typecheck && pnpm --filter sdk test
cd contracts
```

Địa chỉ không chép tay ở đâu cả: `packages/config` đọc `contracts/deployments/fuji.json` lúc chạy (tìm lên từ thư mục hiện tại, hoặc `HUISAFE_DEPLOYMENTS_DIR`).

## 6. Chia tiền cho các ví demo (từ deployer)

```bash
export FUND_TARGET=demoday          # 3 dây: organizer 144, mỗi thành viên 122 USDC; bỏ qua = single (48 và 41)
# (a) mô phỏng: xem "AVAX sent", "USDC sent"
forge script script/FundDemoWallets.s.sol --rpc-url fuji
# (b) người duyệt rồi mới broadcast
forge script script/FundDemoWallets.s.sol --rpc-url fuji --broadcast
```

Chỉ chuyển phần còn thiếu, chạy lần hai gửi 0. Mục tiêu AVAX: relayer 0,02, keeper 0,005, organizer 0,005 (M1..M5 không cần AVAX, relayer trả gas). Script revert `InsufficientUsdc` hoặc `InsufficientAvax` TRƯỚC khi gửi bất cứ gì nếu deployer không đủ; khi đó chỉ chạy được `FUND_TARGET=single` hoặc phải xin thêm faucet.

(c) Kiểm số dư:

```bash
U=0x5425890298aed601595a70AB815c96711a31Bc65
cast call $U "balanceOf(address)(uint256)" $ORGANIZER_ADDRESS --rpc-url fuji     # 144000000
cast call $U "balanceOf(address)(uint256)" $M1_ADDRESS --rpc-url fuji            # 122000000
cast balance $KEEPER_ADDRESS --rpc-url fuji --ether                              # >= 0.005
```

## 7. Tạo 3 dây demo

```bash
# (a) mô phỏng
forge script script/CreateDemoCircles.s.sol --rpc-url fuji
# (b) người duyệt rồi mới broadcast (JOIN_WINDOW_SECONDS tùy chọn, mặc định 7 ngày)
forge script script/CreateDemoCircles.s.sol --rpc-url fuji --broadcast
```

Ba dây (C = 10 USDC, kỳ 180 s, cửa sổ 90/60 s, ân hạn 120 s, P = 30 ngày, α = 20%), mỗi dây CI đúng 100% và `termsHash` đúng văn bản chuẩn của SDK:

| Dây | Kiểu | N | φ | Phí | Ký quỹ | Ví dụ |
|---|---|---|---|---|---|---|
| 1 `huisafe-demo-bid` | Bidding | 5 | 0 | 1% pot | 48 | docs/03 mục 8 chia 10 |
| 2 `huisafe-demo-phi` | Bidding | 5 | 5000 | trần 3% pot | 48 | docs/03 mục 8.1 chia 10 |
| 3 `huisafe-demo-fixed` | Fixed | 3 | 0 | 1% pot | 16 | ADR-28: chạy sẵn tới lúc kết thúc |

Script tự kiểm bond và `coverageIndexBps() == 10000` của từng dây; organizer cần 112 USDC (`InsufficientUsdc` nếu thiếu). (c) Kiểm: `cast call $F "circlesOf(address)(address[])" $ORGANIZER_ADDRESS --rpc-url fuji` ra 3 địa chỉ (in cả ở các dòng `demo circle ...`).

## 8. Cho M1..M5 vào dây và kích hoạt (không cần Privy)

Cùng đường với web: khóa attester ký `MemberAttestation`, khóa thành viên ký permit USDC đúng `requiredAllowance` và forward request ERC-2771, khóa relayer gửi `forwarder.execute`. Thành viên không có AVAX.

```bash
# Dây 3 (Fixed) chạy sẵn trước giờ demo, hai dây Bidding để Forming cho người tham gia thử bằng Privy trên web:
export DEMO_JOIN=fixed
# Muốn cả ba dây chạy ngay: DEMO_JOIN=all (mặc định). Chỉ vào dây, chưa kích hoạt: DEMO_ACTIVATE=false
forge script script/JoinDemoCircles.s.sol --rpc-url fuji                 # (a) mô phỏng
forge script script/JoinDemoCircles.s.sol --rpc-url fuji --broadcast     # (b) người duyệt
```

Chạy lại an toàn: thành viên đã vào thì bỏ qua. (c) Kiểm: `cast call <dây> "state()(uint8)" --rpc-url fuji` ra `1` (Active) cho dây đã kích hoạt, `cast call <dây> "members()(address[])" --rpc-url fuji` đủ N địa chỉ. Dây Fixed N = 3 xong sau khoảng 3 × 180 s + ân hạn 120 s; dây Bidding N = 5 sau khoảng 5 × 180 s + 120 s, cần keeper chạy (bước 9).

## 9. Keeper

```bash
pnpm --filter keeper start       # KEEPER_INTERVAL_SECONDS=15 khi demo; cần KEEPER_PRIVATE_KEY, FUJI_RPC_URL
```

Dòng log đúng: `keeper started`, rồi `scan done circles=3 sent=... failed=0`. Keeper gửi trực tiếp từ ví keeper (ADR-21), gas hạn 5.000.000.

## 10. Web, relay và attest

```bash
pnpm --filter web build && pnpm --filter web start      # relay và attest là route của web
```

- Phải chạy như MỘT tiến trình Node liên tục (hạn mức và nonce relay nằm trong bộ nhớ, docs/05 mục 8.2).
- Khi khởi động attest đối chiếu `ATTESTER_PRIVATE_KEY` với attester trong factory và dừng nếu lệch; mọi dịch vụ từ chối RPC khác chain id 43113 và URL mainnet.
- Hạn mức IP (audit A14 H-01, A15 H-01): chỉ tin `x-forwarded-for` khi đặt `TRUST_PROXY=true`, và chỉ khi web chạy sau đúng MỘT proxy tin cậy GHI ĐÈ header (không phải proxy chỉ đặt `X-Real-IP` hay chỉ nối thêm sau header của client; không bật cờ này khi không có proxy). Không đặt thì không có cổng hạn mức IP nào (cố ý: một nhóm chung sẽ để người lạ làm cạn nhóm và khóa mọi thành viên); hạn mức theo ví/người dùng Privy và ngân sách chung của relayer vẫn chạy. Chạy `next start` trực tiếp trên máy demo: để trống và bind cục bộ `pnpm --filter web start -- -H 127.0.0.1`. Mở ra ngoài Internet: đặt Caddy phía trước rồi mới bật `TRUST_PROXY=true`:

  ```caddyfile
  demo.example.com {
      reverse_proxy 127.0.0.1:3000
  }
  ```

  (Caddy mặc định bỏ `X-Forwarded-For` do client gửi và ghi địa chỉ thật.)
- `/api/copilot` còn bộ đếm IP riêng lấy phần tử đầu của `x-forwarded-for` (né được bằng header giả); chưa đổi, chờ Towfienes quyết định (audit A15 M-01).
- Relayer cảnh báo dưới 0,02 AVAX, dừng gửi dưới 0,005 AVAX (503 `RelayUnavailable`).

## 11. Kiểm tra sẵn sàng

Chạy `/demo-check http://localhost:3000` (bước kiểm `factory.admin()` bằng Safe đã có trong lệnh). Sau deploy cập nhật: `docs/TIEN-DO.md`, README (địa chỉ, link Snowtrace), `docs/06` mục 6 (cách verify đã dùng).

## 12. Diễn tập lại bất cứ lúc nào (không tốn gì thật)

```bash
pnpm --filter web rehearse:fuji-fork
```

Dựng anvil fork Fuji (chain id 43113, đọc RPC công khai; đặt `REHEARSAL_FORK_URL` để dùng RPC khác), chạy đúng các bước 3, 5, 6, 7, 8, 9 ở trên bằng khóa công khai mặc định của anvil, rồi kiểm `factory.admin() == Safe`, `registry.factory() == factory`, `minCoverageBps == 10000`, ba dây Active với CI 100%, relay chuyển được một thăm kín thật, keeper chạy tới khi cả ba dây kết thúc. Ghi vào `.handover/REHEARSAL-A15.log`; không động tới `contracts/deployments/fuji.json` (đầu ra nằm ở `contracts/deployments/rehearsal/`, đã ignore) và không ghi vào `contracts/broadcast/`.

## 13. Số dư tham chiếu (vì sao chừng đó)

| Ví | AVAX | USDC | Vì sao |
|---|---|---|---|
| Deployer | 0,05 | 800 | Deploy ước 12,1 triệu gas, gas Fuji hiện 160 wei nên dưới 0,000001 AVAX; USDC 800 để chia (754 cho 3 dây) |
| Attester | 0 | 0 | Chỉ ký, không gửi giao dịch |
| Relayer | ≥ 0,02 | 0 | Trả gas thay M1..M5 |
| Keeper | 0,005 | 0 | Gas `settleRound`, `markDefault`, `finalize` |
| Organizer demo | 0,005 | 112 (cần), 144 (chia) | `createCircle`, `depositBond`, `activate`; ký quỹ 48 + 48 + 16 |
| M1..M5 | 0 | 122 | Allowance vào dây = (N − 1) × (C + cọc mở thăm): 40,4 + 40,4 + 20 = 100,8 USDC cho cả ba dây; số dư dùng để góp từng kỳ |
| Chủ Safe số 1 | 1,5 | 0 | Thực thi lệnh Safe khi cần |

## 14. Việc còn mở sau khi deploy

1. Thay một chủ Safe bằng ví của Minh (2 chữ ký, địa chỉ Safe không đổi).
2. `docs/TIEN-DO.md`, README, `docs/06` mục 6 như mục 11.
3. Etherscan ngừng API Fuji từ 15/11/2026 (rủi ro R16): verify xong trước ngày đó.
