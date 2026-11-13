# UNIHACK 2026: TỔNG HỢP THÔNG TIN CHO LEADER (BẢN ĐÃ KIỂM CHỨNG)

> Cập nhật: 06/11/2026. Viết dựa trên việc quét trực tiếp `team1vn.xyz` (trang chủ, FAQ, `topics.json`, danh sách starter code, Builder Pass, dữ liệu công khai về thí sinh và đội), đối chiếu với `docs/MASTER_RESEARCH_REPORT.md` (do Gemini viết).
>
> **Ký hiệu độ tin cậy**
> - ✅ = lấy trực tiếp từ web chính thức, đã kiểm chứng.
> - ⚠️ = chỉ có trong report Gemini, chưa kiểm chứng được trên web chính thức. Tham khảo, đừng dựa vào để quyết định.
> - 💡 = nhận định hoặc gợi ý của người tổng hợp, không phải thông tin của BTC.

---

## 0. TÓM TẮT NHANH (đọc phần này trước)

1. ✅ **Hạn nộp: 23:59 thứ Bảy 21/11/2026 (giờ VN).** Tính từ 06/11 còn khoảng **15 ngày**.
2. ✅ Đội tối đa 3 người. Thi online, chỉ Top 10 lên chung kết offline sáng **thứ Hai 30/11** tại Greenwich Việt Nam (TP.HCM).
3. ✅ Tổng giải $3,500: **$3,000 cho Top 10** (Nhất 30tr, Nhì 20tr, Ba 11tr, 7 giải Khuyến khích 2tr/đội) và **$500 cho minigame Builder Pass** (bốc thăm 50 người, mỗi người $10).
4. ✅ **Không có giải riêng của nhà tài trợ.** MEXC Ventures tài trợ toàn bộ quỹ giải. "Săn giải nhà tài trợ" thực tế nghĩa là: (a) cả đội làm đủ 5 nhiệm vụ Builder Pass, (b) thuyết phục được giám khảo MEXC ở vòng chung kết.
5. ✅ Thang điểm 100: Kỹ thuật 25, **Tích hợp Avalanche 25**, Sáng tạo 15, Tác động 15, Pitch 10, UI/UX 10. BTC ghi rõ thang điểm "có thể còn điều chỉnh".
6. ✅ 20 đề tài chỉ là gợi ý, **được tự nghĩ ý tưởng riêng**, kể cả mang dự án có sẵn (web2 cũng được) miễn có một phần thật sự chạy trên Avalanche.
7. ✅ Luật cứng: không có yếu tố may rủi; **không nhận tiền thật của người dùng, cấm bán token cho công chúng**; tài sản người dùng phải nằm trong ví của họ; agent AI phải có hợp đồng chính sách (giới hạn chi, whitelist, nút ngắt); không lưu dữ liệu cá nhân on-chain; **dev toggle phải khai báo ngay đầu buổi pitch**; phải nói về luật Việt Nam và trả lời 3 câu: vì sao on-chain, vì sao Avalanche, tiền hoặc lãi đến từ đâu.
8. ✅ Đối thủ: 593 thí sinh, 180 đội (snapshot ngày 06/11), mới **2 đội nộp bài**. **Solidity là kỹ năng hiếm nhất** (72/593 người), AI/ML thì rất đông (212 người). Track Game ít đội nhất (7), track Agent đông nhất trong các track có tên (28).
9. 💡 Gợi ý: chọn ý tưởng **trong 1–2 ngày tới**, ưu tiên ý tưởng có gốc Việt Nam rõ ràng, smart contract chắc chắn có test, và có khả năng cho người dùng thật dùng thử trên testnet trước ngày nộp. Shortlist ở mục 13.

---

## 1. THÔNG TIN CHUNG ✅

| Mục | Nội dung |
|---|---|
| Tên | Team1 Vietnam UniHack, khẩu hiệu "30 days to build on Avalanche" |
| Tổ chức | Team1 Vietnam (cộng đồng Avalanche tại Việt Nam) |
| Nền tảng | Avalanche |
| Nhà tài trợ | MEXC Ventures (logo duy nhất trong mục Sponsor) |
| Thời gian | 2–30/11/2026 |
| Địa điểm | TP.HCM; vòng online toàn quốc |
| Phí | Miễn phí |
| Đối tượng | Sinh viên đại học tại Việt Nam, mọi ngành, không cần biết blockchain |
| Không biết code? | Vẫn tham gia được (UI/UX, Product, Business, AI, Data, Marketing, Pitching) |
| Kênh hỗ trợ | Telegram `t.me/Team1VNbuilders`, Luma `luma.com/Team1VN`, X `@Team1VN` |

⚠️ Report có nhắc các đối tác học thuật (KHXH&NV, TDTU, VNU-HCM Innovation Hub, BK Fintech Hackday). Trên web chính thức chỉ thấy: Lễ khai mạc tổ chức tại KHXH&NV, chung kết tại Greenwich, workshop khởi động với Greenwich và BK Fintech Hackday, và một giám khảo thuộc VNUHCM Innovation Hub. Không có mục "đối tác" riêng.

---

## 2. LỊCH TRÌNH ✅ (giờ Việt Nam)

| Thời gian | Sự kiện | Ghi chú |
|---|---|---|
| 13/10, 09:45 (online) | Workshop khởi động: Build on Avalanche với Greenwich | Đã qua |
| 15/10, 20:00 (online) | Workshop khởi động: Build on Avalanche với BK Fintech Hackday | Đã qua |
| **T2 02/11, 09:00–11:30** | **Lễ khai mạc** tại Hội trường Nhân Văn, ĐH KHXH&NV (ĐHQG-HCM), P. Linh Xuân | Giới thiệu Avalanche, Workshop 1 "Build Your First Avalanche dApp", công bố đề. Đã qua |
| Tuần 1 (2–8/11) | Kickoff & Learn: lập đội | Đang ở đây |
| **T4 11/11, 20:00 (online)** | Workshop "From Idea to Working MVP" | Đăng ký: `luma.com/6npfwtlu` |
| 12–15/11 | Hướng dẫn kỹ thuật | |
| **T3 17/11, 20:00 (online)** | Workshop "Ship & Scale Your dApp" | `luma.com/c0wr5w8c` |
| **T5 19/11, 20:00 (online)** | Office hours với mentor (lần 1) | `luma.com/wir0pia0` |
| **T6 20/11, 20:00 (online)** | Office hours với mentor (lần 2) | `luma.com/l35ii81l` |
| **T7 21/11, 23:59** | **HẠN NỘP BÀI** | Hệ thống khóa đúng giờ (`submitDeadline` trong API = 21/11 23:59 +07) |
| 23/11 | Công bố 10 đội vào chung kết | |
| **T2 30/11, 09:00–11:30** | **Chung kết (Final Demo Day) và trao giải** tại Hội trường tầng 3, tòa Cộng Hòa Garden, Greenwich Việt Nam, 20 Cộng Hòa, P. Bảy Hiền | Pitch trực tiếp, demo, trả lời giám khảo. Công bố luôn 50 người trúng Builder Pass. `luma.com/dar03gfl` |

💡 Office hours rơi vào 19–20/11, chỉ 1–2 ngày trước hạn. Muốn mentor góp ý có giá trị thì sản phẩm phải chạy được trước đó.

---

## 3. ĐỘI THI VÀ ĐIỀU KIỆN ✅

- Đội **tối đa 3 người**. Một người cũng được tính là một đội.
- Tên đội: tối đa 3 từ, 30 ký tự, không trùng đội khác.
- Tìm đồng đội: danh sách Participants trên web, công cụ "Teammate finder" (quẹt chọn kiểu ứng dụng hẹn hò), nhóm Telegram.
- Thi online hoàn toàn, chỉ Top 10 phải có mặt ở chung kết.
- Được dùng dự án có sẵn (bài tập lớp, dự án cá nhân, startup, kể cả web2), **miễn có một phần thật trên Avalanche**: smart contract, thanh toán, NFT, token hoặc đăng nhập bằng ví. Phần đó là thứ được chấm 25 điểm Tích hợp Avalanche.

---

## 4. GIẢI THƯỞNG ✅

