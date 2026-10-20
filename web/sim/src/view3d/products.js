// ─────────────────────────────────────────
//  ÜRÜNLER (InstancedMesh)
// ─────────────────────────────────────────
// Paneller (renkli çerçeve + koyu cam) ve string'ler tek çizim çağrısıyla çizilir.
// Her karede begin() → panel()/string() → end().
import * as THREE from '../../vendor/three/three.module.min.js';
import { PRODUCT_SIZE } from '../core/catalog.js';
import { MAT, BIN_COLORS } from './materials.js';
import { PALLET_FULL_H } from './machines.js';

const [PL, PW, PT] = PRODUCT_SIZE.panel;     // uzunluk, genişlik, kalınlık
const [SL, SW, ST] = PRODUCT_SIZE.string;

const colorCache = new Map();
const colorOf = hex => {
  if (!colorCache.has(hex)) colorCache.set(hex, new THREE.Color(hex));
  return colorCache.get(hex);
};

export class ProductLayer {
  constructor(parent) {
    this.parent = parent;
    this.geo = {
      frame: new THREE.BoxGeometry(PL, PT, PW).translate(0, PT / 2, 0),
      glass: new THREE.BoxGeometry(PL - 0.08, 0.008, PW - 0.08).translate(0, PT + 0.004, 0),
      string: new THREE.BoxGeometry(SL, ST, SW).translate(0, ST / 2, 0),
      pallet: new THREE.BoxGeometry(1.2, 0.14, 2.35),
      stack: new THREE.BoxGeometry(1.13, PALLET_FULL_H, 2.28).translate(0, 0.07 + PALLET_FULL_H / 2, 0),
    };
    this.mat = {
      frame: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.18, metalness: 0.45 }),
      string: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 }),
      stack: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    };
    this._alloc(1024, 512);
  }

  _alloc(panels, pallets) {
    for (const m of [this.frame, this.glass, this.strings, this.pallet, this.stack]) {
      if (m) { this.parent.remove(m); m.dispose(); }
    }
    const mk = (geo, mat, n) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      this.parent.add(m);
      return m;
    };
    this.cap = panels;
    this.palletCap = pallets;
    this.frame = mk(this.geo.frame, this.mat.frame, panels);
    this.glass = mk(this.geo.glass, this.mat.glass, panels);
    this.strings = mk(this.geo.string, this.mat.string, panels);
    this.pallet = mk(this.geo.pallet, MAT.wood, pallets);
    this.stack = mk(this.geo.stack, this.mat.stack, pallets);
    this.frame.castShadow = this.stack.castShadow = this.pallet.castShadow = true;
  }

  begin() {
    this.np = this.ns = this.nq = 0;
    this._overflow = false;
  }

  // matrix: dünya matrisi (konum + yön)
  panel(matrix, color) {
    if (this.np >= this.cap) { this._overflow = true; return; }
    this.frame.setMatrixAt(this.np, matrix);
    this.glass.setMatrixAt(this.np, matrix);
    this.frame.setColorAt(this.np, colorOf(color));
    this.np++;
  }

  string(matrix, color) {
    if (this.ns >= this.cap) { this._overflow = true; return; }
    this.strings.setMatrixAt(this.ns, matrix);
    this.strings.setColorAt(this.ns, colorOf(color));
    this.ns++;
  }

  // Depo sahasındaki dolu palet
  palletAt(matrix, binIndex) {
    if (this.nq >= this.palletCap) { this._overflow = true; return; }
    this.pallet.setMatrixAt(this.nq, matrix);
    this.stack.setMatrixAt(this.nq, matrix);
    this.stack.setColorAt(this.nq, colorOf(BIN_COLORS[binIndex % BIN_COLORS.length]));
    this.nq++;
  }

  end() {
    const fin = (m, n) => {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    fin(this.frame, this.np);
    fin(this.glass, this.np);
    fin(this.strings, this.ns);
    fin(this.pallet, this.nq);
    fin(this.stack, this.nq);
    if (this._overflow) this._alloc(this.cap * 2, this.palletCap * 2);
  }

  dispose() {
    for (const m of [this.frame, this.glass, this.strings, this.pallet, this.stack]) {
      this.parent.remove(m);
      m.dispose();
    }
    Object.values(this.geo).forEach(g => g.dispose());
    Object.values(this.mat).forEach(m => m.dispose());
  }
}
