// ─────────────────────────────────────────
//  HAT YERLEŞİMİ (TASARIM VERİSİ) + .simjson
// ─────────────────────────────────────────
// Yerleşim = kullanıcının tasarladığı hat (istasyon, konveyör, ürün tipi, malzeme, vardiya).
// Simülasyonun çalışma anı durumu burada TUTULMAZ, engine.js'tedir.
// Alan adları .simjson dosyasındaki anahtarlarla aynıdır (snake_case) ki
// Python v2.0.0 ile aynı dosyalar iki yönlü açılabilsin (Python bilmediği alanları yok sayar).
import { catalogOf, PRODUCT_COLORS } from './catalog.js';

export const SIMJSON_VERSION = 7;

// 2D plan birimi (px, Python canvas'ı ile aynı) → 3D metre
export const DEFAULT_METERS_PER_PX = 0.1;

// Dosyaya yazılan / dosyadan okunan istasyon alanları (diziler ayrıca işlenir)
const STATION_SCALARS = [
  'name', 'x', 'y', 'kind', 'cycle_time', 'num_resources', 'batch_size', 'buffer_capacity', 'strings_per_panel',
  'lam_batch_size', 'lam_room1_time', 'lam_room2_time', 'lam_cooling_time', 'lam_feed_cap', 'lam_rooms',
  'lam_panels_per_room', 'rot',
  'cycle_dist', 'cycle_sd', 'cycle_min', 'cycle_max', 'queue_cap', 'arrival_interval',
  'mtbf_min', 'mttr_min', 'pm_interval_h', 'pm_duration_min', 'setup_time',
  'scrap_rate', 'defect_rate', 'detect_rate', 'false_reject', 'defect_action',
  'rework_success', 'max_rework', 'operators',
];

export function createStation(id, kind, x, y) {
  const info = catalogOf(kind);
  const s = {
    id, name: `${info.name}-${id}`, x, y, kind,
    cycle_time: info.cycle,
    num_resources: 1,
    batch_size: 1,
    buffer_capacity: 50,
    cycle_scenarios: [],          // [{name, probability(0–100), cycle_time}]
    bins: [],                     // sınıflandırma hazneleri [{name, probability, capacity, current}]
    strings_per_panel: 12,        // layup: kaç string = 1 panel
    // Laminasyon parametreleri
    lam_batch_size: 6,
    lam_room1_time: 900,
    lam_room2_time: 600,
    lam_cooling_time: 330,
    lam_feed_cap: 12,
    lam_rooms: 2,                 // eski alanlar (dosya uyumluluğu)
    lam_panels_per_room: 6,
    rot: null,                    // 3D yön (derece); null → akış yönünden otomatik
    // ── Gelişmiş parametreler (v7) ──
    cycle_dist: 'fixed',          // fixed | normal | triangular | uniform | exponential
    cycle_sd: 0,                  // normal: standart sapma (sn)
    cycle_min: 0,                 // üçgen / düzgün: alt sınır (sn)
    cycle_max: 0,                 // üçgen / düzgün: üst sınır (sn); üçgende tepe = cycle_time
    queue_cap: 0,                 // makine önü giriş tamponu (iş slotlarına ek, adet)
    arrival_interval: 0,          // giriş istasyonu: ham madde geliş aralığı (sn), 0 = sınırsız
    mtbf_min: 0,                  // arızalar arası ortalama çalışma süresi (dk), 0 = arıza yok
    mttr_min: 0,                  // ortalama onarım süresi (dk)
    pm_interval_h: 0,             // planlı bakım aralığı (saat), 0 = yok
    pm_duration_min: 0,           // planlı bakım süresi (dk)
    setup_time: 0,                // ürün tipi değişiminde ayar süresi (sn)
    scrap_rate: 0,                // % işlem sonunda hurdaya ayrılan
    defect_rate: 0,               // % gizli hata oluşan (testte yakalanır)
    detect_rate: 0,               // test: hatalı ürünü yakalama oranı (%)
    false_reject: 0,              // test: sağlam ürünü yanlışlıkla reddetme (%)
    defect_action: 'rework',      // test: yakalanan ürün → rework (hatalı ürün konveyörü) | scrap
    rework_success: 90,           // tamir: başarı oranı (%)
    max_rework: 2,                // tamir: ürün başına en fazla tamir
    operators: 0,                 // iş başına gereken operatör (0 = otomatik)
    consumes: [],                 // iş başına malzeme tüketimi [{material_id, qty}]
    ...structuredClone(info.defaults),
  };
  if (kind === 'buffer') s.cycle_time = 0;
  if (kind === 'curing') s.buffer_capacity = 20;
  if (kind === 'classification') {
    s.bins = Array.from({ length: 8 }, (_, i) => (
      { name: `Sınıf-${i + 1}`, probability: 100 / 8, capacity: 100, current: 0 }));
  }
  return s;
}

