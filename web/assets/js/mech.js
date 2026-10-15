"use strict";
/* =====================================================================
   Mekanik yük simülasyonu (IEC 61215 MQT 16 statik yük)
   • Laminat: büyük sehimli (von Kármán) plak; Ritz yöntemi, Legendre polinomları.
     Cam-cam: etkin kalınlık (Wölfel–Bennison / ASTM E1300 X9), enkapsülan kayma modülüyle.
   • Çerçeve: dört kenar kirişi (düşey eğilme EI, eksenel EA), cama silikon kayma yayıyla
     bağlı (kısmi ortak çalışma; kiriş ağırlık merkezi cam düzleminin e kadar altında).
   • Montaj: delik / kelepçe noktalarında rijit düşey mesnet.
   Birimler: mm, N, MPa (N/mm²). w yük yönünde pozitif (ön yükte aşağı).
   mechSolve saf bir fonksiyondur; Web Worker içinde de çalışır.
   ===================================================================== */
function mechSolve(M){
  const deg=M.deg||10,nu=M.nu,a=M.a,b=M.b,D=M.D,Am=M.Am;
  const gaussLeg=n=>{const x=new Float64Array(n),w=new Float64Array(n);
    for(let i=0;i<n;i++){let z=Math.cos(Math.PI*(i+0.75)/(n+0.5)),pp=1;
      for(let it=0;it<100;it++){let p1=1,p2=0;for(let j=1;j<=n;j++){const p3=p2;p2=p1;p1=((2*j-1)*z*p2-(j-1)*p3)/j;}
        pp=n*(z*p1-p2)/(z*z-1);const z1=z;z=z1-p1/pp;if(Math.abs(z-z1)<1e-15)break;}
      x[i]=z;w[i]=2/((1-z*z)*pp*pp);}
    return {x,w};};
  const leg=(xi,K)=>{const P=new Float64Array(K+1),d1=new Float64Array(K+1),d2=new Float64Array(K+1);P[0]=1;
    if(K>0){P[1]=xi;d1[1]=1;}
    for(let k=1;k<K;k++){P[k+1]=((2*k+1)*xi*P[k]-k*P[k-1])/(k+1);d1[k+1]=d1[k-1]+(2*k+1)*P[k];d2[k+1]=d2[k-1]+(2*k+1)*d1[k];}
    return {P,d1,d2};};
  // simetri: w çift-çift, u tek(x)-çift(y), v çift(x)-tek(y), çerçeve eksenel yer değiştirmesi tek
  const KX=deg+1,ev=[],od=[];for(let k=0;k<=deg;k+=2)ev.push(k);for(let k=1;k<=deg+1;k+=2)od.push(k);
  const wI=[],uI=[],vI=[];for(const i of ev)for(const j of ev)wI.push([i,j]);for(const i of od)for(const j of ev)uI.push([i,j]);for(const i of ev)for(const j of od)vI.push([i,j]);
  const fr=M.frame,nw=wI.length,nU=uI.length,nV=vI.length,nf=fr?od.length:0;
  const oU=nw,oV=nw+nU,oF=oV+nV,oG=oF+nf,N=oG+nf,n3=oF;
  const Kl=new Float64Array(N*N),F=new Float64Array(N);
  const addOuter=(K,u,v,s,len)=>{for(let r=0;r<len;r++){const ur=u[r]*s;if(ur===0)continue;const o=r*N;for(let c=0;c<len;c++)K[o+c]+=ur*v[c];}};
  // --- alan Gauss noktaları
  const ng=M.ng||deg+6,G2=gaussLeg(ng),LX=[],LY=[];
  for(let i=0;i<ng;i++){LX.push(leg(G2.x[i],KX));LY.push(leg(G2.x[i],KX));}
  const GP=[];
  for(let gi=0;gi<ng;gi++)for(let gj=0;gj<ng;gj++){const X=LX[gi],Y=LY[gj],wt=a*b*G2.w[gi]*G2.w[gj];
    const Nw=new Float64Array(nw),Wx=new Float64Array(nw),Wy=new Float64Array(nw),Wxx=new Float64Array(nw),Wyy=new Float64Array(nw),Wxy=new Float64Array(nw);
    wI.forEach(([i,j],k)=>{Nw[k]=X.P[i]*Y.P[j];Wx[k]=X.d1[i]*Y.P[j]/a;Wy[k]=X.P[i]*Y.d1[j]/b;Wxx[k]=X.d2[i]*Y.P[j]/(a*a);Wyy[k]=X.P[i]*Y.d2[j]/(b*b);Wxy[k]=X.d1[i]*Y.d1[j]/(a*b);});
    const Ux=new Float64Array(nU),Uy=new Float64Array(nU),Vx=new Float64Array(nV),Vy=new Float64Array(nV);
    uI.forEach(([i,j],k)=>{Ux[k]=X.d1[i]*Y.P[j]/a;Uy[k]=X.P[i]*Y.d1[j]/b;});
    vI.forEach(([i,j],k)=>{Vx[k]=X.d1[i]*Y.P[j]/a;Vy[k]=X.P[i]*Y.d1[j]/b;});
    GP.push({wt,Wx,Wy,Ux,Uy,Vx,Vy});
    // eğilme (doğrusal) ve yük
    for(let r=0;r<nw;r++){F[r]+=wt*Nw[r];const o=r*N;
      for(let c=0;c<nw;c++)Kl[o+c]+=wt*D*(Wxx[r]*Wxx[c]+Wyy[r]*Wyy[c]+nu*(Wxx[r]*Wyy[c]+Wyy[r]*Wxx[c])+2*(1-nu)*Wxy[r]*Wxy[c]);}}
  // --- kenarlar (her biri 2 adet, simetrik)
  const n1=deg+8,G1=gaussLeg(n1),E1=leg(1,KX);
  const addEdge=(long)=>{
    for(let g=0;g<n1;g++){const T=leg(G1.x[g],KX),L=long?a:b,dw=2*L*G1.w[g];
      const wv=new Float64Array(N),wss=new Float64Array(N),ws=new Float64Array(N),gv=new Float64Array(N),fs=new Float64Array(N);
      wI.forEach(([i,j],k)=>{if(long){wv[k]=T.P[i]*E1.P[j];ws[k]=T.d1[i]*E1.P[j]/a;wss[k]=T.d2[i]*E1.P[j]/(a*a);}
        else{wv[k]=E1.P[i]*T.P[j];ws[k]=E1.P[i]*T.d1[j]/b;wss[k]=E1.P[i]*T.d2[j]/(b*b);}});
      if(M.edgeK)addOuter(Kl,wv,wv,dw*M.edgeK,N);
      if(!fr)continue;
      if(M.kRot>0){const wn=new Float64Array(N);wI.forEach(([i,j],k)=>{wn[k]=long?T.P[i]*E1.d1[j]/b:E1.d1[i]*T.P[j]/a;});addOuter(Kl,wn,wn,dw*M.kRot,nw);}
      addOuter(Kl,wss,wss,dw*fr.EI,N);
      if(long){uI.forEach(([i,j],k)=>{gv[oU+k]=T.P[i]*E1.P[j];});od.forEach((k,m)=>{gv[oF+m]=-T.P[k];fs[oF+m]=T.d1[k]/a;});}
      else{vI.forEach(([i,j],k)=>{gv[oV+k]=E1.P[i]*T.P[j];});od.forEach((k,m)=>{gv[oG+m]=-T.P[k];fs[oG+m]=T.d1[k]/b;});}
      for(let k=0;k<nw;k++)gv[k]=-fr.e*ws[k];
      addOuter(Kl,fs,fs,dw*fr.EA,N);
      if(fr.ks>0)addOuter(Kl,gv,gv,dw*fr.ks,N);}};
  addEdge(true);addEdge(false);
  // --- mesnetler
  const basisW=(xi,eta)=>{const X=leg(xi,KX),Y=leg(eta,KX),v=new Float64Array(N);wI.forEach(([i,j],k)=>{v[k]=X.P[i]*Y.P[j];});return v;};
  const supB=(M.sup||[]).map(([x,y])=>basisW(x/a,y/b));
  for(const v of supB)addOuter(Kl,v,v,M.ksup,nw);
  // --- membran iç kuvveti ve teğet
  const c11=Am,c12=Am*nu,c33=Am*(1-nu)/2;
  const B1=new Float64Array(n3),B2=new Float64Array(n3),B3=new Float64Array(n3),T1=new Float64Array(n3),T2=new Float64Array(n3),T3=new Float64Array(n3);
  let Um=0;
  function memb(X,Kt){
    const Fm=new Float64Array(N);Um=0;
    for(const g of GP){let wx=0,wy=0,ux=0,uy=0,vx=0,vy=0;
      for(let k=0;k<nw;k++){wx+=X[k]*g.Wx[k];wy+=X[k]*g.Wy[k];}
      for(let k=0;k<nU;k++){ux+=X[oU+k]*g.Ux[k];uy+=X[oU+k]*g.Uy[k];}
      for(let k=0;k<nV;k++){vx+=X[oV+k]*g.Vx[k];vy+=X[oV+k]*g.Vy[k];}
      const ex=ux+wx*wx/2,ey=vy+wy*wy/2,gxy=uy+vx+wx*wy;
      const Nx=c11*ex+c12*ey,Ny=c12*ex+c11*ey,Nxy=c33*gxy,wt=g.wt;Um+=wt*(Nx*ex+Ny*ey+Nxy*gxy)/2;
      for(let k=0;k<nw;k++)Fm[k]+=wt*(Nx*wx*g.Wx[k]+Ny*wy*g.Wy[k]+Nxy*(wy*g.Wx[k]+wx*g.Wy[k]));
      for(let k=0;k<nU;k++)Fm[oU+k]+=wt*(Nx*g.Ux[k]+Nxy*g.Uy[k]);
      for(let k=0;k<nV;k++)Fm[oV+k]+=wt*(Ny*g.Vy[k]+Nxy*g.Vx[k]);
      if(!Kt)continue;
      B1.fill(0);B2.fill(0);B3.fill(0);
      for(let k=0;k<nw;k++){B1[k]=wx*g.Wx[k];B2[k]=wy*g.Wy[k];B3[k]=wy*g.Wx[k]+wx*g.Wy[k];}
      for(let k=0;k<nU;k++){B1[oU+k]=g.Ux[k];B3[oU+k]=g.Uy[k];}
      for(let k=0;k<nV;k++){B2[oV+k]=g.Vy[k];B3[oV+k]=g.Vx[k];}
      for(let k=0;k<n3;k++){T1[k]=c11*B1[k]+c12*B2[k];T2[k]=c12*B1[k]+c11*B2[k];T3[k]=c33*B3[k];}
      for(let r=0;r<n3;r++){const p1=wt*B1[r],p2=wt*B2[r],p3=wt*B3[r],o=r*N;
        if(p1===0&&p2===0&&p3===0)continue;
        for(let c=0;c<n3;c++)Kt[o+c]+=p1*T1[c]+p2*T2[c]+p3*T3[c];}
      for(let r=0;r<nw;r++){const o=r*N,ax=wt*(Nx*g.Wx[r]+Nxy*g.Wy[r]),ay=wt*(Ny*g.Wy[r]+Nxy*g.Wx[r]);
        for(let c=0;c<nw;c++)Kt[o+c]+=ax*g.Wx[c]+ay*g.Wy[c];}}
    return Fm;}
  const matvec=(K,X)=>{const y=new Float64Array(N);for(let r=0;r<N;r++){let s=0;const o=r*N;for(let c=0;c<N;c++)s+=K[o+c]*X[c];y[r]=s;}return y;};
  function solve(K,rhs){const A=Float64Array.from(K),x=Float64Array.from(rhs);
    for(let k=0;k<N;k++){let p=k,mx=Math.abs(A[k*N+k]);for(let r=k+1;r<N;r++){const v=Math.abs(A[r*N+k]);if(v>mx){mx=v;p=r;}}
      if(mx===0)throw new Error('tekil matris');
      if(p!==k){for(let c=0;c<N;c++){const t=A[k*N+c];A[k*N+c]=A[p*N+c];A[p*N+c]=t;}const t=x[k];x[k]=x[p];x[p]=t;}
      const piv=A[k*N+k];for(let r=k+1;r<N;r++){const f=A[r*N+k]/piv;if(f===0)continue;for(let c=k;c<N;c++)A[r*N+c]-=f*A[k*N+c];x[r]-=f*x[k];}}
    for(let k=N-1;k>=0;k--){let s=x[k];for(let c=k+1;c<N;c++)s-=A[k*N+c]*x[c];x[k]=s/A[k*N+k];}
    return x;}
  // toplam potansiyel enerji Π = ½·Xᵀ·K·X + U_membran − q·Fᵀ·X ; kalıntı = ∇Π. Newton + enerji çizgi araması.
  const state=(X,q)=>{const r=matvec(Kl,X),Fm=memb(X,null);let n2=0,Pi=Um;
    for(let i=0;i<N;i++){Pi+=0.5*X[i]*r[i]-q*F[i]*X[i];r[i]+=Fm[i]-q*F[i];n2+=r[i]*r[i];}return {r,n:Math.sqrt(n2),Pi};};
  let Fn=0;for(let i=0;i<N;i++)Fn+=F[i]*F[i];Fn=Math.sqrt(Fn);
  let X=new Float64Array(N),qNow=0,its=0;
  function newton(q){let S0=state(X,q);const r0=Math.max(S0.n,Math.abs(q)*Fn*1e-6);
    for(let it=0;it<40;it++){its++;
      const Kt=Float64Array.from(Kl);memb(X,Kt);
      const dX=solve(Kt,S0.r.map(v=>-v));let slope=0;for(let i=0;i<N;i++)slope+=S0.r[i]*dX[i];
      let al=1,Xn,Sn;
      for(let ls=0;ls<30;ls++){Xn=X.map((v,i)=>v+al*dX[i]);Sn=state(Xn,q);if(slope>=0||Sn.Pi<=S0.Pi+1e-4*al*slope)break;al/=2;}
      let dm=0,wm=1e-3;for(let k=0;k<nw;k++){dm=Math.max(dm,Math.abs(al*dX[k]));wm=Math.max(wm,Math.abs(Xn[k]));}
      X=Xn;S0=Sn;
      if(dm<=1e-9*wm||S0.n<=1e-10*r0)return true;}
    return S0.n<=1e-6*r0;}
  // --- yük adımları: hedeflere ±q yönünde artımlı
  const ev2=(X,xi,eta)=>{const P=leg(xi,KX),Q=leg(eta,KX);let w=0,wx=0,wy=0,wxx=0,wyy=0,wxy=0,ux=0,uy=0,vx=0,vy=0;
    wI.forEach(([i,j],k)=>{const c=X[k];w+=c*P.P[i]*Q.P[j];wx+=c*P.d1[i]*Q.P[j]/a;wy+=c*P.P[i]*Q.d1[j]/b;wxx+=c*P.d2[i]*Q.P[j]/(a*a);wyy+=c*P.P[i]*Q.d2[j]/(b*b);wxy+=c*P.d1[i]*Q.d1[j]/(a*b);});
    uI.forEach(([i,j],k)=>{const c=X[oU+k];ux+=c*P.d1[i]*Q.P[j]/a;uy+=c*P.P[i]*Q.d1[j]/b;});
    vI.forEach(([i,j],k)=>{const c=X[oV+k];vx+=c*P.d1[i]*Q.P[j]/a;vy+=c*P.P[i]*Q.d1[j]/b;});
    return {w,wx,wy,wxx,wyy,wxy,ex:ux+wx*wx/2,ey:vy+wy*wy/2,gxy:uy+vx+wx*wy};};
  const prin=(sx,sy,t)=>{const m=(sx+sy)/2,r=Math.sqrt(((sx-sy)/2)**2+t*t);return [m+r,m-r];};
  const S=M.stress||{h1:1,h2:1,hm:1,dc:0,gc:1,E:70000};
  function post(X,full){
    const nx=full?25:9,ny=full?13:5,grid=[];let wmax=-Infinity,wmin=Infinity,sg={v:-Infinity},ce={v:-Infinity};
    for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const xi=ix/(nx-1),eta=iy/(ny-1),r=ev2(X,xi,eta);
      const Nx=c11*r.ex+c12*r.ey,Ny=c12*r.ex+c11*r.ey,Nxy=c33*r.gxy;
      const Mx=D*(r.wxx+nu*r.wyy),My=D*(r.wyy+nu*r.wxx),Mxy=D*(1-nu)*r.wxy;
      const sm=[Nx/S.hm,Ny/S.hm,Nxy/S.hm],k1=6/(S.h1*S.h1),k2=6/(S.h2*S.h2);
      // ön cam dış yüzü (yük tarafı, ζ = −h/2) ve arka cam dış yüzü (ζ = +h/2); ε = εm − ζ·κ
      const fr1=prin(sm[0]+k1*Mx,sm[1]+k1*My,sm[2]+k1*Mxy)[0],re1=prin(sm[0]-k2*Mx,sm[1]-k2*My,sm[2]-k2*Mxy)[0];
      // hücre katmanı: ε = εm − Γ·d·κ (d: hücrenin tarafsız eksene uzaklığı); asal uzama, ε tensörü [εx, εy, γ/2]
      const epc2=prin(r.ex-S.gc*S.dc*r.wxx,r.ey-S.gc*S.dc*r.wyy,(r.gxy-2*S.gc*S.dc*r.wxy)/2)[0];
      grid.push({xi,eta,w:r.w,sf:fr1,sr:re1,ec:epc2});
      if(r.w>wmax)wmax=r.w;if(r.w<wmin)wmin=r.w;
      if(fr1>sg.v)sg={v:fr1,xi,eta,s:'ön'};if(re1>sg.v)sg={v:re1,xi,eta,s:'arka'};
      if(epc2>ce.v)ce={v:epc2,xi,eta};}
    const out={wc:ev2(X,0,0).w,wmax,wmin,glass:sg,cell:ce,grid:full?grid:null,nx,ny};
    if(fr){const prof=(long)=>{const pts=[];let smax={v:0};for(let k=0;k<=40;k++){const s=k/40;
        const r=long?ev2(X,s,1):ev2(X,1,s);const T=leg(s,KX);let du=0;
        od.forEach((kk,m)=>{du+=X[(long?oF:oG)+m]*T.d1[kk]/(long?a:b);});
        const kap=long?r.wxx:r.wyy,Mf=fr.EI*kap,Nf=fr.EA*du;
        const st=fr.E*(du+fr.ct*kap),sb=fr.E*(du-fr.cb*kap);const v=Math.max(Math.abs(st),Math.abs(sb));
        if(v>smax.v)smax={v,s};pts.push({s,w:r.w,M:Mf,N:Nf,st,sb});}
        return {pts,smax};};
      out.long=prof(true);out.short=prof(false);
      out.frameMid=out.long.pts[0].w;out.frameSig=Math.max(out.long.smax.v,out.short.smax.v);
      out.frameSigAt=out.long.smax.v>=out.short.smax.v?{edge:'uzun',s:out.long.smax.s}:{edge:'kısa',s:out.short.smax.s};}
    out.reac=supB.map(v=>{let w=0;for(let k=0;k<nw;k++)w+=v[k]*X[k];return M.ksup*w;});
    out.sumR=out.reac.reduce((s,x)=>s+x,0);
    return out;}
  const res={levels:[],N,ok:true};
  for(const dir of [1,-1]){X=new Float64Array(N);qNow=0;
    const targets=(M.levels||[1]).map(f=>f*(dir>0?M.qPos:M.qNeg)).filter(v=>v>0).sort((x,y)=>x-y);
    for(const qt of targets){let step=Math.max(qt/4,qt-qNow>0?(qt-qNow)/3:qt);
      while(qNow<qt-1e-15){const qn=Math.min(qt,qNow+step),X0=X;
        if(newton(dir*qn)){qNow=qn;step*=1.5;}else{X=X0;step/=2;if(step<qt*1e-4){res.ok=false;break;}}}
      const pr=post(X,qt===targets[targets.length-1]);pr.q=dir*qt;pr.load=qt/(dir>0?M.qPos:M.qNeg);res.levels.push(pr);}}
  // doğrusal (küçük sehim) teori: aynı yükte yalnız eğilme ile — karşılaştırma için
  const K0=Float64Array.from(Kl);memb(new Float64Array(N),K0);const Xl=solve(K0,F.map(v=>v*M.qPos));res.linearWc=ev2(Xl,0,0).w;
  res.its=its;res.Fload=4*a*b;return res;
}

