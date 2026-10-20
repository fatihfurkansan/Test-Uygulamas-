// ─────────────────────────────────────────
//  SÜREÇ KÜTÜPHANESİ (sol çekmece)
// ─────────────────────────────────────────
// Gruplu ve aranabilir istasyon tipleri. İki kip:
//   after  bir istasyon seçiliyken: seçilen süreç onun sonrasına eklenir, bağlanır ve yeni istasyon
//          seçilir — süreçlere art arda dokunarak hat sırayla kurulur
//   place  serbest yerleştirme: süreç seçilir, zemine tıklanır
import { STATION_CATALOG, GROUPS, stationTag } from '../core/index.js';
import { kindTone } from '../view3d/materials.js';
import { esc, ICON } from './ui.js';

const CAT_NAME = { process: 'İşlem', inspection: 'Test', buffer: 'Ara stok', curing: 'Kürleme', classification: 'Hat sonu' };

export class Palette {
  constructor(el, editor, { touch = false } = {}) {
    this.el = el;
    this.editor = editor;
    this.session = editor.session;
    this.touch = touch;
    this.mode = 'place';
    el.innerHTML = `<div class="pv-pal-head"><span class="cap">Süreç kütüphanesi</span>`
      + `<button class="pv-x" data-act="close" aria-label="Kapat">${ICON.close}</button></div>`
      + `<div class="pv-pal-mode" role="group" aria-label="Ekleme biçimi">`
      + `<button data-mode="after">Sonrasına ekle</button><button data-mode="place">Zemine yerleştir</button></div>`
      + `<p class="pv-pal-anchor"></p>`
      + `<input class="pv-search" type="search" placeholder="Süreç ara…" aria-label="Süreç ara">`
      + `<div class="pv-pal-list"></div>`
      + `<p class="pv-hint"></p>`;
    this.list = el.querySelector('.pv-pal-list');
    this.search = el.querySelector('.pv-search');
    this.search.addEventListener('input', () => this._render());
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'close') { this.onClose?.(); return; }
      if (b.dataset.mode) { this.setMode(b.dataset.mode); return; }
      if (!b.dataset.kind) return;
      const kind = b.dataset.kind;
      if (this.mode === 'after' && this.anchor != null) {
        editor.insertAfter(this.anchor, kind);
        return;
      }
      if (editor.placing === kind) editor.cancel();
      else { editor.startPlacement(kind); this.onPick?.(kind); }
    });
    // istasyon seçilince (ör. ilk istasyon yerleşince) sıradaki süreçler onun ardına eklenir
    this._off = this.session.on('select', () => {
      if (this.anchor != null && !editor.placing) this.mode = 'after';
      this.sync();
    });
    this._render();
  }

  get anchor() { return this.session.selectedId; }

  // Panel açılırken: istasyon seçiliyse "sonrasına ekle", değilse serbest yerleştirme
  open() {
    this.mode = this.anchor != null ? 'after' : 'place';
    this.sync();
  }

  setMode(mode) {
    if (mode === 'after' && this.anchor == null) return;
    this.mode = mode;
    if (mode === 'after') this.editor.cancel();
    this.sync();
  }

  _render() {
    const q = this.search.value.trim().toLocaleLowerCase('tr');
    const items = Object.entries(STATION_CATALOG).filter(([k, v]) =>
      !q || v.name.toLocaleLowerCase('tr').includes(q) || v.code.toLocaleLowerCase('tr').includes(q) || k.includes(q));
    this.list.innerHTML = GROUPS.map(g => {
      const its = items.filter(([, v]) => v.group === g.id);
      if (!its.length) return '';
      return `<div class="pv-pal-group"><h4 class="cap">${g.name}</h4>`
        + its.map(([k, v]) => `<button class="pv-pal-item" data-kind="${k}" aria-pressed="false">`
          + `<span class="pv-tag" style="--tone:${kindTone(k, v.category)}">${v.code}</span>`
          + `<span><b>${esc(v.name)}</b><small>${v.cycle ? `${v.cycle} sn · ` : ''}${CAT_NAME[v.category]}</small></span>`
          + `<i class="pv-pal-plus">${ICON.plus}</i></button>`).join('')
        + `</div>`;
    }).join('') || '<p class="pv-muted">Eşleşen süreç yok.</p>';
    this.sync();
  }

  sync() {
    if (this.mode === 'after' && this.anchor == null) this.mode = 'place';
    const after = this.mode === 'after';
    this.el.classList.toggle('after', after);
    for (const b of this.el.querySelectorAll('[data-mode]')) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode));
      if (b.dataset.mode === 'after') b.disabled = this.anchor == null;
    }
    const s = this.session.layout.stations.get(this.anchor);
    this.el.querySelector('.pv-pal-anchor').innerHTML = after && s
      ? `<span class="pv-tag">${stationTag(s)}</span><b>${esc(s.name)}</b><span>sonrasına</span>` : '';
    this.el.querySelector('.pv-hint').innerHTML = after
      ? 'Dokunduğunuz süreç seçili istasyonun ardına eklenir ve bağlanır; yeni istasyon seçilir. Süreçlere sırayla dokunarak hattı kurun.'
      : this.touch ? 'Bir süreç seçin, sonra zemine dokunun. Bir istasyon seçerseniz süreçler onun ardına eklenir.'
        : 'Bir süreç seçip zemine tıklayın. <b>Shift</b> ile art arda yerleştirin, <b>Esc</b> iptal. Bir istasyon seçerseniz süreçler onun ardına eklenir.';
    for (const b of this.list.querySelectorAll('[data-kind]')) {
      b.setAttribute('aria-pressed', String(!after && this.editor.placing === b.dataset.kind));
    }
  }

  dispose() {
    this._off?.();
  }
}
