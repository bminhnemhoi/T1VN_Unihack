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
    uint16  feeBps;           // tiền công; = 0 nếu !commissionMode
    uint16  reserveBps;       // quỹ dự phòng
    uint16  revealBondBps;    // cọc mở thăm, tính trên C
    uint16  capBps;           // trần lãi năm, ≤ factory.maxCapBps
    uint64  joinDeadline;
    bool    organizerIsMember;
    bytes32 label;            // tên ngắn, không ghi tên người
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
    uint16  minCoverageBps;   // 5000
    uint16  maxFeeBps;        // 300
    uint16  maxReserveBps;    // 300
    uint8   minMembers;       // 3
    uint8   maxMembers;       // 30
    uint96  maxContribution;  // 10_000 USDC trên testnet
}
```

### 2.1. Bố cục lưu trữ của `HuiCircle`

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
uint64       public pausedAt;
uint64       public pausedTotal;
uint32       public settledRounds;        // số kỳ đã chi

address[]                                  internal _members;      // theo joinIndex
mapping(address => MemberInfo)             internal _info;
mapping(uint32 => RoundInfo)               internal _rounds;
mapping(uint32 => mapping(address => Commit))    internal _commits;
mapping(uint32 => mapping(address => Shortfall)) internal _shortfalls;
mapping(uint32 => address)                 internal _leader;       // thăm dẫn đầu tạm thời
mapping(uint32 => uint32)                  internal _commitCounter;
mapping(bytes32 => bool)                   public usedAttestation;

uint256 public bondDeposited;
uint256 public bondRemaining;
uint256 public reserve;
mapping(uint32 => uint256) public feeEscrow;
uint256 public revealBondsHeld;
uint256 public totalHoldback;
mapping(address => uint256) public claimable;
uint256 public totalClaimable;
```

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
    function roundStart(uint32 k) external view returns (uint64);
    function deadline(uint32 k) external view returns (uint64);
    function roundInfo(uint32 k) external view returns (RoundInfo memory);
    function commitOf(uint32 k, address m) external view returns (Commit memory);
    function shortfallOf(uint32 k, address m) external view returns (Shortfall memory);
    function maxBid(uint32 k) external view returns (uint256);
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
2. `ReputationRegistry(admin)`.
3. Implementation `HuiCircle(forwarder)`; constructor gọi `_disableInitializers()`.
4. `HuiFactory(admin, implementation, config)`, trong đó `config.reputation` = registry.
5. `registry.setFactory(factory)`; gọi lần hai thì revert.

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
}
```

Bản `packages/sdk/src/huiMath.ts` (dùng `bigint`) và `sim/huisim/math.py` (dùng `int`) phải cho kết quả giống hệt. Test differential đối chiếu cả ba (xem 09).

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
// Mỗi phần hoàn theo thứ tự 03 mục 6.8 (payLate, repayDebt, pot người bị đóng băng, finalize):
// source = Uncovered nghĩa là trả thẳng cho người hốt kỳ đó; các source khác là hoàn quỹ dự phòng, ký quỹ, holdback.
event ShortfallRestored(uint32 indexed round, address indexed member, CoverSource source, uint256 amount);
event MemberDefaulted(address indexed member, uint32 indexed round, bool frozen);
event FeeForfeited(uint32 indexed round, uint256 amount);

event PaymentDeferred(address indexed to, uint256 amount);   // chuyển thất bại → claimable
event Claimed(address indexed to, uint256 amount);
event CircleFinalized(uint256 bondReturned, uint256 feesPaid, uint256 reserveDistributed);
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
  "circleImplementation": "0x...",
  "factory": "0x...",
  "admin": "0x...",
  "attester": "0x...",
  "relayer": "0x...",
  "deployedAt": "2026-11-11T13:00:00Z",
  "gitCommit": "abcdef1"
}
```

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
    alphaBps: number; commissionMode: boolean; feeBps: number; reserveBps: number;
    revealBondBps: number; capBps: number; joinDeadline: number;
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
- Body: `{ "circle": "0x..." }`.
- Kiểm: token Privy hợp lệ (SDK server của Privy); địa chỉ embedded wallet của user; user đã tick xác nhận đủ 18 tuổi; giới hạn một ví mỗi người và 20 yêu cầu mỗi giờ; `factory.isCircle(circle)`.
- `attestationId = keccak256(serverSecret ‖ privyUserId ‖ circle)` (không đảo ngược được, không lưu dữ liệu cá nhân).
- Trả: `{ "attestation": { member, circle, attestationId, expiry }, "signature": "0x..." }`, `expiry` = now + 1 giờ.

### 8.2. `POST /api/relay`