/* ---------- tasarımdan model ---------- */
const AL_PROPS=[[/6005|6082/i,{E:69000,fy:225,rho:2.7e-3,l:'6005-T6 (EN 755-2)'}],[/6061/i,{E:69000,fy:240,rho:2.7e-3,l:'6061-T6'}],[/6063-T6/i,{E:69000,fy:170,rho:2.7e-3,l:'6063-T6'}],[/6063/i,{E:69000,fy:130,rho:2.7e-3,l:'6063-T5 (et ≤ 3 mm)'}],
  [/çelik|steel|S350/i,{E:210000,fy:350,rho:7.85e-3,l:'S350GD çelik'}],[/PU|elyaf|kompozit/i,{E:35000,fy:300,rho:1.9e-3,l:'PU / cam elyafı (tahmini)'}]];
/* Çerçeve kesiti: dış gövde, üst dudak, cam kanalı tabanı, kutu iç duvarı, alt flanş (ince cidarlı yaklaşık profil).
   Girilen kg/m kütlesi varsa et kalınlığı kesit alanı kütleyi verecek şekilde ölçeklenir (gerçek profillerdeki ek nervürleri temsil eder). */
function frameRects(t,H,lip,hc,wb,fFl){const r=[[0,t,0,H],[t,lip,H-t,H],[t,lip,H-2*t-hc,H-t-hc],[t,fFl,0,t]];if(H-2*t-hc>t+0.5)r.push([wb-t,wb,t,H-2*t-hc]);return r;}
function frameSection(p,lam,fc,rho){
  const H=p.fH,lip=Math.max(fc+p.fOv,3),hc=lam+1.5,wb=Math.min(Math.max(p.fFl,4),Math.max(8,lip));
  const area=rs=>rs.reduce((s,[x0,x1,z0,z1])=>s+(x1-x0)*(z1-z0),0);
  let t=p.fWt;const At=p.fkg>0&&rho?p.fkg/rho:0;
  if(At>0){let lo=0.3,hi=6;for(let k=0;k<50;k++){const md=(lo+hi)/2;if(area(frameRects(md,H,lip,hc,wb,p.fFl))<At)lo=md;else hi=md;}t=(lo+hi)/2;}
  const rects=frameRects(t,H,Math.max(lip,t+1),hc,wb,p.fFl);
  let A=0,Sz=0,Sx=0;for(const [x0,x1,z0,z1] of rects){const ar=(x1-x0)*(z1-z0);A+=ar;Sz+=ar*(z0+z1)/2;Sx+=ar*(x0+x1)/2;}
  const zc=Sz/A;let I=0;for(const [x0,x1,z0,z1] of rects){const bw=x1-x0,h=z1-z0;I+=bw*h**3/12+bw*h*((z0+z1)/2-zc)**2;}
  const zg=H-t-hc/2,Iu=p.fIx>0?p.fIx*1e4:I;
  return {A,I:Iu,Icalc:I,zc,ct:H-zc,cb:zc,e:zg-zc,rects,H,t,mass:A*(rho||2.7e-3)};
}
function mechModel(p,Rr){
  const rear=LIB.rear.items[p.rearV]||{kind:'glass'},gg=rear.kind==='glass';
  const tc=((LIB.tech.items[p.techV]||{}).th||150)/1000,E=70000,nu=0.22;
  const h1=p.tgf,h2=gg?p.tgr:0,hv=p.tef+tc+p.ter;
  const Wg=Rr.Wg,Lg=Rr.Lg;let hef,hs1,hs2,Gam=0,hm,dc,gcf;
  if(gg){const hs=0.5*(h1+h2)+hv,hsa=hs*h1/(h1+h2),hsb=hs*h2/(h1+h2),Is=h1*hsb*hsb+h2*hsa*hsa;
    Gam=p.Gint>0?1/(1+9.6*E*Is*hv/(p.Gint*hs*hs*Wg*Wg)):0;
    hef=Math.cbrt(h1**3+h2**3+12*Gam*Is);hs1=Math.sqrt(hef**3/(h1+2*Gam*hsb));hs2=Math.sqrt(hef**3/(h2+2*Gam*hsa));hm=h1+h2;
    const zNA=(h1*h1/2+h2*(h1+hv+h2/2))/(h1+h2);dc=h1+p.tef+tc/2-zNA;gcf=Gam;}
  else{hef=h1;hs1=hs2=h1;hm=h1;dc=h1/2+p.tef+tc/2;gcf=1;}
  const D=E*hef**3/(12*(1-nu*nu)),Amb=E*hm/(1-nu*nu);
  const lam=h1+hv+(gg?h2:0.4);
  const framed=p.frameV!=='none'&&p.fH>0,fl=LIB.frame.items[p.frameV]||{};
  let frame=null,sec=null,mat=null;
  if(framed){mat=(AL_PROPS.find(([re])=>re.test(fl.alloy||fl.l||''))||[0,{E:69000,fy:130,rho:2.7e-3,l:'6063-T5'}])[1];sec=frameSection(p,lam,Rr.fc,mat.rho);
    frame={EI:mat.E*sec.I,EA:mat.E*sec.A,e:sec.e,ks:Math.max(0,p.kSil),E:mat.E,ct:sec.ct,cb:sec.cb};}
  const fy=p.fRp>0?p.fRp:(mat?mat.fy:0);
  const temper=t=>t>=2.8?{fk:120,l:'tam temperli (EN 12150)'}:{fk:70,l:'yarı temperli (EN 1863)'};
  const gF=temper(h1),gR=gg?temper(h2):null,fk=p.fgk>0?p.fgk:Math.min(gF.fk,gR?gR.fk:Infinity);
  // mesnetler (cam kenarı koordinatı, merkez orijin)
  const a=Lg/2,b=Wg/2,mv=p.mountV,S=p.clS>0?p.clS:(mv==='trk1p'?(p.mh2>0?p.mh2:400):p.mh1),sup=[];
  if(mv==='clampS4'){const Sw=p.clS>0?Math.min(p.clS,Wg-20):Wg/2;for(const sx of [-1,1])for(const sy of [-1,1])sup.push([sx*a,sy*Sw/2]);}
  else{const xs=[-S/2,S/2];if(mv==='clampL6')xs.push(0);for(const x of xs)for(const sy of [-1,1])sup.push([Math.max(-a,Math.min(a,x)),sy*b]);}
  const levels=[0.2,0.4,0.6,1/p.gmL,0.8,1].filter((v,i,ar)=>v>0&&v<=1&&ar.findIndex(z=>Math.abs(z-v)<1e-6)===i).sort((x,y)=>x-y);
  return {M:{a,b,D,Am:Amb,nu,deg:2*Math.round((p.mDeg||8)/2),frame,kRot:framed?Math.max(0,p.kRot||0):0,sup,ksup:1e5,qPos:p.ldPos*p.gmL*1e-6,qNeg:p.ldNeg*p.gmL*1e-6,levels,
      stress:{h1:hs1,h2:gg?hs2:hs1,hm,dc,gc:gcf,E}},
    info:{gg,h1,h2,hv,Gam,hef,hs1,hs2,D,sec,mat,fy,fk,gF,gR,framed,S,tc,lam,Lg,Wg}};
}

