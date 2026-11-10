---
name: foundry-fuji
description: Quy trình Foundry cho HụiSafe trên Avalanche Fuji (chainId 43113) - foundry.toml, build/test/fmt/coverage, fuzz và invariant với Handler, differential test bằng vector JSON, Slither, deploy bằng forge script, verify trên Snowtrace qua API Routescan, ghi deployments/fuji.json, faucet AVAX và USDC testnet. Dùng khi làm việc trong contracts/, chạy hoặc viết test Solidity, deploy hay verify trên Fuji.
---

# Foundry trên Fuji cho HụiSafe

Mục đích: lệnh và mẫu đúng cho Foundry 1.x (đã đối chiếu `forge --help` bản 1.7.1) trên Avalanche Fuji. Đọc khi build, test, audit, deploy hoặc verify.
Luật giao thức: skill `hui-protocol` và `docs/03-dac-ta-giao-thuc.md`. Tên hợp đồng và hàm: `docs/05-cau-truc-du-lieu-va-api.md`. Kế hoạch kiểm thử: `docs/09-kiem-thu-va-bao-mat.md`.

## 1. Mạng

| Mục | Giá trị |
|---|---|
| Fuji C-Chain | chainId 43113, RPC công khai `https://api.avax-test.network/ext/bc/C/rpc` (dùng qua `FUJI_RPC_URL`) |
| Explorer | `https://testnet.snowtrace.io` |
| USDC Fuji (Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` (kiểm lại tại developers.circle.com) |
| Mainnet (CẤM dùng) | chainId 43114, `api.avax.network`. Hook `guard-bash.sh` chặn mọi lệnh on-chain trỏ tới mainnet |

## 2. `contracts/foundry.toml` mẫu

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc_version = "0.8.28"          # ghim một bản 0.8.x ổn định; đổi đồng loạt nếu cần
evm_version = "cancun"           # ADR-17 (docs/04): chỉ dùng EIP Cancun đã có trên C-Chain
optimizer = true
optimizer_runs = 200
fs_permissions = [
  { access = "read", path = "./test/vectors" },
  { access = "read-write", path = "./deployments" },
]

[fuzz]
runs = 256

[invariant]
runs = 256
depth = 64
fail_on_revert = false

[profile.ci.fuzz]
runs = 5000

[profile.ci.invariant]
runs = 512
depth = 128

[rpc_endpoints]
fuji = "${FUJI_RPC_URL}"

[etherscan]
fuji = { key = "${SNOWTRACE_API_KEY}", chain = 43113, url = "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" }
```

- Routescan (vận hành Snowtrace) cho API key tùy chọn ở gói miễn phí. Không có key thật thì người đặt `SNOWTRACE_API_KEY=verifyContract` trong `.env.local` (chuỗi giữ chỗ theo hướng dẫn Foundry của Routescan).
- OpenZeppelin: `forge install OpenZeppelin/openzeppelin-contracts@<tag v5.x mới nhất>` (Foundry 1.x không tự commit; cờ `--commit` là tùy chọn). `remappings.txt`: `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/` và `forge-std/=lib/forge-std/src/`.
- `slither.config.json` (docs/04): `{ "filter_paths": "lib/|test/|script/", "exclude_dependencies": true }` cộng danh sách detector đã phân loại có lý do.
- Kích thước: `forge build --sizes`. `HuiCircle` là implementation của clone nên vẫn phải dưới giới hạn EIP-170 (24.576 byte).

## 3. Lệnh hằng ngày (chạy trong `contracts/`)

```bash
forge build                                   # hook tự chạy sau mỗi lần sửa .sol
forge fmt && forge fmt --check
forge test -vvv
forge test --match-path "test/unit/*" -vvv
forge test --match-path "test/fuzz/*"
forge test --match-path "test/invariant/*" -vvv
FOUNDRY_PROFILE=ci forge test                 # nhiều run hơn, như CI
forge test --match-test test_WorkedExample -vvvv
forge coverage --report summary
forge snapshot                                # gas snapshot, so sánh trước/sau tối ưu
slither . --filter-paths "lib/|test/|script/" # sau forge build
```

Đặt tên test: `test_<Hàm>_<TìnhHuống>`, `testFuzz_<...>`, `invariant_<...>`; test revert dùng `vm.expectRevert(HuiCircle.<Error>.selector)` hoặc `abi.encodeWithSelector(...)` với tham số.

## 4. Mẫu test

Fuzz: luôn `bound()` đầu vào về miền hợp lệ trong docs/03 (N 3..30, C ≥ 1 USDC, `alphaBps` ≤ 10_000...), kiểm cả biên.

Invariant với Handler (stateful). Handler chỉ gọi đường đi hợp lệ, gom lỗi bằng `try/catch`, giữ ghost variable:

```solidity
// test/invariant/Handler.sol (khung)
contract Handler is Test {
    HuiCircle internal circle;
    MockUSDC internal usdc;
    address[] internal actors;
    uint256 public ghostPaidOut;            // tổng tiền đã chi cho người hốt
    mapping(address => uint256) public ghostWins;

    function warp(uint256 secs) external { vm.warp(block.timestamp + bound(secs, 1, 2 days)); }
    function commit(uint256 seed, uint256 bid, bytes32 salt) external { /* chọn actor, bound bid ≤ maxBid, lưu (bid,salt) */ }
    function reveal(uint256 seed) external { /* reveal đúng hoặc cố tình bỏ reveal */ }
    function drainWallet(uint256 seed) external { /* rút tiền actor để tạo khoản thiếu */ }
    function settle() external { try circle.settleRound() { /* cập nhật ghost */ } catch {} }
    function payLate(uint256 seed, uint32 round) external { /* ... */ }
    function markDefault(uint256 seed) external { /* ... */ }
}
```

```solidity
// test/invariant/Invariants.t.sol (khung)
contract Invariants is StdInvariant, Test {
    function setUp() public {
        // dựng MockUSDC, forwarder, registry, factory, một dây N = 5; cấp tiền + allowance cho actors
        targetContract(address(handler));
    }
    function invariant_INV01_ledger() public view {
        assertEq(
            usdc.balanceOf(address(circle)),
            circle.bondRemaining() + circle.reserve() + circle.totalHoldback()
                + circle.totalFeeEscrow() + circle.revealBondsHeld() + circle.totalClaimable()
        );
    }
    // INV-02..INV-09 tương tự, mỗi bất biến một hàm invariant_INVxx_<tên> (ánh xạ: docs/09 mục 4.4).
    // INV-10 (không dữ liệu cá nhân on-chain) là kiểm tĩnh: job privacy của CI.
}
```

Differential (`HuiMath` Solidity = `huiMath.ts` = `sim/huisim/math.py`): Python sinh vector có seed vào `contracts/test/vectors/huimath.json`; test Solidity đọc bằng `vm.readFile(string.concat(vm.projectRoot(), "/test/vectors/huimath.json"))` rồi `vm.parseJson...`; test TS (`packages/sdk`) đọc cùng file. Không bật `ffi`.

Bố cục test chuẩn (docs/04 mục 4): `test/utils/BaseTest.sol` (dựng hệ thống, helper ký attestation, permit, ForwardRequest), `test/utils/ReentrantToken.sol`; `test/unit/` gồm `HuiMath.t.sol`, `HuiFactory.t.sol`, `HuiCircleForming.t.sol`, `HuiCircleBidding.t.sol`, `HuiCircleSettle.t.sol`, `HuiCircleLate.t.sol`, `HuiCircleEnd.t.sol`, `ReputationRegistry.t.sol`, `Forwarder.t.sol`; `test/fuzz/` gồm `HuiMath.fuzz.t.sol`, `Settle.fuzz.t.sol`, `Differential.t.sol`; `test/invariant/Handler.sol` + `Invariants.t.sol`; `test/integration/WorkedExample.t.sol` (đúng ví dụ docs/03 mục 8, hai nhánh A và B, so từng con số) và `GasBudget.t.sol`.

Ngân sách gas (docs/04 mục 7.1, đo bằng `GasBudget.t.sol` + `forge snapshot --check`): `settleRound` N = 30 ≤ 3.000.000 (cảnh báo từ 2.500.000), N = 5 ≤ 600.000; `finalize` N = 30 ≤ 2.500.000; `join` ≤ 250.000; `commitBid` ≤ 120.000; `revealBid` ≤ 100.000; `createCircle` ≤ 500.000.

## 5. Deploy lên Fuji (qua `/deploy-fuji`; người duyệt lệnh broadcast)

Điều kiện trước: người đã `set -a; source .env.local; set +a` rồi mới mở `claude` (Claude không đọc file env); `forge test` xanh; ví deployer có AVAX Fuji.

Khung `script/Deploy.s.sol` (docs/04 mục 5.3): đọc khóa bằng `vm.envUint("DEPLOYER_PRIVATE_KEY")`, `vm.startBroadcast(pk)`, deploy theo thứ tự đã chốt ở docs/05 mục 3.3: (1) `ERC2771Forwarder("HuiSafeForwarder")`; (2) `ReputationRegistry(admin)`; (3) `HuiCircleLens()`; (4) implementation `HuiCircle(forwarder, lens)` (constructor gọi `_disableInitializers()`); (5) `HuiFactory(admin, implementation, config)` với `config.reputation` = registry; (6) `registry.setFactory(factory)` (gọi lần hai thì revert). Rồi `vm.stopBroadcast()`. `block.chainid == 31337` thì deploy `MockUSDC` và ghi `deployments/anvil.json` (không commit); `43113` thì dùng USDC của Circle và ghi `deployments/fuji.json` bằng `vm.serializeAddress(...)` + `vm.writeJson(...)` đúng schema docs/05 mục 6.2, kèm `gitCommit`. Lệnh xác minh và ghi chú mạng: `docs/06-avalanche-va-blockchain.md` mục 6.

Thử trên máy trước (anvil local): `anvil --block-time 1`, rồi `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`.

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url fuji                       # mô phỏng trước, không broadcast
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify \
  --verifier etherscan \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}"