### 4.1. Giải chính: $3,000, khoảng 75.000.000 VNĐ cho Top 10

| Hạng | Giải |
|---|---|
| Nhất | 30.000.000 VNĐ |
| Nhì | 20.000.000 VNĐ |
| Ba | 11.000.000 VNĐ |
| 7 giải Khuyến khích (hạng 4–10) | 2.000.000 VNĐ/đội |

### 4.2. Minigame Builder Pass: $500

- Làm **đủ 5 nhiệm vụ** để được vào danh sách bốc thăm. Thiếu một nhiệm vụ là bị loại.
- Bốc ngẫu nhiên **50 người**, mỗi người **$10**. Công bố tại chung kết 30/11.
- Mỗi người một suất, gắn với một email Google đã xác minh. Tạo tài khoản trùng hoặc khai gian là bị loại.
- Nhận thưởng qua địa chỉ ví **Avalanche C-Chain (0x...)**. Gửi nhầm địa chỉ thì không lấy lại được. BTC ghi "cách trả có thể thay đổi".

**5 nhiệm vụ** (lấy từ mã nguồn trang Builder Pass):

1. **Tham gia Avalanche Builder Hub** (`go.team1.network/vietnam-builder`, chuyển hướng tới `build.avax.network`): đăng ký sự kiện ở đó, rồi nhập email hoặc username Builder Hub vào trang Builder Pass.
2. **Vào nhóm Telegram Builders** (`t.me/Team1VNbuilders`), rồi nhập @username Telegram.
3. **Follow @Team1VN trên X**, rồi nhập @handle X.
4. **Đăng ký sự kiện trên Luma** (`luma.com/Team1VN`), rồi nhập email đã dùng.
5. **Chia sẻ thẻ Builder Pass lên mạng xã hội** (X, Facebook, LinkedIn...), rồi dán link bài đăng.

💡 Mỗi thành viên nên làm ngay, mất khoảng 15 phút/người.

⚠️ Report có nhắc các khoản đầu tư sau cuộc thi: MEXC IgniteX $25k–100k, Team1 Grants $5k–25k, văn phòng miễn phí ở VNUHCM. Web chính thức không đề cập. Muốn chắc thì hỏi BTC trên Telegram.

---

## 5. BAN GIÁM KHẢO ✅ (theo chức danh trên web)

| Giám khảo | Chức danh |
|---|---|
| Tu Nguyen | Country Lead, Team1 Vietnam |
| Kha Rostenkowski-Ngo | CEO Herond Labs; Director of Communications & Venture Builder, VNUHCM Innovation Hub |
| Dr. Le Tran Huu Phuc | Academic Head of IT Department, Greenwich Vietnam (HCMC) |
| Jenny Nguyen | Head of Marketing, Strategic Partners, MEXC Ventures |
| Tuan Tran | DevRel & Collaborator, Team1 Vietnam (chính là tài khoản GitHub `tuantqse90` duyệt repo) |
| Julley Thai | Founder & Builder, Julley Labs LLC |

💡 Cơ cấu giám khảo khá cân bằng: 2 người Team1 (kỹ thuật và hệ sinh thái), 1 giảng viên CNTT (độ chắc chắn của kỹ thuật, kiến trúc), 3 người thiên về đầu tư, startup và sản phẩm (thị trường, người dùng, mô hình kinh doanh). Anh Tuan Tran là người viết 20 đề tài và toàn bộ starter code, nên dùng đúng starter code và đúng chuẩn trong `topics.json` là cách nói chuyện "cùng ngôn ngữ" với người chấm kỹ thuật.

⚠️ Report có mô tả chi tiết "gu chấm điểm" của từng giám khảo (Jenny thích GTM và tokenomics, anh Kha muốn chạy trên Herond Browser...). Đó là suy đoán của Gemini, chưa kiểm chứng. Đặc biệt, lời khuyên "làm tokenomics để list sàn" **mâu thuẫn với luật cấm bán token cho công chúng** của BTC.

---

## 6. THANG ĐIỂM (100 ĐIỂM) ✅

| Tiêu chí | Điểm | Ý nghĩa thực tế 💡 |
|---|---|---|
| Technical Implementation | 25 | Code chạy được, kiến trúc gọn, **có test cho các luồng liên quan đến tiền** (BTC ghi trong stack: "tests are mandatory on the money paths") |
| Avalanche Integration | 25 | Chia 5 phần × 5 điểm (bên dưới) |
| Creativity & Innovation | 15 | Không chỉ làm lại y nguyên một đề tài gợi ý, có góc nhìn riêng |
| Impact & Use Case | 15 | Bài toán thật ở Việt Nam hoặc đời sống sinh viên, có người dùng rõ ràng |
| Presentation & Pitching | 10 | Slide, kể chuyện, trả lời được 3 câu bắt buộc, nói đúng về luật Việt Nam |
| UI/UX & Demo | 10 | Demo mượt, dễ hiểu; dev toggle (nếu có) phải khai báo trước |

**Chi tiết 25 điểm Avalanche Integration:**
1. Dùng Avalanche có ý nghĩa (5).
2. Có smart contract hoặc phần chạy on-chain thật (5).
3. Dùng hạ tầng Avalanche phù hợp (5).
4. Chất lượng kỹ thuật của phần tích hợp (5).
5. Thể hiện rõ giá trị khi xây trên Avalanche (5).

💡 Điểm 3 và 5 là nơi phân hơn kém: tự tạo L1 riêng, ICM/Teleporter, x402 qua facilitator trên Avalanche, hoặc lập luận rõ "vì sao phí thấp và xác nhận nhanh là bắt buộc với bài toán này". ⚠️ Report khẳng định "kiến trúc dual-chain chắc chắn ăn trọn 25/25" là không có cơ sở. Không ai bảo đảm điểm tối đa.

---

## 7. LUẬT BẮT BUỘC ✅ (dịch từ `topics.json`)

1. **Không** prediction market, phần thưởng ngẫu nhiên, loot box, xổ số, xúc xắc. Mọi phần thưởng phải **tất định**, dựa trên hành vi hoặc thời gian.
2. Chạy trên Avalanche: **L1 tự tạo, Fuji testnet hoặc C-Chain mainnet**. Trên mainnet chỉ dùng số tiền nhỏ của chính mình. **Không bao giờ nhận tiền thật của người dùng, không bán token cho công chúng dưới bất kỳ hình thức nào.**
3. Mặc định **non-custodial**: tiền của người dùng nằm trong ví hoặc smart account của họ. Chỉ gom quỹ khi đề tài yêu cầu, và phải đặt sau multisig.
4. Agent (nếu có): **bắt buộc có rule engine, LLM không bao giờ được là thứ quyết định chuyển tiền**. Mọi agent phải chạy sau một policy contract có giới hạn chi, whitelist và kill switch.
5. Dữ liệu on-chain chỉ gồm hash, thanh toán và trạng thái. **Không** dữ liệu cá nhân, âm thanh, bản ghi hội thoại, địa chỉ nhà.
6. Nếu demo dùng dev toggle (giả lập thời gian, vị trí, lãi suất) thì **phải khai báo với giám khảo ngay đầu buổi pitch**.
7. Được giả lập lãi suất. Nếu giả lập thì pitch phải nói lãi thật sẽ đến từ đâu (quỹ nhà tài trợ, cho vay blue-chip như Aave/Benqi, phí dịch vụ). **Không được dựa vào việc in thêm token.**
8. Pitch phải nói về luật Việt Nam: **tiền mã hóa không phải phương tiện thanh toán hợp pháp; lương phải trả bằng VND; tư vấn pháp lý hoặc tài chính có thu phí cần giấy phép; cổ phiếu token hóa bị chính đơn vị phát hành chặn theo khu vực.** Đội nêu đúng các giới hạn này được cộng điểm, đội phớt lờ bị trừ điểm.
9. Mọi đội phải trả lời được 3 câu: **vì sao on-chain, vì sao Avalanche, tiền hoặc lãi đến từ đâu.**

