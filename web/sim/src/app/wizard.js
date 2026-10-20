// ─────────────────────────────────────────
//  YENİ HAT SİHİRBAZI
// ─────────────────────────────────────────
// Hedef kapasite ve standart PV süreç adımları → makine sayıları, çevrimler → bağlı ve yerleşmiş hat.
// Her adımın kapasitesi ve hedefteki yükü yazdıkça güncellenir; "Öner" makine sayılarını hedefe göre ayarlar.
import { catalogOf, defaultSteps, stepRate, suggestStep, buildLine, qualityForecast } from '../core/index.js';
import { kindTone } from '../view3d/materials.js';
import { esc, num, ICON } from './ui.js';

const SECTIONS = [
  ['Hücre ve string', ['laser', 'cellbuf', 'stringer']],
  ['Cam kolu (layup\'a besler)', ['glass', 'eva']],
  ['Dizim', ['layup', 'ctape', 'busbar', 'reva', 'back', 'elvi1']],
  ['Laminasyon', ['lambuf', 'lam', 'flip', 'trim', 'etape', 'tremove']],
  ['Son işlemler', ['framebuf', 'frame', 'jbox', 'pot', 'cure', 'clean']],
  ['Test ve hat sonu', ['iv', 'hipot', 'elvi2', 'vi', 'fqc', 'label', 'pack', 'sort']],
];
// Kalite senaryosu satırları (akış sırasıyla); laminasyondan önceki testte tamir seçilebilir
const QUALITY = ['stringer', 'elvi1', 'iv', 'hipot', 'elvi2', 'vi', 'fqc'];
const STORE = 'pvsim.wizard.v2';
const PROCESS_ORDER = defaultSteps().map(s => s.id);

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
};
const save = spec => {
  try { localStorage.setItem(STORE, JSON.stringify(spec)); } catch { /* depolama kapalı */ }
};

function freshSpec() {
  return { target: 60, spp: 6, shifts: 3, shiftHours: 8, product: 'Modül', bom: false, steps: defaultSteps() };
}

export class LineWizard {
  constructor(host, { onBuild }) {
    this.onBuild = onBuild;
    const el = this.el = document.createElement('div');
    el.className = 'pv-wiz';
    el.hidden = true;
    host.appendChild(el);
    el.addEventListener('input', e => this._input(e));
    el.addEventListener('change', e => this._input(e));
    el.addEventListener('click', e => this._click(e));
  }

  get open() { return !this.el.hidden; }

  show() {
    const saved = load();
    // kayıtlı seçimler, şablondaki yeni adımlarla birleştirilir
    this.spec = saved?.steps ? { ...freshSpec(), ...saved, steps: defaultSteps().map(d => ({ ...d, ...saved.steps.find(s => s.id === d.id) })) }
      : freshSpec();
    this.el.hidden = false;
    this.render();
    this.el.scrollTop = 0;
  }

  hide() { this.el.hidden = true; }

  render() {
    const sp = this.spec;
    const fld = (label, key, value, unit = '', type = 'number') => `<label class="pv-field"><span>${label}</span><span class="pv-in">`
      + `<input type="${type}" ${type === 'number' ? 'step="any" min="0"' : ''} data-g="${key}" value="${esc(value)}">${unit ? `<em>${unit}</em>` : ''}</span></label>`;
    const steps = new Map(sp.steps.map(s => [s.id, s]));
    this.el.innerHTML = `<div class="pv-rep-head"><div><h2>Yeni hat sihirbazı</h2>`
      + `<small>Süreç adımlarını seçin, makine sayısı ve çevrimleri girin. Hat bağlanmış ve yerleşmiş olarak kurulur; sonra her şeyi düzenleyebilirsiniz.</small></div>`
      + `<div class="pv-rep-actions"><button class="pv-ibtn" data-act="close" aria-label="Kapat">${ICON.close}</button></div></div>`
      + `<div class="pv-wiz-body">`
      + `<section class="pv-sec pv-wiz-goal"><h3 class="cap">Hedef</h3><div class="pv-wiz-grid">`
      + fld('Hedef kapasite', 'target', sp.target, 'modül/sa') + fld('Panel başına string', 'spp', sp.spp, 'adet')
      + fld('Vardiya / gün', 'shifts', sp.shifts) + fld('Vardiya süresi', 'shiftHours', sp.shiftHours, 'saat')
      + fld('Ürün adı', 'product', sp.product, '', 'text') + `</div>`
      + `<div class="pv-actions pv-wiz-acts"><button class="pv-tbtn" data-act="suggest">${ICON.fast}Makine sayılarını hedefe göre öner</button>`
      + `<button class="pv-tbtn" data-act="defaults">${ICON.reset}Varsayılanlar</button></div></section>`
      + `<div class="pv-wiz-sum" data-sum></div>`
      + this._quality(steps)
      + SECTIONS.map(([title, ids]) => `<section class="pv-sec"><h3 class="cap">${title}</h3>`
        + `<div class="pv-wiz-head"><span>Süreç</span><span>Makine</span><span>Çevrim</span><span>Ek</span><span>Hedefte yük</span></div>`
        + ids.map(id => this._row(steps.get(id))).join('') + `</section>`).join('')
      + `</div><div class="pv-wiz-foot"><label class="pv-check"><input type="checkbox" data-g="bom"${sp.bom ? ' checked' : ''}>Standart PV malzeme listesi (BOM) ekle</label>`
      + `<span class="pv-wiz-sp"></span><button class="pv-tbtn" data-act="close">İptal</button>`
      + `<button class="pv-tbtn pri" data-act="build">${ICON.plus}Hattı oluştur</button></div>`;
    this._update();
  }

