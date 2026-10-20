// ─────────────────────────────────────────
//  SİMÜLASYON MOTORU (headless)
// ─────────────────────────────────────────
// Python v2.0.0 _sim_loop mantığının JS karşılığı + seri üretim modeli. Çizimden tamamen
// bağımsızdır: 3D görünüm, raporlar ve testler aynı motoru okur.
//
// Tick sırası (Python ile aynı):
//   1. Takvim (vardiya/mola), malzeme teslimatları, giriş istasyonlarına ham madde
//   2. Konveyör teslimatı (varış süresi dolan ürün hedefe girer / bekler)
//   3. İstasyonlar: arıza/bakım, iş başlat (buffer, kürleme, sınıflandırma, laminasyon kendi akışında)
//   4. İşi biten ürünler: kalite (hurda / gizli hata / test / tamir) → çıkış
//      (en az yüklü hedef, eşitlikte round-robin; hatalı ürünler sadece "hatalı ürün" konveyöründen)
//   5. Durum süreleri, kullanım, saatlik seri
//
// Python'dan bilinçli farklar: docs/TASARIM.md §2. Varsayılan parametrelerle (arıza, hata,
// operatör, malzeme, mola yok) davranış 1. adımdaki motorla aynıdır.
import { categoryOf, defectField } from './catalog.js';
import { createRng } from './rng.js';

const EPS = 1e-9;
const DAY = 86400;
const LEAD_SAMPLES = 4000;     // yüzdelik hesabı için saklanan son lead time örnekleri
const FALLBACK_TYPE = { id: 1, name: 'Ürün', color: '#F472B6', mix: 1, cycle_overrides: {} };

const res = s => Math.max(1, s.num_resources | 0);
const jobItems = rt => rt.jobs.reduce((n, j) => n + j.items.length, 0);

function newStationRuntime(s) {
  return {
    paused: false,
    queue: [],          // istasyona girmiş, işlem bekleyen (buffer/kürleme stoku da burada)
    jobs: [],           // aktif işler: {items, start, setupUntil, doneTime, scenario, ops}
    outbox: [],         // işi bitmiş, çıkış bekleyen (Python: done_waiting)
    stringCount: 0,     // layup: biriken string
    stringFlags: [],    // layup: biriken stringlerin gizli hata durumu (FIFO; panele aktarılır)
    lamFeed: [],        // laminasyon: besleme alanı
    lamRoom1: null,     // {items, start, doneTime}
    lamRoom2: null,
    lamCooling: [],     // soğutmadaki paneller (doneTime üründe)
    binCounts: s.bins.map(() => 0),   // sınıflandırma haznelerinin anlık doluluğu
    // arıza / bakım / ayar
    downUntil: 0,       // arıza bitiş zamanı
    ttf: Infinity,      // bir sonraki arızaya kalan çalışma süresi (sn)
    pmDue: Infinity,    // bir sonraki planlı bakım zamanı
    pmPending: false,   // bakım zamanı geldi, süren işler bitince başlayacak
    pmUntil: 0,
    lastType: null,     // son işlenen ürün tipi (ayar süresi için)
    nextArrival: 0,     // giriş istasyonu: bir sonraki ham madde zamanı
    wait: null,         // bu tick iş başlatılamadıysa sebebi: no_operator | no_material
    state: 'idle',
    ...emptyStationStats(),
  };
}

// Isınma süresi sonunda sıfırlanan sayaçlar
function emptyStationStats() {
  return {
    processed: 0,
    busyTime: 0,        // kaynak·saniye (buffer/kürleme: doluluk·saniye)
    stateTime: {},      // durum → saniye
    scenarioHits: {},
    scrapped: 0,        // bu istasyonda hurdaya ayrılan
    rejected: 0,        // testte reddedilen (NG kararı)
    defectsMade: 0,     // bu istasyonda oluşan gizli hata
    reworked: 0,        // başarıyla tamir edilen
    failures: 0,
    // Test istasyonu (ilk geçiş = panelin bu istasyondan ilk geçişi; tamirden dönüş sayılmaz)
    firstSeen: 0,       // ilk geçişte gelen panel
    firstNG: 0,         // ilk geçişte gerçekten NG gelen
    firstRejected: 0,   // ilk geçişte NG kararı verilen
    missed: 0,          // NG olduğu hâlde geçirilen (kaçan)
    falseRejects: 0,    // sağlam olduğu hâlde NG sayılan
    downgraded: 0,      // B kaliteye düşürülen
    stringNG: 0,        // stringer: ayrılan NG string
    noDefect: 0,        // tamir: hata bulunamayan (yanlış ret) panel
  };
}

export class SimEngine {
  constructor(layout, { seed = 1, dt = 0.05 } = {}) {
    this.layout = layout;
    this.seed = seed;
    this.dt = dt;
    this._listeners = new Map();
    this.reset();
  }

  reset() {
    this.rng = createRng(this.seed);
    this.tick = 0;
    this.time = 0;
    this.products = new Map();     // sistemdeki tüm ürünler (id → ürün)
    this.nextProductId = 1;
    // Ömür boyu sayaçlar (korunum: created = completed + consumed + dropped + scrapped + sistemde)
    this.created = 0;              // oluşturulan ürün (giriş + layup paneli)
    this.consumed = 0;             // layup'ta panele dönüşen string
    this.dropped = 0;              // silinen istasyon/konveyörle sistemden düşen
    this.life = { completed: 0, scrapped: 0 };
    this.warehouse = [];           // tamamlanan paletler
    this.stock = new Map(this.layout.materials.map(m =>
      [m.id, { stock: m.stock, received: 0, orders: [] }]));   // malzeme → {stock, received, orders:[{qty, at}]}
    this.opsUsed = 0;              // iş başındaki operatör
    this._st = new Map();          // istasyon id → çalışma durumu
    this._cv = new Map();          // konveyör id → {items: [{prod, enterTime, arriveTime}]}
    this._forkLast = new Map();    // round-robin: kaynak id → son gönderilen hedef id
    this._topoRev = -1;
    this.cal = { off: false, brk: false };
    this.statsT0 = Math.max(0, (this.layout.settings.warmup_h ?? 0) * 3600);
    this._warmDone = this.statsT0 <= 0;
    this._resetStats();
  }

