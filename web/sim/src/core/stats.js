// ─────────────────────────────────────────
//  İSTATİSTİK / RAPOR HESAPLARI
// ─────────────────────────────────────────
// Canlı göstergeler, OEE, vardiya raporu ve depo raporu için saf fonksiyonlar.
// Sadece okur; motoru ya da yerleşimi değiştirmez. Süreler ısınma sonrası (engine.statsTime).
import { categoryOf } from './catalog.js';

// Beklenen (ortalama) çevrim: senaryo ağırlıklı ya da dağılımın ortalaması
export function expectedCycle(s) {
  const sc = s.cycle_scenarios;
  if (sc?.length) {
    let wsum = 0, csum = 0;
    for (const x of sc) {
      const w = Math.max(0, x.probability);
      wsum += w;
      csum += w * x.cycle_time;
    }
    return wsum > 0 ? csum / wsum : s.cycle_time;
  }
  const base = s.cycle_time;
  switch (s.cycle_dist) {
    case 'uniform': return (s.cycle_min + s.cycle_max) / 2;
    case 'triangular': return (Math.min(s.cycle_min, base) + Math.max(s.cycle_max, base) + base) / 3;
  }
  return base;
}

// Layup'ı besleyen stringer'lar (arada yalnızca buffer olabilir)
export function upstreamStringers(layout, layupId) {
  const found = [];
  const seen = new Set([layupId]);
  const stack = [layupId];
  while (stack.length) {
    const id = stack.pop();
    for (const c of layout.incoming(id)) {
      if (seen.has(c.from_id)) continue;
      seen.add(c.from_id);
      const src = layout.stations.get(c.from_id);
      if (src.kind === 'stringer') found.push(src);
      else if (categoryOf(src) === 'buffer') stack.push(src.id);
    }
  }
  return found;
}

// Efektif cycle: istasyonun 1 panel çıkarması için gereken ortalama süre (sn)
// Tamire gönderen testte panelin tekrar teste gelme payı (tamirden dönüş ek yükü):
// NG gelen × yakalama + sağlam gelen × yanlış ret
export function reinspectShare(s) {
  if (s.defect_action !== 'rework') return 0;
  const ng = (100 - (s.fpy ?? 100)) / 100;
  return ng * (s.detect_rate ?? 0) / 100 + (1 - ng) * (s.false_reject ?? 0) / 100;
}

export function effectiveCycle(layout, s) {
  const r = Math.max(1, s.num_resources);
  switch (categoryOf(s)) {
    case 'buffer': return 0;
    case 'curing': return s.cycle_time / Math.max(1, s.buffer_capacity);
    case 'inspection': return expectedCycle(s) / r * (1 + reinspectShare(s));
    case 'classification': return expectedCycle(s) / r;
  }
  if (s.kind === 'lamination') {
    // 1. oda, 2. oda boşalmadan yeni batch'i bırakamaz → yavaş olan oda belirler
    return Math.max(s.lam_room1_time, s.lam_room2_time) / Math.max(1, s.lam_batch_size) / r;
  }
  if (s.kind === 'layup') {
    const own = expectedCycle(s) / r;
    let stringRate = 0;   // string/sn
    for (const st of upstreamStringers(layout, s.id)) {
      const ct = expectedCycle(st);
      // NG stringler stringer'da ayrılır: layup'a yalnız sağlam stringler ulaşır
      if (ct > 0) stringRate += Math.max(1, st.num_resources) / ct * (1 - Math.min(100, st.string_ng ?? 0) / 100);
    }
    if (stringRate <= 0) return own;
    return Math.max(own, Math.max(1, s.strings_per_panel) / stringRate);
  }
  return expectedCycle(s) / r / Math.max(1, s.batch_size);
}

// Hat aşamaları: aynı tipte ve ortak komşusu olan istasyonlar paralel çalışır,
// tek aşama sayılır (ör. 2 çerçeveleme makinesi). Aşama cycle'ı = 1 / Σ(1/ECTᵢ).
// Layup'ı besleyen stringer'lar dışarıda kalır: birimleri panel değil string'dir,
// etkileri layup'ın efektif cycle'ında zaten var. Tamir istasyonu ana akışta değildir.
export function lineStages(layout) {
  const stringerIds = new Set();
  for (const s of layout.stations.values()) {
    if (s.kind === 'layup') upstreamStringers(layout, s.id).forEach(st => stringerIds.add(st.id));
  }
  const cands = [...layout.stations.values()].filter(
    s => categoryOf(s) !== 'buffer' && s.kind !== 'rework' && !stringerIds.has(s.id));

  const neighbors = new Map(cands.map(s => [s.id, new Set([
    ...layout.incoming(s.id).map(c => `i${c.from_id}`),
    ...layout.outgoing(s.id).map(c => `o${c.to_id}`),
  ])]));
  const parent = new Map(cands.map(s => [s.id, s.id]));
  const find = id => {
    while (parent.get(id) !== id) id = parent.get(id);
    return id;
  };
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i], b = cands[j];
      if (a.kind !== b.kind) continue;
      const nb = neighbors.get(b.id);
      if ([...neighbors.get(a.id)].some(k => nb.has(k))) parent.set(find(b.id), find(a.id));
    }
  }

  const groups = new Map();
  for (const s of cands) {
    const root = find(s.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(s);
  }
  return [...groups.values()].map(stations => {
    const rate = stations.reduce((a, s) => {
      const ect = effectiveCycle(layout, s);
      return a + (ect > 0 ? 1 / ect : 0);
    }, 0);
    return { stations, ect: rate > 0 ? 1 / rate : 0 };
  });
}

