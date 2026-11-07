# 06. Avalanche và blockchain

**Mục đích và đọc khi nào.** File này gom mọi điều về chuỗi mà HụiSafe dựa vào: số liệu mạng Fuji, phí và độ chốt, các bản nâng cấp của Avalanche ảnh hưởng tới thiết kế, các chuẩn EIP/ERC dùng ở đâu, lập luận "Vì sao Avalanche" theo thang chấm 25 điểm, quy trình deploy và xác minh trên Fuji, kế hoạch L1 bonus, roadmap mainnet và chi phí. Đọc trước khi deploy, khi viết slide "Vì sao Avalanche", và khi cân nhắc làm L1. Số về phí và giá thay đổi theo ngày: đọc lại trước khi trình bày. Kiến trúc ở [04](04-kien-truc.md). Lệnh Foundry đầy đủ ở skill `foundry-fuji`. Luật ở [03](03-dac-ta-giao-thuc.md), tên ở [05](05-cau-truc-du-lieu-va-api.md).

---

## 1. Mạng Fuji

| Mục | Giá trị | Nguồn, ngày xem |
|---|---|---|
| Mạng | Avalanche Fuji C-Chain (testnet) | |
| chainId | 43113 | Academy, Network setup (06/11/2026) |
| RPC công khai | `https://api.avax-test.network/ext/bc/C/rpc`, dùng qua biến `FUJI_RPC_URL`; thêm `FUJI_RPC_URL_FALLBACK` (04, mục 7.4) | như trên |
| Explorer | `https://testnet.snowtrace.io`. Snowtrace hiện do Routescan vận hành; bản chạy trên Etherscan đã ngừng ngày 30/11/2023 | Avalanche docs, Snowtrace (06/11/2026) |
| USDC (Circle) trên Fuji | `0x5425890298aed601595a70AB815c96711a31Bc65`. Luôn kiểm lại tại developers.circle.com trước khi deploy. Đây là `FiatTokenProxy` (proxy nâng cấp được) | Circle, USDC contract addresses (06/11/2026); API Routescan trả `FiatTokenProxy` (06/11/2026) |
| USDC trên C-Chain mainnet | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` (chỉ cho roadmap) | Circle (06/11/2026) |
| Domain permit của USDC | Đọc `name()` và `version()` lúc chạy; USDC của Circle dùng version "2" | 03 mục 10; 05 mục 5.2 |

Faucet:

| Faucet | Cấp gì | Điều kiện |
|---|---|---|
| `https://team1vn.xyz/faucet.html` (BTC) | 0,05 AVAX mỗi lần | Ví đang có dưới 0,05 AVAX; mỗi ví 24 giờ một lần |
| `https://core.app/tools/testnet-faucet` | AVAX Fuji (C-Chain), nhập coupon `avalanche-academy` | Lượng cấp cần kiểm tra |
| Builder Console faucet | AVAX test cho C-Chain và P-Chain | Cần tài khoản Builder Hub (cả đội đã có Builder Pass ở M0) |
| `https://faucet.circle.com` | 20 USDC testnet mỗi lần, chọn "Avalanche Fuji" | Một lần mỗi 2 giờ cho mỗi địa chỉ, mỗi mạng (xem 06/11/2026) |
| Telegram `t.me/Team1VNbuilders` | BTC gửi giúp | Khi cả hai faucet AVAX đều lỗi |

AVAX testnet là nút thắt thật của relayer và keeper (mục 9). Xin sớm, cho cả bốn ví.

---

## 2. Phí và độ chốt

