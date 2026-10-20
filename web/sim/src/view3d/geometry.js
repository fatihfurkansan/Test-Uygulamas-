// ─────────────────────────────────────────
//  3D YERLEŞİM GEOMETRİSİ (saf hesap, Three.js'siz)
// ─────────────────────────────────────────
// 2D plan (px) → zemin düzlemi (metre): X = x·m, Z = y·m. Y yukarı.
// Plan açısı derece: 0 = +X (sağ), 90 = +Z (2D'de aşağı).
import { catalogOf } from '../core/catalog.js';

export const BELT_HEIGHT = 0.9;   // konveyör üst yüzeyi / makine tabla yüksekliği (m)
export const BELT_WIDTH = 1.3;
export const STUB = 2.6;          // makine önü/arkası besleme-çıkış tablası (1 panel boyu)
const TURN = 1.0;                 // rota dönüşünden önceki düz pay

// Makine yönü: girişi varsa malzemenin geldiği yön, yoksa çıkış yönü; 90°'ye yuvarlanır
export function autoRotation(layout, s) {
  const sources = layout.incoming(s.id).map(c => layout.stations.get(c.from_id));
  const targets = layout.outgoing(s.id).map(c => layout.stations.get(c.to_id));
  let [dx, dz] = unitSum(sources.map(o => [s.x - o.x, s.y - o.y]));
  if (Math.hypot(dx, dz) < 1e-6) [dx, dz] = unitSum(targets.map(o => [o.x - s.x, o.y - s.y]));
  if (Math.hypot(dx, dz) < 1e-6) return 0;
  const deg = Math.atan2(dz, dx) * 180 / Math.PI;
  return ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
}

function unitSum(vectors) {
  let dx = 0, dz = 0;
  for (const [ax, az] of vectors) {
    const len = Math.hypot(ax, az);
    if (len > 0) { dx += ax / len; dz += az / len; }
  }
  return [dx, dz];
}

// İstasyonun 3D çerçevesi: merkez, yön, ölçüler, giriş/çıkış portları
export function stationFrame(layout, s) {
  const m = layout.meta.metersPerPx;
  const [L, W, H] = catalogOf(s.kind).size;
  const rotDeg = s.rot ?? autoRotation(layout, s);
  const a = rotDeg * Math.PI / 180;
  const dir = [round6(Math.cos(a)), round6(Math.sin(a))];
  const x = s.x * m, z = s.y * m;
  return {
    id: s.id, x, z, rotDeg, dir, L, W, H,
    yaw: -a,                                            // Three.js rotation.y
    inPort: [x - dir[0] * L / 2, z - dir[1] * L / 2],
    outPort: [x + dir[0] * L / 2, z + dir[1] * L / 2],
  };
}
const round6 = v => Math.round(v * 1e6) / 1e6;

// Konveyör rotası: kaynağın çıkış tablası ucundan hedefin besleme tablası başına,
// dik açılı (L/Z). Geriye dönmemek için ilk dönüş yönü seçilir.
export function conveyorRoute(fa, fb) {
  const q0 = add(fa.outPort, fa.dir, STUB);
  const p1 = add(q0, fa.dir, TURN);
  const q4 = add(fb.inPort, fb.dir, -STUB);
  const q3 = add(q4, fb.dir, -TURN);

  const alongA = Math.abs(fa.dir[0]) > 0.5;
  let corner = alongA ? [q3[0], p1[1]] : [p1[0], q3[1]];
  const back = (corner[0] - p1[0]) * fa.dir[0] + (corner[1] - p1[1]) * fa.dir[1];
  if (back < -1e-6) corner = alongA ? [p1[0], q3[1]] : [q3[0], p1[1]];

  return simplify([q0, p1, corner, q3, q4]);
}

const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];

// Ardışık aynı noktaları ve doğrusal ara noktaları at
export function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-6) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const cross = (last[0] - a[0]) * (p[1] - last[1]) - (last[1] - a[1]) * (p[0] - last[0]);
      const dot = (last[0] - a[0]) * (p[0] - last[0]) + (last[1] - a[1]) * (p[1] - last[1]);
      if (Math.abs(cross) < 1e-6 && dot >= 0) out.pop();
    }
    out.push(p);
  }
  return out;
}

export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

// Rota üzerinde d metredeki nokta ve yön (yaw, Three.js rotation.y)
export function pointAt(pts, d) {
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], yaw: 0 };
  let rest = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (rest <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, rest / seg) : 0;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(-(bz - az), bx - ax) };
    }
    rest -= seg;
  }
}

// Konveyördeki ürünlerin rota üzerindeki mesafeleri. items[0] baştaki (hedefe en yakın) üründür;
// bekleyen ürünler arka arkaya en az `gap` aralıkla dizilir.
export function conveyorItemDistances(items, length, time, gap) {
  const out = [];
  let prev = Infinity;
  for (const it of items) {
    const span = it.arriveTime - it.enterTime;
    const p = span > 0 ? Math.min(1, Math.max(0, (time - it.enterTime) / span)) : 1;
    const d = Math.max(0, Math.min(p * length, prev - gap));
    out.push(d);
    prev = d;
  }
  return out;
}

// Tüm makineleri (tablalar dahil) kapsayan dikdörtgen
export function layoutBounds(frames, margin = 0) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const f of frames) {
    const ext = Math.max(f.L / 2 + STUB, f.W / 2);
    minX = Math.min(minX, f.x - ext); maxX = Math.max(maxX, f.x + ext);
    minZ = Math.min(minZ, f.z - ext); maxZ = Math.max(maxZ, f.z + ext);
  }
  if (!isFinite(minX)) return { minX: -20, minZ: -20, maxX: 20, maxZ: 20, cx: 0, cz: 0, w: 40, d: 40 };
  minX -= margin; minZ -= margin; maxX += margin; maxZ += margin;
  return { minX, minZ, maxX, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ };
}
