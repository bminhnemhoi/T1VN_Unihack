# 05. Cấu trúc dữ liệu, interface và API

**Mục đích và đọc khi nào.** File này định nghĩa mọi kiểu dữ liệu, interface Solidity, event, lỗi, typed data EIP-712, API backend, định dạng file triển khai, sổ họ và schema của phòng mô phỏng. Đọc khi viết contract, SDK, API, keeper hoặc frontend. Luật vận hành nằm ở [03-dac-ta-giao-thuc.md](03-dac-ta-giao-thuc.md); file này chỉ là "hình dạng" của dữ liệu. Tên ở đây là tên chuẩn: không đổi tùy tiện.

---

## 1. Quy ước chung

- Solidity: phiên bản 0.8.x ổn định mới nhất lúc dựng (ghim cố định trong `foundry.toml`). OpenZeppelin Contracts 5.x. Dùng custom error, không dùng chuỗi `require`.
- Mọi số tiền là USDC đơn vị nhỏ nhất (6 chữ số thập phân). Mọi tỷ lệ là basis point (10_000 = 100%). Mọi thời gian là giây Unix (`uint64`).
- Mỗi thay đổi trạng thái phát đúng một event mô tả nó (frontend và sổ họ dựng hoàn toàn từ event).
- Không lưu dữ liệu cá nhân trên chuỗi: chỉ địa chỉ ví, mã băm, số tiền, thời gian.

---

## 2. Kiểu dữ liệu (`contracts/src/libraries/HuiTypes.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum CircleMode { Fixed, Bidding }

enum CircleState { Forming, Active, Paused, Completed, Cancelled, Unwound }

enum RoundPhase { NotStarted, Commit, Reveal, AwaitingSettle, Done }

enum CoverSource { Holdback, Bond, Reserve, Uncovered }

struct CircleParams {
    CircleMode mode;
    uint8   memberCount;      // N, 3..30
    uint96  contribution;     // C, USDC 6 decimals
    uint32  periodSeconds;    // kỳ danh nghĩa P (trần lãi, lãi chậm góp)
    uint32  roundDuration;    // thời gian thật giữa hai kỳ
    uint32  commitWindow;     // Fixed: 0
    uint32  revealWindow;     // Fixed: 0
    uint32  graceSeconds;     // ân hạn
    uint16  alphaBps;         // holdback
    bool    commissionMode;   // họ hưởng hoa hồng (NĐ 19 Điều 4 khoản 8)
    uint16  feeBps;           // tiền công; = 0 nếu !commissionMode; khi φ > 0 là trần mỗi pot
    uint16  reserveBps;       // quỹ dự phòng
    uint16  revealBondBps;    // cọc mở thăm, tính trên C
    uint16  capBps;           // trần lãi năm, ≤ factory.maxCapBps
    uint64  joinDeadline;
    bool    organizerIsMember;
    bytes32 label;            // tên ngắn, không ghi tên người
    // ---- v1.2 (A13): chỉ NỐI THÊM ở cuối struct ----
    uint16  commissionShareBps; // φ, 0..5000; 0 = tiền công cố định feeBps·pot; > 0 = hoa hồng trong trần lãi (03 mục 2.7)
    bytes32 termsHash;        // keccak256 văn bản thỏa thuận dây (ADR-27), khác 0; bất biến, có trong event CircleTermsSet
}

struct MemberInfo {
    bool    joined;
    bool    received;         // đã hốt
    bool    defaulted;        // đã bị markDefault
    uint8   joinIndex;        // 0..N-1
    uint8   receivedRound;    // 0 nếu chưa hốt
    uint16  lateCount;        // số lần trễ trong dây này
    uint128 holdback;         // đang bị giữ lại
    uint128 debt;             // tổng khoản thiếu chưa trả (kể cả phần ảo khi Frozen)
}
// Trạng thái suy ra:
//   Live          = joined && !received && !defaulted
//   Dead          = received && !defaulted
//   Frozen        = !received && defaulted
//   DefaultedDead = received && defaulted

struct Commit {
    bytes32 hash;
    uint32  commitIndex;
    bool    revealed;
    uint128 bid;
    uint128 bondHeld;
}

struct Shortfall {             // bốn trường from*/uncovered là số CÒN PHẢI HOÀN, giảm dần khi trả (03 mục 6.8)
    uint128 amount;           // phần phải góp mà không kéo được (gốc ban đầu, không đổi)
    uint128 fromHoldback;
    uint128 fromBond;
    uint128 fromReserve;
    uint128 uncovered;        // người hốt nhận thiếu đúng phần này
    uint64  since;            // = settledAt của kỳ; mốc tính lãi chậm góp
    bool    resolved;         // true khi cả bốn trường trên về 0
}

struct RoundInfo {
    address winner;
    uint128 winningBid;
    uint128 pot;
    uint128 payout;
    uint128 holdback;
    uint128 fee;
    uint128 premium;
    uint128 uncovered;
    uint64  settledAt;
    uint32  commitCount;
    bool    settled;
    bool    feeForfeited;
}

struct PermitSig {            // EIP-2612 cho USDC
    uint256 value;
    uint256 deadline;
    uint8   v;
    bytes32 r;
    bytes32 s;
}

struct MemberAttestation {    // do attester của HụiSafe ký (EIP-712)
    address member;
    address circle;
    bytes32 attestationId;    // băm không đảo ngược được, không chứa dữ liệu cá nhân
    uint64  expiry;
}

struct FactoryConfig {
    address usdc;
    address forwarder;        // ERC2771Forwarder
    address reputation;
    address attester;
    uint16  maxCapBps;        // 2000
    uint16  lateRateBps;      // 1000
    uint16  minCoverageBps;   // Fuji 10000 (ADR-22); 5000 chỉ anvil và test
    uint16  maxFeeBps;        // 300
    uint16  maxReserveBps;    // 300
    uint8   minMembers;       // 3
    uint8   maxMembers;       // 30
    uint96  maxContribution;  // 10_000 USDC trên testnet
}
```

`FactoryConfig` không đổi ở v1.2: trần φ là hằng số của factory `MAX_COMMISSION_SHARE_BPS = 5000` (như `MIN_CONTRIBUTION`), không phải tham số cấu hình. Trên Fuji `minCoverageBps = 10_000` (ADR-22).

Quy tắc cứng của factory (constructor và `setConfig` đều kiểm, vượt thì `InvalidConfig()`): `MIN_CONTRIBUTION = 1 USDC` (1_000_000, `contribution` nhỏ hơn thì `InvalidParams(2)`; `maxContribution ≥ MIN_CONTRIBUTION`); `maxFeeBps ≤ 300`, `maxReserveBps ≤ 300`, `maxCapBps ≤ 2000`, `lateRateBps ≤ 1000`, mọi giá trị bps ≤ 10_000; `3 ≤ minMembers ≤ maxMembers ≤ 30`; `config.forwarder` phải bằng forwarder của chính factory và bằng `trustedForwarder()` của implementation (forwarder là immutable, `setConfig` không đổi được); `config.usdc`, `reputation`, `attester`, `forwarder` khác địa chỉ 0. `admin` là `immutable` của factory (đổi admin = deploy factory mới).

### 2.1. Bố cục lưu trữ của `HuiCircle`

**Giới hạn kích thước (EIP-170, quyết định A4).** `HuiCircle` + hàm C7 vượt 24.576 byte, nên bố cục lưu trữ nằm ở `HuiCircleBase`, các hàm view của mục 3.2 (trừ `currentRound`, `revealBond`, `requiredAllowance`, `guaranteedCoverageBps` và các getter công khai của biến) nằm ở `HuiCircleViews`, và `HuiCircle` chuyển mọi selector không định nghĩa sang `HuiCircleLens` (immutable `lens`, constructor revert `LensNotDeployed()` nếu địa chỉ không có code) bằng DELEGATECALL trong `fallback()`. ABI nhìn từ ngoài không đổi; lens chỉ có hàm `view`, dùng chung bố cục lưu trữ qua `HuiCircleBase` nên không ghi được và không chuyển được tiền. Dựng bằng `via_ir = true`. Không chèn hay đổi thứ tự biến lưu trữ nếu chưa chạy test song song lens (`HuiCircleLens.t.sol`).

```solidity
IHuiFactory  public factory;
address      public organizer;
IERC20       public usdc;
IReputationRegistry public reputation;
address      public attester;
uint16       public lateRateBps;          // chép từ factory lúc initialize
uint16       public minCoverageBps;

CircleParams internal _params;
CircleState  public state;
uint64       public startTime;
uint64       public pausedAt;                // thời điểm bắt đầu lần dừng hiện tại (0 khi không dừng)
uint64       public pausedTotal;
uint32       public settledRounds;        // số kỳ đã chi

address[]                                  internal _members;      // theo joinIndex
mapping(address => MemberInfo)             internal _info;
mapping(uint32 => RoundInfo)               internal _rounds;
mapping(uint32 => mapping(address => Commit))    internal _commits;
mapping(uint32 => mapping(address => Shortfall)) internal _shortfalls;
mapping(uint32 => address)                 internal _leader;       // thăm dẫn đầu tạm thời
mapping(uint32 => RoundBids)               internal _bids;         // RoundBids { uint32 count; uint8 payers }: số commit của kỳ k và L_k chốt ở commit đầu tiên (0 = chưa chốt, 03 mục 6.3), cùng một slot
mapping(uint32 => uint64)                  internal _pausedAtSettle; // pausedTotal tại lúc chi kỳ k (03 mục 3.2, 6.8)
mapping(bytes32 => bool)                   public usedAttestation;
mapping(address => bool)                   public hasLeft;         // đã rời lúc Forming, không vào lại được (03 mục 5.1)
uint32                                     public liveCount;       // số thành viên sống (joined, chưa hốt, chưa vỡ nợ), giữ bằng bộ đếm (gas)