| Chỉ số | Giá trị | Nguồn, ngày |
|---|---|---|
| Giá gas C-Chain mainnet | khoảng 2,5 nAVAX | Snowtrace gas tracker, 05/11/2026 |
| Giá AVAX | khoảng 8,73 USD | như trên |
| Một lần chuyển ERC-20 | khoảng 0,001 USD (giả định 45.000 đến 65.000 gas, suy ra) | ghi chú nghiên cứu, 05/11/2026 |
| Độ chốt C-Chain | dưới 1 giây (sơ đồ ghi 0,8 s), không reorg | Avalanche, trang Performance (không ghi ngày, ©2026) |
| Độ chốt của một L1 riêng | dưới 100 ms | như trên |
| Tag `safe`/`finalized` sau Helicon | là block đã "settled", khoảng 5 giây sau khi được chấp nhận | Avalanche, blog Helicon, 08/09/2026 |
| Mục tiêu gas C-Chain | 2,1 triệu gas/giây (tăng từ 1,6 triệu) | Avalanche blog, 21/08/2025 |
| Sức chứa gas tối đa | C = 10·T theo ACP-176, tức khoảng 21 triệu gas (suy ra) | ACP-176 |

Hệ quả cho HụiSafe:

1. Phí mỗi thành viên mỗi kỳ ở mức phần nghìn USD, không đáng kể so với mức góp 100 USDC (mục 9).
2. Giao diện coi giao dịch xong khi có receipt đã thực thi. Chỉ chờ `finalized` khi thật sự cần (ví dụ trước khi xuất PDF sổ họ).
3. Không hard-code giá gas. Đọc `eth_gasPrice` hoặc `eth_feeHistory`, vì ACP-283 cho sàn giá gas thay đổi theo bỏ phiếu của validator.
4. Helicon gỡ các namespace RPC `admin`, `personal`, `warp` và các hàm `eth_accounts`, `eth_coinbase`. Script, keeper và relayer không được dùng chúng.
5. Số trên là của mainnet. Trên Fuji, gas trả bằng AVAX testnet không có giá trị. Ước tính phí trên Fuji bằng `eth_gasPrice` của chính Fuji.

---

## 3. Các bản nâng cấp và ảnh hưởng

| Bản | Kích hoạt | Nội dung chính | Ảnh hưởng tới HụiSafe |
|---|---|---|---|
| Etna | Mainnet 16/12/2024 | ACP-77: L1 độc lập, phí validator khoảng 1,33 AVAX/tháng thay cho stake 2.000 AVAX. ACP-125: phí cơ sở tối thiểu của C-Chain từ 25 xuống 1 nAVAX. ACP-131: các EIP Cancun lên C-Chain | Phí rẻ. L1 bonus khả thi. `evm_version = "cancun"` (ADR-17) |
| Octane | ACP-176 lên mainnet 08/04/2025 (bản Fortuna) | Gas limit động, khám phá giá | Một giao dịch chi kỳ vài triệu gas vẫn vừa khối |
| Granite | Mainnet 19/11/2025 | ACP-181 epoch cho ICM. ACP-204: precompile P-256 tại `0x0000000000000000000000000000000000000100`, 6.900 gas. ACP-226: thời gian khối động | Passkey P-256 là bonus và roadmap (ADR-03) |
| Helicon | Fuji 28/07/2026, mainnet 22/09/2026 | ACP-194 thực thi liên tục; ACP-283 sàn giá gas động; gỡ một số RPC | Receipt có ngay; `finalized` sau khoảng 5 giây; không dùng RPC đã gỡ |

**EIP-7702 không có trên C-Chain.** ACP-209 ("EIP-7702-style Account Abstraction") vẫn ở trạng thái "Proposed", chưa có bản triển khai tham chiếu. Avalanche Academy ghi: "The C-Chain does not accept EIP-7702 transactions". BTC dặn không tự build ERC-4337. Vì vậy HụiSafe chọn ERC-2771 (ADR-04):

- Forwarder của OpenZeppelin đã được audit, người dùng chỉ ký EIP-712, relayer trả gas, contract đọc `_msgSender()`.
- Không cần bundler, paymaster hay smart account.
- Đổi lại, relayer là điểm tập trung có thể từ chối phục vụ. Vì vậy mọi hàm vẫn gọi trực tiếp được và keeper chạy độc lập (04, mục 8).

---

## 4. Chuẩn dùng trong HụiSafe