export function defaultSettings() {
  return {
    shifts_per_day: 3,            // 3 × 8 saat = kesintisiz
    shift_hours: 8,
    breaks: [],                   // her vardiyada [{name, at_min, dur_min}] (vardiya başından dakika)
    break_stops_all: false,       // false: molada sadece operatörlü istasyonlar durur
    operators: 0,                 // vardiyadaki operatör sayısı (0 = sınırsız)
    warmup_h: 0,                  // istatistiklerin sayılmaya başladığı süre (saat)
    target_rate: 0,               // hedef kapasite (modül/saat); hat dengesindeki takt için, 0 = yok
  };
}

export class Layout {
  constructor() {
    this.stations = new Map();     // id → istasyon
    this.conveyors = new Map();    // id → {id, from_id, to_id, cycle_time, capacity, type}
    this.productTypes = [];        // [{id, name, color, mix, cycle_overrides}]
    this.materials = [];           // [{id, name, unit, stock, reorder_point, reorder_qty, lead_time_h}]
    this.settings = defaultSettings();
    this.warehouse = [];           // dosyadan gelen depo kaydı [{bin_name, count, completed_at}]
    this.nextStationId = 1;
    this.nextConveyorId = 1;
    this.nextProductTypeId = 1;
    this.nextMaterialId = 1;
    this.meta = { metersPerPx: DEFAULT_METERS_PER_PX, name: '' };
    // Yapısal değişiklik sayacı: istasyon/konveyör ekle-sil-taşı ya da görünümü etkileyen
    // parametre değişince artar; motor ve 3D görünüm buna göre yeniden kurar.
    this.revision = 0;
  }

  touch() {
    this.revision++;
  }

  // Başka bir .simjson anlık görüntüsünü bu nesneye yerinde uygular (geri al / yinele).
  // Motor aynı Layout nesnesini tuttuğu için simülasyon sürer; silinen yerlerdeki ürünler düşer.
  restore(data) {
    const L = Layout.fromJSON(data);
    for (const k of ['stations', 'conveyors', 'productTypes', 'materials', 'settings', 'warehouse', 'meta',
                     'nextStationId', 'nextConveyorId', 'nextProductTypeId', 'nextMaterialId']) this[k] = L[k];
    this.revision++;
  }

  // ── İstasyon ──
  addStation(kind, x, y, props = {}) {
    const s = Object.assign(createStation(this.nextStationId++, kind, x, y), props);
    this.stations.set(s.id, s);
    this.revision++;
    return s;
  }

  removeStation(id) {
    if (!this.stations.delete(id)) return;
    for (const [cid, c] of this.conveyors) {
      if (c.from_id === id || c.to_id === id) this.conveyors.delete(cid);
    }
    this.revision++;
  }

