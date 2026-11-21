import Link from 'next/link';
import { CircleDollarSign, FileCode2, KeyRound, Lock, ShieldCheck, Bot } from 'lucide-react';
import { Fragment, type CSSProperties } from 'react';
import { FUJI_EVIDENCE, fujiAddressUrl } from 'config';
import { BidCalc, CascadeDemo, CoverageDemo, DemoClock } from './DemoCards';
import { LogoMark } from '@/components/brand/LogoMark';
import { DemoChip } from '@/components/shell/DemoChip';
import { LandingMotion } from './LandingMotion';
import s from './landing.module.css';

const APP = '/circles';

/** Index of the "Tình huống" cards: each chip scrolls to its card (anchor; Lenis smooths it when it is loaded). */
const JUMPS = [
  ['th-hot-som', 'Muốn hốt sớm?'],
  ['th-bo-dong', 'Có người hốt rồi bỏ đóng?'],
  ['th-an-toan', 'Dây có an toàn không?'],
  ['th-tre-ky', 'Lỡ trễ một kỳ?'],
  ['th-chu-hui', 'Chủ hụi gian lận được không?'],
] as const;

const TILES = [
  { k: 1, who: 'M4', note: '288,48', state: 'done' },
  { k: 2, who: 'Đang thăm', note: 'trần 4,93', state: 'now' },
  { k: 3, who: '—', note: 'trần 3,28' },
  { k: 4, who: '—', note: 'trần 1,64' },
  { k: 5, who: '—', note: 'không thăm' },
] as const;

const STEPS = [
  {
    n: 1,
    label: '01 · Nộp thăm kín',
    title: 'Bạn ghi số tiền muốn bớt, rồi niêm phong.',
    body: 'Trình duyệt trộn số tiền với một chuỗi bí mật (salt) chỉ máy bạn giữ, rồi băm thành một hash (keccak256). On-chain chỉ có hash đó. Chủ hụi, người chơi khác và cả đội HụiSafe đều không đọc được bạn bỏ bao nhiêu.',
  },
  {
    n: 2,
    label: '02 · Mở thăm',
    title: 'Hết giờ nộp, mọi người mở thăm.',
    body: 'Bạn gửi lại số tiền cùng salt; smart contract băm lại và đối chiếu với hash đã niêm phong, sai một chữ số là không mở được. Thăm cao nhất thắng. Bằng nhau thì người ít lần trễ hơn thắng, rồi tới người nộp sớm hơn. Không bốc thăm, không ai chọn hộ.',
  },
  {
    n: 3,
    label: '03 · Chốt kỳ',
    title: 'Gom tiền và chi trong cùng một giao dịch.',
    body: 'Tới hạn, hợp đồng trích phần góp từ ví từng người theo quyền trích bạn đã ký lúc vào dây, trừ hoa hồng và quỹ dự phòng, giữ lại 20% của người hốt để phòng họ bỏ đóng về sau, rồi chuyển phần còn lại cho M1. Sau giao dịch, hợp đồng chỉ còn giữ ký quỹ, tiền giữ lại và quỹ dự phòng.',
  },
];

// Reserve split at the end of the worked example, branch A (docs/03 section 8.2, vector V1).
const SPLIT = [
  { m: 'M1', v: '4,146821', w: 100 },
  { m: 'M2', v: '4,146820', w: 100 },
  { m: 'M3', v: '4,146820', w: 100 },
  { m: 'M4', v: '3,110115', w: 75, late: true },
  { m: 'M5', v: '4,146820', w: 100 },
];

// Real circles on Fuji, scaled down 10 times (docs/DEPLOY-FUJI.md sections 15 and 15b).
const SHEETS = [
  {
    title: 'Dây có người vỡ nợ',
    address: FUJI_EVIDENCE.defaultCircle,
    red: true,
    rows: [
      ['Kỳ 1', 'M4 hốt, sau đó bỏ đóng', '28,848'],
      ['Kỳ 2', 'M4 thiếu 10: bù 8 từ giữ lại + 2 từ ký quỹ', '32,318'],
      ['Kỳ 3–5', 'Ký quỹ bù tiếp: 46 → 36 → 26 → 16', 'đủ'],
      ['Kết', 'Đánh dấu M4 vỡ nợ, tất toán dây', 'sổ khớp'],
    ],
  },
  {
    title: 'Dây cố định 3 người',
    address: FUJI_EVIDENCE.fixedCircle,
    red: false,
    rows: [
      ['Kỳ 1', 'Người vào đầu tiên hốt', '15,60'],
      ['Kỳ 2', 'Người thứ hai hốt', '17,60'],
      ['Kỳ 3', 'Người cuối hốt, nhận lại tiền giữ lại', '19,60'],
      ['Kết', 'Tất toán, số dư smart contract về 0', '0,00'],
    ],
  },
];

