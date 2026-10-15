// Hesap doğrulama testleri — çalıştırma: node tests/dogrulama.js
// Hesap motorunu (web/assets/js) arayüz olmadan yükler ve bağımsız referanslarla karşılaştırır.
'use strict';
const FS = require('fs'), PATH = require('path');
const D = PATH.join(__dirname, '..', 'web', 'assets', 'js') + PATH.sep;
const rd = f => FS.readFileSync(D + f, 'utf8');
const app = rd('app.js'), mech = rd('mech.js');
const tpl = app.slice(app.indexOf('const ERAS='), app.indexOf('/* ---- Durum'));
const cd = app.slice(app.indexOf('function cellDerived')); const cdFn = cd.slice(0, cd.indexOf('return p;}') + 10);
const mechSrc = mech.slice(mech.indexOf('function mechSolve'), mech.indexOf('/* ---------- arayüz'));
const E = new Function(['library.js', 'iv.js', 'engine.js'].map(rd).join('\n') + '\n' + cdFn + '\n' + tpl + '\n' +
  'let R=null;\n' + mechSrc + ';return {defaults,evaluate,fromTemplate,TEMPLATES,moduleIV,mechSolve,mechModel,frameSection,LIB};')();

let nOk = 0, nBad = 0;
const check = (name, ok, detail) => { (ok ? nOk++ : nBad++); console.log(`${ok ? 'GEÇTİ ' : 'KALDI '} ${name}${detail ? ' — ' + detail : ''}`); };
const pct = (a, b) => (a / b - 1) * 100;

/* ===================== 1. Elektrik ===================== */
console.log('\n# Elektrik modeli');
for (const t of E.TEMPLATES) {
  const d = E.fromTemplate(t.id), r = E.evaluate(d.p), s = r.ivSpec;
  const at = T => E.moduleIV(Object.assign({}, s, { Tc: T }));
  const p25 = at(25), p50 = at(50);
  const g = (p50.Pmp / p25.Pmp - 1) / 25 * 100, bV = (p50.Voc / p25.Voc - 1) / 25 * 100, aI = (p50.Isc / p25.Isc - 1) / 25 * 100;
  const dIV = pct(r.P, r.Pchain);
  const ok = Math.abs(dIV) < 0.3 && Math.abs(g - d.p.tc) < 0.003 && Math.abs(bV - d.p.bVoc) < 0.003 && Math.abs(aI - d.p.aIsc) < 0.003 && s.full.ok;
  check(`${t.id.padEnd(12)} IV↔zincir, α β γ`, ok,
    `ΔP ${dIV.toFixed(2)} %, γ ${g.toFixed(3)} (${d.p.tc}), β ${bV.toFixed(3)} (${d.p.bVoc}), α ${aI.toFixed(3)} (${d.p.aIsc}), hücre uyumu ${s.full.errP.toFixed(2)} %`);
}
{ // tel direnci kaybı: bağımsız yeniden hesap
  const d = E.fromTemplate('gg_tc_g12r'), p = d.p, r = E.evaluate(p);
  const rho = 1.724e-8 * (1 + 0.00393 * (p.Tm - 20)) * p.kc, Aw = Math.PI * p.dw * p.dw / 4 * 1e-6, Rp = rho / Aw;
  const Iw = p.Imp / 2 * r.kI / p.nbb, h = p.b / 2, l = (h - 2 * p.ov) / 1000, g = (p.gc + 2 * p.ov) / 1000;
  const Pw = r.N * p.nbb * Iw * Iw * Rp * (2 * l / 3 + g);
  check('Tel direnç kaybı (yarım hücre, 16 tel)', Math.abs(pct(r.Pw, Pw)) < 0.01, `${r.Pw.toFixed(2)} W ↔ ${Pw.toFixed(2)} W (%${(Pw / r.Pcells * 100).toFixed(2)})`);
}
{ // kalibrasyon çarpanı yalnız gerilimi ölçekler: Isc ve FF değişmez
  const d = E.fromTemplate('gg_tc_g12r'), r1 = E.evaluate(d.p), r2 = E.evaluate(Object.assign({}, d.p, { kCal: 0.98 }));
  check('k_kal gerilimi ölçekler: Isc sabit, FF ≈ sabit', Math.abs(pct(r2.P, r1.P) + 2) < 0.1 && Math.abs(pct(r2.Isc, r1.Isc)) < 0.01 && Math.abs(r2.FF - r1.FF) < 1e-3,
    `ΔP ${pct(r2.P, r1.P).toFixed(3)} %, ΔIsc ${pct(r2.Isc, r1.Isc).toFixed(3)} %, ΔFF ${((r2.FF - r1.FF) * 100).toFixed(3)} puan`);
}
{ // sektör standardı ölçüler
  const dims = { gg_tc_g12r: [2382, 1134], gg_tc_g12: [2384, 1303] };
  for (const [id, [L, W]] of Object.entries(dims)) { const r = E.evaluate(E.fromTemplate(id).p);
    check(`${id} dış ölçü`, Math.abs(r.L - L) < 1.5 && Math.abs(r.W - W) < 1.5, `${r.L.toFixed(1)} × ${r.W.toFixed(1)} (standart ${L} × ${W})`); }
}