  duplicateStation(id, dx = 60, dy = 60) {
    const src = this.stations.get(id);
    if (!src) return null;
    const { id: _, x, y, name, ...rest } = structuredClone(src);
    return this.addStation(src.kind, x + dx, y + dy, { ...rest, name: `${name} (kopya)` });
  }

  // ── Konveyör ──
  connect(fromId, toId, props = {}) {
    if (fromId === toId || !this.stations.has(fromId) || !this.stations.has(toId)) return null;
    if (this.conveyorBetween(fromId, toId)) return null;
    const c = { id: this.nextConveyorId++, from_id: fromId, to_id: toId, cycle_time: 5, capacity: 1, type: 'normal', ...props };
    this.conveyors.set(c.id, c);
    this.revision++;
    return c;
  }

  removeConveyor(id) {
    if (this.conveyors.delete(id)) this.revision++;
  }

  conveyorBetween(fromId, toId) {
    for (const c of this.conveyors.values()) {
      if (c.from_id === fromId && c.to_id === toId) return c;
    }
    return null;
  }

  outgoing(id) {
    return [...this.conveyors.values()].filter(c => c.from_id === id && this.stations.has(c.to_id));
  }

  incoming(id) {
    return [...this.conveyors.values()].filter(c => c.to_id === id && this.stations.has(c.from_id));
  }

  // Girişi olmayan istasyonlar ham madde girişidir. Hiç yoksa (kapalı döngü)
  // Python'daki gibi tüm istasyonlar giriş sayılır.
  entryStations() {
    const targets = new Set([...this.conveyors.values()].map(c => c.to_id));
    const entries = [...this.stations.values()].filter(s => !targets.has(s.id));
    return entries.length ? entries : [...this.stations.values()];
  }

  // ── Ürün tipi ──
  addProductType(name, color) {
    const idx = this.productTypes.length;
    const pt = {
      id: this.nextProductTypeId++,
      name: name ?? `Ürün ${String.fromCharCode(65 + idx)}`,
      color: color ?? PRODUCT_COLORS[idx % PRODUCT_COLORS.length],
      mix: 1,                     // ürün karışımındaki ağırlık
      cycle_overrides: {},        // {istasyon_id: cycle_sn}
    };
    this.productTypes.push(pt);
    return pt;
  }

  // ── Malzeme ──
  addMaterial(props = {}) {
    const m = { id: this.nextMaterialId++, name: `Malzeme ${this.materials.length + 1}`, unit: 'adet',
                stock: 1000, reorder_point: 200, reorder_qty: 1000, lead_time_h: 8, ...props };
    this.materials.push(m);
    return m;
  }

  removeMaterial(id) {
    this.materials = this.materials.filter(m => m.id !== id);
    for (const s of this.stations.values()) s.consumes = s.consumes.filter(c => c.material_id !== id);
  }

  // ── .simjson ──
  // engine verilirse sınıflandırma haznelerinin doluluğu ve depo da yazılır
  // (Python'daki "Kaydet" davranışı).
  toJSON(engine = null) {
    const binCurrent = (s, i) => {
      const counts = engine?.stationRuntime(s.id)?.binCounts;
      return counts ? (counts[i] ?? 0) : (s.bins[i].current ?? 0);
    };
    return {
      version: SIMJSON_VERSION,
      meta: { meters_per_px: this.meta.metersPerPx, ...(this.meta.name ? { name: this.meta.name } : {}) },
      settings: structuredClone(this.settings),
      next_station_id: this.nextStationId,
      next_conveyor_id: this.nextConveyorId,
      next_product_type_id: this.nextProductTypeId,
      next_material_id: this.nextMaterialId,
      stations: [...this.stations.values()].map(s => ({
        id: s.id,
        ...Object.fromEntries(STATION_SCALARS.map(k => [k, s[k]])),
        cycle_scenarios: s.cycle_scenarios.map(sc => ({
          name: sc.name, probability: sc.probability, cycle_time: sc.cycle_time })),
        bins: s.bins.map((b, i) => ({
          name: b.name, probability: b.probability, capacity: b.capacity, current: binCurrent(s, i) })),
        consumes: s.consumes.map(c => ({ material_id: c.material_id, qty: c.qty })),
      })),
      conveyors: [...this.conveyors.values()].map(c => ({
        id: c.id, from_id: c.from_id, to_id: c.to_id, cycle_time: c.cycle_time, capacity: c.capacity, type: c.type })),
      product_types: this.productTypes.map(pt => ({
        id: pt.id, name: pt.name, color: pt.color, mix: pt.mix, cycle_overrides: { ...pt.cycle_overrides } })),
      materials: this.materials.map(m => ({ ...m })),
      warehouse: (engine ? engine.warehouse : this.warehouse).map(p => ({
        bin_name: p.bin_name, count: p.count, completed_at: p.completed_at })),
    };
  }

