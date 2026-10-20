// ─────────────────────────────────────────
//  İSTASYON TİP KATALOĞU
// ─────────────────────────────────────────
// Python v2.0.0'daki 21 tip aynı ad/kategori/varsayılan cycle ile korunur; tam bir PV modül
// hattı için yeni tipler eklenmiştir (yeni = Python'da yok).
//   code     istasyon etiket kodu (ör. LAM-08)
//   group    editör paletindeki süreç grubu
//   size     3D gövde ölçüsü [uzunluk (akış yönü), genişlik, yükseklik] metre
//   defaults istasyon eklenirken tipe özel varsayılan parametreler
// kategori: process | inspection | buffer | curing | classification
const K = (code, name, group, category, cycle, size, extra = {}) =>
  ({ code, name, group, category, cycle, size, batch: false, icon: '', color: '#3F6D8E', defaults: {}, ...extra });

// Test varsayılanları: laminasyon öncesi EL → tamir; görsel / FQC → B kalite; elektriksel test → hurda
const INSPECT = { detect_rate: 100, defect_action: 'rework' };
const GRADE = { detect_rate: 100, defect_action: 'downgrade' };
const ELEC = { detect_rate: 100, defect_action: 'scrap' };

export const STATION_CATALOG = {
  // Hazırlık
  cell_laser:     K('LSR', 'Hücre Lazer Kesme',  'prep',   'process',    20,  [4.0, 2.6, 2.2]),                        // yeni
  glass_loader:   K('GLS', 'Cam Yükleme',        'prep',   'process',    12,  [4.0, 3.0, 2.4]),                        // yeni
  eva_cutter:     K('EVA', 'Ön EVA/POE Serme',   'prep',   'process',    15,  [4.5, 3.0, 2.0]),                        // yeni
  // Dizim
  stringer:       K('STR', 'Stringer',           'layup',  'process',    45,  [6.0, 2.4, 2.0], { icon: '🔗', color: '#2563EB' }),
  layup:          K('LAY', 'Layup / Dizim',      'layup',  'process',    60,  [4.5, 3.0, 2.2], { icon: '📐', color: '#0369A1' }),
  auto_busbar:    K('ABB', 'Auto Busbar',        'layup',  'process',    30,  [4.0, 2.6, 1.9], { icon: '⚡', color: '#1D4ED8' }),
  cell_taping:    K('CTP', 'Hücre Bantlama',     'layup',  'process',    18,  [3.0, 2.4, 1.7], { icon: '🩹', color: '#065F46' }),
  rear_eva:       K('REV', 'Arka EVA/POE Serme', 'layup',  'process',    15,  [4.5, 3.0, 2.0]),                        // yeni
  backsheet:      K('BSH', 'Arka Cam / Backsheet', 'layup', 'process',   15,  [4.5, 3.0, 2.2]),                        // yeni
  // Laminasyon
  lamination:     K('LAM', 'Laminasyon',         'lam',    'process',    900, [14.0, 3.2, 1.6], { icon: '🔥', color: '#B45309', batch: true }),
  flipper:        K('FLP', 'Panel Çevirici',     'lam',    'process',    8,   [3.2, 3.0, 2.0]),                        // yeni
  trimming:       K('TRM', 'Trimming',           'lam',    'process',    20,  [3.0, 2.6, 1.6], { icon: '✂', color: '#0F766E' }),
  edge_taping:    K('ETP', 'Kenar Bantlama',     'lam',    'process',    15,  [3.0, 2.6, 1.6], { icon: '📎', color: '#047857' }),
  tape_removal:   K('TRV', 'Kenar Bant Sökme',   'lam',    'process',    12,  [3.0, 2.6, 1.6], { icon: '🗑', color: '#064E3B' }),
  // Son işlemler
  framing:        K('FRM', 'Çerçeveleme',        'finish', 'process',    25,  [4.5, 3.4, 1.8], { icon: '🖼', color: '#7C3AED' }),
  jbox:           K('JBX', 'Junction Box',       'finish', 'process',    30,  [3.2, 2.6, 1.9], { icon: '🔌', color: '#6D28D9' }),
  potting:        K('POT', 'Potting',            'finish', 'process',    15,  [2.8, 2.6, 1.9], { icon: '💧', color: '#5B21B6' }),
  curing:         K('CUR', 'Kürleme',            'finish', 'curing',     3600, [8.0, 3.0, 3.0], { icon: '⏳', color: '#92400E' }),
  cleaning:       K('CLN', 'Temizlik',           'finish', 'process',    10,  [3.0, 2.6, 1.6], { icon: '🧹', color: '#1E3A5F' }),
  labeling:       K('LBL', 'Etiketleme',         'finish', 'process',    10,  [2.8, 2.6, 1.8]),                        // yeni
  // Test ve kalite
  el_test:        K('EL',  'EL Test',            'test',   'inspection', 60,  [3.5, 2.8, 2.4], { icon: '🔬', color: '#0891B2', defaults: INSPECT }),
  el_vi:          K('ELV', 'EL & Görsel Kontrol', 'test',  'inspection', 40,  [4.2, 2.8, 2.4], { defaults: INSPECT }),  // yeni: tek makinede EL + VI
  visual_control: K('VIS', 'Visual Control',     'test',   'inspection', 20,  [3.0, 2.6, 2.0], { icon: '👁', color: '#164E63', defaults: GRADE }),
  iv_test:        K('IV',  'IV Test',            'test',   'inspection', 30,  [3.5, 2.8, 2.4], { icon: '📊', color: '#0E7490', defaults: ELEC }),
  flash_test:     K('FLS', 'Flash Test',         'test',   'inspection', 45,  [3.5, 2.8, 2.4], { icon: '💡', color: '#155E75', defaults: ELEC }),
  hipot:          K('HPT', 'Hi-Pot / İzolasyon', 'test',   'inspection', 25,  [3.2, 2.8, 2.3], { defaults: ELEC }), // yeni
  fqc:            K('FQC', 'FQC',                'test',   'inspection', 35,  [3.5, 2.8, 2.2], { icon: '✅', color: '#14532D', defaults: GRADE }),
  rework:         K('RWK', 'Tamir / Rework',     'test',   'process',    300, [4.0, 3.0, 2.2],                         // yeni
                    { defaults: { operators: 1, rework_success: 90, max_rework: 2 } }),
  // Lojistik ve hat sonu
  buffer:         K('BUF', 'Buffer / Ara Stok',  'logistic', 'buffer',   0,   [3.0, 2.6, 3.2], { icon: '📦', color: '#7C3AED' }),
  classification: K('SRT', 'Sınıflandırma',      'logistic', 'classification', 5, [5.2, 6.6, 2.2], { icon: '🗂', color: '#BE185D' }),
  packaging:      K('PKG', 'Paketleme',          'logistic', 'process',  40,  [5.0, 3.0, 2.4], { icon: '📫', color: '#92400E' }),
};