/* ===================== 2. Mekanik: referans çözümler ===================== */
console.log('\n# Mekanik çözücü');
const Eg = 70000;
const plate = (L, W, h, nu, extra) => Object.assign({ a: L / 2, b: W / 2, D: Eg * h ** 3 / (12 * (1 - nu * nu)), Am: Eg * h / (1 - nu * nu), nu, frame: null, sup: [], ksup: 0, levels: [1], qNeg: 0 }, extra);

// 2a. Navier: basit mesnetli dikdörtgen plak, küçük sehim
const navier = (q, L, W, Dp, n = 199) => { let w = 0; for (let m = 1; m <= n; m += 2) for (let k = 1; k <= n; k += 2)
  w += 16 * q / (Math.PI ** 6 * Dp) / (m * k * (m * m / (L * L) + k * k / (W * W)) ** 2) * Math.sin(m * Math.PI / 2) * Math.sin(k * Math.PI / 2); return w; };
for (const [L, W] of [[1000, 1000], [2000, 1000]]) {
  const h = 4, nu = 0.3, M = plate(L, W, h, nu, { qPos: 1e-7, deg: 12 }), Dp = M.D; M.edgeK = 1e5 * Dp / Math.min(L, W) ** 3;
  const r = E.mechSolve(M), wR = r.levels[0].wc, wN = navier(1e-7, L, W, Dp);
  check(`Navier ${L}×${W} küçük sehim`, Math.abs(pct(wR, wN)) < 1, `Ritz ${wR.toExponential(4)} ↔ Navier ${wN.toExponential(4)} mm (${pct(wR, wN).toFixed(2)} %)`);
}

