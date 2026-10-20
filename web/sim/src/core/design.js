// ─────────────────────────────────────────
//  HAT TASARIMI: akış sırası, otomatik yerleşim, hızlı ekleme, sihirbaz şablonu, hat dengesi
// ─────────────────────────────────────────
// Sıfırdan hat kurmanın yardımcıları. Hepsi Layout üzerinde çalışır (arayüzden bağımsız):
//   flowRanks      istasyonların akıştaki sütunu (en uzun yol; döngü ve tamir hattı yok sayılır)
//   autoArrange    akışa göre serpantin yerleşim, paralel makineler alt alta, tamir istasyonları yanda
//   insertAfter    seçili istasyonun sonrasına yeni istasyon (ardılları yeni istasyona bağlanır)
//   addParallel    aynı bağlantılarla paralel makine
//   buildLine      sihirbaz: süreç adımları + makine sayıları → bağlı ve yerleşmiş hat
//   lineBalance    takt, aşama çevrimleri, darboğaz, denge oranı
import { catalogOf, PRODUCT_COLORS } from './catalog.js';
import { Layout } from './layout.js';
import { lineStages, expectedCycle } from './stats.js';
import { addStandardBOM } from './bom.js';

const GAP = 3.5;          // ardışık istasyonlar arası konveyör boşluğu (m)
const STACK_GAP = 2.5;    // paralel makineler arası (m)
const ROW_GAP = 8;        // serpantin satırları arası (m)
const ROW_LEN = 80;       // hedef satır uzunluğu (m)
const MARGIN = 6;         // yerleşimin sol üst boşluğu (m)
const CONV = { cycle_time: 6, capacity: 1 };

const size = kind => { const [l, w] = catalogOf(kind).size; return { l, w }; };
const isDefect = c => c.type === 'defect';

// ── Akış sırası ──
export function flowRanks(layout) {
  const L = layout;
  const ids = [...L.stations.keys()];
  // Yan istasyon: yalnızca hatalı ürün konveyörüyle beslenen (tamir); kaynağının yanına konur
  const side = new Map();
  for (const id of ids) {
    const ins = L.incoming(id);
    if (ins.length && ins.every(isDefect)) side.set(id, ins[0].from_id);
  }
  const main = ids.filter(id => !side.has(id));
  const inMain = new Set(main);
  const succ = new Map(main.map(id => [id, []]));
  const pred = new Map(main.map(id => [id, []]));
  for (const c of L.conveyors.values()) {
    if (isDefect(c) || !inMain.has(c.from_id) || !inMain.has(c.to_id)) continue;
    succ.get(c.from_id).push(c.to_id);
    pred.get(c.to_id).push(c.from_id);
  }
  // Döngüleri kır: derinlik öncelikli aramada geri kenarlar sayılmaz
  const state = new Map(), back = new Set(), post = [];
  const visit = id => {
    state.set(id, 1);
    for (const n of succ.get(id)) {
      if (state.get(n) === 1) back.add(`${id}>${n}`);
      else if (!state.has(n)) visit(n);
    }
    state.set(id, 2);
    post.push(id);
  };
  for (const id of [...main.filter(id => !pred.get(id).length), ...main]) if (!state.has(id)) visit(id);
  const topo = post.reverse();
  const fwd = (a, b) => !back.has(`${a}>${b}`);
  const rank = new Map();
  for (const id of topo) rank.set(id, Math.max(0, ...pred.get(id).filter(p => fwd(p, id)).map(p => rank.get(p) + 1)));
  // Besleme kollarını birleştikleri yere yaklaştır (ör. cam → EVA → layup)
  for (const id of [...topo].reverse()) {
    const next = succ.get(id).filter(n => fwd(id, n)).map(n => rank.get(n));
    if (next.length) rank.set(id, Math.max(rank.get(id), Math.min(...next) - 1));
  }
  return { rank, side, topo };
}

