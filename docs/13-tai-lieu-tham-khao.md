# Tài liệu tham khảo

## Mục đích và đọc khi nào

Danh sách nguồn cho toàn bộ bộ tài liệu HụiSafe, chia theo nhóm. Mỗi mục có tiêu đề kèm link và một dòng nói vì sao nguồn đó quan trọng. Đọc khi cần trích dẫn trong code comment, README, slide, paper, hoặc khi muốn kiểm lại một con số.

Quy ước:
- Mục không ghi chú: đã mở và kiểm tra ngày 06/11/2026.
- "(ghi chú)": lấy từ ghi chú nghiên cứu ngày 05/11/2026 trong `research_notes/`, chưa mở lại trong lần kiểm tra này.
- Ngày trong ngoặc là ngày đăng hoặc ngày cập nhật của nguồn.

## 1. Papers kinh tế học và cơ chế

### 1.1. Kinh tế học ROSCA

- [Besley, Coate & Loury (1993), "The economics of rotating savings and credit associations", AER 83(4): 792–810](https://researchonline.lse.ac.uk/id/eprint/1613): so sánh ROSCA ngẫu nhiên và đấu thăm, xét tính bền khi có vỡ nợ; nền móng lý thuyết.
- [Anderson, Baland & Moene (2009), "Enforcement in informal saving groups", JDE 90(1): 14–23](https://ideas.repec.org/a/eee/deveco/v90y2009i1p14-23.html): không có chế tài bên ngoài thì ROSCA không bền, kể cả khi loại người bỏ đóng; lý do cần ký quỹ và holdback.
- [Anderson, Baland & Moene, bản working paper (BREAD)](https://core.ac.uk/download/326258978.pdf) (ghi chú): người hốt đầu có động cơ bỏ đóng mạnh nhất; khảo sát Kibera.
- [Klonner & Rai (9/2008), "Adverse Selection in Credit Markets: Evidence from a Policy Experiment"](https://web.williams.edu/Economics/rai/adverse-08-9-1.pdf): hốt sớm vỡ nợ 2,04%, hốt muộn 0,59%; chủ hụi góp thay, thu 5–6%; trần thăm 30% gây lựa chọn bất lợi. Số liệu chính cho mô hình rủi ro ở 01 và 08.
- [Eeckhout & Munshi (2010), "Matching in Informal Financial Institutions", JEEA 8(5): 947–988](https://pmc.ncbi.nlm.nih.gov/articles/PMC3766900): trần thăm làm lãi ngầm giảm 19% → 14%, tham gia giảm 20%; căn cứ để `capBps` là tham số.
- [Koike và cộng sự (2018), "Reciprocity and exclusion in informal financial institutions", PLoS ONE 13(8): e0202878](https://doaj.org/article/eb7c80fac86348e4ba4b8034619389ad): biểu quyết loại người góp thấp có tác dụng, luật áp từ ngoài thì không; giữ lớp xã hội.
- [Baland, Guirkinger & Hartwig (2019), "Now or later?", JDE 140: 1–11](https://pure.unamur.be/ws/files/42088084/NowOrLaterNov2018.pdf): 45% người trả lời ở Benin gặp vấn đề với ROSCA; 42% thích hốt cuối.
- [Tanaka, Camerer & Nguyen (2005), "Poverty, politics, and preferences: Field experiments and survey data from Vietnam" (WP, 22/11/2005)](https://igier.unibocconi.eu/sites/default/files/media/attach/231105a.pdf): hụi đấu thăm ở miền Nam là "discount bidding"; người chơi đấu thăm kém kiên nhẫn hơn; 14 người hòa ở Châu Đốc.
- [Abebe, Eck, Ikeokwu & Taggart (2022), "An Algorithmic Introduction to Savings Circles", arXiv:2203.12486](https://arxiv.org/abs/2203.12486): cận phúc lợi tệ nhất theo thể thức đấu (giá thứ hai ≤ 3, giá thứ nhất ≤ 3e/(e − 1)); cơ sở cho câu hỏi nghiên cứu của paper.
- [Klonner, "Understanding Chit Funds: Price Determination and the Role of Auction Formats in ROSCAs" (NEUDC)](https://web.williams.edu/Economics/neudc/papers/klonner1.pdf) (ghi chú): chi tiết vận hành chit fund (bảo lãnh trước kỳ 20, đấu thăm kín và đấu công khai).
- [Kovsted & Lyk-Jensen (1999), JDE 60(1): 143–172](https://ideas.repec.org/a/eee/deveco/v60y1999i1p143-172.html) (ghi chú; chưa đọc được tóm tắt): so sánh phân bổ ngẫu nhiên và đấu thăm, nguồn gốc thuật ngữ "discount bidding".

### 1.2. ROSCA on-chain: nghiên cứu và dự án

- [Batool, Sion, Naha & Zhang (2023), "B-ROSCA: a smart contract-based selection of ROSCA communities using collateral", IEEE DAPPS 2023, tr. 7–12, doi:10.1109/DAPPS57946.2023.00011](https://espace2.etsmtl.ca/id/eprint/27898): ROSCA trên smart contract dùng ký quỹ; chưa đọc được tóm tắt (cần kiểm tra).
- [Sharma (2025), "Blockchain-driven trust evaluation and secure key agreement protocol for rotating savings and credit association", Int. J. Information Technology, doi:10.1007/s41870-025-02560-7](https://www.srmap.edu.in/?p=150822): chỉ số tin cậy mờ cho người vận hành ROSCA trên chuỗi permissioned; không xử lý vỡ nợ thành viên.
- [Muchapireyi (19/11/2025), "Trustless – Participation in ROSCA Games", Preprints.org, doi:10.20944/preprints202511.1427.v1](https://www.preprints.org/manuscript/202511.1427): ký quỹ theo xác suất vỡ nợ, thứ tự ngẫu nhiên có trọng số; chưa bình duyệt.
- [WeTrust, Trusted Lending Circles whitepaper (risk disclosure cập nhật 22/02/2017)](https://bravenewcoin.com/assets/Whitepapers/WeTrustWhitePaper.pdf): phí foreperson giữ tới cuối chu kỳ, ký quỹ token tùy chọn; tiền lệ gần nhất của "tiền công escrow".
- [WeTrust trên Product Hunt](https://www.producthunt.com/products/wetrust/launches) (ghi chú): launch tiếp theo (10/2018) là sản phẩm gây quỹ, không phải vòng hụi.
- [Esusu, ALMOND 2025 grant completion report (20/01/2026)](https://forum.celo.org/t/project-complete-esusu-almond-2025-grant-completion-report/12939): 3.370+ lượt kết nối ví nhưng 25+ người tham gia; bài học về traction.
- [Starosca, Chainlink Convergence](https://chain.link/hack-26/projects/starosca): ký quỹ N × mức góp và VRF; ví dụ thiết kế bị luật cuộc thi loại.
- [Saving Circles, ETHGlobal Buenos Aires](https://ethglobal.com/showcase/saving-circles-bmgxr): suất NFT, xổ số VRF; không mô tả xử lý bỏ đóng.
- [ROSCA-Guard, ETHGlobal New Delhi](https://ethglobal.com/showcase/rosca-guard-exm1c) (ghi chú): định danh bằng ZK, thứ tự theo lịch sử góp; không ký quỹ.
- [DL News (25/09/2023), "Crypto lender Maple ditches under-collateralised lending"](https://www.dlnews.com/articles/defi/crypto-lender-maple-ditches-under-collateralised-lending): Orthogonal vỡ nợ 36 triệu USD; Maple chuyển sang thế chấp vượt mức.
- [Protos (22/06/2026), Goldfinch defaults and 99,8% token crash](https://protos.com/goldfinch-africa-lending-dream-ends-in-defaults-and-99-8-token-crash/): lỗ hơn 18 triệu USD; "underwriting, not crypto".

### 1.3. Đấu giá kín on-chain

- [Tyagi, Arun, Freitag, Wahby, Bonneau & Mazières, "Riggs: Decentralized Sealed-Bid Auctions", ACM CCS 2023, IACR ePrint 2023/1336](https://eprint.iacr.org/2023/1336): commit-reveal bị bỏ mở thăm; timed commitment sửa lỗi này.
- [Zhang, Yeo, Estrada-Galinanes & Ford, "ZeroAuction: Zero-Deposit Sealed-bid Auction via Delayed Execution", WTSC 2024, IACR ePrint 2024/189](https://eprint.iacr.org/2024/189): liệt kê điểm yếu commit-reveal (nhiều thăm, không mở, kiểm duyệt); dùng cho bảng cạm bẫy.
- [Chin, Emura, Omote & Sato, "A Sealed-bid Auction with Fund Binding: Preventing Maximum Bidding Price Leakage", arXiv:2207.10823 (v2 13/12/2023)](https://arxiv.org/abs/2207.10823): cọc theo giá trị thăm làm lộ thăm tối đa; lý do cọc của HụiSafe cố định theo C.
- [Li, Tang, Chen & Deng (14/10/2024), "Sealed-bid Auctions on Blockchain with Timed Commitment Outsourcing", arXiv:2410.10607](https://arxiv.org/abs/2410.10607): thị trường thuê giải mã timed commitment; hướng nâng cấp sau MVP.
- [Alpos, Heimbach, Nayak & Wadhwa (12/06/2026), "Censorship-Resistant Sealed-Bid Auctions on Blockchains", arXiv:2606.14939](https://arxiv.org/abs/2606.14939): người đề xuất khối có thể kiểm duyệt thăm; lý do cửa sổ reveal dài.

### 1.4. Uy tín và tín dụng on-chain cho người chưa có tài khoản

- [Udupi và cộng sự (17/02/2025), "zScore: A Universal Decentralised Reputation System for the Blockchain Economy", arXiv:2503.05718](https://arxiv.org/abs/2503.05718): điểm uy tín ví từ hành vi on-chain; liên quan `ReputationRegistry`.
- [Mhlanga (06/02/2023), "Block chain technology for digital financial inclusion in the industry 4.0, towards sustainable development?", Frontiers in Blockchain 6: 1035405](https://frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2023.1035405/full): tổng quan blockchain cho tiết kiệm, tín dụng, bảo hiểm của người bị loại trừ tài chính.
- [Haraka, "Insights from a Reputation-Based Stablecoin Credit Pilot in Kenya" (Medium, ngày đăng không rõ)](https://medium.com/@haraka_xyz/insights-from-a-reputation-based-stablecoin-credit-pilot-in-kenya-48fd60e22bd3): thí điểm 2024 với 122 người vay trong 20 chama; số liệu tự công bố.

## 2. An toàn AI agent

- [Debenedetti và cộng sự, "Defeating Prompt Injections by Design" (CaMeL), arXiv:2503.18813 (v2 24/06/2025)](https://arxiv.org/abs/2503.18813): 77% tác vụ AgentDojo với bảo đảm an toàn chứng minh được; tách luồng điều khiển khỏi dữ liệu.
- [Shi và cộng sự, "Progent: Securing AI Agents with Privilege Control", arXiv:2504.11703 (v3 14/05/2026)](https://arxiv.org/abs/2504.11703); [bản HTML v3 có số liệu](https://arxiv.org/html/2504.11703v3): tỷ lệ tấn công thành công 39,9% → 1,0% nhờ policy tất định.
- [Karanjai và cộng sự (18/08/2026), "PACE: Policy-Attested Contract Execution for Safe AI Agents in Decentralized Finance", arXiv:2608.17220](https://arxiv.org/abs/2608.17220): intent có kiểu, bộ kiểm tra tất định, kiểm on-chain khoảng 30.000 gas; mẫu cho "đấu thăm hộ".
- [Nasr và cộng sự (10/10/2025), "The Attacker Moves Second", arXiv:2510.09023](https://arxiv.org/abs/2510.09023): vượt 12 phòng thủ với tỷ lệ trên 90%; không dựa vào lọc prompt.
- [Patlan và cộng sự, "Real AI Agents with Fake Memories: Fatal Context Manipulation Attacks on Web3 Agents", arXiv:2503.16248 (v3 09/07/2025)](https://arxiv.org/abs/2503.16248): memory injection mạnh hơn prompt injection; CrAIBench.
- [Debenedetti và cộng sự, "AgentDojo", arXiv:2406.13352](https://arxiv.org/abs/2406.13352) (ghi chú): benchmark CaMeL và Progent dùng; mẫu cho bộ eval 30 tình huống.
- [Bitcoinist (29/11/2024), Freysa bị thắng ở tin nhắn thứ 482](https://bitcoinist.com/only-in-crypto-user-outsmarts-ai-ethereum-bonanza): 13,19 ETH mất vì LLM có quyền chuyển tiền.
- [Protos (18/03/2025), aixbt mất 55,5 ETH](https://protos.com/ai-crypto-trading-agent-aixbt-hacked-for-100k) (ghi chú): sự cố hạ tầng quanh agent; nguyên nhân còn tranh cãi.
- [HodlFM (23/02/2026), Lobstar Wilde gửi nhầm token](https://news.hodlfm.io/tech/ai-bot-441k-tokens-to-user-by-mistake): nghi lỗi 6 decimals; lý do số tiền phải do hàm tất định tính.
- [OECD.AI incident 2026-05-04 (Grok và Bankrbot)](https://oecd.ai/en/incidents/2026-05-04-4a73): prompt injection bằng mã Morse chuyển 3 tỷ DRB; lỗi quyền ví của agent.

## 3. Chuẩn Ethereum/EVM

- [EIP-712: Typed structured data hashing and signing (Final)](https://eips.ethereum.org/EIPS/eip-712): `MemberAttestation`, ForwardRequest, permit.
- [ERC-2612: Permit Extension for EIP-20 Signed Approvals (Final)](https://eips.ethereum.org/EIPS/eip-2612): góp tiền bằng một chữ ký lúc vào dây; cảnh báo permit có thể bị gửi trước.
- [ERC-3009: Transfer With Authorization (Draft)](https://eips.ethereum.org/EIPS/eip-3009): `receiveWithAuthorization` chặn front-run; có trong `MockUSDC`.
- [ERC-2771: Secure Protocol for Native Meta Transactions (Final)](https://eips.ethereum.org/EIPS/eip-2771): relayer trả gas; chỉ tin forwarder cố định.
- [ERC-1167: Minimal Proxy Contract (Final)](https://eips.ethereum.org/EIPS/eip-1167): mỗi dây là một clone rẻ.
- [ERC-4626: Tokenized Vaults (Final)](https://eips.ethereum.org/EIPS/eip-4626): `MockYieldVault` (bonus); quy tắc làm tròn có lợi cho vault.
- [ERC-5192: Minimal Soulbound NFTs (Final)](https://eips.ethereum.org/EIPS/eip-5192): huy hiệu không chuyển nhượng (bonus của `ReputationRegistry`).

## 4. Công cụ và thư viện

- [Foundry, Testing](https://www.getfoundry.sh/forge/testing): fuzz 256 lần mặc định, `bound()`, `--fuzz-seed`; nền của unit và fuzz test.
- [Foundry, Invariant Testing](https://www.getfoundry.sh/guides/invariant-testing): handler, ghost variable, `targetSelector`; bắt buộc cho mọi luồng tiền.
- [Foundry, cấu hình Testing](https://www.getfoundry.sh/config/testing): mẫu `runs`, `depth` cho profile mặc định và `ci`.
- [crytic/echidna](https://github.com/crytic/echidna): fuzzer thuộc tính, chạy được dự án Foundry.
- [crytic/medusa](https://github.com/crytic/medusa): fuzzer song song, coverage-guided.
- [a16z/halmos](https://github.com/a16z/halmos): symbolic testing cho `HuiMath`.
- [crytic/slither](https://github.com/crytic/slither): phân tích tĩnh, 100 detector; cổng CI mức cao.
- [OpenZeppelin 5.x, Meta Transactions](https://docs.openzeppelin.com/contracts/5.x/api/metatx): `ERC2771Context`, `ERC2771Forwarder`, lưu ý gas của relayer.
- [OpenZeppelin 5.x, Proxy (Clones)](https://docs.openzeppelin.com/contracts/5.x/api/proxy): clone và rủi ro initialize.
- [OpenZeppelin 5.x, Cryptography](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography): `EIP712`, `SignatureChecker` (EOA và ERC-1271).
- [OpenZeppelin 5.x, ERC-20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20): `SafeERC20`, `ERC20Permit`, `ERC4626`.
- [OpenZeppelin 5.x, Utilities](https://docs.openzeppelin.com/contracts/5.x/api/utils): `Pausable`, `ReentrancyGuard`, `ReentrancyGuardTransient`, cảnh báo `Multicall`.
- [OpenZeppelin, CHANGELOG](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/CHANGELOG.md): bản mới nhất 5.7.0 (29/07/2026); `trySafeTransferFrom` có từ 5.3.0.
- [OpenZeppelin, SafeERC20.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/utils/SafeERC20.sol): hàm `try*` trả `false` thay vì revert; dùng khi kéo tiền nhiều người.
- [OpenZeppelin (07/12/2023), "Arbitrary Address Spoofing Attack: ERC2771Context Multicall Public Disclosure"](https://www.openzeppelin.com/news/arbitrary-address-spoofing-vulnerability-erc2771context-multicall-public-disclosure): căn cứ ADR-06.
- [OpenZeppelin Contracts v5.0.1 release](https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v5.0.1): bản vá Multicall nhận biết ngữ cảnh ERC-2771.
- [Gelato, ERC2771 delegatecall vulnerability](https://docs.gelato.cloud/relay/security-considerations/erc2771-delegatecall-vulnerability): giải thích cơ chế tấn công từ phía relayer.
- [Mesa trên GitHub](https://github.com/projectmesa/mesa) và [PyPI](https://pypi.org/project/Mesa/): mô phỏng tác tử bằng Python; 3.5.2 (28/10/2026) cần Python ≥ 3.12.
- [cadCAD trên GitHub](https://github.com/cadCAD-org/cadCAD) và [PyPI](https://pypi.org/project/cadCAD/): mô phỏng hệ động lực; bản cuối 0.5.3 (19/04/2024).
- [radCAD trên GitHub](https://github.com/CADLabs/radCAD) và [PyPI](https://pypi.org/project/radcad/): tương thích cadCAD, chạy song song; 0.14.0 (05/09/2024), Python < 3.13.

## 5. Avalanche

- [ACP-131: Cancun EIPs (Activated)](https://build.avax.network/docs/acps/131-cancun-eips): C-Chain có EIP-1153 (transient storage) và MCOPY; căn cứ `evm_version = "cancun"`.
- [ACP-209: EIP-7702-style account abstraction (Proposed)](https://build.avax.network/docs/acps/209-eip7702-style-account-abstraction): chưa có cài đặt mẫu; lý do không dùng EIP-7702 (ADR-03).
- [Circle, USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses): USDC Fuji `0x5425890298aed601595a70AB815c96711a31Bc65` (ADR-02).
- [Avalanche Academy, x402 facilitators](https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/03-facilitators) (ghi chú): C-Chain không nhận giao dịch EIP-7702.
- [Avalanche, Granite upgrade](https://build.avax.network/blog/granite-upgrade) (ghi chú): precompile P-256 (ACP-204) cho passkey, phần bonus.
- [Snowtrace gas tracker](https://snowtrace.io/gastracker) (ghi chú): giá gas C-Chain cho phần "vì sao Avalanche".
- [Circle, four ways to authorize USDC smart contract interactions](https://www.circle.com/es/blog/four-ways-to-authorize-usdc-smart-contract-interactions-with-circle-sdk) (ghi chú): USDC hỗ trợ `permit` và EIP-3009.

## 6. Pháp lý Việt Nam

- [Nghị định 19/2019/NĐ-CP về họ, hụi, biêu, phường (caselaw.vn)](https://caselaw.vn/van-ban-phap-luat/339092-nghi-dinh-so-19-2019-nd-cp-ngay-19-02-2019-cua-chinh-phu-ve-ho-hui-bieu-phuong): văn bản gốc của mọi ràng buộc trong code (Điều 3–25).
- [LuatVietnam, Nghị định 19/2019/NĐ-CP](https://luatvietnam.vn/tai-chinh/nghi-dinh-19-2019-nd-cp-ve-ho-hui-bieu-phuong-170756-d1.html) (ghi chú): tóm tắt và tình trạng hiệu lực.
- [Bản án 48/2024/DS-ST, TAND huyện D, Tây Ninh (26/4/2024)](https://static3.luatvietnam.vn/uploaded/LawJudgs/2024/07/31/ban-an-48-2024-ds-st-103207.pdf): ví dụ số thật của hụi bỏ thăm; kiểm chứng `maxBid`.
- [Luật Long Phan, "Chủ hụi tuyên bố vỡ hụi..." (cập nhật 16/01/2026)](https://luatlongphan.vn/?p=54121): BLDS Điều 471; BLHS Điều 174, 175; ranh giới dân sự và hình sự.
- [Luật Long Phan, tội cho vay lãi nặng (cập nhật 27/08/2026)](https://luatlongphan.vn/?p=53936): BLHS Điều 201.
- [Toàn văn Nghị quyết 05/2025/NQ-CP (chinhphu.vn)](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-5-2025-nq-cp-ve-trien-khai-thi-diem-thi-truong-tai-san-ma-hoa-tai-viet-nam-119250909184045221.htm): giao dịch, thanh toán tài sản mã hóa bằng VND; thí điểm 5 năm.
- [VietNamNet (24/07/2026), sàn quốc tế sau ngày 1/9](https://vietnamnet.vn/so-phan-cac-san-giao-dich-tai-san-ma-hoa-quoc-te-se-ra-sao-sau-ngay-1-9-2538660.html): NĐ 284/2026 có hiệu lực 01/09, phạt 30–50 triệu (Điều 9).
- [VnEconomy (18/07/2026), phạt đến 50 triệu với cá nhân giao dịch ngoài đơn vị được cấp phép](https://vneconomy.vn/phat-den-50-trieu-dong-voi-ca-nhan-giao-dich-tai-san-ma-hoa-khong-qua-don-vi-duoc-cap-phep.htm): mức phạt tổ chức 180–200 triệu; cá nhân bằng 1/2.
- [Thị trường Tài chính Tiền tệ (30/03/2026), thuế 0,1%](https://thitruongtaichinhtiente.vn/giao-dich-tai-san-ma-hoa-chinh-thuc-chiu-thue-0-1-80727.html): Thông tư 32/2026/TT-BTC.
- [Doanh nghiệp & Hội nhập (03/03/2025), dùng tiền ảo có thể bị phạt đến 100 triệu](https://doanhnghiephoinhap.vn/co-the-bi-phat-den-100-trieu-dong-hoac-truy-cuu-trach-nhiem-hinh-su-khi-su-dung-giao-dich-tien-ao-pi-97137.html): lập trường NHNN "không phải phương tiện thanh toán hợp pháp".
- [Thanh Niên (23/10/2026), khi nào có sàn tài sản mã hóa đầu tiên](https://thanhnien.vn/khi-nao-viet-nam-co-san-giao-dich-tai-san-ma-hoa-dau-tien-185261023063623604.htm): chưa sàn nào được cấp phép.
- [LuatVietnam (10/07/2025), Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://luatvietnam.vn/tin-van-ban-moi/da-co-luat-bao-ve-du-lieu-ca-nhan-2025-so-91-2025-qh15-186-102925-article.html): thông qua 26/06/2025, hiệu lực 01/01/2026.
- [hethongphapluat, Luật Bảo vệ dữ liệu cá nhân 2025](https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025.html): văn bản Điều 3, Điều 9 (đồng ý).
- [Cổng TTĐT Hà Tĩnh (05/01/2026), Luật BVDLCN có hiệu lực](https://hatinh.gov.vn/vi/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-112026): mức phạt (3 tỷ, 10 lần, 5% doanh thu).
- [LuatVietnam, Nghị định 356/2025/NĐ-CP](https://luatvietnam.vn/dan-su/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html): Điều 10 (AI), Điều 11 (blockchain: chỉ lưu dữ liệu đã khử nhận dạng hoặc giá trị băm).
- [PBGDPL Cần Thơ, danh mục dữ liệu cá nhân cơ bản và nhạy cảm](https://pbgdpl.cantho.gov.vn/quy-dinh-ve-danh-muc-du-lieu-ca-nhan-co-ban-va-danh-muc-du-lieu-ca-nhan-nhay-cam): dữ liệu tài chính, giao dịch ngân hàng là nhạy cảm.
- [LuatVietnam English, Law No. 134/2025/QH15 on Artificial Intelligence](https://english.luatvietnam.vn/law-no-134-2025-qh15-dated-december-10-2025-of-the-national-assembly-on-artificial-intelligence-422299-doc1.html): hiệu lực 01/03/2026; Điều 9, 10, 11, 15, 35.
- [hethongphapluat, Luật Giao dịch điện tử 2023, Điều 23](https://hethongphapluat.com/luat-giao-dich-dien-tu-2023/dieu-23) và [Điều 22](https://hethongphapluat.com/luat-giao-dich-dien-tu-2023/dieu-22): giá trị pháp lý của chữ ký điện tử; câu hỏi về sổ họ.
- [LuatVietnam (13/10/2021), trả lương bằng ngoại tệ](https://luatvietnam.vn/lao-dong-tien-luong/tra-luong-cho-lao-dong-nuoc-ngoai-bang-ngoai-te-562-33455-article.html): BLLĐ 2019 Điều 95 khoản 2, lương bằng VND.
- [PLO, Đoàn Luật sư TP.HCM về tư vấn pháp luật (6/2019)](https://plo.vn/doan-luat-su-tphcm-len-tieng-ve-tu-van-phap-luat-post529980.html): tư vấn pháp luật là hoạt động hành nghề của luật sư.
- [LSVN (28/11/2021), mạo danh luật sư bị phạt 30–40 triệu](https://lsvn.vn/mao-danh-luat-su-de-hanh-nghe-luat-su-bi-phat-tien-tu-30-den-40-trieu-dong1638065009-a112302.html): NĐ 82/2020 Điều 6 khoản 7 điểm e.
- [LuatVietnam, Luật Công nghiệp công nghệ số 71/2025/QH15](https://luatvietnam.vn/linh-vuc-khac/tai-luat-cong-nghiep-cong-nghe-so-2025-qh15-dinh-huong-phat-trien-cong-nghe-so-186-104584-article.html) (ghi chú): công nhận tài sản số, hiệu lực 01/01/2026.
- [Dân chủ & Pháp luật (31/10/2017), thực trạng quy định về họ](https://danchuphapluat.vn/thuc-trang-va-kien-nghi-hoan-thien-mot-so-quy-dinh-ve-ho-hui-bieu-phuong-1671.html) (ghi chú): hơn 8.000 vụ việc về họ ở 5 tỉnh, thành.

## 7. Vụ việc và báo chí

- [VietnamPlus (06/10/2026), Tây Ninh khởi tố chủ hụi dùng tài khoản ảo](https://www.vietnamplus.vn/tay-ninh-khoi-to-chu-hui-dung-tai-khoan-ao-chiem-doat-gan-500-trieu-dong-post1140315.amp): thành viên ảo trên Zalo; lý do một người một ví.
- [VOV (13/03/2025), 12 năm tù cho đối tượng mở dây hụi chiếm đoạt tài sản](https://vov.vn/phap-luat/12-nam-tu-cho-doi-tuong-mo-day-hui-khong-chiem-doat-tai-san-post1161016.vov): 157 phần hụi ảo, 36 dây.
- [Báo Pháp luật (20/09/2024), khởi tố loạt chủ hụi](https://baophapluat.vn/khoi-to-bat-tam-giam-loat-chu-hui-chiem-doat-tai-san-post526051.html): Bình Thuận hơn 100 tỷ, dây 937 người; Bắc Ninh 4,8 tỷ.
- [Tuổi Trẻ (11/09/2023), bắt chủ hụi U60 vỡ nợ](https://tuoitre.vn/bat-chu-hui-u60-vo-no-lua-dao-hon-100-nguoi-20230911201103105.htm): 19 dây, gần 9 tỷ, hơn 100 bị hại.
- [VietNamNet English (28/09/2025), HCMC rotating savings scheme collapses](https://vietnamnet.vn/en/rotating-savings-scheme-collapses-in-hcmc-victims-demand-justice-2446829.html): hứa lãi 10%/tháng, hơn 70 tỷ.
- [BBW (20/07/2025), Việt Nam tăng gấp đôi tỷ lệ tiếp cận tài chính sau 10 năm](https://bbw.vn/viet-nam-tang-gap-doi-ti-le-tiep-can-tai-chinh-sau-10-nam-53844.html): Findex 2025: 71% có tài khoản, 16% tiết kiệm chính thức, 13% vay chính thức.
- [World Bank, Global Findex Database 2025](https://www.worldbank.org/en/publication/globalfindex): báo cáo gốc; 79% người trưởng thành thế giới có tài khoản.
- [Anthony Albanese, statement on hui fraud (2007)](https://anthonyalbanese.com.au/statement-hui-fraud) (ghi chú): vụ hụi ở Sydney; bằng chứng hụi trong cộng đồng người Việt ở nước ngoài.
- [VnEconomy (02/02/2026), thanh toán không dùng tiền mặt năm 2025](https://vneconomy.vn/gia-tri-thanh-toan-khong-dung-tien-mat-nam-2025-gap-khoang-28-lan-gdp.htm) (ghi chú): QR tăng 50,94% về số lượng; nền cho chế độ VND.
- [VnEconomy English (04/09/2025), Việt Nam hạng 4 về chấp nhận crypto](https://en.vneconomy.vn/vietnam-ranks-fourth-globally-in-crypto-adoption.htm) (ghi chú): Chainalysis 2025, hạng 4/151.

## 8. Cuộc thi và nơi nộp bài

- [Team1 Vietnam UniHack 2026](https://team1vn.xyz) (ghi chú, theo LEADER_BRIEF 06/11/2026): hạn nộp 23:59 ngày 21/11/2026; thang điểm 100.
- [topics.json](https://team1vn.xyz/topics.json) (ghi chú): luật bắt buộc (không ngẫu nhiên, non-custodial, 4 điểm luật Việt Nam, 3 câu hỏi) và đề gợi ý #01 Hụi on-chain.
- [Starter code của BTC](https://team1vn.xyz/demos.html) (ghi chú): "Privy login + agent wallet" mà ADR-03 dùng.
- LEADER_BRIEF.md của trưởng nhóm (06/11/2026, tài liệu nội bộ của đội): số liệu đối thủ, lịch, hồ sơ nộp.
- [DeFi'27, 6th Workshop on Decentralized Finance tại FC 2027](https://fc27.ifca.ai/defi/): abstract 16/11/2026, bài đầy đủ 23/11/2026 (AoE), tối đa 15 trang LNCS, ẩn danh hai chiều.
- [FC 2027 Call for Papers](https://fc27.ifca.ai/cfp.html) (ghi chú): hội nghị chính 8–12/02/2027, Barbados; hạn bài chính đã qua.
