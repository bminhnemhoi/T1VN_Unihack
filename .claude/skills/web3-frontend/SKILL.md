---
name: web3-frontend
description: Mẫu code web3 cho HụiSafe - Next.js 15 App Router, Privy embedded wallet + wagmi v2 + viem v2 + TanStack Query trên Avalanche Fuji; ký EIP-2612 permit cho USDC; ký forward request ERC-2771 và luồng /api/relay; /api/attest; commit-reveal với salt lưu IndexedDB; đọc state và event của dây qua packages/sdk; keeper; quy tắc UI tiếng Việt. Dùng khi làm apps/web, apps/keeper hoặc packages/sdk.
---

# Web3 frontend cho HụiSafe

Mục đích: mẫu đúng cho ví, chữ ký, relay và đọc dữ liệu. Đọc khi làm `apps/web`, `apps/keeper`, `packages/sdk`, `packages/config`.
Tên hàm, typed data, API, view model: `docs/05-cau-truc-du-lieu-va-api.md` (mục 5, 7, 8, 9, 13). Màn hình và luồng người dùng: `docs/02-dac-ta-san-pham.md`. Luật tiền: skill `hui-protocol`.

## 1. Stack (ADR-08) và ràng buộc

- Next.js 15 App Router, TypeScript `strict`, Tailwind, shadcn/ui, wagmi v2, viem v2, TanStack Query, Privy React SDK. Mobile-first, tiếng Việt.
- Ví người dùng: Privy embedded wallet (đăng nhập Google/email), dựng từ starter "Privy login + agent wallet" của BTC. KHÔNG tự build ERC-4337, KHÔNG dùng EIP-7702 (ADR-03).
- Không tốn gas: meta-transaction ERC-2771 qua `/api/relay`; người có AVAX vẫn gọi trực tiếp được.
- ABI và địa chỉ chỉ lấy từ `packages/sdk` (sinh bằng `pnpm --filter sdk generate`) và `packages/config`. Không chép tay ABI.
- Bí mật (`RELAYER_PRIVATE_KEY`, `ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `PRIVY_APP_SECRET`, `ANTHROPIC_API_KEY`, `KEEPER_PRIVATE_KEY`) chỉ đọc trong route handler (`lib/server/*`, kiểm ở `lib/env.ts`) hoặc keeper. Chỉ `NEXT_PUBLIC_PRIVY_APP_ID` được có tiền tố `NEXT_PUBLIC_`.

## 2. Providers (Privy + wagmi)

Theo tài liệu Privy: import `createConfig` và `WagmiProvider` từ `@privy-io/wagmi` (không từ `wagmi`); `WagmiProvider` nằm trong `PrivyProvider` và `QueryClientProvider`. Cài: `pnpm --filter web add @privy-io/react-auth @privy-io/wagmi wagmi viem @tanstack/react-query` (người duyệt lệnh `add`).

Vị trí file theo docs/04 mục 4: cấu hình ở `apps/web/lib/wagmi.ts` và `apps/web/lib/privy.ts`; một client component `Providers` (dưới đây) được `app/layout.tsx` bọc quanh trang cùng `DemoModeBanner`.

```tsx
// apps/web/lib/wagmi.ts + client component Providers (gộp lại cho gọn)
'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig, WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { avalancheFuji } from 'viem/chains';

export const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  transports: { [avalancheFuji.id]: http() }, // RPC công khai mặc định của chain ở trình duyệt
});
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        defaultChain: avalancheFuji,
        supportedChains: [avalancheFuji],
        loginMethods: ['google', 'email'],
        // Dạng hiện hành theo docs.privy.io (06/11/2026); bản SDK cũ dùng embeddedWallets.createOnLogin.
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

Phía server và keeper dùng transport `fallback([http(FUJI_RPC_URL), http(FUJI_RPC_URL_FALLBACK)])` của viem (docs/04 mục 8). Không tự thêm biến `NEXT_PUBLIC_` mới; cần thì chốt tên trong docs/05 trước. Ví đang dùng: `useWallets()` (Privy) + `useSetActiveWallet()` (`@privy-io/wagmi`). Privy không hỗ trợ ngắt ví qua `useDisconnect` của wagmi; dùng `logout()` của Privy. Ví chỉ tự tạo khi đăng nhập qua modal của Privy; nếu tự dựng màn đăng nhập bằng `loginWithCode` hay `useLoginWithOAuth` thì phải gọi tạo ví thủ công sau khi đăng nhập.

## 3. Ký permit USDC (EIP-2612)

Domain đọc từ chính hợp đồng USDC lúc chạy (USDC của Circle dùng version "2"), không hard-code. `value` lấy từ `circle.requiredAllowance()` = (N−1)·(C + revealBond).

```ts
import { parseSignature } from 'viem';
const [name, version, nonce, value] = await Promise.all([
  publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'name' }),
  publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'version' }),
  publicClient.readContract({ address: USDC, abi: usdcAbi, functionName: 'nonces', args: [owner] }),
  publicClient.readContract({ address: circle, abi: huiCircleAbi, functionName: 'requiredAllowance' }),
]);
const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
const signature = await walletClient.signTypedData({
  account: owner,
  domain: { name, version, chainId: 43113, verifyingContract: USDC },
  types: permitTypes,                 // từ packages/sdk (docs/05 mục 5.2)
  primaryType: 'Permit',
  message: { owner, spender: circle, value, nonce, deadline },
});
const { r, s, v, yParity } = parseSignature(signature);
const permit = { value, deadline, v: Number(v ?? BigInt(yParity + 27)), r, s }; // struct PermitSig
```

Trên màn hình gọi là "cho phép trích tiền" (không dùng chữ permit, docs/02 mục 8): "Dây chỉ trích đúng phần góp từng kỳ, tối đa X USDC cho cả dây. Tiền vẫn nằm trong ví bạn cho đến hạn góp." Hiện số to kèm ≈ VND trước khi ký.

## 4. Attestation và relay

`/api/attest` (server, docs/05 mục 8.1): xác thực access token Privy bằng SDK server chính thức của Privy (kiểm tra tên gói hiện hành trên docs.privy.io), kiểm tick đủ 18 tuổi, một ví mỗi người, 20 yêu cầu/giờ, `factory.isCircle(circle)`; `attestationId = keccak256(ATTESTATION_ID_SECRET ‖ privyUserId ‖ circle)`; ký `MemberAttestation` bằng `ATTESTER_PRIVATE_KEY` với domain `{ name: 'HuiSafe', version: '1', chainId: 43113, verifyingContract: circle }`; `expiry = now + 1 giờ`. Không lưu, không log dữ liệu cá nhân.

Ký forward request (client), theo `ERC2771Forwarder` của OpenZeppelin 5.x:

```ts
const data = encodeFunctionData({ abi: huiCircleAbi, functionName: 'commitBid', args: [hash] });
const nonce = await publicClient.readContract({ address: FORWARDER, abi: forwarderAbi, functionName: 'nonces', args: [from] });
const request = { from, to: circle, value: 0n, gas: 500_000n, nonce,
  deadline: Math.floor(Date.now() / 1000) + 600, data };      // deadline kiểu uint48
const signature = await walletClient.signTypedData({
  account: from,
  domain: { name: 'HuiSafeForwarder', version: '1', chainId: 43113, verifyingContract: FORWARDER },
  types: forwardRequestTypes,         // docs/05 mục 5.3; đối chiếu typehash với mã OZ đã cài
  primaryType: 'ForwardRequest',
  message: request,
});
await fetch('/api/relay', { method: 'POST', body: JSON.stringify({ request: serializeBigints(request), signature }) });
```

`/api/relay` (server, docs/05 mục 8.2) kiểm THEO THỨ TỰ: `to` là factory hoặc `factory.isCircle(to)`; selector trong danh sách cho phép (người dùng: `createCircle`, `depositBond`, `withdrawBond`, `join`, `leave`, `activate`, `commitBid`, `revealBid`, `payLate`, `repayDebt`, `claim`; hàm ai cũng gọi để nút "Chốt kỳ" chạy không tốn gas khi keeper chậm: `settleRound`, `markDefault`, `finalize`, `cancel`); `value == 0`, `gas ≤ 3_000_000`; rate limit 30 yêu cầu/giờ mỗi `from`; `forwarder.verify(requestData)` bằng `eth_call`; mô phỏng `execute` bằng `eth_call`. Rồi mới gửi `execute(ForwardRequestData{from,to,value,gas,deadline,data,signature})` bằng ví relayer; cảnh báo khi relayer dưới 1 AVAX. Trả `{ txHash }` hoặc `{ error: { code, message } }` với custom error đã giải mã. Log có `requestId`, không log chữ ký đầy đủ hay token.

## 5. Bỏ thăm kín (commit-reveal)

- Salt: `crypto.getRandomValues(new Uint8Array(32))` → hex. Chỉ để giữ bí mật thăm, không dùng để chọn ai.
- Lưu IndexedDB `huisafe` / store `salts`, khóa `${circle}:${round}:${member}`, giá trị `{ bid, salt, createdAt }`; nút "Sao lưu thăm"; mọi truy cập bọc `try/catch`. Mất salt thì không mở được thăm: cảnh báo trước khi commit.
- `commitHash` = `keccak256(encodeAbiParameters([address, uint32, address, uint256, bytes32], [circle, round, member, bid, salt]))`, khớp Solidity `keccak256(abi.encode(address(this), round, member, bid, salt))`.
- Chặn ở UI: `bid ≤ maxBid(k)` và `bid < C` (đọc `maxBid(k)` từ contract); thăm sai sẽ không reveal được và mất cọc.

## 6. Đọc dữ liệu (ADR-07: không indexer riêng)

- `readCircle(client, address)` trong `packages/sdk` đọc state bằng `readContract`/`multicall` của viem (multicall đọc qua RPC là được; cái bị cấm là contract `Multicall` kết hợp `ERC2771Context`) và event bằng `getLogs`/`getContractEvents`, dựng `CircleView`.
- Lưu block deploy trong `contracts/deployments/fuji.json` hoặc config để quét log từ đó; RPC công khai có thể giới hạn khoảng block mỗi lần `getLogs` (kiểm tra lại), nên quét theo đoạn.
- TanStack Query: `queryKey` gồm địa chỉ dây và block; sau mỗi tx đợi `waitForTransactionReceipt` rồi `invalidateQueries`. Chế độ demo: poll 5 giây.

## 7. Keeper (`apps/keeper`, docs/05 mục 9)

Quét 15 giây ở demo, 5 phút bản thật. Mỗi việc (`settleRound`, `markDefault`, `finalize`, `cancel`) mô phỏng bằng `simulateContract` trước, bỏ qua khi revert vì "đã làm" (idempotent), rồi mới gửi TRỰC TIẾP (không qua relayer) bằng ví keeper riêng `KEEPER_PRIVATE_KEY` (ADR-21); gas limit = ước tính × 1,2, trần cứng 5.000.000 (docs/04 mục 7.1). Log JSON một dòng: `circle`, `round`, hành động, kết quả mô phỏng, `txHash`, `gasUsed`, lỗi đã giải mã; không log khóa. Keeper chỉ là tiện ích: ai cũng gọi được các hàm này.

## 8. Quy tắc UI tiếng Việt (nguồn: docs/02 mục 7 và 8, docs/04 mục 7.3)

- Mobile-first, bề rộng chuẩn 360 px, `lang="vi"`, một hành động chính mỗi màn hình; chuỗi giao diện ở `lib/i18n/vi.ts`.
- Chữ thân ≥ 18 px, tùy chọn "Chữ lớn" 22 px; nút ≥ 48 × 48 px; WCAG 2.2 AA (tương phản ≥ 4,5:1); không báo trạng thái chỉ bằng màu; trình đọc màn hình đọc được nút và đếm ngược; tôn trọng `prefers-reduced-motion`; không phụ thuộc hover.
- Số theo vi-VN: "288,48 USDC", "13.000.000 đ" (`Intl.NumberFormat('vi-VN')`); VND luôn ghi "quy đổi tham khảo" (tỷ giá cấu hình, mặc định 26.000). Giờ 24 giờ theo múi giờ máy trên giao diện; sổ họ ghi giờ Việt Nam. Địa chỉ rút gọn `0x12…ab`, ưu tiên biệt danh.
- Thao tác có tiền: hiện số to kèm ≈ VND trước khi ký; trạng thái chờ có chữ ("Đang gửi…").
- Câu dưới 20 chữ, lời đời thường. Màn hình chính KHÔNG dùng: gas, smart contract, on-chain, allowance, permit, commit, reveal, token, APY. Dùng: tiền giữ lại, ký quỹ, chỉ số bảo chứng, quỹ dự phòng, tiền công chủ hụi, nộp thăm kín / mở thăm, cọc mở thăm, trần thăm, cho phép trích tiền, khoản thiếu, ân hạn, vỡ nợ, đóng băng, nhận tiền, miễn phí giao dịch (bảng đầy đủ docs/02 mục 8).
- Không hứa: không "lợi nhuận", "đầu tư", "an toàn tuyệt đối", "không bao giờ mất tiền", "bảo hiểm"; nói "được bảo chứng X%". Không gọi trợ lý là "luật sư AI", không mô tả dịch vụ là "tư vấn".
- Trước khi vào dây hiện chỉ số bảo chứng tối thiểu (R = 0), ký quỹ, tiền giữ lại, trần thăm từng kỳ, lãi chậm góp.
- Cảnh báo NĐ 19 Điều 14 (giá trị một kỳ = N·C quy đổi ≥ 100 triệu VND, cách tính thận trọng; hoặc chủ hụi có ≥ 2 dây đang chạy, nên form tạo dây cảnh báo khi chủ hụi đã có ≥ 1 dây, docs/02 AC-01.4) kèm mẫu thông báo UBND (màn S15).
- `localStorage['huisafe.demoMode']` bật thì hiện nhãn "Chế độ demo" trên mọi màn hình.
- Lỗi contract: giải mã custom error (docs/05 mục 4.2) thành câu tiếng Việt, không hiện hex thô.
- Biệt danh thành viên chỉ trong localStorage của chủ hụi; không gửi server, không lên chuỗi.
- Trợ lý chủ hụi: số liệu lấy nguyên từ tool, câu về luật dẫn điều khoản, kèm câu "Đây là thông tin tham khảo, không phải tư vấn tài chính hay pháp lý" (docs/05 mục 12). Không emoji.

## 9. Không bao giờ

- Giữ khóa riêng hay bí mật ở client; log chữ ký, token, khóa.
- Để LLM ký, gửi giao dịch hay quyết định chuyển tiền.
- Hard-code ABI/địa chỉ ngoài `packages/sdk` và `packages/config`; trỏ tới chain khác Fuji.
- Dùng ngẫu nhiên cho bất kỳ quyết định nào; tự build ERC-4337 hay dùng EIP-7702.