```

- Forge 1.7.1 mặc định `--verifier sourcify`, nên luôn ghi rõ `--verifier etherscan` + `--verifier-url` Routescan như trên (dạng URL theo hướng dẫn Foundry của Routescan: `https://api.routescan.io/v2/network/testnet/evm/<chainId>/etherscan`). Etherscan báo ngừng hỗ trợ API cho Fuji từ 15/11/2026 (ADR-16), nên không dựa vào Etherscan V2. Kiểm tra lại ở lần deploy đầu (M2) và ghi kết quả vào docs/06.
- Verify thủ công một contract (ví dụ khi `--verify` lỡ thất bại):

```bash
forge verify-contract <ĐỊA_CHỈ> src/HuiFactory.sol:HuiFactory \
  --chain 43113 --watch \
  --verifier etherscan \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}" \
  --guess-constructor-args
```

- Clone EIP-1167 của từng dây: verify implementation; Snowtrace thường tự nhận diện minimal proxy (kiểm tra lại trên trang contract).
- Sau deploy: `/sync-abi`, rồi `forge script script/CreateDemoCircle.s.sol --rpc-url fuji --broadcast` để tạo dây demo (cấu hình demo ở skill `hui-protocol` mục 3).
- Đọc nhanh trên Fuji: `cast call <USDC> "name()(string)" --rpc-url fuji`, `cast call <USDC> "version()(string)" --rpc-url fuji`, `cast balance <ĐỊA_CHỈ> --rpc-url fuji --ether`.

