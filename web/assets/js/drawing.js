"use strict";
/* =====================================================================
   Teknik resim: A3 yatay paftalar (420 × 297 mm kâğıt koordinatı).
   Pafta 1: ön / arka görünüş, kesit A-A, parça listesi, notlar, antet.
   Pafta 2: detaylar, hücre detayı, elektrik şeması, elektriksel değerler, antet.
   Model koordinatı (mm): u = modül boyu yönü, v = modül eni yönü (yatay yerleşim).
   ===================================================================== */
const SHEET={w:420,h:297};
const SCALES=[1,2,5,10,15,20,25,30,40,50];
const ENL=[20,10,5,4,2,1];
let SHEET_N=1,SHEET_Z=1;

function fitScale(Lmm,Wmm,bw,bh){for(const k of SCALES)if(Lmm/k<=bw&&Wmm/k<=bh)return k;return 50;}
function fitEnl(Lmm,Wmm,bw,bh){for(const m of ENL)if(Lmm*m<=bw&&Wmm*m<=bh)return m;return 1;}
const sc=k=>k>=1?`1:${k}`:`${Math.round(1/k)}:1`;
const t=(x,y,s,txt,o={})=>`<text x="${x}" y="${y}" font-size="${s}"${o.a?` text-anchor="${o.a}"`:''}${o.w?` font-weight="${o.w}"`:''}${o.c?` class="${o.c}"`:''}${o.r?` transform="rotate(${o.r} ${x} ${y})"`:''}>${esc(txt)}</text>`;
const ln=(x1,y1,x2,y2,c='l')=>`<line class="${c}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const rc=(x,y,w,h,c='l')=>`<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;

/* Ölçü çizgileri (kâğıt koordinatı) */
function arr(x,y,dx,dy,L=2.2){const px=-dy,py=dx,w=L*0.28;return `<polygon class="ah" points="${x},${y} ${x-dx*L+px*w},${y-dy*L+py*w} ${x-dx*L-px*w},${y-dy*L-py*w}"/>`;}
function dH(x1,x2,yF,yL,label,o={}){
  const s=yL<yF?-1:1,ts=o.ts||2.5,L=2.2,inside=(x2-x1)>2.6*L+label.length*ts*0.5;
  let g=`<g class="dim${o.bad?' bad':''}">`+ln(x1,yF+s*0.8,x1,yL+s*1.2,'dl')+ln(x2,yF+s*0.8,x2,yL+s*1.2,'dl');
  if((x2-x1)>2.6*L)g+=ln(x1,yL,x2,yL,'dl')+arr(x1,yL,-1,0)+arr(x2,yL,1,0);
  else g+=ln(x1-5,yL,x2+5,yL,'dl')+arr(x1,yL,1,0)+arr(x2,yL,-1,0);
  const tx=inside?(x1+x2)/2:x2+5+label.length*ts*0.27;
  return g+t(tx,yL-0.9,ts,label,{a:'middle',c:'dt'})+'</g>';
}
function dV(y1,y2,xF,xL,label,o={}){
  const s=xL<xF?-1:1,ts=o.ts||2.5,L=2.2,inside=(y2-y1)>2.6*L+label.length*ts*0.5;
  let g=`<g class="dim${o.bad?' bad':''}">`+ln(xF+s*0.8,y1,xL+s*1.2,y1,'dl')+ln(xF+s*0.8,y2,xL+s*1.2,y2,'dl');
  if((y2-y1)>2.6*L)g+=ln(xL,y1,xL,y2,'dl')+arr(xL,y1,0,-1)+arr(xL,y2,0,1);
  else g+=ln(xL,y1-5,xL,y2+5,'dl')+arr(xL,y1,0,1)+arr(xL,y2,0,-1);
  const ty=inside?(y1+y2)/2:y2+5+label.length*ts*0.27;
  return g+t(xL-0.9,ty,ts,label,{a:'middle',c:'dt',r:-90})+'</g>';
}
function leader(x,y,x2,y2,txt,o={}){const ts=o.ts||2.2,right=x2>=x;return `<g class="ldr">${ln(x,y,x2,y2,'dl')}<circle class="dot" cx="${x}" cy="${y}" r="0.5"/>${ln(x2,y2,x2+(right?1:-1)*Math.max(8,txt.length*ts*0.52),y2,'dl')}${t(x2+(right?1:-1),y2-0.8,ts,txt,{a:right?'start':'end',c:'dt'})}</g>`;}
function balloon(x,y,x2,y2,n){return `<g class="bal">${ln(x,y,x2,y2,'dl')}<circle class="dot" cx="${x}" cy="${y}" r="0.45"/><circle class="bc" cx="${x2}" cy="${y2}" r="3"/>${t(x2,y2+1,2.6,String(n),{a:'middle',w:600})}</g>`;}
function title(x,y,txt,scale){return t(x,y,3.5,txt,{w:700})+(scale?t(x,y+4.2,2.5,'Ölçek '+scale,{c:'mut'}):'');}

