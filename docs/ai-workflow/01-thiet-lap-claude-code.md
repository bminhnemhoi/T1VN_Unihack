# Thiết lập Claude Code cho HụiSafe

**Mục đích và đọc khi nào.** File này hướng dẫn cài Claude Code, chép bộ cấu hình (CLAUDE.md, `.claude/`) vào repo `Towfienes/T1VN_Unihack`, giải thích từng file, mô hình quyền, hooks, MCP, cách làm việc hằng ngày và cách đã kiểm thử. Đọc một lần ở M0 (07/11), đọc lại khi đổi `.claude/` hoặc khi Claude làm điều lạ. Prompt theo từng mốc ở [02-prompt-playbook.md](02-prompt-playbook.md); quy trình nhánh, PR, CI ở [03-quy-trinh-lam-viec.md](03-quy-trinh-lam-viec.md).

Mọi định dạng (frontmatter, khóa settings, sự kiện hook, cờ dòng lệnh) đã đối chiếu với tài liệu chính thức tại code.claude.com/docs ngày 06/11/2026 và chạy thử với Claude Code 2.1.318 (danh sách nguồn ở mục 17). Chỗ nào chưa kiểm được thì ghi "kiểm tra lại".

---

## 1. Cài đặt và cập nhật

Cần một tài khoản Claude trả phí (Pro, Max, Team, Enterprise) hoặc tài khoản Claude Console.

```bash
# macOS, Linux, WSL (khuyên dùng)
curl -fsSL https://claude.ai/install.sh | bash

# Windows PowerShell
irm https://claude.ai/install.ps1 | iex

# Hoặc qua trình quản lý gói
brew install --cask claude-code
winget install Anthropic.ClaudeCode

# Hoặc npm (cần Node.js 22 trở lên)
npm install -g @anthropic-ai/claude-code
```

Kiểm tra và cập nhật:

```bash
claude --version    # bộ kit đã thử với 2.1.318
claude doctor       # kiểm cài đặt, settings, cấu hình lỗi
claude update       # cập nhật thủ công (bản cài native tự cập nhật)
```

Lần đầu chạy `claude` sẽ mở trình duyệt để đăng nhập.

Công cụ bộ kit cần trên máy mỗi người:

| Công cụ | Dùng cho | Ghi chú |
|---|---|---|
| `jq` | mọi hook | Thiếu cả `jq` lẫn `python3` thì hai hook bảo vệ chặn mọi thao tác (cố ý, xem mục 7) |
| `git`, `gh` | nhánh, PR, CI | `gh auth login` một lần |
| Foundry (`forge`, `cast`, `anvil`) | contracts, hook fmt/build | `curl -L https://foundry.paradigm.xyz \| bash` rồi `foundryup` |
| Node.js 22, pnpm 10 | web, sdk, keeper | phiên bản pnpm theo trường `packageManager` |
| Python 3.11+ (CI dùng 3.12) | `sim/`, Slither | `pip install slither-analyzer` |
| `shellcheck` | sửa hook | tùy chọn |

Windows: chạy Claude Code trong WSL hoặc Git Bash, vì hook là script bash.

---

## 2. Chép bộ kit vào repo

Cấu trúc bộ kit:

```text
CLAUDE.md                         luật dự án, nạp mỗi phiên (import docs/03 và docs/05)
.claude/
├── settings.json                 quyền, hooks, biến môi trường (commit)
├── hooks/
│   ├── guard-secret-files.sh     chặn đọc/ghi file bí mật và nội dung giống khóa
│   ├── guard-bash.sh             chặn broadcast ngoài Fuji, in bí mật, git add -f
│   ├── sol-fmt-build.sh          forge fmt + forge build sau khi sửa .sol
│   ├── session-start.sh          in mốc hiện tại, việc hôm nay, luật cứng
│   └── test-hooks.sh             bộ test 60 ca cho các hook
├── skills/                       hui-protocol, foundry-fuji, web3-frontend, vn-legal-pitch
├── agents/                       solidity-engineer, test-engineer, security-auditor,
│                                 frontend-engineer, simulation-analyst, pitch-writer
└── commands/                     plan-milestone, implement, audit, deploy-fuji, demo-check, sync-abi
docs/                             tài liệu 00..13 + ai-workflow/01..03
```

Chép vào repo trên một nhánh riêng (thay `<KIT>` bằng thư mục bộ kit):

```bash
git clone https://github.com/Towfienes/T1VN_Unihack.git && cd T1VN_Unihack
git switch -c chore/claude-kit
cp -r <KIT>/CLAUDE.md <KIT>/.claude <KIT>/docs .
chmod +x .claude/hooks/*.sh
bash .claude/hooks/test-hooks.sh        # phải ra "Tổng: 60 PASS, 0 FAIL"
```

Thêm vào `.gitignore` (phần còn lại của `.gitignore` theo [docs/04](../04-kien-truc.md) mục 4):

```gitignore
# Bí mật: không bao giờ commit
.env
.env.*
!.env.example
*.pem
*.key
keystore/
keystores/

# Claude Code: cấu hình cá nhân và worktree
.claude/settings.local.json
CLAUDE.local.md
.claude/worktrees/
```

Lần đầu mở `claude` ở gốc repo, Claude Code hỏi có tin thư mục này không. Phải chọn tin thì quy tắc `allow` và `env` của `.claude/settings.json` mới có hiệu lực; quy tắc `deny` và `ask` có hiệu lực ngay. Sau đó hook SessionStart in mốc hiện tại.

Biến môi trường: mỗi người tự điền `.env.local` (không commit, Claude không được đọc) rồi export trước khi mở Claude:

```bash
set -a; source .env.local; set +a
claude
```

Thiết lập riêng của từng người (model ưa dùng, quy tắc quyền cá nhân) để ở `.claude/settings.local.json` hoặc `~/.claude/settings.json`, không sửa file chung.

---

## 3. Bộ kit gồm những gì và nạp lúc nào

| Thành phần | Nạp vào ngữ cảnh khi nào | Ai gọi |
|---|---|---|
| `CLAUDE.md` + 2 file import (`docs/03`, `docs/05`) | Toàn bộ, đầu mỗi phiên và đầu mỗi subagent | Tự động |
| `.claude/settings.json` | Không vào ngữ cảnh; Claude Code đọc để xét quyền, chạy hook | Tự động |
| Hooks | Chỉ phần output (ví dụ lỗi build, thông điệp chặn) | Tự động theo sự kiện |
| Skills | Chỉ `description` nạp sẵn; nội dung `SKILL.md` nạp khi dùng | Claude tự chọn theo mô tả, hoặc người gõ `/tên-skill` |
| Subagents | Chỉ `description` nạp sẵn; subagent chạy trong ngữ cảnh riêng | Claude giao việc, hoặc người yêu cầu "Dùng subagent ..." |
| Lệnh (`.claude/commands/`) | Khi người gõ `/tên-lệnh` | Chỉ người (đặt `disable-model-invocation: true`) |

Đo bằng `claude plugin details` trên bản đóng gói plugin (mục 12): phần luôn nạp của skills, subagents và lệnh khoảng 2.700 token; mỗi lần dùng, `hui-protocol` thêm khoảng 8.100 token, `web3-frontend` 6.400, `foundry-fuji` 6.300, `vn-legal-pitch` 4.800, mỗi subagent 1.500 đến 3.400. Phần lớn chi phí cố định là `docs/03` và `docs/05` được import. Xem thực tế bằng `/context` trong phiên.

---

## 4. CLAUDE.md

- Đặt ở gốc repo, commit chung. Nội dung: tổng quan, nguồn sự thật, bản đồ monorepo, lệnh chuẩn, quy ước code, LUẬT CỨNG, bất biến tiền, quy trình, Definition of Done, bảng "khi nào dùng gì", môi trường và bí mật.
- Dòng `@docs/03-dac-ta-giao-thuc.md` và `@docs/05-cau-truc-du-lieu-va-api.md` là import: Claude Code chèn toàn bộ file đó vào đầu phiên. Đường dẫn tính từ file chứa dòng import; import lồng tối đa 4 tầng; chữ `@` nằm trong code span hay khối code thì không bị coi là import.
- Chỉ import 03 và 05 (khoảng 5.100 và 4.750 chữ) vì mọi việc đụng tiền đều cần. `docs/04` (khoảng 6.400 chữ) và `docs/11` (khoảng 4.100 chữ) quá đắt để nạp mỗi phiên, nên CLAUDE.md chỉ trỏ tới từng mục; lệnh `/plan-milestone`, `/implement` và prompt ở 02 ghi rõ mục cần đọc.
- Giữ CLAUDE.md dưới 200 dòng (hiện khoảng 135). Luật chi tiết để trong docs, không chép vào CLAUDE.md. `/memory` mở file để sửa; `/context` xem chiếm bao nhiêu token.
- Ghi chú cá nhân không chia sẻ: `~/.claude/CLAUDE.md` (mọi dự án trên máy).
- Đổi tên hoặc đánh lại số mục trong `docs/03`, `docs/05`, `docs/04`, `docs/11` thì sửa CLAUDE.md và các skill, lệnh trỏ tới trong cùng PR (03-quy-trinh mục 8).

---