**4 bộ lọc BTC dùng khi chọn 20 đề tài** (nên dùng lại để lọc ý tưởng của đội): MVP đủ nhỏ để làm trong một cuối tuần; demo không phụ thuộc đối tác hay dữ liệu thật ngoài chuỗi; không gây rắc rối pháp lý ở Việt Nam khi pitch; là DeFi thật.

**Quy ước độ khó của BTC:** 1 = hai người làm xong trong một ngày; 5 = đội ba người có kinh nghiệm dùng trọn 48 giờ. "Required MVP" = không demo được thì coi như không nộp. "Bonus" = điểm cộng, không bắt buộc. "USDC" = USDC testnet trên Fuji hoặc USDC của mạng đội chọn.

---

## 8. HỒ SƠ NỘP BÀI ✅

Nộp trên `team1vn.xyz`: đăng nhập Google, vào trang hồ sơ, điền **Submit Project**. Thành viên nào trong đội cũng nộp được. Có thể lưu nháp, **chỉ tính khi bấm Submit**. Chỉ đội mình và BTC xem được bài nộp.

| Trường | Bắt buộc | Giới hạn | Ghi chú |
|---|---|---|---|
| Project name | ✔ | 100 ký tự | |
| What it does | ✔ | 800 ký tự | "Bài toán, cho ai, và cái gì đang chạy được hôm nay" |
| GitHub repository | ✔ | phải ở github.com | Public, hoặc private và mời `tuantqse90` làm collaborator. Hệ thống tự kiểm tra repo có public không và cảnh báo nếu không thấy |
| Pitch slides | ✔ | link https | Canva hoặc Google Slides, ai cũng xem được |
| Demo video | ✔ | link https | **2–3 phút**, mở được không cần đăng nhập |
| Live app | tùy chọn | | |
| Contract address / explorer link | tùy chọn | | `0x...` hoặc link Snowtrace |
| Anything else for the judges | tùy chọn | 800 ký tự | Link khác, tài khoản test, nên xem gì trước |

⚠️ **Giám khảo không mở được bất kỳ link nào là đội bị loại.**

💡 Nên điền đủ cả 3 trường tùy chọn. Live app và địa chỉ contract là bằng chứng nhanh nhất cho 25 điểm Tích hợp Avalanche. Trường "Anything else" nên dùng để chỉ giám khảo xem gì trước và cung cấp ví test có sẵn tiền testnet.

Repo hiện tại `github.com/bminhnemhoi/T1VN_Unihack` đang **public**.

---

## 9. HẠ TẦNG VÀ CÔNG NGHỆ ✅

### 9.1. Mạng được phép
- **L1 tự tạo** (trước gọi là subnet, chạy Subnet-EVM, có gas token và validator riêng). Tạo bằng Avalanche CLI, AvaCloud, hoặc giao diện web Builder Console (`build.avax.network/console/create-l1`).
- **Fuji testnet** (C-Chain testnet): miễn phí, dùng AVAX testnet.
- **C-Chain mainnet**: trả gas bằng AVAX thật.

### 9.2. Lấy AVAX testnet
- Faucet của BTC: `team1vn.xyz/faucet.html`, **0.05 AVAX/lần**, chỉ khi ví còn dưới 0.05 AVAX, mỗi ví một lần mỗi 24 giờ.
- Faucet của Core: `core.app/tools/testnet-faucet`, chọn Fuji (C-Chain), mã coupon **`avalanche-academy`**.
- Cả hai đều lỗi thì nhắn nhóm Telegram, BTC gửi giúp.

### 9.3. Stack BTC gợi ý

| Lớp | Gợi ý | Ghi chú của BTC |
|---|---|---|
| Smart contract | Solidity, Foundry | **bắt buộc có test cho luồng tiền** |
| Chain | L1 riêng, Fuji, C-Chain mainnet | Anvil fork mainnet hữu ích khi cần giao thức thật (Aave, Benqi...) |
| L1 riêng | Avalanche CLI hoặc AvaCloud, Subnet-EVM | một số đề tài bắt buộc |
| Liên chuỗi | ICM/Teleporter, ICTT cho token | bắt buộc với đề tài 10 và 11 |
| Frontend | Next.js, viem, wagmi | mobile-first cho các đề tài social |
| Ví | Embedded wallet SDK (Privy, Thirdweb, Web3Auth); Safe hoặc ERC-7702 cho smart account | **đừng tự build ERC-4337** |
| Agent | TypeScript hoặc Python, tool calling, rule engine | LLM không quyết định chuyển tiền |
| x402 | spec x402, facilitator có sẵn hoặc đề tài 17 | kiểm tra hỗ trợ Avalanche trước |
| Định danh agent | ERC-8004 | đề tài 16, 18 |
| Oracle | Pyth | đề tài 16 |
| Dữ liệu | Glacier API, RPC, subgraph | đề tài 13, 14 |

### 9.4. Thuật ngữ
- **ICM/Teleporter:** gửi thông điệp có xác thực giữa các L1 và C-Chain.
- **ICTT:** cầu token giữa các L1, xây trên ICM.
- **Precompile:** hàm dựng sẵn trong lõi chuỗi (ví dụ danh sách được phép deploy contract).
- **x402:** chuẩn thanh toán theo từng request HTTP. Server trả mã 402 kèm giá; client ký chuyển USDC (EIP-3009, không cần AVAX làm gas) rồi gửi lại request.

---

## 10. STARTER CODE CHÍNH THỨC ✅ (`team1vn.xyz/demos.html`)

BTC cho 11 dự án mẫu chạy được, xem code, copy file hoặc tải ZIP:

| Dự án | Cấp độ | Thời gian | Dùng để |
|---|---|---|---|
| Your first smart contract (NFT, viem, Fuji) | Cơ bản | 1–2 giờ | Compile, deploy, test một contract lên Fuji |
| Connect a wallet (Core, MetaMask, mobile) | Cơ bản | 2–3 giờ | Next.js + wagmi + WalletConnect, tự chuyển đúng mạng |
| Read and write a contract from the UI | Trung bình | 3–4 giờ | React gọi contract, chờ receipt, link Snowtrace |
| **Pay per request with x402 on Avalanche** | Trung bình | 1 giờ | API trả 402 cho tới khi trả 0.001 USDC; client tự trả và có giới hạn chi; **dùng facilitator đã chạy sẵn trên Avalanche, người mua không cần AVAX** |
| **Privy login + agent wallet** | Trung bình | 1–2 giờ | Đăng nhập Privy, ví nhúng, agent ở server ký giao dịch nhỏ dưới policy do Privy áp; chạy trên Fuji và mainnet |
| Faucet on a Cloudflare Worker | Trung bình | 1 giờ | Ký giao dịch phía server an toàn, giới hạn tần suất |
| Collect form data into Google Sheets | Cơ bản | 30 phút | Backend nhẹ nhất có thể |
| Vibe coding 1: swap app | Cơ bản | 30 phút | Claude Code dựng từ ảnh thiết kế; giá live, báo giá swap AVAX→USDC, ký bằng Core. Có kèm prompt và video |
| Vibe coding 2: Whale watch | Cơ bản | 10 phút | Một file HTML từ 3 prompt, theo dõi swap lớn |
| Google login + profiles + teams on a Worker | Nâng cao | 1–2 ngày | Chính phần đăng nhập và đội của web cuộc thi |
| NullMaps (`github.com/tuantqse90/nullmaps`) | Nâng cao | nửa ngày | Bản đồ, chỉ đường xe máy, geocoding tiếng Việt tự host bằng Docker |

✅ Report nhắc boilerplate `x402-pay-per-request` và `privy-agent-wallet`: **đã xác minh là có thật**.

💡 BTC còn công khai video Claude Code dựng app chỉ trong vài phút. Nghĩa là BTC biết và ủng hộ việc vibe coding, nên điểm khác biệt sẽ nằm ở ý tưởng, độ chắc chắn của contract và demo, không nằm ở việc viết được code.

---

## 11. 4 TRACK VÀ 20 ĐỀ TÀI GỢI Ý ✅

Không có đề 15 (đã bị BTC bỏ). Có đề 21.

### 11.1. Bảng tổng hợp

