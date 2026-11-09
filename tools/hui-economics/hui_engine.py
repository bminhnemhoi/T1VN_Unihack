"""Integer, contract-faithful model of one HuiSafe circle (docs/03 v1.1 + optional v1.2/v1.3 knobs).

Mirrors HuiMath (floor division everywhere) and the settleRound / payLate / markDefault / finalize
rules of docs/03 sections 6 and 5.3. Units are whatever integer unit the caller picks
(micro-USDC to compare with the contract, or dong for VND illustrations).

Extra knobs (proposals, NOT in the contract yet):
  fee_mode="declining": fee_k = pot * top_bps * (N - k) / ((N - 1) * 10_000), one floor division.
  reserve_split="weighted": final reserve split by w_i = (N - 1) - lateCount_i (ADR-24).
  organizer_member + no_self_fee: the organizer's own seat pays no commission when it wins.
"""
from __future__ import annotations

BPS = 10_000
YEAR = 365 * 86_400


def max_bid(cap_bps, n, k, c, period, payers):
    if payers == 0 or c == 0:
        return 0
    rem = n - k
    bound = (cap_bps * rem * c * rem * period) // (BPS * YEAR * payers)
    return min(bound, c - 1)


def holdback_for(alpha, n, k, c):
    return alpha * (n - k) * c // BPS


def release_per_round(alpha, c):
    return alpha * c // BPS


def late_fee(amount, rate_bps, elapsed, period, round_duration):
    return amount * rate_bps * elapsed * period // (BPS * YEAR * round_duration)


def max_exposure(n, c):
    h = n // 2
    return h * (n - h) * c


