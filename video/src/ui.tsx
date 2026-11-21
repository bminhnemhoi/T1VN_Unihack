import React from "react";
import { Img, staticFile } from "remotion";
import { C } from "./tokens";
import { MONO, SANS } from "./fonts";
import { clamp, fmt, mix } from "./anim";
import { SealedEnvelope } from "./objects";

// Product UI rebuilt from apps/web (strings from SettleDesk.tsx, MyRoundCard.tsx, CircleRoom.tsx, CreateCircle.tsx,
// InviteView.tsx; tokens from DESIGN.md). Every value is passed in, so the act decides what changes and when.

export const T: React.FC<{ size?: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ size = 24, color = C.ink, weight = 450, style, children }) => (
  <div style={{ fontFamily: SANS, fontSize: size, fontWeight: weight, color, lineHeight: 1.3, ...style }}>{children}</div>
);
export const M: React.FC<{ size?: number; color?: string; weight?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ size = 22, color = C.ink, weight = 500, style, children }) => (
  <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color, fontVariantNumeric: "tabular-nums", ...style }}>{children}</span>
);
const Btn: React.FC<{ children: React.ReactNode; size?: number; tone?: "lime" | "ink" | "ghost" | "dim"; pressed?: number; style?: React.CSSProperties }> = ({ children, size = 22, tone = "lime", pressed = 0, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: size * 0.5, minHeight: size * 2.2, padding: `0 ${size * 1.05}px`, borderRadius: 4, background: tone === "lime" ? C.lime : tone === "ink" ? C.ink : tone === "dim" ? C.line : "transparent", border: tone === "ghost" ? `1.5px solid ${C.ink}` : "none", color: tone === "ink" ? C.ivory : tone === "dim" ? C.ink2 : C.ink, fontFamily: SANS, fontWeight: 650, fontSize: size, transform: `scale(${1 - pressed * 0.05})`, boxSizing: "border-box", ...style }}>
    {children}
  </div>
);

// ---------- S05: the live landing's right column (real 2x capture) ----------
export const LandingCrop: React.FC<{ press: number }> = ({ press }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.ivory }}>
    <Img src={staticFile("capture/landing-hero-2x.png")} style={{ position: "absolute", width: 2880 * 0.9, left: -1600 * 0.9 + 14, top: -744 * 0.9 + 26 }} />
    {/* the press state of "Chơi hụi ngay" drawn over the capture, same size and place */}
    <div style={{ position: "absolute", left: (1623 - 1600) * 0.9 + 14, top: (1126 - 744) * 0.9 + 26, width: 370 * 0.9, height: 104 * 0.9, borderRadius: 4, background: "rgba(32,29,29,.12)", opacity: press }} />
  </div>
);

// ---------- S06: create a circle ----------
const Field: React.FC<{ k: string; v: string; focus?: boolean; caret?: boolean }> = ({ k, v, focus, caret }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 26px", borderRadius: 10, background: C.paper, border: `1.5px solid ${focus ? C.ink : C.line}`, boxShadow: focus ? "0 0 0 4px rgba(104,64,255,.16)" : undefined }}>
    <T size={25} color={C.ink2}>{k}</T>
    <M size={29} weight={600}>
      {v}
      {caret && <span style={{ display: "inline-block", width: 3, height: 30, marginLeft: 3, background: C.ink, verticalAlign: "middle" }} />}
    </M>
  </div>
);
export const CreateForm: React.FC<{ mode: string; n: string; c: string; bond: string; focus: number; caret: boolean; press: number; ready: number }> = ({ mode, n, c, bond, focus, caret, press, ready }) => (
  <div style={{ padding: "40px 48px", display: "flex", flexDirection: "column", gap: 16, width: 760 }}>
    <T size={46} weight={800} style={{ letterSpacing: "-0.03em" }}>Tạo dây hụi</T>
    <T size={21} color={C.ink2} style={{ marginBottom: 6 }}>Mọi tham số khóa lại khi dây bắt đầu.</T>
    <Field k="Kiểu dây" v={mode} focus={focus === 0} caret={caret && focus === 0} />
    <Field k="Số phần" v={n} focus={focus === 1} caret={caret && focus === 1} />
    <Field k="Mức góp mỗi kỳ" v={c} focus={focus === 2} caret={caret && focus === 2} />
    <Field k="Ký quỹ bảo lãnh" v={bond} focus={focus === 3} caret={caret && focus === 3} />
    <div style={{ marginTop: 10, display: "flex", gap: 18, alignItems: "center" }}>
      <Btn size={23} pressed={press}>Nạp ký quỹ</Btn>
      <T size={20} color={ready > 0.5 ? C.forest : C.ink2} weight={ready > 0.5 ? 650 : 450}>{ready > 0.5 ? "Bảo chứng đủ 100%: kích hoạt khi đủ 5 người" : "Kích hoạt khi đủ 5 người và bảo chứng 100%"}</T>
    </div>
  </div>
);

