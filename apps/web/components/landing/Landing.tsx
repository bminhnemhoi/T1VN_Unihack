import Link from 'next/link';
import { Fragment, type CSSProperties } from 'react';
import { FUJI_EVIDENCE, fujiAddressUrl } from 'config';
import { BidCalc, CascadeDemo, CoverageDemo, DemoClock } from './DemoCards';
import { DEMO_BUILD } from '@/components/shell/DemoBanner';
import { vi } from '@/lib/vi';
import { LandingMotion } from './LandingMotion';
import s from './landing.module.css';

const APP = '/circles';

const CHIPS: { text: string; tone?: 'hot' | 'warn' }[] = [
  { text: 'Kỳ này ai hốt?' },
  { text: 'Bỏ thăm 3 đồng', tone: 'hot' },
  { text: 'Ký quỹ còn bao nhiêu?' },
  { text: 'Cô Tư giựt hụi rồi!', tone: 'warn' },
  { text: 'Trễ một kỳ có sao không?' },
  { text: 'Hụi chết hay hụi sống?' },
  { text: 'Bảo chứng 100%', tone: 'hot' },
  { text: 'Chốt kỳ lúc mấy giờ?' },
];

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
    title: 'Bạn gấp thăm. Không ai nhìn trộm được.',
    body: 'Bạn ghi số tiền muốn bớt cho mọi người, rồi gửi lên chuỗi một mã niêm phong. Chủ hụi, người chơi khác, cả HụiSafe đều không đọc được số bên trong.',
  },
  {
    n: 2,
    label: '02 · Mở thăm',
    title: 'Hết giờ, mọi lá thăm mở cùng lúc.',
    body: 'Thăm cao nhất thắng. Bằng nhau thì người ít trễ hơn, rồi người nộp sớm hơn. Không có bốc thăm ngẫu nhiên, không ai chọn hộ.',
  },
  {
    n: 3,
    label: '03 · Chốt kỳ',
    title: 'Kéo tiền góp, chi ngay trong một giao dịch.',
    body: 'Hợp đồng kéo phần góp từ ví từng người, trích hoa hồng và quỹ dự phòng, giữ lại 20% phòng khi người hốt bỏ đóng, rồi chuyển phần còn lại cho M1.',
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
      ['Kết', 'Tất toán, số dư hợp đồng về 0', '0,00'],
    ],
  },
];

const CLOSE: [string, boolean][] = [
  ['Góp', false], ['đều.', false], ['Hốt', false], ['đủ.', false],
  ['Không', true], ['ai', true], ['cầm', true], ['tiền.', true],
];

const MARQUEE = ['Sổ cái công khai', 'Không ai cầm tiền', 'Bảo chứng 100%', 'Chạy thật trên Fuji'];

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
 * Demo strip of the landing: same facts and role as the app's DemoBanner (docs/02 US-10, cannot be dismissed), set as
 * one quiet line in the landing palette instead of two full-width bars. `sample` = nothing deployed on this network.
 */
function DemoStrip({ sample }: { sample: boolean }) {
  if (!DEMO_BUILD && !sample) return null;
  const facts = vi.demoBanner.replace('Chế độ demo:', '').replace(' Màn hình này dùng số liệu mẫu.', '');
  return (
    <div className={s.demo}>
      <div className={`${s.wrap} ${s.demoIn}`}>
        <span className={s.demoTag} aria-hidden="true">
          Chế độ demo
        </span>
        <p role="status" data-testid="demo-banner" className={s.demoText} title={facts.trim()}>
          <span className={s.srOnly}>Chế độ demo:</span>
          {facts}
        </p>
        {sample && (
          <p role="note" data-testid="sample-mode" className={s.demoSample}>
            Đang xem dữ liệu mẫu
          </p>
        )}
      </div>
    </div>
  );
}

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

