import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C } from "../tokens";
import { MONO, SANS } from "../fonts";
import { AppWindow, BrandImg, Coin, Cursor, Envelope, Label, LimeButton, Mono, Phone, StatusPill, Subtitle, Touch } from "../parts";

// Storyboard key poses: one frame per shot (frame index = shot number - 1). Static, for approval only.

const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill style={{ background: C.inkDeep, overflow: "hidden" }}>{children}</AbsoluteFill>;
const Ivory: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill style={{ background: C.ivory, overflow: "hidden" }}>{children}</AbsoluteFill>;

const H: React.FC<{ size: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ size, color = C.ivory, weight = 900, style, children }) => (
  <div style={{ fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: "-0.045em", lineHeight: 1.02, color, ...style }}>{children}</div>
);

const T: React.FC<{ size?: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ size = 26, color = C.ink, weight = 450, style, children }) => (
  <div style={{ fontFamily: SANS, fontSize: size, fontWeight: weight, color, lineHeight: 1.3, ...style }}>{children}</div>
);

const Jar: React.FC<{ width: number; cracked?: boolean; style?: React.CSSProperties }> = ({ width, cracked, style }) => (
  <svg viewBox="0 0 200 220" width={width} height={width * 1.1} style={style}>
    <ellipse cx="100" cy="206" rx="70" ry="9" fill="rgba(0,0,0,.35)" />
    <path d="M62 30 h76 v14 c0 8 -10 12 -10 22 c26 14 46 40 46 74 c0 40 -30 66 -74 66 c-44 0 -74 -26 -74 -66 c0 -34 20 -60 46 -74 c0 -10 -10 -14 -10 -22 z" fill="#A0491F" stroke={C.ink} strokeWidth="4" />
    <path d="M40 120 c30 10 90 10 120 0" fill="none" stroke="#7A3416" strokeWidth="4" />
    {cracked && <path d="M104 66 l-14 30 l18 18 l-16 30 l12 22 l-8 34" fill="none" stroke={C.red} strokeWidth="6" strokeLinejoin="round" />}
  </svg>
);

// 1 · Cold open and demo declaration
const S1 = () => (
  <Ink>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 70, paddingBottom: 80 }}>
      <Envelope width={380} />
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 28px", borderRadius: 999, border: "1.5px solid #3A3636" }}>
        <Label size={20}>DEMO · Fuji</Label>
        <Mono size={30} color={C.ivory} weight={500}>Avalanche Fuji testnet · test USDC · rounds sped up to ~2 minutes</Mono>
      </div>
    </AbsoluteFill>
    <Subtitle text="A demo on Avalanche Fuji testnet: test USDC, and rounds sped up to about two minutes." />
  </Ink>
);

// 2 · What hụi is: five members, one pot, one person holding it
const S2 = () => {
  const pts = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: 960 + Math.cos(a) * 360, y: 590 + Math.sin(a) * 250 };
  });
  return (
    <Ink>
      {pts.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x - 80, top: p.y - 55, width: 160, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Envelope width={140} />
          <Mono size={22} color={C.mute}>{`M${i + 1}`}</Mono>
        </div>
      ))}
      {pts.map((p, i) => (
        <Coin key={i} size={34} style={{ position: "absolute", left: p.x + (960 - p.x) * 0.5 - 17, top: p.y + (590 - p.y) * 0.5 - 17 }} />
      ))}
      <Jar width={210} style={{ position: "absolute", left: 855, top: 455 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center" }}>
        <Label tone="ink" size={20} style={{ border: `1.5px solid ${C.lime}` }}>Organizer</Label>
      </div>
      <H size={96} style={{ position: "absolute", left: 0, right: 0, top: 96, textAlign: "center" }}>One person holds the pot.</H>
      <Subtitle text="In between, one person holds all of it: the organizer." />
    </Ink>
  );
};