  // Python v5, v6 ve v7 dosyalarını okur.
  static fromJSON(data) {
    const L = new Layout();
    L.meta.metersPerPx = data.meta?.meters_per_px ?? DEFAULT_METERS_PER_PX;
    L.meta.name = data.meta?.name ?? '';
    Object.assign(L.settings, structuredClone(data.settings ?? {}));

    for (const sd of data.stations ?? []) {
      const s = createStation(sd.id, sd.kind ?? 'stringer', sd.x, sd.y);
      for (const key of STATION_SCALARS) {
        if (sd[key] !== undefined) s[key] = sd[key];
      }
      s.cycle_scenarios = (sd.cycle_scenarios ?? []).map(sc => ({
        name: sc.name, probability: sc.probability, cycle_time: sc.cycle_time }));
      // Python dosyadaki hazneleri boş listeye ekler; dosyada varsa varsayılanların yerine geçer
      if (sd.bins !== undefined) {
        s.bins = sd.bins.map(b => ({
          name: b.name, probability: b.probability, capacity: b.capacity, current: b.current ?? 0 }));
      }
      s.consumes = (sd.consumes ?? []).map(c => ({ material_id: c.material_id, qty: c.qty }));
      L.stations.set(s.id, s);
    }

    for (const cd of data.conveyors ?? []) {
      L.conveyors.set(cd.id, {
        id: cd.id, from_id: cd.from_id, to_id: cd.to_id,
        cycle_time: cd.cycle_time, capacity: cd.capacity ?? 1, type: cd.type ?? 'normal' });
    }

    for (const pd of data.product_types ?? []) {
      L.productTypes.push({
        id: pd.id, name: pd.name, color: pd.color, mix: pd.mix ?? 1,
        cycle_overrides: { ...(pd.cycle_overrides ?? {}) } });
    }
    L.materials = (data.materials ?? []).map(m => ({ ...m }));

    L.warehouse = (data.warehouse ?? []).map(w => ({
      bin_name: w.bin_name, count: w.count, completed_at: w.completed_at }));

    // Sayaçlar dosyada eksik/hatalı olsa bile mevcut id'lerin üstünde kalsın
    const maxId = ids => ids.reduce((m, v) => Math.max(m, v), 0);
    L.nextStationId = Math.max(data.next_station_id ?? 1, maxId([...L.stations.keys()]) + 1);
    L.nextConveyorId = Math.max(data.next_conveyor_id ?? 1, maxId([...L.conveyors.keys()]) + 1);
    L.nextProductTypeId = Math.max(data.next_product_type_id ?? 1,
                                   maxId(L.productTypes.map(p => p.id)) + 1);
    L.nextMaterialId = Math.max(data.next_material_id ?? 1, maxId(L.materials.map(m => m.id)) + 1);
    return L;
  }
}

// Python'daki gibi "Ürün A" ile başlayan boş hat
export function createDefaultLayout() {
  const L = new Layout();
  L.addProductType('Ürün A', PRODUCT_COLORS[0]);
  return L;
}