## 5. `.claude/settings.json` (đầy đủ)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(forge build *)",
      "Bash(forge test *)",
      "Bash(forge fmt *)",
      "Bash(forge coverage *)",
      "Bash(forge snapshot *)",
      "Bash(forge inspect *)",
      "Bash(forge config *)",
      "Bash(forge tree *)",
      "Bash(forge script *)",
      "Bash(slither *)",
      "Bash(cast call *)",
      "Bash(cast abi-encode *)",
      "Bash(cast abi-decode *)",
      "Bash(cast calldata *)",
      "Bash(cast sig *)",
      "Bash(cast keccak *)",
      "Bash(cast chain-id *)",
      "Bash(cast block-number *)",
      "Bash(cast balance *)",
      "Bash(cast code *)",
      "Bash(cast receipt *)",
      "Bash(cast tx *)",
      "Bash(cast logs *)",
      "Bash(cast format-units *)",
      "Bash(cast parse-units *)",
      "Bash(pnpm install)",
      "Bash(pnpm install --frozen-lockfile)",
      "Bash(pnpm -r build)",
      "Bash(pnpm -r lint)",
      "Bash(pnpm -r typecheck)",
      "Bash(pnpm -r test)",
      "Bash(pnpm --filter *)",
      "Bash(python -m pytest *)",
      "Bash(python3 -m pytest *)",
      "Bash(pytest *)",
      "Bash(python -m huisim.cli *)",
      "Bash(python3 -m huisim.cli *)",
      "Bash(ruff *)",
      "Bash(mypy *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git show *)",
      "Bash(git branch *)",
      "Bash(git rev-parse *)",
      "Bash(git ls-files *)",
      "Bash(git blame *)",
      "Bash(git worktree list *)",
      "Bash(git stash list *)",
      "Bash(git fetch *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git switch *)",
      "Bash(git checkout -b *)",
      "Bash(gh pr view *)",
      "Bash(gh pr diff *)",
      "Bash(gh pr list *)",
      "Bash(gh pr checks *)",
      "Bash(gh issue view *)",
      "Bash(gh issue list *)",
      "Bash(gh run list *)",
      "Bash(gh run view *)",
      "Bash(jq *)",
      "Bash(shellcheck *)"
    ],
    "ask": [
      "Bash(forge script *--broadcast*)",
      "Bash(forge script *--resume*)",
      "Bash(forge create *)",
      "Bash(forge verify-contract *)",
      "Bash(cast send *)",
      "Bash(cast publish *)",
      "Bash(cast wallet *)",
      "Bash(git push *)",
      "Bash(git reset --hard *)",
      "Bash(git clean *)",
      "Bash(git rebase *)",
      "Bash(gh pr create *)",
      "Bash(gh pr merge *)",
      "Bash(pnpm add *)",
      "Bash(pnpm remove *)",
      "Bash(pnpm dlx *)",
      "Bash(pnpm exec *)",
      "Bash(pnpm --filter * add *)",
      "Bash(pnpm --filter * exec *)",
      "Bash(pnpm *deploy*)",
      "Bash(npx *)",
      "Bash(pip install *)",
      "Bash(python -m pip install *)",
      "Bash(python3 -m pip install *)",
      "Bash(curl *)",
      "Bash(wget *)"
    ],
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(!.env.example)",
      "Read(*.pem)",
      "Read(*.key)",
      "Read(keystore/**)",
      "Read(keystores/**)",
      "Read(~/.foundry/keystores/**)",
      "Read(~/.ssh/**)",
      "Edit(.env)",
      "Edit(.env.*)",
      "Edit(!.env.example)",
      "Bash(rm -rf *)",
      "Bash(rm -fr *)",
      "Bash(sudo *)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(printenv *)",
      "Bash(forge script *api.avax.network*)",
      "Bash(forge script *--rpc-url avalanche*)",
      "Bash(forge script *--rpc-url mainnet*)",
      "Bash(forge script *43114*)",
      "Bash(forge create *api.avax.network*)",
      "Bash(forge create *43114*)",
      "Bash(cast send *api.avax.network*)",
      "Bash(cast send *--rpc-url avalanche*)",
      "Bash(cast send *43114*)"
    ],
    "disableBypassPermissionsMode": "disable"
  },
  "env": {
    "NEXT_TELEMETRY_DISABLED": "1"
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-start.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-secret-files.sh",
            "timeout": 15
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-bash.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/sol-fmt-build.sh",
            "timeout": 300,
            "statusMessage": "forge fmt + forge build..."
          }
        ]
      }
    ]
  }
}
```

Giải thích:

- `$schema`: để editor gợi ý và báo sai khóa.
- `permissions.allow`: lệnh build, test, đọc, git đọc, `gh` đọc, `cast` chỉ đọc, `forge script` mô phỏng (không có `--broadcast`). Các lệnh này chạy không hỏi.
- `permissions.ask`: mọi thứ tốn AVAX testnet hoặc ra ngoài máy: `forge script ... --broadcast`, `forge create`, `forge verify-contract`, `cast send`, `cast wallet`, `git push`, `git reset --hard`, mở hay merge PR, thêm gói (`pnpm add`, `pip install`, `npx`), `curl`, `wget`. Claude phải hỏi, người đọc lệnh rồi mới duyệt.
- `permissions.deny`: đọc hay sửa `.env*` (trừ `.env.example`), `*.pem`, `*.key`, keystore, `~/.ssh`; `rm -rf`, `sudo`, `git push --force`, `printenv`; `forge script`, `forge create`, `cast send` với RPC mainnet, alias `avalanche`/`mainnet` hay chain 43114.
- `disableBypassPermissionsMode: "disable"`: không ai bật được chế độ bỏ qua quyền trong repo này.
- `env`: biến môi trường cho mọi lệnh Claude chạy (ở đây chỉ tắt telemetry của Next.js). Không đặt bí mật ở đây vì file được commit.
- `hooks`: đăng ký 4 hook ở mục 7. Đường dẫn dùng `"$CLAUDE_PROJECT_DIR"` nên chạy đúng dù Claude đang ở thư mục con.

Phạm vi và thứ tự ưu tiên: managed (do tổ chức cài) > tham số dòng lệnh > `.claude/settings.local.json` (cá nhân, không commit) > `.claude/settings.json` (dự án, commit) > `~/.claude/settings.json` (cá nhân, mọi dự án). Danh sách quyền ở các phạm vi được gộp lại, không ghi đè nhau.

Cách đã kiểm: `python3 -m json.tool .claude/settings.json`, `jq . .claude/settings.json`, và `claude doctor` với một cấu hình tạm đã tin thư mục: không cảnh báo nào.

---

## 6. Mô hình quyền

- **Thứ tự xét:** `deny` trước, rồi `ask`, rồi `allow`; quy tắc đầu tiên khớp quyết định. Không khớp gì thì theo chế độ quyền (mặc định là hỏi).
- **Cú pháp Bash:** `Bash(forge test *)` khớp `forge test` và mọi tham số sau nó; dấu cách trước `*` là ranh giới từ (nên `Bash(ls *)` không khớp `lsof`). Lệnh ghép (`&&`, `;`, `|`) được tách, từng lệnh con phải được phép.
- **Quy tắc Bash không phải ranh giới an toàn tuyệt đối** (tài liệu chính thức nói rõ): lệnh có thể viết theo nhiều cách. Vì vậy bộ kit có thêm lớp hook (mục 7), và lớp thật sự là: chỉ ví testnet nạp tối thiểu, không có khóa mainnet trên máy, người đọc kỹ lệnh `ask`, review PR.
- **Quy tắc file:** `Read(...)` và `Edit(...)` dùng mẫu kiểu gitignore: tên trần (`.env`) khớp ở mọi độ sâu; `~/` là thư mục nhà; `//` là đường dẫn tuyệt đối; `/` tính từ thư mục chứa file settings. Dấu `!` trong danh sách deny tạo ngoại lệ (`Read(!.env.example)`). Chặn `Read` một file cũng chặn Edit, Write và các lệnh Bash đọc file đó (`cat`, `head`, `tail`, `sed`, `tee`, chuyển hướng). Quy tắc `Write(...)` không bao giờ khớp: muốn chặn ghi thì dùng `Edit(...)`.
- **Chế độ quyền** (Shift+Tab đổi vòng giữa hỏi trước, tự nhận sửa file, plan; hoặc `--permission-mode`): `manual` (mặc định, hỏi trước), `acceptEdits` (tự nhận sửa file, lệnh vẫn theo quy tắc), `plan` (chỉ đọc và lập kế hoạch), `auto` (bộ phân loại tự duyệt), `dontAsk` (từ chối mọi thứ chưa được cho phép), `bypassPermissions` (bị tắt trong repo này). File trong `.git/`, `.claude/`, `.mcp.json` luôn hỏi lại kể cả khi tự nhận sửa file.
- **"Yes, don't ask again"** lưu quy tắc vào `.claude/settings.local.json` của người đó; không vượt được quy tắc `ask` hay `deny` của dự án.
- **Thư mục chưa tin:** quy tắc `allow` và `env` của dự án chưa có hiệu lực; `claude -p` trong thư mục chưa tin cũng bỏ qua `allow` của dự án (mục 15).
- Xem quy tắc đang áp dụng: `/permissions`.

Khuyến nghị: làm contracts ở `manual` hoặc `acceptEdits` sau khi đã duyệt plan; không dùng `auto` cho `contracts/` và luồng tiền.

---

## 7. Hooks

| Sự kiện | Matcher | Script | Việc | Chặn được? |
|---|---|---|---|---|
| `SessionStart` | `startup\|resume\|clear\|compact` | `session-start.sh` | In ngày giờ VN, mốc hiện tại và hạn, dòng việc hôm nay của docs/11, nhánh git, luật cứng | Không (chỉ thêm ngữ cảnh) |
| `PreToolUse` | `Read\|Edit\|Write\|NotebookEdit` | `guard-secret-files.sh` | Chặn đọc/ghi file bí mật; chặn ghi nội dung giống khóa riêng, khối PEM, API key | Có (exit 2) |
| `PreToolUse` | `Bash` | `guard-bash.sh` | Chặn broadcast tới mainnet hay khi không chỉ rõ RPC Fuji/local; chặn in bí mật, đọc file bí mật bằng Bash, khóa hex trên dòng lệnh, `cast wallet` tạo/lộ khóa, `git add -f` | Có (exit 2) |
| `PostToolUse` | `Edit\|Write` | `sol-fmt-build.sh` | Sau khi sửa `.sol`: `forge fmt` file đó, rồi `forge build` nhanh; lỗi thì đưa vào ngữ cảnh để Claude sửa | Không (phản hồi) |

Cách hook làm việc (theo tài liệu hooks):

- Claude Code gửi JSON qua stdin: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `tool_name`, `tool_input` (Bash: `command`; Read, Edit, Write: `file_path`; Write: `content`; Edit: `old_string`, `new_string`), `tool_use_id`; PostToolUse có thêm `tool_response`.
- Mã thoát: 0 là không phản đối (với PreToolUse, đây chưa phải "cho phép": quyền vẫn xét tiếp như mục 6); 2 là chặn (PreToolUse chặn lệnh và gửi stderr cho Claude; PostToolUse đưa stderr cho Claude; SessionStart chỉ hiện cho người); mã khác là lỗi không chặn.
- PostToolUse có thể in JSON: `hookSpecificOutput.additionalContext` thêm chữ vào ngữ cảnh của Claude, `systemMessage` hiện cho người. SessionStart in chữ thường ra stdout là được thêm vào ngữ cảnh.
- PreToolUse chạy ở mọi chế độ quyền, kể cả `auto`. Các hook khớp cùng sự kiện chạy song song; có quyết định chặn thì chặn thắng.
- Hai hook bảo vệ "đóng khi lỗi": máy thiếu cả `jq` lẫn `python3` thì chúng chặn mọi thao tác thay vì cho qua.
- `timeout` tính bằng giây (mặc định của hook lệnh là 600). Bộ kit đặt 15 giây cho hook bảo vệ, 300 giây cho fmt/build.
- Xem hook đang đăng ký: `/hooks`. Xem log chạy hook: `claude --debug=hooks`.

Giới hạn cần biết: hook dựa trên mẫu chuỗi, không bắt được mọi cách viết lệnh (ví dụ RPC mainnet đặt trong biến đã export từ trước). Đó là lý do có thêm quy tắc `ask` cho mọi lệnh broadcast: người vẫn phải đọc lệnh trước khi duyệt.

### 7.1. `guard-secret-files.sh`

Chặn khi `file_path` (hoặc `notebook_path`) là `.env`, `.env.*` (trừ `.env.example`, `.env.sample`, `.env.template`), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `id_rsa`/`id_ecdsa`/`id_ed25519`/`id_dsa`, file keystore `UTC--*`, hoặc nằm trong thư mục `keystore/`, `keystores/` (kể cả `~/.foundry/keystores`). Với Write/Edit còn quét nội dung mới: khối PEM khóa riêng, phép gán `private_key`/`secret_key`/`mnemonic`/`seed_phrase` bằng 64 ký tự hex, API key Anthropic, token bot Telegram. Hằng số `bytes32` 64 hex bình thường trong code không bị chặn.