/* Model geometrisi (yatay yerleşim) */
function G(){
  const p=S.p,fc=R.fc,U0=fc+p.eL,V0=fc+p.eW;
  const rowU=i=>i<R.up?U0+i*(R.h+p.gc):U0+R.up*R.h+(R.up-1)*p.gc+R.gmUse+(i-R.up)*(R.h+p.gc);
  const colV=j=>V0+j*(p.a+p.gs);
  return {p,fc,U0,V0,rowU,colV,L:R.L,W:R.W,Lg:R.Lg,Wg:R.Wg};
}
/* Modül sahnesi: model mm, kalınlık k ile ölçekli; detay=true ise tel ve pah gerçek ölçüde */
function scene(k,opt={}){
  const g=G(),p=g.p,sw=v=>(v*k).toFixed(3);let s='';
  s+=`<rect class="gls" x="${g.fc}" y="${g.fc}" width="${g.Lg}" height="${g.Wg}" style="stroke-width:${sw(0.25)}"/>`;
  if(g.fc>0){const o=g.fc+p.fOv;
    s+=`<path class="frmband" d="M0 0H${g.L}V${g.W}H0Z M${o} ${o}V${g.W-o}H${g.L-o}V${o}Z" fill-rule="evenodd"/>`;
    s+=`<rect class="frmlip" x="${g.fc}" y="${g.fc}" width="${g.Lg}" height="${g.Wg}" style="stroke-width:${sw(0.18)};stroke-dasharray:${sw(3)} ${sw(1.5)}"/>`;
    s+=`<rect class="frmi" x="${o}" y="${o}" width="${g.L-2*o}" height="${g.W-2*o}" style="stroke-width:${sw(0.25)}"/>`;
    s+=`<rect class="frmo" x="0" y="0" width="${g.L}" height="${g.W}" style="stroke-width:${sw(0.35)}"/>`;}
  const h=R.h,c=p.ch>0?Math.min(p.ch,p.a/2,h/2):0;
  for(let j=0;j<R.nc;j++)for(let i=0;i<R.nr;i++){const u=g.rowU(i),v=g.colV(j),u2=u+h,v2=v+p.a;
    if(!c){s+=`<rect class="cel" x="${u}" y="${v}" width="${h}" height="${p.a}" style="stroke-width:${sw(0.12)}"/>`;continue;}
    const lt=!R.half||i%2===0?c:0,rt=!R.half||i%2===1?c:0;
    s+=`<polygon class="cel" style="stroke-width:${sw(0.12)}" points="${u+lt},${v} ${u2-rt},${v} ${u2},${v+rt} ${u2},${v2-rt} ${u2-rt},${v2} ${u+lt},${v2} ${u},${v2-lt} ${u},${v+lt}"/>`;}
  if(p.tech!=='BC'&&p.tech!=='MWT'){
    const segs=R.half&&R.lo>0?[[g.rowU(0),g.rowU(R.up-1)+h],[g.rowU(R.up),g.rowU(R.nr-1)+h]]:[[g.rowU(0),g.rowU(R.nr-1)+h]];
    const pitch=p.a/p.nbb;
    for(let j=0;j<R.nc;j++)for(let q=0;q<p.nbb;q++){const v=g.colV(j)+pitch*(q+0.5);
      for(const [u1,u2] of segs){
        if(opt.detail)s+=`<rect class="wir" x="${u1+p.ov}" y="${v-p.dw/2}" width="${u2-u1-2*p.ov}" height="${p.dw}"/>`;
        else if(opt.wires)s+=`<line class="wirl" x1="${u1}" y1="${v}" x2="${u2}" y2="${v}" style="stroke-width:${sw(0.06)}"/>`;}}
  }
  const ub1=g.U0-p.bg-p.bw,ub2=g.U0+R.blockL+p.bg;
  s+=`<rect class="bus" x="${ub1}" y="${g.V0}" width="${p.bw}" height="${R.blockW}" style="stroke-width:${sw(0.12)}"/><rect class="bus" x="${ub2}" y="${g.V0}" width="${p.bw}" height="${R.blockW}" style="stroke-width:${sw(0.12)}"/>`;
  return s;
}
const jbPos=()=>{const g=G(),p=g.p,n=p.nJB,u=p.jbU>0?p.jbU:(R.half&&R.lo>0?g.rowU(R.up)-R.gmUse/2:g.U0+120);
  return [...Array(n)].map((_,k)=>({u,v:g.V0+R.blockW*(n===1?0.5:(2*k+1)/(2*n))}));};

