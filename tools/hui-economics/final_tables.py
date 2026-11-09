import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from schedules import ev, run
K=lambda x:f"{x/1e3:,.0f}k".replace(",",".")
S=("capshare",5000)
print("### A. Cấu hình đề xuất: hoa hồng nằm trong trần (φ=50%, tối đa 3%/kỳ), giữ lại 20%, thăm 50% mức cho phép, rủi ro K&R")
for Pd,cyc in ((7,"Tuần"),(30,"Tháng")):
    for N in (5,6,8,10,12,15):
        e=ev(N,Pd,S); n=e["nets"]
        e2=ev(N,Pd,S,hz=0.5)
        print(f"{cyc} N={N:2d} | cọc {e['bond']/1e6:.1f}tr | chủ hụi thu {K(e['gross'])} | trừ rủi ro {K(e['net'])} ({e['ann']*100:.1f}%/năm) | nếu rủi ro giảm 1/2: {K(e2['net'])} ({e2['ann']*100:.1f}%/năm) | hốt đầu {K(n[0])} (lãi thực {e['irr1']*100:.0f}%/năm) | hốt cuối +{K(n[-1])} | trong trần chặt: {e['strict']}")
print("\n### B. So 4 cách tính hoa hồng, hụi tháng 5 người (dây demo) và 10 người")
for N in (5,10):
    for name,s in (("Cố định 1%",("flat",100)),("Giảm dần 3%->0",("declining",300)),("Trong trần φ=33%",("capshare",3333)),("Trong trần φ=50%",("capshare",5000))):
        e=ev(N,30,s); n=e["nets"]
        print(f"N={N} {name:16s} | chủ hụi thu {K(e['gross'])}, trừ rủi ro {K(e['net'])} ({e['ann']*100:.1f}%/năm) | hốt đầu {K(n[0])} ({e['irr1']*100:.0f}%/năm) | hốt cuối +{K(n[-1])} | 1/3 cuối không lỗ {e['last3_ok']} | trong trần chặt {e['strict']}")
print("\n### C. Mức giữ lại α (φ=50%)")
for Pd,cyc,N in ((30,"Tháng",5),(30,"Tháng",10),(7,"Tuần",10)):
    for a in (2000,2500,3000):
        e=ev(N,Pd,S,alpha=a)
        c,fin,_,_=run(N,Pd,S,50,alpha=a)
        print(f"{cyc} N={N} α={a//100}% | cọc {e['bond']/1e6:.2f}tr | người hốt kỳ 1 cầm ngay {K(c.log[0]['payout'])} (bị giữ {K(c.log[0]['H'])}) | chủ hụi trừ rủi ro {K(e['net'])} ({e['ann']*100:.1f}%/năm) | lãi thực hốt đầu {e['irr1']*100:.0f}%/năm")
print("\n### D. Mức góp mỗi kỳ (tháng, 10 người, φ=50%): mọi khoản tiền tỷ lệ thuận; ngưỡng Điều 14 = 100 triệu/kỳ")
e=ev(10,30,S)
for Cv in (500_000,1_000_000,2_000_000,5_000_000,10_000_000):
    s=Cv/1_000_000
    print(f"góp {Cv/1e6:g}tr/kỳ | giá trị một kỳ N·C = {10*Cv/1e6:g}tr {'-> PHẢI báo UBND (Điều 14)' if 10*Cv>=100_000_000 else ''} | cọc {e['bond']*s/1e6:.1f}tr | chủ hụi thu {K(e['gross']*s)}, trừ rủi ro {K(e['net']*s)} | tỷ lệ %/năm không đổi: {e['ann']*100:.1f}%")