// 3 · Three cases, sourced
const S3 = () => {
  const rows = [
    { place: "Bình Thuận · 2024", big: "100+ billion VND", sub: "taken from 167 people", src: "Báo Pháp luật, 20/09/2024" },
    { place: "Trà Vinh · 2025", big: "157 fake shares", sub: "4+ billion VND · 12 years in prison", src: "VOV, 13/03/2025" },
    { place: "Tây Ninh · 2026", big: "Fake Zalo accounts", sub: "nearly 500 million VND", src: "VietnamPlus, 06/10/2026" },
  ];
  return (
    <Ink>
      <div style={{ position: "absolute", left: 190, right: 190, top: 120, display: "flex", flexDirection: "column", gap: 34 }}>
        {rows.map((r, i) => {
          const on = i === 2;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "330px 1fr", alignItems: "baseline", gap: 30, opacity: on ? 1 : 0.42, paddingBottom: 26, borderBottom: "1.5px dashed #3A3636" }}>
              <Mono size={24} color={C.mute}>{r.place}</Mono>
              <div>
                <div style={{ display: "inline-block", position: "relative" }}>
                  <H size={on ? 104 : 72}>{r.big}</H>
                  {on && <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, height: 14, background: C.red, opacity: 0.9 }} />}
                </div>
                <T size={on ? 36 : 28} color={C.ivory} style={{ marginTop: 10 }}>{r.sub}</T>
                <Mono size={18} color={C.mute} style={{ display: "block", marginTop: 8 }}>{r.src}</Mono>
              </div>
            </div>
          );
        })}
      </div>
      <Subtitle text="Tây Ninh, 2026: fake Zalo accounts, nearly five hundred million dong." />
    </Ink>
  );
};