// ── Otomatik yerleşim ──
export function autoArrange(layout, { rowLen = ROW_LEN } = {}) {
  const L = layout, m = L.meta.metersPerPx;
  const { rank, side, topo } = flowRanks(L);
  if (!topo.length) return;
  const cols = Array.from({ length: Math.max(...rank.values()) + 1 }, () => []);
  for (const id of topo) cols[rank.get(id)].push(id);
  const pred = id => L.incoming(id).filter(c => !isDefect(c)).map(c => c.from_id);
  // Sütun içi sıra: öncüllerin ortalama konumu (kesişmeleri azaltır)
  const slot = new Map();
  for (const col of cols) {
    const key = id => {
      const ps = pred(id).filter(p => slot.has(p));
      return ps.length ? ps.reduce((a, p) => a + slot.get(p), 0) / ps.length : Infinity;
    };
    col.sort((a, b) => key(a) - key(b) || a - b);
    col.forEach((id, i) => slot.set(id, i - (col.length - 1) / 2));
  }
  const kindOf = id => L.stations.get(id).kind;
  const colLen = cols.map(col => Math.max(...col.map(id => size(kindOf(id)).l)) + GAP);
  const colH = cols.map(col => col.reduce((a, id) => a + size(kindOf(id)).w, 0) + STACK_GAP * (col.length - 1));
  const sideOf = new Map();       // kaynak → yan istasyonlar
  for (const [id, src] of side) {
    if (!sideOf.has(src)) sideOf.set(src, []);
    sideOf.get(src).push(id);
  }

  // Serpantin: sütunları dengeli uzunlukta satırlara böl
  const total = colLen.reduce((a, b) => a + b, 0);
  const target = total / Math.max(1, Math.ceil(total / rowLen));
  const rows = [[]];
  let acc = 0;
  cols.forEach((col, c) => {
    if (acc > 0 && acc + colLen[c] / 2 > target) { rows.push([]); acc = 0; }
    rows.at(-1).push(c);
    acc += colLen[c];
  });

  const pos = new Map();          // id → [x, z] (m)
  let top = MARGIN, edge = MARGIN;
  rows.forEach((row, r) => {
    const h = Math.max(...row.map(c => colH[c]));
    const sideW = Math.max(0, ...row.flatMap(c => cols[c].flatMap(id => (sideOf.get(id) ?? []).map(s => size(kindOf(s)).w))));
    const zc = top + h / 2;
    const dir = r % 2 ? -1 : 1;
    let x = edge;
    for (const c of row) {
      const xc = x + dir * colLen[c] / 2;
      let z = zc - colH[c] / 2;
      for (const id of cols[c]) {
        const w = size(kindOf(id)).w;
        pos.set(id, [xc, z + w / 2]);
        z += w + STACK_GAP;
      }
      x += dir * colLen[c];
    }
    // Tamir istasyonları satırın alt bandında, kaynağının hizasında
    const band = zc + h / 2 + GAP + sideW / 2;
    const used = [];
    for (const c of row) for (const id of cols[c]) for (const s of sideOf.get(id) ?? []) {
      let sx = pos.get(id)[0];
      const half = size(kindOf(s)).l / 2 + 1;
      while (used.some(u => Math.abs(u - sx) < half * 2)) sx += dir * half;
      used.push(sx);
      pos.set(s, [sx, band]);
    }
    top += h + (sideW ? GAP + sideW : 0) + ROW_GAP;
    edge = x;                    // sonraki satır bu satırın bittiği uçtan geri döner
  });
  // Bağlantısız yan istasyonlar (kaynağı da yan) en alta
  for (const id of side.keys()) if (!pos.has(id)) { pos.set(id, [MARGIN, top]); top += size(kindOf(id)).w + STACK_GAP; }

  const minX = Math.min(...[...pos].map(([id, p]) => p[0] - size(kindOf(id)).l / 2));
  const shift = MARGIN - minX;
  for (const [id, [x, z]] of pos) {
    const s = L.stations.get(id);
    s.x = (x + shift) / m;
    s.y = z / m;
    s.rot = null;
  }
  L.touch();
}