uint256 public bondDeposited;
uint256 public bondRemaining;
uint256 public reserve;
mapping(uint32 => uint256) public feeEscrow;
uint256 public revealBondsHeld;
uint256 public totalHoldback;
mapping(address => uint256) public claimable;
uint256 public totalClaimable;
```

Gói A13 (v1.2): `CircleParams` thêm `commissionShareBps` và `termsHash` ở CUỐI struct nên `_params` dài thêm hai slot và mọi biến lưu trữ khai báo sau `_params` dịch xuống tương ứng (chấp nhận được vì chưa có deployment nào; vẫn chạy `HuiCircleLens.t.sol` để chứng minh lens và dây dùng chung bố cục). Không thêm biến lưu trữ mới ngoài hai trường đó: `feeEscrow` chỉ còn giữ tiền công của kỳ có khoản thiếu.

Lưu ý SDK/UI (chủ hụi kiêm thành viên): `depositBond` và `join` cùng ghi đè allowance của ví chủ hụi, nên permit của chủ hụi phải ký tổng `requiredAllowance + bond`. `organizerIsMember` hiện chỉ lưu trong `params`, contract chưa ép buộc.

Bất biến sổ cái (03, mục 7.1): `usdc.balanceOf(this) == bondRemaining + reserve + totalHoldback + Σ feeEscrow + revealBondsHeld + totalClaimable`. Nên giữ thêm biến `totalFeeEscrow` để kiểm bất biến rẻ.

---

## 3. Interface

### 3.1. `IHuiFactory`

```solidity
interface IHuiFactory {
    event CircleCreated(
        address indexed circle, address indexed organizer,
        CircleMode mode, uint8 memberCount, uint96 contribution, bytes32 label
    );
    event ConfigUpdated(FactoryConfig config);
    event CirclePausedByAdmin(address indexed circle);
    event CircleUnpausedByAdmin(address indexed circle);

    function createCircle(CircleParams calldata p) external returns (address circle);

    function implementation() external view returns (address);
    function admin() external view returns (address);              // Safe multisig (testnet: deployer)
    function config() external view returns (FactoryConfig memory);
    function setConfig(FactoryConfig calldata c) external;          // chỉ admin; chỉ áp dụng cho dây tạo SAU đó

    function allCircles() external view returns (address[] memory);
    function circlesOf(address organizer) external view returns (address[] memory);
    function activeCirclesOf(address organizer) external view returns (uint256);
    function isCircle(address a) external view returns (bool);

    function onActivated(address organizer) external;               // chỉ circle hợp lệ gọi
    function onFinished(address organizer) external;                // chỉ circle hợp lệ gọi

    function pauseCircle(address circle) external;                  // chỉ admin
    function unpauseCircle(address circle) external;                // chỉ admin
    function unwindCircle(address circle) external;                 // chỉ admin; circle phải Paused liên tục ≥ 48 giờ
}
```

### 3.2. `IHuiCircle`

```solidity
interface IHuiCircle {
    // ---- Forming ----
    function initialize(address organizer, CircleParams calldata p, FactoryConfig calldata cfg) external; // chỉ factory, một lần
    function depositBond(uint256 amount, PermitSig calldata permit) external;     // chỉ organizer, Forming
    function withdrawBond() external;                                              // chỉ organizer, Cancelled
    function join(MemberAttestation calldata att, bytes calldata attSig, PermitSig calldata permit) external;
    function leave() external;                                                     // Forming
    function activate() external;                                                  // chỉ organizer
    function cancel() external;                                                    // ai cũng gọi, sau joinDeadline

    // ---- Active ----
    function commitBid(bytes32 commitHash) external;
    function revealBid(uint256 bid, bytes32 salt) external;
    function settleRound() external;                                               // ai cũng gọi
    function payLate(uint32 round) external;
    function markDefault(address member) external;                                 // ai cũng gọi
    function repayDebt(uint256 amount) external;
    function finalize() external;                                                  // ai cũng gọi
    function claim() external;

    // ---- Khẩn cấp: chỉ factory gọi (admin dùng factory.pauseCircle / unpauseCircle / unwindCircle) ----
    function pause() external;
    function unpause() external;
    function emergencyUnwind() external;                                           // revert UnwindTooEarly nếu Paused < 48 giờ

    // ---- Views ----
    function params() external view returns (CircleParams memory);
    function members() external view returns (address[] memory);
    function memberInfo(address m) external view returns (MemberInfo memory);
    function currentRound() external view returns (uint32);                       // settledRounds + 1, tối đa N
    function phase() external view returns (RoundPhase);
    function roundStart(uint32 k) external view returns (uint64);                 // max(startTime + (k−1)·D_r, settledAt(k−1) − pausedAtSettle(k−1)) + pausedTotal, k ≥ 2 (03 mục 3.2)
    function deadline(uint32 k) external view returns (uint64);                   // roundStart(k) + roundDuration
    function roundInfo(uint32 k) external view returns (RoundInfo memory);
    function commitOf(uint32 k, address m) external view returns (Commit memory);
    function shortfallOf(uint32 k, address m) external view returns (Shortfall memory);
    function maxBid(uint32 k) external view returns (uint256);                    // trần thăm THỰC THI: φ = 0 thì bằng trần luật; φ > 0 thì ⌊trần luật·(10000−φ)/10000⌋ (03 mục 2.7)
    function statutoryMaxBid(uint32 k) external view returns (uint256);           // trần theo luật (HuiMath.maxBid), chưa trừ phần hoa hồng
    function commissionRoom(uint32 k) external view returns (uint256);            // room_k = statutoryMaxBid(k)·L_k (xem được cả khi φ = 0; chỉ φ > 0 mới dùng để tính tiền công); các view `maxBid`, `statutoryMaxBid`, `commissionRoom` chỉ có nghĩa với kỳ chưa chi: kỳ chưa có commit nào thì L_k theo số hụi sống hiện tại (03 mục 6.3), nên với kỳ đã chi hãy dựng lại từ event, không từ view (audit L-01)
    function onTimeWeight(address m) external view returns (uint16);              // max(0, (N−1) − lateCount); 0 nếu vỡ nợ (ADR-24)
    function exposure(uint32 k) external view returns (uint256);
    function maxExposure() external view returns (uint256);
    function coverageIndexBps() external view returns (uint256);                  // dùng reserve hiện tại
    function guaranteedCoverageBps() external view returns (uint256);             // reserve = 0
    function requiredAllowance() external view returns (uint256);                 // (N-1)·(C + revealBond)
    function revealBond() external view returns (uint256);
    function dueOf(address m, uint32 k, uint256 bid) external view returns (uint256);
    function lateFeeOf(address m, uint32 k) external view returns (uint256);
}
```

### 3.3. `IReputationRegistry`

```solidity
struct Reputation {
    uint32 completed;    // số dây hoàn thành không vỡ nợ
    uint32 onTime;       // số lần đóng đúng hạn
    uint32 late;         // số lần trễ (kể cả không mở thăm)
    uint32 defaults;     // số lần vỡ nợ
    uint32 repaid;       // số lần trả nợ sau vỡ nợ
}

interface IReputationRegistry {
    event ReputationUpdated(address indexed member, address indexed circle, bytes32 kind);
    event FactorySet(address factory);
    function admin() external view returns (address);
    function factory() external view returns (address);
    function setFactory(address f) external;       // chỉ admin, gọi đúng một lần ngay sau khi deploy HuiFactory
    function reputationOf(address m) external view returns (Reputation memory);
    function recordOnTime(address m) external;     // chỉ circle có factory.isCircle(msg.sender) == true
    function recordLate(address m) external;
    function recordDefault(address m) external;
    function recordRepaid(address m) external;
    function recordCompleted(address m) external;
}
```

Bonus: phát huy hiệu không chuyển nhượng được (ERC-5192) khi `completed` tăng.

Thứ tự deploy (đã chốt):
1. `ERC2771Forwarder("HuiSafeForwarder")`.
2. `ReputationRegistry(deployer)` (v1.2: admin của registry luôn là ví deployer; quyền duy nhất là `setFactory` một lần, gọi ngay trong script, nên deploy không cần chữ ký Safe).
3. `HuiCircleLens()` (chỉ view, mục 2.1).
4. Implementation `HuiCircle(forwarder, lens)`; constructor gọi `_disableInitializers()`, revert `LensNotDeployed()` nếu `lens` không có code.
5. `HuiFactory(admin, implementation, config)`, trong đó `config.reputation` = registry.
6. `registry.setFactory(factory)` do deployer gọi trong script; gọi lần hai thì revert. Admin của factory là Safe 2/3 (ADR-26, `script/CreateSafe.s.sol`).

Từ đó registry chỉ nhận lệnh từ địa chỉ có `factory.isCircle(msg.sender) == true`. Registry không dùng ERC-2771, vì chỉ contract gọi nó.

### 3.4. `IUSDCPermit` và `IYieldAdapter`

```solidity
interface IUSDCPermit is IERC20 {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint256);
    function name() external view returns (string memory);
    function version() external view returns (string memory);   // USDC của Circle: "2"
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    // EIP-3009 (bonus, đã có sẵn trên USDC):
    function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external;
}

