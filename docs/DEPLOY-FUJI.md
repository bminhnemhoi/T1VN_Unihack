# Deploy HụiSafe lên Fuji (A12, chuẩn bị, chưa broadcast)

Người đọc: Towfienes (chạy `/deploy-fuji`) và Minh (ký Safe). Chỉ Fuji (43113). Tài liệu này chỉ ghi TÊN biến, không ghi giá trị. Mọi khóa do người tự export trước khi mở `claude`; agent không đọc `.env*`.

Đã chạy thử toàn bộ trình tự này trên một anvil mang chain id 43113 (đặt code `MockUSDC` tại địa chỉ USDC của Fuji, cổng 8545): mô phỏng, broadcast, `setFactory` bằng ví admin riêng, `CreateDemoCircle`, keeper và dựng relay đều chạy. Chưa có gì được gửi lên Fuji thật.

## 1. Việc cần có trước khi chạy

| Việc | Ai | Ghi chú |
|---|---|---|
| Safe 2/3 trên Fuji, lấy địa chỉ | Minh + Towfienes | `docs/HUONG-DAN-VI-SAFE.md`. Địa chỉ admin của factory không đổi được sau deploy |
| Bảy ví testnet riêng (ADR-21) | Towfienes | deployer, attester, relayer, keeper, organizer demo, M1..M5 (Privy tạo ví nhúng cho M1..M5 lúc đăng nhập) |
| App Privy (`NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`) | Towfienes | Chỉ để chạy web/relay/attest, không cần cho lệnh forge |
| Merge nhánh đã review vào `main`, working tree sạch | Towfienes | `git status --porcelain` rỗng, `forge test` xanh |

## 2. Biến môi trường (tên; người export, không ghi giá trị vào file nào trong repo)

Deploy (`Deploy.s.sol`):

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `FUJI_RPC_URL` | có | RPC Fuji (`foundry.toml` đọc qua `--rpc-url fuji`) |
| `DEPLOYER_PRIVATE_KEY` | có | ví deployer, chỉ cần AVAX |
| `ADMIN` | có | địa chỉ Safe (công khai) |
| `ALLOW_UNWIRED` | có, đặt `true` | cho phép admin khác deployer; script ghi `"wired": false` và để Safe gọi `setFactory` |
| `ATTESTER_ADDRESS` | có | địa chỉ của khóa `ATTESTER_PRIVATE_KEY`; phải khác deployer và khác admin |
| `RELAYER_ADDRESS` | nên có | chỉ ghi vào `fuji.json` |
| `GIT_COMMIT` | nên có | `export GIT_COMMIT=$(git rev-parse --short HEAD)` |
| `WRITE_DEPLOYMENT` | có, đặt `true` | trên Fuji script chỉ ghi `deployments/fuji.json` khi biến này là `true` |
| `MIN_COVERAGE_BPS` | không | mặc định 10000 trên Fuji và BẮT BUỘC 10000 ở đó (xem mục 4); đừng đặt khi deploy Fuji |
| `SNOWTRACE_API_KEY` | không | thiếu thì dùng chuỗi giữ chỗ `verifyContract` (Routescan không đòi khóa thật) |

Dây demo (`CreateDemoCircle.s.sol`): `DEMO_ORGANIZER_PRIVATE_KEY` (bắt buộc), `JOIN_WINDOW_SECONDS` (mặc định 7 ngày), `DEMO_LABEL` (mặc định `huisafe-demo`, không ghi tên người), `DEPLOY_FILE` (mặc định `deployments/fuji.json`).

Dịch vụ chạy sau deploy:

| Thành phần | Biến |
|---|---|
| Web (relay, attest, copilot) | `FUJI_RPC_URL`, `FUJI_RPC_URL_FALLBACK` (tuỳ chọn), `RELAYER_PRIVATE_KEY`, `ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`; trợ lý: `COPILOT_PROVIDER`, `COPILOT_BASE_URL`, `COPILOT_API_KEY`, `COPILOT_MODEL` (hoặc `ANTHROPIC_API_KEY`) |
| Keeper | `FUJI_RPC_URL`, `KEEPER_PRIVATE_KEY`, `KEEPER_INTERVAL_SECONDS` (15 khi demo) |

`HUISAFE_NETWORK` để trống nghĩa là `fuji`. Kiểm biến có hay chưa mà không in giá trị:

```bash
for v in FUJI_RPC_URL DEPLOYER_PRIVATE_KEY ADMIN ATTESTER_ADDRESS RELAYER_ADDRESS DEMO_ORGANIZER_PRIVATE_KEY; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done
```