// 4 · Two jobs: drop holding, keep the guarantee
const S4 = () => (
  <Ink>
    <H size={84} style={{ position: "absolute", left: 0, right: 0, top: 80, textAlign: "center" }}>An organizer has two jobs.</H>
    <div style={{ position: "absolute", left: 300, top: 260, width: 560, height: 300, borderRadius: 22, border: "2px dashed #3A3636", display: "flex", flexDirection: "column", justifyContent: "center", padding: 44, boxSizing: "border-box", opacity: 0.5, transform: "rotate(-3deg) translateY(-20px)" }}>
      <Mono size={22} color={C.mute}>JOB 1</Mono>
      <H size={64} color={C.mute} style={{ marginTop: 14, textDecoration: "line-through", textDecorationThickness: 6 }}>Hold the money</H>
    </div>
    <div style={{ position: "absolute", left: 1060, top: 260, width: 560, height: 300, borderRadius: 22, background: C.forest, display: "flex", flexDirection: "column", justifyContent: "center", padding: 44, boxSizing: "border-box" }}>
      <Mono size={22} color={C.lime}>JOB 2 · KEPT</Mono>
      <H size={64} style={{ marginTop: 14 }}>Cover the loss</H>
      <div style={{ position: "absolute", right: -40, top: -40, width: 110, height: 110, borderRadius: "50%", background: C.lime, border: `6px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 900, fontSize: 54, color: C.ink }}>U</div>
      <T size={26} color={C.ivory} style={{ marginTop: 18 }}>Bond locked in a smart contract</T>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 650, display: "flex", justifyContent: "center", gap: 46 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ width: 150, padding: "18px 0 14px", borderRadius: 14, background: "#201D1D", border: "1.5px solid #3A3636", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Coin size={40} />
          <Mono size={20} color={C.mute}>{`M${i} wallet`}</Mono>
        </div>
      ))}
    </div>
    <Subtitle text="Money stays in each member's wallet until payout. The organizer locks a bond in a smart contract." />
  </Ink>
);

// 5 · Sign in with Google, no AVAX
const S5 = () => (
  <Ivory>
    <StatusPill text="HụiSafe" sub="Fuji testnet" done={0} total={0} />
    <AppWindow left={170} top={170} width={1080} height={640}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Img src={staticFile("ref/landing-1440.png")} style={{ position: "absolute", width: 1440 * 1.6, left: -800 * 1.6 + 30, top: -370 * 1.6 + 40 }} />
      </div>
    </AppWindow>
    <Cursor x={500} y={640} />
    <Phone left={1360} top={175} width={380}>
      <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        <T size={30} weight={800}>Đăng nhập</T>
        <T size={19} color={C.ink2}>Google hoặc email. Không cần ví crypto, không cần AVAX.</T>
        <div style={{ marginTop: 8, padding: "18px 0", borderRadius: 12, background: C.paper, border: `1.5px solid ${C.line}`, textAlign: "center", fontFamily: SANS, fontWeight: 650, fontSize: 21, color: C.ink }}>Tiếp tục với Google</div>
        <div style={{ padding: "16px 0", borderRadius: 12, border: `1.5px solid ${C.line}`, textAlign: "center", fontFamily: SANS, fontSize: 19, color: C.ink2 }}>Email</div>
        <div style={{ marginTop: 26, padding: 18, borderRadius: 14, background: C.ink, display: "flex", flexDirection: "column", gap: 8 }}>
          <Mono size={15} color={C.mute}>VÍ CỦA BẠN</Mono>
          <Mono size={22} color={C.ivory}>0x6e55…5A63</Mono>
          <Mono size={17} color={C.lime}>0 AVAX · phí mạng do relayer trả</Mono>
        </div>
      </div>
      <Touch x={190} y={300} />
    </Phone>
    <Subtitle text="Sign in with Google and you have a wallet. No AVAX needed: our relayer pays the fees." />
  </Ivory>
);

const Field: React.FC<{ k: string; v: string; focus?: boolean }> = ({ k, v, focus }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderRadius: 10, background: C.paper, border: `1.5px solid ${focus ? C.ink : C.line}`, boxShadow: focus ? `0 0 0 4px rgba(104,64,255,.18)` : undefined }}>
    <T size={24} color={C.ink2}>{k}</T>
    <Mono size={28} color={C.ink} weight={600}>{v}</Mono>
  </div>
);

// 6 · Create the circle, bond to 100% coverage
const S6 = () => {
  const r = 150, circ = 2 * Math.PI * r;
  return (
    <Ivory>
      <StatusPill text="5 members · 10 USDC" sub="Forming" done={0} />
      <AppWindow left={110} top={150} width={900} height={730}>
        <div style={{ padding: "36px 44px", display: "flex", flexDirection: "column", gap: 16 }}>
          <T size={44} weight={800} style={{ letterSpacing: "-0.03em" }}>Tạo dây hụi</T>
          <Field k="Kiểu dây" v="Bỏ thăm" />
          <Field k="Số phần" v="5" />
          <Field k="Mức góp mỗi kỳ" v="10 USDC" />
          <Field k="Ký quỹ bảo lãnh" v="48 USDC" focus />
          <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "center" }}>
            <LimeButton>Nạp ký quỹ</LimeButton>
            <T size={20} color={C.ink2}>Kích hoạt khi đủ 5 người và bảo chứng 100%</T>
          </div>
        </div>
      </AppWindow>
      <div style={{ position: "absolute", left: 1060, top: 230, width: 620, height: 560, borderRadius: 22, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, 18px 40px 80px -36px rgba(32,29,29,.55)`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 36 }}>
        <Mono size={18} color={C.ink2}>CHỈ SỐ BẢO CHỨNG</Mono>
        <svg width={380} height={380} viewBox="0 0 380 380" style={{ marginTop: 10 }}>
          <circle cx="190" cy="190" r={r} fill="none" stroke={C.line} strokeWidth="26" />
          <circle cx="190" cy="190" r={r} fill="none" stroke={C.ink} strokeWidth="26" strokeDasharray={`${circ * 0.2} ${circ}`} transform="rotate(-90 190 190)" strokeLinecap="round" />
          <circle cx="190" cy="190" r={r} fill="none" stroke={C.lime} strokeWidth="26" strokeDasharray={`${circ * 0.79} ${circ}`} transform={`rotate(${-90 + 0.205 * 360} 190 190)`} strokeLinecap="round" />
          <text x="190" y="214" textAnchor="middle" style={{ fontFamily: MONO, fontWeight: 600, fontSize: 76, fill: C.ink }}>100%</text>
        </svg>
        <div style={{ display: "flex", gap: 26, marginTop: 6 }}>
          <Mono size={20} color={C.ink}>■ 20% giữ lại</Mono>
          <Mono size={20} color={C.ink}><span style={{ color: "#5BC21A" }}>■</span> 80% ký quỹ 48/60</Mono>
        </div>
      </div>
      <Subtitle text="100% coverage means the bond can absorb the worst single shock: everyone already paid stops paying at the same time." />
    </Ivory>
  );
};

