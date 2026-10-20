// ─────────────────────────────────────────
//  EDİTÖR: hattı 3D / plan görünümünde kurma
// ─────────────────────────────────────────
// Araçlar: 'select' (seç, sürükle-taşı) | 'connect' (kaynak → hedef konveyör).
// Kütüphaneden tip seçilince yerleştirme modu: zeminde önizleme, tıkla-yerleştir
// (Shift basılıysa yerleştirmeye devam eder).
// Kısayollar: V seç · C bağla · R döndür · Del sil · Ctrl+D çoğalt · Ctrl+Z / Ctrl+Y · Esc · Boşluk oynat
// Dokunmatik: tek parmak görünümü döndürür; istasyonu taşımak için üzerine basılı tutup sürükleyin.
import { catalogOf, insertAfter, addParallel, autoArrange } from '../core/index.js';

const SNAP = 0.5;                 // metre
const snap = v => Math.round(v / SNAP) * SNAP;
const HOLD_MS = 380;              // dokunmatikte taşımaya geçmek için basılı tutma süresi
const SLOP = { mouse: 5, pen: 8, touch: 12 };   // tıklama sayılan en büyük kayma (px)

export class LineEditor {
  constructor(root, view, session) {
    this.root = root;
    this.view = view;
    this.session = session;
    this.tool = 'select';
    this.placing = null;          // yerleştirilecek istasyon tipi
    this.linkFrom = null;         // bağlama kaynağı istasyon id
    this.onState = null;          // araç/mod değişince (araç çubuğu günceller)
    this._drag = null;
    this._downAt = null;
    this._hold = 0;
    this._touches = new Set();

    const el = view.renderer.domElement;
    this._handlers = {
      pointerdown: e => this._down(e),
      pointermove: e => this._move(e),
      pointerup: e => this._up(e),
      pointercancel: e => this._cancelPointer(e),
      pointerleave: () => { view.setHover(null); view.hideGhost(); },
      dblclick: e => { const id = view.pickStation(e); if (id != null) view.focus(id); },
      contextmenu: e => {
        if (this._touches.size || this._drag) { e.preventDefault(); return; }   // uzun basış menüsü açılmasın
        if (this.placing || this.linkFrom != null) { e.preventDefault(); this.cancel(); }
      },
    };
    for (const [t, fn] of Object.entries(this._handlers)) el.addEventListener(t, fn);
    this._onKey = e => this._key(e);
    root.addEventListener('keydown', this._onKey);
  }

  get layout() { return this.session.layout; }
  get dragging() { return this._drag != null; }

  _emitState() {
    this.onState?.();
    this.view.renderer.domElement.style.cursor = this.placing || this.tool === 'connect' ? 'crosshair' : '';
  }

  setTool(tool) {
    this.cancel();
    this.tool = tool;
    this._emitState();
  }

  startPlacement(kind) {
    this.linkFrom = null;
    this.view.hideLink();
    this.placing = kind;
    this._emitState();
  }

  cancel() {
    this.placing = null;
    this.linkFrom = null;
    this.view.hideGhost();
    this.view.hideLink();
    this._emitState();
  }

  // ── İşaretçi ──
  _down(e) {
    if (e.pointerType === 'touch') {
      this._touches.add(e.pointerId);
      if (this._touches.size > 1) { this._clearHold(); this._downAt = null; return; }   // iki parmak: kaydır / yakınlaştır
    }
    if (e.button !== 0) return;
    this.root.focus({ preventScroll: true });
    this._downAt = [e.clientX, e.clientY];
    this._slop = SLOP[e.pointerType] ?? 5;
    if (this.placing || this.tool !== 'select') return;
    const id = this.view.pickStation(e);
    const p = id != null ? this.view.floorAt(e) : null;
    if (!p) return;
    const f = this.view.frames.get(id);
    const drag = { id, dx: f.x - p.x, dz: f.z - p.z, x: f.x, z: f.z, x0: f.x, z0: f.z, moved: false,
                   el: e.target, pointerId: e.pointerId };
    if (e.pointerType === 'touch') {
      // Hemen sürüklemek görünümü döndürür; basılı tutunca istasyon taşınır
      this._clearHold();
      this._hold = setTimeout(() => {
        this._hold = 0;
        this._beginDrag(drag);
        this.session.select(id);
        navigator.vibrate?.(12);
      }, HOLD_MS);
      return;
    }
    this._beginDrag(drag);
  }

  _beginDrag(d) {
    this._drag = d;
    this.view.controls.enabled = false;
    d.el.setPointerCapture?.(d.pointerId);   // tuval dışında bırakılsa da pointerup gelsin
  }

  _clearHold() {
    clearTimeout(this._hold);
    this._hold = 0;
  }

  _endDrag() {
    const d = this._drag;
    this._drag = null;
    this.view.controls.enabled = true;
    return d;
  }

  _cancelPointer(e) {
    this._touches.delete(e.pointerId);
    this._clearHold();
    this._downAt = null;
    if (!this._drag) return;
    const d = this._endDrag();
    if (d.moved) this.view.moveStationVisual(d.id, d.x0, d.z0);   // yarıda kalan taşıma geri alınır
  }