class Circle:
    def __init__(self, members, C, period, alpha=2000, fee_mode="flat", fee_bps=100, reserve_bps=100,
                 bond=None, cap_bps=2000, late_rate=1000, round_duration=None, reserve_split="equal",
                 organizer_seat=None):
        self.m = list(members)
        self.N = len(members)
        self.C, self.P, self.alpha = C, period, alpha
        self.fee_mode, self.fee_bps, self.res_bps = fee_mode, fee_bps, reserve_bps
        self.cap_bps, self.late_rate = cap_bps, late_rate
        self.RD = round_duration or period
        self.split = reserve_split
        self.org_seat = organizer_seat
        o_max = max_exposure(self.N, C)
        self.bond = bond if bond is not None else -(-(BPS - alpha) * o_max // BPS)  # ceil, ADR-22 B_min
        self.bond0 = self.bond
        self.received = {x: False for x in self.m}
        self.defaulted = {x: False for x in self.m}
        self.hold = {x: 0 for x in self.m}
        self.late = {x: 0 for x in self.m}
        self.paid = {x: 0 for x in self.m}
        self.got = {x: 0 for x in self.m}
        self.reserve = 0
        self.escrow = {}
        self.sf = {}
        self.winner = {}
        self.k = 0
        self.log = []
        self.cash = {x: {} for x in self.m}   # per-round net cash flow, for IRR

    def _cf(self, who, k, amt):
        self.cash[who][k] = self.cash[who].get(k, 0) + amt

    def fee_for(self, k, pot, winner):
        if self.org_seat is not None and winner == self.org_seat:
            return 0
        if self.fee_mode == "flat":
            return pot * self.fee_bps // BPS
        return pot * self.fee_bps * (self.N - k) // ((self.N - 1) * BPS)

    def live(self):
        return [x for x in self.m if not self.received[x] and not self.defaulted[x]]

    def open_sf(self, x):
        return [r for (r, y), s in sorted(self.sf.items()) if y == x and not s["resolved"]]

    def cap(self, k=None):
        k = k or self.k + 1
        return max_bid(self.cap_bps, self.N, k, self.C, self.P, len(self.live()) - 1)

    def settle(self, bids=None, commit_order=None, fails=()):
        self.k += 1
        k, C = self.k, self.C
        bids = bids or {}
        commit_order = commit_order or list(bids)
        live = self.live()
        assert not any(self.defaulted[x] and not self.received[x] for x in self.m), "Frozen not modelled"
        cap = max_bid(self.cap_bps, self.N, k, C, self.P, len(live) - 1)
        if len(live) == 1:
            w, b = live[0], 0
        else:
            valid = {x: v for x, v in bids.items() if x in live and v <= cap and v < C and not self.open_sf(x)}
            assert set(valid) == set(bids), f"round {k}: invalid bid in {bids} (cap {cap})"
            if valid:
                w = max(valid, key=lambda x: (valid[x], -self.late[x], -commit_order.index(x)))
                b = valid[w]
            else:
                w, b = live[0], 0
        pulled = covered = unc_total = 0
        for x in self.m:
            if x == w:
                continue
            due = C - b if not self.received[x] else C
            if x in fails:
                s = due
                h = min(self.hold[x], s) if self.received[x] else 0
                self.hold[x] -= h; s -= h
                bb = min(self.bond, s); self.bond -= bb; s -= bb
                rr = min(self.reserve, s); self.reserve -= rr; s -= rr
                self.sf[(k, x)] = dict(amount=due, fromH=h, fromB=bb, fromR=rr, unc=s, resolved=(h + bb + rr + s == 0))
                covered += due - s; unc_total += s
                self.late[x] += 1
            else:
                pulled += due
                self.paid[x] += due; self._cf(x, k, -due)
        pot = pulled + covered
        fee = self.fee_for(k, pot, w)
        prem = pot * self.res_bps // BPS
        H = min(holdback_for(self.alpha, self.N, k, C), pot - fee - prem)
        payout = pot - fee - prem - H
        self.escrow[k] = fee
        self.reserve += prem
        self.hold[w] += H
        self.got[w] += payout; self._cf(w, k, payout)
        rel = {}
        for d in self.m:
            if self.received[d] and not self.defaulted[d] and d != w and d not in fails:
                r = min(self.hold[d], release_per_round(self.alpha, C))
                if r:
                    self.hold[d] -= r; self.got[d] += r; self._cf(d, k, r); rel[d] = r
        self.received[w] = True
        self.winner[k] = w
        row = dict(k=k, cap=cap, w=w, b=b, pot=pot, fee=fee, prem=prem, H=H, payout=payout, rel=rel,
                   unc=unc_total, bond=self.bond, reserve=self.reserve)
        self.log.append(row)
        return row

    def mark_default(self, x):
        assert not self.defaulted[x]
        r = self.open_sf(x)[0]
        self.defaulted[x] = True
        forfeited = self.escrow.get(r, 0)
        self.reserve += forfeited
        self.escrow[r] = 0
        return forfeited

    def pay_late(self, x, r, elapsed):
        s = self.sf[(r, x)]
        total = 0
        fees = 0
        for part in ("unc", "fromR", "fromB", "fromH"):
            p = s[part]
            if not p:
                continue
            lf = late_fee(p, self.late_rate, elapsed, self.P, self.RD)
            total += p + lf; fees += lf
            if part == "unc":
                wr = self.winner[r]; self.got[wr] += p; self._cf(wr, self.k, p)
            elif part == "fromR":
                self.reserve += p
            elif part == "fromB":
                self.bond += p
            else:
                self.hold[x] += p
            s[part] = 0
        s["resolved"] = True
        self.reserve += fees
        self.paid[x] += total; self._cf(x, self.k, -total)
        released = 0
        if self.received[x] and not self.defaulted[x] and self.winner[r] != x:
            released = min(self.hold[x], release_per_round(self.alpha, self.C))
            self.hold[x] -= released; self.got[x] += released; self._cf(x, self.k, released)
        return total, fees, released

    def finalize(self):
        N = self.N
        for x in self.m:
            if not self.defaulted[x] and self.hold[x]:
                self.got[x] += self.hold[x]; self._cf(x, N, self.hold[x]); self.hold[x] = 0
        assert all(self.hold[x] == 0 for x in self.m), "defaulted holdback not modelled"
        fees = sum(self.escrow.values())
        org_out = fees + self.bond
        elig = [x for x in self.m if not self.defaulted[x]]
        R = self.reserve
        if self.split == "weighted":
            wts = {x: max(0, (N - 1) - self.late[x]) for x in elig}
        else:
            wts = {x: 1 for x in elig}
        W = sum(wts.values())
        if W == 0:
            wts = {x: 1 for x in elig}; W = len(elig)
        shares = {x: R * wts[x] // W for x in elig}
        dust = R - sum(shares.values())
        first = next(x for x in self.m if x in elig and wts[x] > 0)
        shares[first] += dust
        for x, v in shares.items():
            self.got[x] += v; self._cf(x, N, v)
        self.reserve = 0
        return dict(fees=fees, bond_back=self.bond, org_out=org_out, shares=shares, weights=wts, R=R)