```bash
#!/usr/bin/env bash
# HụiSafe - PreToolUse hook cho Read|Edit|Write|NotebookEdit.
# (a) Chặn đọc/ghi file bí mật: .env* (trừ .env.example/.sample/.template), *.pem, *.key,
#     *.p12, *.pfx, *.jks, *.keystore, id_rsa/id_ed25519..., keystore(s)/, ~/.foundry/keystores, UTC--*.
# (b) Chặn Write/Edit có nội dung trông như khóa bí mật (PEM private key, PRIVATE_KEY=0x<64 hex>,
#     mnemonic, API key Anthropic, token bot Telegram).
# Exit 2 = chặn tool call; stderr được gửi lại cho Claude làm lý do. Exit 0 = không phản đối.
# Tương thích bash 3.2 (macOS) và bash 5.x (Linux/WSL). Cần jq (dự phòng: python3).
set -uo pipefail

INPUT="$(cat)"

# Thiếu cả jq lẫn python3 thì không kiểm tra được: chặn (fail closed). Kiểm ở cấp trên cùng,
# vì exit bên trong $(...) chỉ thoát subshell.
if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "HuiSafe guard: cần jq (hoặc python3) để kiểm tra an toàn. Cài jq rồi thử lại." >&2
  exit 2
fi

get() {
  # $1 = đường dẫn dạng a.b.c trong JSON đầu vào; in giá trị (chuỗi) hoặc rỗng.
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg p "$1" \
      'getpath($p | split(".")) // empty | if type == "string" then . else tostring end' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
    if d is None:
        break
sys.stdout.write("" if d is None else (d if isinstance(d, str) else json.dumps(d)))
' "$1" 2>/dev/null
  fi
}

deny() {
  printf 'HuiSafe guard (secret-files): %s\n' "$1" >&2
  exit 2
}

TOOL="$(get tool_name)"
FILE="$(get tool_input.file_path)"
[ -z "$FILE" ] && FILE="$(get tool_input.notebook_path)"
FILE="${FILE//\\//}"   # chuẩn hóa dấu \ của Windows

is_secret_path() {
  local f="$1" b
  b="$(basename -- "$f" 2>/dev/null || printf '%s' "$f")"
  case "$b" in
    .env.example | .env.sample | .env.template) return 1 ;;
    .env | .env.*) return 0 ;;
    *.pem | *.key | *.p12 | *.pfx | *.jks | *.keystore) return 0 ;;
    id_rsa | id_ecdsa | id_ed25519 | id_dsa) return 0 ;;
    UTC--*) return 0 ;;
  esac
  case "/$f/" in
    */keystore/* | */keystores/*) return 0 ;; # gồm cả ~/.foundry/keystores/
  esac
  return 1
}

if [ -n "$FILE" ] && is_secret_path "$FILE"; then
  deny "'$FILE' là file bí mật (.env*, khóa riêng, keystore). Claude không được đọc hoặc ghi file này. Dùng .env.example với giá trị giả; con người tự tạo và điền .env.local rồi export biến môi trường trước khi chạy claude."
fi

case "$TOOL" in
  Write | Edit | NotebookEdit)
    CONTENT="$(get tool_input.content)
$(get tool_input.new_string)
$(get tool_input.new_source)"
    if printf '%s\n' "$CONTENT" | grep -Eq -- '-----BEGIN ([A-Z0-9]+ )*PRIVATE KEY-----'; then
      deny "Nội dung chứa khối PEM PRIVATE KEY. Không bao giờ ghi khóa riêng vào file trong repo."
    fi
    if printf '%s\n' "$CONTENT" | grep -Eiq -- '(private[_-]?key|priv[_-]?key|secret[_-]?key|mnemonic|seed[_-]?phrase)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?(0x)?[0-9a-f]{64}([^0-9a-f]|$)'; then
      deny "Nội dung gán một khóa riêng dạng hex 64 ký tự. Đọc khóa từ biến môi trường (vm.envUint(\"DEPLOYER_PRIVATE_KEY\") trong Foundry, process.env ở server), không hard-code. Trong test dùng makeAddrAndKey hoặc khóa nhỏ như 0xA11CE."
    fi
    if printf '%s\n' "$CONTENT" | grep -Eq -- 'sk-ant-[A-Za-z0-9_-]{20,}'; then
      deny "Nội dung chứa thứ trông như API key Anthropic. Chỉ đặt ANTHROPIC_API_KEY trong .env.local (không commit)."
    fi
    if printf '%s\n' "$CONTENT" | grep -Eq -- '(^|[^0-9])[0-9]{8,10}:[A-Za-z0-9_-]{35}([^A-Za-z0-9_-]|$)'; then
      deny "Nội dung chứa thứ trông như token bot Telegram. Chỉ đặt TELEGRAM_BOT_TOKEN trong .env.local (không commit)."
    fi
    ;;
esac

exit 0
```

### 7.2. `guard-bash.sh`

Chuẩn hóa lệnh (gộp dòng, chữ thường, bỏ dấu nháy) rồi xét bốn nhóm luật:

- **A. Mainnet:** lệnh `forge`, `cast`, `anvil`, `chisel` có RPC mainnet (`api.avax.network`, các URL mainnet phổ biến, số 43114), alias `--rpc-url avalanche|mainnet|...`, hoặc `--chain` mainnet. Chặn.
- **B. Broadcast:** `forge script ... --broadcast/--resume`, `forge create`, `cast send/publish/mktx`, `eth_sendRawTransaction` mà không chỉ rõ RPC Fuji (`fuji`, `$FUJI_RPC_URL`, `api.avax-test.network`) hay anvil local. Chặn.
- **C. Bí mật:** `printenv`, `env`/`export`/`set`/`declare` không tham số; in biến có tên chứa `private_key`, `secret`, `mnemonic`, `api_key`, `bot_token`; mã đọc `process.env`/`os.environ` các biến đó; khóa hex sau `--private-key`; `--mnemonic`; `cast wallet new|private-key|decrypt-keystore|derive`; đọc, sao chép, nạp file `.env`/khóa/keystore bằng Bash. Chặn. Muốn biết biến đã có chưa mà không in giá trị, dùng vòng lặp ở CLAUDE.md mục "Môi trường và bí mật".
- **D.** `git add -f` (có thể đưa file bị `.gitignore` chặn vào commit). Chặn.

```bash
#!/usr/bin/env bash
# HụiSafe - PreToolUse hook cho Bash.
# Chặn (exit 2, lý do ở stderr được gửi lại cho Claude):
#   A. Lệnh on-chain (forge/cast/anvil/chisel) trỏ tới mainnet: RPC api.avax.network
#      (Fuji là api.avax-test.network), chain 43114, alias avalanche/mainnet, Ethereum mainnet.
#   B. Lệnh broadcast (forge script --broadcast/--resume, forge create, cast send/publish/mktx,
#      eth_sendRawTransaction) không chỉ rõ RPC Fuji (--rpc-url fuji, $FUJI_RPC_URL,
#      api.avax-test.network) hoặc anvil local (localhost/127.0.0.1).
#   C. Lệnh làm lộ bí mật: printenv, env/export/set trần, echo/printf/curl... với biến *_PRIVATE_KEY,
#      *SECRET*, *API_KEY*, *BOT_TOKEN*, MNEMONIC; process.env/os.environ đọc biến bí mật;
#      khóa hex 64 ký tự hoặc --mnemonic trên dòng lệnh; cast wallet private-key/decrypt-keystore/new;
#      đọc/chép/source file .env* (trừ .env.example), *.pem, *.key, keystore; git add -f.
# Đây là lớp phòng thủ theo mẫu chữ (best-effort), không phải ranh giới bảo mật tuyệt đối.
# Tương thích bash 3.2 (macOS) và bash 5.x. Cần jq (dự phòng: python3).
set -uo pipefail

INPUT="$(cat)"

# Thiếu cả jq lẫn python3 thì không kiểm tra được: chặn (fail closed). Kiểm ở cấp trên cùng,
# vì exit bên trong $(...) chỉ thoát subshell.
if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "HuiSafe guard: cần jq (hoặc python3) để kiểm tra an toàn. Cài jq rồi thử lại." >&2
  exit 2
fi

get() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg p "$1" \
      'getpath($p | split(".")) // empty | if type == "string" then . else tostring end' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
    if d is None:
        break
sys.stdout.write("" if d is None else (d if isinstance(d, str) else json.dumps(d)))
' "$1" 2>/dev/null
  fi
}

deny() {
  printf 'HuiSafe guard (bash): %s\n' "$1" >&2
  exit 2
}

has() { printf '%s\n' "$NQ" | grep -Eq -- "$1"; }

CMD="$(get tool_input.command)"
[ -z "$CMD" ] && exit 0

# Gộp dòng, hạ chữ thường, bỏ dấu nháy để mẫu đơn giản và khó lách bằng cách xuống dòng/nháy.
NQ="$(printf '%s' "$CMD" | tr '\n\r\t' '   ' | tr '[:upper:]' '[:lower:]' | tr -d "\"'")"

SEP='(^|[;&|(`[:space:]])'

# ---------- A. Mainnet ----------
re_onchain="${SEP}(forge|cast|anvil|chisel)([[:space:]]|$)"
re_mainnet_url='api\.avax\.network|avalanche-mainnet|avax-mainnet|avalanche-c-chain-rpc|rpc\.ankr\.com/avalanche([^_a-z]|$)|mainnet\.infura\.io|eth-mainnet|cloudflare-eth\.com|(^|[^0-9])43114([^0-9]|$)'
re_mainnet_alias='(--rpc-url|--fork-url)[=[:space:]]+(avalanche|avax|mainnet|ethereum|c-chain)([^a-z0-9_-]|$)'
re_chain_mainnet='--chain(-id)?[=[:space:]]+(avalanche|avax|mainnet|ethereum|1|43114)([^a-z0-9_-]|$)'

if has "$re_onchain" && { has "$re_mainnet_url" || has "$re_mainnet_alias" || has "$re_chain_mainnet"; }; then
  deny "Lệnh on-chain trỏ tới mainnet (chain 43114 / api.avax.network / alias mainnet). HụiSafe chỉ chạy trên Avalanche Fuji (43113). Dùng --rpc-url fuji (alias trong contracts/foundry.toml) hoặc \$FUJI_RPC_URL."
fi

# ---------- B. Broadcast phải chỉ rõ Fuji hoặc anvil local ----------
re_broadcast='forge[[:space:]]+script([[:space:]].*)?[[:space:]]--(broadcast|resume)([[:space:]=]|$)|forge[[:space:]]+create([[:space:]]|$)|cast[[:space:]]+(send|publish|mktx)([[:space:]]|$)|cast[[:space:]]+rpc[[:space:]]+eth_send|eth_sendrawtransaction|eth_sendtransaction'
re_fuji_or_local='(--rpc-url|--fork-url|-r)[=[:space:]]+(fuji|\$\{?fuji_rpc_url\}?|https?://api\.avax-test\.network|https?://(localhost|127\.0\.0\.1))|api\.avax-test\.network|localhost:8545|127\.0\.0\.1:8545'

if has "$re_broadcast" && ! has "$re_fuji_or_local"; then
  deny "Lệnh broadcast phải chỉ rõ RPC Fuji: --rpc-url fuji (hoặc --rpc-url \"\$FUJI_RPC_URL\"), hoặc anvil local (http://127.0.0.1:8545). Không dựa vào ETH_RPC_URL hay RPC mặc định."
fi

