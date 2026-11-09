import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hui_engine import Circle
U=1_000_000; C=100*U; P=30*86400; M=["M1","M2","M3","M4","M5"]
ok=True
def chk(name, got, exp):
    global ok
    good = got==exp; ok &= good
    print(f"  {'OK ' if good else 'SAI'} {name}: {got} (contract/docs: {exp})")
def first_two(c):
    r1=c.settle({"M2":4*U,"M4":6*U},["M2","M4"])
    r2=c.settle({"M1":3*U,"M2":3*U},["M1","M2"],fails={"M4"})
    return r1,r2
print("== Kỳ 1, kỳ 2 (WorkedExample.t.sol)")
c=Circle(M,C,P,bond=480*U); r1,r2=first_two(c)
chk("kỳ1 người thắng",r1["w"],"M4"); chk("kỳ1 pot",r1["pot"],376*U); chk("kỳ1 tiền công",r1["fee"],3_760_000); chk("kỳ1 giữ lại",r1["H"],80*U); chk("kỳ1 M4 nhận",r1["payout"],288_480_000)
chk("kỳ2 người thắng",r2["w"],"M1"); chk("kỳ2 pot",r2["pot"],391*U); chk("kỳ2 M1 nhận",r2["payout"],323_180_000); chk("kỳ2 cọc",c.bond,460*U); chk("kỳ2 quỹ",c.reserve,7_670_000)
print("== Nhánh A: M4 trả trễ 1 ngày")
tot,fee,rel=c.pay_late("M4",2,86400)
chk("lãi chậm góp (tính riêng phần 20 và 80)",fee,5479+21917); chk("M4 được nhả lại",rel,20*U); chk("cọc về",c.bond,480*U); chk("holdback M4",c.hold["M4"],60*U)
for _ in range(3): c.settle()
chk("người thắng kỳ 3..5",[c.winner[k] for k in (3,4,5)],["M2","M3","M5"])
fin=c.finalize(); R=7_670_000+fee+12*U
chk("chủ hụi nhận (cọc 480 + tiền công 19,67)",fin["org_out"],480*U+19_670_000)
chk("mỗi người nhận từ quỹ (chia đều, dư cho M1)",[fin["shares"][x] for x in M],[R//5+(R-R//5*5)]+[R//5]*4)
print("   quỹ dự phòng cuối =",R)
print("== Nhánh B: M4 bỏ, markDefault")
c=Circle(M,C,P,bond=480*U); first_two(c); forf=c.mark_default("M4")
chk("tiền công kỳ 2 bị mất vào quỹ",c.reserve,11_580_000)
bonds=[]
for _ in range(3): c.settle(fails={"M4"}); bonds.append(c.bond)
chk("cọc 460->360->260->160",bonds,[360*U,260*U,160*U]); chk("quỹ",c.reserve,23_580_000)
fin=c.finalize(); chk("chủ hụi nhận (160 + 15,76)",fin["org_out"],160*U+15_760_000)
chk("M1,M2,M3,M5 mỗi người",[fin["shares"][x] for x in ("M1","M2","M3","M5")],[5_895_000]*4)
print("== Vector V1 của leader (chia quỹ theo đúng hạn, nhánh A)")
c=Circle(M,C,P,bond=480*U,reserve_split="weighted"); first_two(c); c.pay_late("M4",2,86400)
for _ in range(3): c.settle()
fin=c.finalize(); print("   quỹ:",fin["R"],"| chia:",{x:fin["shares"][x] for x in M},"| trọng số:",fin["weights"])
print("   leader ghi: quỹ 19.697.397; M1 4.146.822, M2/M3/M5 4.146.820, M4 3.110.115")
print("TẤT CẢ KHỚP" if ok else "CÓ CHỖ SAI")