  _row(st) {
    const info = catalogOf(st.kind);
    const isBuf = st.kind === 'buffer', isCure = st.kind === 'curing';
    const input = (f, v, unit, o = '') => `<span class="pv-in"><input type="number" step="any" min="0" data-s="${st.id}" data-f="${f}" value="${v}"${o}>${unit ? `<em>${unit}</em>` : ''}</span>`;
    const machines = isBuf || isCure ? '<span class="pv-muted">—</span>' : input('n', st.n, 'adet', ' step="1" min="1"');
    const cycle = isBuf ? '<span class="pv-muted">—</span>' : input('cycle', st.cycle, 'sn');
    let extra = '<span></span>';
    if (isBuf || isCure) extra = input('cap', st.cap, isBuf ? 'yer' : 'fırında');
    else if (st.kind === 'lamination') extra = input('batch', st.batch, 'parti');
    else if (st.fpy != null || st.ok != null) extra = `<small class="pv-muted" data-qnote="${st.id}"></small>`;
    const unitNote = (st.branch === 'cell' || st.branch === 'string') && !isBuf ? '<small>çevrim string başına</small>' : '';
    return `<div class="pv-wiz-row${st.on || st.required ? '' : ' off'}" data-row="${st.id}">`
      + `<label class="pv-wiz-name"><input type="checkbox" data-s="${st.id}" data-f="on"${st.on || st.required ? ' checked' : ''}${st.required ? ' disabled' : ''}>`
      + `<span class="pv-tag" style="--tone:${kindTone(st.kind, info.category)}">${info.code}</span>`
      + `<span><b>${esc(st.name)}</b>${unitNote}</span></label>`
      + `<span class="pv-wiz-c" data-l="Makine">${machines}</span><span class="pv-wiz-c" data-l="Çevrim">${cycle}</span>`
      + `<span class="pv-wiz-c" data-l="">${extra}</span><span class="pv-wiz-load" data-rate="${st.id}"></span></div>`;
  }

