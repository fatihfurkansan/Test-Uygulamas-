"use strict";
/* =====================================================================
   Tek diyot elektrik modeli (hibrit modelin elektrik tarafı)
     I = IL − I0·[exp((V + I·Rs)/(n·Vt)) − 1] − (V + I·Rs)/Rsh
   • Hücre parametreleri datasheet noktalarından uydurulur (Voc, Isc, Vmpp, Impp, Rsh):
     her n için Rs, (Vmpp, Impp) noktasından; n, MPP’de dP/dV = 0 şartından bulunur.
   • Sıcaklık: IL α ile, I0 ise Voc’nin β katsayısını sağlayacak şekilde ayarlanır;
     n·Vt’nin sıcaklık üssü m, Pmax katsayısı γ’yı sağlayacak şekilde uydurulur (α, β, γ üçü birden tutar).
   • Modül: hücre → dal (seri) → alt dizi (yarım hücrede üst ∥ alt) → bypass diyot → modül
     ve dış seri direnç (tel, bus, J-box, kablo kayıplarının eşdeğeri).
   ===================================================================== */
const K_EV=8.617333262e-5;
const vtK=Tc=>K_EV*(Tc+273.15);

/* W(exp(L)) — Lambert W ana dal, logaritmik argümanla (büyük değerlerde taşmaz) */
function lambertWlog(L){
  if(L<-45)return Math.exp(L);
  if(L>1){let w=L-Math.log(L);
    for(let i=0;i<40;i++){const d=(w+Math.log(w)-L)/(1+1/w);w-=d;if(Math.abs(d)<=1e-15*w)break;}
    return w;}
  const x=Math.exp(L);let w=x/(1+x);
  for(let i=0;i<40;i++){const e=Math.exp(w),f=w*e-x,d=f/(e*(w+1)-(w+2)*f/(2*w+2));w-=d;if(Math.abs(d)<1e-16)break;}
  return w;
}
/* Hücre gerilimi V(I) — açık Lambert W çözümü */
function cellV(I,c){
  const L=Math.log(c.I0*c.Rsh/c.nVt)+c.Rsh*(c.IL+c.I0-I)/c.nVt;
  return (c.IL+c.I0-I)*c.Rsh-I*c.Rs-c.nVt*lambertWlog(L);
}
/* Datasheet noktalarından parametre uydurma (tek hücre / parça) */
const FIT_CACHE=new Map();
function fitCell(Voc,Isc,Vmp,Imp,Rsh){
  const key=[Voc,Isc,Vmp,Imp,Rsh].map(v=>(+v).toPrecision(8)).join('|');
  if(FIT_CACHE.has(key))return FIT_CACHE.get(key);
  const Vt=vtK(25);
  const solveRs=n=>{const nVt=n*Vt;
    const IL_=Rs=>Isc*(1+Rs/Rsh),I0_=Rs=>(IL_(Rs)-Voc/Rsh)/Math.expm1(Voc/nVt);
    const res=Rs=>IL_(Rs)-I0_(Rs)*Math.expm1((Vmp+Imp*Rs)/nVt)-(Vmp+Imp*Rs)/Rsh-Imp;
    let lo=0,hi=(Voc-Vmp)/Imp;if(!(res(lo)>0)||!(res(hi)<0))return null;
    for(let k=0;k<70;k++){const m=(lo+hi)/2;if(res(m)>0)lo=m;else hi=m;}
    const Rs=(lo+hi)/2;return {n,nVt,Rs,Rsh,IL:IL_(Rs),I0:I0_(Rs)};};
  const g=c=>{const e=Math.exp((Vmp+Imp*c.Rs)/c.nVt),G=c.I0/c.nVt*e+1/c.Rsh;return Imp-Vmp*G/(1+G*c.Rs);};
  let prev=null,best=null,out=null;
  for(let n=0.6;n<=3.0001&&!out;n+=0.01){const c=solveRs(n);if(!c){prev=null;continue;}const gv=g(c);
    if(!best||Math.abs(gv)<Math.abs(best.g))best={c,g:gv};
    if(prev&&Math.sign(gv)!==Math.sign(prev.g)){let a=prev.c.n,b=n,ga=prev.g;
      for(let k=0;k<60;k++){const m=(a+b)/2,cm=solveRs(m);if(!cm)break;const gm=g(cm);if(Math.sign(gm)===Math.sign(ga)){a=m;ga=gm;}else b=m;}
      const cf=solveRs((a+b)/2);if(cf)out=Object.assign(cf,{ok:true});}
    prev={c,g:gv};}
  if(!out&&best)out=Object.assign(best.c,{ok:false});
  if(out){out.Voc=Voc;
    let lo=0,hi=Isc*1.1;for(let k=0;k<70;k++){const m=(lo+hi)/2;if(cellV(m,out)>0)lo=m;else hi=m;}
    let pb=0,ib=0;for(let k=0;k<=3000;k++){const I=lo*k/3000,P=I*cellV(I,out);if(P>pb){pb=P;ib=I;}}
    out.Pfit=pb;out.Impfit=ib;out.Vmpfit=pb/ib;out.errP=(pb/(Vmp*Imp)-1)*100;out.errImp=(ib/Imp-1)*100;
    out.ok=Math.abs(out.errP)<0.3&&Math.abs(out.errImp)<1.5;out.boundary=out.n<=0.61||out.n>=2.99;}
  FIT_CACHE.set(key,out);return out;
}
/* Sıcaklık ve ışınıma göre hücre parametreleri; mT: n·Vt ∝ T^mT (fiziksel değer 1) */
function cellAt(base,G,Tc,aIsc,bVoc,mT=1){
  const dT=Tc-25,nVt=base.n*vtK(25)*Math.pow((Tc+273.15)/298.15,mT),IL1=base.IL*(1+aIsc/100*dT),VocT=base.Voc*(1+bVoc/100*dT);
  const I0=Math.max((IL1-VocT/base.Rsh)/Math.expm1(VocT/nVt),1e-40);
  return {IL:IL1*G/1000,I0,Rs:base.Rs,Rsh:base.Rsh,nVt};
}
/* Tek hücre Pmax (altın oran araması; P(I) tek tepeli) */
function cellPmax(c){let a=0,b=c.IL,g=0.6180339887;const P=I=>I*cellV(I,c);
  let x1=b-g*(b-a),x2=a+g*(b-a),f1=P(x1),f2=P(x2);
  for(let k=0;k<60;k++){if(f1<f2){a=x1;x1=x2;f1=f2;x2=a+g*(b-a);f2=P(x2);}else{b=x2;x2=x1;f2=f1;x1=b-g*(b-a);f1=P(x1);}}
  return Math.max(f1,f2);}
