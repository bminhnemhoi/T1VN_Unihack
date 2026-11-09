import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hui_engine import Circle, max_bid, BPS
C=1_000_000
class C2(Circle):
    """fee_mode 'capshare': fee_k = min(phi * cap_k * L_k, hard_bps * pot); bids limited to (1-phi) * cap_k."""
    def __init__(s,*a,phi=0,hard=300,**k):
        super().__init__(*a,**k); s.phi=phi; s.hard=hard
    def room(s,k,payers):
        return max_bid(s.cap_bps,s.N,k,s.C,s.P,payers)*payers  # tổng lãi tối đa luật cho phép người hốt kỳ k
    def fee_for(s,k,pot,w):
        if s.fee_mode!="capshare": return super().fee_for(k,pot,w)
        payers=s.N-k  # không có Frozen trong mô phỏng này
        return min(s.room(k,payers)*s.phi//BPS, pot*s.hard//BPS)
    def bidcap(s):
        cap=s.cap()
        return cap*(BPS-s.phi)//BPS if s.fee_mode=="capshare" else cap
def run(N,Pd,sched,theta,alpha=2000,default_k=None):
    mode,val=sched
    kw=dict(fee_mode=mode,fee_bps=val) if mode!="capshare" else dict(fee_mode="capshare",phi=val)
    c=C2([f"P{i}" for i in range(1,N+1)],C,Pd*86400,alpha=alpha,**kw)
    pool=0; legal_strict=True
    for k in range(1,N+1):
        w=c.m[k-1]; live=c.live()
        fails={c.m[default_k-1]} if default_k and k>default_k else set()
        b=c.bidcap()*theta//100 if len(live)>1 else 0
        bids={w:b}
        r=c.settle(bids,[w],fails=fails)
        L=len(live)-1
        if L and r["b"]*L+r["fee"]>max_bid(2000,N,k,C,Pd*86400,L)*L: legal_strict=False
        pool+=r["b"]*L
        if default_k and k==default_k+1: c.mark_default(c.m[default_k-1])
    fin=c.finalize()
    return c,fin,pool,legal_strict
def irr(cf,ppy):
    npv=lambda r:sum(v/(1+r)**t for t,v in cf.items())
    lo,hi=-0.95,5.0
    if npv(lo)*npv(hi)>0: return float('nan')
    for _ in range(200):
        mid=(lo+hi)/2
        if npv(lo)*npv(mid)<=0: hi=mid
        else: lo=mid
    return (1+mid)**ppy-1
def ev(N,Pd,sched,theta=50,alpha=2000,hz=1.0):
    c,fin,pool,strict=run(N,Pd,sched,theta,alpha)
    nets=[c.got[x]-c.paid[x] for x in c.m]
    el=0
    for k in range(1,N):
        _,fd,_,_=run(N,Pd,sched,theta,alpha,default_k=k)
        el+=hz*(0.0204 if k<=N//2 else 0.0059)*(fin["org_out"]-fd["org_out"])
    yrs=N*Pd/365
    return dict(gross=fin["fees"],el=el,net=fin["fees"]-el,bond=c.bond0,ann=(fin["fees"]-el)/c.bond0/yrs,
                nets=nets,pool=pool,strict=strict,irr1=irr(c.cash[c.m[0]],365/Pd),
                last3_ok=all(v>=0 for v in nets[N-max(1,N//3):]))
if __name__=="__main__":
    S=[("Cố định 1%",("flat",100)),("Giảm dần 3%->0",("declining",300)),("Theo trần, φ=25%",("capshare",2500)),("Theo trần, φ=33%",("capshare",3333)),("Theo trần, φ=50%",("capshare",5000))]
    for Pd,cyc in ((7,"TUẦN"),(30,"THÁNG")):
        for N in (5,8,10,12):
            print(f"\n=== Hụi {cyc}, {N} người, 1 triệu/kỳ, thăm 50% mức cho phép")
            for name,s in S:
                e=ev(N,Pd,s)
                n=e["nets"]
                print(f"  {name:18s} chủ hụi thu {e['gross']/1e3:7,.0f}k, trừ rủi ro {e['net']/1e3:7,.0f}k ({e['ann']*100:5.1f}%/năm) | hốt đầu {n[0]/1e3:6,.0f}k, giữa {n[(N-1)//2]/1e3:5,.0f}k, cuối {n[-1]/1e3:5,.0f}k | 1/3 cuối không lỗ: {'có' if e['last3_ok'] else 'KHÔNG'} | trong trần kể cả khi tính hoa hồng là lãi: {'có' if e['strict'] else 'KHÔNG'}")