// ── Konum yardımcıları ──
// Akış yönü (eksene oturtulmuş birim vektör): öncülden bu istasyona, yoksa bu istasyondan ardıla
export function flowDir(layout, s) {
  const L = layout;
  const p = L.incoming(s.id).find(c => !isDefect(c));
  const n = L.outgoing(s.id).find(c => !isDefect(c));
  let v = [1, 0];
  if (p) { const a = L.stations.get(p.from_id); v = [s.x - a.x, s.y - a.y]; }
  else if (n) { const b = L.stations.get(n.to_id); v = [b.x - s.x, b.y - s.y]; }
  if (!v[0] && !v[1]) return [1, 0];
  return Math.abs(v[0]) >= Math.abs(v[1]) ? [Math.sign(v[0]), 0] : [0, Math.sign(v[1])];
}

// İstasyonun yerdeki dikdörtgeni (m): uzun kenar akış yönünde
function box(layout, s, at = null, dir = null) {
  const m = layout.meta.metersPerPx;
  const { l, w } = size(s.kind);
  const d = dir ?? (s.rot != null ? (s.rot % 180 ? [0, 1] : [1, 0]) : flowDir(layout, s));
  const [hx, hz] = d[0] ? [l / 2, w / 2] : [w / 2, l / 2];
  const [x, z] = at ?? [s.x * m, s.y * m];
  return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
}

function overlaps(layout, kind, x, z, dir, skip = null) {
  const b = box(layout, { kind }, [x, z], dir);
  for (const s of layout.stations.values()) {
    if (s.id === skip) continue;
    const o = box(layout, s);
    if (b.x0 < o.x1 + 1 && b.x1 > o.x0 - 1 && b.z0 < o.z1 + 1 && b.z1 > o.z0 - 1) return true;
  }
  return false;
}

// Verilen noktada yer yoksa yana (akışa dik) kayarak ilk boş yer
function freeSpot(layout, kind, x, z, dir, step) {
  const perp = [-dir[1], dir[0]];
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const px = x + perp[0] * k * step, pz = z + perp[1] * k * step;
    if (!overlaps(layout, kind, px, pz, dir)) return [px, pz];
  }
  return [x, z];
}