/* γ uyumu: hücrenin 25→50 °C Pmax değişimi girilen γ’yı verecek mT üssü (sekant) */
const MT_CACHE=new Map();
function fitTempExp(base,tc,aIsc,bVoc){
  if(!Number.isFinite(tc))return {m:1,ok:true};
  const key=[base.n,base.Rs,base.Rsh,base.IL,base.I0,tc,aIsc,bVoc].map(v=>(+v).toPrecision(9)).join('|');
  if(MT_CACHE.has(key))return MT_CACHE.get(key);
  const P25=cellPmax(cellAt(base,1000,25,aIsc,bVoc,1)),target=tc/100*25;
  const g=m=>cellPmax(cellAt(base,1000,50,aIsc,bVoc,m))/P25-1-target;
  let m0=1,g0=g(m0),m1=1.3,g1=g(m1);
  for(let i=0;i<30&&Math.abs(g1)>1e-9;i++){const m2=m1-g1*(m1-m0)/(g1-g0||1e-12);m0=m1;g0=g1;m1=Math.min(5,Math.max(-3,m2));g1=g(m1);}
  const out={m:m1,ok:Math.abs(g1)<1e-6&&m1>0&&m1<5};MT_CACHE.set(key,out);return out;
}
/* Modül düzeyinde γ: dış seri direnç ve akım artışı katsayıyı ~0,01 %/°C kaydırır; hücre hedefi düzeltilir */
const MOD_MT_CACHE=new Map();
function fitModuleTemp(spec,tc){
  if(!Number.isFinite(tc))return {m:1,ok:true};
  const f=spec.full,key=[f.n,f.Rs,f.Rsh,f.IL,f.I0,tc,spec.aIsc,spec.bVoc,spec.Rext,spec.kIL,JSON.stringify(spec.groups)].map(v=>typeof v==='number'?(+v).toPrecision(8):v).join('|');
  if(MOD_MT_CACHE.has(key))return MOD_MT_CACHE.get(key);
  const gMod=m=>{const s=Object.assign({},spec,{mT:m});return (moduleIV(Object.assign({},s,{Tc:50})).Pmp/moduleIV(s).Pmp-1)/25*100;};
  let t=tc,mt=fitTempExp(f,t,spec.aIsc,spec.bVoc);
  for(let i=0;i<3;i++){const g=gMod(mt.m);if(Math.abs(g-tc)<5e-4)break;t+=tc-g;mt=fitTempExp(f,t,spec.aIsc,spec.bVoc);}
  MOD_MT_CACHE.set(key,mt);return mt;
}
/* Monoton azalan tabloda y(x) doğrusal enterpolasyon (uçlarda doğrusal uzatma) */
/* Eğriyi gerilim ekseninde eşit aralıklı örnekler (grafikler için): 0 … Voc */
function ivCurve(m,n=150){const x=[],y=[],P=[];for(let k=0;k<=n;k++){const V=m.Voc*k/n,I=Math.max(0,interpDec(m.V,m.I,V));x.push(V);y.push(I);P.push(V*I);}return {x,y,P};}
function interpDec(xs,ys,x){
  const n=xs.length;
  if(x>=xs[0]){const s=(ys[1]-ys[0])/(xs[1]-xs[0]||-1e-12);return ys[0]+s*(x-xs[0]);}
  if(x<=xs[n-1]){const s=(ys[n-1]-ys[n-2])/(xs[n-1]-xs[n-2]||-1e-12);return ys[n-1]+s*(x-xs[n-1]);}
  let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(xs[m]>x)lo=m;else hi=m;}
  const t=(x-xs[lo])/(xs[hi]-xs[lo]);return ys[lo]+t*(ys[hi]-ys[lo]);
}
function gauss1(rng){let u=0;while(u===0)u=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rng());}