## 6. Tiền testnet (người tự làm, không làm trong phiên Claude)

| Nguồn | Dùng |
|---|---|
| `https://team1vn.xyz/faucet.html` | 0,05 AVAX Fuji nếu ví đang có dưới 0,05 AVAX; mỗi ví một lần, mỗi mạng 24 giờ một lần |
| `https://core.app/tools/testnet-faucet` | Faucet của Core, nhập coupon `avalanche-academy` (theo trang faucet của Team1 Vietnam); chọn Avalanche Fuji (C-Chain) |
| `https://faucet.circle.com` | USDC testnet, chọn mạng Avalanche Fuji; khoảng 20 USDC mỗi 2 giờ cho mỗi ví, mỗi mạng (docs/11 R5), nên gom sớm từ M0 |
| `https://t.me/Team1VNbuilders` | Hỏi khi cả hai faucet AVAX đều không được |

Bốn ví testnet tách vai (ADR-21): deployer (kiêm admin trên testnet), relayer, attester, keeper; chỉ chứa tiền testnet. Relayer và keeper cần đủ AVAX để trả gas (API relay cảnh báo khi dưới 0,02 AVAX, docs/05 mục 8.2).

## 7. Slither

- Chạy `slither .` trong `contracts/` sau `forge build`. Mục tiêu M5: không còn phát hiện mức High.
- Mỗi phát hiện được bỏ qua phải có lý do ghi trong PR (hoặc `// slither-disable-next-line <detector>` kèm lý do ngay trên dòng).
- CI dùng `crytic/slither-action@v0.4.2` với `target: contracts/` và `fail-on: high` (xem `docs/ai-workflow/03-quy-trinh-lam-viec.md`).

## 8. Lỗi hay gặp

- Permit sai domain: đọc `name()` và `version()` của USDC lúc chạy (Circle dùng version "2"); trong test dùng `MockUSDC` có EIP-2612 và EIP-3009.
- Permit bị gửi trước (front-run): `join`/`depositBond` gọi permit trong `try`, rồi kiểm `allowance` đủ.
- Clone chưa khởi tạo: implementation gọi `_disableInitializers()`; factory `initialize` clone ngay trong `createCircle`.
- `ERC2771Context` + `msg.sender`: luôn `_msgSender()`; forwarder là immutable trong implementation nên mọi clone dùng chung.
- Biến môi trường chưa export: forge báo không giải được `${FUJI_RPC_URL}`; nhắc người export, không tự đọc `.env.local`.

## 9. Không bao giờ

- Broadcast tới mainnet, hoặc broadcast mà không có `--rpc-url fuji` / `$FUJI_RPC_URL`.
- Truyền khóa riêng trên dòng lệnh, in biến môi trường, đọc `.env*` hay keystore.
- Bật `ffi`, sửa test cho "xanh" bằng cách nới assert, hay xóa invariant đang đỏ mà không có lý do được người duyệt.