| # | Đề tài | Track | Độ khó | L1 riêng | ICM | x402 | Agent | Đội công khai đã chọn (06/11) |
|---|---|---|---|---|---|---|---|---|
| 1 | Hụi on-chain (ROSCA) | A | 2 | – | – | – | – | chưa thấy |
| 2 | Split-bill Vault | A | 2 | – | – | – | – | chưa thấy |
| 3 | Commitment Stake | A | 2 | – | – | – | – | chưa thấy |
| 4 | Allowance Vault | A | 3 | – | – | – | – | chưa thấy |
| 5 | Transparent Charity | A | 3 | Tùy chọn | – | – | – | chưa thấy |
| 6 | Quadratic Funding cho CLB | A | 3 | – | – | – | – | **2 đội** (FairFund, 43xTSD) |
| 7 | Tiết kiệm nuôi streak | A | 2 | – | – | – | – | chưa thấy |
| 8 | Streaming payroll + escrow cột mốc | A | 3 | – | – | – | – | chưa thấy |
| 9 | Vé NFT trần giá bán lại | A | 3 | – | – | – | – | chưa thấy |
| 10 | YieldGO | B | **5** | Bắt buộc | Bắt buộc | – | – | **1 đội** (Dibo, iOS) |
| 11 | DeFi Farm | B | 4 | Bắt buộc | Bắt buộc | – | – | chưa thấy |
| 12 | AI Agent Treasury + guardrail | C | 3 | – | – | – | Có | chưa thấy |
| 13 | DeFi Copilot | C | 3 (5 nếu làm precompile) | Bonus | – | – | Có | gần giống: AIC, VaultMind |
| 14 | Tx Guardian | C | 3 | – | – | – | Có | **1 đội** (BOAT); gần giống: TriCore |
| 16 | StockAgent Launchpad | D | 4 | Bonus | – | Bonus | Có | chưa thấy |
| 17 | x402 Micropayment Rails | D | 3 | – | – | Bắt buộc | – | **1 đội** |
| 18 | ActorBazaar | D | **5** | Bắt buộc (receipt) | – | Bắt buộc | Có | **1 đội** (LastDance) |
| 19 | TalkMeter | D | 3 | Bonus (receipt) | – | Bắt buộc | Có | chưa thấy |
| 20 | AskPay | D | 3 | Bắt buộc (receipt) | – | Bắt buộc | Có | gần giống: Lex (RAG luật + x402) |
| 21 | PayrollFloat | C | 4 | – | – | – | Có | **2 đội** (Type2, SqueezIT) |

Đối tượng phù hợp mỗi track theo BTC:
- **A Social finance:** đội mới, biết Solidity cơ bản, muốn pitch góc nhìn Việt Nam.
- **B Game on L1:** đội mạnh frontend, muốn khoe L1 + ICM.
- **C AI agents & security:** đội có người từng làm agent và biết tool calling.
- **D Agent economy on x402:** đội mạnh backend hoặc sản phẩm, muốn câu chuyện agent economy.

### 11.2. Chi tiết từng đề tài

Mỗi đề tài gồm: bài toán, giải pháp, **MVP bắt buộc** (không demo được là coi như không nộp), bonus và lý do chọn Avalanche theo BTC.

#### TRACK A: SOCIAL FINANCE

**1. Hụi on-chain (ROSCA)**, độ khó 2, đội 2–3 người biết Solidity cơ bản
- Bài toán: hụi phụ thuộc hoàn toàn vào uy tín chủ hụi, vỡ hụi thường xuyên, người chơi không kiểm tra được tiền.
- Giải pháp: contract giữ quỹ USDC. Mỗi kỳ một người hốt, theo lịch cố định hoặc đấu lãi (ai cần tiền sớm trả lãi cho người hốt sau). Trễ kỳ bị phạt tự động, mọi dòng tiền công khai. Chủ hụi là contract.
- MVP: tạo dây hụi (số người, số tiền mỗi kỳ, chu kỳ, kiểu chia); đóng tiền, hốt, phạt trễ, tất toán lãi đấu; dashboard trạng thái từng thành viên và lịch sử giao dịch.
- Bonus: đấu giá kín (commit-reveal), sinh lãi phần chưa giải ngân, mời bằng link, chống tài khoản ảo bằng attestation của Team1.
- Kiến trúc: RoscaFactory, Rosca (C-Chain), frontend với ví nhúng.
- Vì sao Avalanche: phí thấp nên nhóm 10–20 người đóng hằng tuần không bị phí ăn mòn; có USDC native trên C-Chain.

**2. Split-bill Vault**, độ khó 2, frontend là phần nặng nhất
- Bài toán: đi chơi, ở ghép, làm nhóm luôn có người ứng tiền rồi đi đòi hàng tuần. Splitwise chỉ ghi nợ, không giữ tiền, không tất toán.
- Giải pháp: mỗi nhóm một vault; nạp USDC, ghi chi tiêu, contract tính nợ ròng và tất toán bằng một giao dịch; số dư nhàn rỗi sinh lãi chia đều.
- MVP: tạo nhóm, mời, nạp rút; ghi chi tiêu, chia đều hoặc theo tỉ lệ, tính nợ ròng; một giao dịch tất toán cho cả nhóm, lịch sử công khai.
- Bonus: vault lãi giả lập, hash ảnh hóa đơn on-chain, tỉ lệ chia tùy chỉnh, thông báo Telegram.

**3. Commitment Stake**, độ khó 2, hoàn toàn tất định
- Bài toán: sự kiện sinh viên và meetup crypto ở Việt Nam có 40–60% người đăng ký không đến, BTC sự kiện đặt đồ ăn và chỗ ngồi theo số đăng ký nên bị lỗ.
- Giải pháp: đăng ký = đặt cọc 2–5 USDC. Check-in bằng QR do BTC sự kiện ký thì được hoàn cọc ngay. Hết sự kiện, tiền cọc của người vắng chia cho người đến hoặc vào quỹ sự kiện (chọn trước). Trong lúc chờ, cọc nằm trong vault sinh lãi.
- MVP: tạo sự kiện (mức cọc, thời gian, quy tắc xử lý tiền vắng mặt); đăng ký kèm cọc, QR check-in ký bởi BTC, hoàn tự động; chia tiền vắng mặt khi kết thúc.
- Bonus: lãi giả lập, danh sách chờ tự động, hoàn một phần nếu hủy trước 24 giờ, NFT chứng nhận tham dự.
- Stack: Solidity + Foundry, **EIP-712** cho chữ ký check-in, Next.js, ví nhúng.
- Vì sao Avalanche: hoàn tiền cho 200 người tại chỗ cần giao dịch rẻ và nhanh; **"Team1 tự tổ chức sự kiện nên có người dùng thật ngay"** (BTC tự viết câu này).

**4. Allowance Vault**, độ khó 3, nặng về Solidity streaming và policy
- Bài toán: sinh viên nhận tiền nhà hằng tháng, tiêu hết trong 10 ngày đầu; phụ huynh không có cách chia đều mà không phải kiểm soát từng đồng.
- Giải pháp: phụ huynh nạp một lần, contract stream USDC hằng tuần vào smart account của sinh viên, kèm policy hai bên đồng ý (giới hạn tuần, rút khẩn cấp có hạn, whitelist giao thức). Phần chưa stream sinh lãi, lãi về sinh viên.
- MVP: phụ huynh tạo vault, nạp, đặt lịch và policy; sinh viên nhận hằng tuần, dashboard cho cả hai; rút khẩn cấp có giới hạn và ghi lý do.
- Bonus: lãi giả lập, đổi policy cần cả hai chữ ký, báo cáo tháng, nhiều con trong một vault.
- Stack: Safe hoặc ERC-7702 cho smart account.