const CLOSE: [string, boolean][] = [
  ['Góp', false], ['đều.', false], ['Hốt', false], ['đủ.', false],
  ['Không', true], ['ai', true], ['cầm', true], ['tiền.', true],
];

const TECH = [
  {
    Icon: FileCode2,
    title: 'Smart contract trên Avalanche C-Chain',
    text: 'Mỗi dây là một smart contract Solidity riêng, tạo từ một factory contract. Mã nguồn đã verify công khai; ai cũng đọc được luật trên Snowtrace.',
    why: 'Giao dịch chốt sau khoảng 1-2 giây, phí thấp, và tương thích EVM nên dùng được công cụ Ethereum quen thuộc.',
    link: true,
  },
  {
    Icon: CircleDollarSign,
    title: 'Tiền góp bằng USDC',
    text: 'Đồng stablecoin USDC do Circle phát hành, giá trị neo 1:1 với đô la Mỹ. Bản trên Fuji là USDC thử nghiệm (testnet), không có giá trị.',
    why: 'USDC có permit (EIP-2612), nên vào dây chỉ cần ký một lần.',
    link: false,
  },
  {
    Icon: KeyRound,
    title: 'Đăng nhập không cần ví crypto',
    text: 'Ví Privy (embedded wallet) được tạo sẵn khi bạn đăng nhập bằng Google hoặc email. Bạn chỉ ký; phí mạng do relayer của HụiSafe trả (chuẩn ERC-2771).',
    why: 'Đăng nhập Google hoặc email là có ví, người mới không phải học seed phrase.',
    link: false,
  },
  {
    Icon: Lock,
    title: 'Thăm kín bằng commit-reveal',
    text: 'Nộp hash trước, mở số thật sau. Không ai sửa được thăm sau khi đã nộp, cũng không ai đọc được trước giờ mở.',
    why: 'Smart contract giữ kín thăm tới giờ mở, nên không cần một người cầm phong bì.',
    link: false,
  },
  {
    Icon: ShieldCheck,
    title: 'Kiểm thử và kiểm toán (audit)',
    text: '632 bài test Foundry, trong đó 54 invariant về tiền (điều kiện về tiền luôn phải đúng) được kiểm bằng fuzz test. Audit bảo mật không còn lỗi mức Critical hay High.',
    why: 'Dùng thư viện OpenZeppelin, đã được audit và dùng rộng rãi; Foundry chạy fuzz và invariant test.',
    link: false,
  },
  {
    Icon: Bot,
    title: 'Trợ lý AI chỉ tính, không ký',
    text: 'Trợ lý chủ hụi dùng hàm tính tất định để trả lời về rủi ro, ký quỹ, trần thăm. Nó không ký giao dịch và không chuyển được tiền.',
    why: 'Số liệu lấy từ hàm tính của HụiSafe; mô hình AI chỉ viết lời giải thích.',
    link: false,
  },
] as const;

const PARTNERS = ['Avalanche', 'Circle USDC', 'Privy', 'OpenZeppelin', 'Foundry'];

const MARQUEE = ['Smart contract trên Avalanche', 'Tiền góp bằng USDC', 'Không ai cầm tiền', 'Sổ hụi công khai'];

function Arrow({ dir }: { dir: '↗' | '↓' }) {
  return (
    <span className={s.arr} aria-hidden>
      {dir}
    </span>
  );
}

/**
 * S01 landing. Every band is its own design (chip hero, sticky ballot story, colour bento, ledger, word scrub), sharing
 * one palette and type system that the web app will adopt. Numbers in the playable cards come from `lib/landing-demo`.
 */