/* Modül IV eğrisi
   spec: {piece, groups:[{branches:[nCells,...]}], kIL, Rext, Vd, G, Tc, aIsc, bVoc,
          shade:{sub,br,n,frac}|null, cv(%)|0, seed} */
function moduleIV(spec){
  const c0=cellAt(spec.piece,spec.G,spec.Tc,spec.aIsc,spec.bVoc,spec.mT||1);c0.IL*=spec.kIL;
  const kV=spec.kV||1; // kalibrasyon çarpanı: gerilim ölçeği (Isc ve FF’yi değiştirmez)
  const ILmax=c0.IL,NI=420,Imax=ILmax*1.25;
  const Ib=new Float64Array(NI);for(let k=0;k<NI;k++)Ib[k]=Imax*k/(NI-1);
  const vCache=new Map();
  const vCurve=m=>{const key=m.toFixed(6);if(vCache.has(key))return vCache.get(key);
    const c=Object.assign({},c0,{IL:c0.IL*m});const a=new Float64Array(NI);for(let k=0;k<NI;k++)a[k]=cellV(Ib[k],c);vCache.set(key,a);return a;};
  const rng=spec.cv>0?mulberry32(spec.seed||7):null;
  const fast=!spec.shade&&!(spec.cv>0);
  const subs=spec.groups.map((g,si)=>g.branches.map((nc,bi)=>{
    const V=new Float64Array(NI);const mult=[];
    for(let j=0;j<nc;j++){let m=1;if(rng)m*=1+gauss1(rng)*spec.cv/100;
      if(spec.shade&&spec.shade.sub===si&&spec.shade.br===bi&&j<spec.shade.n)m*=1-spec.shade.frac;mult.push(m);}
    if(fast){const a=vCurve(1);for(let k=0;k<NI;k++)V[k]=a[k]*nc;}
    else{const cnt=new Map();for(const m of mult){const key=m.toFixed(6);cnt.set(key,(cnt.get(key)||0)+1);}
      for(const [key,n] of cnt){const a=vCurve(+key);for(let k=0;k<NI;k++)V[k]+=a[k]*n;}}
    return {V,mult};}));
  // alt dizi: paralel dalların akımları gerilim ızgarasında toplanır
  const nb=Math.max(...spec.groups.map(g=>g.branches.length));
  const NM=520,Imod=Imax*nb,Im=new Float64Array(NM);for(let k=0;k<NM;k++)Im[k]=Imod*k/(NM-1);
  const negIb=Array.from(Ib,x=>-x);
  const subV=subs.map(brs=>{
    const out=new Float64Array(NM);
    if(fast){const nbr=brs.length;for(let k=0;k<NM;k++)out[k]=interpDec(negIb,brs[0].V,-Im[k]/nbr);return out;}
    if(brs.length===1){for(let k=0;k<NM;k++)out[k]=interpDec(negIb,brs[0].V,-Im[k]);return out;}
    let vmin=Infinity,vmax=-Infinity;for(const b of brs){vmin=Math.min(vmin,b.V[NI-1]);vmax=Math.max(vmax,b.V[0]);}
    vmin=Math.max(vmin,-spec.Vd-1);
    const NV=900,Vg=new Float64Array(NV),Is=new Float64Array(NV);
    for(let k=0;k<NV;k++){Vg[k]=vmax-(vmax-vmin)*k/(NV-1);let s=0;for(const b of brs)s+=interpDec(b.V,Ib,Vg[k]);Is[k]=s;}
    // Is(V) artan; V(I) için ters tablo
    const negI=Array.from(Is,x=>-x);for(let k=0;k<NM;k++)out[k]=interpDec(negI,Vg,-Im[k]);return out;});
  const V=new Float64Array(NM),P=new Float64Array(NM),byp=subV.map(()=>false);
  for(let k=0;k<NM;k++){let s=0;for(const sv of subV)s+=Math.max(kV*sv[k],-spec.Vd);V[k]=s-Im[k]*spec.Rext;P[k]=V[k]*Im[k];}
  let km=0;for(let k=1;k<NM;k++)if(P[k]>P[km])km=k;
  let Pmp=P[km],Imp=Im[km],Vmp=V[km];
  if(km>0&&km<NM-1){const y0=P[km-1],y1=P[km],y2=P[km+1],den=y0-2*y1+y2;if(den<0){const d=0.5*(y0-y2)/den,h=Im[1]-Im[0];Imp=Im[km]+d*h;Pmp=y1-0.25*(y0-y2)*d;Vmp=Pmp/Imp;}}
  let Isc=Im[NM-1];for(let k=1;k<NM;k++)if(V[k]<=0){Isc=Im[k-1]+(Im[k]-Im[k-1])*V[k-1]/(V[k-1]-V[k]);break;}
  const negIm=Array.from(Im,x=>-x);
  subV.forEach((sv,i)=>{byp[i]=kV*interpDec(negIm,sv,-Imp)<-spec.Vd+1e-9;});
  // gölgeli hücre: MPP’de ters gerilim ve ısı
  let hot=null;
  if(spec.shade){const si=spec.shade.sub,bi=spec.shade.br,brs=subs[si];if(brs&&brs[bi]){
    const vsub=Math.max(kV*interpDec(negIm,subV[si],-Imp),-spec.Vd)/kV;
    const ib=brs.length===1?Imp:interpDec(brs[bi].V,Ib,vsub);
    const m=brs[bi].mult[0],c=Object.assign({},c0,{IL:c0.IL*m}),vc=cellV(ib,c);hot={I:ib,V:vc,P:Math.max(0,-vc*ib)};}}
  const Voc=V[0];
  return {I:Im,V,P,Pmp,Vmp,Imp,Voc,Isc,FF:Pmp/(Voc*Isc),bypass:byp,hot,cell:c0};
}

/* Tasarımdan modül tanımı */
function ivSpec(p,R,o={}){
  const half=R.half&&R.lo>0,nc=R.nc,groups=[];
  for(let s=0;s<nc;s+=2){const cols=Math.min(2,nc-s);groups.push({branches:half?[cols*R.up,cols*R.lo]:[cols*R.nr]});}
  const A=(p.a*p.b-4*(p.ch>0?p.ch*p.ch/2:0))/100;
  const RshFull=p.RshC>0?p.RshC:10000/A;
  const full=fitCell(p.Voc,p.Isc,p.Vmp,p.Imp,RshFull);
  if(!full)return null;
  const piece=R.half?{n:full.n,nVt:full.nVt,Rs:full.Rs*2,Rsh:full.Rsh*2,IL:full.IL/2,I0:full.I0/2,Voc:full.Voc,ok:full.ok}:full;
  const base={piece,full,groups,kIL:R.kILiv,kV:1,Rext:R.Rext,Vd:p.Vd,G:1000,Tc:25,aIsc:p.aIsc,bVoc:p.bVoc,shade:null,cv:0,seed:7};
  const mt=fitModuleTemp(base,p.tc);
  return Object.assign(base,{mT:mt.m,mTok:mt.ok},o);
}