// 7 · Join: sign once, money stays in the wallet
const S7 = () => (
  <Ivory>
    <StatusPill text="5 members · 10 USDC" sub="4/5 joined" done={0} />
    <AppWindow left={130} top={170} width={1100} height={680} blur={5}>
      <div style={{ padding: 44, display: "flex", gap: 18, marginTop: 120 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 180, height: 120, borderRadius: 12, background: i < 5 ? C.ink : C.paper, border: `1.5px solid ${C.line}` }} />
        ))}
      </div>
    </AppWindow>
    <Phone left={1200} top={130} width={420}>
      <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Mono size={16} color={C.ink2}>LỜI MỜI VÀO DÂY</Mono>
        <T size={30} weight={800}>5 người × 10 USDC · Bỏ thăm</T>
        <div style={{ display: "flex", justifyContent: "space-between" }}><T size={20} color={C.ink2}>Chỉ số bảo chứng</T><Mono size={22} color={C.ink} weight={600}>100%</Mono></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><T size={20} color={C.ink2}>Trần thăm kỳ 1</T><Mono size={22} color={C.ink} weight={600}>0,65 USDC</Mono></div>
        <div style={{ marginTop: 8, padding: 18, borderRadius: 12, background: C.paper, border: `1.5px solid ${C.line}` }}>
          <T size={20} color={C.ink2}>Cho phép dây trích tối đa</T>
          <Mono size={40} color={C.ink} weight={600}>40,40 USDC</Mono>
          <T size={19} color={C.ink2} style={{ marginTop: 6 }}>Tiền vẫn nằm trong ví của bạn tới lúc khui kỳ.</T>
        </div>
        <LimeButton size={22} style={{ justifyContent: "center", marginTop: 10 }}>Ký và vào dây</LimeButton>
        <Mono size={18} color={C.ink2}>Ví đang có 10,10 USDC · 0 AVAX</Mono>
      </div>
      <Touch x={210} y={640} />
    </Phone>
    <Subtitle text="Members sign once, allowing at most 40.40 USDC to be pulled. The money stays in their wallets." />
  </Ivory>
);