function uniqueName(layout, base) {
  const names = new Set([...layout.stations.values()].map(s => s.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ── Sonrasına ekle ──
// Yeni istasyon seçilinin akış yönünde hemen ardına konur; seçilinin normal çıkışları yeni
// istasyondan çıkacak şekilde yeniden bağlanır (araya ekleme). Aynı sıradaki ardıllar yer açmak
// için kaydırılır.
export function insertAfter(layout, fromId, kind, props = {}) {
  const L = layout, from = L.stations.get(fromId);
  if (!from || !catalogOf(kind)) return null;
  const m = L.meta.metersPerPx;
  const dir = flowDir(L, from);
  const a = size(from.kind), b = size(kind);
  const fx = from.x * m, fz = from.y * m;
  const outs = L.outgoing(fromId).filter(c => !isDefect(c));
  if (outs.length) {
    // aynı hat üzerinde ileride kalan istasyonları yeni istasyon kadar it
    const push = b.l + GAP;
    for (const s of L.stations.values()) {
      if (s.id === fromId) continue;
      const dx = s.x * m - fx, dz = s.y * m - fz;
      const along = dx * dir[0] + dz * dir[1], across = Math.abs(dx * dir[1] - dz * dir[0]);
      if (along > 0.1 && across < Math.max(a.w, size(s.kind).w) / 2 + 1) {
        s.x += dir[0] * push / m;
        s.y += dir[1] * push / m;
      }
    }
  }
  const dist = a.l / 2 + GAP + b.l / 2;
  const [x, z] = freeSpot(L, kind, fx + dir[0] * dist, fz + dir[1] * dist, dir, b.w + STACK_GAP);
  const s = L.addStation(kind, x / m, z / m, { name: uniqueName(L, catalogOf(kind).name), ...props });
  for (const c of outs) c.from_id = s.id;
  L.connect(fromId, s.id, { ...CONV });
  L.touch();
  return s;
}

// ── Paralel makine ──
export function addParallel(layout, id) {
  const L = layout, src = L.stations.get(id);
  if (!src) return null;
  const m = L.meta.metersPerPx;
  const dir = flowDir(L, src);
  const { w } = size(src.kind);
  const [x, z] = freeSpot(L, src.kind, src.x * m, src.y * m, dir, w + STACK_GAP);
  const { id: _, x: _x, y: _y, name, ...rest } = structuredClone(src);
  const base = name.replace(/[\s-]*\d+$/, '').trim() || catalogOf(src.kind).name;
  if (!/\d$/.test(name)) src.name = `${base}-1`;
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  const n = Math.max(1, ...[...L.stations.values()].map(s => Number(re.exec(s.name)?.[1] ?? 0)));
  const s = L.addStation(src.kind, x / m, z / m, { ...rest, name: `${base}-${n + 1}` });
  for (const c of L.incoming(id)) L.connect(c.from_id, s.id, { cycle_time: c.cycle_time, capacity: c.capacity, type: c.type });
  for (const c of L.outgoing(id)) L.connect(s.id, c.to_id, { cycle_time: c.cycle_time, capacity: c.capacity, type: c.type });
  L.touch();
  return s;
}

// ──────────────────────────────────────
//  SİHİRBAZ ŞABLONU
// ──────────────────────────────────────
// Standart PV modül hattının süreç adımları (akış sırasıyla).
//   branch: cell (hücre hazırlık, birim string) · string (stringer) · glass (cam kolu → layup) · main
//   n: makine sayısı · cycle: makine başı çevrim (sn) · cap: kapasite (tampon / kür fırını)
//   batch: laminasyon partisi · rework: test sonrası tamir döngüsü · required: çıkarılamaz
export const PROCESS_STEPS = [
  { id: 'laser',    kind: 'cell_laser',     branch: 'cell',   name: 'Hücre lazer kesme',          on: true,  n: 1, cycle: 9 },
  { id: 'cellbuf',  kind: 'buffer',         branch: 'cell',   name: 'Hücre tamponu',              on: true,  cap: 30 },
  { id: 'stringer', kind: 'stringer',       branch: 'string', name: 'Stringer',                   on: true,  n: 3, cycle: 30, required: true },
  { id: 'glass',    kind: 'glass_loader',   branch: 'glass',  name: 'Cam yükleme',                on: true,  n: 1, cycle: 30 },
  { id: 'eva',      kind: 'eva_cutter',     branch: 'glass',  name: 'Ön EVA/POE serme',           on: true,  n: 1, cycle: 25 },
  { id: 'layup',    kind: 'layup',          branch: 'main',   name: 'Layup',                      on: true,  n: 1, cycle: 45, required: true },
  { id: 'ctape',    kind: 'cell_taping',    branch: 'main',   name: 'Hücre bantlama',             on: true,  n: 1, cycle: 20 },
  { id: 'busbar',   kind: 'auto_busbar',    branch: 'main',   name: 'Auto busbar',                on: true,  n: 1, cycle: 30 },
  { id: 'reva',     kind: 'rear_eva',       branch: 'main',   name: 'Arka EVA/POE serme',         on: true,  n: 1, cycle: 20 },
  { id: 'back',     kind: 'backsheet',      branch: 'main',   name: 'Arka cam / backsheet',       on: true,  n: 1, cycle: 20 },
  { id: 'elvi1',    kind: 'el_vi',          branch: 'main',   name: 'EL & VI (laminasyon öncesi)', on: true, n: 1, cycle: 40,
    rework: true, reworkName: 'Tamir (ön)', reworkCycle: 240 },
  { id: 'lambuf',   kind: 'buffer',         branch: 'main',   name: 'Laminasyon tamponu',         on: true,  cap: 12 },
  { id: 'lam',      kind: 'lamination',     branch: 'main',   name: 'Laminasyon',                 on: true,  n: 1, cycle: 330, batch: 6, required: true },
  { id: 'flip',     kind: 'flipper',        branch: 'main',   name: 'Panel çevirici',             on: false, n: 1, cycle: 8 },
  { id: 'trim',     kind: 'trimming',       branch: 'main',   name: 'Trimming',                   on: true,  n: 1, cycle: 20 },
  { id: 'etape',    kind: 'edge_taping',    branch: 'main',   name: 'Kenar bantlama',             on: true,  n: 1, cycle: 15 },
  { id: 'tremove',  kind: 'tape_removal',   branch: 'main',   name: 'Kenar bant sökme',           on: false, n: 1, cycle: 12 },
  { id: 'framebuf', kind: 'buffer',         branch: 'main',   name: 'Çerçeve tamponu',            on: true,  cap: 10 },
  { id: 'frame',    kind: 'framing',        branch: 'main',   name: 'Çerçeveleme',                on: true,  n: 2, cycle: 50 },
  { id: 'jbox',     kind: 'jbox',           branch: 'main',   name: 'Junction box',               on: true,  n: 1, cycle: 30 },
  { id: 'pot',      kind: 'potting',        branch: 'main',   name: 'Potting',                    on: true,  n: 1, cycle: 15 },
  { id: 'cure',     kind: 'curing',         branch: 'main',   name: 'Kürleme',                    on: true,  cycle: 1800, cap: 40 },
  { id: 'clean',    kind: 'cleaning',       branch: 'main',   name: 'Temizlik',                   on: true,  n: 1, cycle: 10 },
  { id: 'iv',       kind: 'iv_test',        branch: 'main',   name: 'IV / flash test',            on: true,  n: 1, cycle: 30 },
  { id: 'hipot',    kind: 'hipot',          branch: 'main',   name: 'Hi-Pot / izolasyon',         on: true,  n: 1, cycle: 25 },
  { id: 'elvi2',    kind: 'el_vi',          branch: 'main',   name: 'EL & VI (son)',              on: true,  n: 1, cycle: 40,
    rework: true, reworkName: 'Tamir (son)', reworkCycle: 600 },
  { id: 'fqc',      kind: 'fqc',            branch: 'main',   name: 'FQC',                        on: true,  n: 1, cycle: 35 },
  { id: 'label',    kind: 'labeling',       branch: 'main',   name: 'Etiketleme',                 on: true,  n: 1, cycle: 10 },
  { id: 'pack',     kind: 'packaging',      branch: 'main',   name: 'Paketleme',                  on: false, n: 1, cycle: 40 },
  { id: 'sort',     kind: 'classification', branch: 'main',   name: 'Sınıflandırma / paletleme',  on: true,  n: 1, cycle: 5, required: true },
];

export const defaultSteps = () => structuredClone(PROCESS_STEPS);

// Adımın kapasitesi (modül/saat); tamponda null. Hücre ve stringer birimi string → panel başına string'e bölünür.
export function stepRate(st, spp) {
  if (st.kind === 'buffer') return null;
  if (!(st.cycle > 0)) return Infinity;
  if (st.kind === 'curing') return Math.max(1, st.cap) * 3600 / st.cycle;
  const per = st.kind === 'lamination' ? Math.max(1, st.batch) : 1;
  const rate = Math.max(1, st.n) * per * 3600 / st.cycle;
  return st.branch === 'cell' || st.branch === 'string' ? rate / Math.max(1, spp) : rate;
}

// Hedef kapasiteye yetecek makine sayısı (kür fırınında kapasite)
export function suggestStep(st, target, spp) {
  if (st.kind === 'buffer' || !(target > 0) || !(st.cycle > 0)) return st;
  if (st.kind === 'curing') return { ...st, cap: Math.max(1, Math.ceil(target * st.cycle / 3600 - 1e-9)) };
  const one = stepRate({ ...st, n: 1 }, spp);
  return { ...st, n: Math.max(1, Math.ceil(target / one - 1e-9)) };
}

function stepProps(st, spp) {
  const p = { cycle_time: st.cycle };
  switch (st.kind) {
    case 'buffer': return { buffer_capacity: Math.max(1, st.cap) };
    case 'curing': return { ...p, buffer_capacity: Math.max(1, st.cap) };
    case 'layup': return { ...p, strings_per_panel: Math.max(1, spp) };
    case 'lamination': {
      const b = Math.max(1, st.batch);
      return { ...p, batch_size: b, lam_batch_size: b, lam_feed_cap: 2 * b, lam_room1_time: st.cycle,
               lam_room2_time: st.cycle, lam_cooling_time: Math.round(st.cycle * 0.75) };
    }
  }
  return p;
}

// Sihirbaz: seçilen adımlardan bağlı ve yerleşmiş hat
export function buildLine({ target = 60, spp = 6, shifts = 3, shiftHours = 8, product = 'Modül',
                            steps = defaultSteps(), bom = false, rowLen = ROW_LEN } = {}) {
  const L = new Layout();
  L.addProductType(product || 'Modül', PRODUCT_COLORS[0]);
  Object.assign(L.settings, { shifts_per_day: shifts, shift_hours: shiftHours, target_rate: target });
  const on = steps.filter(s => s.on || s.required);
  const make = st => {
    const k = st.kind === 'buffer' || st.kind === 'curing' ? 1 : Math.max(1, Math.round(st.n) || 1);
    return Array.from({ length: k }, (_, i) =>
      L.addStation(st.kind, 0, 0, { name: k > 1 ? `${st.name}-${i + 1}` : st.name, ...stepProps(st, spp) }).id);
  };
  const linkAll = (a, b) => a.forEach(x => b.forEach(y => L.connect(x, y, { ...CONV })));
  const chain = stages => stages.reduce((a, b) => (linkAll(a, b), b));
  const branch = name => on.filter(s => s.branch === name).map(make);
  const cell = branch('cell'), str = branch('string'), glass = branch('glass');
  const mainSteps = on.filter(s => s.branch === 'main');
  const main = mainSteps.map(make);
  if (!main.length) throw new Error('Hatta en az bir ana akış adımı olmalı');
  chain([...cell, ...str, main[0]]);
  if (glass.length) chain([...glass, main[0]]);
  if (main.length > 1) chain(main);
  mainSteps.forEach((st, i) => {
    if (catalogOf(st.kind).category !== 'inspection') return;
    for (const id of main[i]) L.stations.get(id).defect_action = st.rework ? 'rework' : 'scrap';
    if (!st.rework) return;
    const rw = L.addStation('rework', 0, 0, { name: st.reworkName ?? 'Tamir', cycle_time: st.reworkCycle ?? 300 });
    for (const id of main[i]) {
      L.connect(id, rw.id, { ...CONV, type: 'defect' });
      L.connect(rw.id, id, { ...CONV });
    }
  });
  if (bom) addStandardBOM(L);
  autoArrange(L, { rowLen });
  return L;
}

// ──────────────────────────────────────
//  HAT DENGESİ
// ──────────────────────────────────────
// Aşamalar akış sırasıyla; ect = aşamanın efektif çevrimi (sn/modül). takt = 3600 / hedef.
// Denge oranı = Σect / (aşama sayısı × en yavaş ect): 100 = tüm aşamalar eşit yüklü.
export function lineBalance(layout) {
  const { rank } = flowRanks(layout);
  const stages = lineStages(layout).filter(st => st.ect > 0).map(st => {
    const s0 = st.stations[0];
    const own = s0.kind === 'layup' ? expectedCycle(s0) / Math.max(1, s0.num_resources) : st.ect;
    return { ...st, rank: Math.min(...st.stations.map(s => rank.get(s.id) ?? 0)),
             stringLimited: s0.kind === 'layup' && st.ect > own + 1e-9 };
  }).sort((a, b) => a.rank - b.rank || a.stations[0].id - b.stations[0].id);
  const bottleneck = stages.reduce((a, s) => (!a || s.ect > a.ect ? s : a), null);
  const target = layout.settings.target_rate > 0 ? layout.settings.target_rate : 0;
  const sum = stages.reduce((a, s) => a + s.ect, 0);
  return {
    stages, bottleneck, target,
    takt: target ? 3600 / target : 0,
    capacity: bottleneck ? 3600 / bottleneck.ect : 0,
    balance: bottleneck ? sum / (stages.length * bottleneck.ect) * 100 : 0,
  };
}
