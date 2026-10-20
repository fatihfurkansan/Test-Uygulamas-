// ─────────────────────────────────────────
//  3D HAT GÖRÜNÜMÜ
// ─────────────────────────────────────────
// SimSession'daki yerleşimi ve motoru okur, çizer. Motoru ilerletmez (bu, app katmanının işi).
// Modlar: '3d' (yörünge kamera) | 'top' (üstten ortografik plan — Python 2D canvas'ın karşılığı)
import * as THREE from '../../vendor/three/three.module.min.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from '../../vendor/three/CSS2DRenderer.js';
import { stationFrame, conveyorRoute, pointAt, conveyorItemDistances, layoutBounds,
         BELT_HEIGHT as BH } from './geometry.js';
import { SCENE_COLORS, GEO, beltTexture } from './materials.js';
import { Machine } from './machines.js';
import { ConveyorMesh } from './conveyors.js';
import { ProductLayer } from './products.js';
import { stationLabelHTML } from './labels.js';

const PANEL_GAP = 2.45;        // konveyörde arka arkaya bekleyen paneller arası (m)
const STRING_GAP = 2.3;
const LAYUP_STRING_COLOR = '#93C5FD';
const LABEL_HZ = 4;
const LABEL_PX_M = [8, 14];    // ekranda metre başına piksel: altında sadece kod / sadece isim, üstünde ayrıntı
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ONE = new THREE.Vector3(1, 1, 1);

export class LineView3D {
  constructor(container, session) {
    this.container = container;
    this.session = session;
    this.mode = '3d';
    this.showLabels = true;
    this.machines = new Map();
    this.conveyors = new Map();
    this.hoverId = null;          // fare altındaki istasyon
    this.hoverConv = null;        // fare altındaki konveyör
    this._rev = -1;
    this._t = 0;
    this._labelT = Infinity;
    this._domLabels = [];
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._local = new THREE.Matrix4();
    this._world = new THREE.Matrix4();

    // Telefon / tablette piksel oranı ve gölge çözünürlüğü düşürülür (akıcılık ve pil)
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'pvsim-canvas';
    container.appendChild(r.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'pvsim-labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_COLORS.background);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xaeaca6, 2.1));
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.products = new ProductLayer(this.scene);

    this.persp = new THREE.PerspectiveCamera(40, 1, 0.5, 4000);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500);
    this.ortho.up.set(0, 0, -1);            // ekranın üstü -Z: 2D plandaki gibi y aşağı
    this.ctl3d = new OrbitControls(this.persp, r.domElement);
    Object.assign(this.ctl3d, { enableDamping: true, dampingFactor: 0.12, maxPolarAngle: Math.PI * 0.47,
                                minDistance: 4, maxDistance: 900 });
    this.ctlTop = new OrbitControls(this.ortho, r.domElement);
    Object.assign(this.ctlTop, { enableRotate: false, screenSpacePanning: true, enableDamping: true,
                                 dampingFactor: 0.15, minZoom: 0.25, maxZoom: 25, enabled: false });
    this.ctlTop.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.ctlTop.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    // Kullanıcı kamerayı oynatana kadar görünüm boyutu değişince (telefonu çevirme, tam ekran) hat yeniden sığdırılır
    this._autoFit = true;
    for (const c of [this.ctl3d, this.ctlTop]) c.addEventListener('start', () => { this._autoFit = false; });

    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._unsub = [
      session.on('layout', () => this.rebuild(true)),
      session.on('select', () => this._applyHighlight()),
      session.on('edit', () => { this._labelT = Infinity; }),
      session.on('sim:start', e => { const m = this.machines.get(e.station.id); if (m) m.flash = 1; }),
    ];
    this._resizeObs = new ResizeObserver(() => this._resize());
    this._resizeObs.observe(container);
    this.rebuild(true);
    this._resize();
  }

  get camera() { return this.mode === 'top' ? this.ortho : this.persp; }
  get controls() { return this.mode === 'top' ? this.ctlTop : this.ctl3d; }