/* ---------- PAFTA 1 ---------- */
function sheet1(){
  const g=G(),p=g.p;let o='';
  const k=fitScale(g.L,g.W,232,88),X=24,Y=30;
  const P=(u,v)=>[X+u/k,Y+v/k];
  // ÖN GÖRÜNÜŞ
  o+=title(X,18,'ÖN GÖRÜNÜŞ',sc(k));
  o+=`<g transform="translate(${X} ${Y}) scale(${1/k})">${scene(k,{wires:true})}</g>`;
  const [x0,y0]=P(0,0),[x1,y1]=P(g.L,g.W),[gx0,gy0]=P(g.fc,g.fc),[gx1,gy1]=P(g.fc+g.Lg,g.fc+g.Wg);
  const tolL=`±${f(p.gT+(g.fc>0?p.fT:0),1)}`;
  o+=dH(x0,x1,y0,y0-8,`${f(g.L,1)} ${tolL}`,{bad:R.bad.has('L')});
  o+=dH(gx0,gx1,y0,y0-3.6,`cam ${f(g.Lg,1)}`,{ts:2});
  o+=dV(y0,y1,x0,x0-8,`${f(g.W,1)} ${tolL}`,{bad:R.bad.has('W')});
  const [bx0,by0]=P(g.U0,g.V0),[bx1,by1]=P(g.U0+R.blockL,g.V0+R.blockW);
  o+=dH(bx0,bx1,y1,y1+6,`hücre bloğu ${f(R.blockL,1)}`,{ts:2.2});
  o+=dV(by0,by1,x1,x1+6,`${f(R.blockW,1)}`,{ts:2.2});
  o+=dV(gy0,gy1,x1,x1+12,`cam ${f(g.Wg,1)}`,{ts:2});
  // kesit hattı A-A (uzun kenara dik)
  const ua=g.L*0.12,[ax]=P(ua,0);
  o+=`<g class="cut">${ln(ax,y0-2,ax,y1+2,'cl')}${t(ax-1.5,y0-3,3,'A',{a:'end',w:700})}${t(ax-1.5,y1+5.5,3,'A',{a:'end',w:700})}${arr(ax-0.2,y0-1,-1,0,2.4)}${arr(ax-0.2,y1+1,-1,0,2.4)}</g>`;
  // detay çağrıları
  const call=(u,v,r,l)=>{const [cx,cy]=P(u,v);return `<circle class="clc" cx="${cx}" cy="${cy}" r="${r}"/>${t(cx+r*0.8,cy-r*0.8,3,l,{w:700,c:'clt'})}`;};
  o+=call(g.fc+p.eL*0.6,g.fc+p.eW*0.6,4,'B')+call(g.rowU(1)-p.gc/2,g.colV(1)-p.gs/2,2.5,'C')+call(R.half&&R.lo>0?g.rowU(R.up)-R.gmUse/2:g.U0+R.blockL+p.bg,g.colV(R.nc>2?2:0)-p.gs/2,2.5,'D');
  o+=t(X,y1+14,2.2,`${R.nc} dizi × ${R.nr} ${R.half?'yarım hücre':'hücre'} = ${R.N} parça · ${R.Ns} seri × ${R.Np} paralel · B, C, D detayları pafta 2’de`,{c:'mut'});
  // balonlar
  const [bcx,bcy]=P(g.rowU(R.nr-2)+R.h/2,g.colV(R.nc-1)+p.a*0.6);
  o+=balloon(bcx,bcy,x1+20,y1-4,3);
  const [glx,gly]=P(g.fc+p.eL/2,g.W*0.3);o+=balloon(glx,gly,x0-11,y0+10,1);
  if(g.fc>0){o+=balloon(x0+0.4,y1-10,x0-11,y1-2,8);}
  const [bux,buy]=P(g.U0-p.bg-p.bw/2,g.V0+R.blockW*0.7);o+=balloon(bux,buy,x0-11,buy+2,5);

  // ARKA GÖRÜNÜŞ
  const Y2=Y+g.W/k+44;const Q=(u,v)=>[X+(g.L-u)/k,Y2+v/k];
  o+=title(X,Y2-24,'ARKA GÖRÜNÜŞ (arkadan bakış)',sc(k));const YB=Y2+g.W/k;
  let r=`<rect class="gls" x="${X}" y="${Y2}" width="${g.L/k}" height="${g.W/k}"/>`;
  if(g.fc>0){const fl=Math.max(p.fFl,g.fc)/k;r=`<rect class="frm" x="${X}" y="${Y2}" width="${g.L/k}" height="${g.W/k}"/><rect class="gls" x="${X+fl}" y="${Y2+fl}" width="${g.L/k-2*fl}" height="${g.W/k-2*fl}"/>`;}
  o+=r;
  // montaj delikleri (uzun kenar flanşları, merkeze simetrik), topraklama ve drenaj
  const holes=[];if(g.fc>0){for(const m of [p.mh1,p.mh2])if(m>0&&m<g.L)for(const sgn of [-1,1])holes.push(g.L/2+sgn*m/2);
    const vf=p.fFl/2;
    for(const u of holes)for(const v of [vf,g.W-vf]){const [hx,hy]=Q(u,v);o+=`<rect class="hole" x="${hx-p.mhL/2/k}" y="${hy-p.mhW/2/k}" width="${p.mhL/k}" height="${p.mhW/k}" rx="${p.mhW/2/k}"/>`;}
    if(holes.length){const hs=[...holes].sort((a,b)=>a-b);const [ha]=Q(hs[0],0),[hb]=Q(hs[hs.length-1],0);
      o+=dH(Math.min(ha,hb),Math.max(ha,hb),Y2,Y2-4,`${f(Math.max(p.mh1,p.mh2),0)} (montaj)`,{ts:2.2});
      if(p.mh2>0&&p.mh1>0&&holes.length>=4){const inn=hs.slice(1,3);const [ia]=Q(inn[0],0),[ib]=Q(inn[1],0);o+=dH(Math.min(ia,ib),Math.max(ia,ib),YB,YB+5,`${f(Math.min(p.mh1,p.mh2),0)} (montaj)`,{ts:2.2});}
      const [e0]=Q(g.L,0),[e1]=Q(hs[hs.length-1],0);o+=dH(e0,e1,YB,YB+15,f((g.L-Math.max(p.mh1,p.mh2))/2,0),{ts:2.2});}
    for(const u of [g.L/2-Math.max(p.mh1,p.mh2)/2-60,g.L/2+Math.max(p.mh1,p.mh2)/2+60])if(u>0&&u<g.L){const [gx,gy]=Q(u,p.fFl/2);o+=`<circle class="hole" cx="${gx}" cy="${gy}" r="${p.gh/2/k}"/>`;}
    for(const u of [12,g.L-12])for(const v of [g.fc/2,g.W-g.fc/2]){const [dx,dy]=Q(u,v);o+=`<circle class="hole" cx="${dx}" cy="${dy}" r="${1.5/k*4}"/>`;}
  }
  // J-box, kablo, etiket
  const jb=jbPos();
  for(const b of jb){const [jx,jy]=Q(b.u,b.v);o+=`<rect class="jb" x="${jx-p.jbL/2/k}" y="${jy-p.jbW/2/k}" width="${p.jbL/k}" height="${p.jbW/k}"/>`;}
  if(jb.length){const fst=jb[0],lst=jb[jb.length-1];const [ja,jya]=Q(fst.u,fst.v),[,jyb]=Q(lst.u,lst.v);
    const cl=p.cabL/k;o+=`<path class="cab" d="M${ja} ${jya} c ${-cl*0.3} ${-6} ${-cl*0.6} ${-6} ${-cl} ${-3}"/><path class="cab" d="M${ja} ${jyb} c ${-cl*0.3} 6 ${-cl*0.6} 6 ${-cl} 3"/>`;
    o+=leader(ja-cl,jyb+3,ja-cl+4,YB+26,`10 · ${f(p.cabA,1)} mm² kablo × ${f(p.cabL,0)} mm, ${(LIB.conn.items[p.connV]||{l:''}).l}`,{ts:2});
    if(jb.length>1){const [,y_a]=Q(0,jb[0].v),[,y_b]=Q(0,jb[1].v);o+=dV(Math.min(y_a,y_b),Math.max(y_a,y_b),ja+p.jbL/2/k,ja+p.jbL/2/k+6,f(Math.abs(jb[1].v-jb[0].v),0),{ts:2.2});}
    const [ux]=Q(fst.u,0),[uE]=Q(g.L,0);o+=dH(Math.min(ux,uE),Math.max(ux,uE),YB,YB+10,`J-box ${f(fst.u,0)}`,{ts:2.2});
    o+=balloon(ja+p.jbL/2/k,jya,X+g.L/k+10,jya-4,9);}
  { const lu=g.L*0.82,lv=g.W/2;const [lx,ly]=Q(lu,lv);o+=`<rect class="lbl" x="${lx-p.lblW/2/k}" y="${ly-p.lblH/2/k}" width="${p.lblW/k}" height="${p.lblH/k}"/>`+t(lx,ly+0.8,1.8,'ETİKET',{a:'middle',c:'mut'});o+=balloon(lx-p.lblW/2/k,ly,lx-p.lblW/2/k-10,ly-12,11);}
  if(g.fc===0)o+=t(X,YB+21,2,'Çerçevesiz modül: montaj kelepçe bölgeleri üretici montaj kılavuzuna göre belirlenir.',{c:'mut'});
  if(holes.length){const [hx,hy]=Q(holes[0],g.W-p.fFl/2);o+=leader(hx,hy,hx+6,YB+21,`${holes.length*2} × oval ${f(p.mhW,0)}×${f(p.mhL,0)} montaj · Ø${f(p.gh,1)} topraklama · drenaj delikleri`,{ts:2});}

  // KESİT A-A
  o+=sectionAA(282,18,124,108);
  // PARÇA LİSTESİ
  o+=partsList(282,132,124);
  // NOTLAR
  o+=notes(282,199,124);
  // ANTET
  o+=titleBlock(282,232,124,51,1);
  return o;
}