/* ---------- arayüz ---------- */
let MECH=null,mechKey='',mechBusy=false,mechWorker=null,mechView='pos';
function mechRun(M){
  return new Promise((res,rej)=>{
    try{if(!mechWorker&&window.Worker&&window.Blob){const src='"use strict";'+mechSolve.toString()+'\nonmessage=e=>{try{postMessage({ok:true,r:mechSolve(e.data)});}catch(x){postMessage({ok:false,m:String(x&&x.message||x)});}};';
        mechWorker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));}}catch(e){mechWorker=null;}
    if(mechWorker){mechWorker.onmessage=e=>e.data.ok?res(e.data.r):rej(new Error(e.data.m));mechWorker.onerror=e=>{mechWorker=null;try{res(mechSolve(M));}catch(x){rej(x);}};mechWorker.postMessage(M);}
    else setTimeout(()=>{try{res(mechSolve(M));}catch(x){rej(x);}},20);});
}
const seqRamp=()=>{const dk=matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.dataset.theme!=='light'||document.documentElement.dataset.theme==='dark';
  return dk?['#163a66','#1c5cab','#2a78d6','#5598e7','#9ec5f4','#cde2fb']:['#cde2fb','#9ec5f4','#5598e7','#2a78d6','#1c5cab','#0d366b'];};
