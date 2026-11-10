"""One circle, integer accounting, three designs (docs/03 sections 5 to 7, docs/08 5.3).

Money is ``int`` in USDC base units (6 decimals); every formula comes from ``huisim.math``.
Simplifications versus the contract (docs/08 section 9): a default happens at the start of
round k and is absorbing (no ``payLate`` or ``repayDebt``); every commit is revealed; all
payments succeed (no ``claimable``); commit order is the join order.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import math as hm
from .policies import DefaultPlan, Design, ScriptedBids, UniformFractionOfCap
from .scenarios import CAP_BPS, LATE_RATE_BPS, Scenario


@dataclass(frozen=True)
class Draws:
    """Pre-drawn uniforms of one circle, shared by the three designs (docs/08 section 6)."""

    default: list[list[float]]  # [k][i]
    bid: list[list[float]]  # [k][i]
    shock: list[float]  # [k]
    abscond: list[float]  # [k]


def draw_circle(rng: np.random.Generator, n: int) -> Draws:
    """Fixed-size draws: the number of random numbers never depends on the path taken."""
    return Draws(
        default=rng.random((n + 1, n)).tolist(),
        bid=rng.random((n + 1, n)).tolist(),
        shock=rng.random(n + 1).tolist(),
        abscond=rng.random(n + 1).tolist(),
    )


def circle_streams(seed: int, circles: int) -> list[np.random.Generator]:
    """One independent stream per circle (docs/08 section 6, rule 1)."""
    return [np.random.default_rng(s) for s in np.random.SeedSequence(seed).spawn(circles)]


@dataclass
class _Shortfall:
    """Amounts still to restore, oldest first (docs/03 section 6.8)."""

    round: int
    member: int
    uncovered: int
    reserve: int
    bond: int


@dataclass(frozen=True)
class RoundRecord:
    winner: int
    bid: int
    pot: int
    payout: int
    holdback: int
    fee: int
    premium: int
    uncovered: int


@dataclass
class CircleOutcome:
    """What one design did to one circle."""

    design: str
    rounds: list[RoundRecord] = field(default_factory=list)
    defaults: list[tuple[int, int, bool]] = field(default_factory=list)  # (member, round, dead)
    receipt_round: list[int] = field(default_factory=list)  # 0 = never received
    contributed: list[int] = field(default_factory=list)
    uncovered_left: list[int] = field(default_factory=list)  # per member, as receiver
    holdback_after: list[int] = field(default_factory=list)  # total holdback after each round
    late_losses: list[tuple[int, int]] = field(default_factory=list)  # honest late: (loss, paid)
    honest_short: bool = False  # an honest winner was paid short, or the organizer ran off
    absconded: bool = False
    uncovered_end: int = 0
    uncovered_created: int = 0
    bond0: int = 0
    bond_peak_used: int = 0
    bond_returned: int = 0
    fees_to_organizer: int = 0
    abscond_cash: int = 0
    got: list[int] = field(
        default_factory=list
    )  # per member: pot, holdback paid back, reserve share
    reserve_end: int = 0  # reserve split at the end (docs/03 section 5.3 step 5, ADR-24)
    reserve_shares: list[int] = field(default_factory=list)  # per member, 0 for defaulted members

    @property
    def organizer_net(self) -> int:
        return self.fees_to_organizer + self.abscond_cash - (self.bond0 - self.bond_returned)

    @property
    def distinct_default_rounds(self) -> int:
        return len({r for _, r, _ in self.defaults})


def simulate_circle(
    sc: Scenario,
    design: Design,
    draws: Draws,
    plan: DefaultPlan | None = None,
    bids: UniformFractionOfCap | ScriptedBids | None = None,
) -> CircleOutcome:
    """Run all N rounds of one circle and finalize it. Raises if the ledger ever breaks."""
    n, c = sc.n, sc.c * hm.USDC
    period = sc.period_days * hm.DAY
    half = n // 2
    beh = sc.behaviour
    bids = bids or UniformFractionOfCap()
    release = hm.release_per_round(design.alpha_bps, c)

    bond0 = hm.bps_of(hm.max_exposure(n, c), design.bond_bps)
    bond, reserve, fee_escrow, balance = bond0, 0, 0, bond0
    holdback = [0] * n
    received = [0] * n
    defaulted = [False] * n
    contrib = [0] * n
    got = [0] * n
    owed = [0] * n  # uncovered still owed to the member as a receiver
    winners = [0] * (n + 1)
    sched: dict[int, int] = dict(plan.fixed) if plan is not None else {}
    open_sf: list[_Shortfall] = []
    out = CircleOutcome(design=design.name, bond0=bond0)
    out.receipt_round = received
    out.contributed = contrib
    out.got = got
    out.uncovered_left = owed
    peak_used = 0

    def restore(member: int, avail: int, now_round: int) -> int:
        """Pay back ``member``'s open shortfalls from ``avail``; return the amount used.

        Per shortfall, oldest first: uncovered (straight to that round's receiver), reserve,
        bond; principal first, late interest after (docs/03 section 6.8).
        """
        nonlocal reserve, bond, balance
        left, paid_by_round = avail, []
        for sf in open_sf:
            if sf.member != member:
                continue
            principal = 0
            x = min(sf.uncovered, left)
            if x:
                owed[winners[sf.round]] -= x
                balance -= x
                sf.uncovered -= x
                left -= x
                principal += x
            x = min(sf.reserve, left)
            if x:
                reserve += x
                sf.reserve -= x
                left -= x
                principal += x
            x = min(sf.bond, left)
            if x:
                bond += x
                sf.bond -= x
                left -= x
                principal += x
            paid_by_round.append((sf.round, principal))
        if design.reserve_bps > 0:  # interest needs a reserve to land in
            for r, principal in paid_by_round:
                fee = hm.late_fee(
                    principal, LATE_RATE_BPS, (now_round - r) * period, period, period
                )
                x = min(fee, left)
                reserve += x
                left -= x
        open_sf[:] = [s for s in open_sf if s.uncovered or s.reserve or s.bond]
        return avail - left

    for k in range(1, n + 1):
        shock = beh.shock_multiplier if draws.shock[k] < beh.shock_prob else 1.0
        new_default = False
        for i in range(n):
            if defaulted[i]:
                continue
            if plan is not None:
                hit = sched.get(i) == k
            else:
                if received[i]:
                    h = beh.dead_early if received[i] <= half else beh.dead_late
                else:
                    h = beh.live
                hit = draws.default[k][i] < min(h * shock, 1.0)
            if hit:
                defaulted[i] = True
                new_default = True
                out.defaults.append((i, k, received[i] > 0))

        live = [i for i in range(n) if not received[i] and not defaulted[i]]
        if live:
            if len(live) > 1:
                cap = hm.bid_cap_after_share(
                    hm.max_bid(CAP_BPS, n, k, c, period, len(live) - 1), design.share_bps
                )
                best, w = -1, -1
                for i in live:
                    b = bids.bid_for(i, k, cap, draws.bid[k][i])
                    if b > best:
                        best, w = b, i
                bid = best
            else:
                w, bid = live[0], 0
        else:  # only frozen members are left: the smallest joinIndex receives (docs/03 6.4)
            w = next(i for i in range(n) if not received[i])
            bid = 0

        # Pull, then cover what could not be pulled (docs/03 section 6.5 steps 2 to 4).
        pot = round_unc = 0
        paid_on_time: list[int] = []
        for j in range(n):
            if j == w:
                continue
            due = c if received[j] else c - bid
            if not defaulted[j]:
                pot += due
                contrib[j] += due
                balance += due
                paid_on_time.append(j)
                continue
            rem = due
            from_hb = min(holdback[j], rem)
            holdback[j] -= from_hb
            rem -= from_hb
            from_bond = min(bond, rem)
            bond -= from_bond
            rem -= from_bond
            from_res = min(reserve, rem)
            reserve -= from_res
            rem -= from_res
            pot += due - rem
            round_unc += rem
            if from_bond or from_res or rem:
                open_sf.append(_Shortfall(k, j, rem, from_res, from_bond))
        peak_used = max(peak_used, bond0 - bond)

        if design.abscond_prob > 0 and draws.abscond[k] < design.abscond_prob:
            balance -= pot  # the organizer keeps this round's pot and the circle stops
            out.absconded, out.abscond_cash = True, pot
            break

        payers = max(len(live) - 1, 0)  # L_k: live members who pay this round (docs/03 section 2.7)
        room = hm.commission_room(hm.max_bid(CAP_BPS, n, k, c, period, payers), payers)
        fee = hm.commission(pot, design.fee_bps, design.share_bps, room)
        premium = hm.bps_of(pot, design.reserve_bps)
        reserve += premium
        if design.forfeit_fee:
            if new_default:
                reserve += fee
            else:
                fee_escrow += fee
        else:
            balance -= fee
            out.fees_to_organizer += fee
        avail = pot - fee - premium
        if defaulted[w]:
            held, repaid = 0, restore(w, avail, k)
        else:
            held, repaid = min(hm.holdback_for(design.alpha_bps, n, k, c), avail), 0
            holdback[w] += held
        payout = avail - held - repaid
        balance -= payout
        got[w] += payout
        for d in paid_on_time:
            if received[d]:
                x = min(holdback[d], release)
                holdback[d] -= x
                balance -= x
                got[d] += x

        winners[k], received[w] = w, k
        owed[w] += round_unc
        out.uncovered_created += round_unc
        out.rounds.append(RoundRecord(w, bid, pot, payout, held, fee, premium, round_unc))
        out.holdback_after.append(sum(holdback))
        if plan is not None and plan.kind != "fixed":
            target = plan.default_round(n, k, draws.default[k][w])
            if target is not None:
                sched[w] = target
        if balance != bond + reserve + sum(holdback) + fee_escrow:
            raise RuntimeError(f"ledger broken at round {k}: {design.name}")

    if not out.absconded:  # finalize (docs/03 section 5.3)
        for m in range(n):
            if defaulted[m] and holdback[m]:
                holdback[m] -= restore(m, holdback[m], n)
            balance -= holdback[m]
            got[m] += holdback[m]
            holdback[m] = 0
        out.fees_to_organizer += fee_escrow
        balance -= fee_escrow
        fee_escrow = 0
        # The reserve is split by on-time weight among members who did not default (ADR-24). Nobody
        # in this model pays late (a default is absorbing), so every honest weight is n - 1.
        out.reserve_end = reserve
        out.reserve_shares = [0] * n
        heirs = [i for i in range(n) if not defaulted[i]]
        weights = [hm.on_time_weight(n, 0, 0) for _ in heirs]
        if heirs and sum(weights) > 0:
            for i, w_i in zip(heirs, weights, strict=True):
                out.reserve_shares[i] = hm.reserve_share(reserve, w_i, sum(weights))
            out.reserve_shares[heirs[0]] += reserve - sum(
                out.reserve_shares
            )  # dust: smallest joinIndex
            for i in heirs:
                got[i] += out.reserve_shares[i]
        balance -= reserve
        reserve = 0
    out.bond_returned = bond
    balance -= bond
    bond = 0
    if balance != 0:
        raise RuntimeError(f"ledger not empty after finalize: {balance} ({design.name})")

    out.bond_peak_used = peak_used
    out.uncovered_end = sum(max(0, x) for x in owed)
    honest_set = [i for i in range(n) if not defaulted[i]]
    slot = len(out.rounds) + 1
    for i in honest_set:
        if received[i]:
            if out.rounds[received[i] - 1].uncovered:
                out.honest_short = True
            if received[i] > half and contrib[i]:
                out.late_losses.append((owed[i], contrib[i]))
        elif out.absconded:
            # never received: hypothetical slot follows the join order (docs/08 section 3)
            pos = sum(1 for x in range(i) if not received[x])
            if slot + pos > half and contrib[i]:
                out.late_losses.append((contrib[i], contrib[i]))
    if out.absconded:
        out.honest_short = True
    return out