// 8 · Sealed bid: the envelope carries the bid (phone rebuilt from the real bid room, CircleRoom.tsx)
const S8 = () => (
  <Ivory>
    <StatusPill text="0xc628…5Bfc" sub="Round 1/5" done={0} />
    <Phone left={500} top={110} width={430}>
      <div style={{ padding: "8px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Envelope width={44} /><Label size={13}>DEMO · Fuji</Label></div>
        <T size={26} weight={800}>huisafe-demo-default</T>
        <div style={{ display: "flex", gap: 5 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i === 0 ? C.lime : C.line }} />)}</div>
        <Mono size={15} color={C.ink2} style={{ textAlign: "center" }}>Kỳ 1/5 · Đang thăm · còn 0:01:12</Mono>
        <div style={{ borderRadius: 14, background: C.ink, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["Nộp thăm kín", "Mở thăm", "Khui kỳ"].map((t, i) => <div key={i} style={{ flex: 1, padding: "7px 0", textAlign: "center", borderRadius: 3, background: i === 0 ? C.lime : "#2B2828", color: i === 0 ? C.ink : C.mute, fontFamily: MONO, fontSize: 13 }}>{t}</div>)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><T size={15} color={C.mute}>Còn thời gian nộp thăm</T><Mono size={34} color={C.ivory}>01:12</Mono></div>
          <div style={{ borderRadius: 8, background: C.paper, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <T size={15} color={C.ink2}>Thăm của bạn (số tiền bớt cho mọi người)</T>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${C.ink}` }}><Mono size={36} color={C.ink}>0,60</Mono><Mono size={15}>USDC</Mono></div>
            <Mono size={13} color={C.ink2}>Trần kỳ này 0,65 USDC · thăm cao nhất thắng, bằng nhau thì ít trễ hơn</Mono>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 12px", borderRadius: 8, background: "#2B2828" }}><T size={15} color={C.ivory}>Nếu bạn thắng, nhận ngay</T><Mono size={24} color={C.ivory}>28,848</Mono></div>
          <LimeButton size={19} style={{ justifyContent: "center" }}>Niêm phong thăm</LimeButton>
        </div>
      </div>
      <Touch x={215} y={735} />
    </Phone>
    <div style={{ position: "absolute", left: 1060, top: 290, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <Envelope width={460} />
      <Mono size={24} color={C.ink2}>keccak256 → 0x8f3a…c21e</Mono>
      <Label tone="ink" size={18}>Phong bì thăm kín kỳ 1 · 2/5 người</Label>
    </div>
    <Subtitle text="Want the pot early? Bid a discount for the others, sealed and capped by law: 0.65 USDC this round." />
  </Ivory>
);

const Ready: React.FC<{ name: string; v: string; short?: boolean }> = ({ name, v, short }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 18px", borderRadius: 8, background: short ? "rgba(248,65,49,.12)" : C.ivory, border: `1.5px solid ${short ? C.red : C.line}` }}>
    <T size={22} weight={600} color={short ? C.redInk : C.ink}>{name}</T>
    <Mono size={22} color={short ? C.redInk : C.ink}>{v}</Mono>
  </div>
);

// 9 · Organizer settles on the laptop, the member's phone receives
const S9 = () => (
  <Ivory>
    <StatusPill text="0xc628…5Bfc" sub="Round 1/5" done={0} />
    <AppWindow left={110} top={150} width={1180} height={730}>
      <div style={{ padding: "34px 44px", display: "flex", flexDirection: "column", gap: 14 }}>
        <T size={40} weight={800}>Bàn khui kỳ 1</T>
        <T size={24}><b>Thành viên 4</b> hốt với thăm 0,60 USDC, nhận 28,848 USDC.</T>
        <Ready name="Thành viên 1" v="đủ 9,40 USDC" />
        <Ready name="Thành viên 2" v="đủ 9,40 USDC" />
        <Ready name="Thành viên 3" v="đủ 9,40 USDC" />
        <Ready name="Thành viên 5" v="đủ 9,40 USDC" />
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 6 }}>
          <LimeButton size={24}>Khui kỳ 1, mở kỳ 2</LimeButton>
          <T size={18} color={C.ink2}>Bạn còn 04:52 để khui; sau đó keeper khui thay.</T>
        </div>
      </div>
    </AppWindow>
    <Cursor x={300} y={735} press={0.6} />
    <Phone left={1350} top={170} width={400}>
      <div style={{ padding: "8px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Envelope width={44} /><Label size={13}>DEMO · Fuji</Label></div>
        <T size={30} weight={800}>Kết quả kỳ 1</T>
        <T size={16} color={C.ink2}>Mọi con số tính từ luật của dây, ai cũng kiểm lại được.</T>
        <div style={{ borderRadius: 14, background: C.ink, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <T size={21} color={C.ivory} weight={700}>Bạn (Thành viên 4) hốt kỳ này</T>
          <T size={18} color={C.ivory}>Thực nhận</T>
          <Mono size={44} color={C.lime} weight={600}>28,848 USDC</Mono>
          <T size={16} color={C.mute}>thăm thắng 0,6 USDC mỗi phần</T>
          <div style={{ marginTop: 6, padding: "12px 0", borderRadius: 4, border: `1.5px solid ${C.ivory}`, textAlign: "center", fontFamily: SANS, fontSize: 16, color: C.ivory }}>Xem giao dịch trên Snowtrace</div>
        </div>
        <div style={{ padding: 14, borderRadius: 10, border: `1.5px solid ${C.line}` }}><T size={17} weight={700}>Bạn đã hốt ở Kỳ 1</T><T size={15} color={C.ink2}>Kỳ sau hợp đồng trích đúng 10,00 USDC từ ví bạn và nhả lại 2,00 USDC tiền giữ lại.</T></div>
      </div>
    </Phone>
    <div style={{ position: "absolute", left: 470, top: 820, padding: "12px 22px", borderRadius: 999, background: C.ink, display: "flex", gap: 14, alignItems: "center" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.lime, display: "inline-block" }} />
      <T size={22} color={C.ivory} weight={600}>Kỳ 1 đã chốt · Thành viên 4 nhận 28,848 USDC</T>
    </div>
    <Subtitle text="One transaction collects every share and pays Member 4: 28.848 USDC." />
  </Ivory>
);

// 10 · Default: red, then covered
const S10 = () => {
  const tiers = [
    ["1 · Tiền giữ lại của Thành viên 4", "8,00", 0.8],
    ["2 · Ký quỹ của chủ hụi", "2,00", 0.2],
    ["3 · Quỹ dự phòng", "0", 0],
    ["4 · Người hốt nhận thiếu", "0", 0],
  ] as const;
  const bond = [48, 46, 36, 26, 16];
  return (
    <Ivory>
      <StatusPill text="0xc628…5Bfc" sub="Round 2/5" done={1} />
      <AppWindow left={90} top={150} width={900} height={730}>
        <div style={{ padding: "30px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
          <T size={38} weight={800}>Bàn khui kỳ 2</T>
          <T size={22}><b>Thành viên 1</b> hốt với thăm 0,30 USDC.</T>
          <Ready name="Thành viên 2" v="đủ 9,70 USDC" />
          <Ready name="Thành viên 3" v="đủ 9,70 USDC" />
          <Ready name="Thành viên 4" v="thiếu 10,00 / 10,00 USDC" short />
          <Ready name="Thành viên 5" v="đủ 9,70 USDC" />
          <T size={18} color={C.redInk} style={{ marginTop: 4 }}>Thành viên 4 chưa đủ tiền. Khui lúc này thì phần thiếu được bù theo thác (tiền giữ lại, ký quỹ, quỹ dự phòng).</T>
          <LimeButton size={22} style={{ alignSelf: "flex-start", marginTop: 4 }}>Khui kỳ 2, mở kỳ 3</LimeButton>
        </div>
      </AppWindow>
      <div style={{ position: "absolute", left: 1040, top: 150, width: 790, borderRadius: 22, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, 18px 40px 80px -36px rgba(32,29,29,.55)`, padding: "30px 36px", boxSizing: "border-box" }}>
        <Mono size={18} color={C.ink2}>BÙ KHOẢN THIẾU CỦA THÀNH VIÊN 4 · 10,00 USDC</Mono>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
          {tiers.map(([k, v, w], i) => (
            <div key={i} style={{ position: "relative", padding: "14px 18px", borderRadius: 8, border: `1.5px solid ${C.line}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w * 100}%`, background: C.lime }} />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
                <T size={22} weight={w ? 700 : 450} color={w ? C.ink : C.ink2}>{k}</T>
                <Mono size={24} color={w ? C.ink : C.ink2} weight={600}>{v}</Mono>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, padding: "16px 18px", borderRadius: 12, background: C.ink, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <T size={22} color={C.ivory} weight={600}>Thành viên 1 nhận đủ</T>
          <Mono size={34} color={C.lime} weight={600}>32,318 USDC</Mono>
        </div>
        <Mono size={18} color={C.ink2} style={{ display: "block", marginTop: 22 }}>KÝ QUỸ SAU TỪNG KỲ</Mono>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 26, height: 150, marginTop: 12 }}>
          {bond.map((b, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Mono size={20} color={C.ink} weight={600}>{b}</Mono>
              <div style={{ width: 70, height: (b / 48) * 100, background: i === 1 ? C.lime : C.ink, borderRadius: 3 }} />
              <Mono size={16} color={C.ink2}>{`Kỳ ${i + 1}`}</Mono>
            </div>
          ))}
        </div>
      </div>
      <Subtitle text="The same transaction covers it: eight from Member 4's holdback, two from the bond." />
    </Ivory>
  );
};

// 11 · The ledger
const S11 = () => {
  const rows = [
    ["Kỳ 2", "TV 4", "Thiếu", "10,00", "0x4b1e…9d02"],
    ["Kỳ 2", "TV 4", "Bù từ tiền giữ lại", "8,00", "0x4b1e…9d02"],
    ["Kỳ 2", "TV 4", "Bù từ ký quỹ", "2,00", "0x4b1e…9d02"],
    ["Kỳ 2", "TV 1", "Hốt", "32,318", "0x4b1e…9d02"],
    ["Kỳ 3", "TV 4", "Vỡ nợ", "", "0x77c0…1a5f"],
  ];
  return (
    <Ivory>
      <StatusPill text="0xc628…5Bfc" sub="Completed" done={5} />
      <AppWindow left={260} top={150} width={1400} height={720}>
        <div style={{ padding: "34px 48px" }}>
          <T size={42} weight={800}>Sổ hụi</T>
          <Mono size={20} color={C.ink2}>Dây 0xc628…5Bfc · Avalanche Fuji · dựng từ event on-chain</Mono>
          <div style={{ marginTop: 26 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 90px 1fr 170px 260px", alignItems: "center", padding: "18px 6px", borderBottom: `1.5px dotted ${C.line}` }}>
                <Mono size={22} color={C.ink2}>{r[0]}</Mono>
                <T size={24} weight={650}>{r[1]}</T>
                <T size={24} color={r[2] === "Vỡ nợ" || r[2] === "Thiếu" ? C.redInk : C.ink}>{r[2]}</T>
                <Mono size={24} color={C.ink} weight={600} style={{ textAlign: "right" }}>{r[3]}</Mono>
                <div style={{ justifySelf: "end", padding: "6px 14px", borderRadius: 999, border: `1.5px solid ${i === 3 ? C.ink : C.line}`, background: i === 3 ? C.lime : C.paper }}>
                  <Mono size={18} color={C.ink}>{r[4]} ↗</Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppWindow>
      <Cursor x={1560} y={555} />
      <Subtitle text="Every step goes into the ledger, linked to a transaction anyone can open." />
    </Ivory>
  );
};

// 12 · Proof: a real capture, then the numbers
const S12 = () => (
  <Ink>
    <div style={{ position: "absolute", left: 90, top: 130, width: 1020, height: 680, borderRadius: 14, overflow: "hidden", boxShadow: "0 0 0 1px #3A3636, 18px 40px 80px -30px rgba(0,0,0,.7)" }}>
      <Img src={staticFile("ref/explorer-subnets-test.png")} style={{ width: 1020 * 1.16, marginLeft: -20, marginTop: -150 }} />
    </div>
    <div style={{ position: "absolute", left: 120, top: 80 }}>
      <Mono size={20} color={C.mute}>QUAY THẬT · Avalanche Explorer (Fuji) · dây 0xc628…5Bfc</Mono>
    </div>
    <div style={{ position: "absolute", left: 1190, top: 170, width: 640, display: "flex", flexDirection: "column", gap: 40 }}>
      {[
        ["5", "contracts verified on Fuji"],
        ["634", "Foundry tests · 17 invariants fuzzed"],
        ["0", "critical or high in internal review"],
      ].map(([n, t], i) => (
        <div key={i}>
          <H size={110} color={C.lime}>{n}</H>
          <T size={32} color={C.ivory}>{t}</T>
        </div>
      ))}
    </div>
    <Subtitle text="It runs on Avalanche Fuji: five verified contracts, 634 tests, and an internal review with no critical or high issues." />
  </Ink>
);

// 13 · Three questions from the organisers
const S13 = () => {
  const qs = [
    ["Why on-chain?", "Nobody holds the money. Rules can't change mid-circle. Public ledger."],
    ["Why Avalanche?", "Native USDC with permit: sign once. Fees low enough for our relayer to pay."],
    ["Where does the money come from?", "Only the members. Commission inside Decree 19's interest cap.* No token, no yield."],
  ];
  return (
    <Ink>
      <div style={{ position: "absolute", left: 150, right: 150, top: 110, display: "flex", flexDirection: "column", gap: 44 }}>
        {qs.map(([q, a], i) => (
          <div key={i} style={{ opacity: i === 2 ? 1 : 0.38 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <H size={i === 2 ? 92 : 64}>{q}</H>
              {i === 1 && <BrandImg file="avalanche-ko.png" height={40} />}
            </div>
            <T size={i === 2 ? 34 : 28} color={C.ivory} style={{ marginTop: 12 }}>{a}</T>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 150, top: 830 }}>
        <Mono size={18} color={C.mute}>* commission-share mode (φ &gt; 0). Demo circles use a fixed 1% fee.</Mono>
      </div>
      <Subtitle text="Where does the money come from? The members alone. The organizer's commission sits under Decree 19's interest cap; no token, no yield." />
    </Ink>
  );
};

// 14 · End card
const S14 = () => (
  <Ink>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 120, flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <Envelope width={210} />
        <H size={150}>HụiSafe</H>
      </div>
      <div style={{ marginTop: 44, display: "flex", alignItems: "center", gap: 40 }}>
        <LimeButton size={34}>Try it on Fuji testnet</LimeButton>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Img src={staticFile("brand/qr-app.png")} style={{ width: 150, height: 150, borderRadius: 8 }} />
          <Mono size={24} color={C.ivory}>lamng.tail3abf4e.ts.net:8443</Mono>
        </div>
      </div>
      <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 30 }}>
        <T size={26} color={C.mute}>Built on</T>
        <BrandImg file="avalanche-ko.png" height={42} />
        <span style={{ width: 2, height: 40, background: "#3A3636" }} />
        <BrandImg file="team1vietnam-white.png" height={34} />
        <T size={26} color={C.mute}>UniHack 2026</T>
      </div>
      <T size={26} color={C.ivory} style={{ marginTop: 34 }}>Ngô Bình Minh (leader) · Ngô Lâm Tiến · Ngô Đặng Trọng Hiếu</T>
    </AbsoluteFill>
    <Subtitle text="HụiSafe. Try it on Fuji testnet." />
  </Ink>
);

const SHOTS = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14];

export const Board: React.FC = () => {
  const frame = useCurrentFrame();
  const Shot = SHOTS[Math.min(frame, SHOTS.length - 1)];
  return <Shot />;
};

export const BOARD_LENGTH = SHOTS.length;