| Chuẩn | Dùng ở đâu | Cách dùng và lưu ý |
|---|---|---|
| EIP-712 | `MemberAttestation`, `ForwardRequest`, permit USDC | Domain của dây: `name = "HuiSafe"`, `version = "1"`, `chainId = 43113`, `verifyingContract` = địa chỉ clone. Forwarder: tên `"HuiSafeForwarder"`, version "1" (constructor của OpenZeppelin 5.x cố định "1"). USDC: domain đọc từ chính contract |
| EIP-2612 | `join`, `depositBond` | Permit có giới hạn: spender là clone của dây, value đúng `requiredAllowance` = (N − 1)·(C + revealBond), không vô hạn. Contract gọi permit trong `try`, rồi kiểm allowance, đúng khuyến nghị chống front-run trong `IERC20Permit` của OpenZeppelin |
| EIP-3009 | Có sẵn trên USDC và `MockUSDC` | Bonus: trả trễ hoặc trả nợ bằng `receiveWithAuthorization` (người nhận phải là người gọi, nên không bị gửi trước) khi allowance còn lại không đủ |
| ERC-2771 | `HuiFactory`, `HuiCircle` | `ERC2771Context(forwarder)`. Mọi hàm người dùng dùng `_msgSender()`. Không `Multicall` trong contract nào (ADR-06) |
| EIP-1167 | Mỗi dây một clone | `Clones` của OpenZeppelin. Implementation gọi `_disableInitializers()`. Immutable (forwarder, tên EIP-712) nằm trong code implementation nên mọi clone dùng chung. `EIP712` của OpenZeppelin tự dựng lại domain khi `address(this)` khác địa chỉ lúc deploy |
| ERC-4626 | `MockYieldVault` (bonus) | Đi qua `IYieldAdapter`; MVP dùng `NoYield`; lãi giả lập phải khai báo |
| ERC-5192 | Huy hiệu không chuyển nhượng (bonus) | Phát khi `completed` tăng trong ReputationRegistry (05, mục 3.3) |

---

## 5. Vì sao Avalanche: đối chiếu thang 25 điểm

Thang Tích hợp Avalanche của BTC gồm 5 phần, mỗi phần 5 điểm (theo `topics.json` của BTC).

| Tiêu chí | Bằng chứng của HụiSafe | Cách cho giám khảo thấy |
|---|---|---|
| 1. Dùng Avalanche có ý nghĩa | Mỗi kỳ là một giao dịch kéo tiền từ tối đa 29 ví rồi chi ngay cho người hốt. Phí cao thì chi phí kéo-chi ăn vào mức góp. Chốt chậm thì không chi được "ngay trong buổi họp hụi". USDC native của Circle có permit nên không cần quỹ gom chung | Video: bấm chi kỳ, tiền tới ví người hốt trong vài giây; bảng phí ở mục 9 |
| 2. Smart contract thật | `HuiFactory`, `HuiCircle` (clone cho mỗi dây), `ReputationRegistry`, `ERC2771Forwarder` trên Fuji, đã verify. Mọi luồng tiền on-chain; sổ họ dựng từ event | Link Snowtrace trong form nộp; `contracts/deployments/fuji.json` |
| 3. Hạ tầng phù hợp | Fuji C-Chain, USDC của Circle, faucet BTC và Builder Console; ERC-2771 vì C-Chain chưa nhận EIP-7702; Privy nằm trong danh sách tích hợp của Avalanche; bonus L1 với tx allowlist và FeeManager | Slide kiến trúc; slide "vì sao không dùng 7702" |
| 4. Chất lượng tích hợp | Unit, fuzz, invariant cho mọi luồng tiền; gas snapshot ở N = 30; Slither; verify trên Snowtrace; xử lý receipt đúng sau Helicon; RPC dự phòng | README ghi số test, coverage, gas; CI xanh |
| 5. Giá trị khi xây trên Avalanche | Chi một kỳ N = 30 tốn tối đa khoảng 3 triệu gas, tức khoảng 0,065 USD ở giá 05/11/2026, khoảng 0,002 USD cho mỗi thành viên mỗi kỳ. Lộ trình L1 cho từng hội: chỉ thành viên đã xác thực được giao dịch, phí gần 0, quản trị bằng Safe | Slide số liệu; 30 giây demo L1 nếu "go" (mục 7) |