- Body: `{ "request": { from, to, value: "0", gas, deadline, data }, "signature": "0x..." }`.
- Kiểm, theo thứ tự:
  1. `to` là factory hoặc `factory.isCircle(to)`.
  2. Selector của `data` nằm trong danh sách cho phép:
     - Người dùng: `createCircle`, `depositBond`, `withdrawBond`, `join`, `leave`, `activate`, `commitBid`, `revealBid`, `payLate`, `repayDebt`, `claim`.
     - Hàm ai cũng gọi được, để nút "Chốt kỳ" trên web chạy không tốn gas khi keeper chậm: `settleRound`, `markDefault`, `finalize`, `cancel`.
  3. `value == 0`; `gas` ≤ 3.000.000.
  4. Rate limit 30 yêu cầu/giờ mỗi `from`.
  5. `forwarder.verify(request)` bằng `eth_call`.
  6. Mô phỏng `execute` bằng `eth_call`.
- Gửi bằng ví relayer (nạp AVAX testnet, cảnh báo khi số dư < 1 AVAX).
- Trả: `{ "txHash": "0x..." }` hoặc `{ "error": { "code", "message" } }` (mã lỗi custom error đã giải mã).

### 8.3. `GET /api/circles/[address]/so-ho?format=json|pdf`

Dựng sổ họ (mục 10) từ event. `format=pdf` trả file PDF tiếng Việt.

### 8.4. `POST /api/copilot`

- Body: `{ "messages": [{ "role": "user"|"assistant", "content": "..." }], "draft"?: CircleDraft, "circle"?: "0x..." }`. `circle` là dây đang xem, địa chỉ ví duy nhất mô hình được thấy (07, mục 3.8) và là đầu vào của `draft_ubnd_notice`. Tối đa 12 tin, 2.000 ký tự mỗi tin, 16 KB mỗi yêu cầu, 20 câu mỗi giờ mỗi IP; trả luồng NDJSON gồm các dòng `status`, `tool`, `answer` hoặc `error`.
- Trả: stream văn bản kèm kết quả tool.
- Server gọi Claude API với các tool ở mục 12. Không có tool nào ký giao dịch hay chuyển tiền.

### 8.5. `GET /api/sim/results?scenario=<id>`

Trả file JSON kết quả mô phỏng đã sinh sẵn trong `sim/outputs/` (mục 11).

---

## 9. Keeper (`apps/keeper`)

| Việc | Điều kiện | Gọi |
|---|---|---|
| Chi kỳ | dây Active, `now ≥ deadline(currentRound)`, kỳ chưa chi | `settleRound()` |
| Đánh dấu vỡ nợ | có `Shortfall` chưa `resolved` và `now > since + grace` | `markDefault(member)` |
| Kết thúc | kỳ N đã chi, qua ân hạn, không còn khoản thiếu đang trong ân hạn | `finalize()` |
| Hủy | Forming và `now > joinDeadline` | `cancel()` |
| Nhắc hụi (bonus) | 24 giờ (demo: 60 giây) trước cửa sổ commit đóng; 6 giờ trước `deadline` nếu ví không đủ số dư | gửi Telegram cho người đã đăng ký |

- Chu kỳ quét: 15 giây ở chế độ demo, 5 phút ở bản thật.
- Mọi lệnh đều idempotent: mô phỏng bằng `eth_call` trước, bỏ qua khi revert vì "đã làm".
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
| Loại | góp (`ContributionPulled`), thiếu (`ContributionShortfall`), bù (`ShortfallCovered` + nguồn), hốt (`RoundSettled`), giữ lại / nhả (`HoldbackReleased`), trả trễ (`LatePaid`), hoàn nguồn bù và trả khoản đòi (`ShortfallRestored` + nguồn), vỡ nợ (`MemberDefaulted`), trả nợ (`DebtRepaid`) |
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

## 12. Tool của Trợ lý chủ hụi (JSON Schema, dùng cho Claude API)

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
    "description": "Bảng trần tiền thăm theo từng kỳ theo NĐ 19 Điều 21 (diễn giải của HụiSafe).",
    "input_schema": { "type": "object", "properties": { "N": { "type": "integer" }, "C": { "type": "number" }, "periodDays": { "type": "integer" }, "capBps": { "type": "integer", "default": 2000 } }, "required": ["N", "C", "periodDays"] }
  },
  {
    "name": "simulate_circle",
    "description": "Tra kết quả mô phỏng gần nhất cho cấu hình (tổn thất người hốt sau, xác suất vỡ dây) ở ba thiết kế.",
    "input_schema": { "type": "object", "properties": { "N": { "type": "integer" }, "alphaBps": { "type": "integer" }, "bondRatio": { "type": "number" } }, "required": ["N", "alphaBps", "bondRatio"] }
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
  feeBps: number;
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
| `max_bid_table` | `{ "rows": [{ "k": 1, "payers": 4, "maxBid": "6.575342" }, ...] }` |
| `simulate_circle` | `{ "status": "ok", "matched": { N, alphaBps, bondRatio }, "runs": [{ "scenario", "seed", "circles", "deadDefaultHazardPerRound", "generatedAt", "results": [bản ghi `results` của 05 mục 11.2] }] }` cho mọi kịch bản đã chạy khớp đúng ba tham số (nhiều kịch bản khớp thì liệt kê hết, kèm giả định hazard); nếu chưa có thì `{ "status": "no_results" }` |
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