interface IYieldAdapter {                         // MVP: NoYield; bonus: MockYieldVault (ERC-4626)
    function deposit(uint256 assets) external returns (uint256 shares);
    function withdraw(uint256 assets, address to) external returns (uint256 shares);
    function totalAssetsOf(address owner) external view returns (uint256);
}
```

### 3.5. `HuiMath` (thư viện thuần, có bản TS và Python khớp từng đơn vị)

```solidity
library HuiMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;

    function exposure(uint256 n, uint256 k, uint256 c) internal pure returns (uint256);          // k·(n−k)·c
    function maxExposure(uint256 n, uint256 c) internal pure returns (uint256);                  // (n/2)·(n − n/2)·c
    function holdbackFor(uint256 alphaBps, uint256 n, uint256 k, uint256 c) internal pure returns (uint256);
    function releasePerRound(uint256 alphaBps, uint256 c) internal pure returns (uint256);
    function coverageIndexBps(uint256 alphaBps, uint256 bond, uint256 reserve_, uint256 n, uint256 c)
        internal pure returns (uint256);                                                         // min(10000, ...)
    function maxBid(uint256 capBps, uint256 n, uint256 k, uint256 c, uint256 periodSec, uint256 payers)
        internal pure returns (uint256);                                                         // min(..., c − 1)
    function lateFee(uint256 amount, uint256 lateRateBps, uint256 elapsedSec, uint256 periodSec, uint256 roundDuration)
        internal pure returns (uint256);
    function bpsOf(uint256 amount, uint256 bps) internal pure returns (uint256);                 // amount·bps/10000

    // ---- v1.2 (A13); hàm cũ giữ nguyên tên và thứ tự tham số ----
    function bidCapAfterShare(uint256 statutoryMaxBid, uint256 shareBps) internal pure returns (uint256);
                                                                                                 // ⌊statutoryMaxBid·(10000−φ)/10000⌋
    function commissionRoom(uint256 statutoryMaxBid, uint256 payers) internal pure returns (uint256);
                                                                                                 // room_k = statutoryMaxBid·payers
    function commission(uint256 pot, uint256 feeBps, uint256 shareBps, uint256 room) internal pure returns (uint256);
                                                                                                 // φ = 0: ⌊pot·feeBps/10000⌋; φ > 0: min(⌊room·φ/10000⌋, ⌊pot·feeBps/10000⌋)
    function reserveShare(uint256 total, uint256 weight, uint256 weightSum) internal pure returns (uint256);
                                                                                                 // ⌊total·weight/weightSum⌋ (weightSum > 0); dư lẻ xử lý ở HuiCircle
    function onTimeWeight(uint256 n, uint256 lateCount, bool defaulted) internal pure returns (uint256);
                                                                                                 // defaulted ? 0 : max(0, (n−1) − lateCount)
}
```

Bản `packages/sdk/src/huiMath.ts` (dùng `bigint`) và `sim/huisim/math.py` (dùng `int`) phải cho kết quả giống hệt, kể cả năm hàm v1.2 ở trên (vector V1, V7 trong `contracts/test/vectors/huimath.json`). Test differential đối chiếu cả ba (xem 09).

---

## 4. Event và lỗi của `HuiCircle`

### 4.1. Event

```solidity
event BondDeposited(address indexed organizer, uint256 amount, uint256 bondTotal);
event BondWithdrawn(address indexed organizer, uint256 amount);
event MemberJoined(address indexed member, uint8 joinIndex, bytes32 attestationId);
event MemberLeft(address indexed member);
event CircleActivated(uint64 startTime, uint256 guaranteedCoverageBps);
event CircleCancelled();

event BidCommitted(uint32 indexed round, address indexed member, bytes32 commitHash, uint32 commitIndex);
event BidRevealed(uint32 indexed round, address indexed member, uint256 bid);
event RevealBondForfeited(uint32 indexed round, address indexed member, uint256 amount);

event CircleTermsSet(bytes32 termsHash, uint16 commissionShareBps);   // phát trong initialize (ADR-27); bất biến từ đây
// Tiền công kỳ KHÔNG có khoản thiếu, chuyển cho chủ hụi ngay lúc chi kỳ bằng chi an toàn (03 mục 6.5 bước 6);
// nếu chuyển thất bại thì còn phát PaymentDeferred và ghi claimable. Kỳ có khoản thiếu: không có FeePaid, tiền công nằm trong feeEscrow.
event FeePaid(uint32 indexed round, address indexed organizer, uint256 amount);
event ContributionPulled(uint32 indexed round, address indexed member, uint256 amount);
event ContributionShortfall(uint32 indexed round, address indexed member, uint256 amount);
event ShortfallCovered(uint32 indexed round, address indexed member, CoverSource source, uint256 amount);
event RoundSettled(
    uint32 indexed round, address indexed winner, uint256 bid, uint256 pot,
    uint256 payout, uint256 holdback, uint256 fee, uint256 premium, uint256 uncovered
);
event HoldbackReleased(address indexed member, uint32 indexed round, uint256 amount);

event LatePaid(uint32 indexed round, address indexed member, uint256 amount, uint256 lateFee);
event DebtRepaid(address indexed member, uint256 principal, uint256 lateFee);
// Lãi chậm góp không đủ tiền để thu (pot hoặc holdback cạn): không ghi nợ, chỉ phát event làm khoản đòi công khai (03 mục 6.8).
event LateFeeUnpaid(address indexed member, uint256 amount);
// Mỗi phần hoàn theo thứ tự 03 mục 6.8 (payLate, repayDebt, pot người bị đóng băng, finalize):
// source = Uncovered nghĩa là trả thẳng cho người hốt kỳ đó; các source khác là hoàn quỹ dự phòng, ký quỹ, holdback.
// Riêng `finalize` với người vỡ nợ: phần source = Holdback là XÓA NỢ (khoản đó đã bị trừ từ chính holdback của họ), không chuyển tiền; sổ họ không được cộng nó vào holdback.
event ShortfallRestored(uint32 indexed round, address indexed member, CoverSource source, uint256 amount);
event MemberDefaulted(address indexed member, uint32 indexed round, bool frozen);
event FeeForfeited(uint32 indexed round, uint256 amount);

event PaymentDeferred(address indexed to, uint256 amount);   // chuyển thất bại → claimable
event Claimed(address indexed to, uint256 amount);
// feesPaid chỉ gồm tiền công còn trong escrow lúc finalize (tiền công đã trả ngay có event FeePaid)
event CircleFinalized(uint256 bondReturned, uint256 feesPaid, uint256 reserveDistributed);
// Chia quỹ dự phòng cuối dây theo đúng hạn (ADR-24); weight = onTimeWeight, 0 với người vỡ nợ. Không phát khi emergencyUnwind (chia đều).
// Nhánh Σw = 0 (mọi người trễ từ N − 1 lần): chia đều nhưng event vẫn ghi weight = onTimeWeight thật (0), amount > 0.
event ReserveShared(address indexed member, uint256 amount, uint16 weight);
event CirclePaused(uint64 at);
event CircleUnpaused(uint64 at, uint64 pausedTotal);
event CircleUnwound();
```

### 4.2. Lỗi

```solidity
error NotFactory();
error NotOrganizer();
error NotAdmin();
error NotMember();
error AlreadyMember();
error AlreadyLeft();           // join sau khi đã leave() chính dây này
error WrongState(CircleState expected, CircleState actual);
error InvalidParams(uint8 code);               // bảng mã ở 4.3
error CircleFull();
error CircleNotFull(uint8 have, uint8 need);   // activate khi chưa đủ N người
error JoinClosed();
error BadAttestation();
error AttestationUsed();
error AttestationExpired();
error InsufficientAllowance(uint256 needed, uint256 actual);
error CoverageTooLow(uint256 bps, uint256 minBps);
error NotInCommitWindow();
error NotInRevealWindow();
error NotEligibleToBid();
error NoCommit();
error CommitMismatch();
error AlreadyRevealed();
error BidTooHigh(uint256 bid, uint256 max);
error TooEarly(uint64 at);
error RoundAlreadySettled();
error PreviousRoundNotSettled();
error NoShortfall();
error GraceExpired();
error GraceNotOver();
error AlreadyDefaulted();
error NothingToClaim();
error NothingToWithdraw();   // withdrawBond khi ký quỹ đã rút hết
error RepayTooLarge(uint256 amount, uint256 debt); // repayDebt vượt tổng gốc còn nợ
error CircleIsPaused();      // tên khác event CirclePaused để solc không báo trùng
error UnwindTooEarly();
```

Lỗi riêng của `HuiFactory` (khai báo trong factory): `NotAdmin()`, `NotCircle(address who)` (hàm chỉ circle hợp lệ gọi, hoặc `pauseCircle`/`unpauseCircle`/`unwindCircle` với địa chỉ không phải circle), `ZeroAddress()` (admin, implementation hoặc địa chỉ trong cấu hình bằng 0), `InvalidConfig()` (cấu hình vượt trần cứng, forwarder lệch, `minMembers`/`maxMembers` ngoài 3..30). `onFinished` chỉ được chạy sau `onActivated` của chính circle đó: factory giữ cờ kích hoạt theo circle, nếu chưa có thì `onFinished` revert `NotActivated(circle)` thay vì underflow, và `onActivated` lần hai từ cùng circle cũng revert `AlreadyActivated(circle)`.

### 4.3. Mã lỗi tham số (`InvalidParams(code)`)

| Mã | Điều kiện sai |
|---|---|
| 1 | `memberCount` ngoài [minMembers, maxMembers] |
| 2 | `contribution` = 0 hoặc > `maxContribution` |
| 3 | `periodSeconds` ngoài [1 ngày, 31 ngày] |
| 4 | `roundDuration` < 120 giây |
| 5 | Bidding mà `commitWindow` < 30 hoặc `revealWindow` < 30, hoặc tổng > `roundDuration` |
| 6 | Fixed mà `commitWindow` hoặc `revealWindow` khác 0 |
| 7 | `graceSeconds` < 60 |
| 8 | `alphaBps` > 10_000 |
| 9 | `feeBps` > `maxFeeBps`, hoặc `feeBps` > 0 khi không phải họ hưởng hoa hồng |
| 10 | `reserveBps` > `maxReserveBps` |
| 11 | `revealBondBps` > 500 |
| 12 | `capBps` > `maxCapBps` |
| 13 | `joinDeadline` ≤ now |
| 14 | `graceSeconds` ≥ `roundDuration` |
| 15 | `commissionShareBps` > 5000, hoặc > 0 mà `mode` không phải `Bidding`, `commissionMode` tắt hoặc `feeBps` = 0 |
| 16 | `termsHash` = 0 |

(Mã 15 và 16 đã dời từ bản vá v1.2 của leader sang đây vì mã 14 đã dùng cho `graceSeconds`. Mã 15 trong bản v1.2 gốc dành cho `organizerTakesFirst`; ADR-23 đã bỏ khỏi bản thi nên mã đó không dùng, và nếu sau này làm thì lấy mã 17.)

---

## 5. Typed data EIP-712 (dùng với viem `signTypedData`)

### 5.1. `MemberAttestation` (attester của HụiSafe ký)

```ts
export const attestationTypes = {
  MemberAttestation: [
    { name: 'member', type: 'address' },
    { name: 'circle', type: 'address' },
    { name: 'attestationId', type: 'bytes32' },
    { name: 'expiry', type: 'uint64' },
  ],
} as const;