// Hata türleri: elektriksel testler (IV, flash, Hi-Pot) yalnız elektriksel hataları görür; EL, görsel kontrol
// ve FQC EL/görsel hataları (çatlak, kayma, yabancı madde) görür. Proses gizli hataları EL/görsel türündendir.
export const ELEC_TESTS = new Set(['iv_test', 'flash_test', 'hipot']);
export const defectField = kind => (ELEC_TESTS.has(kind) ? 'elec' : 'defective');

// Editör paletindeki süreç grupları (hattaki sırayla)
export const GROUPS = [
  { id: 'prep',     name: 'Hazırlık' },
  { id: 'layup',    name: 'Dizim' },
  { id: 'lam',      name: 'Laminasyon' },
  { id: 'finish',   name: 'Son işlemler' },
  { id: 'test',     name: 'Test ve kalite' },
  { id: 'logistic', name: 'Lojistik ve hat sonu' },
];

// Bilinmeyen tip için Python'daki geri dönüş değerlerinin karşılığı
const FALLBACK_KIND = K('STN', '?', 'finish', 'process', 30, [3.0, 2.6, 1.8]);

export function catalogOf(kind) {
  return STATION_CATALOG[kind] ?? FALLBACK_KIND;
}

export function categoryOf(station) {
  return catalogOf(station.kind).category;
}

export const CATEGORY_COLORS = {
  process:        '#2563EB',
  inspection:     '#0891B2',
  buffer:         '#7C3AED',
  curing:         '#B45309',
  classification: '#BE185D',
};

export const PRODUCT_COLORS = ['#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#A78BFA',
                               '#FB923C', '#2DD4BF', '#E879F9', '#FDE68A', '#93C5FD'];

// İstasyon durumları: andon lambası rengi ve adı
export const STATUS_COLORS = {
  working:     '#23955A',  // işliyor
  setup:       '#7A5BA6',  // ürün değişimi ayarı
  blocked:     '#E3A008',  // iş bitti, çıkış dolu
  idle:        '#9A9EA4',  // malzeme (ürün) bekliyor
  no_operator: '#E07B2A',  // operatör yok
  no_material: '#E07B2A',  // malzeme stoğu yok
  down:        '#D23B2F',  // arıza
  maint:       '#2F6DB5',  // planlı bakım
  break:       '#5C6168',  // mola
  offshift:    '#5C6168',  // vardiya dışı
  paused:      '#D23B2F',  // kullanıcı durdurdu
};

export const STATUS_LABELS = {
  working: 'İşliyor', setup: 'Ayar', blocked: 'Çıkış dolu', idle: 'Boşta',
  no_operator: 'Operatör yok', no_material: 'Malzeme yok', down: 'Arıza', maint: 'Bakım',
  break: 'Mola', offshift: 'Vardiya dışı', paused: 'Durduruldu',
};

// İstasyon etiketi: LAM-08
export function stationTag(s) {
  return `${catalogOf(s.kind).code}-${String(s.id).padStart(2, '0')}`;
}

// Ürün fiziksel ölçüleri (metre) — 3D görünüm için
export const PRODUCT_SIZE = {
  panel:  [2.28, 1.13, 0.035],
  string: [2.10, 0.19, 0.01],
};
