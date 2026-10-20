// ─────────────────────────────────────────
//  SÜREÇ KÜTÜPHANESİ (sol çekmece)
// ─────────────────────────────────────────
// Gruplu ve aranabilir istasyon tipleri. Seçilen tip editörde yerleştirme modunu açar.
import { STATION_CATALOG, GROUPS } from '../core/index.js';
import { kindTone } from '../view3d/materials.js';
import { esc, ICON } from './ui.js';

const CAT_NAME = { process: 'İşlem', inspection: 'Test', buffer: 'Ara stok', curing: 'Kürleme', classification: 'Hat sonu' };

export class Palette {
  constructor(el, editor) {
    this.el = el;
    this.editor = editor;
    el.innerHTML = `<div class="pv-pal-head"><span class="cap">Süreç kütüphanesi</span>`
      + `<button class="pv-x" data-act="close" aria-label="Kapat">${ICON.close}</button></div>`
      + `<input class="pv-search" type="search" placeholder="Süreç ara…" aria-label="Süreç ara">`
      + `<div class="pv-pal-list"></div>`
      + `<p class="pv-hint">Bir süreç seçip zemine tıklayın. <b>Shift</b> ile art arda yerleştirin, <b>Esc</b> iptal.</p>`;
    this.list = el.querySelector('.pv-pal-list');
    this.search = el.querySelector('.pv-search');
    this.search.addEventListener('input', () => this._render());
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'close') { this.onClose?.(); return; }
      if (b.dataset.kind) {
        if (editor.placing === b.dataset.kind) editor.cancel();
        else { editor.startPlacement(b.dataset.kind); this.onPick?.(b.dataset.kind); }
      }
    });
    this._render();
  }

  _render() {
    const q = this.search.value.trim().toLocaleLowerCase('tr');
    const items = Object.entries(STATION_CATALOG).filter(([k, v]) =>
      !q || v.name.toLocaleLowerCase('tr').includes(q) || v.code.toLocaleLowerCase('tr').includes(q) || k.includes(q));
    this.list.innerHTML = GROUPS.map(g => {
      const its = items.filter(([, v]) => v.group === g.id);
      if (!its.length) return '';
      return `<div class="pv-pal-group"><h4 class="cap">${g.name}</h4>`
        + its.map(([k, v]) => `<button class="pv-pal-item" data-kind="${k}" aria-pressed="${this.editor.placing === k}">`
          + `<span class="pv-tag" style="--tone:${kindTone(k, v.category)}">${v.code}</span>`
          + `<span><b>${esc(v.name)}</b><small>${v.cycle ? `${v.cycle} sn · ` : ''}${CAT_NAME[v.category]}</small></span></button>`).join('')
        + `</div>`;
    }).join('') || '<p class="pv-muted">Eşleşen süreç yok.</p>';
  }

  sync() {
    for (const b of this.list.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(this.editor.placing === b.dataset.kind));
  }
}