  // ──────────────────────────────────────
  //  SAHNE KURULUMU
  // ──────────────────────────────────────
  rebuild(reframe = false) {
    const L = this.session.layout;
    this._disposeWorld();

    this.frames = new Map([...L.stations.values()].map(s => [s.id, stationFrame(L, s)]));
    for (const s of L.stations.values()) {
      const m = new Machine(s, this.frames.get(s.id));
      this.machines.set(s.id, m);
      this.world.add(m.group);
      m.label = this._label(m.group, [0, m.f.H + 0.9, 0]);
    }
    for (const c of L.conveyors.values()) {
      const fa = this.frames.get(c.from_id), fb = this.frames.get(c.to_id);
      if (!fa || !fb) continue;
      const cm = new ConveyorMesh(c, conveyorRoute(fa, fb));
      this.conveyors.set(c.id, cm);
      this.world.add(cm.group);
    }
    this.world.updateMatrixWorld(true);

    // Sınıflandırma istasyonlarının arkasında depo sahası
    const extra = [];
    this.yards = [];
    for (const m of this.machines.values()) {
      if (m.cat !== 'classification') continue;
      const r = m.yardRect();
      const corners = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]
        .map(([x, z]) => m.group.localToWorld(new THREE.Vector3(x, 0.015, z)));
      const geo = new THREE.BufferGeometry().setFromPoints([...corners, corners[0]]);
      const line = new THREE.Line(geo, YARD_MAT);
      line.computeLineDistances();
      this.world.add(line);
      corners.forEach(p => extra.push(p));
      const label = this._label(m.group, [(r.x0 + r.x1) / 2, 0.5, r.z0 - 0.8]);
      this.yards.push({ machine: m, label, counts: null, warehouseLen: -1 });
    }

    const b = layoutBounds([...this.frames.values()], 8);
    for (const p of extra) {
      b.minX = Math.min(b.minX, p.x - 4); b.maxX = Math.max(b.maxX, p.x + 4);
      b.minZ = Math.min(b.minZ, p.z - 4); b.maxZ = Math.max(b.maxZ, p.z + 4);
    }
    Object.assign(b, { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, w: b.maxX - b.minX, d: b.maxZ - b.minZ });
    this.bounds = b;
    this._buildEnvironment();