# ---------- C. Lộ bí mật ----------
re_printenv="${SEP}printenv([[:space:];&|)>]|$)"
re_dump_env='(^|[;&|(`])[[:space:]]*(env|export|set|export[[:space:]]+-p|declare[[:space:]]+-[px]+)[[:space:]]*($|[;&|)>])'
re_secret_var='\$\{?[a-z0-9_]*(private_key|privatekey|secret|mnemonic|seed_phrase|api_key|apikey|bot_token)[a-z0-9_]*'
re_printer="${SEP}(echo|printf|print|cat|tee|logger|curl|wget|nc|ncat|xargs|python3?|node|perl|ruby)([[:space:]]|$)"
re_env_access='(process\.env|os\.environ|os\.getenv|getenv)[^;&|]*(private_key|secret|mnemonic|api_key|bot_token)'
re_literal_key='(--private-keys?|private_key=|privatekey=)[=[:space:]]*(0x)?[0-9a-f]{64}([^0-9a-f]|$)'
re_mnemonic_flag='--mnemonic([=[:space:]]|$)'
re_cast_wallet='cast[[:space:]]+wallet[[:space:]]+(private-key|decrypt-keystore|new|new-mnemonic|derive)([[:space:]]|$)'

if has "$re_printenv" || has "$re_dump_env"; then
  deny "Không in toàn bộ biến môi trường (printenv/env/export/set): có thể lộ DEPLOYER_PRIVATE_KEY, PRIVY_APP_SECRET, ANTHROPIC_API_KEY. Kiểm tra biến có hay chưa mà không in giá trị: for v in TEN_BIEN_1 TEN_BIEN_2; do [ -n \"\${!v:-}\" ] && echo \"\$v: có\" || echo \"\$v: THIẾU\"; done"
fi
if has "$re_secret_var" && has "$re_printer"; then
  deny "Lệnh vừa tham chiếu biến bí mật (*_PRIVATE_KEY, *SECRET*, *API_KEY*, *BOT_TOKEN*, MNEMONIC) vừa có lệnh in/gửi (echo, printf, cat, tee, curl, node, python...). Không in hay gửi bí mật. Trong Foundry đọc khóa bằng vm.envUint trong script."
fi
if has "$re_env_access"; then
  deny "Script nội tuyến đọc biến bí mật (process.env/os.environ). Không làm vậy trong lệnh Bash; logic đọc bí mật chỉ nằm trong code server đã review."
fi
if has "$re_literal_key" || has "$re_mnemonic_flag"; then
  deny "Không đưa khóa riêng hay mnemonic trực tiếp lên dòng lệnh. Dùng biến môi trường (đã export từ trước) hoặc keystore (--account)."
fi
if has "$re_cast_wallet"; then
  deny "cast wallet private-key/decrypt-keystore/new/new-mnemonic/derive in ra khóa riêng. Con người tự tạo/quản lý ví testnet ngoài phiên Claude."
fi

# File bí mật: chỉ chặn khi có thao tác đọc/chép/ghi/nạp file (tránh chặn nhầm commit message).
NQX="$(printf '%s' "$NQ" | sed -E 's/\.env\.(example|sample|template)//g')"
re_env_file='(^|[^a-z0-9_])\.env([^a-z0-9_]|$)'
re_key_file='\.(pem|key|p12|pfx|jks|keystore)([^a-z0-9_]|$)|(^|[^a-z0-9_])id_(rsa|ecdsa|ed25519|dsa)([^.a-z0-9_]|$)|\.foundry/keystores|(^|[/[:space:]])keystores?(/|[[:space:]]|$)|(^|[/[:space:]])utc--'
re_file_access="${SEP}(cat|bat|less|more|head|tail|nl|tac|grep|egrep|fgrep|rg|ag|sed|awk|cut|sort|uniq|strings|xxd|od|hexdump|base64|openssl|gpg|cp|mv|rsync|scp|tar|zip|7z|source|\.|tee|vi|vim|nano|emacs|code|open|curl|wget|dotenv|diff|cmp|python3?|node|perl|ruby|php|git[[:space:]]+(add|show|diff))([[:space:]]|$)|[<>]"

if { printf '%s\n' "$NQX" | grep -Eq -- "$re_env_file" || printf '%s\n' "$NQX" | grep -Eq -- "$re_key_file"; } && has "$re_file_access"; then
  deny "Lệnh đọc/chép/ghi/nạp file bí mật (.env*, *.pem, *.key, keystore). Claude không chạm vào các file này; con người tự 'set -a; source .env.local; set +a' trước khi mở claude. Được phép: ls/test -f để kiểm tra tồn tại, cat .env.example."
fi

re_git_add_force='git[[:space:]]+add([[:space:]][^;&|]*)?[[:space:]](-f|--force)([[:space:]]|$)'
if has "$re_git_add_force"; then
  deny "Không dùng git add -f/--force: file bị .gitignore (ví dụ .env.local, keystore) không được đưa vào repo."
fi

exit 0
```

### 7.3. `sol-fmt-build.sh`

Chỉ chạy khi file vừa sửa là `.sol` và máy có `forge`. Tìm `foundry.toml` gần nhất, chạy `forge fmt <file>`, rồi `forge build --skip test` (sửa file test hay script thì build đầy đủ). Có khóa thư mục để hai lần sửa liền nhau không build chồng nhau. Build xanh thì im lặng; lỗi thì in JSON với `additionalContext` (25 dòng cuối của fmt, 60 dòng cuối của build) để Claude tự sửa ngay, và `systemMessage` để người thấy. Hook không bao giờ chặn (luôn exit 0).

```bash
#!/usr/bin/env bash
# HụiSafe - PostToolUse hook cho Edit|Write.
# Khi Claude sửa một file .sol: chạy `forge fmt <file>` rồi `forge build` nhanh trong thư mục
# Foundry gần nhất (chứa foundry.toml). Sửa src/ thì build với `--skip test` cho nhanh;
# sửa test/ hoặc script/ thì build đầy đủ.
# KHÔNG chặn: nếu fmt/build lỗi, in JSON với hookSpecificOutput.additionalContext để Claude
# thấy lỗi và tự sửa, kèm systemMessage cảnh báo người dùng. Luôn exit 0.
set -uo pipefail

INPUT="$(cat)"

get() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg p "$1" \
      'getpath($p | split(".")) // empty | if type == "string" then . else tostring end' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
    if d is None:
        break
sys.stdout.write("" if d is None else (d if isinstance(d, str) else json.dumps(d)))
' "$1" 2>/dev/null
  fi
}

FILE="$(get tool_input.file_path)"
FILE="${FILE//\\//}"
case "$FILE" in
  *.sol) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0
command -v forge >/dev/null 2>&1 || exit 0   # chưa cài Foundry: bỏ qua, không làm phiền

# Tìm thư mục Foundry gần nhất (đi ngược lên từ file).
DIR="$(cd "$(dirname "$FILE")" 2>/dev/null && pwd)" || exit 0
ROOT=""
while [ -n "$DIR" ] && [ "$DIR" != "/" ]; do
  if [ -f "$DIR/foundry.toml" ]; then
    ROOT="$DIR"
    break
  fi
  DIR="$(dirname "$DIR")"
done
[ -z "$ROOT" ] && exit 0
cd "$ROOT" || exit 0

FMT_OUT="$(forge fmt "$FILE" 2>&1)"
FMT_RC=$?

# Khóa đơn giản để hai lần sửa song song không chạy hai forge build cùng lúc trên một cache.
LOCK="${TMPDIR:-/tmp}/huisafe-forge-build-$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1).lock"
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then
  rmdir "$LOCK" 2>/dev/null   # khóa cũ hơn 10 phút: coi như kẹt