**5. Transparent Charity**, độ khó 3, L1 tùy chọn
- Bài toán: các vụ lùm xùm sao kê từ thiện ở Việt Nam làm mất niềm tin vào quỹ cá nhân.
- Giải pháp: quỹ là contract; nhận USDC; hội đồng multisig 3/5 duyệt từng khoản giải ngân theo cột mốc công bố trước; mỗi khoản chi có hash hóa đơn và ảnh, dashboard công khai thời gian thực; tiền chờ giải ngân sinh lãi cho quỹ.
- MVP: tạo quỹ với cột mốc và multisig; quyên góp, dashboard công khai (số dư, tiến độ, danh sách chi kèm hash); giải ngân qua multisig, khóa khi cột mốc chưa đạt.
- Bonus: lãi giả lập, nhà hảo tâm bỏ phiếu hủy cột mốc và nhận hoàn theo tỉ lệ, **ghi hóa đơn lên L1 riêng**, xuất sao kê PDF.
- Stack: Safe, Glacier API hoặc subgraph để index, IPFS cho chứng từ.

**6. Quadratic Funding cho dự án và CLB sinh viên**, độ khó 3, nặng về Solidity và toán QF
- Bài toán: quỹ CLB của trường được chia theo quan hệ hoặc ai xin to nhất.
- Giải pháp: mỗi vòng có quỹ đối ứng từ nhà tài trợ; sinh viên góp 1–5 USDC; quỹ đối ứng chia theo công thức QF (bình phương của tổng căn bậc hai các khoản góp). Chống tài khoản ảo bằng attestation.
- MVP: tạo vòng, nạp quỹ đối ứng, đăng ký dự án; góp tiền kèm attestation, tính QF on-chain hoặc off-chain kèm bằng chứng, chia khi kết thúc vòng; dashboard dự kiến đối ứng theo thời gian thực.
- ⚠️ Đã có **2 đội** công khai chọn đề này.

**7. Tiết kiệm nuôi streak**, độ khó 2
- Bài toán: sinh viên ít động lực tiết kiệm vì số tiền nhỏ và lãi ngân hàng không thấy được.
- Giải pháp: quỹ chung, mỗi người đặt lịch nạp (ví dụ 5 USDC/tuần). Gốc luôn là của mình, rút lúc nào cũng được. Lãi của quỹ chia theo điểm streak; lỡ một tuần thì streak về 0 nhưng **không bao giờ mất gốc**. BTC gọi đây là "xổ số không mất tiền đã bỏ yếu tố may rủi".
- MVP: đặt lịch, nạp đúng hạn, tính streak on-chain; nguồn lãi giả lập, chia theo trọng số streak mỗi epoch; rút gốc bất kỳ lúc nào, dashboard streak và lãi.
- Bonus: Aave/Benqi trên mainnet fork thay cho bản giả lập, huy hiệu NFT, streak nhóm bạn, nhắc qua Telegram.
- Stack: ERC-4626 cho vault nếu muốn theo chuẩn.

**8. Streaming payroll + escrow cột mốc**, độ khó 3, nặng về Solidity
- Bài toán: freelancer Việt làm cho khách nước ngoài hay bị trả trễ hoặc bị quỵt; escrow của Upwork tốn 10–20% phí.
- Giải pháp: hai chế độ. Stream (tiền chảy theo giây, dừng là dừng) và Milestone (escrow từng cột mốc, nộp hash sản phẩm, khách có 72 giờ để khiếu nại, quá hạn thì tự giải ngân, tranh chấp có trọng tài).
- MVP: contract stream (nạp, stream, claim, dừng, hoàn phần chưa stream); contract milestone (escrow, nộp hash, tự giải ngân sau thời hạn khiếu nại, tranh chấp cơ bản); dashboard hai phía có số tiền chạy theo thời gian thực.
- Tham khảo: mô hình của Sablier.
- 💡 Lưu ý luật: lương cho người làm việc ở Việt Nam phải trả bằng VND, nên nên định vị là "thanh toán dịch vụ cho freelancer từ khách nước ngoài", không phải "trả lương".

**9. Vé NFT trần giá bán lại + quỹ vé sinh lãi**, độ khó 3
- Bài toán: phe vé đẩy giá gấp 3–5 lần; BTC giữ tiền vé hàng tháng không sinh lãi; hủy show hoàn tiền chậm.
- Giải pháp: vé là NFT, chỉ được chuyển qua chợ nội bộ với giá tối đa bằng giá gốc +10%; tiền vé sinh lãi tới ngày diễn; hủy show thì tự hoàn; check-in đốt vé hoặc đánh dấu đã dùng.
- MVP: tạo sự kiện, đúc vé, mua bằng USDC; chợ bán lại có trần giá và chặn chuyển ngoài chợ; tự hoàn khi hủy, QR check-in đổi trạng thái vé.
- Stack: ERC-721 có transfer hook.

#### TRACK B: GAME ON L1

**10. YieldGO**, độ khó **5** (khó nhất), đội 3 người cần một người frontend mạnh (bản đồ) và một người làm được L1 + ICM
- Ý tưởng: đi bộ trên bản đồ thật (kiểu LootGO), rương mở ra vị thế DeFi thay vì tiền ngẫu nhiên. Có 3 loại rương tất định: Yield Chest (tự gửi một khoản nhỏ từ quỹ nhà tài trợ vào vault đứng tên người chơi), Quest Chest (nhiệm vụ DeFi nhỏ kèm hướng dẫn), Sponsor Chest (quét QR tại quán). Độ hiếm dựa trên điểm khám phá và streak, không có xúc xắc.
- Vì sao Avalanche: trạng thái game giao dịch dày đặc nên chạy trên Game L1 có gas gần bằng 0; tiền thật nằm trên C-Chain; ICM nối hai bên.
- MVP: PWA bản đồ (MapLibre) có rương quanh một khuôn viên; Game L1 tạo bằng Avalanche CLI; vault USDC trên C-Chain (lãi giả lập); một luồng ICM hai chiều; dev toggle giả lập vị trí (phải khai báo).
- ⚠️ Report xếp đây là lựa chọn số 1 và ước tính 4–6 ngày. BTC xếp độ khó 5/5, và đã có đội Dibo làm đúng đề này.

**11. DeFi Farm**, độ khó 4, game frontend là phần nặng nhất, "không có GPS nên ít rủi ro hơn đề 10"
- Ý tưởng: game nông trại. Gieo hạt = nạp USDC, cây lớn = lãi tích lũy, thu hoạch = claim, mùa vụ = thời hạn khóa (rau 1 tuần, lúa 1 tháng, cây ăn quả 3 tháng). Nhổ sớm thì mất hệ số nhân nhưng không mất gốc. Không có rơi đồ ngẫu nhiên, không có sâu bệnh ngẫu nhiên.
- Vì sao Avalanche: tưới, thu hoạch, mở đất là giao dịch dày đặc nên chạy trên Game L1; tiền nằm trên C-Chain; ICM đồng bộ.
- MVP: Game L1 (ô đất, cây, lớn theo block time); vault 3 mức khóa trên C-Chain (lãi giả lập); một luồng ICM (gieo trên L1 thì nạp trên C-Chain, thu hoạch thì claim lãi); frontend 2D dùng bộ pixel art miễn phí, dev toggle tua nhanh thời gian.
- Stack: Phaser hoặc PixiJS.

#### TRACK C: AI AGENTS & SECURITY

**12. AI Agent Treasury với guardrail on-chain**, độ khó 3, sản phẩm chính là policy bằng Solidity chứ không phải agent kiếm tiền
- Agent không giữ tiền, chỉ có session key gọi `PolicyModule` của smart account. Module kiểm tra whitelist token và giao thức, tổng chi 24 giờ, slippage, cấm gửi ra ngoài whitelist. Có kill switch. Agent tái cân bằng theo luật cố định, LLM chỉ viết giải thích.
- MVP: smart account + PolicyModule; agent theo luật tái cân bằng 2–3 token qua DEX; **demo tấn công prompt injection bị module revert**; test suite phủ mọi luồng tiền.

**13. DeFi Copilot**, độ khó 3 (5 nếu làm precompile)
- Chatbot thao tác DeFi bằng ngôn ngữ tự nhiên. Có tool đọc dữ liệu on-chain thật và tool ghi qua allowance (người dùng ký từng giao dịch). Cấm dự đoán giá. Có bộ eval tiếng Việt và tiếng Anh.
- MVP: 6–8 tool đọc, 2–3 tool ghi; chat về rủi ro danh mục, giá thanh lý, lệnh swap; bộ eval 30 ca kèm báo cáo.
- Bonus độc quyền Avalanche: precompile tùy chỉnh trên Subnet-EVM áp allowance ở tầng giao thức (cần Go).