/* Kesit A-A: uzun kenarda çerçeve + laminat katmanları (temsili profil) */
function sectionAA(x,y,bw,bh){
  const p=S.p,fr=p.frameV!=='none'&&p.fH>0;
  const rear=LIB.rear.items[p.rearV]||{kind:'glass'};
  const tr=rear.kind==='glass'?p.tgr:(p.bsg/1000/1.4);
  const th=(LIB.tech.items[p.techV]||{th:150}).th/1000;
  const lam=p.tgf+p.tef+th+p.ter+tr;
  const view=Math.max((fr?R.fc+p.fFl:0)+12,R.fc+p.eW+18),hh=fr?p.fH:lam+4;
  const m=fitEnl(view,hh,bw-26,bh-46),X=x+12,Y=y+16,F=v=>v*m;
  let o=title(x,y,'KESİT A-A',sc(1/m))+t(x+bw,y,2.2,'temsili profil',{a:'end',c:'mut'});
  const top=Y+(fr?F(p.fWt+0.4):2);
  // laminat katmanları (cam kenarı x=fc)
  const xg=X+F(R.fc),xe=X+F(view),lay=[['gls2',p.tgf,'Ön cam'],['enc',p.tef,'Ön enkapsülan'],['cel2',th,'Hücre'],['enc',p.ter,'Arka enkapsülan'],[rear.kind==='glass'?'gls2':'bs',tr,rear.kind==='glass'?'Arka cam':'Backsheet']];
  let yy=top;const ys=[];
  for(const [c,tk,l] of lay){const x0=c==='cel2'?X+F(R.fc+p.eW):xg;o+=`<rect class="${c}" x="${x0}" y="${yy}" width="${xe-x0}" height="${Math.max(F(tk),0.25)}"/>`;ys.push([yy,F(tk),l,tk]);yy+=F(tk);}
  if(fr){
    const W=F(p.fWt),H=F(p.fH),lip=F(R.fc+p.fOv),fl=F(p.fFl),gb=yy+F(0.4);
    const d=`M${X} ${Y}H${X+lip}V${Y+W}H${X+W}V${gb}H${X+lip}V${gb+W}H${X+W*2}V${Y+H-W}H${X+fl}V${Y+H}H${X}Z`;
    o+=`<path class="sec" d="${d}"/>`;
    o+=`<rect class="seal" x="${X+W}" y="${Y+W}" width="${xg-X-W}" height="${gb-Y-W}"/>`;
    o+=dV(Y,Y+H,X,X-6,`${f(p.fH,0)}`,{ts:2.2});
    o+=dH(X,X+fl,Y+H,Y+H+5,`${f(p.fFl,0)}`,{ts:2.2});
    o+=dH(X,X+lip,Y,Y-4,`${f(R.fc+p.fOv,1)}`,{ts:2});
  }
  o+=dH(xg,X+F(R.fc+p.eW),yy,yy+(fr?11:6),`e ${f(p.eW,2)}`,{ts:2,bad:R.bad.has('eW')});
  o+=dV(top,yy,xe,xe+4,`${f(lam,2)}`,{ts:2});
  let ly=Y+F(hh)+12;
  ys.forEach(([y0,hh2,l,tk],i)=>{o+=`<g class="ldr">${ln(xe-4-i*3,y0+hh2/2,xe-4-i*3,ly+i*3.2-0.8,'dl')}${ln(xe-4-i*3,ly+i*3.2-0.8,x+2,ly+i*3.2-0.8,'dl')}</g>`+t(x+2,ly+i*3.2-1.3,1.9,`${l} ${f(tk,2)} mm`,{c:'dt'});});
  return o;
}
function partsList(x,y,w){
  const p=S.p,b=R.bom.lines,find=id=>b.find(l=>l.id===id)||{spec:'',q:0,u:''};
  const rear=LIB.rear.items[p.rearV]||{};
  const rows=[
    [1,'Ön cam',(LIB.glassF.items[p.glassFV]||{}).l||'',`${f(R.Aglass/1e6,3)} m²`],
    [2,'Ön enkapsülan',(LIB.enc.items[p.encFV]||{}).l||'',`${f(p.tef,2)} mm`],
    [3,'Hücre',`${(LIB.tech.items[p.techV]||{}).l||p.tech} · ${(LIB.fmt.items[p.fmtV]||{}).l||''}`,`${R.N} ${R.half?'yarım':'adet'}`],
    [4,'Bağlantı teli',(LIB.wire.items[p.wireV]||{}).l||'',`${f(R.wireLen,1)} m`],
    [5,'Bus ribbon',(LIB.bus.items[p.busV]||{}).l||'',`${f(R.busLen,2)} m`],
    [6,'Arka enkapsülan',(LIB.enc.items[p.encRV]||{}).l||'',`${f(p.ter,2)} mm`],
    [7,R.rearKind==='glass'?'Arka cam':'Backsheet',rear.l||'',`${f(R.Aglass/1e6,3)} m²`],
    [8,'Çerçeve',(LIB.frame.items[p.frameV]||{}).l||'',p.frameV==='none'?'–':`${f(R.perim,2)} m`],
    [9,'J-box',(LIB.jbox.items[p.jboxV]||{}).l||'',`${p.nJB} parça`],
    [10,'Kablo + konnektör',`${(LIB.cable.items[p.cableV]||{}).l||''} · ${(LIB.conn.items[p.connV]||{}).l||''}`,'1 takım'],
    [11,'Etiket','ürün etiketi + barkod','1 set']];
  const rh=4.6;let o=title(x,y,'PARÇA LİSTESİ');let yy=y+3;
  o+=rc(x,yy,w,rh*(rows.length+1),'tb');
  const cx=[x,x+7,x+30,x+w-18,x+w];
  o+=t(cx[0]+1,yy+3.3,2,'No',{w:600})+t(cx[1]+1,yy+3.3,2,'Parça',{w:600})+t(cx[2]+1,yy+3.3,2,'Malzeme / tip',{w:600})+t(cx[3]+1,yy+3.3,2,'Miktar',{w:600});
  for(const c of cx.slice(1,4))o+=ln(c,yy,c,yy+rh*(rows.length+1),'tl');
  rows.forEach((r,i)=>{const ry=yy+rh*(i+1);o+=ln(x,ry,x+w,ry,'tl')+t(cx[0]+3.5,ry+3.3,2,String(r[0]),{a:'middle'})+t(cx[1]+1,ry+3.3,1.9,r[1])+t(cx[2]+1,ry+3.3,1.7,clip(r[2],46))+t(cx[3]+1,ry+3.3,1.8,r[3]);});
  return o;
}
const clip=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
function notes(x,y,w){
  const p=S.p;const ln2=[
    'Tüm ölçüler mm’dir. Belirtilmeyen toleranslar ISO 2768-m.',
    R.fc>0?`Modül dış ölçü toleransı ±${f(p.gT+p.fT,1)} mm (cam kesim ±${f(p.gT,1)} + çerçeve montaj ±${f(p.fT,1)}).`:`Modül dış ölçü toleransı ±${f(p.gT,1)} mm (cam kesim; çerçevesiz).`,
    `Min. kenar mesafesi (gerilimli parça – cam kenarı) ${f(p.eMin,1)} mm. Hücre arası boşluk ${f(p.gc,2)} ±${f(S.t.gc||0,2)}, dizi aralığı ${f(p.gs,2)} ±${f(S.t.gs||0,2)} mm.`,
    `Laminat katman kalınlıkları laminasyon öncesi nominal değerlerdir. Kesit A-A temsili profildir; çerçeve tedarikçi çizimine göre doğrulanmalıdır.`,
    `Montaj deliği aralıkları ve J-box konumları tasarım girdisidir; montaj sistemi ve etiket (IEC 61730) gereksinimleriyle kontrol edilmelidir.`,
    `Toplam kütle ${f(R.mass.total,1)} kg · Pmax ${f(R.P,1)} W · Etiket gücü ${f(p.Pplate,0)} W.`];
  const wrap=(txt,n)=>{const out=[];let cur='';for(const w2 of txt.split(' ')){if((cur+' '+w2).trim().length>n){out.push(cur.trim());cur=w2;}else cur+=' '+w2;}if(cur.trim())out.push(cur.trim());return out;};
  const n=Math.floor(w/(1.85*0.5));let o=title(x,y,'NOTLAR'),yy=y+5;
  ln2.forEach((s2,i)=>{wrap(`${i+1}. ${s2}`,n).forEach((l,j)=>{o+=t(x+(j?2.5:0),yy,1.85,l);yy+=2.9;});yy+=0.6;});
  if(R.viol.length)wrap(`SINIR İHLALİ: ${R.viol.map(v=>v.m).join(' · ')}`,n-4).forEach(l=>{o+=t(x,yy,1.9,l,{c:'badt',w:600});yy+=3;});
  return o;
}
function titleBlock(x,y,w,h,page){
  const p=S.p,d=new Date().toLocaleDateString('tr-TR');
  let o=rc(x,y,w,h,'tb');
  const r=[[0,12],[12,20],[20,28],[28,36],[36,44],[44,h]];
  o+=t(x+2,y+5,2,'FİRMA',{c:'mut'})+t(x+2,y+10,3.2,p.company||'—',{w:700});
  o+=ln(x,y+12,x+w,y+12,'tl')+t(x+2,y+15.5,1.8,'ÇİZİM ADI',{c:'mut'})+t(x+2,y+19.2,2.4,clip(S.name,62),{w:600});
  const cells=[['Çizim no',p.dwgNo||'—'],['Rev.',p.rev||'—'],['Pafta',`${page} / 2`],['Ölçek',page===1?sc(fitScale(R.L,R.W,232,88)):'çeşitli'],
    ['Tarih',d],['Birim','mm'],['Genel tol.','ISO 2768-m'],['Kütle',f(R.mass.total,1)+' kg'],['Çizen',p.drawer||'—'],['Kontrol/onay',p.checker||'—'],['Projeksiyon','ISO E'],['Boyut','A3']];
  const cw=w/4;
  cells.forEach(([l,v],i)=>{const cxx=x+(i%4)*cw,cyy=y+20+Math.floor(i/4)*10.3;o+=rc(cxx,cyy,cw,10.3,'tl')+t(cxx+1.5,cyy+3.2,1.7,l,{c:'mut'})+t(cxx+1.5,cyy+7.8,2.3,clip(String(v),18),{w:600});});
  return o;
}