## 3. Số dư cần nạp

| Ví | AVAX testnet | USDC (Circle) | Vì sao |
|---|---|---|---|
| Deployer | 0,02 | 0 | Deploy ước 12,1 triệu gas. Gas Fuji hiện khoảng 160 wei nên tốn dưới 0,000001 AVAX; 0,02 là dư rất rộng cho cả đợt thử lại |
| Attester | 0 | 0 | Chỉ ký, không gửi giao dịch |
| Relayer | ≥ 0,02 | 0 | Cảnh báo dưới 0,02 AVAX, **dừng gửi dưới 0,005 AVAX** (`relay.ts`). Trả gas thay M1..M5 |
| Keeper | 0,005 | 0 | Trả gas `settleRound`, `markDefault`, `finalize` |
| Organizer demo | 0,005 | 48 | Tự gửi `createCircle` và `depositBond`; bond = 0,8 × O_max = 0,8 × 60 |
| M1..M5 (mỗi ví) | 0 | khoảng 41 | Relay trả gas. Allowance lúc vào dây = (N − 1) × (C + cọc mở thăm) = 4 × 10,1 = 40,4 USDC, số dư cần xấp xỉ bấy nhiêu cho tới khi hốt |
| Safe (người thực thi) | 0,005 | 0 | Một người ký trả phí cho lệnh `setFactory` |

Tổng USDC: 48 + 5 × 41 = khoảng 253 USDC. Faucet Circle cấp 20 USDC mỗi 2 giờ mỗi ví (kiểm lại tại faucet.circle.com), nên cần xin từ nhiều ví rồi chuyển, bắt đầu sớm hơn một ngày. Cả đội chỉ có khoảng 0,05 AVAX (faucet BTC 0,05 AVAX/lần/ví/24 giờ), nên bảng AVAX trên chia vừa đủ: 0,02 + 0,02 + 0,005 × 3 = 0,055; xin thêm từ nhiều ví nếu thiếu. Nếu không gom đủ USDC thì báo Towfienes để chọn cách giảm quy mô dây demo. AVAX lấy ở faucet chính thức của Avalanche.

## 4. Quyết định 09/11: `minCoverageBps = 10000`

`Deploy.s.sol` trước đây gắn cứng 5000. Đã đổi (chỉ script, không đụng contract): mặc định 10000 trên Fuji, 5000 trên anvil (bản diễn tập local giữ docs/03 mục 2.3), đọc thêm biến `MIN_COVERAGE_BPS` để đổi; script từ chối giá trị lớn hơn 10000 và, trên Fuji, tự kiểm sau deploy rằng `factory.config().minCoverageBps == 10000`. **Trên Fuji giá trị này bắt buộc là 10000** (ADR-22): đặt `MIN_COVERAGE_BPS` khác thì script revert `SanityCheckFailed("config.minCoverageBps")` ngay sau deploy, nên đừng đặt biến này khi deploy Fuji. Có test `test_Execute_Fuji_DefaultMinCoverageIs10000`. `activate()` của dây demo (bond 48 cho O_max 60, α = 20%) cho CI đúng 100%, đạt sàn.

## 5. Trình tự deploy (lệnh broadcast luôn chờ người duyệt)

```bash
cd contracts
cast chain-id --rpc-url fuji                      # phải ra 43113
export GIT_COMMIT=$(git rev-parse --short HEAD) ALLOW_UNWIRED=true WRITE_DEPLOYMENT=true

# 1. Mô phỏng, không broadcast. Xem: thứ tự deploy, usdc = 0x5425...Bc65, admin = Safe, dòng "ACTION REQUIRED"
forge script script/Deploy.s.sol --rpc-url fuji

# 2. Broadcast + verify (Routescan)
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify \
  --verifier etherscan \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}"
```

Script revert trước khi gửi gì nếu chain không phải 43113/31337, attester trùng deployer hoặc admin, admin khác deployer mà chưa đặt `ALLOW_UNWIRED`, hoặc USDC không có code. Kết quả: `contracts/deployments/fuji.json` (có `"wired": false`) và thư mục `contracts/broadcast/Deploy.s.sol/43113/` (dành cho commit, theo `/deploy-fuji`).

### 5.1. Bước của Safe (bắt buộc trước khi tạo dây nào)

Vì `ADMIN` là Safe, deployer không gọi được `registry.setFactory`. Registry chưa nối nghĩa là mọi dây tạo ra chưa ghi được uy tín (`recordX` bị từ chối). Safe phải gửi đúng một giao dịch:

- To: địa chỉ `reputation` trong `fuji.json`; value 0.
- Data: `cast calldata "setFactory(address)" <địa chỉ factory trong fuji.json>`.
- Cần 2 trên 3 chữ ký, một người thực thi (trả phí).
- Kiểm: `cast call <reputation> "factory()(address)" --rpc-url fuji` bằng địa chỉ factory. Gọi lần hai sẽ revert `FactoryAlreadySet` (đã thử).

Sau đó xoá dòng `"wired": false` khỏi `fuji.json` (thiếu trường nghĩa là đã nối, docs/05 mục 6.2) và commit.

### 5.2. Kiểm sau deploy

```bash
for a in forwarder reputation circleLens circleImplementation factory; do
  echo "$a: $(cast code $(jq -r .$a deployments/fuji.json) --rpc-url fuji | head -c 12)"   # khác 0x
done
cast call $(jq -r .factory deployments/fuji.json) "admin()(address)" --rpc-url fuji        # bằng địa chỉ Safe
cast call $(jq -r .factory deployments/fuji.json) "config()((address,address,address,address,uint16,uint16,uint16,uint16,uint16,uint8,uint8,uint96))" --rpc-url fuji
# phần tử thứ 7 (minCoverageBps) phải là 10000
```

Mở `https://testnet.snowtrace.io/address/<địa chỉ>` cho từng contract để xem dấu verified; thiếu thì chạy `/deploy-fuji verify-only`.

## 6. Dây demo trên Fuji (C = 10 USDC)

```bash
cd contracts
forge script script/CreateDemoCircle.s.sol --rpc-url fuji            # mô phỏng
JOIN_WINDOW_SECONDS=1800 DEMO_LABEL=huisafe-demo \
forge script script/CreateDemoCircle.s.sol --rpc-url fuji --broadcast
```

Ví organizer phải đã có 48 USDC (script revert `InsufficientUsdc` nếu thiếu). Thông số: N = 5, `Bidding`, C = 10 USDC, kỳ 180 s (cửa sổ 90/60 s), ân hạn 120 s, P = 30 ngày, α = 20%, phí 1%, quỹ 1%. Script tự kiểm bond = 48 USDC và `coverageIndexBps() == 10000`. Địa chỉ dây in ra ở dòng `demo circle`. Năm thành viên vào dây qua web (Privy, `/api/attest`, permit, `/api/relay`), rồi organizer `activate()` trong `joinDeadline`.

## 7. Đồng bộ ABI và cấu hình

```bash
pnpm --filter sdk generate      # forge build + wagmi generate. Chạy thử: không đổi file (ABI không đổi vì chỉ script đổi)
pnpm -r typecheck && pnpm --filter sdk test
```

Địa chỉ không chép tay ở đâu cả: `packages/config` đọc `contracts/deployments/fuji.json` lúc chạy (tìm lên từ thư mục hiện tại, hoặc đặt `HUISAFE_DEPLOYMENTS_DIR`). Sau khi `fuji.json` vào repo, build lại web để trang thôi báo "chưa triển khai".

## 8. Chạy relay, attest và keeper

```bash
pnpm --filter web build && pnpm --filter web start      # relay và attest là route của web
pnpm --filter keeper start                              # KEEPER_INTERVAL_SECONDS=15 khi demo
```

Lưu ý vận hành (docs/05 mục 8.2): relay giữ hạn mức và nonce trong bộ nhớ, nên web phải chạy như MỘT tiến trình Node liên tục, không serverless nhiều bản. Khi khởi động, attest đối chiếu `ATTESTER_PRIVATE_KEY` với attester ghi trong factory và dừng với lỗi cấu hình nếu lệch; mọi dịch vụ từ chối RPC khác chain id 43113 và URL mainnet.

Đã thử trên anvil giả-Fuji với `HUISAFE_NETWORK=fuji`: keeper in `keeper started` rồi `scan done circles=1 sent=0 failed=0`; handler relay dựng được và trả 400 cho body rỗng.

## 9. Việc còn mở trước khi chạy thật

1. Hở thiết kế M-02 (trả trễ cần allowance mà người dùng không có gas để approve): xem `docs/DE-XUAT-M02.md`, cần quyết định trước khi deploy nếu chọn phương án có đổi contract.
2. Số USDC cho thành viên demo (mục 3) phụ thuộc faucet.
3. Sau deploy: cập nhật `docs/TIEN-DO.md`, README (địa chỉ, link Snowtrace) và `docs/06` mục 6 (cách verify đã dùng).