**14. Tx Guardian**, độ khó 3, nặng về backend mô phỏng
- Mô phỏng giao dịch trên Anvil fork C-Chain, đọc state diff, rule engine gắn cờ (approve vô hạn, contract chưa verify, address poisoning, rút cạn ví, slippage bất thường), LLM giải thích bằng ngôn ngữ dễ hiểu.
- ⚠️ Đội BOAT đã công khai làm đúng đề này.

**21. PayrollFloat**, độ khó 4
- Agent sinh lãi từ quỹ lương nhàn rỗi trong tháng, rút theo bậc thang để đúng ngày lương có đủ tiền trả hàng loạt. Có policy, kill switch, multisig.
- ⚠️ Đã có **2 đội**. Ngoài ra luật Việt Nam yêu cầu lương trả bằng VND, nên pitch phải xử lý khéo.

#### TRACK D: AGENT ECONOMY ON x402

**16. StockAgent Launchpad**, độ khó 4
- Launchpad cho AI agent quản lý danh mục cổ phiếu token hóa. Agent không có token, "tốt nghiệp" dựa trên lịch sử on-chain (ERC-8004, giá Pyth, bond USDC).
- ⚠️ Rủi ro luật: cổ phiếu token hóa bị chặn theo khu vực, pitch phải nói rõ.

**17. x402 Micropayment Rails**, độ khó 3, thuần hạ tầng
- Facilitator + SDK để dev Việt thu phí theo request bằng USDC trên Avalanche.
- MVP: facilitator `/verify` và `/settle` trên Fuji; middleware server + SDK client; agent demo gọi API, nhận 402, ký, gửi lại và nhận dữ liệu.
- 💡 BTC đã có sẵn demo x402 dùng facilitator chạy trên Avalanche, nên đề này khó tạo khác biệt.

**18. ActorBazaar**, độ khó **5**
- "Apify cho agent": host và chạy scraper hoặc agent trong sandbox Docker, trả USDC theo mức dùng qua x402, receipt lên L1 riêng. Cần người backend hoặc DevOps mạnh. Đã có 1 đội.

**19. TalkMeter**, độ khó 3, nặng về sản phẩm và frontend
- Trợ lý cuộc họp tính phí theo phút qua x402: mỗi đoạn audio 60 giây là một lần trả tiền, chạm ngân sách thì tự dừng; có tóm tắt, việc cần làm và receipt on-chain. Bắt buộc có banner xin đồng ý ghi âm. Không lưu audio hay transcript on-chain, chỉ lưu hash.

**20. AskPay**, độ khó 3, nặng về backend RAG
- AI trả lời câu hỏi luật Việt Nam, trả tiền theo câu qua x402 (0.05 hoặc 0.2 USDC). Mỗi câu trả lời phải trích đúng Điều và Khoản; bộ kiểm tra trích dẫn là code thường (văn bản có tồn tại, điều khoản có thật, trích đoạn khớp ít nhất 90%, văn bản còn hiệu lực). Sai là hoàn tiền tự động. Hash của câu hỏi, câu trả lời và kết quả kiểm tra được ghi lên L1.
- MVP: kho 30 văn bản pháp luật, RAG + JSON trích dẫn + bộ kiểm tra + tự hoàn tiền + x402 hai mức + receipt on-chain + chat web.
- ⚠️ Rủi ro luật: tư vấn pháp lý có thu phí cần giấy phép. Đội Lex đang làm hướng gần giống.

---

## 12. TÌNH HÌNH ĐỐI THỦ ✅ (từ API công khai, snapshot 06/11/2026)

### 12.1. Số liệu
- **593 thí sinh, 180 đội.** Chỉ **2 đội đã bấm nộp**.
- Quy mô đội: 91 đội đủ 3 người, 37 đội 2 người, **52 đội 1 người**.
- Track các đội chọn: open/tự do **112**, agent 28, social 19, x402 14, **game 7**.
- Kỹ năng thí sinh tự khai: Backend 240, **AI/ML 212**, Frontend 197, Data 177, UI/UX 142, Product 121, Business 89, DevOps 86, **Solidity 72**, Pitching 69, Marketing 53, Mobile 52.
- Kỹ năng các đội đang tìm: AI/ML 36, Frontend 31, Backend 27, Data 27, UI/UX 24, Product 22, **Solidity 18**...
- Trường: **HCMUS chiếm 256/593**, sau đó UIT 41, HCMUT 40, Duy Tân 27, UEL 25, HUST 18, UTH 15, TDTU 14, FPT 13...
- Năm học: năm 2 nhiều nhất (197), rồi năm 3 (119), năm 4 (109), năm 1 (73).

💡 **Nhận định:**
- Thực tế ít hơn nhiều so với con số 180 đội: rất nhiều đội 1 người hoặc ghi "chưa có ý tưởng", "chỉ vào lấy tiền". Đối thủ nặng ký có lẽ vài chục đội.
- **Solidity hiếm** (12% thí sinh). Đội có contract chắc chắn, có test sẽ nổi bật ở 50 điểm Kỹ thuật + Avalanche.
- **AI đông**: rất nhiều đội làm "AI agent" chung chung. Làm AI thì phải rất khác biệt, nếu không sẽ chìm.
- **Game ít cạnh tranh nhất** (7 đội) và có trần điểm Avalanche cao nhất (L1 + ICM), nhưng rủi ro kỹ thuật cao.

### 12.2. Ý tưởng các đội đã công khai (56/180 đội có ghi mô tả)

| Hướng | Đội |
|---|---|
| PayrollFloat (đề 21) | Type2, SqueezIT |
| Quadratic Funding CLB (đề 6) | FairFund, 43xTSD |
| Tx Guardian (đề 14) | BOAT (mô phỏng trước khi ký + registry scam on-chain) |
| YieldGO (đề 10) | Dibo (iOS native) |
| ActorBazaar (đề 18) / x402 Rails (đề 17) | LastDance / 3changlinhngulam |
| RAG luật + x402 + ERC-8004 (gần đề 20) | Lex |
| AI agent DeFi, quản lý danh mục (gần đề 13) | AIC, VaultMind (AgentVault) |
| AI phát hiện gian lận, bảo mật | TriCore, NH2, T0k3n_1imited |
| AI agent payments chung chung | OpalX GO, Dream Team, Cá voi xanh |
| Xâm nhập mặn ĐBSCL (dự báo / bảo hiểm) | Tidera (SalinityShield), PEGASUS (Eywa) |
| Chứng chỉ soulbound cho sinh viên | The Pure Vessel |
| Game hướng nghiệp + credential | HUNT WITH US |
| Ký quỹ, đấu thầu, chống lừa cọc | NOBODY (TrustPact / UyTinNet) |
| Tài chính gia đình đa thế hệ | Kinetix |
| Đổi NFT ngang hàng | DeF1 (RingBarter) |
| Khác | SLA-DEX (Shadow Byte), hồ sơ y tế (GreenWich_DANANG), privacy pool (Mangekyou Labs), dữ liệu huấn luyện AI (Vtech), phân tích on-chain, giáo dục + AI |

💡 Chưa thấy đội nào công khai làm: **Hụi (1), Split-bill (2), Commitment Stake (3), Allowance (4), Charity (5), Streak savings (7), Freelancer escrow (8), Vé NFT (9), DeFi Farm (11), Agent Treasury (12), TalkMeter (19)**. Nhưng 124 đội chưa công bố gì, nên "chưa thấy" không có nghĩa là "không ai làm".

---

## 13. ĐỐI CHIẾU REPORT GEMINI VỚI WEB CHÍNH THỨC

### 13.1. Report đúng ✅
Lịch trình, địa điểm, cơ cấu giải, thang điểm và 5 phần của điểm Avalanche, hồ sơ nộp bài (kể cả giới hạn 100 và 800 ký tự), tài khoản `tuantqse90`, các luật về may rủi, non-custodial, agent và dữ liệu, 3 câu hỏi bắt buộc, link faucet và coupon, boilerplate x402 và Privy, NullMaps.