export const huiSafeDomain = (circle: `0x${string}`) => ({
  name: 'HuiSafe',
  version: '1',
  chainId: 43113,
  verifyingContract: circle,
});
```

### 5.2. Permit USDC (EIP-2612, người dùng ký)

```ts
export const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
// domain: { name: await usdc.read.name(), version: await usdc.read.version(), chainId: 43113, verifyingContract: USDC }
// value = await circle.read.requiredAllowance(); nonce = await usdc.read.nonces([owner])
```

### 5.3. Forward request (ERC-2771, `ERC2771Forwarder` của OpenZeppelin 5.x)

```ts
export const forwardRequestTypes = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
} as const;
// domain: { name: 'HuiSafeForwarder', version: '1', chainId: 43113, verifyingContract: FORWARDER }
// nonce = await forwarder.read.nonces([from]); data = encodeFunctionData({...})
// Gửi lên forwarder.execute(ForwardRequestData{from,to,value,gas,deadline,data,signature})
```

Kiểm lại tên trường và typehash với mã nguồn OpenZeppelin đúng phiên bản đã cài trước khi dùng.

### 5.4. Commit hash

```ts
import { encodeAbiParameters, keccak256 } from 'viem';
export const commitHash = (circle, round, member, bid, salt) =>
  keccak256(encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint32' }, { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }],
    [circle, round, member, bid, salt],
  ));
```

Phía Solidity: `keccak256(abi.encode(address(this), round, member, bid, salt))`.

---

## 6. Cấu hình và file triển khai

### 6.1. `packages/config/src/chains.ts`

```ts
export const FUJI = {
  id: 43113,
  name: 'Avalanche Fuji',
  rpc: process.env.FUJI_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc',
  explorer: 'https://testnet.snowtrace.io',
  usdc: '0x5425890298aed601595a70AB815c96711a31Bc65', // kiểm lại tại developers.circle.com
} as const;
```

### 6.2. `contracts/deployments/fuji.json` (script deploy ghi ra; SDK đọc vào)

```json
{
  "chainId": 43113,
  "usdc": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "forwarder": "0x...",
  "reputation": "0x...",
  "circleLens": "0x...",
  "circleImplementation": "0x...",
  "factory": "0x...",
  "admin": "0x...",
  "attester": "0x...",
  "relayer": "0x...",
  "deployedAt": "2026-11-11T13:00:00Z",
  "deployBlock": 12345678,
  "gitCommit": "abcdef1"
}
```

`deployBlock` là mốc dưới cho việc quét event của SDK (RPC công khai giới hạn khoảng block, quét theo đoạn từ đây). Script luôn tự nối registry (không còn `ALLOW_UNWIRED`, không còn trường `"wired"`). Trên Fuji, script chỉ ghi file khi `WRITE_DEPLOYMENT=true`.

---

## 7. SDK (`packages/sdk`)

### 7.1. View model cho giao diện

```ts
export type MemberStatus = 'live' | 'dead' | 'frozen' | 'defaultedDead';

export interface MemberView {
  address: `0x${string}`;
  joinIndex: number;
  status: MemberStatus;
  receivedRound?: number;
  holdback: bigint;
  debt: bigint;
  lateCount: number;
  reputation: { completed: number; onTime: number; late: number; defaults: number; repaid: number };
}

export interface ShortfallView {
  member: `0x${string}`;
  amount: bigint;
  fromHoldback: bigint; fromBond: bigint; fromReserve: bigint; uncovered: bigint;
  since: number; resolved: boolean; graceEndsAt: number;
}

export interface RoundView {
  k: number;
  phase: 'not-started' | 'commit' | 'reveal' | 'awaiting-settle' | 'done';
  roundStart: number; commitEndsAt: number; revealEndsAt: number; deadline: number;
  maxBid: bigint;
  winner?: `0x${string}`; bid?: bigint; pot?: bigint; payout?: bigint;
  holdback?: bigint; fee?: bigint; premium?: bigint; uncovered?: bigint; settledAt?: number;
  shortfalls: ShortfallView[];
}