  // Kalite senaryosu: stringer NG + her test noktasının FPY'si, hatalı kararı, NG kararı
  _quality(steps) {
    const lamAt = PROCESS_ORDER.indexOf('lam');
    const inp = (st, f, v, unit, o = '') => `<span class="pv-in"><input type="number" step="any" min="0" max="100" data-s="${st.id}" data-f="${f}" value="${v}"${o}>`
      + `${unit ? `<em>${unit}</em>` : ''}</span>`;
    const rows = QUALITY.map(id => steps.get(id)).filter(Boolean).map(st => {
      const info = catalogOf(st.kind);
      const tag = `<span class="pv-tag" style="--tone:${kindTone(st.kind, info.category)}">${info.code}</span>`;
      if (st.kind === 'stringer') {
        return `<div class="pv-wiz-q" data-qrow="${st.id}"><span class="pv-wiz-name">${tag}<span><b>Stringer</b><small>string kontrolü</small></span></span>`
          + `<span class="pv-wiz-c" data-l="Sağlam string">${inp(st, 'ok', st.ok ?? 100, '%')}</span><span class="pv-wiz-c"></span>`
          + `<span class="pv-wiz-c" data-l="NG olursa"><span class="pv-muted">Ayrılır (string hurdası)</span></span><span class="pv-wiz-c"></span></div>`;
      }
      const pre = PROCESS_ORDER.indexOf(st.id) < lamAt;
      const opts = [...(pre ? [['rework', 'Tamir']] : []), ['downgrade', 'B kalite'], ['scrap', 'Hurda']];
      const action = !pre && st.action === 'rework' ? 'downgrade' : st.action;
      const rw = pre ? `<span class="pv-wiz-rw" data-rw="${st.id}" title="Tamir başarısı ve tamir süresi">${inp(st, 'reworkSuccess', st.reworkSuccess ?? 90, '% başarı')}`
        + `${inp(st, 'reworkCycle', st.reworkCycle ?? 240, 'sn')}</span>` : '';
      return `<div class="pv-wiz-q" data-qrow="${st.id}"><span class="pv-wiz-name">${tag}<span><b>${esc(st.name)}</b>`
        + `<small>${pre ? 'laminasyon öncesi · tamir edilebilir' : 'laminasyon sonrası · tamir yok'}</small></span></span>`
        + `<span class="pv-wiz-c" data-l="FPY (sağlam gelen)">${inp(st, 'fpy', st.fpy ?? 100, '%')}</span>`
        + `<span class="pv-wiz-c" data-l="Hatalı karar">${inp(st, 'err', st.err ?? 0, '%')}</span>`
        + `<span class="pv-wiz-c" data-l="NG olursa"><span class="pv-in"><select data-s="${st.id}" data-f="action">`
        + opts.map(([v, t]) => `<option value="${v}"${v === action ? ' selected' : ''}>${t}</option>`).join('') + `</select></span></span>`
        + `<span class="pv-wiz-c" data-l="${pre ? 'Tamir' : ''}">${rw}</span></div>`;
    }).join('');
    return `<section class="pv-sec pv-wiz-quality"><h3 class="cap">Kalite senaryosu</h3>`
      + `<p class="pv-hint">FPY: o kontrol noktasına panellerin yüzde kaçının sağlam geldiği. Hatalı karar: NG'yi geçirme ve sağlamı NG sayma oranı`
      + ` (ikisi de bu değer). Tamir yalnız laminasyon öncesi tespitte yapılır; sonrasında NG panel B kaliteye düşer ya da hurdaya gider.`
      + ` EL / görsel testler çatlak gibi hataları, IV ve Hi-Pot yalnız elektriksel hataları görür.</p>`
      + `<div class="pv-wiz-qhead"><span>Kontrol noktası</span><span>FPY / sağlam</span><span>Hatalı karar</span><span>NG olursa</span><span>Tamir</span></div>`
      + rows + `<div class="pv-wiz-qres" data-qres></div></section>`;
  }