### 13.2. Report thiếu ❗
- Cấm nhận tiền thật của người dùng và **cấm bán token cho công chúng**.
- **Dev toggle phải khai báo đầu buổi pitch.** Report khuyên dùng dev toggle như "vũ khí bí mật" nhưng không nhắc phải khai báo.
- Được giả lập lãi suất nhưng phải nói nguồn lãi thật.
- Cổ phiếu token hóa bị chặn theo khu vực (một trong 4 điểm luật phải nêu).
- Bắt buộc có test cho luồng tiền.
- Thang điểm "có thể điều chỉnh".
- Đội tối đa 3 người. Danh sách 5 nhiệm vụ Builder Pass.

### 13.3. Report sai hoặc quá lạc quan ❗
- Gợi ý số 1 YieldGO, ước tính 4–6 ngày: BTC xếp độ khó 5/5, đã có đội làm.
- "Còn 3 tuần": thực tế từ 06/11 còn khoảng 15 ngày.
- "Dual-chain chắc chắn 25/25": không ai bảo đảm.
- "Tokenomics để list sàn MEXC": mâu thuẫn với luật cấm bán token.
- Số liệu cũ: 528 thí sinh và 157 đội, nay đã là 593 và 180.

### 13.4. Report có nhưng chưa kiểm chứng ⚠️
Hồ sơ chi tiết và "gu" của từng giám khảo; chương trình MEXC IgniteX $30M; các khoản đầu tư hoặc grant sau cuộc thi; lịch sử Team1 Vietnam (Hacker House Đà Nẵng, Uni Tour...); các con số thị trường trong ý tưởng mở rộng.

### 13.5. Kiểm tra nhanh các ý tưởng mở rộng trong report (Phần 8–10)

| Ý tưởng | Nhận xét 💡 |
|---|---|
| CampusQuest, UniGym, Canteen, UniLibrary | Kiến trúc L1 + ICM giống đề 10 và 11, rủi ro kỹ thuật cao. Chạy được nếu có người làm ICM |
| EcoCampus | Cần thùng rác thông minh và quỹ ESG thật, nên vướng bộ lọc "demo không phụ thuộc đối tác" |
| FairTicket, AntiScalp Pass | Chính là đề 9 |
| SkillGuild | Hay về chống "free rider", nhưng tính % đóng góp công bằng rất khó |
| RentShield | Bài toán đau thật. Rủi ro: chủ trọ thực tế khó chịu dùng crypto, nên pitch phải xử lý luật thanh toán |
| PassUni | Đơn giản, dễ demo, có tính sinh viên |
| ClassLedger | Biến thể quỹ lớp của đề 5, dễ hiểu, người dùng rõ |
| DelayGuard | Bảo hiểm cần giấy phép và cần oracle dữ liệu chuyến đi thật, rủi ro cao |
| FairSplit | Chính là đề 2 + phí phạt |
| GigLock | Chính là đề 8 |
| PagePay, UniDoc | x402 hợp lý. Rủi ro bản quyền tài liệu |
| ReviewTrust | Phức tạp, khó demo trọn vẹn |
| CodeMedic | Cần sandbox Docker. "Test pass mới trả tiền" là ý hay |
| VietData Hub | Cào dữ liệu cổng nhà nước, rủi ro pháp lý |
| RoomHunter Agent | Phụ thuộc dữ liệu phòng trọ thật |
| CitVerify, AskEdu | Kiểm tra lời giải bằng SymPy là bộ kiểm tra tất định rất thuyết phục. Không vướng giấy phép tư vấn |

---

## 14. KHUNG TÌM VÀ CHỌN Ý TƯỞNG 💡

### 14.1. Bước 1: lấy nguyên liệu (30–60 phút)
Mỗi thành viên ghi 5 chuyện "mất tiền hoặc mất niềm tin" có thật mà mình hoặc người quen từng gặp: quỹ lớp, tiền trọ, cọc, mua đồ cũ, làm freelance, chia tiền nhóm, sự kiện CLB, học phí, hụi của gia đình... Ý tưởng tốt nhất thường đến từ câu chuyện thật mà cả đội kể được trên sân khấu.

### 14.2. Bước 2: lọc loại (rớt một câu là bỏ)
1. Có yếu tố may rủi, cá cược, xổ số không?
2. Có phải nhận tiền thật của người dùng hoặc phát hành, bán token không?
3. Demo có phụ thuộc đối tác thật, phần cứng, hay dữ liệu ngoài chuỗi không giả lập được không?
4. Có đụng giấy phép (tư vấn tài chính hoặc pháp lý có thu phí, bảo hiểm, chứng khoán) mà không tránh được không?
5. Có trả lời được: vì sao on-chain (thay vì database thường), vì sao Avalanche, tiền hoặc lãi đến từ đâu?
6. Đội có làm được MVP chạy được trong khoảng 8 ngày không?

### 14.3. Bước 3: chấm điểm theo đúng thang của BTC
Mỗi ý tưởng còn lại chấm 1–5 cho từng tiêu chí, nhân trọng số:

| Tiêu chí | Trọng số | Câu hỏi |
|---|---|---|
| Kỹ thuật | 25 | Có contract đủ sâu để có test ý nghĩa không? Đội có làm chắc được không? |
| Avalanche | 25 | Dùng được L1, ICM, x402, USDC native không, hay chỉ "deploy một contract"? |
| Sáng tạo | 15 | Có khác 20 đề gợi ý và các đội đã công bố không? |
| Tác động | 15 | Người dùng là ai, có bao nhiêu người, đau đến mức nào? |
| Pitch | 10 | Có câu chuyện cảm xúc, dễ kể trong 60 giây không? |
| UI/UX & Demo | 10 | Demo 2–3 phút có thấy "wow" không? |

### 14.4. Mẹo tăng điểm áp dụng cho mọi ý tưởng
- Lấy một đề tài gợi ý làm "xương", rồi **thêm một góc Việt Nam hoặc một kết hợp mới** để ăn điểm Sáng tạo. FAQ cho phép "chọn một, kết hợp nhiều, hoặc tự nghĩ".
- **Thêm một lớp Avalanche đặc thù** nếu đủ sức: receipt lên L1 riêng (nhiều đề tài BTC coi đây là bonus), USDC native, x402 qua facilitator có sẵn.
- **Cho người dùng thật dùng thử trên Fuji** trước 21/11 (CLB, lớp, nhóm bạn), có số liệu và ảnh chụp. Đây là bằng chứng mạnh cho Tác động và cho giám khảo thiên về đầu tư. Lưu ý không nhận tiền thật.
- Viết sẵn slide "Luật Việt Nam" (4 điểm của BTC) và slide trả lời 3 câu bắt buộc.
- Có test Foundry cho mọi luồng tiền; ghi số lượng test và độ phủ vào README.

---

## 15. SHORTLIST Ý TƯỞNG GỢI Ý 💡

Đây là gợi ý của người tổng hợp để đội bàn, không phải thông tin của BTC. Thứ tự không phải xếp hạng. Chọn hướng nào phụ thuộc vào việc đội có người làm Solidity và L1/ICM hay không.

### Hướng A: an toàn, chắc tay (độ khó 2–3)

**A1. Hụi on-chain, bản "hụi sinh viên và gia đình"** (xương: đề 1)
- Vì sao hay: câu chuyện thuần Việt, giám khảo nào cũng hiểu ngay, chưa thấy đội nào công bố. Logic contract rõ ràng nên test được nhiều, ăn điểm Kỹ thuật.
- Tăng điểm: đấu lãi kín (commit-reveal), sinh lãi phần chưa giải ngân, đăng nhập bằng ví nhúng (Privy, có starter code) cho người lớn tuổi, receipt mỗi kỳ lên L1 riêng.
- Luật: ⚠️ cần kiểm tra lại văn bản về họ, hụi (người tổng hợp nhớ là Nghị định 19/2019/NĐ-CP, chưa xác minh trong lần quét này). Nêu đúng cơ sở pháp lý sẽ được cộng điểm. Kết hợp với "tiền mã hóa không phải phương tiện thanh toán": demo bằng USDC testnet.
- Rủi ro: đề gợi ý có sẵn nên điểm Sáng tạo phụ thuộc vào góc nhìn riêng.