Câu chốt cho pitch: "Mỗi kỳ hụi là một giao dịch kéo tiền của cả dây và chi ngay. Trên Avalanche việc đó tốn chưa tới một xu Mỹ cho mỗi người và chốt trong khoảng một giây." Kèm ngày của số liệu khi nói.

---

## 6. Deploy và xác minh trên Fuji

### 6.1. Cấu hình

```toml
# contracts/foundry.toml (phần liên quan tới mạng; phần test ở 09, mục 4.5)
[profile.default]
solc_version = "0.8.28"
evm_version = "cancun"     # ADR-17
fs_permissions = [
  { access = "read", path = "./test/vectors" },
  { access = "read-write", path = "./deployments" },
]

[rpc_endpoints]
fuji = "${FUJI_RPC_URL}"

[etherscan]
fuji = { key = "${SNOWTRACE_API_KEY}", chain = 43113, url = "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" }
```

Vì sao xác minh qua Routescan:

- Etherscan báo: "Effective November 15, 2026, API support will be deprecated for Avalanche Fuji Testnet (chainid: 43113)". Mốc này rơi giữa M2 và ngày nộp, nên không dựa vào Etherscan API V2 cho Fuji (ADR-16).
- Hướng dẫn Foundry của Routescan dùng `--verifier-url 'https://api.routescan.io/v2/network/testnet/evm/<chainId>/etherscan'` và `--etherscan-api-key "verifyContract"` (chuỗi giữ chỗ). Ngày 06/11/2026, gọi `getsourcecode` qua endpoint 43113 cho địa chỉ USDC Fuji trả về `FiatTokenProxy`, tức endpoint đang phục vụ Fuji.
- Skill `foundry-fuji` ghi rằng Forge 1.7.1 mặc định verifier Sourcify. Vì vậy luôn ghi rõ `--verifier etherscan`.

### 6.2. Các bước

1. Tạo bốn ví testnet tách vai: deployer (kiêm admin trên testnet), relayer, attester, keeper (ADR-21). Nạp AVAX: deployer khoảng 0,03 AVAX, relayer ít nhất 1 AVAX (ngưỡng cảnh báo ở 05, mục 8.2), keeper khoảng 0,1 AVAX (đề xuất). Attester không cần AVAX vì chỉ ký ngoài chuỗi.
2. Người tự export biến môi trường trước khi mở Claude Code. Claude không đọc `.env*`.
3. Kiểm trước:

```bash
cd contracts
cast chain-id --rpc-url fuji                 # phải in 43113
forge build --sizes                          # không contract nào vượt 24.576 byte (EIP-170)
forge test -vvv
forge test --match-path "test/invariant/*"
slither . --filter-paths "lib/|test/|script/"
```

4. Chạy thử, không broadcast: `forge script script/Deploy.s.sol --rpc-url fuji`. Script dừng nếu `block.chainid` không phải 43113 (hoặc 31337 khi chạy local).
5. Deploy và verify. Chạy qua lệnh `/deploy-fuji`, người duyệt bước broadcast:

```bash
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify \
  --verifier etherscan \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}"
```

Thứ tự trong script: `ERC2771Forwarder("HuiSafeForwarder")`, `ReputationRegistry`, implementation `HuiCircle(forwarder)`, `HuiFactory`, rồi nối cấu hình. Script ghi `deployments/fuji.json` đúng mẫu 05, mục 6.2.

6. Contract nào verify lỗi thì verify lại riêng:

```bash
forge verify-contract <ĐỊA_CHỈ> src/HuiFactory.sol:HuiFactory \
  --chain 43113 --watch --verifier etherscan \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key "${SNOWTRACE_API_KEY:-verifyContract}" \
  --guess-constructor-args
```

7. Kiểm sau deploy:

```bash
cast call $FACTORY "implementation()(address)" --rpc-url fuji
cast call $FACTORY "admin()(address)" --rpc-url fuji
cast call $CIRCLE_IMPL "isTrustedForwarder(address)(bool)" $FORWARDER --rpc-url fuji   # true
cast call 0x5425890298aed601595a70AB815c96711a31Bc65 "version()(string)" --rpc-url fuji
```