    this._hitList = [...this.machines.values()].map(m => m.hit);
    this._convHits = [...this.conveyors.values()].flatMap(c => c.hits);
    this._placeLabels();
    this._rev = L.revision;
    this._labelT = Infinity;
    if (reframe) this.resetCamera();
    this._applyHighlight();
  }

  _label(parent, pos) {
    const anchor = document.createElement('div');
    const el = document.createElement('div');
    el.className = 'pvsim-lbl';
    anchor.appendChild(el);
    const obj = new CSS2DObject(anchor);
    obj.position.set(...pos);
    parent.add(obj);
    this._domLabels.push(anchor);
    return { obj, el, html: '' };
  }

  _buildEnvironment() {
    const b = this.bounds;
    const size = Math.ceil((Math.max(b.w, b.d) + 80) / 20) * 20;
    const env = this.env = new THREE.Group();

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 2, size * 2).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: SCENE_COLORS.floor, roughness: 0.92 }));
    floor.position.set(b.cx, 0, b.cz);
    floor.receiveShadow = true;
    env.add(floor);

    const grid = new THREE.GridHelper(size, size / 2, SCENE_COLORS.gridMajor, SCENE_COLORS.gridMinor);
    grid.position.set(b.cx, 0.004, b.cz);
    grid.material.transparent = true;
    grid.material.opacity = 0.8;
    env.add(grid);

    // Hat çevresinde yürüme yolu çizgisi
    const w = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ], [b.minX, b.minZ]]
      .map(([x, z]) => new THREE.Vector3(x, 0.01, z));
    const walk = new THREE.Line(new THREE.BufferGeometry().setFromPoints(w), WALK_MAT);
    walk.computeLineDistances();
    env.add(walk);
    this.world.add(env);

    const sun = this.sun;
    sun.position.set(b.cx - size * 0.3, size * 0.75, b.cz + size * 0.35);
    sun.target.position.set(b.cx, 0, b.cz);
    const sc = sun.shadow.camera;
    const half = Math.max(b.w, b.d) * 0.72;
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, near: 1, far: size * 3 });
    sc.updateProjectionMatrix();
    this._fog = new THREE.Fog(SCENE_COLORS.background, size * 1.3, size * 3.2);
  }

  _disposeWorld() {
    for (const m of this.machines.values()) m.dispose();
    for (const c of this.conveyors.values()) c.dispose();
    this.world.traverse(o => {
      if ((o.isLine || o.isLineSegments) && o.parent === this.world) o.geometry.dispose();
    });
    if (this.env) {
      this.env.traverse(o => { o.geometry?.dispose(); if (o.material && o.material !== WALK_MAT) o.material.dispose(); });
      this.env = null;
    }
    this._domLabels.forEach(el => el.remove());
    this._domLabels = [];
    this.world.clear();
    this.machines.clear();
    this.conveyors.clear();
  }

  // ──────────────────────────────────────
  //  KAMERA
  // ──────────────────────────────────────
  setMode(mode) {
    this.mode = mode;
    this.ctl3d.enabled = mode === '3d';
    this.ctlTop.enabled = mode === 'top';
    this._placeLabels();
    this._labelT = Infinity;
  }

  // 3D: makinenin üstünde. Plan: makine ayak izinin ekrandaki üst kenarında (dünya -Z) ki makineyi örtmesin
  _placeLabels() {
    for (const m of this.machines.values()) {
      const { x, z, L, W, H, rotDeg } = m.f;
      const halfZ = (rotDeg % 180 === 0 ? W : L) / 2;
      const world = this.mode === 'top'
        ? new THREE.Vector3(x, H + 0.9, z - halfZ - 0.6)
        : new THREE.Vector3(x, H + 0.9, z);
      m.label.obj.position.copy(m.group.worldToLocal(world));
    }
  }

  // Hattın tamamı görüş açısına sığacak mesafe (yatay ve dikey açının dar olanına göre)
  resetCamera() {
    const b = this.bounds;
    const aspect = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
    const tv = Math.tan(this.persp.fov * Math.PI / 360);
    const dist = Math.max(b.w / 2 / (tv * aspect), b.d / 2 / tv) * 0.92 + 6;
    this.ctl3d.target.set(b.cx, 0, b.cz);
    const dir = new THREE.Vector3(-0.3, 0.62, 0.86).normalize();
    this.persp.position.copy(this.ctl3d.target).addScaledVector(dir, dist);
    this.ctl3d.update();
    this.ctlTop.target.set(b.cx, 0, b.cz);
    this.ortho.position.set(b.cx, 120, b.cz);
    this.ortho.zoom = 1;
    this._fitOrtho();
    this.ctlTop.update();
    this._tween = null;
    this._autoFit = true;
  }

  // İstasyona yumuşak geçiş
  focus(id) {
    const f = this.frames.get(id);
    if (!f) return;
    const to = new THREE.Vector3(f.x, 0, f.z);
    const ctl = this.controls, cam = this.camera;
    this._autoFit = false;
    const offset = cam.position.clone().sub(ctl.target);
    if (this.mode === '3d') offset.setLength(Math.min(offset.length(), 18 + f.L * 1.4));
    this._tween = {
      t: 0, ctl, cam,
      fromT: ctl.target.clone(), toT: to,
      fromP: cam.position.clone(), toP: to.clone().add(offset),
      fromZ: cam.zoom, toZ: this.mode === 'top' ? Math.max(cam.zoom, 3) : cam.zoom,
    };
  }

  _stepTween(dt) {
    const tw = this._tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / 0.6);
    const k = 1 - Math.pow(1 - tw.t, 3);
    tw.ctl.target.lerpVectors(tw.fromT, tw.toT, k);
    tw.cam.position.lerpVectors(tw.fromP, tw.toP, k);
    if (tw.cam.isOrthographicCamera) {
      tw.cam.zoom = tw.fromZ + (tw.toZ - tw.fromZ) * k;
      tw.cam.updateProjectionMatrix();
    }
    if (tw.t >= 1) this._tween = null;
  }

  _fitOrtho() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h || !this.bounds) return;
    const aspect = w / h;
    const b = this.bounds;
    const halfH = Math.max(b.d / 2, b.w / 2 / aspect) * 1.04;
    Object.assign(this.ortho, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    this.ortho.updateProjectionMatrix();
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    const aspectChanged = Math.abs(this.persp.aspect - w / h) > 0.01;
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this._fitOrtho();
    if (this._autoFit && aspectChanged && this.bounds) this.resetCamera();
  }

  // ──────────────────────────────────────
  //  SEÇİM
  // ──────────────────────────────────────
  // İşaretçi olayları editörde (app/editor.js); görünüm sadece seçim ve önizleme yardımcılarını sağlar.
  _ray3(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    return this._ray;
  }

  pickStation(e) {
    const hits = this._ray3(e).intersectObjects(this._hitList, false);
    return hits.length ? hits[0].object.userData.stationId : null;
  }

  pickConveyor(e) {
    const hits = this._ray3(e).intersectObjects(this._convHits, false);
    return hits.length ? hits[0].object.userData.convId : null;
  }

  // Zemin düzlemindeki nokta (metre)
  floorAt(e) {
    const p = this._ray3(e).ray.intersectPlane(FLOOR, this._v);
    return p ? { x: p.x, z: p.z } : null;
  }

  setHover(stationId, convId = null) {
    if (stationId === this.hoverId && convId === this.hoverConv) return;
    this.hoverId = stationId;
    this.hoverConv = convId;
    this._applyHighlight();
  }

  _applyHighlight() {
    const sel = this.session.selection;
    for (const [id, m] of this.machines) {
      const on = sel?.type === 'station' && sel.id === id;
      m.setHighlight(on ? 'select' : id === this.hoverId ? 'hover' : null);
      m.label?.el.classList.toggle('sel', on);
    }
    for (const [id, cm] of this.conveyors) {
      cm.setHighlight((sel?.type === 'conveyor' && sel.id === id) || id === this.hoverConv);
    }
  }

  // Yerleştirme önizlemesi: tipin ayak izi kadar yarı saydam kutu
  showGhost(size, x, z, rotDeg = 0) {
    if (!this._ghost) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: SCENE_COLORS.select, transparent: true, opacity: 0.18, depthWrite: false })));
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(GEO.box), new THREE.LineBasicMaterial({ color: SCENE_COLORS.select })));
      this.scene.add(g);
      this._ghost = g;
    }
    const [L, W, H] = size;
    this._ghost.scale.set(L, H, W);
    this._ghost.position.set(x, H / 2, z);
    this._ghost.rotation.y = -rotDeg * Math.PI / 180;
    this._ghost.visible = true;
  }

  hideGhost() {
    if (this._ghost) this._ghost.visible = false;
  }

  // Bağlama önizlemesi: kaynak istasyondan imlece kesikli çizgi
  showLink(fromId, x, z) {
    const f = this.frames.get(fromId);
    if (!f) return;
    if (!this._link) {
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      this._link = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: SCENE_COLORS.select, dashSize: 0.7, gapSize: 0.45 }));
      this._link.frustumCulled = false;
      this.scene.add(this._link);
    }
    const pos = this._link.geometry.attributes.position;
    pos.setXYZ(0, f.x, BH + 0.4, f.z);
    pos.setXYZ(1, x, BH + 0.4, z);
    pos.needsUpdate = true;
    this._link.computeLineDistances();
    this._link.visible = true;
  }

  hideLink() {
    if (this._link) this._link.visible = false;
  }

  // Sürükleme sırasında makineyi görsel olarak taşı (bırakınca yerleşim güncellenir, sahne yeniden kurulur)
  moveStationVisual(id, x, z) {
    const m = this.machines.get(id);
    if (m) m.group.position.set(x, 0, z);
  }

  // ──────────────────────────────────────
  //  KARE
  // ──────────────────────────────────────
  frame(dt) {
    const { layout: L, engine: eng } = this.session;
    if (L.revision !== this._rev) this.rebuild(false);
    this._t += dt;
    if (this.session.running) beltTexture().offset.x -= dt * 0.8;
    this._stepTween(dt);

    for (const [id, m] of this.machines) {
      const s = L.stations.get(id);
      if (!s) continue;
      m.update({ t: this._t, dt, status: eng.stationStatus(id), rt: eng.stationRuntime(id), station: s });
    }
    for (const [id, cm] of this.conveyors) {
      const c = L.conveyors.get(id);
      if (c) cm.setFill(eng.conveyorRuntime(id).items, Math.max(1, c.capacity), eng.time);
    }
    this._placeProducts(L, eng);

    this._labelT += dt;
    if (this._labelT >= 1 / LABEL_HZ) {
      this._labelT = 0;
      this._updateLabels(L, eng);
    }

    this.controls.update();
    if (this.container.clientWidth && this.container.clientHeight) {
      this.scene.fog = this.mode === '3d' ? this._fog : null;
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    }
  }

  // Ürünleri motor durumundan yerleştir (istasyon içi yerler + konveyör üzeri)
  _placeProducts(L, eng) {
    const P = this.products;
    P.begin();
    const put = (m, pos, yaw, isString, color) => {
      if (!pos) return;
      this._v.set(pos[0], pos[1], pos[2]);
      this._q.setFromAxisAngle(Y_AXIS, yaw);
      this._local.compose(this._v, this._q, ONE);
      this._world.multiplyMatrices(m.group.matrixWorld, this._local);
      if (isString) P.string(this._world, color); else P.panel(this._world, color);
    };
    const prod = (m, p, pos) => put(m, pos, 0, p.isString, p.color);

    for (const [id, m] of this.machines) {
      const s = L.stations.get(id);
      const rt = eng.stationRuntime(id);
      if (!s || !rt) continue;
      if (m.cat === 'buffer' || m.cat === 'curing') {
        rt.queue.forEach((p, i) => prod(m, p, m.rackSlot(i)));
        continue;
      }
      rt.queue.forEach((p, i) => prod(m, p, m.inStack(i)));
      if (s.kind === 'lamination') {
        rt.lamFeed.forEach((p, i) => prod(m, p, m.zoneSlot(0, i)));
        rt.lamRoom1?.items.forEach((p, i) => prod(m, p, m.zoneSlot(1, i)));
        rt.lamRoom2?.items.forEach((p, i) => prod(m, p, m.zoneSlot(2, i)));
        rt.lamCooling.forEach((p, i) => prod(m, p, m.zoneSlot(3, i)));
        continue;
      }
      const n = rt.jobs.length;
      rt.jobs.forEach((job, j) => job.items.forEach((p, k) => prod(m, p, m.work(j, n, k))));
      rt.outbox.forEach((p, i) => prod(m, p, m.outStack(i)));
      if (s.kind === 'layup') {
        for (let i = 0; i < rt.stringCount; i++) {
          const pos = m.stringSlot(i);
          if (!pos) break;
          put(m, pos, 0, true, LAYUP_STRING_COLOR);
        }
      }
    }

    for (const [id, cm] of this.conveyors) {
      const items = eng.conveyorRuntime(id).items;
      if (!items.length) continue;
      const gap = items[0].prod.isString ? STRING_GAP : PANEL_GAP;
      const ds = conveyorItemDistances(items, cm.length, eng.time, gap);
      items.forEach((it, i) => {
        const pt = pointAt(cm.pts, ds[i]);
        this._v.set(pt.x, BH + 0.02, pt.z);
        this._q.setFromAxisAngle(Y_AXIS, pt.yaw);
        this._world.compose(this._v, this._q, ONE);
        if (it.prod.isString) P.string(this._world, it.prod.color); else P.panel(this._world, it.prod.color);
      });
    }

    this._placeYards(L, eng);
    P.end();
  }

  // Depo sahası: tamamlanan paletler hazne sıralarına dizilir
  _placeYards(L, eng) {
    for (const y of this.yards) {
      const m = y.machine;
      const s = L.stations.get(m.id);
      if (!s) continue;
      if (y.warehouseLen !== eng.warehouse.length) {
        y.warehouseLen = eng.warehouse.length;
        y.counts = s.bins.map(() => 0);
        for (const p of eng.warehouse) {
          if (p.station_id !== m.id) continue;
          const bi = s.bins.findIndex(b => b.name === p.bin_name);
          if (bi >= 0) y.counts[bi]++;
        }
      }
      y.counts.forEach((n, bi) => {
        for (let k = 0; k < n; k++) {
          const pos = m.yardSlot(bi, k);
          if (!pos) break;
          this._v.set(pos[0], pos[1], pos[2]);
          this._local.makeTranslation(this._v);
          this._world.multiplyMatrices(m.group.matrixWorld, this._local);
          this.products.palletAt(this._world, bi);
        }
      });
    }
  }

  // Kamera hedefinde ekranın metre başına piksel yoğunluğu
  _pxPerMeter() {
    const h = this.container.clientHeight || 1;
    if (this.mode === 'top') return h * this.ortho.zoom / (this.ortho.top - this.ortho.bottom);
    const d = this.persp.position.distanceTo(this.ctl3d.target);
    return h / (2 * d * Math.tan(this.persp.fov * Math.PI / 360));
  }

  _updateLabels(L, eng) {
    const ppm = this._pxPerMeter();
    let level = ppm < LABEL_PX_M[0] ? 0 : ppm < LABEL_PX_M[1] ? 1 : 2;
    if (this.container.clientWidth < 640) level = Math.min(level, 1);
    for (const [id, m] of this.machines) {
      const s = L.stations.get(id);
      if (!s) continue;
      m.label.obj.visible = this.showLabels;
      if (!this.showLabels) continue;
      const html = stationLabelHTML(s, eng.stationRuntime(id), eng, eng.stationStatus(id), level);
      if (html !== m.label.html) { m.label.el.innerHTML = html; m.label.html = html; }
    }
    for (const y of this.yards) {
      y.label.obj.visible = this.showLabels;
      const total = y.counts ? y.counts.reduce((a, n) => a + n, 0) : 0;
      const html = `<div class="h"><span class="pvl-tag">DEPO</span>${level > 0 ? '<span class="nm">Palet sahası</span>' : ''}</div>`
        + (level > 1 ? `<div class="d"><em>palet<b>${total}</b></em></div>` : '');
      if (html !== y.label.html) { y.label.el.innerHTML = html; y.label.html = html; }
    }
  }

  setLabels(on) {
    this.showLabels = on;
    this._labelT = Infinity;
  }

  dispose() {
    this._unsub.forEach(off => off());
    this._resizeObs.disconnect();
    const el = this.renderer.domElement;
    this._disposeWorld();
    this.products.dispose();
    this.ctl3d.dispose();
    this.ctlTop.dispose();
    this.renderer.dispose();
    el.remove();
    this.labelRenderer.domElement.remove();
  }
}

const YARD_MAT = new THREE.LineDashedMaterial({ color: SCENE_COLORS.walkway, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.7 });
const WALK_MAT = new THREE.LineDashedMaterial({ color: SCENE_COLORS.walkway, dashSize: 1.6, gapSize: 1.0, transparent: true, opacity: 0.5 });
