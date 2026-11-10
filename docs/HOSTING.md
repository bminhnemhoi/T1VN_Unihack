# Chạy HụiSafe trên một máy chủ (web + keeper)

Người đọc: người chọn nhà cung cấp. Tài liệu chưa chọn hộ; không tạo tài khoản, không trả tiền. Chỉ ghi TÊN biến, không ghi giá trị. Chuỗi: Fuji (43113). Lệnh Fuji (deploy, chia tiền, tạo dây) nằm ở `docs/DEPLOY-FUJI.md`; tài liệu này chỉ lo phần chạy dịch vụ sau đó.

## 1. Cần hai tiến trình, mỗi loại đúng MỘT bản

| Tiến trình | Lệnh | Vì sao chỉ một bản |
|---|---|---|
| Web (giao diện + `/api/relay`, `/api/relay/permit`, `/api/attest`, `/api/copilot`, sổ họ) | `pnpm --filter web start -H 127.0.0.1 -p 3000` (sau `pnpm --filter web build`) | Relay giữ hạn mức và nonce của ví relayer trong bộ nhớ (docs/05 mục 8.2). Không chạy serverless nhiều bản, không chạy hai container web cùng lúc |
| Keeper | `pnpm --filter keeper start` | Chi kỳ, `markDefault`, `finalize` cho mọi dây có ký quỹ; hai keeper chỉ tốn gas thừa (hàm nào cũng idempotent) |

Cả hai cần Node 22 và pnpm đúng bản ghi ở trường `packageManager` của `package.json` (`corepack enable`). Cài và dựng:

```bash
pnpm install --frozen-lockfile        # có sẵn allowBuilds trong pnpm-workspace.yaml: cài sạch không dừng ở ERR_PNPM_IGNORED_BUILDS
NEXT_PUBLIC_PRIVY_APP_ID=<app id công khai> NEXT_PUBLIC_HUISAFE_DEMO=true pnpm --filter web build
```

`NEXT_PUBLIC_*` được nhúng vào mã trình duyệt LÚC BUILD: đổi giá trị thì phải build lại. Hai dịch vụ đọc `contracts/deployments/fuji.json` lúc chạy (đã commit): máy chủ phải có file này (clone repo là đủ).

## 2. Biến môi trường (chỉ TÊN)

Server-only (không bao giờ đặt tiền tố `NEXT_PUBLIC_`, không đưa vào ảnh Docker, không commit):

| Biến | Dùng bởi | Ghi chú |
|---|---|---|
| `RELAYER_PRIVATE_KEY` | web | Ví relayer; cần AVAX (cảnh báo dưới 0,02, dừng gửi dưới 0,005) |
| `ATTESTER_PRIVATE_KEY` | web | Phải khớp attester trong factory, web dừng khi khởi động nếu lệch |
| `ATTESTATION_ID_SECRET` | web | Bí mật trộn vào `attestationId` |
| `PRIVY_APP_SECRET` | web | Xác minh token Privy |
| `KEEPER_PRIVATE_KEY` | keeper | Ví keeper riêng (ADR-21), cần AVAX |
| `FUJI_RPC_URL`, `FUJI_RPC_URL_FALLBACK` | web, keeper | RPC phía máy chủ; có thể chứa khóa API nên KHÔNG công khai. Bỏ trống thì dùng RPC công khai của Fuji (xem mục 6) |
| `COPILOT_PROVIDER`, `COPILOT_BASE_URL`, `COPILOT_API_KEY`, `COPILOT_MODEL` hoặc `ANTHROPIC_API_KEY` | web | Trợ lý AI; thiếu thì trợ lý trả "chưa cấu hình" và giao diện dùng chế độ máy tính. `COPILOT_DAILY_LIMIT` (tùy chọn) là trần câu hỏi mỗi ngày |
| `TRUST_PROXY` | web | `true` chỉ khi web chạy sau đúng một proxy tin cậy ghi đè `x-forwarded-for` (mục 4); để trống thì không có cổng hạn mức IP |
| `KEEPER_INTERVAL_SECONDS` | keeper | 15 khi demo, 300 cho dây thật |
| `HUISAFE_NETWORK` | web, keeper | Để trống = `fuji`; từ chối mọi RPC khác chain 43113 và URL mainnet |

Công khai (nhúng vào trình duyệt lúc build): `NEXT_PUBLIC_FUJI_RPC_URL` (tùy chọn, RPC cho phần đọc ở trình duyệt; KHÔNG chứa khóa API, mục 6), `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_HUISAFE_DEMO` (`true` hiện nhãn "Chế độ demo" và poll 10 giây). Giao diện không đọc biến nào khác từ trình duyệt.

Kiểm biến có hay chưa mà không in giá trị: `for v in RELAYER_PRIVATE_KEY ATTESTER_PRIVATE_KEY ATTESTATION_ID_SECRET PRIVY_APP_SECRET KEEPER_PRIVATE_KEY; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done`.

## 3. Privy