8. `/sync-abi`, rồi `forge script script/CreateDemoCircle.s.sol --rpc-url fuji --broadcast`. Mở trang của dây demo trên Snowtrace. Clone EIP-1167 thường được explorer nhận là minimal proxy; cần kiểm tra trên trang contract của một dây.
9. Commit `fuji.json`, ghi địa chỉ và tx hash vào README.

### 6.3. Checklist triển khai

- [ ] `cast chain-id` in 43113. Không lệnh nào trỏ tới `api.avax.network` (hook `guard-bash.sh` chặn mainnet).
- [ ] Địa chỉ USDC khớp developers.circle.com ngày deploy.
- [ ] `forge build --sizes`: không contract nào vượt 24.576 byte.
- [ ] Test, invariant xanh; Slither không còn High; checklist bảo mật ở 09, mục 10 đã tick.
- [ ] Gọi `initialize` trên implementation phải revert (đã `_disableInitializers()`).
- [ ] `isTrustedForwarder(forwarder)` trả `true`; `FactoryConfig.forwarder` đúng địa chỉ đó.
- [ ] `admin()` là ví deployer; `attester` đúng địa chỉ của `ATTESTER_PRIVATE_KEY`.
- [ ] `FactoryConfig`: `maxCapBps` 2000, `lateRateBps` 1000, `minCoverageBps` 5000, `maxFeeBps` 300, `maxReserveBps` 300, `minMembers` 3, `maxMembers` 30, `maxContribution` 10.000 USDC.
- [ ] Mọi contract hiện "verified" trên testnet.snowtrace.io.
- [ ] `fuji.json` có `deployedAt`, `gitCommit`; đã sinh lại ABI; web đã build lại.
- [ ] Relayer ≥ 1 AVAX, keeper ≥ 0,1 AVAX; keeper đã chạy.
- [ ] Dây demo chạy hết một kỳ trên Fuji; có link Snowtrace trong README.

---

## 7. L1 riêng qua Builder Console (bonus)

Mục tiêu: điểm 3 và 5 của thang Avalanche. Một hội hụi có chuỗi riêng: chỉ thành viên đã xác thực được giao dịch, người dùng không phải mua gas.

| Thành phần | Cấu hình | Ghi chú |
|---|---|---|
| Tạo L1 | Builder Console, Create L1 trên Fuji, dùng node testnet được host miễn phí | Không dùng Avalanche-CLI: dự án ở maintenance mode từ 12/2025, chỉ còn vá bảo mật |
| Tx allowlist | Precompile `0x0200000000000000000000000000000000000002`, khóa genesis `txAllowListConfig`. Vai: Admin, Manager, Enabled. Hàm `setEnabled(addr)`, `setNone(addr)`, `readAllowList(addr)` | Admin là ví deployer (về sau là Safe). Thêm thành viên sau khi attest: làm tay cho demo; tự động thì cần một khóa Manager trên server, là thêm một khóa nóng có quyền trên chuỗi |
| Phí | FeeManager `0x0200000000000000000000000000000000000003`, khóa `feeManagerConfig` | Tài liệu FeeManager khuyến nghị `minBaseFee` 25 đến 500 gwei; mức 0 tuyệt đối cần kiểm tra. "Không tốn gas" thực chất là: gas token của L1 do mình phát, relayer trả, người dùng không cần mua |
| Native minter | Precompile `0x0200000000000000000000000000000000000001` | Cấp gas token cho relayer và keeper |
| USDC làm gas (tùy chọn) | ICTT ERC-20 sang native theo khóa Academy 7 bước | Rủi ro cao: cần relayer ICM, thế chấp `initialReserveImbalance`, quy đổi 6 sang 18 chữ số |
| Token góp | L1 không có USDC của Circle | (a) `MockUSDC` trên L1, là dev toggle phải khai báo; (b) USDC Fuji bắc cầu bằng ICTT ERC-20 sang ERC-20, cần kiểm tra token remote có EIP-2612 không |

Rủi ro chính:

- Relayer ICM được host trên Console "automatically shut down after 3 days". Nếu dùng ICTT thì tạo lại relayer ngay trước ngày chấm hoặc tự host.
- Node testnet được host là "not suitable for production use"; vòng đời node cần kiểm tra.
- Đổi precompile sau genesis cần cấu hình nâng cấp trên mọi node. Chốt vai admin từ đầu.
- Tốn thời gian của P1 và P2 đúng tuần quan trọng nhất.

**Quy tắc go/no-go:**

1. Chỉ bắt đầu khi M3 (14/11) đạt: dây chạy trọn trên Fuji qua web, invariant xanh.
2. Hộp thời gian: sáng 15/11 đến 12:00 ngày 16/11, tối đa một người.
3. **Go** khi đến 12:00 ngày 16/11 có đủ: L1 chạy; contract đã deploy trên L1; một dây 3 người chạy hết vòng; giao dịch từ ví ngoài allowlist bị chặn (quay video làm bằng chứng).
4. Thiếu một điều kiện là **no-go**: dừng ngay, L1 chỉ còn là một slide roadmap.
5. Demo chính luôn ở Fuji C-Chain. L1 nếu "go" chỉ chiếm 30 giây. Đóng băng tính năng ngày 17/11 (M5) áp dụng cả cho L1.

---

## 8. Roadmap mainnet (tương lai, không có trong MVP)

Các mục dưới đây là kế hoạch sau cuộc thi. Bản nộp không có chúng.

1. Admin là Safe multisig. Safe có trong danh sách tích hợp của Avalanche; Builder Console hỗ trợ Safe cho L1 (blog 01/10/2025).
2. Adapter lãi Aave v3 qua `IYieldAdapter` cho ký quỹ, holdback và quỹ dự phòng. Aave v3 không có trên Fuji (testnet duy nhất là Sepolia), nên test bằng fork mainnet. Lãi thật đến từ lãi cho vay trên Aave; phải nói rõ rủi ro giao thức.
3. Audit độc lập và bug bounty trước khi có tiền thật.
4. Ý kiến luật sư về diễn giải trần lãi NĐ 19 Điều 21, sổ họ điện tử, và luật tài sản mã hóa ([10](10-phap-ly-va-tuan-thu.md)).
5. Passkey P-256 (ACP-204); L1 cho từng hội; chế độ hiển thị VND.
6. Nguồn tài trợ sau cuộc thi: Team1 Builder Grants (mini đến 10.000 USD, accelerator đến 30.000 USD, mở từ 01/07/2026) và Retro9000.

---

## 9. Chi phí

Giá tham chiếu mainnet ngày 05/11/2026: gas 2,5 nAVAX, AVAX 8,73 USD. Cột gas là ước tính trước khi đo; thay bằng số trong `.gas-snapshot` sau M2.

| Hạng mục | Gas ước tính | AVAX ở 2,5 nAVAX | USD trên mainnet | Trên Fuji |
|---|---|---|---|---|
| Deploy trọn bộ (forwarder, registry, implementation, factory) | 8 đến 10 triệu | 0,02 đến 0,025 | 0,17 đến 0,22 | AVAX testnet của deployer |
| `createCircle` | ≤ 500.000 | ≤ 0,00125 | ≤ 0,011 | relayer trả |
| `join` | ≤ 250.000 | ≤ 0,000625 | ≤ 0,0055 | relayer trả |
| `settleRound`, N = 5 | ≤ 600.000 | ≤ 0,0015 | ≤ 0,013 | keeper trả |
| `settleRound`, N = 30 | ≤ 3.000.000 | ≤ 0,0075 | ≤ 0,065 | keeper trả |
| Trọn một dây demo N = 5 | khoảng 5 đến 6 triệu | khoảng 0,014 | khoảng 0,12 | relayer và keeper |
| Validator của L1 (mainnet) | | khoảng 1,33 AVAX/tháng mỗi validator | khoảng 11,6 USD/tháng | AVAX testnet |
| Privy, nền tảng chạy web, Claude API | | | gói miễn phí hoặc credit; hạn mức cần kiểm tra | |
| Audit (chỉ mainnet) | | | cần báo giá | không áp dụng |