/**
 * Neutomni-style intro, rendered with the page so it covers the very first paint (no flash of the hero). Pure CSS
 * keyframes drive it, so it finishes even if the motion libraries never load; LandingMotion only handles "Bỏ qua" and
 * starts the hero entrance when the curtain lifts. Hidden under prefers-reduced-motion.
 */
function Intro() {
  return (
    <div className={s.intro} data-lp-intro aria-hidden="true">
      <div className={s.introBg} data-lp-intro-bg />
      <div className={s.introWord} data-lp-intro-word>
        <span>H</span>
        <span>
          U<i className={s.introCoin} />
        </span>
        <span>I</span>
        {/* Ink copy of the word: fading it in turns the letters dark on the way to the logo (opacity is composited,
            colour is not, so the flight never drops frames). */}
        <div className={s.introInk} data-lp-intro-ink>
          <span>H</span>
          <span>U</span>
          <span>I</span>
        </div>
      </div>
      <div className={s.introSub} data-lp-intro-sub>
        <span>Hụi bỏ thăm on-chain</span>
        <button type="button" className={s.introSkip} tabIndex={-1} data-lp-skip>
          Bỏ qua
        </button>
      </div>
    </div>
  );
}

type Photo = { src: string; w: number; h: number };

/**
 * Two photographs set into each other beside a section head. Decorative: hidden from assistive technology and from
 * narrow screens (the head fills the row there). Motion is CSS only and stops under `prefers-reduced-motion`.
 */
function PhotoStack({ back, front, tag, credit, flip }: { back: Photo; front: Photo; tag: string; credit: string; flip?: boolean }) {
  return (
    <figure className={s.photoStack} data-flip={flip ? '1' : undefined} aria-hidden>
      <img className={s.photoBack} src={back.src} alt="" width={back.w} height={back.h} loading="lazy" decoding="async" />
      <img className={s.photoFront} src={front.src} alt="" width={front.w} height={front.h} loading="lazy" decoding="async" />
      <span className={s.photoTag}>{tag}</span>
      <figcaption className={s.photoCredit}>{credit}</figcaption>
    </figure>
  );
}