// 2b. Büyük sehim: bağımsız sonlu fark (Föppl–von Kármán, Airy gerilme fonksiyonu), basit mesnetli kare plak, kenarlar düzlem içinde serbest
function fdVonKarman(Q, Nn, nu) {
  const L = 1, h = 1, E1 = 1, Dp = E1 * h ** 3 / (12 * (1 - nu * nu)), q = Q * E1 * h ** 4 / L ** 4, hh = L / Nn, m = Nn - 1, n = m * m, bw = 2 * m;
  const id = (i, j) => (j - 1) * m + (i - 1);
  const band = () => ({ A: Array.from({ length: n }, () => new Float64Array(2 * bw + 1)) });
  const put = (B, r, c, v) => { B.A[r][c - r + bw] += v; };
  const biharm = (B, sgn, s) => { // sgn: hayalet düğüm işareti (w: −1, F: +1)
    const st = [[0, 0, 20], [1, 0, -8], [-1, 0, -8], [0, 1, -8], [0, -1, -8], [1, 1, 2], [1, -1, 2], [-1, 1, 2], [-1, -1, 2], [2, 0, 1], [-2, 0, 1], [0, 2, 1], [0, -2, 1]];
    for (let j = 1; j <= m; j++) for (let i = 1; i <= m; i++) for (const [di, dj, c] of st) {
      let ii = i + di, jj = j + dj, f = 1;
      if (ii === -1) { ii = 1; f *= sgn; } if (ii === Nn + 1) { ii = Nn - 1; f *= sgn; }
      if (jj === -1) { jj = 1; f *= sgn; } if (jj === Nn + 1) { jj = Nn - 1; f *= sgn; }
      if (ii <= 0 || ii >= Nn || jj <= 0 || jj >= Nn) continue;
      put(B, id(i, j), id(ii, jj), s * c * f / hh ** 4); } };
  const solveB = (B, rhs) => { const A = B.A.map(r => Float64Array.from(r)), x = Float64Array.from(rhs);
    for (let k = 0; k < n; k++) { const piv = A[k][bw]; for (let r = k + 1; r <= Math.min(n - 1, k + bw); r++) { const f = A[r][k - r + bw] / piv; if (!f) continue;
      for (let c = k; c <= Math.min(n - 1, k + bw); c++) A[r][c - r + bw] -= f * A[k][c - k + bw]; x[r] -= f * x[k]; } }
    for (let k = n - 1; k >= 0; k--) { let s = x[k]; for (let c = k + 1; c <= Math.min(n - 1, k + bw); c++) s -= A[k][c - k + bw] * x[c]; x[k] = s / A[k][bw]; } return x; };
  const val = (u, i, j) => (i <= 0 || i >= Nn || j <= 0 || j >= Nn) ? 0 : u[id(i, j)];
  const d2 = (u, i, j) => [(val(u, i + 1, j) - 2 * val(u, i, j) + val(u, i - 1, j)) / hh ** 2, (val(u, i, j + 1) - 2 * val(u, i, j) + val(u, i, j - 1)) / hh ** 2,
    (val(u, i + 1, j + 1) - val(u, i + 1, j - 1) - val(u, i - 1, j + 1) + val(u, i - 1, j - 1)) / (4 * hh * hh)];
  const BF = band(); biharm(BF, 1, 1);
  let w = new Float64Array(n);
  { const BW = band(); biharm(BW, -1, Dp); w = solveB(BW, new Float64Array(n).fill(q)); }
  for (let it = 0; it < 400; it++) {
    const rf = new Float64Array(n);
    for (let j = 1; j <= m; j++) for (let i = 1; i <= m; i++) { const [xx, yy, xy] = d2(w, i, j); rf[id(i, j)] = E1 * (xy * xy - xx * yy); }
    const F = solveB(BF, rf);
    const BW = band(); biharm(BW, -1, Dp);
    for (let j = 1; j <= m; j++) for (let i = 1; i <= m; i++) { // −h·L(F, w) = −h(F_yy w_xx + F_xx w_yy − 2 F_xy w_xy)
      const [Fxx, Fyy, Fxy] = d2(F, i, j), r = id(i, j), c2 = 1 / hh ** 2, c4 = 1 / (4 * hh * hh);
      const add = (ii, jj, v) => { if (ii > 0 && ii < Nn && jj > 0 && jj < Nn) put(BW, r, id(ii, jj), -h * v); };
      add(i + 1, j, Fyy * c2); add(i - 1, j, Fyy * c2); add(i, j, -2 * Fyy * c2);
      add(i, j + 1, Fxx * c2); add(i, j - 1, Fxx * c2); add(i, j, -2 * Fxx * c2);
      add(i + 1, j + 1, -2 * Fxy * c4); add(i - 1, j - 1, -2 * Fxy * c4); add(i + 1, j - 1, 2 * Fxy * c4); add(i - 1, j + 1, 2 * Fxy * c4); }
    const wn = solveB(BW, new Float64Array(n).fill(q)); let dmax = 0, wmx = 0;
    for (let k = 0; k < n; k++) { const v = 0.5 * wn[k] + 0.5 * w[k]; dmax = Math.max(dmax, Math.abs(v - w[k])); wmx = Math.max(wmx, Math.abs(v)); w[k] = v; }
    if (dmax < 1e-10 * wmx) break; }
  return val(w, Nn / 2, Nn / 2) / h;
}
for (const Q of [20, 100, 300]) {
  const nu = 0.3, h = 4, L = 1000, q = Q * Eg * h ** 4 / L ** 4;
  const M = plate(L, L, h, nu, { qPos: q, deg: 12, levels: [1] }); M.edgeK = 1e5 * M.D / L ** 3;
  const wR = E.mechSolve(M).levels[0].wc / h;
  const f24 = fdVonKarman(Q, 24, nu), f32 = fdVonKarman(Q, 32, nu), fEx = (32 * 32 * f32 - 24 * 24 * f24) / (32 * 32 - 24 * 24);
  const wLin = navier(q, L, L, M.D) / h;
  check(`Büyük sehim, kare plak Q = ${Q}`, Math.abs(pct(wR, fEx)) < 2, `Ritz w/h ${wR.toFixed(4)} ↔ sonlu fark ${fEx.toFixed(4)} (${pct(wR, fEx).toFixed(2)} %); doğrusal teori ${wLin.toFixed(3)}`);
}