// The coverage ring: one track, two arcs (holdback in ink, bond in lime), the figure centred on its digits.
export const CoverageCard: React.FC<{ hold: number; bond: number; pct: number }> = ({ hold, bond, pct }) => {
  const r = 190, sw = 34, circ = 2 * Math.PI * r;
  return (
    <div style={{ width: 640, height: 590, borderRadius: 24, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, 18px 40px 80px -36px rgba(32,29,29,.55)`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 30, boxSizing: "border-box" }}>
      <svg width={470} height={470} viewBox="0 0 470 470">
        <circle cx="235" cy="235" r={r} fill="none" stroke={C.line} strokeWidth={sw} />
        {hold > 0 && <circle cx="235" cy="235" r={r} fill="none" stroke={C.ink} strokeWidth={sw} strokeDasharray={`${circ * 0.2 * hold} ${circ}`} transform="rotate(-90 235 235)" strokeLinecap="round" />}
        {bond > 0 && <circle cx="235" cy="235" r={r} fill="none" stroke={C.lime} strokeWidth={sw} strokeDasharray={`${Math.max(0.001, circ * 0.8 * bond - 4)} ${circ}`} transform={`rotate(${-90 + 72 + 1} 235 235)`} strokeLinecap="round" />}
        <text x="235" y="176" textAnchor="middle" style={{ fontFamily: MONO, fontWeight: 500, fontSize: 17, letterSpacing: "0.08em", fill: C.ink2 }}>CHỈ SỐ BẢO CHỨNG</text>
        <text x="235" y="278" textAnchor="middle" style={{ fontFamily: MONO, fontWeight: 600, fontSize: 118, fill: C.ink, fontVariantNumeric: "tabular-nums" }}>{`${Math.round(pct)}%`}</text>
      </svg>
      <div style={{ display: "flex", gap: 30, marginTop: 4 }}>
        <M size={22}><span style={{ display: "inline-block", width: 16, height: 16, background: C.ink, marginRight: 8, verticalAlign: "-1px" }} />20% tiền giữ lại</M>
        <M size={22}><span style={{ display: "inline-block", width: 16, height: 16, background: C.lime, outline: `1px solid ${C.ink}`, marginRight: 8, verticalAlign: "-1px" }} />80% ký quỹ 48/60</M>
      </div>
    </div>
  );
};

// ---------- S07: the circle page on the laptop while members join ----------
export const SeatsPanel: React.FC<{ joined: number }> = ({ joined }) => (
  <div style={{ padding: "40px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
    <T size={40} weight={800}>Dây 5 người × 10 USDC</T>
    <T size={22} color={C.ink2}>Bảo chứng 100% · đang gom người</T>
    <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = clamp(joined - (i - 1));
        return (
          <div key={i} style={{ width: 196, height: 130, borderRadius: 12, background: on > 0.5 ? C.ink : C.paper, border: `1.5px solid ${C.line}`, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 16, boxSizing: "border-box" }}>
            <T size={20} color={on > 0.5 ? C.ivory : C.ink2} weight={600}>{on > 0.5 ? `Thành viên ${i}` : "Chỗ trống"}</T>
          </div>
        );
      })}
    </div>
  </div>
);

// ---------- phone screens ----------
const PhoneHead: React.FC<{ title?: string }> = ({ title }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 26px 0" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <SealedEnvelope width={52} />
      <span style={{ padding: "5px 10px", borderRadius: 4, background: C.lime, fontFamily: MONO, fontWeight: 600, fontSize: 14, letterSpacing: "0.06em" }}>DEMO · FUJI</span>
    </div>
    {title && <T size={30} weight={800} style={{ letterSpacing: "-0.02em" }}>{title}</T>}
  </div>
);

// A tap ripple pinned to the centre of the element it sits in (the element must be position: relative), so a tap
// lands on its button whatever the screen's layout is.
const TapSpot: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  children ? <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, zIndex: 60 }}>{children}</div> : null;

export const SignIn: React.FC<{ wallet: number; googlePress: number; tap?: React.ReactNode }> = ({ wallet, googlePress, tap }) => (
  <div>
    <PhoneHead title="Đăng nhập" />
    <div style={{ padding: "8px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
      <T size={20} color={C.ink2}>Google hoặc email. Không cần ví crypto, không cần AVAX.</T>
      <div style={{ position: "relative", marginTop: 8, padding: "20px 0", borderRadius: 12, background: googlePress > 0 ? "#EDE8DE" : C.paper, border: `1.5px solid ${C.line}`, textAlign: "center", fontFamily: SANS, fontWeight: 650, fontSize: 22, transform: `scale(${1 - googlePress * 0.03})` }}>Tiếp tục với Google<TapSpot>{tap}</TapSpot></div>
      <div style={{ padding: "18px 0", borderRadius: 12, border: `1.5px solid ${C.line}`, textAlign: "center", fontFamily: SANS, fontSize: 20, color: C.ink2 }}>Email</div>
      <div style={{ marginTop: 22, padding: 20, borderRadius: 14, background: C.ink, display: "flex", flexDirection: "column", gap: 8, opacity: wallet, transform: `translateY(${(1 - wallet) * 40}px)` }}>
        <M size={15} color={C.mute}>VÍ CỦA BẠN</M>
        <M size={26} color={C.ivory}>0x6e55…5A63</M>
        <M size={18} color={C.lime}>0 AVAX · phí mạng do relayer trả</M>
      </div>
    </div>
  </div>
);

export const InviteScreen: React.FC<{ press: number; joined: number; glow: number; tap?: React.ReactNode }> = ({ press, joined, glow, tap }) => (
  <div>
    <PhoneHead />
    <div style={{ padding: "16px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
      <M size={16} color={C.ink2}>LỜI MỜI VÀO DÂY</M>
      <T size={31} weight={800} style={{ letterSpacing: "-0.02em" }}>5 người × 10 USDC · Bỏ thăm</T>
      <div style={{ display: "flex", justifyContent: "space-between" }}><T size={20} color={C.ink2}>Chỉ số bảo chứng</T><M size={22} weight={600}>100%</M></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><T size={20} color={C.ink2}>Trần thăm kỳ 1</T><M size={22} weight={600}>0,65 USDC</M></div>
      <div style={{ marginTop: 6, padding: 20, borderRadius: 12, background: C.paper, border: `1.5px solid ${glow > 0.5 ? C.ink : C.line}` }}>
        <T size={20} color={C.ink2}>Cho phép dây trích tối đa</T>
        <M size={46} weight={600}>40,40 USDC</M>
        <T size={19} color={C.ink2} style={{ marginTop: 6 }}>Tiền vẫn nằm trong ví của bạn tới lúc khui kỳ.</T>
      </div>
      <div style={{ position: "relative" }}>
        <Btn size={22} tone={joined > 0.5 ? "ink" : "lime"} pressed={press} style={{ width: "100%" }}>{joined > 0.5 ? "Đã vào dây" : "Ký và vào dây"}</Btn>
        <TapSpot>{tap}</TapSpot>
      </div>
      <M size={18} color={C.ink2}>Ví đang có 10,10 USDC · 0 AVAX</M>
    </div>
  </div>
);

export const BidRoom: React.FC<{ value: string; caret: boolean; cap: number; seal: number; clock: string; tapInput?: React.ReactNode; tapSeal?: React.ReactNode }> = ({ value, caret, cap, seal, clock, tapInput, tapSeal }) => (
  <div>
    <PhoneHead title="huisafe-demo-default" />
    <div style={{ padding: "10px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 2, background: i === 0 ? C.lime : C.line }} />)}</div>
      <M size={16} color={C.ink2} style={{ textAlign: "center", display: "block" }}>{`Kỳ 1/5 · Đang thăm · còn ${clock}`}</M>
      <div style={{ borderRadius: 14, background: C.ink, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["Nộp thăm kín", "Mở thăm", "Khui kỳ"].map((s, i) => <div key={i} style={{ flex: 1, padding: "8px 0", textAlign: "center", borderRadius: 3, background: i === 0 ? C.lime : "#2B2828", color: i === 0 ? C.ink : C.mute, fontFamily: MONO, fontSize: 14 }}>{s}</div>)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><T size={16} color={C.mute}>Còn thời gian nộp thăm</T><M size={36} color={C.ivory}>{clock}</M></div>
        <div style={{ borderRadius: 8, background: C.paper, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <T size={16} color={C.ink2}>Thăm của bạn (số tiền bớt cho mọi người)</T>
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 14px", borderRadius: 6, border: `1.5px solid ${C.ink}` }}>
            <M size={42}>{value}{caret && <span style={{ display: "inline-block", width: 3, height: 38, marginLeft: 3, background: C.ink, verticalAlign: "middle" }} />}</M>
            <M size={16}>USDC</M>
            <TapSpot>{tapInput}</TapSpot>
          </div>
          <div style={{ position: "relative", padding: "6px 8px", margin: "0 -8px", borderRadius: 4 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: C.lime, opacity: cap * 0.85 }} />
            <M size={15} color={C.ink} style={{ position: "relative" }}>Trần kỳ này 0,65 USDC · thăm cao nhất thắng, bằng nhau thì ít trễ hơn</M>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 14px", borderRadius: 8, background: "#2B2828" }}><T size={16} color={C.ivory}>Nếu bạn thắng, nhận ngay</T><M size={26} color={C.ivory}>28,848</M></div>
        <div style={{ position: "relative" }}>
          <Btn size={20} tone={seal > 0.5 ? "ink" : "lime"} pressed={seal > 0 && seal < 0.5 ? 1 : 0} style={{ width: "100%", border: seal > 0.5 ? `1.5px solid ${C.lime}` : "none", color: seal > 0.5 ? C.lime : C.ink }}>{seal > 0.5 ? "Đã niêm phong thăm" : "Niêm phong thăm"}</Btn>
          <TapSpot>{tapSeal}</TapSpot>
        </div>
      </div>
    </div>
  </div>
);

export const WaitSettle: React.FC = () => (
  <div>
    <PhoneHead title="huisafe-demo-default" />
    <div style={{ padding: "10px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 2, background: i === 0 ? C.lime : C.line }} />)}</div>
      <div style={{ padding: 18, borderRadius: 12, background: C.paper, border: `1.5px solid ${C.line}` }}>
        <T size={20} weight={650}>Chờ chủ hụi khui kỳ 1.</T>
        <T size={18} color={C.ink2} style={{ marginTop: 6 }}>Nếu chủ hụi chưa khui, keeper khui thay sau 04:52.</T>
      </div>
      <div style={{ padding: 18, borderRadius: 12, background: C.ink }}>
        <T size={18} color={C.mute}>Thăm của bạn đã mở</T>
        <M size={30} color={C.ivory}>0,60 USDC · cao nhất</M>
      </div>
    </div>
  </div>
);

// Round result on the winner's phone; rows of the app's "Xem cách tính" breakdown (CircleRoom.tsx).
export const ResultCard: React.FC<{ payout: number; rows: number; hold: number }> = ({ payout, rows, hold }) => (
  <div>
    <PhoneHead title="Kết quả kỳ 1" />
    <div style={{ padding: "8px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ borderRadius: 14, background: C.ink, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <T size={21} color={C.ivory} weight={700}>Bạn (Thành viên 4) hốt kỳ này</T>
        <T size={18} color={C.mute}>Thực nhận</T>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, whiteSpace: "nowrap" }}>
          <M size={66} color={C.lime} weight={600}>{fmt(payout, 3)}</M>
          <M size={26} color={C.lime}>USDC</M>
        </div>
        <T size={16} color={C.mute}>thăm thắng 0,6 USDC mỗi phần</T>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, opacity: rows }}>
        {[
          ["Tiền góp (4 × 9,40)", "37,60"],
          ["Hoa hồng chủ hụi (trả ngay)", "−0,376"],
          ["Quỹ dự phòng", "−0,376"],
          ["Giữ lại phòng Thành viên 4 bỏ đóng", "−8,00"],
        ].map(([k, v], i) => (
          <div key={i} style={{ position: "relative", display: "flex", justifyContent: "space-between", padding: "9px 8px", borderBottom: `1px dotted ${C.line}` }}>
            {i === 3 && <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: C.lime, opacity: hold * 0.9 }} />}
            <T size={17} color={C.ink2} style={{ position: "relative" }}>{k}</T>
            <M size={19} style={{ position: "relative" }}>{v}</M>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ---------- the organizer's settle desk (SettleDesk.tsx) ----------
const Ready: React.FC<{ name: string; v: string; short?: number; tag?: number }> = ({ name, v, short = 0, tag = 0 }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: 8, background: short > 0 ? `rgba(248,65,49,${0.12 * short})` : C.ivory, border: `1.5px solid ${short > 0.5 ? C.red : C.line}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <T size={24} weight={600} color={short > 0.5 ? C.redInk : C.ink}>{name}</T>
      {tag > 0 && <span style={{ opacity: tag, padding: "4px 10px", borderRadius: 3, background: C.red, color: C.ink, fontFamily: MONO, fontWeight: 600, fontSize: 15, letterSpacing: "0.06em" }}>VỠ NỢ</span>}
    </div>
    <M size={24} color={short > 0.5 ? C.redInk : C.ink}>{v}</M>
  </div>
);

export const SettleDesk: React.FC<{ k: 1 | 2; press: number; short: number; tag: number; settled: number }> = ({ k, press, short, tag, settled }) => {
  const rows = k === 1
    ? [["Thành viên 1", "đủ 9,40 USDC"], ["Thành viên 2", "đủ 9,40 USDC"], ["Thành viên 3", "đủ 9,40 USDC"], ["Thành viên 5", "đủ 9,40 USDC"]]
    : [["Thành viên 2", "đủ 9,70 USDC"], ["Thành viên 3", "đủ 9,70 USDC"], ["Thành viên 4", short > 0.5 ? "thiếu 10,00 / 10,00 USDC" : "đủ 10,00 USDC"], ["Thành viên 5", "đủ 9,70 USDC"]];
  return (
    <div style={{ padding: "36px 48px", display: "flex", flexDirection: "column", gap: 13, width: 1000 }}>
      <T size={44} weight={800} style={{ letterSpacing: "-0.03em" }}>{`Bàn khui kỳ ${k}`}</T>
      <T size={26}>{k === 1 ? <><b>Thành viên 4</b> hốt với thăm 0,60 USDC, nhận 28,848 USDC.</> : <><b>Thành viên 1</b> hốt với thăm 0,30 USDC.</>}</T>
      {rows.map(([n, v], i) => <Ready key={i} name={n} v={v} short={k === 2 && i === 2 ? short : 0} tag={k === 2 && i === 2 ? tag : 0} />)}
      {k === 2 && <T size={19} color={C.redInk} style={{ opacity: short }}>Thành viên 4 chưa đủ tiền. Bạn có thể chờ họ nạp; khui lúc này thì phần thiếu được bù theo thác (tiền giữ lại, ký quỹ, quỹ dự phòng) và họ có ân hạn để trả.</T>}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 4 }}>
        <Btn size={25} tone={settled > 0.5 ? "ink" : "lime"} pressed={press}>{settled > 0.5 ? `Đã khui kỳ ${k}` : `Khui kỳ ${k}, mở kỳ ${k + 1}`}</Btn>
        <T size={19} color={C.ink2}>Bạn còn 04:52 để khui; sau đó keeper khui thay để dây không bị treo.</T>
      </div>
    </div>
  );
};

// ---------- S10: how the shortfall was covered, the full payout, the bond after each round ----------
export const CascadeCard: React.FC<{ fill1: number; fill2: number; payout: number; payoutOn: number; chart: number; bondNow: number }> = ({ fill1, fill2, payout, payoutOn, chart, bondNow }) => {
  const bond = [48, 46, 36, 26, 16];
  const tiers: [string, string, number][] = [
    ["1 · Tiền giữ lại của Thành viên 4", "8,00", fill1],
    ["2 · Ký quỹ của chủ hụi", "2,00", fill2],
    ["3 · Quỹ dự phòng", "0", 0],
    ["4 · Người hốt nhận thiếu", "0", 0],
  ];
  const covered = fill1 * 8 + fill2 * 2;
  return (
    <div style={{ width: 820, borderRadius: 24, background: C.paper, boxShadow: `0 0 0 1px ${C.line}, 18px 40px 80px -36px rgba(32,29,29,.55)`, padding: "34px 40px", boxSizing: "border-box" }}>
      <M size={19} color={C.ink2}>BÙ KHOẢN THIẾU CỦA THÀNH VIÊN 4</M>
      <div style={{ marginTop: 14, height: 30, borderRadius: 6, background: C.red, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(covered / 10) * 100}%`, background: C.lime }} />
        <M size={18} style={{ position: "absolute", right: 10, top: 4 }}>{`${fmt(covered, 2)} / 10,00 USDC`}</M>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {tiers.map(([k, v, w], i) => (
          <div key={i} style={{ position: "relative", padding: "15px 18px", borderRadius: 8, border: `1.5px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${w * 100}%`, background: C.lime }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
              <T size={23} weight={w > 0.5 ? 700 : 450} color={w > 0 || i < 2 ? C.ink : C.ink2}>{k}</T>
              <M size={25} weight={600} color={w > 0 || i < 2 ? C.ink : C.ink2}>{v}</M>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, padding: "18px 22px", borderRadius: 12, background: C.ink, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: payoutOn }}>
        <T size={24} color={C.ivory} weight={600}>Thành viên 1 nhận đủ</T>
        <M size={46} color={C.lime} weight={600}>{`${fmt(payout, 3)} USDC`}</M>
      </div>
      <div style={{ marginTop: 22, opacity: clamp(chart * 4) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <M size={19} color={C.ink2}>KÝ QUỸ SAU TỪNG KỲ, USDC</M>
          <M size={40} weight={600}><span style={{ color: C.ink2 }}>48 → </span>{`${Math.round(bondNow)}`}</M>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 34, height: 170, marginTop: 10 }}>
          {bond.map((b, i) => {
            const on = clamp(chart * 5 - i);
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: mix(0.25, 1, on) }}>
                <M size={22} weight={600}>{b}</M>
                <div style={{ width: 92, height: (b / 48) * 110 * mix(0.15, 1, on), background: i === 1 ? C.lime : C.ink, borderRadius: 3 }} />
                <M size={17} color={C.ink2}>{`Kỳ ${i + 1}`}</M>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- S11: the ledger, built from on-chain events ----------
export const LEDGER_ROWS: [string, string, string, string, string][] = [
  ["Kỳ 2", "Thành viên 4", "Thiếu", "10,00", "0x4b1e…9d02"],
  ["Kỳ 2", "Thành viên 4", "Bù từ tiền giữ lại", "8,00", "0x4b1e…9d02"],
  ["Kỳ 2", "Thành viên 4", "Bù từ ký quỹ", "2,00", "0x4b1e…9d02"],
  ["Kỳ 2", "Thành viên 1", "Hốt", "32,318", "0x4b1e…9d02"],
  ["Kỳ 3", "Thành viên 4", "Vỡ nợ", "", "0x77c0…1a5f"],
];
export const Ledger: React.FC<{ rows: number[]; hot: number }> = ({ rows, hot }) => (
  <div style={{ padding: "38px 52px" }}>
    <T size={46} weight={800} style={{ letterSpacing: "-0.03em" }}>Sổ hụi</T>
    <M size={21} color={C.ink2}>Dây 0xc628…5Bfc · Avalanche Fuji · dựng từ event on-chain</M>
    <div style={{ marginTop: 24 }}>
      {LEDGER_ROWS.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 200px 1fr 150px 250px", alignItems: "center", padding: "19px 6px", borderBottom: `1.5px dotted ${C.line}`, opacity: rows[i] ?? 0, transform: `translateY(${(1 - (rows[i] ?? 0)) * 14}px)` }}>
          <M size={22} color={C.ink2}>{r[0]}</M>
          <T size={23} weight={650}>{r[1]}</T>
          <T size={23} color={r[2] === "Vỡ nợ" || r[2] === "Thiếu" ? C.redInk : C.ink}>{r[2]}</T>
          <M size={24} weight={600} style={{ textAlign: "right" }}>{r[3]}</M>
          <div style={{ justifySelf: "end", padding: "7px 15px", borderRadius: 999, border: `1.5px solid ${i === 3 ? C.ink : C.line}`, background: i === 3 ? (hot > 0.5 ? C.lime : C.paper) : C.paper }}>
            <M size={18}>{`${r[4]} ↗`}</M>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const Toast: React.FC<{ text: string; o: number }> = ({ text, o }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 24px", borderRadius: 999, background: C.ink, opacity: o, transform: `translateY(${(1 - o) * 16}px)` }}>
    <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.lime, display: "inline-block" }} />
    <T size={23} color={C.ivory} weight={600}>{text}</T>
  </div>
);