  // Kapasite ve yük göstergeleri (girişlere dokunmadan)
  _update() {
    const sp = this.spec;
    const active = sp.steps.filter(s => s.on || s.required);
    const rates = new Map(active.map(s => [s.id, stepRate(s, sp.spp)]));
    let bn = null;
    for (const s of active) {
      const r = rates.get(s.id);
      if (r != null && (!bn || r < rates.get(bn.id))) bn = s;
    }
    for (const el of this.el.querySelectorAll('[data-rate]')) {
      const st = sp.steps.find(s => s.id === el.dataset.rate);
      const r = rates.get(st.id);
      el.closest('[data-row]').classList.toggle('off', !(st.on || st.required));
      if (!rates.has(st.id)) { el.innerHTML = ''; continue; }
      if (r == null) { el.innerHTML = ''; continue; }
      const load = sp.target > 0 && isFinite(r) ? sp.target / r * 100 : 0;
      const over = load > 100 + 1e-9;
      el.innerHTML = `<span class="pv-hbar${over ? ' over' : st === bn ? ' bn' : ''}"><i style="width:${Math.min(100, load).toFixed(1)}%"></i></span>`
        + `<b>${isFinite(r) ? num(r, 0) : '∞'}<small>/sa</small></b><small>${sp.target > 0 ? `${num(load, 0)} %` : ''}</small>`;
    }
    const cap = bn ? rates.get(bn.id) : 0;
    const lamAt = PROCESS_ORDER.indexOf('lam');
    const reworks = active.filter(s => s.action === 'rework' && PROCESS_ORDER.indexOf(s.id) < lamAt);
    const machines = active.reduce((a, s) => a + (s.kind === 'buffer' || s.kind === 'curing' ? 1 : Math.max(1, Math.round(s.n) || 1)), 0)
      + reworks.length;
    const ok = cap >= sp.target - 1e-9;
    // kalite satırları: kapalı adımlar soluk, tamir alanları yalnız "Tamire gönder"de
    for (const el of this.el.querySelectorAll('[data-qrow]')) {
      const st = sp.steps.find(s => s.id === el.dataset.qrow);
      el.classList.toggle('off', !(st.on || st.required));
      el.querySelector('[data-rw]')?.classList.toggle('off', st.action !== 'rework');
    }
    for (const el of this.el.querySelectorAll('[data-qnote]')) {
      const st = sp.steps.find(s => s.id === el.dataset.qnote);
      el.textContent = st.kind === 'stringer' ? `%${num(st.ok ?? 100, 0)} sağlam` : `FPY %${num(st.fpy ?? 100, 1)}`;
    }
    const q = qualityForecast(sp.steps, sp.spp);
    const rwLoad = q.reworkShare / 100 * sp.target;
    const rwCap = reworks.length ? 3600 / Math.max(1, reworks[0].reworkCycle ?? 240) : 0;
    const qres = this.el.querySelector('[data-qres]');
    if (qres) {
      qres.innerHTML = `<span class="cap">Beklenen sonuç</span>`
        + `<div><span>A kalite</span><b>${num(q.aRate, 1)} %</b></div>`
        + `<div><span>B kalite</span><b>${num(q.bRate, 1)} %</b></div>`
        + `<div><span>FPY (tamirsiz A)</span><b>${num(q.fpy, 1)} %</b></div>`
        + `<div><span>Panel hurdası</span><b>${num(q.scrapRate, 2)} %</b></div>`
        + `<div><span>Kaçan NG</span><b>${num(q.escapedPpm, 0)} ppm</b></div>`
        + `<div><span>String hurdası</span><b>${isFinite(q.stringScrapPerPanel) ? num(q.stringScrapPerPanel, 2) : '∞'} <small>/ panel</small></b></div>`
        + (reworks.length ? `<div class="${rwLoad > rwCap ? 'bad' : ''}"><span>Tamir yükü</span><b>${num(rwLoad, 1)} <small>/ sa · kapasite ${num(rwCap, 0)}</small></b></div>` : '');
    }
    this.el.querySelector('[data-sum]').innerHTML =
      `<div><span class="cap">Teorik kapasite</span><b class="${ok ? '' : 'bad'}">${num(cap, 1)}<small> modül/sa</small></b></div>`
      + `<div><span class="cap">Takt</span><b>${sp.target > 0 ? num(3600 / sp.target, 1) : '—'}<small> sn</small></b></div>`
      + `<div><span class="cap">Darboğaz</span><b>${bn ? esc(bn.name) : '—'}</b></div>`
      + `<div><span class="cap">İstasyon</span><b>${machines}</b></div>`
      + `<div><span class="cap">A kalite (beklenen)</span><b>${num(q.aRate, 1)}<small> %</small></b></div>`
      + `<div><span class="cap">FPY</span><b>${num(q.fpy, 1)}<small> %</small></b></div>`
      + `<div><span class="cap">Panel hurdası</span><b>${num(q.scrapRate, 2)}<small> %</small></b></div>`
      + `<div><span class="cap">Tamire giden</span><b class="${rwLoad > rwCap && reworks.length ? 'bad' : ''}">${num(q.reworkShare, 1)}<small> %</small></b></div>`
      + `<p>${ok ? 'Hedef karşılanıyor. Gerçek çıktı arızalar, beklemeler ve molalar nedeniyle daha düşük olur; simülasyonla görün.'
        : 'Hedef karşılanmıyor: kırmızı adımlarda makine ekleyin veya çevrimi kısaltın ("Öner" otomatik ayarlar).'}</p>`;
  }

  _input(e) {
    const t = e.target;
    const sp = this.spec;
    if (t.dataset.g) {
      const k = t.dataset.g;
      sp[k] = t.type === 'checkbox' ? t.checked : t.type === 'text' ? t.value : Math.max(0, Number(t.value) || 0);
    } else if (t.dataset.s) {
      const st = sp.steps.find(s => s.id === t.dataset.s);
      const f = t.dataset.f;
      st[f] = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? t.value : Math.max(0, Number(t.value) || 0);
      if (['ok', 'fpy', 'err', 'reworkSuccess'].includes(f)) st[f] = Math.min(100, st[f]);
    } else return;
    this._update();
  }

  _click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const sp = this.spec;
    switch (b.dataset.act) {
      case 'close': this.hide(); break;
      case 'suggest':
        sp.steps = sp.steps.map(s => (s.on || s.required ? suggestStep(s, sp.target, sp.spp) : s));
        this.render();
        break;
      case 'defaults': this.spec = freshSpec(); this.render(); break;
      case 'build': {
        save(sp);
        let L;
        try {
          L = buildLine({ target: sp.target, spp: Math.max(1, Math.round(sp.spp)), shifts: Math.max(1, Math.round(sp.shifts)),
                          shiftHours: sp.shiftHours || 8, product: sp.product, steps: sp.steps, bom: sp.bom });
        } catch (err) {
          this.onError?.(err.message);
          return;
        }
        this.hide();
        this.onBuild(L);
        break;
      }
    }
  }
}