export function lineBottleneck(layout) {
  let best = null;
  for (const st of lineStages(layout)) {
    if (st.ect > 0 && (!best || st.ect > best.ect)) best = st;
  }
  return best;
}

const stageName = st => st.stations.map(s => s.name).join(' + ');

// Kullanım oranı: buffer/kürlemede ortalama doluluk, laminasyonda 1. oda doluluğu
function utilization(engine, s) {
  const t = engine.statsTime;
  if (t <= 0) return 0;
  const rt = engine.stationRuntime(s.id);
  const cat = categoryOf(s);
  const slots = cat === 'buffer' || cat === 'curing' || s.kind === 'lamination'
    ? 1 : Math.max(1, s.num_resources);
  return Math.min(100, rt.busyTime / (t * slots) * 100);
}

// OEE = Kullanılabilirlik × Performans × Kalite (buffer/kürleme için yok)
//   planlı süre   = toplam − vardiya dışı − mola − kullanıcı durdurması
//   çalışma süresi = planlı − arıza − bakım − ayar
//   performans    = işlenen × ideal süre / (çalışma süresi × kaynak)
//   kalite        = (işlenen − hurda − red) / işlenen
export function stationOEE(engine, s) {
  const cat = categoryOf(s);
  if (cat === 'buffer' || cat === 'curing') return null;
  const rt = engine.stationRuntime(s.id);
  const g = k => rt.stateTime[k] ?? 0;
  const planned = engine.statsTime - g('offshift') - g('break') - g('paused');
  const operating = Math.max(0, planned - g('down') - g('maint') - g('setup'));
  const lam = s.kind === 'lamination';
  const ideal = lam ? Math.max(s.lam_room1_time, s.lam_room2_time) / Math.max(1, s.lam_batch_size)
    : expectedCycle(s) / (cat === 'process' && s.kind !== 'layup' ? Math.max(1, s.batch_size) : 1);
  const slots = lam ? 1 : Math.max(1, s.num_resources);
  const A = planned > 0 ? operating / planned : 0;
  const P = operating > 0 ? Math.min(1, rt.processed * ideal / (operating * slots)) : 0;
  const Q = rt.processed > 0 ? Math.max(0, rt.processed - rt.scrapped - rt.rejected) / rt.processed : 1;
  return { A, P, Q, oee: A * P * Q, planned, operating };
}

function percentile(samples, q) {
  if (!samples.length) return 0;
  const a = [...samples].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * a.length))];
}

// ── Canlı göstergeler ──
export function liveStats(layout, engine) {
  const t = engine.statsTime;
  const planned = Math.max(0, t - engine.lineTime.off);
  const bn = lineBottleneck(layout);
  const theoretical = bn ? 3600 / bn.ect : 0;
  const rate = t > 0 ? engine.totalCompleted / t * 3600 : 0;
  const plannedRate = planned > 0 ? engine.totalCompleted / planned * 3600 : 0;
  const L = engine.lead;
  return {
    time: engine.time,
    statsTime: t,
    plannedTime: planned,
    warmup: engine.time < engine.statsT0,
    completed: engine.totalCompleted,
    wip: engine.products.size,
    ratePerHour: rate,
    plannedRatePerHour: plannedRate,
    theoreticalPerHour: theoretical,
    // Hat verimi: planlı sürede gerçek hız / darboğazın teorik hızı
    lineEfficiency: theoretical > 0 ? Math.min(100, plannedRate / theoretical * 100) : 0,
    scrapped: engine.scrapped,
    scrapBy: { ...engine.scrapBy },
    stringScrap: engine.stringScrap,
    stringScrapBy: { ...engine.stringScrapBy },
    escaped: engine.escaped,
    gradeB: engine.gradeB,
    gradeA: engine.totalCompleted - engine.gradeB,
    // A kalite oranı: tamamlananların A kalite payı
    aRate: engine.totalCompleted > 0 ? (engine.totalCompleted - engine.gradeB) / engine.totalCompleted * 100 : 0,
    firstPassYield: engine.totalCompleted > 0 ? engine.firstPass / engine.totalCompleted * 100 : 0,
    yield: engine.totalCompleted + engine.scrapped > 0
      ? engine.totalCompleted / (engine.totalCompleted + engine.scrapped) * 100 : 0,
    lead: {
      n: L.n,
      avg: L.n ? L.sum / L.n : 0,
      min: L.n ? L.min : 0,
      max: L.max,
      p50: percentile(L.samples, 0.5),
      p90: percentile(L.samples, 0.9),
    },
    operators: { used: engine.opsUsed, pool: engine.operatorPool() },
    pallets: engine.warehouse.length - engine.palletsAtStart,
    materials: layout.materials.map(m => {
      const st = engine.stock.get(m.id);
      return { id: m.id, name: m.name, unit: m.unit, stock: st?.stock ?? 0,
               onOrder: st ? st.orders.reduce((a, o) => a + o.qty, 0) : 0,
               reorderPoint: m.reorder_point };
    }),
    bottleneck: bn && { ids: bn.stations.map(s => s.id), name: stageName(bn), ect: bn.ect },
    stations: [...layout.stations.values()].map(s => {
      const rt = engine.stationRuntime(s.id);
      return {
        id: s.id, name: s.name, kind: s.kind, category: categoryOf(s),
        status: engine.stationStatus(s.id),
        processed: rt.processed,
        utilization: utilization(engine, s),
        queue: rt.queue.length,
        wip: engine.stationWip(s.id),
        scenarioHits: { ...rt.scenarioHits },
        stateTime: { ...rt.stateTime },
        scrapped: rt.scrapped,
        rejected: rt.rejected,
        reworked: rt.reworked,
        defectsMade: rt.defectsMade,
        firstSeen: rt.firstSeen,
        firstNG: rt.firstNG,
        firstRejected: rt.firstRejected,
        missed: rt.missed,
        falseRejects: rt.falseRejects,
        downgraded: rt.downgraded,
        stringNG: rt.stringNG,
        noDefect: rt.noDefect,
        failures: rt.failures,
        oee: stationOEE(engine, s),
        ect: effectiveCycle(layout, s),
      };
    }),
  };
}

