// ─────────────────────────────────────────
//  KONVEYÖRLER
// ─────────────────────────────────────────
import * as THREE from '../../vendor/three/three.module.min.js';
import { BELT_HEIGHT as BH, BELT_WIDTH, polylineLength } from './geometry.js';
import { MAT, BELT_TINT, box, beltMaterial, beltSurfaceGeometry } from './materials.js';

// Yerel +X boyunca, merkezi orijinde düz bant parçası (yüzey + gövde + korkuluk + ayaklar)
export function beltSegment(len, mat, railMat = MAT.steel) {
  const g = new THREE.Group();
  const surf = new THREE.Mesh(beltSurfaceGeometry(len, BELT_WIDTH), mat);
  surf.position.y = BH;
  surf.receiveShadow = true;
  g.add(surf);
  g.add(box(len, 0.14, BELT_WIDTH + 0.1, MAT.beltFrame, 0, BH - 0.075, 0, false));
  for (const sz of [-1, 1]) g.add(box(len, 0.05, 0.05, railMat, 0, BH + 0.03, sz * (BELT_WIDTH / 2 + 0.06), false));
  const n = Math.max(1, Math.round(len / 2.8));
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -len / 2 + 0.3 + i * (len - 0.6) / (n - 1);
    g.add(box(0.08, BH - 0.15, BELT_WIDTH - 0.1, MAT.beltFrame, x, (BH - 0.15) / 2, 0, false));
  }
  return g;
}

export class ConveyorMesh {
  constructor(conv, pts) {
    this.id = conv.id;
    this.pts = pts;
    this.length = polylineLength(pts);
    this.mat = beltMaterial();
    this.group = new THREE.Group();
    this._fill = null;

    this.hits = [];               // tıklama için bant yüzeyleri
    const last = pts.length - 2;
    for (let i = 0; i <= last; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-6) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      // Dönüşlerde parçalar birbirinin içine uzar ki köşe dolu görünsün
      const e0 = i > 0 ? BELT_WIDTH / 2 : 0;
      const e1 = i < last ? BELT_WIDTH / 2 : 0;
      // Hatalı ürün (tamir) konveyörü kırmızı korkuluklu
      const seg = beltSegment(len + e0 + e1, this.mat, conv.type === 'defect' ? MAT.defectRail : MAT.steel);
      const mid = (len + e1 - e0) / 2;
      seg.position.set(ax + dx * mid, i * 0.003, az + dz * mid);
      seg.rotation.y = Math.atan2(-dz, dx);
      seg.children[0].userData.convId = conv.id;
      this.hits.push(seg.children[0]);
      this.group.add(seg);
    }
  }

  // Renk: boş / taşıyor / baştaki ürün varmış ve bekliyor / dolu ve bekliyor (tıkanma)
  setFill(items, cap, now) {
    const waiting = items.length > 0 && items[0].arriveTime <= now;
    const state = !items.length ? 'empty' : !waiting ? 'moving' : items.length >= cap ? 'full' : 'waiting';
    if (state === this._fill) return;
    this._fill = state;
    this.mat.color.setHex(BELT_TINT[state]);
  }

  setHighlight(on) {
    this.mat.emissive.setHex(on ? 0xe8571b : 0x000000);
    this.mat.emissiveIntensity = on ? 0.5 : 1;
  }

  dispose() {
    this.group.traverse(o => { if (o.isMesh && o.geometry.type === 'PlaneGeometry') o.geometry.dispose(); });
    this.mat.dispose();
  }
}