export interface CircleView {
  address: `0x${string}`;
  label: string;
  mode: 'fixed' | 'bidding';
  state: 'forming' | 'active' | 'paused' | 'completed' | 'cancelled' | 'unwound';
  organizer: `0x${string}`;
  params: {
    N: number; C: bigint; periodSeconds: number; roundDuration: number;
    commitWindow: number; revealWindow: number; graceSeconds: number;
    alphaBps: number; commissionMode: boolean; feeBps: number; commissionShareBps: number; reserveBps: number;
    revealBondBps: number; capBps: number; joinDeadline: number; termsHash: `0x${string}`;
  };
  startTime?: number;
  currentRound: number;
  bondRemaining: bigint; reserve: bigint;
  coverageBps: number; guaranteedCoverageBps: number;
  ndc19: { perRoundVnd: number; organizerActiveCircles: number; mustNotifyCommune: boolean };
  members: MemberView[];
  rounds: RoundView[];
}
```

### 7.2. Hàm SDK

| Hàm | Việc |
|---|---|
| `readCircle(client, address)` | Đọc state + event, dựng `CircleView` |
| `getCircleEvents(client, address, fromBlock?)` | `getLogs` cho mọi event ở mục 4.1 |
| `listCircles(client, factory, { organizer? })` | Đọc danh bạ factory |
| `buildCreateCircleParams(form)` | Kiểm tra và dựng `CircleParams` (cùng bảng mã lỗi 4.3) |
| `signPermit(wallet, circle)` | Ký permit đúng `requiredAllowance` |
| `requestAttestation(privyToken, circle)` | Gọi `/api/attest` |
| `relay(wallet, to, data)` | Ký forward request, gửi `/api/relay`, trả tx hash |
| `newSalt()` / `saveSalt()` / `loadSalt()` | Sinh và lưu salt vào IndexedDB |
| `commitHash(...)` | Như mục 5.4 |
| `huiMath.*` | Bản TS của `HuiMath` |
| `quoteRepay(view, member, principal, nowSec)` | Tính tổng phải trả cho `repayDebt(principal)` hoặc `payLate(k)`: đi qua các `ShortfallView` chưa `resolved` theo thứ tự hoàn của 03 mục 6.8, cộng `huiMath.lateFee` của từng phần gốc. Giao diện dùng số này để kiểm allowance trước khi gửi |
| `vndPerRound(view, rate)` | Giá trị một kỳ = N·C × tỷ giá (cấu hình, mặc định 26.000 VND/USDC), dùng để kiểm ngưỡng NĐ 19 Điều 14 (≥ 100.000.000 VND); N·C là cách tính thận trọng |

ABI sinh tự động từ `contracts/out` bằng `@wagmi/cli` (plugin foundry) qua lệnh `pnpm --filter sdk generate`. Không chép tay ABI.

---

## 8. API backend (Next.js route handlers trong `apps/web/app/api`)

Tất cả nhận và trả JSON; số tiền gửi dưới dạng chuỗi (bigint). Mọi route ghi log có `requestId`; không log khóa, chữ ký đầy đủ hay token.

### 8.1. `POST /api/attest`

- Header: `Authorization: Bearer <Privy access token>`.
- Điều kiện vào dây (B27/B28, kiểm trên chuỗi trước khi ký): ví chưa ở trong dây (409 `AlreadyMember`); ví không có vỡ nợ chưa hoàn trả, tức KHÔNG có dây nào của factory (`factory.allCircles()`) mà `memberInfo(ví).defaulted = true` và `memberInfo(ví).debt > 0` (422 `UnresolvedDefault`; chủ hụi không loại được thành viên nên đây là cổng duy nhất); và không có dây nào mà ví chưa bị đánh dấu nhưng còn khoản thiếu đã quá ân hạn (`graceEnd`, docs/03 mục 6.8), tức `markDefault(ví)` sẽ chạy được (422 `OverdueShortfall`; audit 21/11 L-02: keeper bỏ qua dây không ký quỹ và dây ngoài 200 dây mới nhất, nên khoản quá hạn có thể không bao giờ được đánh dấu). Bước này mô phỏng `markDefault(ví)` bằng `eth_call` (không gửi giao dịch), chỉ khi `debt > 0` và chưa `defaulted`, nên dùng đúng luật ân hạn của contract kể cả thời gian tạm dừng; revert `GraceNotOver`, `NoShortfall`, `AlreadyDefaulted`, `NotMember`, `WrongState`, `CircleIsPaused` nghĩa là chưa quá hạn, lỗi khác hay lỗi mạng thì 502. Khoản thiếu còn trong ân hạn không chặn (người đó vẫn `payLate` được). Luật đọc nợ thật của từng dây, không dùng bộ đếm `defaults`/`repaid` của ReputationRegistry: bộ đếm đó không khớp nợ thật (nợ trả bằng pot hay holdback không ghi `recordRepaid`; một lần vỡ nợ có thể ghi `recordRepaid` hai lần), xem `docs/DE-XUAT-SUA-LUAT-NO-21-11.md` hướng A. Chi phí (audit 21/11 M-01, M-02, `lib/server/entryGuard.ts`): mỗi yêu cầu chỉ đọc `memberInfo` ở những dây ví là thành viên; danh sách thành viên lấy từ một chỉ mục chung của tiến trình (dây đã qua Forming có danh sách thành viên cố định nên đọc một lần; dây Cancelled không bao giờ có nợ; dây Forming chưa có nợ, đọc lại `state` tối đa 30 giây một lần, tối đa 1.000 dây mỗi lần làm mới, 25 lệnh song song). Nợ cần ít nhất `roundDuration` (≥ 120 giây) cộng ân hạn (≥ 60 giây) sau `activate`, nên dây Forming đã đọc trong vòng 150 giây không giấu được nợ; còn dây chưa đọc hay dây Forming quá 150 giây thì KHÔNG đoán mà trả 503 `EntryCheckUnavailable` (fail closed, tự hết sau vài lần làm mới). Bước này chạy SAU các kiểm rẻ của chính dây (đã là thành viên, số dư). Chỉ quét dây của factory hiện tại (như registry cũ, vốn gắn với một factory). Dây `Unwound` hay `Completed` còn nợ thì ví vẫn bị chặn vì không còn cách trả trên chuỗi (docs/03 mục 6.8); số dư USDC ≥ C + cọc mở thăm, tức đủ một kỳ (422 `InsufficientBalance`). Đây là bước kiểm cho tiện, không phải lớp bảo mật: người cố ý vẫn có thể có đủ tiền lúc vào rồi rút ra; lớp bảo vệ thật là tiền giữ lại và ký quỹ. Đọc chuỗi lỗi thì 502 `ChainUnavailable`.
- Body: `{ "circle": "0x...", "ageConfirmed": true }`. `ageConfirmed` là ô tự xác nhận đủ 18 tuổi trên giao diện; khác `true` thì trả `AgeNotConfirmed`. Địa chỉ thành viên KHÔNG nằm trong body: server lấy từ ví nhúng Ethereum của chính user ở Privy, nên không xin được xác nhận cho ví khác.
- Kiểm: token Privy hợp lệ (SDK server `@privy-io/node`, qua một interface để test giả lập); địa chỉ embedded wallet của user; user đã tick xác nhận đủ 18 tuổi; giới hạn một ví mỗi người và 20 yêu cầu mỗi giờ; `factory.isCircle(circle)`.
- `attestationId = keccak256(serverSecret ‖ privyUserId ‖ circle)` (không đảo ngược được, không lưu dữ liệu cá nhân).
- Trả: `{ "attestation": { member, circle, attestationId, expiry }, "signature": "0x..." }`, `expiry` = now + 1 giờ (chuỗi số). Lỗi trả `{ "error": { "code", "message" } }` (401 chưa đăng nhập, 400 `AgeNotConfirmed`, 404 `NotCircle`, 409 `NoWallet`, 409 `AlreadyMember`, 413 `TooLarge`, 422 `InsufficientBalance`, 422 `UnresolvedDefault`, 422 `OverdueShortfall`, 429 `RateLimited`, 502 `ChainUnavailable`, 502 `AuthUnavailable`, 503 `NotConfigured`, 503 `EntryCheckUnavailable`). Giới hạn thêm 120 yêu cầu/giờ mỗi IP.

### 8.2. `POST /api/relay`

- Body: `{ "request": { from, to, value: "0", gas, deadline, data }, "signature": "0x..." }`.
- Trước các bước kiểm: giới hạn 300 yêu cầu/giờ mỗi IP và ngân sách chung 1.500 yêu cầu/giờ cho cả dịch vụ (chặn cạn ví relayer); vượt thì 429 hoặc 503 `RelayBusy`.
- Kiểm, theo thứ tự:
  1. `to` là factory hoặc `factory.isCircle(to)`.
  2. Selector của `data` nằm trong danh sách cho phép, theo loại đích (`createCircle` chỉ gửi tới factory, các hàm còn lại chỉ tới dây; `pause`, `unpause`, `emergencyUnwind`, `initialize` không bao giờ):
     - Người dùng: `createCircle`, `depositBond`, `withdrawBond`, `join`, `leave`, `activate`, `commitBid`, `revealBid`, `payLate`, `repayDebt`, `claim`.
     - Hàm ai cũng gọi được, để nút "Chốt kỳ" trên web chạy không tốn gas khi keeper chậm: `settleRound`, `markDefault`, `finalize`, `cancel`. Từ A17 (đóng audit A16 M-01) bốn hàm này chỉ được chuyển tiếp khi (a) dây có `bondDeposited() > 0` và (b) người ký là thành viên (`memberInfo(from).joined`) hoặc chủ hụi (`organizer()`) của chính dây đó; không thì 403 `TargetNotAllowed` (thông báo nêu lý do), TRƯỚC bước kiểm chữ ký, hạn mức và mô phỏng nên không tốn hạn mức nào. Lý do: dây không ai ký quỹ không qua nổi sàn CI 100% trừ khi α = 100%, tức là dây rác mà mỗi kỳ có thể tốn hàng triệu gas. Keeper vẫn phục vụ mọi dây có ký quỹ (mục 9). Người ngoài dây muốn chốt kỳ thì gọi thẳng contract bằng ví có AVAX.
     - `depositBond` với `amount == 0` bị từ chối ngay (400 `ZeroAmount`) trước mọi lần đọc chuỗi và mô phỏng: nếu không, lệnh này luôn mô phỏng thành công và lặp vô hạn trên một dây Forming rác.
  3. `value == 0`; `gas` ≤ 3.000.000, riêng `settleRound` và `finalize` ≤ 5.000.000 (ca cực đoan N = 30 cả dây cùng thiếu tốn khoảng 4,1 đến 5 triệu gas, xem 04 mục 7.1).
  4. `forwarder.verify(request)` bằng `eth_call`.
  5. Rate limit 30 yêu cầu/giờ mỗi `from`, chỉ tính cho yêu cầu đã qua bước 4 (chữ ký sai không làm hao hạn mức của người khác).
  6. Riêng `createCircle` (ai ký cũng gửi được, mỗi dây tốn gas): cần header `Authorization: Bearer <Privy access token>` của chính tài khoản có ví nhúng trùng `from`, tối đa 5 dây/giờ mỗi tài khoản.
  7. Mô phỏng `execute` bằng `eth_call`. Forwarder chỉ báo `FailedCall` khi lệnh con lỗi, nên khi mô phỏng thất bại relay chạy lại lệnh con (nối thêm địa chỉ người ký theo ERC-2771) để giải mã custom error thật.
- Gửi bằng ví relayer (nạp AVAX testnet, cảnh báo khi số dư < 0,02 AVAX; dưới 0,005 AVAX thì dừng gửi và trả 503 `RelayUnavailable`). Các lệnh gửi đi qua một khóa tuần tự để không trùng nonce, và bộ giới hạn nằm trong bộ nhớ nên relay phải chạy như MỘT tiến trình Node liên tục (không serverless nhiều bản); cần nhiều bản thì chuyển bộ giới hạn và nonce sang kho dùng chung.
- Trả: `{ "txHash": "0x..." }` hoặc `{ "error": { "code", "message" } }` (mã lỗi custom error đã giải mã).
- Gửi lại đúng yêu cầu đã ký (idempotent, 21/11/2026): relay nhớ trong bộ nhớ 15 phút mọi yêu cầu đã gửi, khóa theo toàn bộ `from, to, value, gas, deadline, data, signature`, kiểm ngay sau các kiểm tra tĩnh (bước 1 đến 3) và trước `forwarder.verify`. Client mất phản hồi hoặc bấm đúp rồi gửi lại cùng thân yêu cầu thì nhận lại ĐÚNG `txHash` cũ (200) và không có giao dịch thứ hai (hai yêu cầu đồng thời cũng chỉ gửi một). Điều này cần cả khi giao dịch đầu đã được đào: lúc đó nonce forwarder đã dùng nên `forwarder.verify` sai, và nếu không nhớ thì client nhận `InvalidSignature` "hãy ký lại" dù thao tác đã thành công. Yêu cầu chỉ dùng lại chữ ký với dữ liệu khác không được trả từ bộ nhớ; lần gửi thất bại (503, 422) không được nhớ. Quá 15 phút hoặc sau khi tiến trình khởi động lại thì nonce của forwarder vẫn giữ lệnh gọi tối đa một lần. Không đổi mã lỗi hay hình dạng phản hồi.

### 8.2b. `POST /api/relay/permit` (M-02, phương án (a), duyệt 10/11/2026)

Vấn đề: `payLate` và `repayDebt` kéo tiền bằng `transferFrom` từ allowance cấp lúc `join`, không nhận `PermitSig`; thành viên Privy không có AVAX nên không tự gọi `USDC.approve`/`permit` được, và `/api/relay` chỉ nhận đích là factory hoặc dây. Route này cho relayer gửi hộ MỘT lệnh `USDC.permit` mà chính thành viên đã ký (EIP-2612 tự xác thực bằng chữ ký, không cần forwarder). Không đổi contract.

- Body: `{ "permit": { "owner": "0x...", "spender": "0x...", "value": "<uint>", "deadline": <số giây>, "v": 27|28, "r": "0x..", "s": "0x.." } }`. `spender` là địa chỉ dây.
- Trước các bước kiểm: giới hạn theo IP (300/giờ, chung bộ đếm với `/api/relay`). Ngân sách chung 1.500 yêu cầu/giờ của relayer (cũng chung với `/api/relay`) chỉ bị trừ cho yêu cầu đã qua MỌI bước kiểm và sắp được gửi (audit A14 H-01: body rác, chữ ký sai không được làm cạn ngân sách và khóa người trung thực ngoài relay); `/api/relay` đổi theo cùng cách. Mỗi lần trả trễ tốn hai đơn vị ngân sách (permit, rồi `payLate`).
- Kiểm, theo thứ tự:
  1. `factory.isCircle(spender)`.
  2. `circle.memberInfo(owner).joined`, `circle.state()` là `Active` và `memberInfo(owner).debt > 0` (route chỉ phục vụ `payLate`/`repayDebt`; dây `Forming` hay thành viên không nợ không cần nên bị chặn, tránh tiêu gas relayer vô ích).
  3. `0 < value ≤ 2 × circle.requiredAllowance()` (trần chống giá trị vô lý; contract tin cậy mới tiêu được allowance và INV-04 giới hạn mỗi lần kéo).
  4. `now < deadline ≤ now + 1 giờ` (theo giờ block mới nhất).
  5. Mô phỏng `eth_call` `USDC.permit(...)`. Lỗi đường truyền RPC (mạng, quá hạn) trả 502 `ChainUnavailable`, không bảo người dùng ký lại. Nếu contract revert (ví dụ nonce đã dùng vì ai đó gửi trước) thì chấp nhận khi `allowance(owner, spender) ≥ value`, giống `join` (docs/03 mục 5.1); khi đó KHÔNG gửi giao dịch nào, trả `{ "skipped": true }`.
  6. Hạn mức 10 yêu cầu/giờ mỗi `owner`, chỉ tính cho permit đã qua bước 5 (chữ ký sai không làm hao hạn mức của người khác); rồi ngân sách chung như trên; ngưỡng AVAX của relayer như `/api/relay` (dưới 0,005 AVAX trả 503 `RelayUnavailable`); gửi bằng ví relayer qua cùng khóa tuần tự nonce (một mutex và một `nonceManager` cho cả hai route).
- Trả: `{ "txHash": "0x..." }` hoặc `{ "skipped": true }`, hoặc `{ "error": { "code", "message" } }` (400 `BadRequest`, `DeadlineInvalid`, `ValueNotAllowed`; 403 `TargetNotAllowed`, `NotAMember`; 409 `WrongState`; 422 `InvalidSignature`; 429 `RateLimited`; 502, 503 như `/api/relay`).
- Gửi lại đúng permit đã gửi (21/11/2026, cùng quy tắc với `/api/relay`): trong 15 phút, cùng bộ `owner, spender, value, deadline, v, r, s` nhận lại `txHash` cũ, không qua bước kiểm và không gửi lần hai (kể cả hai yêu cầu đến cùng lúc). Lý do: trước khi permit đầu được đào, mô phỏng vẫn qua, nên relayer sẽ gửi một bản sao chắc chắn revert và tốn gas. Lần gửi thất bại không được nhớ.
- Giá trị permit không cộng dồn (permit đặt allowance bằng giá trị ký), nên SDK `signRepayPermit` ký `allowance còn cần = (số kỳ còn phải góp sau kỳ của khoản thiếu) × C + gốc còn nợ + lãi tối đa` (đề xuất M-02 mục 2), tính từ `quoteRepay`, và hiện số USDC sẽ được cấp. Lúc `join` permit vẫn phải ký ĐÚNG `requiredAllowance`: contract tự gọi `permit(member, circle, requiredAllowance, ...)`, nên permit ký giá trị khác (ví dụ dư 1 C như đề xuất M-02 mục 6.1) sai chữ ký, bị bỏ qua và `join` revert `InsufficientAllowance`. Phần dư cho lãi chậm góp vì thế do permit trả trễ cấp, không cấp sẵn lúc vào dây.
- Luồng giao diện: kiểm allowance; nếu thiếu thì ký permit, `POST /api/relay/permit`, chờ giao dịch được đào, rồi `POST /api/relay` cho `payLate`/`repayDebt`. Quyết định cuối dựa trên allowance đọc lại từ chuỗi, không dựa trên kết quả vận chuyển: permit bị người khác gửi trước (giao dịch của relayer revert) hay relay trả 429/503 mà allowance đã đủ cho khoản trả thì vẫn gửi `payLate`/`repayDebt` (audit A14 M-01); lần thử lại ngay sau đó không ký permit thứ hai. Lỗi `NeedAllowance` không còn với ví Privy. Hạn mức IP (A15, đóng audit A14 H-01 phần còn lại; áp cho `/api/relay`, `/api/relay/permit`, `/api/attest` và sổ họ): `x-forwarded-for` và `x-real-ip` là header client tự đặt được (Next chỉ điền địa chỉ socket khi header vắng), nên mặc định KHÔNG được tin. Biến server `TRUST_PROXY=true` (đúng chuỗi `true`) mới bật việc đọc header, và chỉ bật khi web chạy sau đúng MỘT proxy tin cậy GHI ĐÈ header (ví dụ Caddy mặc định); khi đó khóa hạn mức là phần tử cuối của `x-forwarded-for` (địa chỉ proxy thấy), rồi `x-real-ip`. Không bật thì KHÔNG có cổng hạn mức IP (route handler của Next không lộ địa chỉ socket): một nhóm chung sẽ để một client ẩn danh làm cạn nhóm và khóa mọi thành viên khỏi relay (audit A15 H-01), tệ hơn một hạn mức né được. Các hạn mức còn lại vẫn giữ và chỉ bị trừ sau khi yêu cầu tự chứng minh hợp lệ: theo `from`/`owner`/người dùng Privy, ngân sách chung 1.500/giờ của relayer, trần kích thước body. Đổi lại, rác không hợp lệ chỉ tốn RPC, không tốn ví relayer. `/api/copilot` theo cùng quy tắc (A16, audit A15 M-01): hạn mức 20 câu/giờ mỗi IP chỉ khi `TRUST_PROXY=true`; không bật thì chỉ còn trần ngày `COPILOT_DAILY_LIMIT`.

### 8.3. `GET /api/circles/[address]/so-ho?format=json`

Dựng sổ họ (mục 10) từ event, trả JSON. Bản in PDF tiếng Việt do trang `/circles/<địa chỉ>/so-ho` dựng ở trình duyệt (nút "In sổ hụi"); `format=pdf` trả 400 `FormatNotSupported` kèm đường dẫn trang in.

### 8.4. `POST /api/copilot`

- Body: `{ "messages": [{ "role": "user"|"assistant", "content": "..." }], "draft"?: CircleDraft, "circle"?: "0x..." }`. `circle` là dây đang xem, địa chỉ ví duy nhất mô hình được thấy (07, mục 3.8) và là đầu vào của `draft_ubnd_notice`. Tối đa 12 tin, 2.000 ký tự mỗi tin, 16 KB mỗi yêu cầu, 20 câu mỗi giờ mỗi IP; trả luồng NDJSON gồm các dòng `status`, `tool`, `answer` hoặc `error`.
- Trả: stream văn bản kèm kết quả tool.
- Server gọi mô hình qua một bộ chuyển đổi nhà cung cấp (provider adapter) với hai backend, chọn bằng biến `COPILOT_PROVIDER`: `openai-compatible` (mặc định; `POST {COPILOT_BASE_URL}/chat/completions`, tool call theo định dạng OpenAI, ví dụ router của nhóm chạy Gemini) hoặc `anthropic` (SDK chính thức, khóa `ANTHROPIC_API_KEY`). Định nghĩa tool ở mục 12 là nguồn duy nhất và được chuyển đổi theo backend; tham số tool có thể là chuỗi JSON hoặc đối tượng, luôn được kiểm lại bằng schema của tool. Các vòng gọi mô hình không stream (tối đa 4 vòng tool, vòng cuối `tool_choice: none`); route stream cho trình duyệt các sự kiện từng bước. Không đặt sẵn tên model: thiếu `COPILOT_MODEL` thì route trả lỗi cấu hình tiếng Việt. Không có tool nào ký giao dịch hay chuyển tiền.
- Hạn mức (21/11/2026): giới hạn theo IP và trần ngày chỉ bị trừ cho yêu cầu đã qua kiểm body (JSON, schema, kích thước) và khi trợ lý đã được cấu hình; rác và lỗi cấu hình không tốn hạn mức, nên không ai làm cạn trần ngày chung bằng yêu cầu hỏng (cùng quy tắc ngân sách relay, audit H-01). `draft_ubnd_notice` kiểm `factory.isCircle` (mục 12, docs/07 mục 3.3) bằng client chỉ đọc của server khi mạng có deployment; đọc chuỗi lỗi thì tool báo `unavailable`, không làm hỏng câu trả lời.

### 8.5. `GET /api/sim/results?scenario=<id>`

Trả nguyên file JSON kết quả mô phỏng đã sinh sẵn `sim/outputs/<id>.json` (mục 11), chỉ đọc, không có tham số khác. `scenario` là tên của một file kết quả đã có: `baseline`, `baseline_calibrated`, `inv08`, `organizer_economics` (lời của chủ hụi theo chu kỳ, N, φ), `organizer_sybil` (một hoặc hai ví ảo ở CI 50% và 100%); file `.meta.json` không phải kịch bản. Thiếu hoặc sai tham số (không khớp `^[a-z0-9_]{1,64}$`, nên không đọc được đường dẫn): 400 `BadRequest`; chưa có kết quả: 404 `NoResults`. Trang `/lab` (S16) đọc cùng các file này lúc dựng và vẽ cả hai phần của chủ hụi; số trong bảng ví ảo lấy từ file, khớp docs/03 mục 7.3.

---

## 9. Keeper (`apps/keeper`)

| Việc | Điều kiện | Gọi |
|---|---|---|
| Chi kỳ | dây Active, kỳ chưa chi, và đã hết lượt của chủ hụi: `now ≥ deadline(currentRound) + organizerSettleWaitSec(roundDuration)` (B28: 86.400 giây với kỳ từ 1 ngày trở lên, 300 giây với dây demo; `packages/config`). Trước đó chủ hụi khui trên web (bàn khui kỳ); hợp đồng vẫn cho bất kỳ ai gọi từ `deadline`, nên đây chỉ là chính sách của keeper và web, chủ hụi vắng mặt chỉ làm chậm, không giữ được hũ. Chủ hụi giữ một chân trong dây thì KHÔNG có lượt ưu tiên (khui từ `deadline`), vì bàn khui kỳ cho thấy ai đang thiếu tiền và họ có thể chọn đúng lúc đối thủ thiếu (audit B28 L-01) | `settleRound()` |
| Đánh dấu vỡ nợ | có `Shortfall` chưa `resolved` và `now > since + grace` | `markDefault(member)` |
| Kết thúc | kỳ N đã chi, qua ân hạn, không còn khoản thiếu đang trong ân hạn, và MỌI khoản thiếu quá hạn đã được `markDefault` ở dòng trên | `finalize()` |
| Hủy | Forming, `now > joinDeadline` và có ký quỹ (`bondRemaining > 0`); dây Forming quá hạn mà chưa từng có ký quỹ chỉ bị `cancel` để dọn (tối đa 5 dây mỗi vòng quét) và chỉ bỏ khỏi danh sách theo dõi SAU KHI `cancel` đã thành công; gửi lỗi hay bị revert thì dây vẫn được thử lại ở vòng sau (issue #2) | `cancel()` |
| Nhắc hụi (bonus) | 24 giờ (demo: 60 giây) trước cửa sổ commit đóng; 6 giờ trước `deadline` nếu ví không đủ số dư | gửi Telegram cho người đã đăng ký |

- Chu kỳ quét: 15 giây ở chế độ demo, 5 phút ở bản thật.
- Mọi lệnh đều idempotent: mô phỏng bằng `eth_call` trước, bỏ qua khi revert vì "đã làm".
- Thứ tự bắt buộc: `markDefault` cho mọi khoản thiếu quá hạn TRƯỚC `finalize`. `finalize` tự đánh dấu người chưa bị đánh dấu nhưng với nhiều người (N = 30, 29 người) có thể tốn hơn 5.000.000 gas và vượt trần relayer/keeper; đường thường khoảng 1,2 đến 2,0 triệu gas (04, mục 7.1).
- Dây rác (A17, đóng audit A16 M-01 và L-01): keeper bỏ qua dây có `bondDeposited() == 0` (Active hay Paused mà chưa từng có ký quỹ thì không bao giờ có nữa nên bị loại hẳn; Forming chưa quá hạn thì xem lại vòng sau vì chủ hụi còn nạp được). Dây đã từng thấy có ký quỹ (`bondDeposited() > 0`, chưa kết thúc) luôn được đọc ở mọi vòng, vì ký quỹ tốn USDC thật nên không thể bị spam chen chỗ. Phần còn lại (chưa thấy ký quỹ) mỗi vòng đọc tối đa 200 dây, dây lâu chưa được đọc nhất trước và mới nhất trước khi bằng nhau, nên vòng đầu là 200 dây mới nhất và mọi dây đều được đọc trong tối đa ⌈n/200⌉ vòng dù có bao nhiêu dây rác mới xuất hiện (issue #1); ghi log `circle list truncated` khi phải cắt. Bộ nhớ này (`KeeperMemory`) sống trong một tiến trình keeper; khởi động lại thì quét lại từ đầu.
- Một dây lỗi không chặn các dây khác (21/11/2026): nếu đọc snapshot hoặc một bước của MỘT dây ném lỗi (thường là RPC bị throttle), keeper ghi `warn circle skipped` (chỉ tên lỗi, không kèm nội dung vì lỗi của viem có thể chứa URL RPC và khóa), tính vào `failed`, đẩy dây đó xuống cuối hàng đợi như dây đã đọc, rồi phục vụ tiếp các dây còn lại trong cùng lượt. Trước đó cả lượt quét dừng ở dây lỗi đầu tiên, nên các dây đứng sau (dây cũ nhất, vì thứ tự là mới nhất trước) bị bỏ đói khi RPC chập chờn. Lượt quét vẫn dừng và ném lỗi khi `MAX_CONSECUTIVE_FAILURES` (5) lần đọc snapshot liên tiếp thất bại (mất RPC hoàn toàn); vòng sau thử lại.
- Giao dịch đã gửi mà chưa xác nhận được biên nhận (21/11/2026): khi lệnh dò biên nhận lỗi (RPC throttle) hoặc hết 180 giây chờ, keeper nhớ `txHash` theo cặp (dây, hàm, tham số đầu) và báo `TxPending` thay vì "chưa gửi". Các lượt sau chỉ đọc biên nhận của giao dịch đó, không gửi lại, vì trước khi được đào thì mô phỏng vẫn qua và bản gửi lại chỉ revert, tốn gas. Có biên nhận thì báo như bình thường (revert thì vào back-off như cũ); sau 10 phút vẫn không có biên nhận thì coi là bị rơi và cho gửi lại.
- Keeper chỉ là tiện ích: ai cũng gọi được các hàm trên.

---

## 10. Sổ họ số (NĐ 19 Điều 12 và 13)

Sổ họ dựng hoàn toàn từ event, xuất JSON và PDF.

**Phần đầu:**
- Tên dây (`label`), địa chỉ contract, chủ hụi (địa chỉ).
- Kiểu họ, số phần, mức góp, kỳ danh nghĩa, ngày bắt đầu.
- Trần lãi, lãi chậm góp, tiền công, quỹ dự phòng, tỷ lệ giữ lại, ký quỹ.
- Chỉ số bảo chứng lúc kích hoạt.
- Mã QR dẫn tới Snowtrace.

**Danh sách thành viên:** địa chỉ ví, thứ tự vào dây, kỳ đã hốt. Biệt danh (nếu có) chỉ lưu trong trình duyệt của chủ hụi, không lên chuỗi.

**Các dòng:**

| Trường | Nguồn event |
|---|---|
| Ngày giờ (giờ VN) | timestamp của block |
| Kỳ | `round` |
| Thành viên | `member` |
| Loại | góp (`ContributionPulled`), thiếu (`ContributionShortfall`), bù (`ShortfallCovered` + nguồn), hốt (`RoundSettled`), giữ lại / nhả (`HoldbackReleased`), trả trễ (`LatePaid`), hoàn nguồn bù và trả khoản đòi (`ShortfallRestored` + nguồn), vỡ nợ (`MemberDefaulted`), trả nợ (`DebtRepaid`), tiền công trả ngay cho chủ hụi (`FeePaid`), chia quỹ dự phòng cuối dây theo đúng hạn (`ReserveShared`) |
| Số tiền | USDC, kèm quy đổi VND theo tỷ giá cấu hình (ghi rõ là quy đổi tham khảo) |
| Bằng chứng | tx hash; người ký là `from` của forward request (chữ ký EIP-712 của chính thành viên) |

**Phần cuối:** tổng góp, tổng hốt, tổng bù, khoản đòi còn lại; cảnh báo ngưỡng Điều 14 nếu có; ghi chú "Bản in này dựng từ dữ liệu on-chain tại thời điểm in".

Việc chữ ký điện tử có thay chữ ký tay trong sổ họ hay không là câu hỏi mở cho luật sư ([10-phap-ly-va-tuan-thu.md](10-phap-ly-va-tuan-thu.md)).

---

## 11. Phòng mô phỏng: schema vào và ra (`sim/`)

### 11.1. Cấu hình (`sim/scenarios/*.json`)

```json
{
  "id": "baseline",
  "seed": 42,
  "circles": 10000,
  "N": 10,
  "C": 100,
  "periodDays": 30,
  "designs": ["traditional", "naive_onchain", "huisafe"],
  "huisafe": { "alphaBps": 2000, "bondRatio": 0.8, "reserveBps": 100, "feeBps": 100 },
  "traditional": { "organizerAbscondProbPerRound": 0.005, "organizerCoversDefaults": true, "organizerCapacityRatio": 0.3 },
  "behaviour": {
    "deadDefaultHazardPerRound": { "early": 0.0204, "late": 0.0059 },
    "liveDefaultHazardPerRound": 0.003,
    "bidModel": "uniform_fraction_of_cap",
    "correlatedShock": { "prob": 0.02, "multiplier": 5 }
  }
}
```

Giá trị hazard mặc định lấy cảm hứng từ tỷ lệ bỏ đóng của Klonner & Rai (2008). Đây là tham số giả định cho mô phỏng, phải ghi rõ là giả định khi trình bày. Chi tiết mô hình ở [08-phong-mo-phong.md](08-phong-mo-phong.md).

### 11.2. Kết quả (`sim/outputs/<id>.json`)

```json
{
  "scenario": "baseline",
  "generatedAt": "2026-11-14T10:00:00Z",
  "results": [
    {
      "design": "huisafe",
      "lateReceiverExpectedLossPct": 0.0,
      "lateReceiverP95LossPct": 0.0,
      "circleFailureProb": 0.0,
      "uncoveredMeanUsdc": 0.0,
      "bondUsageMeanPct": 0.0,
      "organizerNetReturnPct": 0.0
    }
  ],
  "charts": ["outputs/baseline_loss.png"]
}
```

Các số trong ví dụ trên chỉ là chỗ trống; số thật do mô phỏng sinh ra. Chỉ số không áp dụng cho một thiết kế thì ghi `null` (ví dụ `bondUsageMeanPct` và `organizerNetReturnPct` của `naive_onchain`). Khoảng tin cậy 95%, seed thực dùng và thông tin môi trường ghi ở file riêng `sim/outputs/<id>.meta.json` ([08-phong-mo-phong.md](08-phong-mo-phong.md), mục 6), không thêm trường vào file này.

---

## 12. Tool của Trợ lý chủ hụi (JSON Schema, dùng cho tool use của cả hai backend ở mục 8.4)

Tất cả là hàm tất định chạy trên server (bản TS của `HuiMath` hoặc kết quả mô phỏng sẵn). LLM chỉ chọn tool, đọc kết quả và giải thích. Không có tool ký hay chuyển tiền.

```json
[
  {
    "name": "compute_exposure",
    "description": "Tính tiền chưa đóng theo từng kỳ O(k) và đỉnh O_max cho dây N phần, mức góp C (USDC).",
    "input_schema": { "type": "object", "properties": { "N": { "type": "integer", "minimum": 3, "maximum": 30 }, "C": { "type": "number", "exclusiveMinimum": 0 } }, "required": ["N", "C"] }
  },
  {
    "name": "recommend_bond",
    "description": "Tính ký quỹ cần để đạt chỉ số bảo chứng mục tiêu với tỷ lệ giữ lại alphaBps.",
    "input_schema": { "type": "object", "properties": { "N": { "type": "integer" }, "C": { "type": "number" }, "alphaBps": { "type": "integer", "minimum": 0, "maximum": 10000 }, "targetCoverageBps": { "type": "integer", "minimum": 5000, "maximum": 10000 } }, "required": ["N", "C", "alphaBps", "targetCoverageBps"] }
  },
  {
    "name": "max_bid_table",
    "description": "Bảng trần tiền thăm theo từng kỳ theo NĐ 19 Điều 21 (diễn giải của HụiSafe). Có commissionShareBps (φ) và feeBps (trần hoa hồng mỗi lần hốt) thì thêm cột trần thăm thực thi và hoa hồng tối đa của từng kỳ.",
    "input_schema": { "type": "object", "properties": { "N": { "type": "integer" }, "C": { "type": "number" }, "periodDays": { "type": "integer" }, "capBps": { "type": "integer", "default": 2000 }, "commissionShareBps": { "type": "integer", "minimum": 0, "maximum": 5000, "default": 0 }, "feeBps": { "type": "integer", "minimum": 0, "maximum": 300, "default": 0 } }, "required": ["N", "C", "periodDays"] }
  },
  {
    "name": "simulate_circle",
    "description": "Tra kết quả mô phỏng gần nhất cho cấu hình (tổn thất người hốt sau, xác suất vỡ dây) ở ba thiết kế. Có organizer thì tra hai kịch bản chủ hụi của v1.2: economics (lời của chủ hụi theo chu kỳ và φ) hoặc sybil (chủ hụi dùng một hay hai ví ảo).",
    "input_schema": { "type": "object", "properties": { "N": { "type": "integer" }, "alphaBps": { "type": "integer" }, "bondRatio": { "type": "number" }, "organizer": { "type": "string", "enum": ["economics", "sybil"] }, "periodDays": { "type": "integer", "minimum": 1, "maximum": 31 }, "commissionShareBps": { "type": "integer", "minimum": 0, "maximum": 5000 }, "wallets": { "type": "integer", "minimum": 1, "maximum": 2 } }, "required": ["N", "alphaBps", "bondRatio"] }
  },
  {
    "name": "explain_rule",
    "description": "Trả nội dung đã duyệt về một quy định (NĐ 19 các điều 5, 6, 12, 14, 18, 21, 22; luật cuộc thi) để trích dẫn.",
    "input_schema": { "type": "object", "properties": { "topic": { "type": "string", "enum": ["nd19_dieu5_6", "nd19_dieu12_13", "nd19_dieu14", "nd19_dieu18_4", "nd19_dieu20", "nd19_dieu21", "nd19_dieu22", "nd19_dieu25", "crypto_vn", "unihack_rules"] } }, "required": ["topic"] }
  },
  {
    "name": "draft_ubnd_notice",
    "description": "Soạn bản nháp thông báo tổ chức dây họ gửi UBND cấp xã khi chạm ngưỡng NĐ 19 Điều 14.",
    "input_schema": { "type": "object", "properties": { "circle": { "type": "string", "pattern": "^0x[0-9a-fA-F]{40}$" } }, "required": ["circle"] }
  }
]
```

### 12.1. `CircleDraft` (bản nháp dây do form S03 gửi lên `/api/copilot`)

```ts
export interface CircleDraft {
  mode: 'fixed' | 'bidding';
  N: number;                 // 3..30
  C: string;                 // USDC dạng thập phân, ví dụ "100"
  periodDays: number;        // kỳ danh nghĩa, 1..31
  demoMode: boolean;         // true: roundDuration 180 s, cửa sổ 90/60 s, ân hạn 120 s
  alphaBps: number;
  bondUsdc: string;          // ký quỹ dự kiến
  commissionMode: boolean;
  feeBps: number;            // φ = 0: tiền công cố định; φ > 0: trần mỗi pot
  commissionShareBps?: number; // φ, 0..5000 (03 mục 2.7); mặc định 0
  reserveBps: number;
  revealBondBps: number;
  capBps: number;            // ≤ 2000
  organizerActiveCircles?: number;  // đọc từ factory nếu chủ hụi đã đăng nhập
}
```

Server kiểm `CircleDraft` theo đúng bảng mã lỗi 4.3 trước khi tính dữ kiện. Bản nháp không chứa dữ liệu cá nhân.

### 12.2. Đầu ra của tool (chuẩn)

Mọi số tiền trả về là chuỗi USDC thập phân 6 chữ số, tính bằng `huiMath` (TS).

| Tool | Đầu ra |
|---|---|
| `compute_exposure` | `{ "exposure": ["0", "400", ...], "maxExposure": "600", "peakRound": 2 }`, trong đó `exposure[k]` là O(k), k = 0..N |
| `recommend_bond` | `{ "maxExposure": "600", "bond": "480", "guaranteedCoverageBps": 10000, "guaranteedCoveragePercent": "100" }` (trường phần trăm để mô hình không tự đổi bps) |
| `max_bid_table` | φ = 0 (hoặc không truyền): `{ "rows": [{ "k": 1, "payers": 4, "maxBid": "6.575342" }, ...] }`. φ > 0 (cần `feeBps` > 0, nếu không bị từ chối như `InvalidParams(15)`): thêm `commissionShareBps`, `feeBps`, `commissionTotal` và mỗi dòng có `enforcedMaxBid` (trần thăm thực thi = `bidCapAfterShare`) và `commission` (hoa hồng tối đa của kỳ, tính trên pot lớn nhất (N − 1)·C, bằng `commission(pot, feeBps, φ, room_k)`), ví dụ dây ví dụ mục 8.1: `enforcedMaxBid` 3.287671 / 2.465753 / 1.643835 / 0.821917 / 0, `commission` 12 / 7.397259 / 3.287671 / 0.821917 / 0, `commissionTotal` 23.506847 |
| `simulate_circle` | `{ "status": "ok", "matched": { N, alphaBps, bondRatio }, "runs": [{ "scenario", "seed", "circles", "deadDefaultHazardPerRound", "generatedAt", "results": [bản ghi `results` của 05 mục 11.2] }] }` cho mọi kịch bản đã chạy khớp đúng ba tham số (nhiều kịch bản khớp thì liệt kê hết, kèm giả định hazard); nếu chưa có thì `{ "status": "no_results" }`. Có `organizer` (`economics` hoặc `sybil`): không đọc kịch bản ba thiết kế mà trả `{ "status": "ok", "matched": { organizer, N, alphaBps, bondRatio }, "organizerRuns": [{ "scenario", "kind", "seed", "generatedAt", "assumptions", "economics"?: [ô theo chu kỳ, N, φ: `schedule`, `periodDays`, `members`, `shareBps`, `feeBps`, `bondUsdc`, `grossFeeUsdc`, `expectedLossUsdc`, `netAfterRiskUsdc`, `annualReturnPctByHazardScale`, `seatNetUsdc`, `firstSeatNetUsdc`, `lastSeatNetUsdc`, `lastThirdNeverLoses`, `insideInterestCap`], "sybil"?: [trường hợp: `label`, `wallets`, `bondUsdc`, `bondBps`, `coverageBps`, `organizerNetUsdc`, `walletsNetUsdc`, `uncoveredUsdc`, `lastReceiverPayoutUsdc`, `lastReceiverNormalUsdc`] }] }`. `economics` khớp khi N nằm trong danh sách của kịch bản `organizer_economics`, `alphaBps` đúng và `bondRatio` = (10000 − alphaBps)/10000 (ký quỹ cho CI 100%); `periodDays` và `commissionShareBps` lọc thêm; `sybil` khớp N và `alphaBps` của `organizer_sybil`, `bondRatio` = `bondBps`/10000 (0.8 hoặc 0.3), `wallets` lọc thêm. Số tiền ở đây là số JSON (USDC), không phải chuỗi. `assumptions` là câu giả định của kịch bản (hazard Klonner & Rai, tỷ lệ thăm) và trợ lý phải nói ra khi nêu số (docs/08 mục 2.7). Không khớp thì `{ "status": "no_results" }` |
| `explain_rule` | `{ "topic": "...", "text": "...", "citation": "NĐ 19/2019/NĐ-CP Điều ...", "url": "...", "checkedAt": "2026-11-06" }`, văn bản đã duyệt nằm trong repo |
| `draft_ubnd_notice` | `{ "markdown": "...", "placeholders": ["[HỌ TÊN]", "[SỐ GIẤY TỜ]", "[NGÀY SINH]", "[NƠI CƯ TRÚ]"] }`; người dùng tự điền trên máy, không gửi lên server, không đưa vào LLM |

Ngưỡng Điều 14 dùng trong `CircleView.ndc19` và `draft_ubnd_notice`: giá trị một kỳ = **N·C** quy đổi VND theo tỷ giá cấu hình. Đây là cách tính thận trọng, vì cách hiểu "tổng giá trị các phần họ tại một kỳ" là câu hỏi mở cho luật sư (xem 10).

Đầu ra bắt buộc của trợ lý: số liệu lấy nguyên từ kết quả tool, câu nào nói về luật phải dẫn điều khoản, có câu "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý". Bộ eval ở [07-ai-agentic.md](07-ai-agentic.md).

---

## 13. Lưu trữ phía trình duyệt

| Kho | Khóa | Giá trị | Ghi chú |
|---|---|---|---|
| IndexedDB `huisafe` / store `salts` | `${circle}:${round}:${member}` | `{ bid, salt, createdAt }` | Có nút "Sao lưu thăm" xuất file mã hóa bằng mật khẩu |
| localStorage | `huisafe.nicknames.${circle}` | `{ [address]: nickname }` | Chỉ trên máy chủ hụi; không gửi lên server |
| localStorage | `huisafe.demoMode` | `true/false` | Hiện nhãn "Chế độ demo" trên mọi màn hình |

Mọi truy cập lưu trữ bọc `try/catch`; mất dữ liệu cục bộ không làm hỏng luồng chính, trừ salt (mất salt thì không mở được thăm, giao diện cảnh báo trước).