// 2c. Çerçeve + cam şeridi: kompozit kiriş (bağ yok / tam bağ)
{
  const L = 2000, W = 40, h = 4, nu = 0.22, EI = 69000 * 12000, EA = 69000 * 130, e = 15, q = 1e-6;
  for (const [ks, nm] of [[0, 'bağ yok'], [1e7, 'tam bağ']]) {
    const M = plate(L, W, h, nu, { qPos: q, deg: 12, frame: { EI, EA, e, ks, E: 69000, ct: 18, cb: 12 }, sup: [[-L / 2, -W / 2], [-L / 2, W / 2], [L / 2, -W / 2], [L / 2, W / 2]], ksup: 1e7 });
    const r = E.mechSolve(M), wR = r.levels[0].wc;
    const Eh = Eg * h, EAg = Eh * W, EIg = Eg * h ** 3 * W / 12;
    let EIs; if (ks === 0) EIs = 2 * EI + EIg; else { const zb = 2 * EA * e / (2 * EA + EAg); EIs = 2 * EI + 2 * EA * (e - zb) ** 2 + EAg * zb * zb + EIg; }
    const wA = 5 * q * W * L ** 4 / (384 * EIs);
    check(`Kompozit kiriş, ${nm}`, Math.abs(pct(wR, wA)) < 1.5, `Ritz ${wR.toExponential(4)} ↔ analitik ${wA.toExponential(4)} mm (${pct(wR, wA).toFixed(2)} %)`);
  }
}

// 2d. Gerçek modül: denge ve yakınsama
{
  const d = E.fromTemplate('gg_tc_g12r'), p = d.p, Rr = E.evaluate(p);
  const res = {};
  for (const deg of [8, 10, 12]) { const mm = E.mechModel(Object.assign({}, p, { mDeg: deg }), Rr); const r = E.mechSolve(mm.M);
    const P = r.levels.filter(l => l.q > 0).pop(); res[deg] = { wc: P.wc, sg: P.glass.v, sf: P.frameSig, sum: P.sumR / (P.q * 4 * mm.M.a * mm.M.b), its: r.its, ok: r.ok }; }
  check('Denge: Σ mesnet tepkisi = toplam yük', Math.abs(res[10].sum - 1) < 0.002, `${(res[10].sum * 100).toFixed(3)} %`);
  check('Yakınsama: sehim (derece 10 ↔ 12)', Math.abs(pct(res[10].wc, res[12].wc)) < 2, `${res[8].wc.toFixed(2)} / ${res[10].wc.toFixed(2)} / ${res[12].wc.toFixed(2)} mm`);
  check('Yakınsama: cam gerilmesi (10 ↔ 12)', Math.abs(pct(res[10].sg, res[12].sg)) < 5, `${res[8].sg.toFixed(1)} / ${res[10].sg.toFixed(1)} / ${res[12].sg.toFixed(1)} MPa`);
  check('Yakınsama: çerçeve gerilmesi (10 ↔ 12)', Math.abs(pct(res[10].sf, res[12].sf)) < 8, `${res[8].sf.toFixed(0)} / ${res[10].sf.toFixed(0)} / ${res[12].sf.toFixed(0)} MPa`);
  check('Newton tüm yük adımlarında yakınsadı', res[10].ok && res[12].ok, `${res[10].its} iterasyon`);
}

console.log(`\n${nOk} geçti, ${nBad} kaldı`);
process.exit(nBad ? 1 : 0);