function rampColor(t){const r=seqRamp(),x=Math.max(0,Math.min(1,t))*(r.length-1),i=Math.min(r.length-2,Math.floor(x)),f=x-i;
  const h=s=>[1,3,5].map(k=>parseInt(s.slice(k,k+2),16)),A=h(r[i]),B=h(r[i+1]);return '#'+A.map((v,k)=>Math.round(v+(B[k]-v)*f).toString(16).padStart(2,'0')).join('');}
function mechHeat(lv,info,M){
  // tam modül: x yatay (uzun kenar), y düşey; çeyrek ızgara aynalanır
  const W=560,H=Math.round(W*info.Wg/info.Lg)+0,ml=8,mt=8,pw=W-2*ml,ph=H,nx=lv.nx,ny=lv.ny,G=lv.grid;
  const at=(ix,iy)=>G[iy*nx+ix];let lo=Infinity,hi=-Infinity;for(const g of G){lo=Math.min(lo,g.w);hi=Math.max(hi,g.w);}
  const cx=2*nx-1,cy=2*ny-1,cw=pw/cx,chh=ph/cy;let s=`<svg viewBox="0 0 ${W} ${H+2*mt+34}" role="img" aria-label="Sehim haritası">`;
  for(let j=0;j<cy;j++)for(let i=0;i<cx;i++){const g=at(Math.abs(i-(nx-1)),Math.abs(j-(ny-1)));const v=(g.w-lo)/(hi-lo||1);
    s+=`<rect x="${(ml+i*cw).toFixed(2)}" y="${(mt+j*chh).toFixed(2)}" width="${(cw+0.4).toFixed(2)}" height="${(chh+0.4).toFixed(2)}" fill="${rampColor(v)}"><title>${f(Math.abs(g.w),1)} mm</title></rect>`;}
  s+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" class="hmo"/>`;
  for(const [x,y] of M.sup){const px=ml+(x/info.Lg+0.5)*pw,py=mt+(y/info.Wg+0.5)*ph;s+=`<path class="hms" d="M${px} ${py-7}L${px+6} ${py+4}L${px-6} ${py+4}Z"><title>Mesnet (${f(x,0)}; ${f(y,0)} mm)</title></path>`;}
  const ly=mt+ph+12,lw=200;for(let k=0;k<40;k++)s+=`<rect x="${ml+k*lw/40}" y="${ly}" width="${lw/40+0.3}" height="8" fill="${rampColor(k/39)}"/>`;
  s+=`<text x="${ml}" y="${ly+21}">${f(Math.abs(lo),1)} mm</text><text x="${ml+lw}" y="${ly+21}" text-anchor="end">${f(Math.abs(hi),1)} mm</text><text x="${ml+lw+12}" y="${ly+8}">▲ mesnet (delik / kelepçe)</text>`;
  return s+'</svg>';
}
function renderMekanik(){
  const box=$('#mechOut');if(!box||$('[data-panel="mekanik"]').hidden)return;
  const p=S.p,{M,info}=mechModel(p,R),key=JSON.stringify(M);
  if(key===mechKey&&MECH){drawMech(M,info);return;}
  if(mechBusy){mechKey='';return;}
  mechBusy=true;$('#mechState').textContent='Hesaplanıyor…';const t0=performance.now();
  mechRun(M).then(r=>{MECH=r;MECH.ms=performance.now()-t0;mechKey=key;mechBusy=false;drawMech(M,info);if(JSON.stringify(mechModel(S.p,R).M)!==key)renderMekanik();})
    .catch(e=>{mechBusy=false;$('#mechState').textContent='Hesap yapılamadı: '+e.message;});
}
function drawMech(M,info){
  const r=MECH,p=S.p,box=$('#mechOut');
  const pos=r.levels.filter(l=>l.q>0),neg=r.levels.filter(l=>l.q<0),P=pos[pos.length-1],Ng=neg[neg.length-1];
  const dsg=arr=>arr.reduce((b,l)=>Math.abs(l.load-1/p.gmL)<Math.abs(b.load-1/p.gmL)?l:b,arr[0]);
  const Pd=dsg(pos),Nd=dsg(neg);
  const pill=(u,txt)=>`<span class="pill ${u<0.8?'good':u<=1?'warn':'bad'}">${txt}</span>`;
  const loc=g=>!g?'':g.xi<0.15&&g.eta<0.15?'orta':g.eta>0.85&&g.xi>0.85?'köşe':g.eta>0.85?'uzun kenar':g.xi>0.85?'kısa kenar':'ara bölge';
  const col=(l,ld)=>{const gu=l.glass.v/info.fk,fu=info.framed&&info.fy?l.frameSig/info.fy:null;return {
    w:f(Math.abs(l.wmax>Math.abs(l.wmin)?l.wmax:l.wmin),1)+' mm',fm:info.framed?f(Math.abs(l.frameMid),1)+' mm':'–',rel:info.framed?f(Math.abs(l.wc-l.frameMid),1)+' mm':'–',
    g:`${f(l.glass.v,1)} MPa`,gl:`${info.gg?l.glass.s+' cam dış yüzü':l.glass.s==='ön'?'cam ön yüzü':'cam iç yüzü'}, ${loc(l.glass)}`,gu:pill(gu,'%'+f(gu*100,0)),
    fs:info.framed?`${f(l.long.smax.v,0)} / ${f(l.short.smax.v,0)} MPa`:'–',fu:fu!==null?pill(fu,'%'+f(fu*100,0)):'–',
    ec:'%'+f(l.cell.v*100,3),re:f(Math.max(...l.reac.map(Math.abs)),0)+' N',
    dw:f(Math.abs(ld.wc),1)+' mm · '+f(ld.glass.v,1)+' MPa'};};
  const A=col(P,Pd),B=col(Ng,Nd);
  const okG=Math.max(P.glass.v,Ng.glass.v)/info.fk,okF=info.framed&&info.fy?Math.max(P.frameSig,Ng.frameSig)/info.fy:0,worst=Math.max(okG,okF);
  const cal=(p.kRot||0)>0;
  $('#mechState').innerHTML=`${worst<=1?'<span class="pill good">Test yükünde dayanım sınırı içinde</span>':'<span class="pill bad">Test yükünde dayanım aşılıyor</span>'} <small>${cal?'ölçümle kalibre':'kalibre edilmemiş · güvenli taraf'} · ${f(r.ms,0)} ms</small>`;
  const rows=[['Maks. sehim (modül)','w'],['Uzun çerçeve orta sehimi','fm'],['Camın çerçeveye göre sehimi (orta)','rel'],['Cam maks. asal gerilme','g'],['Cam gerilmesinin yeri','gl',1],['Cam kullanım oranı σ / f<sub>k</sub>','gu'],
    ['Çerçeve maks. gerilme (uzun / kısa kenar)','fs'],['Çerçeve kullanım oranı σ / R<sub>p0,2</sub>','fu'],['Hücre katmanı maks. uzama','ec'],['Maks. mesnet tepkisi (tek nokta)','re'],[`Tasarım yükünde (test ÷ ${f(p.gmL,2)}) sehim · cam gerilmesi`,'dw']];
  const sumF=(l)=>Math.abs(l.sumR)/(Math.abs(l.q)*info.Lg*info.Wg);
  let h=`<div class="card"><div class="cardhead"><h3>Simülasyon sonuçları</h3><small>IEC 61215 MQT 16 · test yükü = tasarım × γm</small></div>
   <div class="tw"><table><tr><th>Büyüklük</th><th class="n">Ön yük +${f(p.ldPos*p.gmL,0)} Pa</th><th class="n">Arka yük −${f(p.ldNeg*p.gmL,0)} Pa</th></tr>
   ${rows.map(([l,k,tx])=>`<tr><td>${l}</td><td class="${tx?'tx':'n'}">${A[k]}</td><td class="${tx?'tx':'n'}">${B[k]}</td></tr>`).join('')}</table></div>
   ${cal?'':`<p class="msg">Kenar dönme rijitliği girilmedi: cam kenarı çerçevede serbest dönüyor kabul edildi (güvenli taraf). Gerçek modülde çerçeve kanalı camı kısmen tutar; sehim ve gerilmeler daha düşük olur. Test ölçümünüz varsa aşağıdaki “Ölçümle kalibrasyon” ile uydurun.</p>`}
   ${info.framed&&!(p.fIx>0)?`<p class="msg">Çerçeve atalet momenti profil ölçüleri ve ${f(p.fkg,2)} kg/m kütleden tahmin edildi (I<sub>x</sub> ≈ ${f(info.sec.I/1e4,2)} cm⁴). Çerçeve gerilmesi bu değere doğrudan bağlıdır; tedarikçi çizimindeki değeri “Mekanik model ve malzeme” bölümüne girin.</p>`:''}
   <p class="note">Cam dayanımı f<sub>k</sub> = ${f(info.fk,0)} MPa (${esc(info.gF.l)}${info.gR&&info.gR.l!==info.gF.l?' / arka '+esc(info.gR.l):''}); ${info.framed?`çerçeve R<sub>p0,2</sub> = ${f(info.fy,0)} MPa (${esc(info.mat.l)}).`:'çerçevesiz.'} Hücre uzaması tasarımları karşılaştırmak içindir; çatlak eşiği wafer ve hücre kalitesine bağlıdır.</p></div>`;
  // ısı haritası ve eğriler
  const L=mechView==='neg'?Ng:P;
  h+=`<div class="card"><div class="cardhead"><h3>Sehim haritası</h3><div class="seg"><button class="btn sm" data-mview="pos" aria-pressed="${mechView!=='neg'}">Ön yük</button><button class="btn sm" data-mview="neg" aria-pressed="${mechView==='neg'}">Arka yük</button></div></div>
    <div class="chart heat">${mechHeat(L,info,M)}</div><p class="note">Test yükünde düşey yer değiştirme (modül önden görünüş, uzun kenar yatay). Hücreye dokunun / üzerine gelin: değer.</p></div>`;
  const curve=(arr,lab,c)=>({x:[0,...arr.map(l=>Math.abs(l.q)*1e6)],y:[0,...arr.map(l=>Math.abs(l.wc))],label:lab,c,mark:[Math.abs(arr[arr.length-1].q)*1e6,Math.abs(arr[arr.length-1].wc)],lm:1});
  const lin=r.linearWc,qp=p.ldPos*p.gmL;
  h+=`<div class="grid2"><div class="card"><h3>Yük – sehim (modül ortası)</h3><div class="chart">${lineChart({series:[curve(pos,'ön',0),curve(neg,'arka',1)],xl:'Basınç (Pa)',yl:'Sehim (mm)',title:'Yük sehim'})}</div>
     <p class="note">Doğrusal (küçük sehim) teori ön test yükünde ${f(Math.abs(lin),0)} mm verirdi; membran etkisiyle ${f(Math.abs(P.wc),1)} mm. Eğri, camın gerildikçe sertleştiğini gösterir.</p></div>`;
  if(info.framed){const pr=(P.long.pts),x=pr.map(q=>q.s*info.Lg/2);
    h+=`<div class="card"><h3>Uzun çerçeve boyunca</h3><div class="chart">${lineChart({series:[{x,y:pr.map(q=>Math.abs(q.w)),label:'sehim (ön yük)',c:0}],xl:'Merkezden uzaklık (mm)',yl:'Sehim (mm)',title:'Çerçeve sehimi'})}</div>
      <p class="note">Mesnet konumu: merkezden ${f(info.S/2,0)} mm (${esc(SCH.mountV.opts.find(o=>o[0]===p.mountV)[1])}). Çerçeve en çok ${P.frameSigAt.edge} kenarda, merkezden ${f(P.frameSigAt.s*(P.frameSigAt.edge==='uzun'?info.Lg:info.Wg)/2,0)} mm’de zorlanır.</p></div>`;}
  h+='</div>';
  // model ve doğrulama
  const sec=info.sec;
  h+=`<div class="card"><h3>Model ve doğrulama</h3><div class="tw"><table>
    <tr><td>Laminat</td><td>${info.gg?`cam-cam ${f(info.h1,1)} + ${f(info.h2,1)} mm, ara katman ${f(info.hv,2)} mm, G = ${f(p.Gint,1)} MPa → ortak çalışma Γ = ${f(info.Gam,3)}`:`cam ${f(info.h1,1)} mm + backsheet (rijitliği ihmal)`}</td></tr>
    <tr><td>Etkin kalınlık</td><td>sehim h<sub>ef,w</sub> = ${f(info.hef,2)} mm · gerilme h<sub>σ</sub> = ${f(info.hs1,2)}${info.gg?' / '+f(info.hs2,2):''} mm (ASTM E1300 X9 / Wölfel–Bennison)</td></tr>
    ${info.framed?`<tr><td>Çerçeve kesiti</td><td>A = ${f(sec.A,0)} mm² (${f(sec.mass,2)} kg/m; girilen ${f(p.fkg,2)} kg/m) · I<sub>x</sub> = ${f(sec.I/1e4,2)} cm⁴${p.fIx>0?' (girilen)':' (profil ölçülerinden)'} · cam düzlemi ağırlık merkezinin ${f(sec.e,1)} mm üstünde · silikon k = ${f(p.kSil,1)} N/mm²</td></tr>`:''}
    <tr><td>Denge kontrolü</td><td>Σ mesnet tepkisi / toplam yük = ${f(sumF(P)*100,2)} % (ön), ${f(sumF(Ng)*100,2)} % (arka)</td></tr>
    <tr><td>Çözüm</td><td>Legendre polinomu derece ${M.deg}, ${r.N} serbestlik, Newton ${r.its} iterasyon${r.ok?'':' · <b>uyarı: bazı yük adımları yakınsamadı</b>'}</td></tr></table></div>
    <p class="note">Varsayımlar: cam kenarı çerçevede dönmeye serbest (çerçeve burulması ihmal), düzlem içinde kenara dik yönde serbest; çerçeve–cam bağı yalnız kenar boyunca kayma yayı; mesnetler rijit nokta; modül öz ağırlığı ve kelepçe yerel gerilmeleri hesaba katılmaz. Ritz çözücüsü bağımsız sonlu fark çözümü, Navier serisi ve kompozit kiriş formülleriyle doğrulanmıştır (tests/dogrulama.js).</p></div>`;
  h+=`<div class="card"><div class="cardhead"><h3>Ölçümle kalibrasyon</h3><small>kenar dönme rijitliği k<sub>θ</sub> = ${f(p.kRot||0,0)} N·mm/mm/rad</small></div>
    <p class="note">Kendi mekanik yük testinizde (veya sertifika raporunda) ölçülen modül orta sehimini girin. Çerçeve kanalının camı dönmeye karşı tutma rijitliği bu ölçüme uydurulur; diğer tüm sonuçlar buna göre güncellenir.</p>
    <div class="calq" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto"><div class="val"><input type="text" inputmode="decimal" id="mcW" placeholder="ölçülen sehim"><span class="u">mm</span></div>
      <div class="val"><input type="text" inputmode="decimal" id="mcQ" value="${fmtIn(p.ldPos*p.gmL)}"><span class="u">Pa (ön)</span></div><button class="btn sm pri" id="mcRun">Kalibre et</button></div>
    <p class="msg" id="mcMsg"></p></div>`;
  box.innerHTML=h;
}
async function mechCalib(){
  const msg=$('#mcMsg'),w=parseNum($('#mcW').value),qPa=parseNum($('#mcQ').value);
  if(!(w>0)||!(qPa>0)){msg.className='msg er';msg.textContent='Ölçülen sehimi (mm) ve yükü (Pa) girin.';return;}
  const base=mechModel(S.p,R).M,M0=Object.assign({},base,{qPos:qPa*1e-6,qNeg:0,levels:[1],deg:8});
  const wc=async k=>Math.abs((await mechRun(Object.assign({},M0,{kRot:k}))).levels[0].wc);
  msg.className='msg';msg.textContent='Kalibre ediliyor…';
  try{const w0=await wc(0);
    if(w>=w0){msg.className='msg er';msg.textContent=`Ölçülen ${f(w,1)} mm, kenar serbest dönerken bile modelden (${f(w0,1)} mm) büyük: model daha rijit. Çerçeve Ix, enkapsülan G veya bağ rijitliğini düşürmeyi deneyin.`;return;}
    const w1=await wc(1e6);
    if(w<=w1){msg.className='msg er';msg.textContent=`Ölçülen ${f(w,1)} mm, kenar tam ankastre olsa bile modelden (${f(w1,1)} mm) küçük. Çerçeve Ix değerini tedarikçi çiziminden girin veya mesnet konumunu kontrol edin.`;return;}
    let lo=-1,hi=6;for(let i=0;i<16;i++){const md=(lo+hi)/2;msg.textContent=`Kalibre ediliyor… ${i+1}/16`;if(await wc(10**md)>w)lo=md;else hi=md;}
    const k=10**((lo+hi)/2);S.p.kRot=+k.toPrecision(3);syncInputs();recompute();
    msg.className='msg ok';msg.textContent=`k_θ = ${f(S.p.kRot,0)} N·mm/mm/rad uygulandı (serbest kenar ${f(w0,1)} mm → ölçüm ${f(w,1)} mm).`;}
  catch(e){msg.className='msg er';msg.textContent='Kalibrasyon yapılamadı: '+e.message;}
}
$('#mechOut')&&$('#mechOut').addEventListener('click',e=>{if(e.target.id==='mcRun'){mechCalib();return;}const b=e.target.closest('[data-mview]');if(!b)return;mechView=b.dataset.mview;if(MECH)drawMech(...(()=>{const m=mechModel(S.p,R);return [m.M,m.info];})());});
let mechTmr=null;
document.addEventListener('tabshown',e=>{if(e.detail==='mekanik')renderMekanik();});
{const _rcK=recompute;recompute=function(){_rcK();if(!$('[data-panel="mekanik"]').hidden){clearTimeout(mechTmr);mechTmr=setTimeout(renderMekanik,350);}};}
if($('[data-panel="mekanik"]')&&!$('[data-panel="mekanik"]').hidden)renderMekanik();
