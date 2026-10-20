// ─────────────────────────────────────────
//  MAKİNE MODELLERİ (prosedürel)
// ─────────────────────────────────────────
// Yerel eksenler: +X akış yönü (giriş -L/2, çıkış +L/2), Z genişlik, Y yukarı.
// Her makine ürünlerin duracağı yerel noktaları da tanımlar (kuyruk, işlem, çıkış, bölge, raf).
import * as THREE from '../../vendor/three/three.module.min.js';
import { categoryOf, STATUS_COLORS } from '../core/catalog.js';
import { BELT_HEIGHT as BH, BELT_WIDTH, STUB } from './geometry.js';
import { MAT, GEO, BIN_COLORS, SCENE_COLORS, accentMat, kindTone, box, cylinder, beltMaterial } from './materials.js';
import { beltSegment } from './conveyors.js';

const STACK = 0.045;       // üst üste bekleyen panellerin aralığı
const MAX_STACK = 24;      // görsel yığın sınırı (fazlası etikette sayılır)
const PALLET_FULL_H = 1.25;

let stubMat = null;        // makine tablaları için ortak bant malzemesi

// İnceleme kabini pencere ışığı: EL mavi, flash/IV beyaz flaş, görsel/FQC sıcak beyaz
const CABIN_LIGHT = {
  cell_laser:     { color: 0xef4444, flash: false },
  hipot:          { color: 0xf5b301, flash: true },
  el_test:        { color: 0x3b82f6, flash: false },
  el_vi:          { color: 0x3b82f6, flash: false, second: 0xfde68a },   // EL (mavi) + görsel kontrol (sıcak beyaz)
  iv_test:        { color: 0xf8fafc, flash: true },
  flash_test:     { color: 0xf8fafc, flash: true },
  visual_control: { color: 0xfde68a, flash: false },
  fqc:            { color: 0xbbf7d0, flash: false },
};

export class Machine {
  constructor(s, f) {
    this.id = s.id;
    this.kind = s.kind;
    this.cat = categoryOf(s);
    this.f = f;
    this.accent = accentMat(kindTone(s.kind, this.cat));
    this.anim = [];            // (ctx) => void — her karede çağrılır
    this.flash = 0;
    this.owned = [];           // makineye özel malzeme/geometri (dispose için)

    const g = this.group = new THREE.Group();
    g.position.set(f.x, 0, f.z);
    g.rotation.y = f.yaw;
    g.userData.stationId = s.id;

    if (s.kind === 'lamination') this._laminator();
    else if (this.cat === 'buffer') this._rack(s, 1, false);
    else if (this.cat === 'curing') this._rack(s, 3, true);
    else if (this.cat === 'classification') this._sorter(s);
    else if (this.cat === 'inspection' || s.kind === 'cell_laser') this._cabinet();
    else if (s.kind === 'layup') this._layup();
    else if (s.kind === 'rework') this._bench();
    else this._tunnel();

    this._stubs();
    this._andon();
    this._marking();
    this._operators(Math.max(0, s.operators | 0));
    this._scrapBin();
    this._selection();
  }

  // ──────────────────────────────────────
  //  ORTAK PARÇALAR
  // ──────────────────────────────────────
  _own(x) { this.owned.push(x); return x; }

  // Kaide + alt gövde + renk şeridi + tabla (üst yüzü bant yüksekliğinde)
  _base(L, W, tableW = Math.min(W - 0.2, BELT_WIDTH + 0.2), x = 0) {
    const g = this.group;
    const top = BH - 0.05;
    g.add(box(L, 0.1, W, MAT.plinth, x, 0.05, 0));
    g.add(box(L - 0.06, top - 0.1, W - 0.06, MAT.body, x, 0.1 + (top - 0.1) / 2, 0));
    g.add(box(L - 0.04, 0.1, W - 0.04, this.accent, x, top - 0.16, 0, false));
    g.add(box(L - 0.1, 0.05, tableW, MAT.table, x, top + 0.025, 0));
  }

