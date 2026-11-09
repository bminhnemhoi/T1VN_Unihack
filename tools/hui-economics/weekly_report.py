import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schedules import C2
from hui_engine import max_bid
C=1_000_000; M=["A","B","C","D","E"]
f=lambda x:f"{x:,.0f}".replace(",",".")
def scenario(Pd, runner=False, split="weighted"):
    c=C2(M,C,Pd*86400,alpha=2000,fee_mode="capshare",phi=5000,reserve_split=split)
    plans=[({"A":5000,"B":7000},["A","B"],"A thăm 5.000đ, B thăm 7.000đ → **B** (thăm cao hơn)"),
           ({"C":5000,"D":5000},["D","C"],"C và D cùng thăm 5.000đ, cả hai chưa trễ lần nào → **D** (nộp phong bì trước)"),
           ({},[],"Không ai thăm → **A** hốt theo thứ tự dự phòng (A vào dây đầu tiên)"),
           ({"E":1000},["E"],"E thăm 1.000đ, C không thăm → **E**"),
           ({},[],"Chỉ còn C → **C** hốt, không thăm")]
    if Pd==30:
        plans=[({"A":20000,"B":30000},["A","B"],"A thăm 20.000đ, B thăm 30.000đ → **B** (thăm cao hơn)"),
               ({"C":20000,"D":20000},["D","C"],"C và D cùng thăm 20.000đ, cả hai chưa trễ lần nào → **D** (nộp phong bì trước)"),
               plans[2],({"E":4000},["E"],"E thăm 4.000đ, C không thăm → **E**"),plans[4]]
    scale=1
    rows=[]
    for k,(bids,order,note) in enumerate(plans,1):
        bids={x:int(v*scale) for x,v in bids.items()}
        legal=max_bid(2000,5,k,C,Pd*86400,len(c.live())-1)
        allowed=c.bidcap()
        assert all(v<=allowed for v in bids.values()), (k,bids,allowed)
        fails=set()
        if runner and k>=2: fails={"B"}
        if not runner and k==3: fails={"C"}
        r=c.settle(bids,order,fails=fails)
        extra=""
        if runner and k==2: c.mark_default("B")
        if not runner and k==3:
            tot,lf,_=c.pay_late("C",3,86400)
            extra=f"C trả trễ 1 ngày (trong ân hạn 48 giờ): {f(tot-lf)}đ + lãi chậm góp {f(lf)}đ; cọc được hoàn đủ, lãi vào quỹ dự phòng"
        rows.append((k,legal,allowed,note if scale==1 else note.replace("5.000",f(5000*scale)).replace("7.000",f(7000*scale)).replace("1.000đ",f(1000*scale)+"đ"),r,extra))
    fin=c.finalize()
    return c,rows,fin
def table(Pd,runner=False):
    c,rows,fin=scenario(Pd,runner)
    unit="Tuần" if Pd==7 else "Tháng"
    out=[f"| {unit} | Trần thăm luật / được bỏ (sau khi chừa phần hoa hồng) | Thăm | Người hốt | Tổng tiền hốt | Hoa hồng | Quỹ 1% | Giữ lại | **Nhận ngay** | Trả lại tiền giữ | Cọc còn |","|---|---|---|---|---|---|---|---|---|---|---|"]
    for k,legal,allowed,note,r,extra in rows:
        rel=", ".join(f"{x} +{f(v)}" for x,v in r["rel"].items()) or "-"
        out.append(f"| {k} | {f(legal)} / {f(allowed)} | {note} | {r['w']} | {f(r['pot'])} | {f(r['fee'])} | {f(r['prem'])} | {f(r['H'])} | **{f(r['payout'])}** | {rel} | {f(r['bond'])} |")
        if extra: out.append(f"| | | {extra} | | | | | | | | |")
    out.append("")
    org=fin["org_out"]
    out.append(f"Kết thúc: quỹ dự phòng **{f(fin['R'])}đ** chia theo số kỳ đóng đúng hạn (trọng số {', '.join(f'{x} {w}' for x,w in fin['weights'].items())}): " + ", ".join(f"{x} {f(v)}" for x,v in fin["shares"].items()) + ".")
    out.append(f"Chủ hụi: hoa hồng **{f(fin['fees'])}đ**, nhận lại cọc **{f(fin['bond_back'])}đ** / {f(c.bond0)}đ.")
    out.append("")
    out.append("| Người | Hốt kỳ | Tổng góp | Tổng nhận | Kết quả |")
    out.append("|---|---|---|---|---|")
    order={r[4]["w"]:r[0] for r in rows}
    for x in sorted(M,key=lambda y:order[y]):
        d=c.got[x]-c.paid[x]
        out.append(f"| {x} | {order[x]} | {f(c.paid[x])} | {f(c.got[x])} | {'lời' if d>=0 else 'chịu'} {f(abs(d))} |")
    inflow=sum(c.paid.values())+c.bond0; outflow=sum(c.got.values())+org
    out.append(f"\nKiểm sổ: tiền vào (góp + cọc) {f(inflow)}đ = tiền ra (nhận + trả chủ hụi) {f(outflow)}đ.")
    assert inflow==outflow
    return "\n".join(out)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"weekly_tables.md"),"w").write("## TUAN\n"+table(7)+"\n\n## TUAN_RUNNER\n"+table(7,True)+"\n\n## THANG\n"+table(30)+"\n")
print(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"weekly_tables.md")).read())
