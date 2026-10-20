// ─────────────────────────────────────────
//  SİMÜLASYON OTURUMU (ortak durum)
// ─────────────────────────────────────────
// Yerleşim + motor + oynatma durumu + seçim + düzenleme geçmişi. Görünümler ve paneller
// buradan okur, değişiklikleri olaylarla duyar:
//   layout · reset · state (oynat/duraklat/hız) · select · edit · history · sim:<motor olayı>
import { Layout, SimEngine, createDefaultLayout, liveStats } from '../core/index.js';

const ENGINE_EVENTS = ['spawn', 'deliver', 'consume', 'start', 'finish', 'move', 'complete', 'pallet', 'scrap', 'failure'];
const HISTORY_LIMIT = 80;

export class SimSession {
  constructor({ layout = createDefaultLayout(), seed = 1, speed = 10 } = {}) {
    this._listeners = new Map();
    this.seed = seed;
    this.speed = speed;
    this.running = false;
    this.selection = null;         // null (hat) | {type: 'station' | 'conveyor', id}
    this._setLayout(layout);
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type)?.delete(fn);
  }

  _emit(type, payload) {
    const ls = this._listeners.get(type);
    if (ls) for (const fn of ls) fn(payload);
  }

  _setLayout(layout) {
    this.layout = layout;
    this.engine = new SimEngine(layout, { seed: this.seed });
    for (const t of ENGINE_EVENTS) this.engine.on(t, p => this._emit(`sim:${t}`, p));
    this._undo = [];
    this._redo = [];
    this._snap = JSON.stringify(layout.toJSON());
  }

  // .simjson nesnesi ya da Layout
  load(data) {
    this.pause();
    this.selection = null;
    this._setLayout(data instanceof Layout ? data : Layout.fromJSON(data));
    this._emit('layout', this.layout);
    this._emit('select', null);
    this._emit('history');
  }

  toJSON() {
    return this.layout.toJSON(this.engine);
  }

  // ── Oynatma ──
  play() {
    if (this.running) return;
    this.running = true;
    this._emit('state');
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    this._emit('state');
  }

  toggle() {
    this.running ? this.pause() : this.play();
  }

  // Simülasyonu baştan başlat (yerleşimdeki değişiklikler, ısınma ve malzeme stokları dahil)
  reset() {
    this.pause();
    this.engine.reset();
    this._emit('reset');
  }

  setSpeed(x) {
    this.speed = x;
    this._emit('state');
  }

  // Gerçek zamanda geçen süre × hız kadar simülasyonu ilerlet
  tick(realDt) {
    if (this.running) this.engine.advance(Math.min(realDt, 0.25) * this.speed);
  }

  stats() {
    return liveStats(this.layout, this.engine);
  }

  // ── Seçim ──
  get selectedId() {
    return this.selection?.type === 'station' ? this.selection.id : null;
  }

  select(id) {
    this._setSelection(id == null ? null : { type: 'station', id });
  }

  selectConveyor(id) {
    this._setSelection(id == null ? null : { type: 'conveyor', id });
  }

  _setSelection(sel) {
    const a = this.selection, b = sel;
    if (a?.type === b?.type && a?.id === b?.id) return;
    this.selection = sel;
    this._emit('select', sel);
  }

  // ── Düzenleme geçmişi ──
  // Her tamamlanmış düzenlemeden sonra çağrılır; yerleşim değişmediyse kayıt eklenmez.
  commit() {
    const now = JSON.stringify(this.layout.toJSON());
    if (now === this._snap) return;
    this._undo.push(this._snap);
    if (this._undo.length > HISTORY_LIMIT) this._undo.shift();
    this._redo = [];
    this._snap = now;
    this._emit('edit');
    this._emit('history');
  }

  get canUndo() { return this._undo.length > 0; }
  get canRedo() { return this._redo.length > 0; }

  undo() {
    if (!this._undo.length) return;
    this._redo.push(this._snap);
    this._snap = this._undo.pop();
    this._applySnapshot();
  }

  redo() {
    if (!this._redo.length) return;
    this._undo.push(this._snap);
    this._snap = this._redo.pop();
    this._applySnapshot();
  }

  _applySnapshot() {
    this.layout.restore(JSON.parse(this._snap));
    const sel = this.selection;
    if (sel && !(sel.type === 'station' ? this.layout.stations : this.layout.conveyors).has(sel.id)) {
      this._setSelection(null);
    }
    this._emit('edit');
    this._emit('history');
  }
}