/* ---------- PAFTA 2 ---------- */
function detailBox(x,y,bw,bh,name,u0,v0,ww,wh,dims){
  const m=fitEnl(ww,wh,bw-22,bh-22),X=x+12,Y=y+14,id='cp'+name.replace(/\W/g,'');
  let o=title(x,y,name,sc(1/m));
  o+=`<defs><clipPath id="${id}"><rect x="${u0}" y="${v0}" width="${ww}" height="${wh}"/></clipPath></defs>`;
  o+=`<g transform="translate(${X-u0*m} ${Y-v0*m}) scale(${m})"><g clip-path="url(#${id})">${scene(1/m,{detail:true})}</g></g>`;
  o+=rc(X,Y,ww*m,wh*m,'win');
  const P=(u,v)=>[X+(u-u0)*m,Y+(v-v0)*m];
  return o+dims(P,m,X,Y,ww*m,wh*m);
}
function sheet2(){
  const g=G(),p=g.p;let o='';
  // DETAY A: köşe
  const wA=g.fc+p.eL+6,hA=g.fc+p.eW+6;
  o+=detailBox(16,18,156,106,'DETAY B · köşe',0,0,wA,hA,(P,m,X,Y,W,H)=>{
    let d='';const [x0,y0]=P(0,0),[xf]=P(g.fc,0),[xb1]=P(g.U0-p.bg-p.bw,0),[xb2]=P(g.U0-p.bg,0),[xc]=P(g.U0,0),[,yf]=P(0,g.fc),[,yc]=P(0,g.V0),[xo]=P(g.fc+p.fOv,0);
    d+=dH(x0,xf,y0,y0-4,f(g.fc,1),{ts:2})+dH(xf,xb1,y0,y0-4,f(p.eL-p.bg-p.bw,2),{ts:2,bad:R.bad.has('eL')})+dH(xb1,xb2,y0,y0-9,f(p.bw,1),{ts:2})+dH(xb2,xc,y0,y0-4,f(p.bg,1),{ts:2});
    d+=dH(xf,xc,Y+H,Y+H+5,`e ${f(p.eL,1)}`,{ts:2});
    d+=dV(y0,yf,x0,x0-4,f(g.fc,1),{ts:2})+dV(yf,yc,x0,x0-4,f(p.eW,2),{ts:2,bad:R.bad.has('eW')});
    if(g.fc>0)d+=leader(xo,Y+H*0.8,X+W+2,Y+H*0.9,`dudak ${f(p.fOv,1)}`,{ts:1.9});
    return d;});
  // DETAY B: hücre kesişimi
  const pitch0=p.a/p.nbb,ub=g.rowU(1)-p.gc/2,vb=g.colV(1)-p.gs/2,wB=Math.max(p.gc*6,12),hB=Math.min(p.a,2*(p.gs/2+pitch0*0.5+2.5));
  o+=detailBox(182,18,108,106,'DETAY C · hücre aralıkları',ub-wB/2,vb-hB/2,wB,hB,(P,m,X,Y,W,H)=>{
    const [xa]=P(g.rowU(1)-p.gc,0),[xb]=P(g.rowU(1),0),[,ya]=P(0,g.colV(1)-p.gs),[,yb]=P(0,g.colV(1));
    let d=dH(xa,xb,Y,Y-4,`g ${f(p.gc,2)}`,{ts:2,bad:R.bad.has('gc')})+dV(ya,yb,X,X-4,`gₛ ${f(p.gs,2)}`,{ts:2,bad:R.bad.has('gs')});
    if(p.tech!=='BC'&&p.tech!=='MWT'){const pitch=p.a/p.nbb;const vw=g.colV(1)+pitch*0.5;const [,yw]=P(0,vw);d+=leader(X+W*0.2,yw,X+W+2,Y+H*0.15,`tel Ø${f(p.dw,2)} · adım ${f(pitch,2)}`,{ts:1.9});}
    return d;});
  // DETAY C: orta boşluk veya dizi ucu
  if(R.half&&R.lo>0){const uc=g.rowU(R.up)-R.gmUse/2,vc=g.colV(1)-p.gs/2,wC=Math.max(R.gmUse*3,12),hC=wC*0.75;
    o+=detailBox(300,18,104,106,'DETAY D · orta boşluk',uc-wC/2,vc-hC/2,wC,hC,(P,m,X,Y,W,H)=>{const [xa]=P(g.rowU(R.up)-R.gmUse,0),[xb]=P(g.rowU(R.up),0);return dH(xa,xb,Y,Y-4,`gₘ ${f(R.gmUse,2)}`,{ts:2,bad:R.bad.has('gm')})+leader(X+W/2,Y+H*0.6,X+W+2,Y+H*0.8,'yarım hücre kesim kenarları',{ts:1.8});});}
  else{const ue=g.U0+R.blockL+p.bg+p.bw/2,ve=g.colV(1)-p.gs/2,wC=p.bg+p.bw+16,hC=wC*0.75;
    o+=detailBox(300,18,104,106,'DETAY D · dizi ucu',ue-wC/2,ve-hC/2,wC,hC,(P,m,X,Y,W,H)=>{const [xa]=P(g.U0+R.blockL,0),[xb]=P(g.U0+R.blockL+p.bg,0),[xc]=P(g.U0+R.blockL+p.bg+p.bw,0);return dH(xa,xb,Y,Y-4,f(p.bg,1),{ts:2})+dH(xb,xc,Y,Y-9,f(p.bw,1),{ts:2});});}
  // HÜCRE DETAYI
  o+=cellDetail(16,128,160,100);
  // ELEKTRİK ŞEMASI
  o+=schematic(186,128,218,100);
  // ELEKTRİKSEL DEĞERLER
  o+=elecTable(16,238,258,46);
  o+=titleBlock(282,232,124,51,2);
  return o;
}
function cellDetail(x,y,bw,bh){
  const p=S.p,h=R.h,mm=[2,1,0.5,0.4,0.25,0.2].find(v=>p.a*v<=bw-30&&h*v<=bh-30)||0.2,X=x+16,Y=y+16,W=p.a*mm,H=h*mm;
  const scl=mm>=1?`${mm}:1`:`1:${(1/mm).toString().replace('.',',')}`;
  let o=title(x,y,R.half?'YARIM HÜCRE DETAYI':'HÜCRE DETAYI',scl);
  const c=Math.min(p.ch,p.a/2,h/2)*mm,cb=R.half?0:c;
  o+=`<polygon class="cel" points="${X+c},${Y} ${X+W-c},${Y} ${X+W},${Y+c} ${X+W},${Y+H-cb} ${X+W-cb},${Y+H} ${X+cb},${Y+H} ${X},${Y+H-cb} ${X},${Y+c}"/>`;
  if(p.tech!=='BC'&&p.tech!=='MWT'){const pitch=p.a/p.nbb;for(let q=0;q<p.nbb;q++){const xx=X+(pitch*(q+0.5))*mm;o+=`<rect class="wir" x="${xx-Math.max(p.dw*mm,0.25)/2}" y="${Y+p.ov*mm}" width="${Math.max(p.dw*mm,0.25)}" height="${H-2*p.ov*mm}"/>`;}
    o+=dH(X+pitch*0.5*mm,X+pitch*1.5*mm,Y,Y-4,`adım ${f(pitch,2)}`,{ts:1.9});
    o+=dV(Y,Y+p.ov*mm,X+W,X+W+4,f(p.ov,1),{ts:1.9});}
  if(R.half)o+=`<line class="cutl" x1="${X}" y1="${Y+H}" x2="${X+W}" y2="${Y+H}"/>`+t(X+W/2,Y+H+3.5,1.9,'LSC / TLS kesim kenarı',{a:'middle',c:'mut'});
  o+=dH(X,X+W,Y+H,Y+H+(R.half?8:5),`${f(p.a,2)} ±${f(S.t.a||0,2)}`,{ts:2.2});
  o+=dV(Y,Y+H,X,X-5,`${f(h,2)}`,{ts:2.2});
  if(p.ch>0)o+=leader(X+c/2,Y+c/2,X-4,Y-6,`pah ${f(p.ch,1)}`,{ts:1.9});
  o+=t(x,y+bh-1,1.9,`${p.nbb} ${p.tech==='BC'||p.tech==='MWT'?'arka kontak':'bağlantı teli'} · ${(LIB.tech.items[p.techV]||{}).l||p.tech} · ${f(p.P/(R.half?2:1),2)} W / parça`,{c:'mut'});
  return o;
}
function schematic(x,y,bw,bh){
  const p=S.p;let o=title(x,y,'ELEKTRİK ŞEMASI')+t(x+bw,y,2.1,`${R.Ns} seri × ${R.Np} paralel · ${Math.max(1,Math.round(R.nc/2))} bypass diyot`,{a:'end',c:'mut'});
  const nSub=Math.max(1,Math.round(R.nc/2)),X=x+8,Y=y+14,W=bw-16,H=bh-26,sw=W/nSub;
  const half=R.half&&R.lo>0,cellsPerStr=half?R.up:R.nr;
  for(let s=0;s<nSub;s++){const sx=X+s*sw+4,w=sw-8;
    const rows=half?2:1;
    for(let r=0;r<rows;r++){const ry=Y+(half?r*(H/2):H*0.15),rh=half?H/2-6:H*0.55;
      o+=rc(sx,ry,w,rh,'sbox');
      o+=t(sx+w/2,ry+rh/2-1,2.1,`dizi ${2*s+1}–${2*s+2}${half?(r?' · alt':' · üst'):''}`,{a:'middle',w:600})+t(sx+w/2,ry+rh/2+2.6,1.8,`${2*cellsPerStr} ${R.half?'yarım hücre':'hücre'} seri`,{a:'middle',c:'mut'});
      o+=ln(sx,ry+rh/2,sx-4,ry+rh/2)+ln(sx+w,ry+rh/2,sx+w+4,ry+rh/2);}
    if(half){o+=ln(sx-4,Y+H/4-3,sx-4,Y+3*H/4-3)+ln(sx+w+4,Y+H/4-3,sx+w+4,Y+3*H/4-3);}
    // bypass diyot
    const dy=Y+H+3,dx=sx+w/2;o+=ln(sx-4,half?Y+H/2-3:Y+H*0.15+H*0.275,sx-4,dy)+ln(sx+w+4,half?Y+H/2-3:Y+H*0.15+H*0.275,sx+w+4,dy)+ln(sx-4,dy,dx-2.5,dy)+ln(dx+2.5,dy,sx+w+4,dy);
    o+=`<polygon class="dio" points="${dx+2.5},${dy} ${dx-2.5},${dy-2.2} ${dx-2.5},${dy+2.2}"/>`+ln(dx+2.5,dy-2.4,dx+2.5,dy+2.4,'lt');
    o+=t(dx,dy+5,1.8,`D${s+1}`,{a:'middle',c:'mut'});
  }
  o+=t(X-2,Y+H/2,3,'−',{a:'end',w:700})+t(X+W+2,Y+H/2,3,'+',{w:700});
  if(half)o+=t(X,Y-3,1.9,'Üst yarı ∥ alt yarı (yarım hücre paralel bağlantı)',{c:'mut'});
  return o;
}
function elecTable(x,y,w,h){
  const p=S.p,d=R.ds,fuse=Math.ceil(R.Isc*1.56/5)*5;
  const rows=[['Pmax (STC)',f(R.P,1)+' W'],['Voc',f(R.Voc,2)+' V'],['Isc',f(R.Isc,2)+' A'],['Vmp',f(R.Vmp,2)+' V'],['Imp',f(R.Imp,2)+' A'],['Modül verimi',f(R.eta,2)+' %'],
    ['Pmax (NMOT)',f(d.P_NMOT,1)+' W'],['γ Pmax',f(p.tc,2)+' %/°C'],['β Voc',f(p.bVoc,2)+' %/°C'],['α Isc',fs(p.aIsc,3)+' %/°C'],['Voc @ −10 °C',f(d.Voc_m10,1)+' V'],['Bifasiyallik',d.phi>0?f(d.phi*100,0)+' %':'—'],
    ['Maks. sistem gerilimi',f(p.Vsys,0)+' V DC'],['Maks. seri sigorta (öneri)',fuse+' A'],['Etiket gücü',f(p.Pplate,0)+' W'],['CTM',f(R.CTM,2)+' %']];
  let o=title(x,y,'ELEKTRİKSEL DEĞERLER (STC: 1000 W/m², 25 °C, AM1,5)');
  const cols=4,rh=4.7,cw=w/cols,Y=y+3;
  rows.forEach(([l,v],i)=>{const cx=x+Math.floor(i/4)*cw,cy=Y+(i%4)*rh*2;o+=rc(cx,cy,cw,rh*2,'tl')+t(cx+1.5,cy+3.3,1.8,l,{c:'mut'})+t(cx+cw-1.5,cy+7.7,2.6,v,{a:'end',w:600});});
  return o;
}