**A2. Commitment Stake cho sự kiện sinh viên và CLB** (xương: đề 3)
- Vì sao hay: BTC tự viết rằng "Team1 tổ chức sự kiện nên có người dùng thật ngay". Có thể **chạy thử thật tại một buổi sinh hoạt CLB trước 21/11** bằng USDC testnet, có số liệu tỉ lệ check-in. Đây là bằng chứng thị trường mà rất ít đội có.
- Tăng điểm: EIP-712 check-in, danh sách chờ, NFT chứng nhận tham dự, mở rộng thành nền tảng cho mọi CLB (đúng câu "1,000 người dùng đầu tiên là ai").
- Rủi ro: kỹ thuật khá đơn giản, nên phải bù bằng độ hoàn thiện, người dùng thật và lớp Avalanche (receipt hoặc POAP trên L1).

**A3. Quỹ lớp và quỹ CLB minh bạch** (xương: đề 5 + ClassLedger trong report)
- Vì sao hay: lớp nào cũng có quỹ, ai cũng từng nghi thủ quỹ. Duyệt chi phân tầng bằng multisig (khoản nhỏ thủ quỹ chi kèm hóa đơn, khoản lớn cần vote), dashboard công khai không cần ví.
- Rủi ro: gần với Quadratic Funding cho CLB (2 đội), nhưng khác bài toán (quản lý chi chứ không phải gây quỹ). Cần làm rõ khác biệt trong pitch.

### Hướng B: chơi lớn, trần điểm Avalanche cao (độ khó 4)

**B1. DeFi Farm** (đề 11)
- Vì sao hay: track Game chỉ có 7 đội, chưa thấy ai công bố làm DeFi Farm. Bắt buộc dùng L1 riêng + ICM, đúng thứ điểm 3 và 5 của Avalanche Integration muốn thấy. Hình ảnh nông trại pixel dễ gây ấn tượng ở phần UI/Demo và Pitch. BTC tự nói đề này "ít rủi ro hơn YieldGO vì không có GPS".
- Điều kiện: phải có **một người chịu trách nhiệm L1 + ICM ngay từ ngày đầu**. Nên dựng một luồng ICM đơn giản nhất (gửi một thông điệp L1 → C-Chain) trong 2–3 ngày đầu. Không chạy được thì chuyển sang hướng A ngay.
- Rủi ro: hạ tầng L1 và ICM là chỗ dễ kẹt nhất. Tạo L1 bằng Builder Console thay vì tự dựng node.

### Hướng C: AI nhưng khác biệt (độ khó 3)

**C1. Trả tiền theo câu, có bộ kiểm tra tất định** (xương: đề 20, đổi lĩnh vực để tránh trùng Lex và tránh giấy phép tư vấn pháp lý)
- Lĩnh vực gợi ý: **quy chế học vụ của trường** (điều kiện tốt nghiệp, học bổng, cảnh báo học tập), trích dẫn đúng điều trong quy chế, hoặc **giải bài toán đại cương được kiểm tra bằng SymPy** (CitVerify trong report).
- Vì sao hay: dùng lại starter code x402 của BTC (đã có thật, facilitator chạy trên Avalanche); "sai thì hoàn tiền tự động" là câu chuyện chống ảo giác dễ hiểu; receipt lên L1 riêng.
- Rủi ro: track AI và x402 đông đội, nên demo phải cho thấy rõ cảnh hoàn tiền khi AI sai.

**Gợi ý quyết định nhanh:** đội có người Solidity nhưng không ai từng làm L1 thì chọn A1 hoặc A2. Đội có người backend hoặc AI mạnh, Solidity yếu thì chọn C1. Đội có người dám nhận phần L1/ICM và một người frontend game thì cân nhắc B1.

---

## 16. KẾ HOẠCH 15 NGÀY 💡

| Ngày | Việc |
|---|---|
| **06–07/11** | Cả đội làm Builder Pass. Đăng ký đội trên web. Chạy bộ lọc và chấm điểm ở mục 14, **chốt một ý tưởng**. Đăng ký Luma các workshop và office hours |
| 08/11 | Dựng khung dự án (Foundry + Next.js + kết nối ví với Fuji, dùng starter code BTC). Lấy AVAX testnet cho mọi ví. Viết spec ngắn: luồng người dùng, contract, màn hình |
| 09–13/11 | Làm contract + test cho luồng tiền. Làm frontend luồng chính. Deploy lên Fuji sớm. Dự workshop 11/11 |
| 14–15/11 | **Mốc MVP chạy được toàn luồng trên Fuji**. Bắt đầu cho người dùng thật dùng thử (lớp, CLB) |
| 16–18/11 | Hoàn thiện UI, xử lý lỗi, thêm bonus nếu còn thời gian. README rõ ràng. Dự workshop 17/11 |
| 19–20/11 | Office hours để mentor góp ý. Quay video demo 2–3 phút. Làm slide (3 câu bắt buộc, luật Việt Nam, khai báo dev toggle). **Nộp bài ngày 20/11** |
| 21/11 | Ngày dự phòng. Kiểm tra mọi link mở được bằng trình duyệt ẩn danh trước 23:59 |
| 23–29/11 | Nếu vào Top 10: luyện pitch, chuẩn bị trả lời phản biện, chạy thử demo offline |

---

## 17. CHECKLIST NỘP BÀI

- [ ] Repo GitHub public (hoặc private và đã mời `tuantqse90`), có README: bài toán, cách chạy, địa chỉ contract, kiến trúc, cách chạy test.
- [ ] Contract deploy trên Fuji hoặc L1 riêng, có link Snowtrace hoặc explorer.
- [ ] Test Foundry cho mọi luồng tiền, chạy pass.
- [ ] Video demo 2–3 phút, YouTube hoặc Loom công khai, mở không cần đăng nhập.
- [ ] Slide Canva hoặc Google Slides chế độ ai cũng xem được.
- [ ] Slide trả lời 3 câu: vì sao on-chain, vì sao Avalanche, tiền hoặc lãi đến từ đâu.
- [ ] Slide luật Việt Nam: tiền mã hóa không phải phương tiện thanh toán, lương trả bằng VND, tư vấn có phí cần giấy phép, cổ phiếu token hóa bị chặn theo khu vực (nêu những điểm liên quan).
- [ ] Nếu có dev toggle: ghi rõ trong video và slide đầu tiên.
- [ ] Nếu giả lập lãi: nói nguồn lãi thật.
- [ ] Không lưu dữ liệu cá nhân on-chain; không nhận tiền thật; không bán token.
- [ ] Mô tả "What it does" ≤ 800 ký tự; tên ≤ 100 ký tự.
- [ ] Điền cả Live app, Contract address và ghi chú cho giám khảo.
- [ ] Mở thử mọi link bằng trình duyệt ẩn danh.
- [ ] **Bấm Submit**, không chỉ lưu nháp.

---

## 18. LINK TÀI NGUYÊN ✅

| Tài nguyên | Link |
|---|---|
| Trang chủ, nộp bài | https://team1vn.xyz |
| 20 đề tài, luật, thang điểm (dữ liệu gốc) | https://team1vn.xyz/topics.json |
| Starter code | https://team1vn.xyz/demos.html |
| Builder Pass | https://team1vn.xyz/builderpass.html |
| Faucet BTC | https://team1vn.xyz/faucet.html |
| Faucet Core (coupon `avalanche-academy`) | https://core.app/tools/testnet-faucet |
| Tìm đồng đội | https://team1vn.xyz/finder.html |
| Tạo L1 trên web | https://build.avax.network/console/create-l1?ref=HVHXK&utm_source=team1 |
| Avalanche Builder Hub | https://go.team1.network/vietnam-builder |
| Telegram Builders | https://t.me/Team1VNbuilders |
| Luma | https://luma.com/Team1VN |
| X | https://x.com/Team1VN |
| NullMaps | https://github.com/tuantqse90/nullmaps |
| Report Gemini gốc | `docs/MASTER_RESEARCH_REPORT.md` |