// ── Vardiya raporu ── (Python: _build_shift_report)
export function shiftReport(layout, engine, refId, hours) {
  const ref = layout.stations.get(refId);
  if (!ref) return null;
  const shiftSec = hours * 3600;
  const bn = lineBottleneck(layout);
  const bnIds = new Set(bn ? bn.stations.map(s => s.id) : []);
  const refEct = effectiveCycle(layout, ref);
  const t = engine.statsTime;

  const rows = [...layout.stations.values()]
    .filter(s => categoryOf(s) !== 'buffer')
    .map(s => {
      const ect = effectiveCycle(layout, s);
      const processed = engine.stationRuntime(s.id).processed;
      const realRate = t > 0 ? processed / t * 3600 : 0;
      return {
        id: s.id, name: s.name, kind: s.kind,
        cycle: s.cycle_time, resources: s.num_resources, ect,
        capHour: ect > 0 ? 3600 / ect : 0,
        capShift: ect > 0 ? Math.floor(shiftSec / ect) : 0,
        isRef: s.id === refId, isBottleneck: bnIds.has(s.id),
        processed, realRate, realShift: Math.floor(realRate * hours),
      };
    });

  const thHourly = refEct > 0 ? 3600 / refEct : 0;
  const refProcessed = engine.stationRuntime(refId).processed;
  const simRate = t > 0 ? refProcessed / t * 3600 : 0;
  return {
    hours,
    ref: { id: ref.id, name: ref.name, ect: refEct },
    theoreticalHourly: thHourly,
    theoreticalShift: refEct > 0 ? Math.floor(shiftSec / refEct) : 0,
    bottleneck: bn && { ids: [...bnIds], name: stageName(bn), ect: bn.ect },
    rows,
    // Python'daki gibi en az 10 sn simülasyon verisi varsa gerçek değerler
    real: t > 10 ? {
      processed: refProcessed,
      ratePerHour: simRate,
      shiftProjection: Math.floor(simRate * hours),
      oee: thHourly > 0 ? Math.min(100, simRate / thHourly * 100) : 0,
    } : null,
  };
}

// ── Depo raporu ── (Python: _open_warehouse + _show_warehouse_report)
export function warehouseSummary(layout, engine) {
  const bins = new Map();   // hazne adı → satır
  for (const s of layout.stations.values()) {
    if (categoryOf(s) !== 'classification') continue;
    const counts = engine.stationRuntime(s.id).binCounts;
    s.bins.forEach((b, i) => {
      if (!bins.has(b.name)) bins.set(b.name, { name: b.name, pallets: 0, modules: 0, active: 0, capacity: b.capacity });
      bins.get(b.name).active += counts[i] ?? 0;
    });
  }
  for (const p of engine.warehouse) {
    if (!bins.has(p.bin_name)) bins.set(p.bin_name, { name: p.bin_name, pallets: 0, modules: 0, active: 0, capacity: p.count });
    const row = bins.get(p.bin_name);
    row.pallets++;
    row.modules += p.count;
  }
  const totalPallets = engine.warehouse.length;
  const rows = [...bins.values()].map(r => ({
    ...r, share: totalPallets > 0 ? r.pallets / totalPallets * 100 : 0 }));
  return {
    totalPallets,
    totalModules: rows.reduce((a, r) => a + r.modules, 0),
    bins: rows,
  };
}