/* ---------- Pafta kabuğu ---------- */
function sheetSVG(n){
  const body=n===1?sheet1():sheet2();
  return `<svg class="sheet" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" role="img" aria-label="Teknik resim pafta ${n}">
<style>${SHEET_CSS}</style><rect class="paper" x="0" y="0" width="${SHEET.w}" height="${SHEET.h}"/>
<rect class="brd" x="10" y="8" width="${SHEET.w-14}" height="${SHEET.h-12}"/>
${[...Array(8)].map((_,i)=>t(10+(SHEET.w-14)*(i+0.5)/8,6.5,2,String(i+1),{a:'middle',c:'mut'})).join('')}
${body}</svg>`;
}
const SHEET_CSS=`text{font-family:"IBM Plex Sans","Arial Narrow",Arial,sans-serif;fill:#141414}
.paper{fill:#fff}.brd{fill:none;stroke:#141414;stroke-width:.5}
.l{fill:none;stroke:#141414;stroke-width:.25}.lt{fill:none;stroke:#141414;stroke-width:.35}
.mut{fill:#5b6270}.dt{fill:#141414}.badt{fill:#c1121f}
.dl{stroke:#2b2b2b;stroke-width:.13;fill:none}.ah{fill:#2b2b2b}
.dim.bad .dl{stroke:#c1121f}.dim.bad .ah{fill:#c1121f}.dim.bad text{fill:#c1121f;font-weight:600}
.frm{fill:#d5d8dd;stroke:#141414}.frmo{fill:none;stroke:#141414}.frmi{fill:none;stroke:#141414}.frmband{fill:#c9cdd3}.frmlip{fill:none;stroke:#555}
.gls{fill:#f3f6f9;stroke:#141414;stroke-width:.25}.cel{fill:#dbe3ef;stroke:#2d3a52;stroke-width:.12}
.wir{fill:#8a96a8}.wirl{stroke:#9aa6b8}.bus{fill:#9aa3ad;stroke:#4a5260}
.cl{stroke:#141414;stroke-width:.25;stroke-dasharray:6 1.5 1 1.5}.cut text{fill:#141414}
.clc{fill:none;stroke:#141414;stroke-width:.25}.clt{fill:#141414}
.hole{fill:#fff;stroke:#141414;stroke-width:.2}.jb{fill:#3a3f47;stroke:#141414;stroke-width:.2}.cab{fill:none;stroke:#141414;stroke-width:.45}
.lbl{fill:#fff;stroke:#141414;stroke-width:.2;stroke-dasharray:1 .6}
.sec{fill:url(#hatch);stroke:#141414;stroke-width:.3}.seal{fill:#eceff3;stroke:none}
.gls2{fill:#e9f0f6;stroke:#141414;stroke-width:.15}.enc{fill:#fdf6d8;stroke:#141414;stroke-width:.1}.cel2{fill:#2d3a52;stroke:none}.bs{fill:#f5f5f5;stroke:#141414;stroke-width:.15}
.tb{fill:none;stroke:#141414;stroke-width:.4}.tl{fill:none;stroke:#141414;stroke-width:.15}
.win{fill:none;stroke:#141414;stroke-width:.25}
.bc{fill:#fff;stroke:#141414;stroke-width:.25}.dot{fill:#141414}
.sbox{fill:#eef2f8;stroke:#141414;stroke-width:.25}.dio{fill:#141414}.cutl{stroke:#c1121f;stroke-width:.35;stroke-dasharray:1.5 .8}`;
const HATCH=`<defs><pattern id="hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#e3e6ea"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="#141414" stroke-width=".18"/></pattern></defs>`;