  // Cam kapak + köşe dikmeleri + çatı
  _hood(L, W, y0, y1, x = 0) {
    const g = this.group;
    const h = y1 - y0;
    g.add(box(L - 0.1, h, W - 0.1, MAT.glass, x, y0 + h / 2, 0, false));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(0.08, h, 0.08, MAT.steel, x + sx * (L / 2 - 0.08), y0 + h / 2, sz * (W / 2 - 0.08)));
    }
    g.add(box(L, 0.08, W, MAT.steel, x, y1, 0));
  }

  _stubs() {
    stubMat ??= beltMaterial();
    const { L } = this.f;
    const add = x => {
      const seg = beltSegment(STUB, stubMat);
      seg.position.x = x;
      this.group.add(seg);
    };
    add(-L / 2 - STUB / 2);
    if (this.cat !== 'classification') add(L / 2 + STUB / 2);
  }

  _andon() {
    const { L, W, H } = this.f;
    const x = -L / 2 + 0.3, z = -W / 2 + 0.3;
    this.group.add(box(0.07, 0.6, 0.07, MAT.steel, x, H + 0.3, z));
    this.andonMat = this._own(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 }));
    this.group.add(cylinder(0.13, 0.28, this.andonMat, x, H + 0.72, z));
    this._status = null;
  }

  _marking() {
    const { L, W } = this.f;
    const hx = L / 2 + 0.4, hz = W / 2 + 0.4, y = 0.012;
    const geo = this._own(new THREE.BufferGeometry().setFromPoints(
      [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => new THREE.Vector3(x, y, z))));
    this.group.add(new THREE.LineLoop(geo, MARK_MAT));
  }

  // Seçim / üzerine gelme çerçevesi ve tıklama kutusu (tablalar dahil)
  _selection() {
    const { L, W, H } = this.f;
    const h = H + 1.0;
    const edges = this._own(new THREE.EdgesGeometry(new THREE.BoxGeometry(L + 0.4, h, W + 0.4)));
    this.outline = new THREE.LineSegments(edges, SELECT_MAT);
    this.outline.position.y = h / 2;
    this.outline.visible = false;
    this.group.add(this.outline);

    const reach = this.cat === 'classification' ? L + STUB : L + 2 * STUB;
    this.hit = box(reach, h, W, MAT.hit, this.cat === 'classification' ? -STUB / 2 : 0, h / 2, 0, false);
    this.hit.userData.stationId = this.id;
    this.group.add(this.hit);
  }

  setHighlight(mode) {    // null | 'hover' | 'select'
    this.outline.visible = !!mode;
    this.outline.material = mode === 'select' ? SELECT_MAT : HOVER_MAT;
  }

  setStatus(status) {
    if (status === this._status) return;
    this._status = status;
    const c = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
    this.andonMat.color.set(c);
    this.andonMat.emissive.set(c);
    this.andonMat.emissiveIntensity = DIM_STATES.has(status) ? 0.1 : 1.4;
  }

  update(ctx) {
    this.setStatus(ctx.status);
    if (ctx.status === 'down') this.andonMat.emissiveIntensity = Math.sin(ctx.t * 12) > 0 ? 2.2 : 0.15;
    this.flash *= Math.exp(-ctx.dt * 7);
    for (const fn of this.anim) fn(ctx);
  }

  // Operatörlü istasyonlarda çalışan figürü (molada ve vardiya dışında yok)
  _operators(n) {
    if (!n) return;
    const { L, W } = this.f;
    const crew = new THREE.Group();
    for (let i = 0; i < Math.min(n, 4); i++) {
      const p = new THREE.Group();
      p.add(box(0.36, 0.8, 0.24, MAT.workwear, 0, 0.4, 0));
      p.add(box(0.42, 0.62, 0.28, MAT.vest, 0, 1.1, 0));
      const head = new THREE.Mesh(GEO.sphere, MAT.skin);
      head.scale.setScalar(0.24);
      head.position.y = 1.56;
      head.castShadow = true;
      p.add(head);
      p.position.set((i - (Math.min(n, 4) - 1) / 2) * 0.9, 0, -W / 2 - 0.45);
      crew.add(p);
    }
    this.group.add(crew);
    this.anim.push(ctx => { crew.visible = ctx.status !== 'break' && ctx.status !== 'offshift'; });
  }

  // Hurda kasası: istasyonda hurda çıktıysa görünür, doldukça yükselir
  _scrapBin() {
    const { L, W } = this.f;
    const bin = box(0.7, 0.5, 0.6, MAT.scrap, L / 2 - 0.4, 0.25, W / 2 + 0.5);
    bin.visible = false;
    this.group.add(bin);
    this.anim.push(ctx => {
      const n = ctx.rt.scrapped;
      bin.visible = n > 0;
      if (n > 0) { const h = Math.min(1.2, 0.3 + n * 0.01); bin.scale.y = h; bin.position.y = h / 2; }
    });
  }

  // ──────────────────────────────────────
  //  ÜRÜN YERLERİ (yerel koordinat)
  // ──────────────────────────────────────
  inStack(i) {
    return i < MAX_STACK ? [-this.f.L / 2 - STUB / 2, BH + 0.02 + i * STACK, 0] : null;
  }

  outStack(i) {
    return i < MAX_STACK ? [this.f.L / 2 + STUB / 2, BH + 0.02 + i * STACK, 0] : null;
  }

  // j: iş (kaynak) sırası, n: aktif iş sayısı, k: batch içindeki sıra
  work(j, n, k) {
    const { W } = this.f;
    const x = this.kind === 'layup' ? 1.0 : 0;
    const z = n > 1 ? (j - (n - 1) / 2) * Math.min(1.2, (W - 0.3) / n) : 0;
    return k < MAX_STACK ? [x, BH + 0.02 + k * STACK, z] : null;
  }

  // ──────────────────────────────────────
  //  TİPE ÖZEL MODELLER
  // ──────────────────────────────────────
  // Genel işlem makinesi: gövde + cam kapak + tipe özgü parça
  _tunnel() {
    const { L, W, H } = this.f;
    const g = this.group;
    const y0 = BH + 0.05;
    this._base(L, W);
    this._hood(L, W, y0, H);
    const working = ctx => ctx.status === 'working';

    switch (this.kind) {
      case 'stringer': {
        for (const z of [-0.55, 0.55]) g.add(box(0.5, 0.45, 0.5, MAT.cassette, -L / 2 + 0.45, y0 + 0.23, z));
        const head = box(0.45, 0.22, W * 0.7, this.accent, 0, H - 0.3, 0);
        g.add(head);
        this.anim.push(ctx => { if (working(ctx)) head.position.x = Math.sin(ctx.t * 4) * L * 0.28; });
        break;
      }
      case 'auto_busbar': {
        g.add(box(0.25, 0.2, W - 0.2, this.accent, 0, H - 0.35, 0));
        const tool = box(0.2, 0.35, 0.2, MAT.steel, 0, H - 0.6, 0);
        g.add(tool);
        this.anim.push(ctx => { if (working(ctx)) tool.position.z = Math.sin(ctx.t * 3) * (W / 2 - 0.5); });
        break;
      }
      case 'trimming': {
        const blade = box(0.04, 0.3, W * 0.6, MAT.steel, 0.4, y0 + 0.35, 0);
        g.add(blade);
        this.anim.push(ctx => { blade.position.y = y0 + 0.3 + (working(ctx) ? Math.abs(Math.sin(ctx.t * 6)) * 0.15 : 0.15); });
        break;
      }
      case 'framing':
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          g.add(box(0.35, 0.3, 0.35, this.accent, sx * 1.3, y0 + 0.15, sz * 0.75));
        }
        break;
      case 'jbox':
      case 'potting': {
        g.add(box(0.2, H - y0 - 0.1, 0.2, MAT.bodyDark, 0.6, (y0 + H) / 2, -W / 2 + 0.35));
        g.add(box(0.2, 0.15, W / 2, MAT.bodyDark, 0.6, H - 0.2, -W / 4 + 0.1));
        const nozzle = cylinder(0.06, 0.4, this.accent, 0.6, H - 0.45, 0);
        g.add(nozzle);
        this.anim.push(ctx => { nozzle.position.y = H - 0.45 - (working(ctx) ? Math.abs(Math.sin(ctx.t * 3)) * 0.25 : 0); });
        break;
      }
      case 'cleaning': {
        const brushes = [-0.5, 0.5].map(x => cylinder(0.12, W * 0.7, this.accent, x, y0 + 0.2, 0, 'z'));
        brushes.forEach(b => g.add(b));
        this.anim.push(ctx => { if (working(ctx)) brushes.forEach(b => { b.rotation.y += ctx.dt * 8; }); });
        break;
      }
      case 'cell_taping':
      case 'edge_taping':
      case 'tape_removal': {
        const spools = [-0.6, 0.6].map(x => cylinder(0.22, 0.09, this.accent, x, y0 + 0.5, -W / 2 + 0.3, 'z'));
        spools.forEach(sp => g.add(sp));
        this.anim.push(ctx => { if (working(ctx)) spools.forEach(sp => { sp.rotation.y += ctx.dt * 5; }); });
        break;
      }
      case 'packaging':
        g.add(box(L * 0.5, H - y0, W * 0.8, this.accent, -L * 0.2, (y0 + H) / 2, 0));
        g.add(box(1.2, 0.14, 1.0, MAT.wood, L * 0.3, y0 + 0.07, 0));
        break;
      case 'glass_loader': {
        // A-çerçeve cam sehpası (makinenin yanında) + vakumlu portal
        for (const sx of [-1, 1]) g.add(box(0.08, 1.6, 0.08, MAT.steel, sx * 1.1, 0.8, -W / 2 - 0.55));
        for (let i = 0; i < 5; i++) {
          const sh = box(2.28, 1.13, 0.02, MAT.sheet, 0, 0.75, -W / 2 - 0.35 - i * 0.05, false);
          sh.rotation.x = -0.18;
          g.add(sh);
        }
        const gantry = new THREE.Group();
        gantry.add(box(0.2, 0.18, W - 0.2, this.accent, 0, H - 0.25, 0));
        for (const sz of [-0.4, 0.4]) gantry.add(cylinder(0.08, 0.25, MAT.bodyDark, 0, H - 0.5, sz));
        g.add(gantry);
        this.anim.push(ctx => { if (working(ctx)) gantry.position.x = Math.sin(ctx.t * 2.2) * (L / 2 - 0.5); });
        break;
      }
      case 'eva_cutter':
      case 'rear_eva':
      case 'backsheet': {
        // Film rulosu + kesici bıçak
        const roll = cylinder(0.26, W * 0.8, this.kind === 'backsheet' ? MAT.body : MAT.film, -L / 2 + 0.7, H - 0.45, 0, 'z');
        g.add(roll);
        g.add(box(0.06, 0.06, W * 0.85, MAT.steel, -L / 2 + 1.15, y0 + 0.25, 0));
        this.anim.push(ctx => { if (working(ctx)) roll.rotation.y += ctx.dt * 4; });
        break;
      }
      case 'flipper': {
        // Paneli kavrayıp X ekseni etrafında çeviren iki kol
        const arms = new THREE.Group();
        arms.position.y = y0 + 0.4;
        for (const sx of [-0.9, 0.9]) arms.add(box(0.12, 0.08, W - 0.5, this.accent, sx, 0, 0));
        g.add(arms);
        this.anim.push(ctx => { arms.rotation.x = working(ctx) ? Math.sin(ctx.t * 2) * Math.PI / 2 : 0; });
        break;
      }
      case 'labeling': {
        g.add(box(0.6, 0.5, 0.5, this.accent, 0.3, H - 0.5, -W / 2 + 0.45));
        const arm = box(0.08, 0.5, 0.08, MAT.steel, 0.3, H - 0.95, 0);
        g.add(arm);
        this.anim.push(ctx => { arm.position.z = working(ctx) ? Math.sin(ctx.t * 4) * 0.5 : 0; });
        break;
      }
    }
  }

  // Tamir tezgâhı: açık masa, aydınlatma, takım dolabı
  _bench() {
    const { L, W, H } = this.f;
    const g = this.group;
    g.add(box(L - 0.2, 0.06, W - 0.6, MAT.table, 0, BH - 0.03, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(0.08, BH - 0.06, 0.08, MAT.steel, sx * (L / 2 - 0.25), (BH - 0.06) / 2, sz * (W / 2 - 0.4)));
    }
    for (const sx of [-1, 1]) g.add(box(0.06, H - BH, 0.06, MAT.steel, sx * (L / 2 - 0.25), (H + BH) / 2, W / 2 - 0.4));
    const lamp = this._own(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.2 }));
    g.add(box(L - 0.4, 0.06, 0.3, lamp, 0, H, W / 2 - 0.4, false));
    g.add(box(0.8, 1.0, 0.6, this.accent, L / 2 - 0.55, 0.5, W / 2 - 0.15));
    this.anim.push(ctx => { lamp.emissiveIntensity = ctx.status === 'working' ? 1.2 : 0.2; });
  }

  // İnceleme: karanlık test kabini, altta panelin göründüğü yarık, yan pencerede ışık
  _cabinet() {
    const { L, W, H } = this.f;
    const g = this.group;
    const y0 = BH + 0.3;
    this._base(L, W);
    g.add(box(L, H - y0, W, MAT.bodyDark, 0, y0 + (H - y0) / 2, 0));
    g.add(box(L + 0.02, 0.14, W + 0.02, this.accent, 0, H - 0.25, 0, false));
    const spec = CABIN_LIGHT[this.kind] ?? CABIN_LIGHT.visual_control;
    const light = this._own(new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: spec.color, emissiveIntensity: 0 }));
    // Birleşik makinede iki pencere: EL bölmesi ve görsel kontrol bölmesi
    const second = spec.second && this._own(new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: spec.second, emissiveIntensity: 0 }));
    for (const sz of [-1, 1]) {
      if (second) {
        g.add(box(L * 0.3, 0.45, 0.03, light, -L * 0.2, y0 + 0.55, sz * (W / 2 + 0.01), false));
        g.add(box(L * 0.3, 0.45, 0.03, second, L * 0.2, y0 + 0.55, sz * (W / 2 + 0.01), false));
      } else {
        g.add(box(L * 0.5, 0.45, 0.03, light, 0, y0 + 0.55, sz * (W / 2 + 0.01), false));
      }
    }
    this.anim.push(ctx => {
      const on = ctx.status === 'working';
      light.emissiveIntensity = spec.flash ? Math.max(on ? 0.2 : 0.02, this.flash * 3) : (on ? 1.6 : 0.05);
      if (second) second.emissiveIntensity = on ? 1.2 : 0.05;
    });
  }

  // Layup: açık masa + köprü portal robot; biriken string'ler masada görünür
  _layup() {
    const { L, W, H } = this.f;
    const g = this.group;
    this._base(L, W, W - 0.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(0.12, H - BH, 0.12, MAT.steel, sx * (L / 2 - 0.1), (BH + H) / 2, sz * (W / 2 - 0.1)));
    }
    for (const sz of [-1, 1]) g.add(box(L, 0.12, 0.12, MAT.steel, 0, H, sz * (W / 2 - 0.1)));
    const bridge = new THREE.Group();
    bridge.add(box(0.2, 0.16, W, this.accent, 0, H + 0.02, 0));
    bridge.add(box(0.1, H - BH - 0.45, 0.1, MAT.steel, 0, (H + BH + 0.4) / 2, 0));
    bridge.add(box(0.5, 0.05, 0.9, MAT.bodyDark, 0, BH + 0.4, 0));
    g.add(bridge);
    this.anim.push(ctx => { if (ctx.status === 'working') bridge.position.x = Math.sin(ctx.t * 1.6) * (L / 2 - 0.6); });
  }

  stringSlot(i) {
    if (i >= 12) return null;
    const { L, W } = this.f;
    return [-L / 2 + 1.15, BH + 0.01, -W / 2 + 0.4 + i * (W - 0.8) / 11];
  }

  // Laminasyon: Besleme · 1. Oda · 2. Oda · Soğutma
  _laminator() {
    const { L, W, H } = this.f;
    const g = this.group;
    const zl = L / 4;
    const cx = i => -L / 2 + zl * (i + 0.5);
    this._base(L, W, W - 0.3);

    // besleme rafı: açık çerçeve
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(0.08, H - BH, 0.08, MAT.steel, cx(0) + sx * (zl / 2 - 0.1), (BH + H) / 2, sz * (W / 2 - 0.08)));
    }
    g.add(box(zl, 0.06, W, MAT.steel, cx(0), H, 0));

    // ısıtma odaları: yarı saydam pres kabini, doluyken ışır
    this.rooms = [0xef4444, 0xf97316].map((hot, i) => {
      const mat = this._own(new THREE.MeshStandardMaterial({
        color: 0x2a1410, emissive: hot, emissiveIntensity: 0.04, transparent: true, opacity: 0.5,
        roughness: 0.3, depthWrite: false }));
      g.add(box(zl - 0.15, H - BH, W - 0.1, mat, cx(i + 1), BH + (H - BH) / 2, 0, false));
      g.add(box(zl - 0.05, 0.14, W, MAT.steel, cx(i + 1), H + 0.07, 0));
      for (const sz of [-1, 1]) g.add(box(zl - 0.4, 0.08, 0.08, this.accent, cx(i + 1), H + 0.18, sz * (W / 2 - 0.3)));
      return mat;
    });

    // soğutma: açık çerçeve, tavanda fanlar
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(box(0.08, H - BH, 0.08, MAT.steel, cx(3) + sx * (zl / 2 - 0.1), (BH + H) / 2, sz * (W / 2 - 0.08)));
    }
    g.add(box(zl - 0.1, 0.06, W - 0.1, MAT.bodyDark, cx(3), H, 0));
    const coolMat = this._own(new THREE.MeshStandardMaterial({ color: 0x0e3a4a, emissive: 0x22d3ee, emissiveIntensity: 0.05 }));
    const fans = [-0.8, 0.8].map(z => cylinder(0.5, 0.06, coolMat, cx(3), H + 0.06, z));
    fans.forEach(f => g.add(f));
    const blades = fans.map(f => {
      const b = box(0.9, 0.02, 0.12, MAT.steel, f.position.x, H + 0.1, f.position.z, false);
      g.add(b);
      return b;
    });

    // bölme ayraçları
    for (let i = 1; i < 4; i++) g.add(box(0.06, H - BH + 0.1, W, MAT.steel, -L / 2 + zl * i, BH + (H - BH) / 2, 0));

    this.anim.push(ctx => {
      const rt = ctx.rt;
      const pulse = 0.85 + 0.2 * Math.sin(ctx.t * 3);
      this.rooms[0].emissiveIntensity = rt.lamRoom1 ? pulse : 0.04;
      this.rooms[1].emissiveIntensity = rt.lamRoom2 ? pulse : 0.04;
      const cooling = rt.lamCooling.length > 0;
      coolMat.emissiveIntensity = cooling ? 0.8 : 0.05;
      if (cooling) blades.forEach(b => { b.rotation.y += ctx.dt * 9; });
    });
    this._zoneX = cx;
  }

  // zi: 0 besleme · 1 oda1 · 2 oda2 · 3 soğutma; iki sütun, katlar halinde
  zoneSlot(zi, i) {
    if (i >= 12) return null;
    return [this._zoneX(zi), BH + 0.02 + Math.floor(i / 2) * 0.1, i % 2 ? 0.62 : -0.62];
  }

  // Buffer / kürleme rafı. colsX: akış yönündeki sütun sayısı; enine her zaman 2 sütun
  _rack(s, colsX, tent) {
    const { L, W, H } = this.f;
    const g = this.group;
    const perLevel = 2 * colsX;
    const levels = Math.min(10, Math.max(1, Math.ceil(Math.max(1, s.buffer_capacity) / perLevel)));
    const gap = (H - 0.45) / levels;
    g.add(box(L, 0.1, W, MAT.plinth, 0, 0.05, 0));
    for (let c = 0; c <= colsX; c++) for (const sz of [-1, 1]) {
      g.add(box(0.1, H, 0.1, this.accent, -L / 2 + 0.05 + c * (L - 0.1) / colsX, H / 2, sz * (W / 2 - 0.05)));
    }
    for (let k = 0; k < levels; k++) g.add(box(L - 0.1, 0.04, W - 0.1, MAT.steel, 0, 0.25 + k * gap, 0, false));
    g.add(box(L, 0.12, W, this.accent, 0, H, 0));
    if (tent) g.add(box(L + 0.3, H + 0.15, W + 0.3, MAT.tent, 0, (H + 0.15) / 2, 0, false));

    this._rackSlot = i => {
      if (i >= levels * perLevel) return null;
      const k = Math.floor(i / perLevel), r = i % perLevel;
      const x = colsX > 1 ? ((r % colsX) - (colsX - 1) / 2) * (L / colsX) : 0;
      const z = Math.floor(r / colsX) ? 0.62 : -0.62;
      return [x, 0.25 + k * gap + 0.04, z];
    };
  }

  rackSlot(i) { return this._rackSlot(i); }

  // Sınıflandırma: ayırıcı bant + iki yanda 8 hazne paleti
  _sorter(s) {
    const { L, W, H } = this.f;
    const g = this.group;
    this._base(L, 1.9);
    for (const sx of [-1, 1]) g.add(box(0.14, H - BH, 0.14, MAT.steel, sx * (L / 2 - 0.1), (BH + H) / 2, 0));
    g.add(box(L, 0.16, 0.22, this.accent, 0, H, 0));
    const pusher = box(0.3, 0.5, 0.3, MAT.bodyDark, 0, H - 0.35, 0);
    g.add(pusher);
    this.anim.push(ctx => { if (ctx.status === 'working') pusher.position.x = Math.sin(ctx.t * 5) * (L / 2 - 0.5); });

    this.binStacks = [];
    for (let i = 0; i < 8; i++) {
      const px = ((i % 4) - 1.5) * 1.3, pz = (i < 4 ? -1 : 1) * (W / 2 - 1.3);
      g.add(box(1.2, 0.14, 2.35, MAT.wood, px, 0.07, pz));
      const stack = box(1.13, 1, 2.28, accentMat(BIN_COLORS[i]), px, 0.14, pz);
      stack.visible = false;
      g.add(stack);
      this.binStacks.push(stack);
    }
    this.anim.push(ctx => {
      const bins = ctx.station.bins;
      this.binStacks.forEach((st, i) => {
        const n = ctx.rt.binCounts[i] ?? 0;
        const h = bins[i] ? Math.min(1, n / Math.max(1, bins[i].capacity)) * PALLET_FULL_H : 0;
        st.visible = h > 0;
        if (h > 0) { st.scale.y = h; st.position.y = 0.14 + h / 2; }
      });
    });
  }

  // Depo sahası (sınıflandırmanın arkası): hazne başına bir sıra palet
  yardSlot(bin, k) {
    if (bin >= 8 || k >= 24) return null;
    const { L } = this.f;
    return [L / 2 + 3.2 + Math.floor(k / 2) * 1.4, 0.07 + (k % 2) * (PALLET_FULL_H + 0.18), (bin - 3.5) * 2.7];
  }

  yardRect() {
    const { L } = this.f;
    return { x0: L / 2 + 2.2, x1: L / 2 + 2.2 + 18, z0: -11.4, z1: 11.4 };
  }

  dispose() {
    for (const x of this.owned) x.dispose();
  }
}

const DIM_STATES = new Set(['idle', 'break', 'offshift']);
const MARK_MAT = new THREE.LineBasicMaterial({ color: SCENE_COLORS.walkway, transparent: true, opacity: 0.8 });
const SELECT_MAT = new THREE.LineBasicMaterial({ color: SCENE_COLORS.select });
const HOVER_MAT = new THREE.LineBasicMaterial({ color: SCENE_COLORS.hover });

export { PALLET_FULL_H };