  // Raporların saydığı değerler (ısınma süresi bitince sıfırlanır)
  _resetStats() {
    this.totalCompleted = 0;
    this.firstPass = 0;            // hiç NG kararı/tamir görmeden A kalite tamamlanan
    this.escaped = 0;              // A kalite tamamlanan ama gerçekte NG (müşteriye kaçan)
    this.gradeB = 0;               // B kaliteye düşmüş tamamlanan
    this.scrapped = 0;             // hurdaya ayrılan panel (string hurdası ayrı)
    this.scrapBy = {};             // sebep → adet
    this.stringScrap = 0;          // hurdaya ayrılan string (stringer NG dahil)
    this.stringScrapBy = {};
    this.lead = { n: 0, sum: 0, min: Infinity, max: 0, samples: [] };
    this.lineTime = { off: 0 };    // vardiya dışı geçen süre
    this.series = [];              // saatlik: {h, completed, scrapped, wip, stock:{id: adet}}
    this.palletsAtStart = this.warehouse.length;
    for (const rt of this._st.values()) Object.assign(rt, emptyStationStats());
  }

  // ──────────────────────────────────────
  //  OLAYLAR (3D animasyon tetikleri için)
  // ──────────────────────────────────────
  // spawn | deliver | consume | start | finish | move | complete | pallet | scrap | failure
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type)?.delete(fn);
  }

  _emit(type, payload) {
    const ls = this._listeners.get(type);
    if (ls) for (const fn of ls) fn(payload);
  }

  // ──────────────────────────────────────
  //  DIŞ ARAYÜZ
  // ──────────────────────────────────────
  step() {
    this._syncTopology();
    this.tick++;
    this.time = this.tick * this.dt;
    if (!this._warmDone && this.time >= this.statsT0 - EPS) {
      this._warmDone = true;
      this._resetStats();
    }
    this._calendar();
    this._materials();
    this._feedEntries();
    this._deliverConveyors();
    for (const s of this.layout.stations.values()) this._processStation(s);
    for (const s of this.layout.stations.values()) this._finishJobs(s);
    this._accumulate();
  }

  advance(seconds) {
    const target = this.time + seconds;
    while (this.time + EPS < target) this.step();
  }

  // İstatistik süresi (ısınma hariç)
  get statsTime() {
    return Math.max(0, this.time - this.statsT0);
  }

  stationRuntime(id) {
    return this.layout.stations.has(id) ? this._rt(id) : null;
  }

  conveyorRuntime(id) {
    return this.layout.conveyors.has(id) ? this._cvRt(id) : null;
  }

  setPaused(id, paused) {
    const rt = this.stationRuntime(id);
    if (rt) rt.paused = paused;
  }

  // working | setup | blocked | idle | no_operator | no_material | down | maint | break | offshift | paused
  stationStatus(id) {
    const rt = this._st.get(id);
    if (!rt) return 'idle';
    return rt.paused ? 'paused' : rt.state;
  }

  // İstasyon içindeki toplam ürün (kuyruk + işlem + çıkış bekleyen + laminasyon bölgeleri)
  stationWip(id) {
    const rt = this._st.get(id);
    if (!rt) return 0;
    return rt.queue.length + jobItems(rt) + rt.outbox.length + rt.lamFeed.length
      + (rt.lamRoom1?.items.length ?? 0) + (rt.lamRoom2?.items.length ?? 0) + rt.lamCooling.length;
  }

  operatorPool() {
    const n = this.layout.settings.operators | 0;
    return n > 0 ? n : Infinity;
  }

  // ──────────────────────────────────────
  //  İÇ DURUM
  // ──────────────────────────────────────
  _rt(id) {
    let rt = this._st.get(id);
    if (!rt) {
      rt = newStationRuntime(this.layout.stations.get(id));
      this._st.set(id, rt);
    }
    return rt;
  }

  _cvRt(id) {
    let cr = this._cv.get(id);
    if (!cr) {
      cr = { items: [] };
      this._cv.set(id, cr);
    }
    return cr;
  }

  // Yerleşim değiştiyse komşuluk tablolarını yeniden kur, silinenlerdeki ürünleri düşür
  _syncTopology() {
    const L = this.layout;
    if (this._topoRev === L.revision) return;
    this._topoRev = L.revision;

    this._out = new Map();
    this._in = new Map();
    for (const c of L.conveyors.values()) {
      if (!L.stations.has(c.from_id) || !L.stations.has(c.to_id)) continue;
      if (!this._out.has(c.from_id)) this._out.set(c.from_id, []);
      if (!this._in.has(c.to_id)) this._in.set(c.to_id, []);
      this._out.get(c.from_id).push(c);
      this._in.get(c.to_id).push(c);
    }
    this._entries = L.entryStations();

    // Layup: string dışında bir kaynaktan besleniyorsa her panel için 1 altlık (cam + EVA) ister
    const stringSource = (id, seen = new Set()) => {
      const s = L.stations.get(id);
      if (s.kind === 'stringer') return true;
      const cat = categoryOf(s);
      if ((cat !== 'buffer' && cat !== 'curing') || seen.has(id)) return false;
      seen.add(id);
      const ins = this._in.get(id) ?? [];
      return ins.length > 0 && ins.every(c => stringSource(c.from_id, seen));
    };
    this._needsSubstrate = new Map();
    for (const s of L.stations.values()) {
      if (s.kind !== 'layup') continue;
      this._needsSubstrate.set(s.id, (this._in.get(s.id) ?? []).some(c => !stringSource(c.from_id)));
    }

    for (const m of L.materials) if (!this.stock.has(m.id)) this.stock.set(m.id, { stock: m.stock, received: 0, orders: [] });

    for (const [id, rt] of this._st) {
      if (L.stations.has(id)) continue;
      const all = [...rt.queue, ...rt.jobs.flatMap(j => j.items), ...rt.outbox, ...rt.lamFeed,
                   ...(rt.lamRoom1?.items ?? []), ...(rt.lamRoom2?.items ?? []), ...rt.lamCooling];
      all.forEach(p => this._drop(p));
      rt.jobs.forEach(j => { this.opsUsed -= j.ops; });
      this._st.delete(id);
    }
    for (const [id, cr] of this._cv) {
      if (L.conveyors.has(id)) continue;
      cr.items.forEach(it => this._drop(it.prod));
      this._cv.delete(id);
    }
  }

  _drop(p) {
    if (this.products.delete(p.id)) this.dropped++;
    p.state = 'dropped';
  }

  _newProduct(pt, stationId, isString) {
    const p = {
      id: this.nextProductId++, typeId: pt.id, color: pt.color, isString,
      state: 'queued', stationId, convId: null, fromId: null,
      createdAt: this.time, startTime: 0, doneTime: 0, bin: null,
      defective: false, rejected: false, route: null, reworkCount: 0,
      elec: false,         // elektriksel hata (yalnız IV / flash / Hi-Pot görür); defective: EL/görsel hata
      grade: 'A',          // A | B (testte NG bulunup tamir edilemeyen → B)
      flagged: false,      // herhangi bir testte NG kararı aldı mı (FPY dışı)
      laminated: false,    // laminasyondan geçti mi (sonrasında tamir yok)
      seen: null,          // ilk geçişi yapılmış test istasyonları
    };
    this.products.set(p.id, p);
    this.created++;
    return p;
  }

  // Ürün karışımına göre tip seç (ağırlıklar eşitse Python'daki gibi düz seçim)
  _pickType() {
    const types = this.layout.productTypes;
    if (!types.length) return FALLBACK_TYPE;
    const w = types.map(t => Math.max(0, t.mix ?? 1));
    if (w.every(v => v === w[0])) return this.rng.pick(types);
    return types[this.rng.weightedIndex(w)];
  }

  _chance(pct) {
    return pct > 0 && this.rng.next() * 100 < pct;
  }

  _exp(mean) {
    return -mean * Math.log(1 - this.rng.next());
  }

  _gauss() {
    const u = 1 - this.rng.next(), v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Çevrim süresi: senaryo listesi > dağılım > ürün tipi override'ı / sabit cycle
  _pickCycle(s, typeId) {
    const pt = this.layout.productTypes.find(p => p.id === typeId);
    const ov = pt?.cycle_overrides?.[s.id];
    const base = ov != null ? Number(ov) : s.cycle_time;
    const sc = s.cycle_scenarios;
    if (sc?.length) {
      const i = this.rng.weightedIndex(sc.map(x => x.probability));
      return [sc[i].cycle_time, sc[i].name];
    }
    switch (s.cycle_dist) {
      case 'normal':
        return [Math.max(0, base + (s.cycle_sd || 0) * this._gauss()), '—'];
      case 'uniform': {
        const a = Math.min(s.cycle_min, s.cycle_max), b = Math.max(s.cycle_min, s.cycle_max);
        return [a + (b - a) * this.rng.next(), '—'];
      }
      case 'triangular': {
        const a = Math.min(s.cycle_min, base), b = Math.max(s.cycle_max, base), c = base;
        if (b - a <= 0) return [base, '—'];
        const u = this.rng.next();
        const F = (c - a) / (b - a);
        return [u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)), '—'];
      }
      case 'exponential':
        return [this._exp(base), '—'];
    }
    return [base, '—'];
  }

  // ── Kapasite hesabı (tek nokta) ──
  // stok: istasyonda fiziksel olarak duran ürün. Stringer'ın çıkış bekleyen
  // stringleri Python'daki gibi sayılmaz (stringer üretmeye devam eder). Testte reddedilip
  // tamir yolunu bekleyen ürünler de sayılmaz: red rafında beklerler, istasyonu meşgul etmezler
  // (aksi halde test ↔ tamir döngüsü birbirini bekleyip kilitlenir).
  _stock(s, rt) {
    switch (categoryOf(s)) {
      case 'buffer': case 'curing': return rt.queue.length;
      case 'classification': return rt.queue.length + jobItems(rt);
    }
    if (s.kind === 'lamination') return rt.queue.length;
    let out = 0;
    if (s.kind !== 'stringer') for (const p of rt.outbox) if (p.route !== 'defect') out++;
    return rt.queue.length + jobItems(rt) + out;
  }

  _cap(s) {
    const extra = Math.max(0, s.queue_cap | 0);
    switch (categoryOf(s)) {
      case 'buffer': case 'curing': return Math.max(1, s.buffer_capacity);
      case 'classification': case 'inspection': return res(s) + extra;
    }
    if (s.kind === 'lamination') return 2 * Math.max(s.lam_batch_size, s.lam_feed_cap) + extra;
    if (s.kind === 'layup') return res(s) + extra;
    return res(s) * Math.max(1, s.batch_size) + extra;
  }

  _hasRoom(s, rt) {
    return this._stock(s, rt) < this._cap(s);
  }

  _inbound(id) {
    let n = 0;
    for (const c of this._in.get(id) ?? []) n += this._cvRt(c.id).items.length;
    return n;
  }

  // ──────────────────────────────────────
  //  1. TAKVİM, MALZEME, GİRİŞ
  // ──────────────────────────────────────
  // Gün 0:00'da başlar; vardiyalar arka arkaya. Molalar her vardiyanın başından dakika olarak.
  _calendar() {
    const st = this.layout.settings;
    const shiftLen = Math.max(0.01, st.shift_hours) * 3600;
    const workLen = Math.min(DAY, Math.max(1, st.shifts_per_day) * shiftLen);
    const td = this.time % DAY;
    const off = td >= workLen - EPS;
    const tm = (td % shiftLen) / 60;
    const brk = !off && (st.breaks ?? []).some(b => tm >= b.at_min && tm < b.at_min + b.dur_min);
    this.cal = { off, brk };
  }

  // Siparişi gelen malzemeyi stoğa ekle
  _materials() {
    for (const m of this.stock.values()) {
      while (m.orders.length && m.orders[0].at <= this.time + EPS) {
        const { qty } = m.orders.shift();
        m.stock += qty;
        m.received += qty;
      }
    }
  }

  // (s, Q) politikası: stok + yoldaki ≤ yeniden sipariş noktası ise sipariş ver
  _reorder(mat) {
    const m = this.stock.get(mat.id);
    if (!m || !(mat.reorder_qty > 0)) return;
    const position = m.stock + m.orders.reduce((a, o) => a + o.qty, 0);
    if (position <= mat.reorder_point) {
      m.orders.push({ qty: mat.reorder_qty, at: this.time + Math.max(0, mat.lead_time_h) * 3600 });
    }
  }

  // Ham madde sınırsız kabul edilir: giriş istasyonunda yer oldukça (ya da geliş aralığıyla) yeni ürün girer.
  _feedEntries() {
    for (const s of this._entries) {
      const rt = this._rt(s.id);
      if (rt.paused) continue;
      if (s.arrival_interval > 0) {
        if (this.time + EPS < rt.nextArrival || !this._hasRoom(s, rt)) continue;
        rt.nextArrival = this.time + s.arrival_interval;
        this._spawn(s, rt);
        continue;
      }
      while (this._hasRoom(s, rt)) this._spawn(s, rt);
    }
  }

  _spawn(s, rt) {
    const p = this._newProduct(this._pickType(), s.id, s.kind === 'stringer');
    this._enter(s, rt, p);
    this._emit('spawn', { station: s, product: p });
  }

  _enter(s, rt, p) {
    rt.queue.push(p);
    p.state = 'queued';
    p.stationId = s.id;
    p.convId = null;
  }

  // ──────────────────────────────────────
  //  2. KONVEYÖR TESLİMATI
  // ──────────────────────────────────────
  // Konveyör FIFO'dur; baştaki ürün hedefe giremiyorsa arkadakiler de bekler (backpressure).
  _deliverConveyors() {
    const T = this.time + EPS;
    for (const c of this.layout.conveyors.values()) {
      const cr = this._cv.get(c.id);
      if (!cr || !cr.items.length) continue;
      const t = this.layout.stations.get(c.to_id);
      if (!t) continue;
      while (cr.items.length && cr.items[0].arriveTime <= T) {
        if (!this._accept(t, cr.items[0].prod)) break;
        cr.items.shift();
      }
    }
  }

  _accept(t, p) {
    const rt = this._rt(t.id);
    // Layup'a gelen string ham maddedir: sayaca eklenir, ürün olarak tüketilir
    if (t.kind === 'layup' && p.isString) {
      rt.stringCount++;
      rt.stringFlags.push(p.defective);
      this.consumed++;
      this.products.delete(p.id);
      p.state = 'consumed';
      this._emit('consume', { station: t, product: p });
      return true;
    }
    if (!this._hasRoom(t, rt)) return false;
    this._enter(t, rt, p);
    this._emit('deliver', { station: t, product: p });
    return true;
  }

  // ──────────────────────────────────────
  //  3. İSTASYONLAR
  // ──────────────────────────────────────
  _processStation(s) {
    const rt = this._rt(s.id);
    rt.wait = null;
    const cat = categoryOf(s);
    if (cat === 'buffer') { if (!rt.paused) this._runBuffer(s, rt); return; }
    if (cat === 'curing') { if (!rt.paused) this._runCuring(s, rt); return; }
    this._reliability(s, rt);
    if (s.kind === 'lamination') return this._runLamination(s, rt);
    const gate = this._gate(s, rt);
    if (cat === 'classification') return this._runClassification(s, rt, gate);
    if (gate) return;
    if (s.kind === 'layup') this._startLayupPanels(s, rt);
    if (!(s.kind === 'layup' && this._needsSubstrate.get(s.id))) this._startJobs(s, rt);
  }

  // Yeni iş başlatmayı engelleyen durum (null = başlatabilir)
  _gate(s, rt) {
    if (rt.paused) return 'paused';
    if (this.time < rt.downUntil) return 'down';
    if (this.time < rt.pmUntil || rt.pmPending) return 'maint';
    if (this.cal.off) return 'offshift';
    if (this.cal.brk && (s.operators > 0 || this.layout.settings.break_stops_all)) return 'break';
    return null;
  }

  _running(s, rt) {
    return rt.jobs.length > 0 || !!rt.lamRoom1 || !!rt.lamRoom2;
  }

  // Arıza (çalışma süresine bağlı, üstel) ve planlı bakım. Arızada süren işler donar.
  _reliability(s, rt) {
    const dt = this.dt;
    if (this.time - dt < rt.downUntil) {           // bu tick arızalıydı: işler ilerlemesin
      for (const j of rt.jobs) { j.doneTime += dt; j.setupUntil += dt; j.items.forEach(p => { p.doneTime = j.doneTime; }); }
      for (const r of [rt.lamRoom1, rt.lamRoom2]) if (r) { r.doneTime += dt; r.start += dt; }
      return;
    }
    if (s.mtbf_min > 0) {
      if (!isFinite(rt.ttf)) rt.ttf = this._exp(s.mtbf_min * 60);
      if (this._running(s, rt)) {
        rt.ttf -= dt;
        if (rt.ttf <= 0) {
          rt.downUntil = this.time + this._exp(Math.max(0, s.mttr_min) * 60);
          rt.ttf = this._exp(s.mtbf_min * 60);
          rt.failures++;
          this._emit('failure', { station: s, until: rt.downUntil });
        }
      }
    } else {
      rt.ttf = Infinity;
    }
    if (s.pm_interval_h > 0 && s.pm_duration_min > 0) {
      if (!isFinite(rt.pmDue)) rt.pmDue = this.time + s.pm_interval_h * 3600;
      if (!rt.pmPending && this.time >= rt.pmDue) rt.pmPending = true;
      if (rt.pmPending && !this._running(s, rt)) {
        rt.pmPending = false;
        rt.pmUntil = this.time + s.pm_duration_min * 60;
        rt.pmDue += s.pm_interval_h * 3600;
      }
    } else {
      rt.pmDue = Infinity;
      rt.pmPending = false;
    }
  }

  // n ürünlük iş için operatör ve malzeme var mı? Yoksa bekleme sebebini yazar.
  _resourcesOk(s, rt, n) {
    const need = Math.max(0, s.operators | 0);
    if (need > 0 && this.operatorPool() - this.opsUsed < need) { rt.wait = 'no_operator'; return false; }
    for (const c of s.consumes) {
      const m = this.stock.get(c.material_id);
      if (m && m.stock < c.qty * n) { rt.wait = 'no_material'; return false; }
    }
    return true;
  }

  _takeResources(s, n) {
    const need = Math.max(0, s.operators | 0);
    this.opsUsed += need;
    for (const c of s.consumes) {
      const m = this.stock.get(c.material_id);
      if (!m) continue;
      m.stock -= c.qty * n;
      const mat = this.layout.materials.find(x => x.id === c.material_id);
      if (mat) this._reorder(mat);
    }
    return need;
  }

  _startJob(s, rt, items, typeId) {
    const ops = this._takeResources(s, items.length);
    const setup = s.setup_time > 0 && rt.lastType != null && rt.lastType !== typeId ? s.setup_time : 0;
    rt.lastType = typeId;
    const [cycle, scen] = this._pickCycle(s, typeId);
    const job = { items, start: this.time, setupUntil: this.time + setup, doneTime: this.time + setup + cycle,
                  scenario: scen, ops };
    rt.jobs.push(job);
    rt.scenarioHits[scen] = (rt.scenarioHits[scen] ?? 0) + 1;
    for (const p of items) {
      p.state = 'processing';
      p.stationId = s.id;
      p.startTime = this.time;
      p.doneTime = job.doneTime;
    }
    this._emit('start', { station: s, items, cycle, scenario: scen });
    return job;
  }

  // Normal / İnceleme: her kaynak aynı anda tek iş (1 ürün ya da 1 batch) yürütür
  _startJobs(s, rt) {
    const cat = categoryOf(s);
    const batch = cat === 'inspection' || s.kind === 'layup' ? 1 : Math.max(1, s.batch_size);
    let free = res(s) - rt.jobs.length;
    while (free > 0 && rt.queue.length >= batch) {
      if (!this._resourcesOk(s, rt, batch)) return;
      const items = rt.queue.splice(0, batch);
      this._startJob(s, rt, items, items[0].typeId);
      free--;
    }
  }

  // Layup: strings_per_panel kadar string birikince panel oluşur ve cycle süresince dizilir.
  // Altlık (cam + EVA) girişi varsa her panel bir altlığı tüketir (altlık panele dönüşür).
  // Masa, panel çıkış konveyörüne geçene kadar dolu sayılır.
  _startLayupPanels(s, rt) {
    const spp = Math.max(1, s.strings_per_panel);
    const needSub = this._needsSubstrate.get(s.id);
    while (rt.stringCount >= spp && rt.jobs.length + rt.outbox.length < res(s) && (!needSub || rt.queue.length)) {
      if (!this._resourcesOk(s, rt, 1)) return;
      rt.stringCount -= spp;
      let panel;
      if (needSub) {
        panel = rt.queue.shift();
      } else {
        panel = this._newProduct(this._pickType(), s.id, false);
      }
      // Hatalı (ör. mikro çatlaklı) string kullanılan panel de gizli hatalıdır
      if (rt.stringFlags.splice(0, spp).some(Boolean)) panel.defective = true;
      this._startJob(s, rt, [panel], panel.typeId);
    }
  }

  // Buffer: stoktaki ürünleri en az yüklü hedefe aktarır. Hedef meşgulken bir ürün
  // konveyörde hazır bekler (Python'da bu, istasyonların ekleniş sırasına bağlıydı;
  // hedef önce eklenmişse her çevrimde konveyör süresi kadar boşluk oluşuyordu).
  _runBuffer(s, rt) {
    this._dispatchFront(s, rt, rt.queue, () => true);
  }

  // Kürleme: her ürün içeride cycle_time kadar bekler, sonra sırayla çıkar
  _runCuring(s, rt) {
    const T = this.time + EPS;
    this._dispatchFront(s, rt, rt.queue, p => p.state === 'curing' && p.doneTime <= T);
    for (const p of rt.queue) {
      if (p.state !== 'queued') continue;
      p.state = 'curing';
      p.startTime = this.time;
      p.doneTime = this.time + s.cycle_time;
    }
  }

  // Sınıflandırma: hat sonu. Her ürün olasılığa göre bir hazneye düşer,
  // hazne kapasitesi dolunca palet depoya gider.
  _runClassification(s, rt, gate) {
    let free = gate ? 0 : res(s) - rt.jobs.length;
    while (free > 0 && rt.queue.length) {
      if (!this._resourcesOk(s, rt, 1)) break;
      const p = rt.queue.shift();
      this._startJob(s, rt, [p], p.typeId);
      free--;
    }
    const T = this.time + EPS;
    for (let i = 0; i < rt.jobs.length;) {
      const job = rt.jobs[i];
      if (job.doneTime > T) { i++; continue; }
      rt.jobs.splice(i, 1);
      this.opsUsed -= job.ops;
      for (const p of job.items) {
        rt.processed++;
        this._sortIntoBin(s, rt, p);
        this._complete(s, p);
      }
    }
  }

  // B kalite paneller B haznelerine (yoksa tüm haznelere), A kalite A haznelerine
  _sortIntoBin(s, rt, p) {
    if (!s.bins.length) return;
    while (rt.binCounts.length < s.bins.length) rt.binCounts.push(0);
    const want = p.grade === 'B' ? 'B' : 'A';
    let pool = s.bins.map((b, i) => i).filter(i => (s.bins[i].grade === 'B' ? 'B' : 'A') === want);
    if (!pool.length) pool = s.bins.map((b, i) => i);
    const i = pool[this.rng.weightedIndex(pool.map(j => s.bins[j].probability))];
    const b = s.bins[i];
    p.bin = b.name;
    rt.binCounts[i]++;
    if (rt.binCounts[i] >= Math.max(1, b.capacity)) {
      const pallet = { bin_name: b.name, count: b.capacity, completed_at: this.time, station_id: s.id };
      this.warehouse.push(pallet);
      rt.binCounts[i] = 0;
      this._emit('pallet', { station: s, pallet });
    }
  }

  // Laminasyon: Besleme → 1.Oda → 2.Oda → Soğutma → çıkış.
  // Adımlar tersten işlenir ki bir panel aynı tick'te tek bölge ilerlesin.
  _runLamination(s, rt) {
    const B = Math.max(1, s.lam_batch_size);
    const feedCap = Math.max(B, s.lam_feed_cap);
    const T = this.time + EPS;
    const down = this.time < rt.downUntil;

    // ADIM 4: soğuyan paneller sırayla çıkışa
    this._dispatchFront(s, rt, rt.lamCooling, p => p.doneTime <= T);
    if (down || rt.paused) return;

    // ADIM 3: 2. oda bittiyse paneller (kalite kontrolünden geçip) soğutmaya
    if (rt.lamRoom2 && rt.lamRoom2.doneTime <= T) {
      for (const p of rt.lamRoom2.items) {
        const q = this._quality(s, rt, p);
        if (q !== 'ok') { this._scrap(s, rt, p, q); continue; }
        p.laminated = true;
        p.state = 'lam_cooling';
        p.startTime = this.time;
        p.doneTime = this.time + s.lam_cooling_time;
        rt.lamCooling.push(p);
      }
      rt.lamRoom2 = null;
    }

    // ADIM 2: 1. oda bittiyse ve 2. oda boşsa aktar
    if (rt.lamRoom1 && rt.lamRoom1.doneTime <= T && !rt.lamRoom2) {
      rt.lamRoom2 = { items: rt.lamRoom1.items, start: this.time, doneTime: this.time + s.lam_room2_time };
      for (const p of rt.lamRoom2.items) {
        p.state = 'lam_room2';
        p.startTime = this.time;
        p.doneTime = rt.lamRoom2.doneTime;
      }
      this.opsUsed -= rt.lamRoom1.ops;
      rt.lamRoom1 = null;
    }

    // ADIM 1: 1. oda boşsa besleme alanından tam batch al
    if (!rt.lamRoom1 && rt.lamFeed.length >= B && !this._gate(s, rt) && this._resourcesOk(s, rt, B)) {
      const items = rt.lamFeed.splice(0, B);
      const ops = this._takeResources(s, B);
      const [, scen] = this._pickCycle(s, items[0].typeId);
      rt.scenarioHits[scen] = (rt.scenarioHits[scen] ?? 0) + 1;
      rt.lamRoom1 = { items, start: this.time, doneTime: this.time + s.lam_room1_time, ops };
      for (const p of items) {
        p.state = 'lam_room1';
        p.stationId = s.id;
        p.startTime = this.time;
        p.doneTime = rt.lamRoom1.doneTime;
      }
      this._emit('start', { station: s, items, cycle: s.lam_room1_time, scenario: scen });
    }

    // ADIM 0: giriş kuyruğundan besleme alanına
    while (rt.lamFeed.length < feedCap && rt.queue.length) {
      const p = rt.queue.shift();
      p.state = 'lam_feed';
      rt.lamFeed.push(p);
    }
  }

  // ──────────────────────────────────────
  //  4. İŞİ BİTENLER → KALİTE → ÇIKIŞ
  // ──────────────────────────────────────
  // Duraklatılmış istasyonda da biten iş çıkar (Python'daki gibi: duraklatma = yeni iş başlatma).
  _finishJobs(s) {
    const cat = categoryOf(s);
    if ((cat !== 'process' && cat !== 'inspection') || s.kind === 'lamination') return;
    const rt = this._st.get(s.id);
    if (!rt) return;
    const T = this.time + EPS;
    for (let i = 0; i < rt.jobs.length;) {
      const job = rt.jobs[i];
      if (job.doneTime > T) { i++; continue; }
      rt.jobs.splice(i, 1);
      this.opsUsed -= job.ops;
      rt.processed += job.items.length;
      for (const p of job.items) {
        if (s.kind === 'stringer') p.isString = true;   // hücre seti → string
        const q = this._quality(s, rt, p);
        if (q !== 'ok') { this._scrap(s, rt, p, q); continue; }
        p.state = 'done_waiting';
        rt.outbox.push(p);
      }
      this._emit('finish', { station: s, items: job.items });
    }
    this._dispatchFront(s, null, rt.outbox, () => true);
  }

  // Kalite: proses hurda/gizli hata üretir, test NG kararı verir, tamir düzeltir.
  // Dönüş: 'ok' ya da hurda sebebi ('process' | 'string_ng' | 'rejected' | 'rework').
  //   Test: ilk geçişte (100 − fpy)% olasılıkla panel burada NG çıkar (önceki gizli hatalara ek);
  //   NG panel detect_rate ile yakalanır, sağlam panel false_reject ile yanlışlıkla NG sayılır.
  //   NG kararı → tamir (yalnız laminasyon öncesi; tamir yolu yoksa hurda) | B kalite | hurda.
  //   B kaliteye düşmüş panel sonraki testlerde yeniden değerlendirilmez.
  _quality(s, rt, p) {
    const cat = categoryOf(s);
    if (cat === 'inspection') {
      if (p.isString) return 'ok';
      const f = defectField(s.kind);               // bu testin gördüğü hata türü
      const first = !(p.seen ??= new Set()).has(s.id);
      if (first) {
        p.seen.add(s.id);
        if (p.grade === 'A') {
          rt.firstSeen++;
          if (!p[f] && this._chance(100 - (s.fpy ?? 100))) p[f] = true;
          if (p[f]) rt.firstNG++;
        }
      }
      if (p.grade !== 'A') return 'ok';
      const ng = p[f];
      const caught = ng ? this._chance(s.detect_rate) : this._chance(s.false_reject);
      if (!caught) {
        if (ng) rt.missed++;
        return 'ok';
      }
      rt.rejected++;
      if (first) rt.firstRejected++;
      if (!ng) rt.falseRejects++;
      p.flagged = true;
      let action = s.defect_action;
      if (action === 'rework' && p.laminated) action = 'downgrade';      // laminasyon sonrası tamir yok
      if (action === 'rework' && !this._hasOut(s.id, 'defect')) action = 'scrap';
      if (action === 'downgrade') {
        p.grade = 'B';
        rt.downgraded++;
        return 'ok';
      }
      if (action === 'scrap') return 'rejected';
      p.rejected = true;
      p.route = 'defect';
      return 'ok';
    }
    if (s.kind === 'rework') {
      if (!p.rejected && !p.defective) return 'ok';
      p.reworkCount++;
      p.rejected = false;
      if (!p.defective) { rt.noDefect++; return 'ok'; }               // yanlış ret: hata yok, teste geri
      if (p.reworkCount > Math.max(0, s.max_rework) || !this._chance(s.rework_success)) return 'rework';
      p.defective = false;
      rt.reworked++;
      return 'ok';
    }
    if (s.kind === 'stringer' && this._chance(s.string_ng ?? 0)) {     // string kontrolü: NG string ayrılır
      rt.stringNG++;
      return 'string_ng';
    }
    if (this._chance(s.scrap_rate)) return 'process';
    if (!p.defective && this._chance(s.defect_rate)) {
      p.defective = true;
      rt.defectsMade++;
    }
    return 'ok';
  }

  _scrap(s, rt, p, reason) {
    rt.scrapped++;
    this.life.scrapped++;
    if (p.isString) {                  // string hurdası panel verimine karışmaz
      this.stringScrap++;
      this.stringScrapBy[reason] = (this.stringScrapBy[reason] ?? 0) + 1;
    } else {
      this.scrapped++;
      this.scrapBy[reason] = (this.scrapBy[reason] ?? 0) + 1;
    }
    this.products.delete(p.id);
    p.state = 'scrap';
    this._emit('scrap', { station: s, product: p, reason });
  }

  _hasOut(id, type) {
    return (this._out.get(id) ?? []).some(c => (c.type === 'defect') === (type === 'defect'));
  }

  // Listedeki hazır ürünleri sırayla gönderir; çıkışı olmayan istasyon hat sonudur.
  // Sağlam ve hatalı (tamir yolu) ürünler ayrı sıralardır: biri tıkalıyken diğeri akmaya devam eder.
  // rt verilirse gönderilen her ürün istasyonun processed sayacına eklenir.
  _dispatchFront(s, rt, list, ready) {
    let blocked = null;
    for (let i = 0; i < list.length;) {
      const p = list[i];
      if (!ready(p)) break;
      const type = p.route === 'defect' ? 'defect' : 'normal';
      if (blocked?.[type]) { i++; continue; }
      if (this._hasOut(s.id, type)) {
        const route = this._pickRoute(s, p, type);
        if (!route) {
          (blocked ??= {})[type] = true;
          i++;
          continue;
        }
        list.splice(i, 1);
        this._send(s, p, route);
      } else {
        list.splice(i, 1);
        this._complete(s, p);
      }
      if (rt) rt.processed++;
    }
  }

  // Akıllı yönlendirme: boş konveyörü olan hedeflerden yükü (stok + yoldaki) en az olan;
  // eşitlikte round-robin. Hedef doluysa ürün konveyörde bekler (backpressure).
  // Hatalı ürünler yalnızca "defect" tipli, sağlam ürünler yalnızca normal konveyörlerden gider.
  _pickRoute(s, p, type) {
    let best = [];
    let min = Infinity;
    for (const c of this._out.get(s.id) ?? []) {
      if ((c.type === 'defect') !== (type === 'defect')) continue;
      if (this._cvRt(c.id).items.length >= Math.max(1, c.capacity)) continue;
      const t = this.layout.stations.get(c.to_id);
      let load = 0;
      if (!(t.kind === 'layup' && p.isString)) {
        load = this._stock(t, this._rt(t.id)) + this._inbound(t.id);
      }
      if (load < min) { min = load; best = [{ t, c }]; }
      else if (load === min) best.push({ t, c });
    }
    if (!best.length) return null;
    if (best.length === 1) return best[0];
    const i = best.findIndex(b => b.t.id === this._forkLast.get(s.id));
    return best[i >= 0 ? (i + 1) % best.length : 0];
  }

  _send(s, p, { t, c }) {
    this._cvRt(c.id).items.push({ prod: p, enterTime: this.time, arriveTime: this.time + c.cycle_time });
    p.state = 'moving';
    p.convId = c.id;
    p.fromId = s.id;
    p.stationId = t.id;
    p.route = null;                    // tamir yoluna girdi; hedefte normal akışa döner
    this._forkLast.set(s.id, t.id);
    this._emit('move', { product: p, conveyor: c, from: s, to: t });
  }

  _complete(s, p) {
    this.totalCompleted++;
    this.life.completed++;
    if (p.grade === 'B') this.gradeB++;
    else {
      if (!p.reworkCount && !p.flagged) this.firstPass++;
      if (p.defective || p.elec) this.escaped++;
    }
    const lt = this.time - p.createdAt;
    const L = this.lead;
    L.n++;
    L.sum += lt;
    L.min = Math.min(L.min, lt);
    L.max = Math.max(L.max, lt);
    if (L.samples.length < LEAD_SAMPLES) L.samples.push(lt);
    else L.samples[L.n % LEAD_SAMPLES] = lt;
    this.products.delete(p.id);
    p.state = 'done';
    p.stationId = s.id;
    this._emit('complete', { station: s, product: p });
  }

  // ──────────────────────────────────────
  //  5. DURUM SÜRELERİ, KULLANIM, SERİ
  // ──────────────────────────────────────
  _accumulate() {
    const dt = this.dt;
    const counting = this._warmDone;
    if (counting && this.cal.off) this.lineTime.off += dt;
    const T = this.time + EPS;
    for (const s of this.layout.stations.values()) {
      const rt = this._st.get(s.id);
      if (!rt) continue;
      const cat = categoryOf(s);
      rt.state = this._stateOf(s, rt, cat, T);
      if (!counting) continue;
      rt.stateTime[rt.state] = (rt.stateTime[rt.state] ?? 0) + dt;
      if (cat === 'buffer' || cat === 'curing') {
        rt.busyTime += Math.min(1, rt.queue.length / Math.max(1, s.buffer_capacity)) * dt;
      } else if (s.kind === 'lamination') {
        if (rt.lamRoom1) rt.busyTime += dt;
      } else {
        rt.busyTime += rt.jobs.length * dt;
      }
    }
    // saatlik seri
    if (counting && Math.floor(this.statsTime / 3600 + EPS) > this.series.length) {
      this.series.push({
        h: this.series.length + 1,
        completed: this.totalCompleted,
        scrapped: this.scrapped,
        wip: this.products.size,
        stock: Object.fromEntries([...this.stock].map(([id, m]) => [id, m.stock])),
      });
    }
  }

  _stateOf(s, rt, cat, T) {
    if (rt.paused) return 'paused';
    if (cat === 'buffer') {
      return rt.queue.length >= s.buffer_capacity ? 'blocked' : rt.queue.length ? 'working' : 'idle';
    }
    if (cat === 'curing') {
      if (rt.queue.length && rt.queue[0].state === 'curing' && rt.queue[0].doneTime <= T) return 'blocked';
      return rt.queue.length ? 'working' : 'idle';
    }
    if (this.time < rt.downUntil) return 'down';
    if (this.time < rt.pmUntil) return 'maint';
    if (s.kind === 'lamination') {
      if (rt.lamRoom1 || rt.lamRoom2) return 'working';
      if (rt.lamCooling.length && rt.lamCooling[0].doneTime <= T) return 'blocked';
      if (rt.lamCooling.length) return 'working';
    } else if (rt.jobs.length) {
      return rt.jobs.some(j => this.time < j.setupUntil) ? 'setup' : 'working';
    } else if (rt.outbox.length) {
      return 'blocked';
    }
    if (rt.wait) return rt.wait;
    const gate = this._gate(s, rt);
    return gate && gate !== 'paused' ? gate : 'idle';
  }
}