function renderSheets(){
  const box=$('#sheetBox');if(!box||!R)return;
  const svg=sheetSVG(SHEET_N).replace('<rect class="paper"',HATCH+'<rect class="paper"');
  box.innerHTML=svg;box.querySelector('svg').style.width=(SHEET_Z*100)+'%';
  for(const b of $$('[data-sheet]'))b.setAttribute('aria-pressed',String(+b.dataset.sheet===SHEET_N));
  $('#zoomLbl').textContent=Math.round(SHEET_Z*100)+'%';
}
function sheetFile(n){return '<?xml version="1.0" encoding="UTF-8"?>\n'+sheetSVG(n).replace('<rect class="paper"',HATCH+'<rect class="paper"');}
function initSheets(){
  if(!$('#sheetBox'))return;
  $('#sheetBar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sheet){SHEET_N=+b.dataset.sheet;renderSheets();}
    if(b.dataset.zoom){const z=b.dataset.zoom;SHEET_Z=z==='fit'?1:Math.min(6,Math.max(1,SHEET_Z*(z==='in'?1.5:1/1.5)));renderSheets();}
    if(b.id==='svgDl')saveFile(`${safeName()}_pafta${SHEET_N}.svg`,sheetFile(SHEET_N));
    if(b.id==='printBtn'){const pb=$('#printBox');pb.innerHTML=[1,2].map(n=>`<div class="printpage">${sheetFile(n).replace(/^<\?xml[^>]*>\s*/,'')}</div>`).join('');window.print();}
  });
}
initSheets();
window.renderSheets=renderSheets;
const _rc2=recompute;recompute=function(){_rc2();if(!$('[data-panel="cizim"]').hidden)renderSheets();};