  _move(e) {
    const v = this.view;
    if (this._hold && this._downAt
        && Math.hypot(e.clientX - this._downAt[0], e.clientY - this._downAt[1]) > this._slop) this._clearHold();
    if (e.pointerType === 'touch' && !this._drag && !this.placing && this.linkFrom == null) return;   // dokunmatikte üzerine gelme yok
    const p = v.floorAt(e);
    if (this.placing) {
      if (p) v.showGhost(catalogOf(this.placing).size, snap(p.x), snap(p.z));
      return;
    }
    if (this._drag) {
      if (!p) return;
      const d = this._drag;
      const x = snap(p.x + d.dx), z = snap(p.z + d.dz);
      if (x !== d.x || z !== d.z) {
        d.moved = true;
        d.x = x;
        d.z = z;
        v.moveStationVisual(d.id, x, z);
      }
      return;
    }
    if (this.linkFrom != null && p) v.showLink(this.linkFrom, p.x, p.z);
    const sid = v.pickStation(e);
    const cid = sid == null && this.tool === 'select' ? v.pickConveyor(e) : null;
    v.setHover(sid, cid);
    if (!this.placing && this.tool === 'select') v.renderer.domElement.style.cursor = sid != null || cid != null ? 'pointer' : '';
  }

  _up(e) {
    this._touches.delete(e.pointerId);
    this._clearHold();
    if (e.button !== 0) return;
    const click = this._downAt && Math.hypot(e.clientX - this._downAt[0], e.clientY - this._downAt[1]) < this._slop;
    this._downAt = null;
    const L = this.layout, S = this.session, v = this.view;

    if (this._drag) {
      const d = this._endDrag();
      if (d.moved) {
        const s = L.stations.get(d.id);
        const m = L.meta.metersPerPx;
        s.x = d.x / m;
        s.y = d.z / m;
        L.touch();
        S.commit();
        S.select(d.id);
        return;
      }
    }
    if (!click) return;

    if (this.placing) {
      const p = v.floorAt(e);
      if (!p) return;
      const kind = this.placing;
      const m = L.meta.metersPerPx;
      const s = L.addStation(kind, snap(p.x) / m, snap(p.z) / m);
      S.commit();
      if (!e.shiftKey) this.cancel();   // önce bitir: seçim değişince kütüphane "sonrasına ekle"ye geçer
      S.select(s.id);
      this.onPlaced?.(s);
      return;
    }

    const sid = v.pickStation(e);
    if (this.tool === 'connect') {
      if (sid == null) { this.linkFrom = null; v.hideLink(); return; }
      if (this.linkFrom == null) { this.linkFrom = sid; S.select(sid); return; }
      if (sid !== this.linkFrom) {
        const c = L.connect(this.linkFrom, sid);
        if (c) { S.commit(); S.selectConveyor(c.id); }
      }
      this.linkFrom = null;
      v.hideLink();
      return;
    }
    if (sid != null) S.select(sid);
    else {
      const cid = v.pickConveyor(e);
      if (cid != null) S.selectConveyor(cid); else S.select(null);
    }
  }

  // ── Komutlar ──
  deleteSelection() {
    const sel = this.session.selection;
    if (!sel) return;
    if (sel.type === 'station') this.layout.removeStation(sel.id);
    else this.layout.removeConveyor(sel.id);
    this.session.select(null);
    this.session.commit();
  }

  // Seçili istasyonun sonrasına ekle (ardıllar yeni istasyona bağlanır); yeni istasyon seçilir
  insertAfter(fromId, kind) {
    const s = insertAfter(this.layout, fromId, kind);
    if (!s) return null;
    this.session.commit();
    this.session.select(s.id);
    return s;
  }

  addParallelSelection() {
    const s = addParallel(this.layout, this.session.selectedId);
    if (!s) return;
    this.session.commit();
    this.session.select(s.id);
  }

  // Akışa göre otomatik yerleşim (serpantin); kamera hattı yeniden sığdırır
  arrange() {
    if (!this.layout.stations.size) return;
    autoArrange(this.layout);
    this.session.commit();
    this.view.rebuild(true);
  }

  rotateSelection() {
    const id = this.session.selectedId;
    const s = this.layout.stations.get(id);
    if (!s) return;
    const cur = s.rot ?? this.view.frames.get(id)?.rotDeg ?? 0;
    s.rot = (cur + 90) % 360;
    this.layout.touch();
    this.session.commit();
  }

  duplicateSelection() {
    const id = this.session.selectedId;
    if (id == null) return;
    const s = this.layout.duplicateStation(id);
    if (!s) return;
    this.session.commit();
    this.session.select(s.id);
  }

  _key(e) {
    if (e.target.closest('input, select, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { this.session.undo(); e.preventDefault(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { this.session.redo(); e.preventDefault(); return; }
    if (mod && k === 'd') { this.duplicateSelection(); e.preventDefault(); return; }
    if (mod) return;
    switch (k) {
      case 'escape':
        if (this.placing || this.linkFrom != null) this.cancel(); else this.session.select(null);
        break;
      case 'delete': case 'backspace': this.deleteSelection(); break;
      case 'r': this.rotateSelection(); break;
      case 'v': this.setTool('select'); break;
      case 'c': this.setTool('connect'); break;
      case ' ': this.session.toggle(); break;
      default: return;
    }
    e.preventDefault();
  }

  dispose() {
    this._clearHold();
    const el = this.view.renderer.domElement;
    for (const [t, fn] of Object.entries(this._handlers)) el.removeEventListener(t, fn);
    this.root.removeEventListener('keydown', this._onKey);
  }
}