export function Landing({ sample, factory }: { sample: boolean; factory?: `0x${string}` }) {
  return (
    <>
      <Intro />
      <div data-lp-root className={s.root}>
        <nav className={s.nav} aria-label="Trang giới thiệu">
          <div className={`${s.wrap} ${s.navIn}`}>
            <div className={s.brand}>
              <a className={s.logo} href="#top" aria-label="HụiSafe, lên đầu trang">
                <LogoMark className={s.logoIcon} height={26} />
                <span className={s.logoMark} data-lp-mark>
                  HụiSafe
                </span>
              </a>
              <span data-lp-navitem>
                <DemoChip sample={sample} />
              </span>
            </div>
            <div className={s.links} data-lp-navitem>
              <a href="#mot-ky">Một kỳ hụi</a>
              <a href="#tinh-huong">Tình huống</a>
              <a href="#cong-nghe">Công nghệ</a>
              <a href="#so-cai">Sổ cái</a>
            </div>
            <Link className={`${s.btn} ${s.lime}`} href={APP} data-lp-navitem>
              Mở app <Arrow dir="↗" />
            </Link>
          </div>
        </nav>

        <main id="noi-dung">
          <header className={s.hero} id="top" data-lp-hero>
            <div className={s.wrap}>
              <div className={s.heroTop}>
                <div>
                  <p className={`${s.label} ${s.eyebrow}`}>
                    <b>Testnet</b> Hụi bỏ thăm chạy bằng smart contract trên Avalanche
                  </p>
                  <h1>
                    <span className={s.line}>
                      <span data-lp-line>Chơi hụi</span>
                    </span>{' '}
                    <span className={s.line}>
                      <span data-lp-line>không sợ</span>
                    </span>{' '}
                    <span className={s.line}>
                      <span data-lp-line className={s.strike} data-lp-strike>
                        giựt.
                      </span>
                    </span>
                  </h1>
                </div>
                <div className={s.side}>
                  <ul className={s.bubbles} aria-label="Tin nhắn trong nhóm của một dây hụi">
                    <li className={s.bw} data-lp-bubble>
                      <span className={s.bubble}>
                        <i>M2</i>“Kỳ này em bỏ thăm 3 đồng”
                      </span>
                    </li>
                    <li className={s.bw} data-lp-bubble>
                      <span className={s.bubble}>
                        <i>M4</i>“Lỡ trễ, mai em đóng bù nha”
                      </span>
                    </li>
                    <li className={s.bw} data-lp-bubble>
                      <span className={`${s.bubble} ${s.org}`}>
                        <i>Chủ hụi</i>“Ký quỹ 480 đã khóa, yên tâm”
                      </span>
                    </li>
                  </ul>
                  <div className={s.badge} data-lp-badge role="img" aria-label="Con dấu HụiSafe: bảo chứng 100%, không ai cầm tiền">
                    <div className={s.badgeRing} data-lp-badge-ring>
                      <svg className={s.spinSvg} viewBox="0 0 200 200" aria-hidden>
                        <defs>
                          <path id="lp-seal-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
                        </defs>
                        <circle className={s.ring} cx="100" cy="100" r="96" />
                        <text>
                          <textPath href="#lp-seal-path" textLength="486" lengthAdjust="spacing">
                            Bảo chứng 100% · Không ai cầm tiền · Hụi on-chain ·
                          </textPath>
                        </text>
                      </svg>
                    </div>
                    {/* The lá thăm logo, in layers so GSAP can seal it once: body slides in, flap folds down, the seal stamps. */}
                    <svg className={s.logoSvg} data-lp-logo viewBox="160 290 704 452" fill="none" aria-hidden focusable="false">
                      <g data-lp-env>
                        <rect x="174" y="304" width="676" height="424" rx="6" fill="#f4f0e8" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" />
                      </g>
                      <path data-lp-flap d="M174 430 L212 530 H812 L850 430" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                      <g data-lp-stamp>
                        <circle cx="512" cy="532" r="100" fill="#a1ff62" stroke="currentColor" strokeWidth="12" />
                        <path d="M482 484 V539 A30 30 0 0 0 542 539 V484" stroke="currentColor" strokeWidth="28" />
                      </g>
                    </svg>
                  </div>
                  <p data-lp-side>
                    HụiSafe đưa luật của một dây hụi vào smart contract trên blockchain Avalanche. Tiền góp ở trong ví (wallet) của bạn tới đúng lúc chi; chủ hụi không giữ đồng nào nhưng phải khóa ký quỹ để bảo lãnh. Ai bỏ đóng, hợp đồng lấy ký quỹ bù ngay, không cần ai đồng ý.
                  </p>
                  <div className={s.ctaPair} data-lp-side>
                    <Link className={`${s.btn} ${s.lime}`} href={APP}>
                      Chơi hụi ngay <Arrow dir="↗" />
                    </Link>
                    <a className={`${s.btn} ${s.ghost}`} href="#mot-ky">
                      Xem một kỳ hụi chạy <Arrow dir="↓" />
                    </a>
                  </div>
                  <p className={s.ctaNote} data-lp-side>
                    Đăng nhập bằng Google hoặc email. Không cần ví crypto, không cần AVAX.
                  </p>
                </div>
              </div>

              <figure className={s.stage} data-lp-stage aria-label="Xem trước web app: phòng bỏ thăm của một dây mẫu">
                <div className={s.app}>
                  <div className={s.appBar} aria-hidden>
                    <i />
                    <i />
                    <i />
                    <span>huisafe.app/circles/to-dan-pho-7</span>
                  </div>
                  <div className={s.appBody}>
                    <div className={s.appHead}>
                      <div>
                        <small>Dây mẫu · 5 người × 100 USDC</small>
                        <h3>Tổ dân phố 7 · Kỳ 2/5</h3>
                      </div>
                      <DemoClock />
                    </div>
                    <ol className={s.phases}>
                      <li className={s.on}>1 · Nộp thăm kín</li>
                      <li>2 · Mở thăm</li>
                      <li>3 · Chốt kỳ</li>
                    </ol>
                    <div className={s.timeline}>
                      <ol className={s.track} aria-label="Các kỳ của dây">
                        {TILES.map((t) => (
                          <li key={t.k} data-lp-tile className={`${s.tile} ${'state' in t ? s[t.state] : ''}`}>
                            <span>Kỳ {t.k}</span>
                            <b>{t.who}</b>
                            <span className={s.mono}>{t.note}</span>
                          </li>
                        ))}
                        <li className={s.playhead} data-lp-playhead aria-hidden />
                      </ol>
                    </div>
                    <p className={s.appFoot}>
                      <span>
                        Ký quỹ chủ hụi <strong>480 USDC</strong>
                      </span>
                      <span>
                        Quỹ dự phòng <strong>3,76 USDC</strong>
                      </span>
                    </p>
                  </div>
                </div>
              </figure>
            </div>
          </header>

          <section className={s.story} id="mot-ky" data-lp-story data-state="1" aria-labelledby="lp-story-h">
            <div className={s.wrap}>
              <div className={s.headRow}>
                <div className={s.head} data-lp-head>
                  <p className={s.label}>Một kỳ hụi trên blockchain</p>
                  <h2 id="lp-story-h">Một kỳ hụi chạy thế nào on-chain</h2>
                  <p>Cuộn xuống để xem kỳ 2 của dây mẫu Tổ dân phố 7, từ lúc nộp thăm tới lúc chi tiền.</p>
                </div>
                <PhotoStack
                  back={{ src: '/photos/ben-thanh-hall.webp', w: 960, h: 720 }}
                  front={{ src: '/photos/ben-thanh-aisle.webp', w: 800, h: 1000 }}
                  tag="Hụi của chợ, của xóm"
                  credit="Chợ Bến Thành, TP.HCM. Ảnh: Bahnfrend, CC BY-SA 4.0"
                />
              </div>
              <div className={s.storyGrid}>
                <div className={s.slipCol}>
                  <div className={s.slipScene}>
                    <div className={s.slip} data-lp-slip role="img" aria-label="Lá thăm kỳ 2 của M1: 3,00 USDC">
                      <div className={s.slipPaper} aria-hidden>
                        <div className={s.slipRow}>
                          <span>Thăm kỳ 2</span>
                          <span>Tổ dân phố 7</span>
                        </div>
                        <div className={s.slipBid}>
                          3,00<small>USDC</small>
                        </div>
                        <div className={s.slipRow}>
                          <span>M1 · nộp lúc 00:42</span>
                          <span>trần 4,93</span>
                        </div>
                      </div>
                      <div className={s.cover} aria-hidden>
                        <span className={s.coverNote}>Kỳ 2 · niêm phong on-chain</span>
                        <span className={s.coverNote}>M1</span>
                      </div>
                      <div className={s.flap} aria-hidden>
                        <div className={s.flapFront} />
                        <div className={s.seal}>
                          THĂM
                          <br />
                          KÍN
                        </div>
                      </div>
                      <div className={s.stamp} aria-hidden>
                        M1 ĐÃ HỐT<small>nhận 323,18 USDC</small>
                      </div>
                    </div>
                  </div>
                  <div className={s.dots} aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <ol className={s.steps} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {STEPS.map((st) => (
                    <li key={st.n} className={s.step} data-step={st.n}>
                      <p className={s.label}>{st.label}</p>
                      <h3>{st.title}</h3>
                      <p>{st.body}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className={s.bento} id="tinh-huong" aria-labelledby="lp-bento-h">
            <div className={s.wrap}>
              <div className={s.head} data-lp-head>
                <p className={s.label}>Tình huống thường gặp</p>
                <h2 id="lp-bento-h">Gặp chuyện thì smart contract xử lý ra sao</h2>
                <p>Số liệu từ dây mẫu 5 người, mỗi kỳ góp 100 USDC. Ô nào cũng bấm hoặc gõ thử được; phép tính dùng đúng công thức của smart contract.</p>
              </div>
              <ul className={s.chips} aria-label="Chọn một tình huống để xem">
                {JUMPS.map(([id, text]) => (
                  <li key={id} className={s.chip}>
                    <a href={`#${id}`}>{text}</a>
                  </li>
                ))}
              </ul>
              <ul className={s.cards} data-lp-cards>
                <li id="th-hot-som" className={`${s.card} ${s.cLime} ${s.w3}`} data-lp-card>
                  <p className={s.label}>Khi bỏ thăm</p>
                  <h3>
                    <q>Muốn hốt sớm thì sao?</q>
                  </h3>
                  <p>Bỏ thăm nghĩa là chịu bớt cho mỗi người còn lại một khoản để được hốt trước. Hợp đồng chặn thăm vượt trần lãi theo Nghị định 19/2019, nên không ai bị ép trả lãi cắt cổ.</p>
                  <BidCalc />
                </li>
                <li id="th-bo-dong" className={`${s.card} ${s.cViolet} ${s.w3}`} data-lp-card>
                  <p className={s.label}>Khi có người bỏ đóng</p>
                  <h3>
                    <q>M4 hốt rồi bỏ đóng?</q>
                  </h3>
                  <p>Tới hạn mà không trích được tiền của M4, hợp đồng bù ngay trong chính giao dịch chốt kỳ: lấy tiền giữ lại của M4 trước, thiếu nữa mới lấy ký quỹ của chủ hụi. Người hốt kỳ đó vẫn nhận đủ.</p>
                  <CascadeDemo />
                </li>
                <li id="th-an-toan" className={`${s.card} ${s.cPaper} ${s.w2}`} data-lp-card>
                  <p className={s.label}>Trước khi vào dây</p>
                  <h3>
                    <q>Dây này có an toàn không?</q>
                  </h3>
                  <CoverageDemo />
                  <p>Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc. Dưới 100%, hợp đồng không cho bắt đầu dây.</p>
                </li>
                <li id="th-tre-ky" className={`${s.card} ${s.cClay} ${s.w2}`} data-lp-card>
                  <p className={s.label}>Khi lỡ trễ</p>
                  <h3>
                    <q>Trễ một kỳ thì sao?</q>
                  </h3>
                  <dl className={`${s.mini} ${s.split}`} aria-label="Chia quỹ dự phòng cuối dây theo đúng hạn, USDC">
                    {SPLIT.map((r) => (
                      <div key={r.m} data-lp-split-row className={'late' in r ? s.late : undefined}>
                        <dt>{r.m}</dt>
                        <span className={s.bar} aria-hidden>
                          <i style={{ '--w': r.w / 100 } as CSSProperties} />
                        </span>
                        <dd>{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>Bạn có 48 giờ ân hạn để đóng bù kèm lãi chậm góp (bản demo: 2 phút). Cuối dây, quỹ dự phòng 19,70 USDC chia theo số lần đóng đúng hạn: M4 trễ một kỳ nên mất 0,83 USDC, gấp khoảng 30 lần lãi chậm góp.</p>
                </li>
                <li id="th-chu-hui" className={`${s.card} ${s.cForest} ${s.w2}`} data-lp-card>
                  <p className={s.label}>Khi nghi chủ hụi</p>
                  <h3>
                    <q>Chủ hụi dùng ví ảo?</q>
                  </h3>
                  <dl className={`${s.mini} ${s.sy}`} aria-label="Kết quả của chủ hụi khi dùng ví ảo, USDC">
                    <div>
                      <dt>1 ví ảo, cọc 100%</dt>
                      <dd className={s.loss}>lỗ 18,04</dd>
                    </div>
                    <div>
                      <dt>2 ví ảo, cọc 100%</dt>
                      <dd className={s.gain}>lời 41,47</dd>
                    </div>
                  </dl>
                  <p>
                    Cọc 100% chặn được chủ hụi dùng một ví ảo: làm vậy chủ hụi tự lỗ. Dùng nhiều ví ảo thì bị chặn bằng xác thực mỗi người một tài khoản, và mọi người thấy
                    trước rủi ro tối đa của mình.
                  </p>
                </li>
              </ul>
            </div>
          </section>

          <section className={s.tech} id="cong-nghe" aria-labelledby="lp-tech-h">
            <div className={s.wrap}>
              <div className={`${s.head} ${s.headLight}`} data-lp-head>
                <p className={s.label}>Chạy bằng gì</p>
                <h2 id="lp-tech-h">Công nghệ phía sau HụiSafe</h2>
              </div>
              <ul className={s.partners} aria-label="Công nghệ và đối tác">
                {PARTNERS.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <ul className={s.techGrid} data-lp-tech>
                {TECH.map((t) => (
                  <li key={t.title} className={s.techCard} data-lp-tech-card>
                    <span className={s.techIcon}>
                      <t.Icon aria-hidden />
                    </span>
                    <h3>{t.title}</h3>
                    <p>{t.text}</p>
                    <p className={s.techWhy}>
                      <span>Vì sao chọn</span>
                      {t.why}
                    </p>
                    {t.link && factory && (
                      <a className={s.techLink} href={fujiAddressUrl(factory)} target="_blank" rel="noopener noreferrer">
                        Xem factory contract trên Snowtrace <Arrow dir="↗" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <p className={s.techFoot}>Dự thi Avalanche Team1 Vietnam UniHack 2026, nhánh Social finance.</p>
            </div>
          </section>

          <section className={s.ledger} id="so-cai" aria-labelledby="lp-ledger-h">
            <div className={s.wrap}>
              <div className={s.headRow}>
                <div className={s.head} data-lp-head>
                  <p className={s.label}>Đã chạy thật, kiểm được</p>
                  <h2 id="lp-ledger-h">Sổ cái thật, trên Avalanche Fuji.</h2>
                  <p>Hai dây do nhóm chạy bằng ví demo, số tiền thu nhỏ 10 lần. Mỗi dòng mở ra giao dịch tương ứng trên Snowtrace.</p>
                </div>
                <PhotoStack
                  back={{ src: '/photos/ben-thanh-fruit.webp', w: 800, h: 1000 }}
                  front={{ src: '/photos/cho-lon-stall.webp', w: 960, h: 720 }}
                  tag="Tiền ngoài chợ, sổ trên chuỗi"
                  credit="Ảnh: Bahnfrend (CC BY-SA 4.0), Andre Hospers (CC BY 4.0)"
                  flip
                />
              </div>
              <div className={s.book}>
                {SHEETS.map((sh) => (
                  <a key={sh.address} className={s.sheet} data-lp-sheet href={fujiAddressUrl(sh.address)} target="_blank" rel="noopener noreferrer">
                    <div className={s.sheetHead}>
                      <h3>{sh.title}</h3>
                      <span className={sh.red ? `${s.pill} ${s.red}` : s.pill}>Đã tất toán</span>
                    </div>
                    {sh.rows.map(([k, what, amount]) => (
                      <div key={k} className={s.entry} data-lp-entry>
                        <span>{k}</span>
                        <span>{what}</span>
                        <span>{amount}</span>
                      </div>
                    ))}
                    <div className={s.addr}>{sh.address}</div>
                  </a>
                ))}
              </div>
            </div>
            <div className={s.marquee} aria-hidden>
              <div className={s.marqueeTrack}>
                {[...MARQUEE, ...MARQUEE].map((m, i) => (
                  <span key={i}>{m}</span>
                ))}
              </div>
            </div>
          </section>

          <section className={s.closing} aria-labelledby="lp-close-h">
            <div className={s.wrap}>
              <p className={s.label}>Hụi của xóm, sổ on-chain</p>
              <h2 id="lp-close-h" data-lp-close>
                {CLOSE.map(([w, em]) => (
                  <Fragment key={w}>
                    <span className={em ? `${s.word} ${s.em}` : s.word} data-lp-word>
                      {w}
                    </span>{' '}
                  </Fragment>
                ))}
              </h2>
              <Link className={`${s.btn} ${s.lime}`} href={APP}>
                Mở HụiSafe <Arrow dir="↗" />
              </Link>
            </div>
          </section>
        </main>

        <footer className={s.wrap} style={{ paddingBottom: 40 }}>
          <div className={s.foot}>
            <span>HụiSafe · UniHack 2026 · Social finance</span>
            <nav aria-label="Vào web app">
              <Link href="/circles">Dây của tôi</Link>
              <Link href="/circles/new">Tạo dây</Link>
              <Link href="/lab">Phòng mô phỏng</Link>
              <Link href="/dang-nhap">Đăng nhập</Link>
            </nav>
            <span>Testnet, không dùng tiền thật. Trần lãi theo cách hiểu của nhóm về NĐ 19/2019, chờ luật sư xác nhận.</span>
          </div>
        </footer>
        <LandingMotion />
      </div>
    </>
  );
}