export function Landing({ sample }: { sample: boolean }) {
  return (
    <>
      <Intro />
      <div data-lp-root className={s.root}>
        <DemoStrip sample={sample} />
        <nav className={s.nav} aria-label="Trang giới thiệu">
          <div className={`${s.wrap} ${s.navIn}`}>
            <a className={s.logo} href="#top" aria-label="HụiSafe, lên đầu trang">
              <span className={s.logoMark} data-lp-mark>
                H
                <span className={s.logoU}>
                  U<i />
                </span>
                I
              </span>
              <small data-lp-navitem>SAFE</small>
            </a>
            <div className={s.links} data-lp-navitem>
              <a href="#mot-ky">Một kỳ hụi</a>
              <a href="#tinh-huong">Tình huống</a>
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
                    <b>Testnet</b> Hụi bỏ thăm on-chain · Avalanche Fuji
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
                      <svg viewBox="0 0 200 200" aria-hidden>
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
                    <div className={s.core} data-lp-badge-core>
                      <b>
                        U<i />
                      </b>
                    </div>
                  </div>
                  <p data-lp-side>
                    Chủ hụi không cầm tiền, nhưng vẫn phải bảo lãnh. Tiền góp nằm trong ví bạn tới đúng lúc chi. Ai bỏ đóng thì ký quỹ của chủ hụi bù ngay.
                  </p>
                  <div className={s.ctaPair} data-lp-side>
                    <Link className={`${s.btn} ${s.lime}`} href={APP}>
                      Chơi hụi ngay <Arrow dir="↗" />
                    </Link>
                    <a className={`${s.btn} ${s.ghost}`} href="#mot-ky">
                      Xem một kỳ hụi chạy <Arrow dir="↓" />
                    </a>
                  </div>
                </div>
              </div>

              <ul className={s.chips} aria-label="Những câu người chơi hụi hay hỏi">
                {CHIPS.map((c) => (
                  <li key={c.text} data-lp-chip className={`${s.chip} ${c.tone ? s[c.tone] : ''}`}>
                    {c.text}
                  </li>
                ))}
              </ul>

              <figure className={s.stage} data-lp-stage style={{ marginBlock: 0 }} aria-label="Xem trước web app: phòng bỏ thăm của một dây mẫu">
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
              <div className={s.head} data-lp-head>
                <p className={s.label}>Một kỳ hụi, ba bước</p>
                <h2 id="lp-story-h">Lá thăm gấp lại. Chuỗi khối giữ bí mật.</h2>
                <p>Cuộn xuống để xem kỳ 2 của dây Tổ dân phố 7 chạy từ đầu tới cuối.</p>
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
                        <span className={s.coverNote}>Kỳ 2 · niêm phong trên chuỗi</span>
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
                <p className={s.label}>Mọi tình huống của một dây hụi</p>
                <h2 id="lp-bento-h">Câu hỏi của bạn. Hợp đồng trả lời.</h2>
                <p>Số liệu lấy từ dây ví dụ 5 người × 100 USDC trong đặc tả của HụiSafe. Bấm, kéo, gõ thử.</p>
              </div>
              <ul className={s.cards} data-lp-cards>
                <li className={`${s.card} ${s.cLime} ${s.w3}`} data-lp-card>
                  <p className={s.label}>Bạn, lúc bỏ thăm</p>
                  <h3>
                    <q>Muốn hốt sớm thì sao?</q>
                  </h3>
                  <p>Trả bớt cho mỗi người còn lại. Trần theo Nghị định 19, vượt là bị chặn.</p>
                  <BidCalc />
                </li>
                <li className={`${s.card} ${s.cViolet} ${s.w3}`} data-lp-card>
                  <p className={s.label}>Bạn, khi có người bỏ đóng</p>
                  <h3>
                    <q>M4 hốt rồi trốn!</q>
                  </h3>
                  <p>Phần thiếu được bù ngay trong cùng giao dịch: tiền giữ lại của chính M4 trước, rồi ký quỹ của chủ hụi.</p>
                  <CascadeDemo />
                </li>
                <li className={`${s.card} ${s.cPaper} ${s.w2}`} data-lp-card>
                  <p className={s.label}>Bạn, trước khi vào dây</p>
                  <h3>
                    <q>Dây này an toàn không?</q>
                  </h3>
                  <CoverageDemo />
                  <p>Chỉ số bảo chứng 100% nghĩa là ký quỹ chịu được cú sốc lớn nhất: mọi người đã hốt cùng bỏ đóng một lúc.</p>
                </li>
                <li className={`${s.card} ${s.cClay} ${s.w2}`} data-lp-card>
                  <p className={s.label}>Bạn, khi lỡ trễ</p>
                  <h3>
                    <q>Trễ một kỳ thì sao?</q>
                  </h3>
                  <dl className={`${s.mini} ${s.split}`} aria-label="Chia quỹ dự phòng cuối dây theo đúng hạn, USDC">
                    {SPLIT.map((r) => (
                      <div key={r.m} className={'late' in r ? s.late : undefined}>
                        <dt>{r.m}</dt>
                        <span className={s.bar} aria-hidden>
                          <i style={{ '--w': r.w / 100 } as CSSProperties} />
                        </span>
                        <dd>{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>Cuối dây, quỹ dự phòng 19,70 USDC chia theo đúng hạn. M4 trễ một kỳ nên mất 0,83 USDC, gấp khoảng 30 lần lãi chậm góp.</p>
                </li>
                <li className={`${s.card} ${s.cForest} ${s.w2}`} data-lp-card>
                  <p className={s.label}>Bạn, khi nghi chủ hụi</p>
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

          <section className={s.ledger} id="so-cai" aria-labelledby="lp-ledger-h">
            <div className={s.wrap}>
              <div className={s.head} data-lp-head>
                <p className={s.label}>Không phải lời hứa</p>
                <h2 id="lp-ledger-h">Sổ cái thật, trên Avalanche Fuji.</h2>
                <p>Hai dây ví dụ do nhóm chạy bằng ví demo, số tiền thu nhỏ 10 lần. Bấm để xem từng giao dịch trên Snowtrace.</p>
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
              <p className={s.label}>Hụi của xóm, sổ của chuỗi</p>
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
