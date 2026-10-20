// ─────────────────────────────────────────
//  STANDART PV MODÜL MALZEME LİSTESİ (BOM)
// ─────────────────────────────────────────
// Cam-backsheet, 144 yarım hücreli modül için ~60 modül/saat hatta makul stok ve tedarik değerleri.
// per: istasyon tipi → ürün başına tüketim. Kullanıcı tüm değerleri Hat › Malzemeler'den değiştirebilir.
export const STANDARD_BOM = [
  { name: 'Hücre',             unit: 'adet', per: { stringer: 24 },                 stock: 60000, reorder_point: 40000, reorder_qty: 60000, lead_time_h: 4 },
  { name: 'Ön cam',            unit: 'adet', per: { glass_loader: 1 },              stock: 600,   reorder_point: 250,   reorder_qty: 600,   lead_time_h: 4 },
  { name: 'EVA/POE film',      unit: 'adet', per: { eva_cutter: 1, rear_eva: 1 },   stock: 1500,  reorder_point: 600,   reorder_qty: 1500,  lead_time_h: 4 },
  { name: 'Backsheet',         unit: 'adet', per: { backsheet: 1 },                 stock: 700,   reorder_point: 300,   reorder_qty: 700,   lead_time_h: 4 },
  { name: 'Çerçeve seti',      unit: 'set',  per: { framing: 1 },                   stock: 600,   reorder_point: 300,   reorder_qty: 600,   lead_time_h: 4 },
  { name: 'Junction box',      unit: 'adet', per: { jbox: 1 },                      stock: 800,   reorder_point: 300,   reorder_qty: 800,   lead_time_h: 4 },
  { name: 'Silikon / potting', unit: 'kg',   per: { potting: 0.05, framing: 0.12 }, stock: 150,   reorder_point: 60,    reorder_qty: 150,   lead_time_h: 4 },
  { name: 'Etiket',            unit: 'adet', per: { labeling: 2 },                  stock: 3000,  reorder_point: 800,   reorder_qty: 3000,  lead_time_h: 4 },
  { name: 'Ambalaj',           unit: 'set',  per: { packaging: 1 / 31 },            stock: 60,    reorder_point: 15,    reorder_qty: 60,    lead_time_h: 4 },
];

// Hatta eksik olan BOM malzemelerini ekler ve tipine uyan istasyonlara tüketimi bağlar.
// Hiçbir istasyonun kullanmadığı malzeme eklenmez.
export function addStandardBOM(L) {
  for (const b of STANDARD_BOM) {
    const users = [...L.stations.values()].filter(s => b.per[s.kind]);
    if (!users.length) continue;
    let m = L.materials.find(x => x.name === b.name);
    if (!m) {
      const { per, ...props } = b;
      m = L.addMaterial(props);
    }
    for (const s of users) {
      if (!s.consumes.some(c => c.material_id === m.id)) s.consumes.push({ material_id: m.id, qty: b.per[s.kind] });
    }
  }
}