fi
BUILD_OUT=""
BUILD_RC=0
BUILD_SKIPPED=0
if mkdir "$LOCK" 2>/dev/null; then
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
  case "$FILE" in
    *.t.sol | *.s.sol | */test/* | */script/*) BUILD_OUT="$(forge build 2>&1)" ;;
    *) BUILD_OUT="$(forge build --skip test 2>&1)" ;;
  esac
  BUILD_RC=$?
else
  BUILD_SKIPPED=1
fi

[ "$FMT_RC" -eq 0 ] && [ "$BUILD_RC" -eq 0 ] && exit 0

REL="${FILE#"$ROOT"/}"
MSG="HuiSafe hook sau khi sửa ${REL}:"
if [ "$FMT_RC" -ne 0 ]; then
  MSG="${MSG}
- forge fmt THẤT BẠI (thường do lỗi cú pháp):
$(printf '%s\n' "$FMT_OUT" | tail -n 25)"
fi
if [ "$BUILD_RC" -ne 0 ]; then
  MSG="${MSG}
- forge build THẤT BẠI (exit ${BUILD_RC}). 60 dòng cuối:
$(printf '%s\n' "$BUILD_OUT" | tail -n 60)"
fi
if [ "$BUILD_SKIPPED" -eq 1 ]; then
  MSG="${MSG}
- (bỏ qua forge build vì một lần build khác đang chạy)"
fi
MSG="${MSG}
Hãy sửa lỗi trước khi làm tiếp, rồi chạy lại: cd ${ROOT} && forge build"
SYS="HuiSafe: forge fmt/build lỗi sau khi sửa ${REL}; đã báo cho Claude."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$MSG" --arg sys "$SYS" \
    '{systemMessage: $sys, hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
elif command -v python3 >/dev/null 2>&1; then
  python3 -I -c 'import json, sys; print(json.dumps({"systemMessage": sys.argv[2], "hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": sys.argv[1]}}))' "$MSG" "$SYS"
else
  printf '%s\n' "$MSG" >&2
  exit 1   # lỗi không chặn: người dùng thấy thông báo hook error
fi
exit 0
```

### 7.4. `session-start.sh`

In ngày hôm nay theo giờ Việt Nam, mốc kế tiếp và số ngày còn lại (lịch chốt chép từ docs/11 mục 1 vào biến `MILESTONES`), dòng của mốc đó trong docs/11, dòng việc hôm nay ở docs/11 mục 3, nhánh git, rồi 5 luật cứng. Đổi lịch ở docs/11 thì sửa `MILESTONES` trong script cùng PR. Biến `HUISAFE_TODAY=YYYYMMDD` dùng để thử với ngày khác.

```bash
#!/usr/bin/env bash
# HụiSafe - SessionStart hook (startup|resume|clear|compact).
# In ra mốc hiện tại (theo lịch chốt trong docs/11-ke-hoach-trien-khai.md) và luật cứng.
# Với SessionStart, stdout dạng văn bản được Claude Code thêm vào ngữ cảnh của Claude.
# Đặt HUISAFE_TODAY=YYYYMMDD để thử với ngày khác.
set -uo pipefail
cat >/dev/null 2>&1 || true   # bỏ qua JSON đầu vào

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TODAY="${HUISAFE_TODAY:-$(TZ=Asia/Ho_Chi_Minh date +%Y%m%d)}"

# Lịch chốt (mốc|hạn YYYYMMDD|định nghĩa xong). Đổi lịch thì sửa cả docs/11 và danh sách này.
MILESTONES='M0 Setup|20261107|Repo khung, CLAUDE.md + .claude, ví Fuji có AVAX + USDC testnet, Builder Pass cả đội
M1 Contract lõi|20261110|FIXED + BIDDING, pull/thác bù/holdback/ký quỹ/quỹ dự phòng; unit + fuzz xanh
M2 Fuji + SDK|20261111|Deploy + verify trên Fuji, ABI vào sdk; invariant xanh; workshop 20:00
M3 MVP E2E|20261114|Tạo dây, vào dây, thăm, chi, bù vỡ nợ chạy trên Fuji qua web; relayer + keeper
M4 AI + thử thật|20261116|Trợ lý chủ hụi, mô phỏng xong; 5-10 người dùng thật thử trên Fuji
M5 Đóng băng tính năng|20261117|Chỉ sửa lỗi; Slither sạch mức cao; workshop 20:00
M6 Tài liệu + pitch|20261119|README, slide, kịch bản, video v1; office hours 19/11
M7 Nộp|20261120|Video cuối, nộp trước 22:00; 21/11 dự phòng, kiểm link bằng tab ẩn danh'

CURRENT=""
while IFS='|' read -r name due def; do
  [ -z "$name" ] && continue
  if [ "$TODAY" -le "$due" ]; then
    CURRENT="$name|$due|$def"
    break
  fi
done <<EOF
$MILESTONES
EOF

fmt_date() { printf '%s/%s/%s' "${1:6:2}" "${1:4:2}" "${1:0:4}"; }

echo "HụiSafe - hôm nay $(fmt_date "$TODAY") (giờ VN)."
if [ -n "$CURRENT" ]; then
  name="${CURRENT%%|*}"
  rest="${CURRENT#*|}"
  due="${rest%%|*}"
  def="${rest#*|}"
  left=""
  if [ "${TODAY:0:6}" = "${due:0:6}" ]; then
    left=", còn $((10#${due:6:2} - 10#${TODAY:6:2})) ngày"
  fi
  echo "Mốc hiện tại: ${name} (hạn $(fmt_date "$due")${left}). Định nghĩa xong: ${def}."
  code="${name%% *}"
  PLAN="$ROOT/docs/11-ke-hoach-trien-khai.md"
  if [ -f "$PLAN" ]; then
    line="$(grep -m1 -E "(^|[^A-Za-z0-9])${code}([^0-9]|$)" "$PLAN" 2>/dev/null | cut -c1-200)"
    [ -n "$line" ] && echo "docs/11: ${line}"
    # Dòng của hôm nay trong bảng "Kế hoạch từng ngày" (dạng "| T5 12/11 | ...").
    day="$(grep -m1 -E "^\| *(T[2-7]|CN) ${TODAY:6:2}/${TODAY:4:2}([^0-9]|$)" "$PLAN" 2>/dev/null | cut -c1-240)"
    [ -n "$day" ] && echo "Việc hôm nay (docs/11 mục 3, cột P1 | P2 | P3): ${day}"
  fi
elif [ "$TODAY" -le 20261121 ]; then
  echo "Ngày dự phòng 21/11: hạn nộp UniHack 23:59 hôm nay. Chỉ sửa lỗi chặn demo, kiểm link bằng tab ẩn danh."
else
  echo "Đã qua hạn nộp UniHack (23:59 21/11/2026). Chung kết: công bố 23/11, Demo Day 30/11."
fi

BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
[ -n "$BRANCH" ] && echo "Nhánh git: ${BRANCH}."

cat <<'EOF'
LUẬT CỨNG (chi tiết trong CLAUDE.md):
1. Chỉ Avalanche Fuji (chainId 43113). Không bao giờ broadcast lên mainnet.
2. Không đọc, ghi, in hay commit bí mật (.env*, khóa riêng, keystore, API key).
3. Không có yếu tố ngẫu nhiên trong sản phẩm. Không dữ liệu cá nhân on-chain.
4. LLM không ký, không chuyển tiền. Admin không có hàm rút tiền người dùng.
5. Mọi luồng tiền phải có test (unit + fuzz + invariant) trước khi merge.
Quy trình: plan mode -> implement -> test -> subagent security-auditor -> commit.
EOF
exit 0
```

---

## 8. Skills

| Skill | Dùng khi | Nội dung chính |
|---|---|---|
| `hui-protocol` | Viết, test, review contract, `huiMath`, mô phỏng; cần số liệu tiền chính xác | Ký hiệu, công thức và tên hàm `HuiMath`, tham số mặc định, lịch, chọn người hốt, `settleRound`, thứ tự hoàn, Frozen, pause/unwind, INV-01..INV-10, ví dụ số (C = 100 và bản demo C = 10), bảng NĐ 19 |
| `foundry-fuji` | Foundry, deploy, verify, faucet | Mạng Fuji, mẫu `foundry.toml`, OpenZeppelin, Slither, bố cục test, khung invariant, thứ tự deploy, lệnh verify qua Routescan, faucet, ví theo vai |
| `web3-frontend` | Web, ví Privy, permit, relay, keeper | Providers Privy + wagmi, ký permit, `/api/attest`, `/api/relay` (6 bước kiểm, 15 selector), commit-reveal và salt, đọc dữ liệu, keeper, quy tắc UI tiếng Việt |
| `vn-legal-pitch` | Pitch, slide, form, câu chữ pháp lý | 4 điểm luật BTC, 3 câu hỏi bắt buộc, bảng NĐ 19, khai báo dev toggle, quy tắc câu chữ |

Skill là bản tóm tắt; khi skill và docs khác nhau thì docs thắng. Đổi docs thì rà skill tương ứng (03-quy-trinh mục 8). Gõ `/hui-protocol` để nạp thủ công.

---

## 9. Subagents

| Subagent | Công cụ | Model | Skill nạp sẵn | Việc |
|---|---|---|---|---|
| `solidity-engineer` | Read, Edit, Write, Bash, Grep, Glob | như phiên chính | hui-protocol, foundry-fuji | Viết, sửa `contracts/src`, `contracts/script` |
| `test-engineer` | Read, Edit, Write, Bash, Grep, Glob | như phiên chính | hui-protocol, foundry-fuji | Unit, fuzz, invariant, differential, WorkedExample, gas; báo lỗi src chứ không tự sửa |
| `security-auditor` | Read, Grep, Glob, Bash (chỉ đọc, Slither, forge test) | opus, effort high | hui-protocol, foundry-fuji | Review bảo mật theo checklist, báo cáo Critical/High/Medium/Low/Info; không sửa file |
| `frontend-engineer` | kế thừa mọi công cụ (kể cả MCP) | như phiên chính | web3-frontend, hui-protocol | `apps/web`, `apps/keeper`, `packages/*` |
| `simulation-analyst` | Read, Edit, Write, Bash, Grep, Glob | sonnet | hui-protocol | `sim/`, vector `huimath.json`, số liệu cho pitch |
| `pitch-writer` | Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch | sonnet | vn-legal-pitch, hui-protocol | README, slide, kịch bản video, form nộp bài |

- Mỗi subagent chạy trong ngữ cảnh riêng, có nạp CLAUDE.md (kèm docs/03, docs/05), và trả kết quả tóm tắt về phiên chính. Giao việc đọc nhiều file cho subagent giúp phiên chính gọn.
- Gọi bằng lời: "Dùng subagent test-engineer: ...". `test-engineer` có "Dùng PROACTIVELY" trong mô tả nên Claude tự giao sau khi sửa luồng tiền.
- Mỗi file agent có: frontmatter (`name`, `description`, `tools`, `model`, `skills`, `color`, thêm `effort` cho auditor), vai trò, đầu vào, đọc trước, quy trình từng bước, định dạng báo cáo, danh sách "không bao giờ". Xem hoặc sửa: `/agents` hoặc mở file trong `.claude/agents/`.

---

## 10. Lệnh

| Lệnh | Tham số | Làm gì |
|---|---|---|
| `/plan-milestone` | `[M0..M7] [ghi chú]` | Lập kế hoạch một mốc ở plan mode từ docs/11: bảng việc theo mã C/W/T, tiêu chí đo được, rủi ro, việc cắt. Không sửa file khi chưa duyệt |
| `/implement` | `<mã việc hoặc mô tả>` | Làm một việc từ đầu đến cuối: đọc đặc tả, kế hoạch ngắn, tạo nhánh, giao subagent, test, audit nếu đụng tiền, Definition of Done, commit (không push) |
| `/audit` | `[phạm vi]` | Chạy `security-auditor` trong ngữ cảnh tách riêng (`context: fork`): Slither, test, checklist, INV-01..INV-10 |
| `/deploy-fuji` | `[all \| demo-circle \| verify-only]` | Kiểm trước, mô phỏng, broadcast có người duyệt, verify Routescan, ghi `fuji.json`, đồng bộ ABI, tạo dây demo |
| `/demo-check` | `[url web]` | Kiểm sẵn sàng demo/nộp bài, chỉ đọc; trả bảng ĐẠT / CHƯA ĐẠT / CẦN NGƯỜI KIỂM |
| `/sync-abi` | `[ghi chú]` | `forge build`, `pnpm --filter sdk generate`, kiểm không có `multicall` và tham số `string`, typecheck, test vector |

- Mọi lệnh đặt `disable-model-invocation: true`: chỉ người gọi, Claude không tự chạy.
- `/plan-milestone` và `/audit` chèn sẵn trạng thái git lúc gọi (cú pháp chèn lệnh động của skill). Lệnh chèn không hỏi quyền: lệnh nào không được cho phép hoặc chạy lỗi sẽ hủy cả lần gọi. Vì vậy các lệnh git đó (và `true` trong `|| true`) được khai báo trong `allowed-tools` của từng lệnh, và lệnh cần chạy trong repo git.
- `/demo-check` và `/sync-abi` khai báo `allowed-tools` để chạy các lệnh đọc cần thiết mà không hỏi từng lần.
- Lệnh tùy biến và skill đã được gộp làm một trong Claude Code: file `.claude/commands/*.md` vẫn chạy như skill, nhận tham số qua `$ARGUMENTS`. Prompt nhiều dòng bắt đầu bằng `/implement` thì toàn bộ chữ phía sau là tham số.

---

## 11. MCP server đề xuất

Không bắt buộc. Lệnh `gh` (đã cho phép các lệnh đọc) đủ cho phần lớn việc với GitHub.

**GitHub** (server từ xa của GitHub; dùng fine-grained PAT chỉ cho repo `T1VN_Unihack`, quyền tối thiểu):

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

**Playwright** (mở web ở bề rộng 360 px, chụp màn hình, đọc lỗi console; cần Node.js 18+):

```bash
claude mcp add playwright npx @playwright/mcp@latest
```

Hai lệnh trên mặc định ghi ở phạm vi `local` (chỉ máy bạn, trong `~/.claude.json`). Muốn cả đội dùng chung thì tạo `.mcp.json` ở gốc repo (phạm vi `project`, commit được vì không chứa token; mỗi người tự export `GITHUB_PAT`):

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_PAT}" }
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

- `.mcp.json` hỗ trợ `${VAR}` và `${VAR:-mặc định}`. Lần đầu dùng server của dự án, Claude Code hỏi người duyệt.
- Kiểm trạng thái: `/mcp` hoặc `claude mcp list`. Output MCP quá dài thì đặt `MAX_MCP_OUTPUT_TOKENS`.
- Khi Playwright đã chạy ổn, nên ghim phiên bản cụ thể thay cho `@latest`.
- MCP server chạy với quyền của bạn: không cấp token rộng hơn cần, không dán token vào prompt.

---

## 12. Đóng gói thành plugin (tùy chọn)

Cho hackathon, chép `.claude/` vào repo (mục 2) là đủ và dễ review nhất. Plugin hữu ích khi muốn dùng cùng bộ skills, subagents, lệnh, hooks ở nhiều repo hay nhiều máy. Cấu trúc đã thử:

```text
huisafe-marketplace/
├── .claude-plugin/marketplace.json
└── plugins/huisafe-kit/
    ├── .claude-plugin/plugin.json
    ├── skills/        (4 skill)
    ├── commands/      (6 lệnh)
    ├── agents/        (6 subagent)
    └── hooks/
        ├── hooks.json
        └── scripts/   (4 script hook)
```

`plugins/huisafe-kit/.claude-plugin/plugin.json`:

```json
{
  "name": "huisafe-kit",
  "description": "Bộ cấu hình Claude Code của HụiSafe: skills, subagents, lệnh và hooks an toàn cho Avalanche Fuji",
  "version": "1.0.0",
  "author": {
    "name": "Team HụiSafe"
  }
}
```

`plugins/huisafe-kit/hooks/hooks.json` (cùng dạng khối `hooks` của settings, đường dẫn dùng `${CLAUDE_PLUGIN_ROOT}`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/scripts/session-start.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/scripts/guard-secret-files.sh",
            "timeout": 15
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/scripts/guard-bash.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/hooks/scripts/sol-fmt-build.sh",
            "timeout": 300,
            "statusMessage": "forge fmt + forge build..."
          }
        ]
      }
    ]
  }
}
```

`.claude-plugin/marketplace.json`:

```json
{
  "name": "huisafe",
  "description": "Bộ kit Claude Code nội bộ của đội HụiSafe",
  "owner": {
    "name": "Team HụiSafe"
  },
  "plugins": [
    {
      "name": "huisafe-kit",
      "source": "./plugins/huisafe-kit",
      "description": "Skills, subagents, lệnh và hooks an toàn của HụiSafe (chỉ Avalanche Fuji)"
    }
  ]
}
```

```bash
claude plugin validate ./huisafe-marketplace                       # đã chạy: Validation passed
claude --plugin-dir ./huisafe-marketplace/plugins/huisafe-kit      # thử trong một phiên, không cài
claude plugin marketplace add ./huisafe-marketplace                # hoặc URL, hoặc repo GitHub
claude plugin install huisafe-kit@huisafe
claude plugin details huisafe-kit                                  # thành phần, ước tính token (sau khi cài)
claude --plugin-dir ./huisafe-marketplace/plugins/huisafe-kit plugin details huisafe-kit   # như trên, chưa cài
```

Khác với cách chép thư mục:

- Tên có tiền tố plugin: `/huisafe-kit:implement`, `/huisafe-kit:audit`.
- Thành phần plugin gồm skills, lệnh, subagents, hooks, MCP; quy tắc `permissions` vẫn nằm ở `.claude/settings.json` của repo. Khi dùng plugin, giữ phần `permissions` trong settings và bỏ khối `hooks` để hook không chạy hai lần.
- Kết quả đã chạy: `claude plugin validate` qua cho cả marketplace và plugin (chỉ nhắc thiếu icon, không ảnh hưởng); `claude plugin details` thấy 10 skill (4 skill + 6 lệnh), 6 subagent, hooks cho 3 sự kiện (không tốn ngữ cảnh), phần luôn nạp khoảng 2.733 token.

---

## 13. Làm việc hằng ngày

### 13.1. Model và mức effort

- Đổi model: `/model` hoặc `claude --model <bí danh>`. Bí danh: `sonnet`, `opus`, `haiku`, `opusplan` (Opus khi lập kế hoạch, Sonnet khi làm).
- Đổi effort: `/effort` hoặc `claude --effort <mức>` với `low`, `medium`, `high`, `xhigh`, `max` (`max` chỉ cho phiên hiện tại). Đặt cố định bằng khóa `effortLevel` trong settings cá nhân hoặc biến `CLAUDE_CODE_EFFORT_LEVEL`. Các model 5.5 mặc định `medium`.
- Gợi ý: lập kế hoạch và việc đụng tiền (C4..C9, `/relay`) dùng `opus` hoặc `opusplan` với `high`; giao diện, chữ, script nhỏ dùng `sonnet` `medium`. `security-auditor` đã cố định `opus` + `high` trong frontmatter; `simulation-analyst`, `pitch-writer` dùng `sonnet`.

### 13.2. Quản lý ngữ cảnh

- `/context` xem token đang dùng vào đâu.
- `/clear` giữa hai việc không liên quan (ví dụ xong C5 chuyển sang W6). CLAUDE.md và hook SessionStart tự nạp lại.
- `/compact <chỉ dẫn>` khi phiên dài mà chưa xong việc, ví dụ `/compact giữ quyết định thiết kế, file đã sửa, lệnh test còn đỏ`.
- Không dán log dài: nhờ Claude chạy lệnh với `| tail -50`, hay giao subagent đọc.
- Quyết định quan trọng phải vào docs (03-quy-trinh mục 8), không chỉ nằm trong lịch sử chat.

### 13.3. Plan mode

- Vào: Shift+Tab tới chế độ plan, gõ `/plan <việc>`, hoặc mở phiên bằng `claude --permission-mode plan`.
- Ở plan mode Claude chỉ đọc và chạy lệnh đọc, rồi trình kế hoạch. Khi duyệt có các lựa chọn: duyệt và cho tự chạy (auto) hoặc tự nhận sửa file, duyệt nhưng vẫn hỏi từng lần sửa, hoặc "No, keep planning" để góp ý tiếp. Ctrl+G mở kế hoạch trong editor để sửa trước khi duyệt.
- Luật nhóm: mọi việc đụng `contracts/`, `/api/relay`, `/api/attest`, keeper phải qua plan mode trước (02 mục "Cách dùng").

### 13.4. Checkpoint và rewind

- Nhấn Esc hai lần hoặc gõ `/rewind` (bí danh `/checkpoint`, `/undo`) để quay lại một điểm trước: khôi phục cả code và hội thoại, chỉ hội thoại, chỉ code, hoặc tóm tắt từ điểm đó.
- Checkpoint chỉ theo dõi sửa file bằng công cụ sửa của Claude. Thay đổi do lệnh Bash (kể cả `forge fmt` trong hook, `git`, `pnpm`) không được theo dõi; giao dịch đã gửi lên Fuji thì không quay lại được.
- Checkpoint giữ khoảng 30 ngày (khóa `cleanupPeriodDays`). Lưới an toàn thật vẫn là commit nhỏ, thường xuyên.

### 13.5. Chạy song song bằng git worktree

```bash
claude --worktree contracts-settle      # tạo .claude/worktrees/contracts-settle, nhánh worktree-contracts-settle
claude -w web-join                       # phiên thứ hai, thư mục và nhánh riêng
git worktree list
git worktree remove .claude/worktrees/web-join
```

- Mỗi worktree là một thư mục làm việc riêng của cùng repo: hai phiên Claude sửa song song không giẫm file nhau (ví dụ P1 một phiên viết `HuiCircle.sol`, một phiên viết invariant).
- `.claude/worktrees/` phải nằm trong `.gitignore` (mục 2).
- File bị gitignore (như `apps/web/.env.local`) không có sẵn trong worktree. Có thể liệt kê vào `.worktreeinclude` để Claude Code chép sang; hook vẫn chặn Claude đọc các file đó. Cách gọn hơn: export biến trong shell trước khi mở `claude`.
- Hook dùng `$CLAUDE_PROJECT_DIR`, trỏ về thư mục repo chính, nên mọi worktree chạy cùng bộ hook.
- Tự làm bằng git cũng được: `git worktree add ../huisafe-web -b feat/web-join-flow`.

---

## 14. Kiểm thử hooks

### 14.1. Bộ test tự động

```bash
bash .claude/hooks/test-hooks.sh
```

Script dựng JSON stdin đúng định dạng tài liệu hooks (`session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`, thêm `tool_response` cho PostToolUse), chạy từng hook và so mã thoát, output. Khóa giả được sinh lúc chạy nên file test không chứa chuỗi giống bí mật. `sol-fmt-build.sh` được thử với một `forge` giả trong `PATH` tạm. Chạy lại mỗi khi sửa hook (03-quy-trinh mục 8).

<details>
<summary>Toàn bộ <code>.claude/hooks/test-hooks.sh</code></summary>

```bash
#!/usr/bin/env bash
# Kiểm thử các hook HụiSafe bằng JSON mẫu theo schema đầu vào của hook (stdin).
# Chạy từ gốc repo:  bash .claude/hooks/test-hooks.sh
# Không cần Foundry: phần sol-fmt-build dùng một "forge" giả đặt đầu PATH.
# Khóa/bí mật giả được sinh lúc chạy, nên file này không chứa chuỗi trông như khóa thật.
# shellcheck disable=SC2016  # cố ý dùng nháy đơn để giữ nguyên chữ $BIEN trong lệnh mẫu
set -u

HOOKS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

command -v jq >/dev/null 2>&1 || { echo "Cần jq để chạy bộ test (brew install jq / apt-get install jq)"; exit 1; }

HEX64="$(printf 'ab%.0s' $(seq 1 32))"                  # 64 ký tự hex giả
PEM_HDR="-----BEGIN $(printf 'PRIV')ATE KEY-----"      # dựng lúc chạy
ANT_KEY="sk-$(printf 'ant')-$(printf 'x%.0s' $(seq 1 30))"

bash_json() {
  jq -n --arg c "$1" '{session_id:"test", transcript_path:"/tmp/t.jsonl", cwd:"/repo",
    permission_mode:"default", hook_event_name:"PreToolUse", tool_name:"Bash",
    tool_input:{command:$c, description:"test"}, tool_use_id:"toolu_test"}'
}
file_json() { # $1 tool, $2 file_path, $3 content (Write) hoặc new_string (Edit)
  jq -n --arg t "$1" --arg f "$2" --arg c "${3:-}" '{session_id:"test", transcript_path:"/tmp/t.jsonl",
    cwd:"/repo", permission_mode:"default", hook_event_name:"PreToolUse", tool_name:$t,
    tool_input:(if $t == "Write" then {file_path:$f, content:$c}
                elif $t == "Edit" then {file_path:$f, old_string:"x", new_string:$c}
                else {file_path:$f} end), tool_use_id:"toolu_test"}'
}
post_json() { # $1 file_path
  jq -n --arg f "$1" '{session_id:"test", transcript_path:"/tmp/t.jsonl", cwd:"/repo",
    permission_mode:"default", hook_event_name:"PostToolUse", tool_name:"Edit",
    tool_input:{file_path:$f, old_string:"a", new_string:"b", replace_all:false},
    tool_response:{filePath:$f, success:true}, tool_use_id:"toolu_test"}'
}

check() { # $1 tên, $2 exit mong đợi, $3 hook, $4 json
  local got
  printf '%s' "$4" | "$HOOKS/$3" >"$TMP/out" 2>"$TMP/err"
  got=$?
  if [ "$got" -eq "$2" ]; then
    PASS=$((PASS + 1)); printf 'PASS  %-58s exit=%s\n' "$1" "$got"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-58s exit=%s (mong %s)\n' "$1" "$got" "$2"
    sed 's/^/      stderr: /' "$TMP/err" | head -3
  fi
}

echo "== guard-bash.sh =="
check "allow: forge build"                         0 guard-bash.sh "$(bash_json 'cd contracts && forge build')"
check "allow: forge test -vvv"                     0 guard-bash.sh "$(bash_json 'forge test -vvv')"
check "allow: deploy Fuji (alias fuji)"            0 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify')"
check "allow: deploy Fuji (\$FUJI_RPC_URL)"        0 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url "$FUJI_RPC_URL" --broadcast')"
check "allow: deploy nhiều dòng tới Fuji"          0 guard-bash.sh "$(bash_json $'forge script script/Deploy.s.sol \\\n  --rpc-url fuji \\\n  --broadcast')"
check "allow: cast call Fuji"                      0 guard-bash.sh "$(bash_json 'cast call 0x5425890298aed601595a70AB815c96711a31Bc65 "version()(string)" --rpc-url fuji')"
check "allow: cast send anvil local"               0 guard-bash.sh "$(bash_json 'cast send 0x0000000000000000000000000000000000000001 --value 1 --rpc-url http://127.0.0.1:8545')"
check "allow: lấy địa chỉ từ env (không in khóa)"  0 guard-bash.sh "$(bash_json 'cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY"')"
check "allow: ls .env.local"                       0 guard-bash.sh "$(bash_json 'ls -la .env.local')"
check "allow: cat .env.example"                    0 guard-bash.sh "$(bash_json 'cat .env.example')"
check "allow: commit nhắc tới .env.local"          0 guard-bash.sh "$(bash_json 'git commit -m "chore: ignore .env.local"')"
check "allow: grep process.env trong code"         0 guard-bash.sh "$(bash_json 'grep -rn "process.env" apps/web/lib')"
check "allow: pnpm --filter web dev"               0 guard-bash.sh "$(bash_json 'pnpm --filter web dev')"
check "allow: kiểm biến có/thiếu không in giá trị" 0 guard-bash.sh "$(bash_json 'for v in FUJI_RPC_URL DEPLOYER_PRIVATE_KEY; do [ -n "${!v:-}" ] && echo "$v: có" || echo "$v: THIẾU"; done')"
check "allow: quét file bí mật bị track"           0 guard-bash.sh "$(bash_json "git ls-files '*.env*' '*.pem' '*.key' '*keystore*'")"
check "allow: deploy local anvil"                  0 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast')"
check "block: test -n \$KHOA && echo (quá chặt, cố ý)" 2 guard-bash.sh "$(bash_json 'test -n "$DEPLOYER_PRIVATE_KEY" && echo set')"
check "block: RPC mainnet api.avax.network"        2 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url https://api.avax.network/ext/bc/C/rpc --broadcast')"
check "block: alias avalanche"                     2 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --rpc-url avalanche --broadcast')"
check "block: --chain 43114"                       2 guard-bash.sh "$(bash_json 'cast send 0xabc "f()" --rpc-url fuji --chain 43114')"
check "block: mainnet nhiều dòng"                  2 guard-bash.sh "$(bash_json $'forge script script/Deploy.s.sol \\\n  --rpc-url https://api.avax.network/ext/bc/C/rpc \\\n  --broadcast')"
check "block: broadcast không chỉ RPC"             2 guard-bash.sh "$(bash_json 'forge script script/Deploy.s.sol --broadcast')"
check "block: cast send không chỉ RPC"             2 guard-bash.sh "$(bash_json 'cast send 0xabc "f()"')"
check "block: echo khóa riêng"                     2 guard-bash.sh "$(bash_json 'echo $DEPLOYER_PRIVATE_KEY')"
check "block: printf secret Privy"                 2 guard-bash.sh "$(bash_json 'printf "%s" "${PRIVY_APP_SECRET}"')"
check "block: printenv"                            2 guard-bash.sh "$(bash_json 'printenv')"
check "block: env | grep KEY"                      2 guard-bash.sh "$(bash_json 'env | grep KEY')"
check "block: cat .env.local"                      2 guard-bash.sh "$(bash_json 'cat .env.local')"
check "block: source .env.local"                   2 guard-bash.sh "$(bash_json 'set -a && source .env.local && set +a')"
check "block: cp .env.example .env.local"          2 guard-bash.sh "$(bash_json 'cp .env.example .env.local')"
check "block: cat keystore Foundry"                2 guard-bash.sh "$(bash_json 'cat ~/.foundry/keystores/deployer')"
check "block: khóa hex trên dòng lệnh"             2 guard-bash.sh "$(bash_json "cast send 0xabc \"f()\" --rpc-url fuji --private-key 0x$HEX64")"
check "block: cast wallet new"                     2 guard-bash.sh "$(bash_json 'cast wallet new')"
check "block: node đọc process.env khóa"           2 guard-bash.sh "$(bash_json 'node -e "console.log(process.env.DEPLOYER_PRIVATE_KEY)"')"
check "block: git add -f"                          2 guard-bash.sh "$(bash_json 'git add -f .env.local')"

echo "== guard-secret-files.sh =="
check "block: Write .env.local"                    2 guard-secret-files.sh "$(file_json Write /repo/.env.local 'X=1')"
check "block: Edit apps/web/.env.local"            2 guard-secret-files.sh "$(file_json Edit /repo/apps/web/.env.local 'X=1')"
check "block: Read contracts/.env"                 2 guard-secret-files.sh "$(file_json Read /repo/contracts/.env)"
check "block: Write deployer.pem"                  2 guard-secret-files.sh "$(file_json Write /repo/keys/deployer.pem 'abc')"
check "block: Read ~/.foundry/keystores/x"         2 guard-secret-files.sh "$(file_json Read /home/u/.foundry/keystores/deployer)"
check "block: ghi PRIVATE_KEY=0x<64hex> vào .ts"   2 guard-secret-files.sh "$(file_json Write /repo/apps/keeper/src/config.ts "const DEPLOYER_PRIVATE_KEY = \"0x$HEX64\";")"
check "block: ghi khối PEM vào .md"                2 guard-secret-files.sh "$(file_json Write /repo/notes.md "$PEM_HDR")"
check "block: ghi API key Anthropic"               2 guard-secret-files.sh "$(file_json Edit /repo/apps/web/lib/ai.ts "const k = \"$ANT_KEY\";")"
check "allow: Write .env.example (giá trị rỗng)"   0 guard-secret-files.sh "$(file_json Write /repo/.env.example 'DEPLOYER_PRIVATE_KEY=')"
check "allow: Edit HuiCircle.sol"                  0 guard-secret-files.sh "$(file_json Edit /repo/contracts/src/HuiCircle.sol 'uint256 public constant MAX_MEMBERS = 30;')"
check "allow: bytes32 hằng số 64 hex (không phải khóa)" 0 guard-secret-files.sh "$(file_json Write /repo/contracts/test/V.t.sol "bytes32 constant H = 0x$HEX64;")"
check "allow: Read apps/web/lib/env.ts"            0 guard-secret-files.sh "$(file_json Read /repo/apps/web/lib/env.ts)"

echo "== sol-fmt-build.sh (forge giả) =="
mkdir -p "$TMP/bin" "$TMP/proj/contracts/src" "$TMP/proj/contracts/test"
printf '[profile.default]\nsrc = "src"\n' > "$TMP/proj/contracts/foundry.toml"
printf 'contract A {}\n' > "$TMP/proj/contracts/src/A.sol"
printf 'contract ATest {}\n' > "$TMP/proj/contracts/test/A.t.sol"
printf 'x\n' > "$TMP/proj/README.md"
cat > "$TMP/bin/forge" <<'STUB'
#!/usr/bin/env bash
echo "forge $*" >> "$FORGE_LOG"
case "$1" in
  fmt) grep -q SYNTAX_ERROR "$2" && { echo "Error: failed to parse $2"; exit 1; }; exit 0 ;;
  build) [ "${STUB_BUILD_RC:-0}" -eq 0 ] && exit 0; echo "Error (2314): Expected ';' but got '}'"; exit 1 ;;
esac
STUB
chmod +x "$TMP/bin/forge"
export FORGE_LOG="$TMP/forge.log"

PATH="$TMP/bin:$PATH" check "bỏ qua file không phải .sol"  0 sol-fmt-build.sh "$(post_json "$TMP/proj/README.md")"
[ -s "$TMP/out" ] && { FAIL=$((FAIL + 1)); echo "FAIL  có output với file không phải .sol"; }
: > "$FORGE_LOG"
PATH="$TMP/bin:$PATH" STUB_BUILD_RC=0 check "src/A.sol build OK: im lặng" 0 sol-fmt-build.sh "$(post_json "$TMP/proj/contracts/src/A.sol")"
if [ ! -s "$TMP/out" ] && grep -q 'forge build --skip test' "$FORGE_LOG"; then
  PASS=$((PASS + 1)); echo "PASS  src/: không output, đã gọi 'forge build --skip test'"
else
  FAIL=$((FAIL + 1)); echo "FAIL  src/: output hoặc lệnh build không như mong đợi"; cat "$FORGE_LOG"
fi
: > "$FORGE_LOG"
PATH="$TMP/bin:$PATH" STUB_BUILD_RC=1 check "test/A.t.sol build lỗi: exit 0" 0 sol-fmt-build.sh "$(post_json "$TMP/proj/contracts/test/A.t.sol")"
if jq -e '.hookSpecificOutput.hookEventName == "PostToolUse" and (.hookSpecificOutput.additionalContext | test("forge build")) and (.systemMessage | length > 0)' "$TMP/out" >/dev/null 2>&1 \
   && grep -qx 'forge build' "$FORGE_LOG"; then
  PASS=$((PASS + 1)); echo "PASS  test/: JSON additionalContext hợp lệ, build đầy đủ"
else
  FAIL=$((FAIL + 1)); echo "FAIL  test/: JSON hoặc lệnh build không như mong đợi"; cat "$TMP/out" "$FORGE_LOG"
fi
printf 'contract B { SYNTAX_ERROR }\n' > "$TMP/proj/contracts/src/B.sol"
PATH="$TMP/bin:$PATH" STUB_BUILD_RC=0 check "fmt lỗi cú pháp: exit 0 + JSON" 0 sol-fmt-build.sh "$(post_json "$TMP/proj/contracts/src/B.sol")"
if jq -e '.hookSpecificOutput.additionalContext | test("forge fmt")' "$TMP/out" >/dev/null 2>&1; then
  PASS=$((PASS + 1)); echo "PASS  fmt lỗi được báo qua additionalContext"
else
  FAIL=$((FAIL + 1)); echo "FAIL  fmt lỗi không được báo"; cat "$TMP/out"
fi

echo "== session-start.sh =="
ss() { HUISAFE_TODAY="$1" CLAUDE_PROJECT_DIR="$TMP/proj" "$HOOKS/session-start.sh" <<<'{"hook_event_name":"SessionStart","source":"startup"}' 2>&1; }
for case_ in "20261106|M0 Setup" "20261111|M2 Fuji + SDK" "20261112|M3 MVP E2E" "20261120|M7 Nộp" "20261121|Ngày dự phòng" "20261125|Đã qua hạn"; do
  d="${case_%%|*}"; want="${case_#*|}"
  if ss "$d" | grep -q "$want" && ss "$d" | grep -q 'LUẬT CỨNG'; then
    PASS=$((PASS + 1)); printf 'PASS  %-58s\n' "ngày $d -> $want"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-58s\n' "ngày $d -> $want"; ss "$d" | head -3
  fi
done

echo
echo "Tổng: $PASS PASS, $FAIL FAIL"
[ "$FAIL" -eq 0 ]
```

</details>

### 14.2. Kết quả đã chạy (06/11/2026)

| Hook | Số ca | Kết quả |
|---|---|---|
| `guard-bash.sh` | 35 (16 cho qua, 19 chặn) | PASS hết |
| `guard-secret-files.sh` | 12 (4 cho qua, 8 chặn) | PASS hết |
| `sol-fmt-build.sh` (forge giả) | 7 | PASS hết |
| `session-start.sh` (6 ngày khác nhau) | 6 | PASS hết |
| **Tổng** | **60** | **60 PASS, 0 FAIL** |

Kiểm thêm ngoài bộ test:

- `sol-fmt-build.sh` với Foundry thật (forge 1.7.1, solc 0.8.28): `forge fmt` sửa định dạng; lỗi kiểu (TypeError 7407) và lỗi cú pháp hiện đúng trong `additionalContext`.
- Bỏ `jq` và `python3` khỏi `PATH`: hai hook bảo vệ trả exit 2 (đóng khi lỗi). Chỉ có `python3`: chạy đúng.
- `shellcheck` sạch cho các script hook.
- `session-start.sh` với docs/11 thật: in đúng dòng mốc và dòng việc hôm nay.
- `claude doctor` với settings này: không cảnh báo; `claude plugin validate`: qua.

Thử tay một hook trong terminal của bạn (nếu nhờ Claude chạy, chính hook sẽ chặn lệnh có chuỗi mainnet, đó là hành vi đúng):

```bash
jq -n '{hook_event_name:"PreToolUse",tool_name:"Read",tool_input:{file_path:"apps/web/.env.local"}}' \
  | .claude/hooks/guard-secret-files.sh; echo "exit=$?"     # mong đợi exit=2

jq -n '{hook_event_name:"PreToolUse",tool_name:"Bash",tool_input:{command:"forge test -vvv"}}' \
  | .claude/hooks/guard-bash.sh; echo "exit=$?"             # mong đợi exit=0

HUISAFE_TODAY=20261110 CLAUDE_PROJECT_DIR="$PWD" .claude/hooks/session-start.sh </dev/null
```

### 14.3. Kiểm trong phiên thật (mỗi người làm một lần ở M0)

1. Mở `claude` ở gốc repo, chọn tin thư mục. Phải thấy dòng "HụiSafe - hôm nay ..." và mốc hiện tại. Gõ `/hooks`: thấy 4 hook ở mục 7.
2. Gõ: `Đọc file apps/web/.env.local`. Claude phải báo bị chặn (quy tắc deny và hook `guard-secret-files`).
3. Gõ: `Chạy forge script script/Deploy.s.sol --rpc-url https://api.avax.network/ext/bc/C/rpc --broadcast`. Phải bị chặn với thông điệp "HuiSafe guard".
4. Trên nhánh nháp, nhờ Claude thêm một lỗi cú pháp vào một file `.sol` thử. Sau lần sửa, thanh trạng thái hiện "forge fmt + forge build...", Claude nhận lỗi build và tự sửa. Xóa nhánh nháp.

Bước nào không đúng: chạy `claude --debug=hooks`, xem mục 16.

---

## 15. Chạy không tương tác và GitHub Actions

### 15.1. `claude -p`

```bash
# Hỏi nhanh, in kết quả rồi thoát
claude -p "Tóm tắt git diff main...HEAD theo mẫu PR ở docs/ai-workflow/03 mục 4"

# Kết quả JSON để script đọc
claude -p "Liệt kê test đỏ sau khi chạy forge test" --output-format json

# Chỉ cho đúng công cụ cần, từ chối mọi thứ khác thay vì hỏi
claude -p "Chạy forge test trong contracts và báo test đỏ" \
  --allowedTools "Bash(forge test *)" "Read" --permission-mode dontAsk
```

- `claude -p` trong thư mục chưa được tin sẽ bỏ qua quy tắc `allow` của dự án, nên luôn ghi rõ `--allowedTools`.
- Không dùng `--bare` với repo này: chế độ đó bỏ qua hooks, skills và CLAUDE.md, tức bỏ qua lớp bảo vệ.
- `--continue` hoặc `--resume <id>` để tiếp phiên trước; `--append-system-prompt` để thêm chỉ dẫn cho một lần chạy.

### 15.2. GitHub Actions

Cài nhanh: trong phiên `claude` ở repo, gõ `/install-github-app` rồi làm theo (cài GitHub App của Claude, thêm secret, tạo workflow). Cài tay: cài GitHub App của Claude cho repo; thêm secret `ANTHROPIC_API_KEY` (hoặc `CLAUDE_CODE_OAUTH_TOKEN` tạo bằng `claude setup-token` nếu dùng gói Pro/Max); thêm hai workflow dưới đây. Action là `anthropics/claude-code-action@v1`; các input chính: `prompt`, `claude_args`, `anthropic_api_key`, `claude_code_oauth_token`, `github_token`, `trigger_phrase`, `settings`, `plugin_marketplaces`, `plugins`.

`.github/workflows/claude.yml`: trả lời khi ai đó nhắc `@claude` trong issue hoặc PR (đúng ví dụ chính thức):

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
      actions: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

`.github/workflows/claude-review.yml`: tự review mỗi PR bằng plugin `code-review` (đúng ví dụ chính thức):

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          plugin_marketplaces: "https://github.com/anthropics/claude-code.git"
          plugins: "code-review@claude-code-plugins"
          prompt: "/code-review:code-review --comment ${{ github.repository }}/pull/${{ github.event.pull_request.number }}"
          claude_args: '--allowedTools "mcp__github_inline_comment__create_inline_comment"'
```

Ghi chú:

- `--comment` làm Claude đăng review lên PR (bình luận theo dòng, hoặc một bình luận tóm tắt). Dòng `claude_args` phải giữ: action chỉ bật server đăng bình luận theo dòng khi `--allowedTools` có tên nó.
- `id-token: write` cần cho cách xác thực mặc định qua GitHub App; `actions: read` cho Claude đọc kết quả CI.
- Repo public: GitHub không đưa secret cho run từ PR của fork, nên review chỉ chạy với PR từ nhánh trong repo.
- Action đọc CLAUDE.md của repo, nên luật cứng vẫn áp dụng. Việc hook trong `.claude/settings.json` có chạy trên runner hay không: kiểm tra lại ở lần chạy đầu (runner `ubuntu-latest` có sẵn `jq`).
- Ví dụ chính thức dùng `actions/checkout@v6`; CI của dự án (03-quy-trinh mục 6) dùng `@v7`. Giữ đúng như trên cho hai workflow này.
- Không bao giờ đưa khóa ví (deployer, relayer, attester, keeper) vào secret của các workflow Claude. Mỗi lần chạy tốn phút Actions và token API: chỉ bật review tự động khi cần, review PR của Claude như PR của người.

---

## 16. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Mọi Read, Edit, Bash đều bị chặn với thông báo "cần jq (hoặc python3)" | Máy thiếu `jq` và `python3` | Cài `jq` (`brew install jq`, `sudo apt install jq`) |
| Hook không chạy | Script chưa có quyền chạy, hoặc xuống dòng CRLF trên Windows | `chmod +x .claude/hooks/*.sh`; `git config core.autocrlf input` rồi chép lại; xem `/hooks`, `claude --debug=hooks` |
| Lệnh trong `allow` vẫn bị hỏi | Chưa tin thư mục, hoặc lệnh ghép có phần chưa được phép | Mở lại `claude`, chọn tin; xem `/permissions` |
| Hook chặn nhầm lệnh hợp lệ | Lệnh chứa tên biến bí mật hay chuỗi giống mainnet | Viết lại lệnh (ví dụ dùng vòng lặp kiểm biến ở CLAUDE.md); nếu thật sự cần, người tự chạy trong terminal riêng. Báo P3 để thêm ca vào `test-hooks.sh` |
| fmt/build sau mỗi lần sửa `.sol` chậm | Dự án lớn dần, build lại nhiều file | Hook đã bỏ build test khi sửa `src/`; nếu vẫn chậm, báo P3 chỉnh hook, không tắt hook |
| `/plan-milestone` hoặc `/audit` báo `Shell command failed for pattern` hoặc `Shell command permission check failed` | Chạy ngoài repo git, hoặc một lệnh chèn bị quy tắc deny/ask chặn | Mở `claude` ở gốc repo đã clone; xem `/permissions`; không thêm quy tắc chặn cho `git status`, `git log`, `git diff`, `git rev-parse` |
| SessionStart báo sai mốc | Lịch ở docs/11 đổi mà `MILESTONES` chưa đổi | Sửa `MILESTONES` trong `session-start.sh` |
| Cảnh báo CLAUDE.md quá dài | Thêm nội dung vào CLAUDE.md | Chuyển chi tiết sang docs, giữ dưới 200 dòng |
| MCP không kết nối | Thiếu `GITHUB_PAT`, token hết hạn, Node quá cũ | `/mcp`, `claude mcp list`, export lại biến |
| Claude làm sai luật dù CLAUDE.md có ghi | Ngữ cảnh dài, luật bị loãng | `/clear` và giao lại việc nhỏ hơn; bảng xử lý ở 03-quy-trinh mục 9 |

---

## 17. Nguồn (truy cập 06/11/2026)

Tài liệu Claude Code (code.claude.com):

- Cài đặt: <https://code.claude.com/docs/en/setup>
- CLAUDE.md và import: <https://code.claude.com/docs/en/memory>
- Settings: <https://code.claude.com/docs/en/settings>
- Quyền: <https://code.claude.com/docs/en/permissions>
- Chế độ quyền, plan mode: <https://code.claude.com/docs/en/permission-modes>
- Hooks (tham chiếu và hướng dẫn): <https://code.claude.com/docs/en/hooks>, <https://code.claude.com/docs/en/hooks-guide>
- Skills: <https://code.claude.com/docs/en/skills>
- Subagents: <https://code.claude.com/docs/en/sub-agents>
- Lệnh: <https://code.claude.com/docs/en/commands>
- Plugin: <https://code.claude.com/docs/en/plugins/create>
- MCP: <https://code.claude.com/docs/en/mcp>
- Chạy không tương tác: <https://code.claude.com/docs/en/headless>
- GitHub Actions: <https://code.claude.com/docs/en/github-actions>
- Checkpoint: <https://code.claude.com/docs/en/checkpointing>
- Model và effort: <https://code.claude.com/docs/en/model-config>
- Worktree: <https://code.claude.com/docs/en/worktrees>
- Danh sách công cụ: <https://code.claude.com/docs/en/tools-reference>

Khác:

- Playwright MCP: <https://github.com/microsoft/playwright-mcp>
- GitHub MCP server: <https://github.com/github/github-mcp-server>
- Bảo mật của Claude Code Action: <https://github.com/anthropics/claude-code-action/blob/main/docs/security.md>
- Cờ dòng lệnh đã đối chiếu thêm bằng `claude --help`, `claude mcp add --help`, `claude plugin --help` trên bản 2.1.318.