Faucet BTC cấp 0,05 AVAX mỗi ví mỗi ngày, đủ cho khoảng 3 dây demo N = 5 nếu một ví trả hết gas (suy ra). Vì vậy: tách vai, xin từ nhiều faucet, xin sớm.

USDC testnet mới là nút thắt lớn hơn: một dây demo N = 5, C = 100 cần tới 5 × 404 + 480 = 2.500 USDC (cận trên: allowance của 5 thành viên cộng ký quỹ), trong khi faucet Circle cấp 20 USDC mỗi 2 giờ cho mỗi ví. Cách xử lý (gom từ M0, dây thử với C = 5 USDC) ở [11](11-ke-hoach-trien-khai.md), rủi ro R5.

---

## Nguồn

Ngày trong ngoặc là ngày xem hoặc ngày công bố.

- Avalanche Academy, x402 on Avalanche, Network setup (06/11/2026): <https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/02-network-setup>
- Avalanche Academy, Facilitators, câu về EIP-7702 (05/11/2026): <https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/03-facilitators>
- Circle, USDC contract addresses (06/11/2026): <https://developers.circle.com/stablecoins/usdc-contract-addresses>
- Avalanche docs, Snowtrace (06/11/2026): <https://docs.avax.network/integrations/snowtrace>
- Routescan, Deploying and verifying contracts: Foundry (06/11/2026): <https://info.routescan.io/en/articles/11992459-deploying-and-verifying-contracts-foundry>
- Etherscan, Supported Chains, thông báo ngừng hỗ trợ Fuji từ 15/11/2026 (06/11/2026): <https://docs.etherscan.io/supported-chains>
- Snowtrace gas tracker (05/11/2026): <https://snowtrace.io/gastracker>
- Avalanche, Performance: <https://docs.avax.network/solutions/performance>
- Avalanche blog, Helicon (08/09/2026): <https://docs.avax.network/blog/helicon-upgrade>; Helicon upgrade docs: <https://docs.avax.network/docs/primary-network/helicon-upgrade>
- Etna (02/12/2024): <https://docs.avax.network/blog/etna-enhancing-sovereignty-avalanche-l1s>; Granite (05/11/2025): <https://build.avax.network/blog/granite-upgrade>; Fortuna: <https://support.avax.network/en/articles/12595491-avalanchego-fortuna>
- ACP-176: <https://docs.avax.network/docs/acps/176-dynamic-evm-gas-limit-and-price-discovery-updates>; ACP-204: <https://build.avax.network/docs/acps/204-precompile-secp256r1>; ACP-209: <https://build.avax.network/docs/acps/209-eip7702-style-account-abstraction>
- Avalanche blog, gas target 2,1 triệu gas/giây (21/08/2025): <https://docs.avax.network/blog/gas-target-increase>
- Transaction AllowList precompile: <https://docs.avax.network/docs/avalanche-l1s/precompiles/transaction-allowlist>; FeeManager: <https://build.avax.network/docs/virtual-machines/default-precompiles/feemanager>; EVM L1 customization: <https://build.avax.network/docs/virtual-machines/evm-l1-customization>
- Academy, ICM & Relayer Setup (relayer host tự tắt sau 3 ngày, 06/11/2026): <https://docs.avax.network/academy/avalanche-l1/native-token-bridge/01-erc20-to-native/03-relayer-setup>
- ava-labs/avalanche-cli README, maintenance mode từ 12/2025 (06/11/2026): <https://github.com/ava-labs/avalanche-cli>
- OpenZeppelin `IERC20Permit`, Security Considerations (06/11/2026): <https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/IERC20Permit.sol>; `ERC2771Forwarder` v5.0.1: <https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.1/contracts/metatx/ERC2771Forwarder.sol>
- Aave v3, testing and debugging (testnet chỉ Sepolia): <https://aave.com/docs/aave-v3/smart-contracts/testing-and-debugging.md>
- Team1 Builder Grants (KuCoin News, 05/07/2026): <https://www.kucoin.com/news/flash/avalanche-s-team1-launches-builder-grants-program-with-up-to-30-000-per-project>
- Bản tóm tắt cho trưởng nhóm (06/11/2026): faucet BTC, coupon Core, thang chấm Avalanche 5 × 5.