Trong dashboard Privy của ứng dụng, mục Allowed origins (tên mục có thể khác theo phiên bản dashboard) phải có đúng origin công khai của web (`https://<tên miền>`, không có dấu `/` cuối); thêm `http://localhost:3000` nếu còn cần dev. Thiếu origin thì đăng nhập bị Privy chặn dù web chạy tốt. `NEXT_PUBLIC_PRIVY_APP_ID` và `PRIVY_APP_SECRET` phải cùng một ứng dụng.

## 4. Đường (a): một VPS, Caddy và hai service systemd

Máy chủ Linux có Node 22, `corepack`, `git`, Caddy. Người dùng hệ thống riêng `huisafe` (không phải root). Clone repo vào `/opt/huisafe`, cài và dựng như mục 1. File biến (ngoài repo, chỉ `huisafe` đọc được): `/etc/huisafe/web.env` và `/etc/huisafe/keeper.env`, mỗi file dạng `TÊN=giá trị`, `chmod 600`.

`/etc/systemd/system/huisafe-web.service`:

```ini
[Unit]
Description=HuiSafe web (relay, attest, giao dien)
After=network-online.target
Wants=network-online.target

[Service]
User=huisafe
WorkingDirectory=/opt/huisafe
EnvironmentFile=/etc/huisafe/web.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/env pnpm --filter web start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/huisafe-keeper.service`: như trên với `EnvironmentFile=/etc/huisafe/keeper.env` và `ExecStart=/usr/bin/env pnpm --filter keeper start`.

`/etc/caddy/Caddyfile` (Caddy tự xin chứng chỉ HTTPS; mặc định bỏ `X-Forwarded-For` do client gửi và ghi địa chỉ thật, nên MỚI được đặt `TRUST_PROXY=true`):

```caddyfile
huisafe.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Bật: `systemctl daemon-reload && systemctl enable --now huisafe-web huisafe-keeper && systemctl reload caddy`. Cập nhật: `git pull && pnpm install --frozen-lockfile && pnpm --filter web build && systemctl restart huisafe-web huisafe-keeper`. Nhật ký: `journalctl -u huisafe-web -f`, `journalctl -u huisafe-keeper -f` (dòng đúng của keeper: `keeper started`, rồi `scan done circles=... failed=0`).

## 5. Đường (b): Railway hoặc Render, hai service

Cả hai chạy từ Dockerfile ở gốc repo (hoặc từ mã nguồn với Node 22): `Dockerfile` cho web, `Dockerfile.keeper` cho keeper (nền tảng cho chọn đường dẫn Dockerfile cho từng service). Tạo HAI service từ cùng repo:

| | Service `web` | Service `keeper` |
|---|---|---|
| Dockerfile | `Dockerfile` | `Dockerfile.keeper` |
| Lệnh khởi chạy | mặc định của Dockerfile (`node apps/web/server.js`, nghe cổng `PORT`, mặc định 3000) | mặc định của Dockerfile (`pnpm --filter keeper start`) |
| Số bản | đúng 1 (đừng bật autoscale, đừng bật nhiều instance) | đúng 1 |
| Cổng | 3000 (đặt `PORT` nếu nền tảng đòi) | không mở cổng; loại "worker/background" |
| Biến server-only | `RELAYER_PRIVATE_KEY`, `ATTESTER_PRIVATE_KEY`, `ATTESTATION_ID_SECRET`, `PRIVY_APP_SECRET`, `FUJI_RPC_URL` (tùy chọn), `COPILOT_*` (tùy chọn) | `KEEPER_PRIVATE_KEY`, `KEEPER_INTERVAL_SECONDS`, `FUJI_RPC_URL` (tùy chọn) |
| Biến lúc build | `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_HUISAFE_DEMO`, `NEXT_PUBLIC_FUJI_RPC_URL` (tùy chọn, không khóa API; build argument của Docker) | không cần |
| `TRUST_PROXY` | đặt `true` chỉ khi nền tảng ghi đè `x-forwarded-for` bằng địa chỉ thật của client (đọc tài liệu nhà cung cấp; Railway và Render đứng sau proxy của họ). Không chắc thì để trống | không dùng |

Chọn gói luôn bật (không ngủ khi rảnh): gói miễn phí ngủ sẽ làm keeper dừng chi kỳ và relay mất hạn mức. Đặt biến bằng trang Variables/Environment của nền tảng, không bằng file trong repo.

### Ảnh Docker (chạy thử cục bộ)

`Dockerfile` (web), `Dockerfile.keeper` và `.dockerignore` ở gốc repo. Hai ảnh riêng:

```bash
docker build -t huisafe-web --build-arg NEXT_PUBLIC_PRIVY_APP_ID=<app id công khai> .      # thêm --build-arg NEXT_PUBLIC_FUJI_RPC_URL=<RPC công khai, KHÔNG có khóa API> nếu cần
docker run --rm -p 127.0.0.1:3000:3000 -e RELAYER_PRIVATE_KEY -e ATTESTER_PRIVATE_KEY -e ATTESTATION_ID_SECRET -e PRIVY_APP_SECRET huisafe-web
docker build -f Dockerfile.keeper -t huisafe-keeper .
docker run --rm -e KEEPER_PRIVATE_KEY -e KEEPER_INTERVAL_SECONDS huisafe-keeper
```

(`-e TÊN` không kèm giá trị lấy từ môi trường của shell bạn mở lệnh.) Ảnh web dùng Next `output: 'standalone'` (bật bằng biến build `NEXT_OUTPUT=standalone`, chỉ Dockerfile đặt; `next start` thường không đổi): chỉ mang server đã gộp, tệp tĩnh và `contracts/deployments`, không có mã nguồn hay devDependencies. Đo 11/11/2026: web 435 MB (bản một ảnh cũ 7,66 GB), keeper 1,26 GB (chỉ cài keeper, `config`, `sdk` và chạy `tsx`).

Đã chạy thử cục bộ với `--network none`: ảnh web chạy bằng người dùng `node`, trang chủ, trang dây Fixed, trang mời và `/api/sim/results` trả 200; ảnh keeper khởi động tới bước kiểm cấu hình và dừng với "missing environment variable KEEPER_PRIVATE_KEY" (chưa chạy với khóa thật). Chưa kiểm API sổ hụi trong container (cần RPC; tránh gọi dồn RPC công khai, mục 6): API đó đã kiểm trên bản `next start` chạy trực tiếp ở A18. Không có bí mật nào trong ảnh: `.dockerignore` loại `.env*`, `*.pem`, `*.key`, `.handover`, `.claude`; ảnh web không mang mã nguồn.

## 6. RPC: giới hạn của RPC công khai Fuji (đo 11/11/2026)

`https://api.avax-test.network/ext/bc/C/rpc` dùng được cho vài người nhưng:

- `eth_getLogs` tối đa 100 block mỗi yêu cầu (và 100 block cho cả một lô JSON-RPC cộng lại).
- Hạn mức theo IP rất thấp: một cụm vài chục yêu cầu (hoặc khoảng 11 lời gọi `eth_call` nặng) là bị trả 429; 429 này KHÔNG kèm header CORS nên trình duyệt báo lỗi CORS thay vì 429 và trang đứng ở "Đang đọc dây từ mạng…". Hạn mức hồi sau khoảng 20 đến 30 giây.
- Vì vậy mã đọc dây đã được chỉnh (A18): sự kiện của dây lấy qua API Routescan (`https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api`, mọi khoảng block trong một yêu cầu, có CORS, có timestamp), các lời gọi đọc được gộp bằng JSON-RPC batch và Multicall3, làm mới chỉ đọc phần block mới, poll 10 giây ở chế độ demo. Quét RPC theo khúc 100 block chỉ còn là đường dự phòng khi Routescan lỗi.
- Với buổi demo đông người, dùng RPC riêng (cần người chọn nhà cung cấp). Có HAI biến, không lẫn nhau:
  - `FUJI_RPC_URL` (rồi `FUJI_RPC_URL_FALLBACK`): máy chủ (relay, attest, keeper). Có thể chứa khóa API, không bao giờ gửi tới trình duyệt.
  - `NEXT_PUBLIC_FUJI_RPC_URL` (A19): phần đọc dây chạy TRONG TRÌNH DUYỆT. Bỏ trống thì dùng RPC công khai của Fuji. Đây là biến CÔNG KHAI: Next nhúng nó vào mã trình duyệt lúc build, ai mở DevTools cũng đọc được, nên **không bao giờ đặt URL có khóa API (trong đường dẫn hay query) vào đây**: khóa lộ là bị người lạ dùng hết hạn mức và có thể bị khóa. Chỉ dùng endpoint không cần khóa hoặc khóa giới hạn theo origin/domain mà nhà cung cấp cho phép công khai, và đặt hạn mức theo domain ở phía nhà cung cấp. Giá trị phải là https (http chỉ cho localhost), không chứa `user:pass@`, không trỏ mainnet; sai một trong các điều đó thì web từ chối dựng cấu hình (lỗi khi build/khởi động). Đổi giá trị thì phải build lại.
  - Sự kiện của dây vẫn lấy qua API Routescan (một yêu cầu); biến này chỉ đổi RPC cho các lời gọi đọc trạng thái (đã gộp batch và Multicall3).

## 7. Kiểm sau khi lên

1. `bash scripts/demo-check.sh` (chỉ đọc, không cần khóa; đặt `KEEPER_ADDRESS`, `SAFE_OWNER_1..3` để kiểm đủ): không có FAIL.
2. Mở `https://<tên miền>/circles/<địa chỉ dây Fixed>`: hiện "Đã kết thúc", "Dây đã kết thúc đủ 3 kỳ" và người hốt từng kỳ; `https://<tên miền>/api/circles/<địa chỉ>/so-ho?format=json` ra JSON có dòng sự kiện.
3. Nhật ký keeper có `scan done ... failed=0`.
4. Đăng nhập thử bằng Privy từ đúng origin công khai; nếu bị chặn, kiểm mục 3.
5. Trong `journalctl`/log nền tảng không có dòng nào chứa khóa, chữ ký đầy đủ hay token.
