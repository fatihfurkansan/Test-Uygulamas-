// ─────────────────────────────────────────
//  ORTAK MALZEMELER / GEOMETRİLER
// ─────────────────────────────────────────
// Tüm makineler aynı birim kutu/silindir geometrisini ölçekleyerek kullanır;
// malzemeler paylaşılır (istasyona özel olanlar hariç: andon, oda ışıkları, konveyör rengi).
import * as THREE from '../../vendor/three/three.module.min.js';

// Açık "fabrika holü" sahnesi: beton zemin, kırık beyaz makineler, turuncu seçim vurgusu
export const SCENE_COLORS = {
  background: 0xe4e3df,
  floor:      0xd0cfcb,
  gridMajor:  0xb7b5af,
  gridMinor:  0xc4c2bd,
  walkway:    0xe3a008,
  select:     0xe8571b,
  hover:      0x5b6068,
};

// Konveyör durum renkleri: boş / taşıyor / ürün bekliyor / dolu ve tıkalı
export const BELT_TINT = { empty: 0xffffff, moving: 0xdfe8f5, waiting: 0xf2b11c, full: 0xe2483d };

// Kategorik palet (hazneler, depo paletleri, malzeme serileri): sabit sırada atanır, döngüye girmez.
// Renk körlüğü ve normal görüş ayrımı doğrulandı; açık tonlar yüzeyde <3:1 olduğu için adlar
// her zaman metin olarak (etiket/tablo) da gösterilir.
export const BIN_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// Makine renk şeridi: kategori başına sakin endüstriyel tonlar (laminasyon ısıl işlem turuncusu)
const TONES = {
  process: '#3F6D8E', inspection: '#2D7D74', buffer: '#5C6168', curing: '#B07A22', classification: '#6A4F94',
};
export function kindTone(kind, category) {
  return kind === 'lamination' ? '#C2502A' : TONES[category] ?? TONES.process;
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });

export const MAT = {
  plinth:    std(0x3a3d42, { roughness: 0.85 }),
  body:      std(0xeceae5, { roughness: 0.55, metalness: 0.05 }),
  bodyDark:  std(0x2e3136, { roughness: 0.6, metalness: 0.15 }),
  table:     std(0x4a4e55, { roughness: 0.7 }),
  steel:     std(0xa7acb2, { roughness: 0.35, metalness: 0.6 }),
  glass:     std(0xb9cbd8, { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false }),
  tent:      std(0xd9a441, { transparent: true, opacity: 0.14, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  beltFrame: std(0xb3b7bd, { roughness: 0.45, metalness: 0.5 }),
  wood:      std(0xb08453, { roughness: 0.9 }),
  cassette:  std(0x24365c, { roughness: 0.35, metalness: 0.3 }),
  film:      std(0xf1efe8, { roughness: 0.4 }),
  sheet:     std(0xbfd9e6, { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1 }),
  scrap:     std(0xc9473a, { roughness: 0.6 }),
  defectRail: std(0xd23b2f, { roughness: 0.5 }),
  workwear:  std(0x2c3e5c, { roughness: 0.8 }),
  vest:      std(0xe8571b, { roughness: 0.7 }),
  skin:      std(0xd9a77f, { roughness: 0.8 }),
  hit:       new THREE.MeshBasicMaterial({ visible: false }),
};

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
};

const accents = new Map();
export function accentMat(hex) {
  if (!accents.has(hex)) accents.set(hex, std(hex, { roughness: 0.45, metalness: 0.2 }));
  return accents.get(hex);
}

// Merkez koordinatlı ölçekli kutu
export function box(w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(GEO.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// Dikey silindir (axis: 'y' | 'x' | 'z')
export function cylinder(r, len, mat, x = 0, y = 0, z = 0, axis = 'y') {
  const m = new THREE.Mesh(GEO.cyl, mat);
  m.scale.set(r * 2, len, r * 2);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Bant yüzeyi dokusu: akış yönünü gösteren oklar (+u yönü)
let beltTex = null;
export function beltTexture() {
  if (beltTex) return beltTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8d9196';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#7d8187';
  g.lineWidth = 6;
  for (let x = 8; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  g.strokeStyle = '#eceef0';
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(44, 30); g.lineTo(80, 64); g.lineTo(44, 98); g.stroke();
  beltTex = new THREE.CanvasTexture(c);
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.colorSpace = THREE.SRGBColorSpace;
  beltTex.anisotropy = 4;
  return beltTex;
}

export function beltMaterial(tint = BELT_TINT.empty) {
  return new THREE.MeshStandardMaterial({ color: tint, map: beltTexture(), roughness: 0.75, metalness: 0.1 });
}

// Uzunluğu boyunca dokusu metre başına tekrar eden bant yüzeyi (yerel +X akış yönü)
export function beltSurfaceGeometry(len, width) {
  const geo = new THREE.PlaneGeometry(len, width);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 1.2);
  return geo;
}
