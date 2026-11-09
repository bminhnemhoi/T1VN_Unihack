import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hui_engine import Circle
U=1_000_000; C=100*U; P=30*86400; M=["S1","S2","H3","H4","H5"]
f=lambda x:f"{x/U:,.6f}".replace(",","X").replace(".",",").replace("X",".")
def run(n_sybil,bond):
    c=Circle(M,C,P,bond=bond)
    c.settle({"S1":c.cap()},["S1"])                       # ví ảo 1 thăm trần, thắng kỳ 1
    if n_sybil==2:
        c.settle({"S2":c.cap()},["S2"],fails={"S1"}); c.mark_default("S1")
        c.settle(fails={"S1","S2"}); c.mark_default("S2")
        c.settle(fails={"S1","S2"}); c.settle(fails={"S1","S2"})
    else:
        c.settle(fails={"S1"}); c.mark_default("S1")
        for _ in range(3): c.settle(fails={"S1"})
    fin=c.finalize()
    syb=["S1","S2"][:n_sybil]
    org=sum(c.got[x]-c.paid[x] for x in syb)+fin["org_out"]-c.bond0
    unc=sum(r["unc"] for r in c.log); last=c.log[-1]
    return org,unc,last,c,fin
for n,bond,label in ((1,480*U,"1 ví ảo, CI 100%"),(2,480*U,"2 ví ảo, CI 100%"),(1,180*U,"1 ví ảo, CI 50% (v1.1 cho phép)")):
    org,unc,last,c,fin=run(n,bond)
    print(f"{label}: chủ hụi lời/lỗ {f(org)} USDC | tổng thiếu không bù {f(unc)} | người hốt kỳ 5 ({last['w']}) nhận {f(last['payout'])} (bình thường 392) | ví ảo kỳ 1 nhận {f(c.log[0]['payout'])}" + (f", ví ảo kỳ 2 nhận {f(c.log[1]['payout'])}" if n==2 else ""))
