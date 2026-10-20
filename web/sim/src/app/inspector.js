// ─────────────────────────────────────────
//  DENETÇİ PANELİ: canlı durum + tüm parametre formları
// ─────────────────────────────────────────
// İstasyon seçili: Canlı | Parametreler · Konveyör seçili: form · Seçim yok: hat (Özet, Ürünler,
// Malzemeler, Vardiya, Model). Formlar yalnızca seçim/sekme/yapı değişince yeniden çizilir;
// [data-live] alanları saniyede 4 kez güncellenir (yazılan alan bozulmaz).
// Alan → hedef eşlemesi data-path ile: st.<alan> · cv.<alan> · set.<alan> · meta.<alan> · sess.<alan>
//   pt.<id>.<alan> · mat.<id>.<alan> · scen|bin|con|brk.<sıra>.<alan> · ov.<ürün tipi id>
import { catalogOf, categoryOf, stationTag, STATUS_LABELS, STATUS_COLORS, addStandardBOM, lineBalance,
         isPostLamination, ELEC_TESTS } from '../core/index.js';
import { BIN_COLORS, BELT_TINT, kindTone } from '../view3d/materials.js';
import { esc, num, pct, sn, duration, row, meter, sec, stateBar, ICON } from './ui.js';

const DISTS = [['fixed', 'Sabit'], ['normal', 'Normal (ort. ± std)'], ['triangular', 'Üçgen (en az – tepe – en çok)'],
               ['uniform', 'Düzgün (en az – en çok)'], ['exponential', 'Üstel (ort. = çevrim)']];
const ROTS = [['', 'Otomatik (akıştan)'], [0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']];
const CAT_NAME = { process: 'İşlem', inspection: 'Test / kalite', buffer: 'Ara stok', curing: 'Kürleme', classification: 'Hat sonu' };
const SCRAP_NAME = { process: 'proses', rejected: 'test', rework: 'tamir başarısız', string_ng: 'NG string' };
const scrapText = by => Object.entries(by).map(([k, v]) => `${SCRAP_NAME[k] ?? k} ${v}`).join(' · ');
const LINE_TABS = [['summary', 'Özet'], ['balance', 'Denge'], ['products', 'Ürünler'], ['materials', 'Malzemeler'],
                   ['shift', 'Vardiya'], ['model', 'Model']];

// ── Form parçaları ──
function attrs(path, o) {
  return `data-path="${path}" data-type="${o.type ?? 'num'}"`
    + (o.min != null ? ` data-min="${o.min}"` : '') + (o.max != null ? ` data-max="${o.max}"` : '')
    + (o.rebuild ? ' data-rebuild="1"' : '') + (o.rerender ? ' data-rerender="1"' : '');
}
function field(label, path, value, o = {}) {
  const type = o.type === 'text' ? 'text' : 'number';
  const step = o.type === 'int' ? 1 : 'any';
  return `<label class="pv-field"><span>${label}</span><span class="pv-in">`
    + `<input type="${type}" ${type === 'number' ? `step="${step}"` : ''} ${attrs(path, o)} value="${esc(value)}"`
    + `${o.placeholder != null ? ` placeholder="${esc(o.placeholder)}"` : ''}>`
    + `${o.unit ? `<em>${o.unit}</em>` : ''}</span>${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}
function select(label, path, value, options, o = {}) {
  return `<label class="pv-field"><span>${label}</span><span class="pv-in"><select ${attrs(path, { type: 'text', ...o })}>`
    + options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')
    + `</select></span>${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}
function check(label, path, value, o = {}) {
  return `<label class="pv-check"><input type="checkbox" ${attrs(path, { type: 'bool', ...o })}${value ? ' checked' : ''}>${label}</label>`;
}
const cell = (path, value, o = {}) => `<input type="${o.type === 'text' ? 'text' : 'number'}" step="any" ${attrs(path, o)} value="${esc(value)}">`;
const delBtn = (act, i) => `<button class="pv-x" data-act="${act}" data-i="${i}" aria-label="Sil" title="Sil">${ICON.close}</button>`;
const addBtn = (act, text) => `<button class="pv-add" data-act="${act}">${ICON.plus}${text}</button>`;
const hint = t => `<p class="pv-hint">${t}</p>`;

export class Inspector {
  constructor(el, session, editor) {
    this.el = el;
    this.session = session;
    this.editor = editor;
    this.stationTab = 'live';
    this.lineTab = 'summary';
    this._live = {};
    this._onClick = e => this._click(e);
    this._onChange = e => this._change(e);
    el.addEventListener('click', this._onClick);
    el.addEventListener('change', this._onChange);
    this._offs = [
      session.on('select', () => this.render()),
      session.on('edit', () => { if (!this._selfEdit) this.render(); }),
      session.on('layout', () => this.render()),
    ];
    editor.onPlaced = () => { this.stationTab = 'params'; this.render(); };
  }

  get L() { return this.session.layout; }

  render() {
    this.stats ??= this.session.stats();
    this._live = {};
    this.el.innerHTML = this._html();
    this.refresh(this.stats);
  }

  // Canlı alanları güncelle (formlara dokunmaz)
  refresh(stats) {
    this.stats = stats;
    for (const el of this.el.querySelectorAll('[data-live]')) {
      const fn = this._live[el.dataset.live];
      if (!fn) continue;
      const html = fn();
      if (html !== el._html) { el.innerHTML = html; el._html = html; }
    }
  }

  live(key, fn) {
    this._live[key] = fn;
    return `<div data-live="${key}"></div>`;
  }

  _html() {
    const sel = this.session.selection;
    if (sel?.type === 'station' && this.L.stations.has(sel.id)) return this._stationHTML(this.L.stations.get(sel.id));
    if (sel?.type === 'conveyor' && this.L.conveyors.has(sel.id)) return this._conveyorHTML(this.L.conveyors.get(sel.id));
    return this._lineHTML();
  }

  // ──────────────────────────────────────
  //  İSTASYON
  // ──────────────────────────────────────
  _row(id) {
    return this.stats.stations.find(r => r.id === id);
  }

  _stationHTML(s) {
    const cat = categoryOf(s);
    const info = catalogOf(s.kind);
    const sub = [s.name !== info.name && info.name, CAT_NAME[cat]].filter(Boolean).join(' · ');
    const head = `<div class="pv-head"><span class="pv-tag" style="--tone:${kindTone(s.kind, cat)}">${stationTag(s)}</span>`
      + `<div class="pv-title">${esc(s.name)}<small>${esc(sub)}</small></div></div>`
      + this.live('st-state', () => {
        const r = this._row(s.id);
        if (!r) return '';
        const bn = this.stats.bottleneck?.ids.includes(s.id) ? '<span class="pv-flag">darboğaz</span>' : '';
        return `<div class="pv-state"><i class="sq" style="background:${STATUS_COLORS[r.status]}"></i><span class="cap">${STATUS_LABELS[r.status]}</span>${bn}</div>`;
      });
    const tabs = `<div class="pv-tabs" role="tablist">`
      + [['live', 'Canlı'], ['params', 'Parametreler']].map(([k, t]) =>
        `<button role="tab" data-stab="${k}" aria-selected="${this.stationTab === k}">${t}</button>`).join('') + `</div>`;
    const body = this.stationTab === 'params' ? this._stationForm(s, cat) : this.live('st-live', () => this._stationLive(s, cat));
    // Hat kurma eylemleri her iki sekmede de üstte
    const actions = `<div class="pv-actions pv-st-actions">`
      + `<button class="pv-tbtn" data-act="st-after">${ICON.plus}Sonrasına ekle</button>`
      + `<button class="pv-tbtn" data-act="st-parallel">${ICON.parallel}Paralel makine</button>`
      + `<button class="pv-tbtn" data-act="st-rotate" aria-label="Döndür" title="Döndür (R)">${ICON.rotate}</button>`
      + `<button class="pv-tbtn" data-act="st-dup" aria-label="Çoğalt" title="Çoğalt (Ctrl+D)">${ICON.copy}</button>`
      + `<button class="pv-tbtn danger" data-act="st-del" aria-label="Sil" title="Sil (Del)">${ICON.trash}</button></div>`;
    return head + actions + tabs + body;
  }

  _stationLive(s, cat) {
    const r = this._row(s.id);
    if (!r) return '';
    const eng = this.session.engine;
    const rt = eng.stationRuntime(s.id);
    let html = '';
    if (cat === 'buffer' || cat === 'curing') {
      html += sec('Stok', row('Doluluk', `${rt.queue.length} / ${s.buffer_capacity}`)
        + meter(rt.queue.length / Math.max(1, s.buffer_capacity) * 100, kindTone(s.kind, cat))
        + (cat === 'curing' ? row('Kürleme süresi', sn(s.cycle_time)) : '')
        + row('Çıkan', r.processed) + row('Ortalama doluluk', pct(r.utilization)));
    } else if (s.kind === 'lamination') {
      const zone = (cap, count, subtxt, p, on) => `<div class="${on ? 'on' : ''}"><span class="cap">${cap}</span>`
        + `<b>${count}</b><small>${subtxt}</small>${meter(p)}</div>`;
      const room = (x, dur) => x
        ? [x.items.length, `${Math.max(0, Math.ceil(x.doneTime - eng.time))} sn`, (eng.time - x.start) / dur * 100, true]
        : [0, `${dur} sn`, 0, false];
      const feedCap = Math.max(s.lam_batch_size, s.lam_feed_cap);
      const cool = rt.lamCooling[0];
      html += sec('Proses', `<div class="pv-lam">`
        + zone('Besleme', `${rt.lamFeed.length}/${feedCap}`, `+${rt.queue.length} kuyruk`, rt.lamFeed.length / feedCap * 100, rt.lamFeed.length > 0)
        + zone('Oda 1', ...room(rt.lamRoom1, s.lam_room1_time))
        + zone('Oda 2', ...room(rt.lamRoom2, s.lam_room2_time))
        + zone('Soğutma', rt.lamCooling.length, `${s.lam_cooling_time} sn`,
               cool ? (eng.time - cool.startTime) / s.lam_cooling_time * 100 : 0, !!cool)
        + `</div>`) + sec('Akış', row('Çıkan', r.processed) + row('Efektif cycle', sn(r.ect)));
    } else {
      let flow = '';
      if (s.kind === 'layup') flow += row('Biriken string', `${rt.stringCount} / ${s.strings_per_panel}`);
      flow += row('Kuyruk', rt.queue.length) + row('İşlemde', rt.jobs.reduce((n, j) => n + j.items.length, 0));
      if (cat !== 'classification') flow += row('Çıkış bekleyen', rt.outbox.length);
      flow += row('İşlenen', r.processed) + row('Kullanım', pct(r.utilization)) + meter(r.utilization) + row('Efektif cycle', sn(r.ect));
      html += sec('Akış', flow);
    }
    if (r.oee) {
      const o = r.oee;
      html += sec('OEE', `<div class="pv-oee">`
        + [['Kullanılabilirlik', o.A], ['Performans', o.P], ['Kalite', o.Q], ['OEE', o.oee]].map(([k, v]) =>
          `<div><span class="cap">${k}</span><b>${num(v * 100)}%</b>${meter(v * 100, k === 'OEE' ? 'var(--accent)' : null)}</div>`).join('')
        + `</div>`);
    }
    html += sec('Durum dağılımı', stateBar(r.stateTime));
    if (cat === 'inspection') {
      const n = r.firstSeen, p = v => n ? ` <small>${num(v / n * 100)} %</small>` : '';
      html += sec('Test sonuçları (ilk geçiş)', row('Gelen panel', n)
        + row('NG gelen', `${r.firstNG}${p(r.firstNG)}`)
        + row('NG kararı', `${r.firstRejected}${p(r.firstRejected)}`)
        + row('Gözlenen FPY', n ? pct((n - r.firstRejected) / n * 100) : '—')
        + row('Kaçan NG', r.missed) + row('Yanlış ret', r.falseRejects)
        + (r.downgraded ? row('B kaliteye düşen', r.downgraded) : '')
        + (r.scrapped ? row('Hurdaya ayrılan', r.scrapped) : '')
        + (r.rejected > r.firstRejected ? row('Tekrar testte NG', r.rejected - r.firstRejected) : '')
        + (r.failures ? row('Arıza sayısı', r.failures) : ''));
    } else if (cat !== 'buffer' && cat !== 'curing') {
      let q = '';
      if (r.stringNG) q += row('NG string (ayrılan)', `${r.stringNG} <small>${num(r.stringNG / Math.max(1, r.processed) * 100)} %</small>`);
      if (r.scrapped - r.stringNG > 0) q += row('Hurda', r.scrapped - r.stringNG);
      if (r.defectsMade) q += row('Oluşan gizli hata', r.defectsMade);
      if (r.reworked) q += row('Tamir edilen', r.reworked);
      if (r.noDefect) q += row('Hata bulunamayan (yanlış ret)', r.noDefect);
      if (r.failures) q += row('Arıza sayısı', r.failures);
      if (q) html += sec('Kalite ve arıza', q);
    }
    if (cat === 'classification' && s.bins.length) {
      const pallets = s.bins.map(b => eng.warehouse.filter(p => p.station_id === s.id && p.bin_name === b.name).length);
      html += sec('Hazneler', `<table class="pv-bins"><tr><th>Hazne</th><th>Olas.</th><th>Dolu</th><th>Palet</th></tr>`
        + s.bins.map((b, i) => {
          const c = BIN_COLORS[i % BIN_COLORS.length];
          const n = rt.binCounts[i] ?? 0;
          return `<tr><td><i class="sw" style="background:${c}"></i>${esc(b.name)}`
            + `<span class="fill"><i style="width:${Math.min(100, n / Math.max(1, b.capacity) * 100)}%;background:${c}"></i></span></td>`
            + `<td>${num(b.probability)}%</td><td>${n}/${b.capacity}</td><td>${pallets[i]}</td></tr>`;
        }).join('') + `</table>`);
    }
    const hits = Object.entries(r.scenarioHits).filter(([k]) => k !== '—');
    if (hits.length) {
      const total = hits.reduce((a, [, n]) => a + n, 0);
      html += sec('Cycle senaryoları', hits.map(([k, n]) => row(esc(k), `${n} · ${num(n / total * 100, 0)} %`)).join(''));
    }
    return html;
  }

  _stationForm(s, cat) {
    const L = this.L;
    const machine = cat !== 'buffer' && cat !== 'curing';
    const isEntry = L.entryStations().some(e => e.id === s.id);
    let html = '';

    // Genel
    let g = field('Ad', 'st.name', s.name, { type: 'text' });
    if (machine && s.kind !== 'lamination') g += field('Paralel kaynak', 'st.num_resources', s.num_resources, { type: 'int', min: 1, unit: 'adet' });
    if (cat === 'process' && !['layup', 'lamination', 'stringer', 'rework'].includes(s.kind)) {
      g += field('Batch', 'st.batch_size', s.batch_size, { type: 'int', min: 1, unit: 'ürün / iş' });
    }
    if (machine) g += field('Giriş tamponu', 'st.queue_cap', s.queue_cap, { type: 'int', min: 0, unit: 'adet', hint: 'Makine önünde bekleyebilecek ek ürün' });
    g += select('Yön', 'st.rot', s.rot ?? '', ROTS, { type: 'rot', rebuild: 1 });
    if (isEntry) g += field('Ham madde geliş aralığı', 'st.arrival_interval', s.arrival_interval, { min: 0, unit: 'sn', hint: '0 = sınırsız besleme (hat hep dolu)' });
    html += sec('Genel', g);

    // Proses
    if (s.kind === 'lamination') {
      html += sec('Laminasyon',
        field('Batch', 'st.lam_batch_size', s.lam_batch_size, { type: 'int', min: 1, unit: 'panel' })
        + field('Besleme kapasitesi', 'st.lam_feed_cap', s.lam_feed_cap, { type: 'int', min: 1, unit: 'panel' })
        + field('1. oda süresi', 'st.lam_room1_time', s.lam_room1_time, { min: 1, unit: 'sn' })
        + field('2. oda süresi', 'st.lam_room2_time', s.lam_room2_time, { min: 1, unit: 'sn' })
        + field('Soğutma süresi', 'st.lam_cooling_time', s.lam_cooling_time, { min: 1, unit: 'sn' }));
    } else if (cat === 'buffer') {
      html += sec('Ara stok', field('Kapasite', 'st.buffer_capacity', s.buffer_capacity, { type: 'int', min: 1, unit: 'panel', rebuild: 1 }));
    } else if (cat === 'curing') {
      html += sec('Kürleme', field('Kapasite', 'st.buffer_capacity', s.buffer_capacity, { type: 'int', min: 1, unit: 'panel', rebuild: 1 })
        + field('Kürleme süresi', 'st.cycle_time', s.cycle_time, { min: 0, unit: 'sn' }));
    } else {
      html += sec('Çevrim süresi', this._cycleForm(s));
    }
    if (s.kind === 'layup') {
      html += sec('Dizim', field('String / panel', 'st.strings_per_panel', s.strings_per_panel, { type: 'int', min: 1, unit: 'string' })
        + hint('Layup stringer dışında bir kaynaktan (ör. cam + EVA) besleniyorsa her panel için bir altlık tüketir.'));
    }
    if (cat === 'classification') html += sec('Hazneler', this._binsForm(s));

    if (machine) {
      html += sec('Arıza, bakım ve ayar',
        field('MTBF', 'st.mtbf_min', s.mtbf_min, { min: 0, unit: 'dk', hint: 'Arızalar arası ortalama çalışma süresi · 0 = arıza yok' })
        + field('MTTR', 'st.mttr_min', s.mttr_min, { min: 0, unit: 'dk', hint: 'Ortalama onarım süresi (üstel dağılım)' })
        + field('Planlı bakım aralığı', 'st.pm_interval_h', s.pm_interval_h, { min: 0, unit: 'saat', hint: '0 = planlı bakım yok' })
        + field('Bakım süresi', 'st.pm_duration_min', s.pm_duration_min, { min: 0, unit: 'dk' })
        + (s.kind !== 'lamination' ? field('Ayar süresi', 'st.setup_time', s.setup_time, { min: 0, unit: 'sn', hint: 'Ürün tipi değiştiğinde' }) : ''));
      html += sec('Kalite', this._qualityForm(s, cat));
      html += sec('Operatör ve malzeme', this._resourceForm(s));
    }


    return html;
  }

  _cycleForm(s) {
    const L = this.L;
    let c = field('Çevrim süresi', 'st.cycle_time', s.cycle_time, { min: 0, unit: 'sn' });
    c += select('Dağılım', 'st.cycle_dist', s.cycle_dist, DISTS, { rerender: 1 });
    if (s.cycle_dist === 'normal') c += field('Standart sapma', 'st.cycle_sd', s.cycle_sd, { min: 0, unit: 'sn' });
    if (s.cycle_dist === 'triangular' || s.cycle_dist === 'uniform') {
      c += field('En az', 'st.cycle_min', s.cycle_min, { min: 0, unit: 'sn' }) + field('En çok', 'st.cycle_max', s.cycle_max, { min: 0, unit: 'sn' });
    }
    if (L.productTypes.length > 1) {
      c += `<div class="pv-subhead cap">Ürüne özel çevrim</div>`
        + L.productTypes.map(pt => field(esc(pt.name), `ov.${pt.id}`, pt.cycle_overrides[s.id] ?? '',
          { type: 'optnum', min: 0, unit: 'sn', placeholder: s.cycle_time })).join('');
    }
    const sc = s.cycle_scenarios;
    c += `<div class="pv-subhead cap">Sapma senaryoları</div>`;
    if (sc.length) {
      const total = sc.reduce((a, x) => a + Number(x.probability || 0), 0);
      c += `<table class="pv-grid"><tr><th>Senaryo</th><th>Olas. %</th><th>Süre sn</th><th></th></tr>`
        + sc.map((x, i) => `<tr><td>${cell(`scen.${i}.name`, x.name, { type: 'text' })}</td>`
          + `<td>${cell(`scen.${i}.probability`, x.probability, { min: 0, rerender: 1 })}</td>`
          + `<td>${cell(`scen.${i}.cycle_time`, x.cycle_time, { min: 0 })}</td><td>${delBtn('del-scen', i)}</td></tr>`).join('')
        + `</table>` + hint(`Toplam ${num(total)} %${Math.abs(total - 100) > 0.01 ? ' — olasılıklar ağırlık olarak kullanılır' : ''}. Senaryo varsa dağılımın yerine geçer.`);
    }
    return c + addBtn('add-scen', 'Senaryo');
  }

  _binsForm(s) {
    const total = s.bins.reduce((a, b) => a + Number(b.probability || 0), 0);
    return `<table class="pv-grid"><tr><th>Hazne</th><th>Kalite</th><th>Olas. %</th><th>Palet</th><th></th></tr>`
      + s.bins.map((b, i) => `<tr><td><i class="sw" style="background:${BIN_COLORS[i % BIN_COLORS.length]}"></i>${cell(`bin.${i}.name`, b.name, { type: 'text' })}</td>`
        + `<td><select ${attrs(`bin.${i}.grade`, { type: 'text' })}>${['A', 'B'].map(g => `<option${(b.grade ?? 'A') === g ? ' selected' : ''}>${g}</option>`).join('')}</select></td>`
        + `<td>${cell(`bin.${i}.probability`, b.probability, { min: 0, rerender: 1 })}</td>`
        + `<td>${cell(`bin.${i}.capacity`, b.capacity, { type: 'int', min: 1 })}</td><td>${delBtn('del-bin', i)}</td></tr>`).join('')
      + `</table>` + hint(`Olasılık, aynı kalitedeki hazneler arasında ağırlıktır (toplam ${num(total)}). B kalite paneller B haznelerine gider; B hazne yoksa tüm haznelere. Palet = hazne dolunca depoya giden adet. 3D'de ilk 8 hazne gösterilir.`)
      + addBtn('add-bin', 'Hazne');
  }

  _qualityForm(s, cat) {
    if (cat === 'inspection') {
      const post = isPostLamination(this.L, s.id);
      const elec = ELEC_TESTS.has(s.kind);
      const noRoute = !post && s.defect_action === 'rework' && !this.L.outgoing(s.id).some(c => c.type === 'defect');
      const ng = (100 - (s.fpy ?? 100)) / 100, det = s.detect_rate / 100, fr = s.false_reject / 100;
      const actions = [...(post ? [] : [['rework', 'Tamire gönder']]), ['downgrade', 'B kaliteye düşür'], ['scrap', 'Hurdaya ayır']];
      return hint(`Gördüğü hata: <b>${elec ? 'elektriksel' : 'EL / görsel'}</b> (${elec ? 'izolasyon, güç' : 'çatlak, kayma, yabancı madde'}).`
          + ` ${post ? 'Laminasyon <b>sonrası</b>: NG panel tamir edilemez.' : 'Laminasyon <b>öncesi</b>: NG panel tamir edilebilir.'}`)
        + field('FPY: sağlam gelen', 'st.fpy', s.fpy ?? 100, { min: 0, max: 100, unit: '%', rerender: 1,
          hint: 'İlk geçişte panellerin yüzde kaçı sağlam gelir. 100 − FPY burada NG çıkar; önceki istasyonlardan kaçan hatalar buna eklenir.' })
        + field('NG yakalama', 'st.detect_rate', s.detect_rate, { min: 0, max: 100, unit: '%', rerender: 1,
          hint: 'NG panelin NG bulunma olasılığı. Kalanı kaçar (hatalı karar: NG → OK).' })
        + field('Yanlış ret', 'st.false_reject', s.false_reject, { min: 0, max: 100, unit: '%', rerender: 1,
          hint: 'Sağlam panelin NG sayılma olasılığı (hatalı karar: OK → NG).' })
        + select('NG kararı', 'st.defect_action', post && s.defect_action === 'rework' ? 'downgrade' : s.defect_action, actions, { rerender: 1 })
        + (post && s.defect_action === 'rework' ? hint('⚠ Laminasyon sonrası tamir yapılamaz; NG paneller B kaliteye düşer.') : '')
        + (noRoute ? hint('⚠ Bu istasyondan çıkan "Hatalı ürün" tipinde konveyör yok; NG paneller hurdaya ayrılır. Bağla aracıyla tamir istasyonuna konveyör çekip tipini "Hatalı ürün" yapın.') : '')
        + `<div class="pv-subhead cap">Beklenen (ilk geçiş, yalnız bu noktada çıkan NG)</div>`
        + row('NG kararı', pct((ng * det + (1 - ng) * fr) * 100)) + row('Kaçan NG', pct(ng * (1 - det) * 100))
        + row('Yanlış ret', pct((1 - ng) * fr * 100));
    }
    if (s.kind === 'rework') {
      return field('Tamir başarısı', 'st.rework_success', s.rework_success, { min: 0, max: 100, unit: '%', hint: 'Başarısız tamir → hurda' })
        + field('Panel başına en fazla tamir', 'st.max_rework', s.max_rework, { type: 'int', min: 0, hint: 'Aşılırsa panel hurdaya ayrılır' })
        + hint('Yalnız laminasyon öncesi testlerin NG kararı verdiği paneller tamire gelir. Tamir edilen panel teste geri döner; hata bulunamayan (yanlış ret) panel olduğu gibi döner.');
    }
    if (cat === 'classification') return hint('B kalite paneller kalitesi "B" olan haznelere gider. Hat sonuna fark edilmeden gelen NG paneller "kaçan NG" sayılır.');
    let h = '';
    if (s.kind === 'stringer') {
      h += field('NG string oranı', 'st.string_ng', s.string_ng ?? 0, { min: 0, max: 100, unit: '%', rerender: 1,
        hint: `String kontrolünde NG çıkan string ayrılır (hurda), panele girmez. Sağlam string: ${num(100 - (s.string_ng ?? 0))} %.` });
    }
    return h + field('Hurda oranı', 'st.scrap_rate', s.scrap_rate, { min: 0, max: 100, unit: '%', hint: 'İşlem sonunda hurdaya ayrılır (ör. cam kırığı)' })
      + field('Gizli hata oranı', 'st.defect_rate', s.defect_rate, { min: 0, max: 100, unit: '%',
        hint: s.kind === 'stringer' ? 'String kontrolünden kaçan (ör. mikro çatlak); paneli NG yapar, EL testi yakalar'
          : 'Fark edilmez; sonraki EL / görsel test yakalar (ör. mikro çatlak)' });
  }

  _resourceForm(s) {
    const L = this.L;
    let h = field('Operatör / iş', 'st.operators', s.operators, { type: 'int', min: 0, unit: 'kişi', rebuild: 1, hint: '0 = otomatik · Operatör havuzu: Hat › Vardiya' });
    h += `<div class="pv-subhead cap">Malzeme tüketimi (ürün başına)</div>`;
    if (!L.materials.length) return h + hint('Hat › Malzemeler sekmesinden malzeme tanımlayın.');
    if (s.consumes.length) {
      const opts = L.materials.map(m => [m.id, `${m.name} (${m.unit})`]);
      h += `<table class="pv-grid"><tr><th>Malzeme</th><th>Miktar</th><th></th></tr>`
        + s.consumes.map((c, i) => `<tr><td><select ${attrs(`con.${i}.material_id`, { type: 'int' })}>`
          + opts.map(([v, t]) => `<option value="${v}"${v === c.material_id ? ' selected' : ''}>${esc(t)}</option>`).join('')
          + `</select></td><td>${cell(`con.${i}.qty`, c.qty, { min: 0 })}</td><td>${delBtn('del-con', i)}</td></tr>`).join('')
        + `</table>`;
    }
    return h + addBtn('add-con', 'Malzeme');
  }

  // ──────────────────────────────────────
  //  KONVEYÖR
  // ──────────────────────────────────────
  _conveyorHTML(c) {
    const L = this.L;
    const a = L.stations.get(c.from_id), b = L.stations.get(c.to_id);
    const head = `<div class="pv-head"><span class="pv-tag" style="--tone:${c.type === 'defect' ? '#d23b2f' : '#5c6168'}">KNV-${String(c.id).padStart(2, '0')}</span>`
      + `<div class="pv-title">${esc(a?.name)} → ${esc(b?.name)}<small>${c.type === 'defect' ? 'Hatalı ürün (tamir) hattı' : 'Konveyör'}</small></div></div>`;
    const form = field('Taşıma süresi', 'cv.cycle_time', c.cycle_time, { min: 0, unit: 'sn' })
      + field('Kapasite', 'cv.capacity', c.capacity, { type: 'int', min: 1, unit: 'ürün', hint: 'Üzerinde aynı anda bulunabilecek ürün (biriktirmeli konveyör)' })
      + select('Tip', 'cv.type', c.type, [['normal', 'Normal akış'], ['defect', 'Hatalı ürün (testten tamire)']],
        { rebuild: 1, hint: 'Testte reddedilen ürünler yalnızca "Hatalı ürün" konveyörlerinden gider.' });
    const liveInfo = this.live('cv-live', () => {
      const items = this.session.engine.conveyorRuntime(c.id)?.items ?? [];
      const waiting = items.filter(it => it.arriveTime <= this.session.engine.time).length;
      return row('Üzerindeki ürün', `${items.length} / ${c.capacity}`) + row('Varmış, bekleyen', waiting);
    });
    return head + sec('Parametreler', form) + sec('Canlı', liveInfo)
      + `<div class="pv-actions"><button class="pv-tbtn" data-act="cv-reverse">${ICON.swap}Yönü çevir</button>`
      + `<button class="pv-tbtn danger" data-act="cv-del">${ICON.trash}Sil</button></div>`;
  }

  // ──────────────────────────────────────
  //  HAT
  // ──────────────────────────────────────
  _lineHTML() {
    const L = this.L;
    const head = `<div class="pv-head"><span class="pv-tag">HAT</span><div class="pv-title">Hat ayarları`
      + `<small>${L.stations.size} istasyon · ${L.conveyors.size} konveyör</small></div></div>`;
    const tabs = `<div class="pv-tabs pv-wrap" role="tablist">` + LINE_TABS.map(([k, t]) =>
      `<button role="tab" data-ltab="${k}" aria-selected="${this.lineTab === k}">${t}</button>`).join('') + `</div>`;
    let body;
    switch (this.lineTab) {
      case 'products': body = this._productsForm(); break;
      case 'materials': body = this._materialsForm(); break;
      case 'shift': body = this._shiftForm(); break;
      case 'model': body = this._modelForm(); break;
      case 'balance': body = this._balance(); break;
      default: body = this.live('line-summary', () => this._summary());
    }
    return head + tabs + body;
  }

  _summary() {
    const st = this.stats;
    const live = st.statsTime > 0;
    const counts = {};
    st.stations.forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    const n = Math.max(1, st.stations.length);
    const dist = Object.entries(counts).map(([k, c]) => `<i style="width:${c / n * 100}%;background:${STATUS_COLORS[k]}"></i>`).join('');
    const scrapBy = scrapText(st.scrapBy);
    let h = (st.warmup ? hint(`Isınma süresi: istatistikler ${duration(this.session.engine.statsT0)} sonunda sayılmaya başlar.`) : '')
      + sec('Üretim', row('Tamamlanan', st.completed.toLocaleString('tr-TR'))
        + row('Saatlik (planlı süre)', live ? `${num(st.plannedRatePerHour)} /sa` : '—')
        + row('Teorik kapasite', st.theoreticalPerHour ? `${num(st.theoreticalPerHour)} /sa` : '—')
        + row('Hat verimi', live && st.theoreticalPerHour ? pct(st.lineEfficiency) : '—')
        + row('Sistemdeki ürün', st.wip) + row('Depoya giden palet', st.pallets))
      + sec('Kalite', row('A kalite', st.completed ? `${pct(st.aRate)} <small>${st.gradeA}</small>` : '—')
        + row('B kalite', st.gradeB)
        + row('İlk geçiş verimi (FPY)', st.completed ? pct(st.firstPassYield) : '—')
        + row('Verim (tamamlanan / başlanan)', live ? pct(st.yield) : '—')
        + row('Panel hurdası', st.scrapped + (scrapBy ? ` <small>(${scrapBy})</small>` : ''))
        + row('String hurdası', st.stringScrap + (st.stringScrap ? ` <small>(${scrapText(st.stringScrapBy)})</small>` : ''))
        + row('Kaçan NG (A kalitede)', st.escaped))
      + sec('Akış süresi', st.lead.n ? row('Ortalama', duration(st.lead.avg)) + row('Medyan (P50)', duration(st.lead.p50))
        + row('P90', duration(st.lead.p90)) + row('En uzun', duration(st.lead.max)) : '<p class="pv-muted">Henüz tamamlanan ürün yok.</p>');
    if (isFinite(st.operators.pool) || st.operators.used) {
      h += sec('Operatör', row('Görevde', `${st.operators.used} / ${isFinite(st.operators.pool) ? st.operators.pool : '∞'}`));
    }
    if (st.materials.length) {
      h += sec('Malzeme stoğu', st.materials.map(m => row(esc(m.name),
        `${num(m.stock, 0)} ${esc(m.unit)}${m.onOrder ? ` <small>+${num(m.onOrder, 0)} yolda</small>` : ''}`)).join(''));
    }
    h += sec('İstasyon durumu', `<div class="pv-dist">${dist}</div><div class="pv-legend">`
      + Object.entries(counts).map(([k, c]) => `<div><i class="sq" style="background:${STATUS_COLORS[k]}"></i>${STATUS_LABELS[k]}<b>${c}</b></div>`).join('') + `</div>`);
    const belt = tint => '#' + [16, 8, 0].map(sh => Math.round(((0x8d9196 >> sh) & 255) * ((tint >> sh) & 255) / 255).toString(16).padStart(2, '0')).join('');
    h += sec('Konveyör', `<div class="pv-legend">`
      + [['empty', 'Boş'], ['moving', 'Taşıyor'], ['waiting', 'Ürün bekliyor'], ['full', 'Dolu, tıkalı']]
        .map(([k, t]) => `<div><i class="belt" style="background:${belt(BELT_TINT[k])}"></i>${t}</div>`).join('')
      + `<div><i class="belt" style="background:#d23b2f"></i>Hatalı ürün hattı</div></div>`);
    return h;
  }

  // Hat dengesi: aşamaların efektif çevrimi takt ile karşılaştırılır (tasarım görünümü, simülasyondan bağımsız)
  _balance() {
    const b = lineBalance(this.L);
    let h = sec('Hedef', field('Hedef kapasite', 'set.target_rate', this.L.settings.target_rate ?? 0,
      { min: 0, unit: 'modül/sa', rerender: 1, hint: 'Takt = 3600 / hedef. 0 = hedef yok.' }));
    if (!b.stages.length) return h + sec('Hat dengesi', '<p class="pv-muted">Hatta henüz çevrimi olan istasyon yok.</p>');
    const scale = Math.max(b.takt, b.bottleneck.ect) * 1.08;
    const bnOver = b.takt && b.bottleneck.ect > b.takt + 1e-9;
    h += sec('Özet', row('Takt', b.takt ? `${num(b.takt)} sn` : '—')
      + row('Teorik kapasite', `${num(b.capacity)} /sa`)
      + row('Darboğaz', `<span class="ui">${esc(b.bottleneck.stations[0].name)}${b.bottleneck.stations.length > 1 ? ` ×${b.bottleneck.stations.length}` : ''}</span> · ${num(b.bottleneck.ect)} sn`)
      + row('Denge oranı', pct(b.balance))
      + (b.takt ? hint(bnOver ? `Hedefe ulaşılamıyor: kırmızı aşamalar takttan yavaş. Paralel makine ekleyin veya çevrimi kısaltın.`
        : 'Tüm aşamalar takt içinde. Gerçek çıktıyı arızalar ve beklemeler düşürür; simülasyonla görün.') : ''));
    const taktX = b.takt ? b.takt / scale * 100 : 0;
    h += sec('Aşamalar (akış sırasıyla)', `<div class="pv-bal">`
      + b.stages.map(st => {
        const s0 = st.stations[0];
        const over = b.takt && st.ect > b.takt + 1e-9;
        const cls = over ? 'over' : st === b.bottleneck ? 'bn' : '';
        return `<button class="pv-bal-row ${cls}" data-act="sel-st" data-i="${s0.id}">`
          + `<span class="pv-bal-name"><span class="pv-tag" style="--tone:${kindTone(s0.kind, categoryOf(s0))}">${catalogOf(s0.kind).code}</span>`
          + `${esc(s0.name)}${st.stations.length > 1 ? ` <small>×${st.stations.length}</small>` : ''}`
          + `${st.stringLimited ? ' <small>stringer beslemesi</small>' : ''}</span>`
          + `<span class="pv-bal-bar"><i style="width:${(st.ect / scale * 100).toFixed(1)}%"></i>`
          + `${taktX ? `<em style="left:${taktX.toFixed(1)}%"></em>` : ''}</span>`
          + `<b>${num(st.ect)}<small> sn</small></b></button>`;
      }).join('') + `</div>`
      + `<div class="pv-legend inline pv-bal-legend"><div><i class="line pv-bal-takt"></i>Takt</div>`
      + `<div><i class="sq" style="background:var(--accent)"></i>Darboğaz</div><div><i class="sq" style="background:var(--stop)"></i>Takttan yavaş</div></div>`
      + hint('Çevrim: aşamanın modül başı efektif süresi (paralel makineler, laminasyon partisi, kür fırını kapasitesi dahil). Satıra dokunarak istasyonu seçin.'));
    return h;
  }

  _productsForm() {
    const L = this.L;
    const total = L.productTypes.reduce((a, p) => a + Math.max(0, p.mix ?? 1), 0) || 1;
    return sec('Ürün tipleri ve karışım', `<table class="pv-grid"><tr><th></th><th>Ad</th><th>Ağırlık</th><th>Pay</th><th></th></tr>`
      + L.productTypes.map(pt => `<tr><td><input type="color" ${attrs(`pt.${pt.id}.color`, { type: 'text' })} value="${esc(pt.color)}"></td>`
        + `<td>${cell(`pt.${pt.id}.name`, pt.name, { type: 'text' })}</td><td>${cell(`pt.${pt.id}.mix`, pt.mix ?? 1, { min: 0, rerender: 1 })}</td>`
        + `<td class="pv-num">${num(Math.max(0, pt.mix ?? 1) / total * 100, 0)}%</td><td>${L.productTypes.length > 1 ? delBtn('del-pt', pt.id) : ''}</td></tr>`).join('')
      + `</table>` + addBtn('add-pt', 'Ürün tipi')
      + hint('Giriş istasyonları ürün tipini karışım ağırlığına göre seçer. İstasyon başına farklı çevrim: istasyon › Parametreler › Çevrim süresi.'));
  }

  _materialsForm() {
    const L = this.L;
    let h = '';
    if (L.materials.length) {
      h += L.materials.map(m => sec(esc(m.name),
        field('Ad', `mat.${m.id}.name`, m.name, { type: 'text' })
        + field('Birim', `mat.${m.id}.unit`, m.unit, { type: 'text' })
        + field('Başlangıç stoğu', `mat.${m.id}.stock`, m.stock, { min: 0, unit: esc(m.unit) })
        + field('Yeniden sipariş noktası', `mat.${m.id}.reorder_point`, m.reorder_point, { min: 0, unit: esc(m.unit) })
        + field('Sipariş miktarı', `mat.${m.id}.reorder_qty`, m.reorder_qty, { min: 0, unit: esc(m.unit), hint: '0 = sipariş verilmez' })
        + field('Tedarik süresi', `mat.${m.id}.lead_time_h`, m.lead_time_h, { min: 0, unit: 'saat' })
        + this.live(`mat-${m.id}`, () => {
          const st = this.session.engine.stock.get(m.id);
          return st ? row('Şu anki stok', `${num(st.stock, 0)} ${esc(m.unit)}`) + row('Yolda', num(st.orders.reduce((a, o) => a + o.qty, 0), 0)) : '';
        })
        + `<div class="pv-actions"><button class="pv-tbtn danger" data-act="del-mat" data-i="${m.id}">${ICON.trash}Malzemeyi sil</button></div>`)).join('');
    } else {
      h += sec('Malzemeler', hint('Malzeme tanımlanmadıysa hat sınırsız malzemeyle çalışır. Tanımlanan malzemeler istasyonlarda "Operatör ve malzeme" bölümünden tüketime bağlanır.'));
    }
    return h + `<div class="pv-actions">${addBtn('add-mat', 'Malzeme')}<button class="pv-tbtn" data-act="add-bom">Standart PV BOM ekle</button></div>`
      + hint('Başlangıç stoğu simülasyon sıfırlanınca uygulanır.');
  }

  _shiftForm() {
    const st = this.L.settings;
    let h = sec('Vardiya', field('Vardiya / gün', 'set.shifts_per_day', st.shifts_per_day, { type: 'int', min: 1, max: 6 })
      + field('Vardiya süresi', 'set.shift_hours', st.shift_hours, { min: 0.5, max: 24, unit: 'saat', hint: 'Gün 00:00\'da başlar; vardiyalar arka arkaya. Kalan süre vardiya dışıdır.' })
      + field('Operatör sayısı', 'set.operators', st.operators, { type: 'int', min: 0, unit: 'kişi', hint: '0 = sınırsız. Operatörlü istasyonlar havuzdan operatör alır.' })
      + check('Molada tüm hat durur', 'set.break_stops_all', st.break_stops_all));
    h += sec('Molalar (her vardiyada)', (st.breaks.length
      ? `<table class="pv-grid"><tr><th>Ad</th><th>Başlangıç dk</th><th>Süre dk</th><th></th></tr>`
        + st.breaks.map((b, i) => `<tr><td>${cell(`brk.${i}.name`, b.name, { type: 'text' })}</td>`
          + `<td>${cell(`brk.${i}.at_min`, b.at_min, { min: 0 })}</td><td>${cell(`brk.${i}.dur_min`, b.dur_min, { min: 0 })}</td>`
          + `<td>${delBtn('del-brk', i)}</td></tr>`).join('') + `</table>`
      : '') + addBtn('add-brk', 'Mola') + hint('Varsayılan olarak molada sadece operatörlü istasyonlar durur.'));
    return h;
  }

  _modelForm() {
    const L = this.L;
    return sec('Simülasyon', field('Isınma süresi', 'set.warmup_h', L.settings.warmup_h, { min: 0, unit: 'saat', hint: 'Bu süre boyunca istatistik sayılmaz (hat dolarken)' })
      + field('Rastgele tohum', 'sess.seed', this.session.seed, { type: 'int', min: 1, hint: 'Aynı tohum → aynı sonuç' })
      + hint('Isınma, tohum ve başlangıç stokları simülasyon sıfırlanınca uygulanır.')
      + `<div class="pv-actions"><button class="pv-tbtn" data-act="reset-sim">${ICON.reset}Simülasyonu sıfırla</button></div>`)
      + sec('3D ölçek', field('Plan ölçeği', 'meta.metersPerPx', L.meta.metersPerPx, { min: 0.01, unit: 'm / px', rebuild: 1,
        hint: 'Python 2D planındaki 1 pikselin metre karşılığı' }));
  }

  // ──────────────────────────────────────
  //  OLAYLAR
  // ──────────────────────────────────────
  _parse(inp) {
    const t = inp.dataset.type;
    if (t === 'bool') return inp.checked;
    if (t === 'text') return inp.value;
    if (t === 'rot') return inp.value === '' ? null : Number(inp.value);
    if (t === 'optnum' && inp.value.trim() === '') return null;
    let v = Number(inp.value);
    if (!Number.isFinite(v)) return undefined;
    if (t === 'int') v = Math.round(v);
    if (inp.dataset.min != null) v = Math.max(Number(inp.dataset.min), v);
    if (inp.dataset.max != null) v = Math.min(Number(inp.dataset.max), v);
    return v;
  }

  _change(e) {
    const inp = e.target.closest('[data-path]');
    if (!inp) return;
    const v = this._parse(inp);
    if (v === undefined) { this.render(); return; }
    const L = this.L, S = this.session;
    const s = L.stations.get(S.selectedId);
    const c = S.selection?.type === 'conveyor' ? L.conveyors.get(S.selection.id) : null;
    const [scope, a, b] = inp.dataset.path.split('.');
    switch (scope) {
      case 'st': s[a] = v; break;
      case 'cv': c[a] = v; break;
      case 'set': L.settings[a] = v; break;
      case 'meta': L.meta[a] = v; break;
      case 'sess': S[a] = v; S.engine[a] = v; break;
      case 'pt': L.productTypes.find(p => p.id === Number(a))[b] = v; break;
      case 'mat': L.materials.find(m => m.id === Number(a))[b] = v; break;
      case 'scen': s.cycle_scenarios[a][b] = v; break;
      case 'bin': s.bins[a][b] = v; break;
      case 'con': s.consumes[a][b] = v; break;
      case 'brk': L.settings.breaks[a][b] = v; break;
      case 'ov': {
        const pt = L.productTypes.find(p => p.id === Number(a));
        if (v == null) delete pt.cycle_overrides[s.id]; else pt.cycle_overrides[s.id] = v;
        break;
      }
    }
    if (inp.dataset.rebuild) L.touch();
    this._commit();
    if (inp.dataset.rerender) this.render();
  }

  _click(e) {
    const btn = e.target.closest('button');
    if (!btn || !this.el.contains(btn)) return;
    if (btn.dataset.stab) { this.stationTab = btn.dataset.stab; this.render(); return; }
    if (btn.dataset.ltab) { this.lineTab = btn.dataset.ltab; this.render(); return; }
    const act = btn.dataset.act;
    if (!act) return;
    const L = this.L, S = this.session;
    const s = L.stations.get(S.selectedId);
    const i = Number(btn.dataset.i);
    switch (act) {
      case 'st-rotate': this.editor.rotateSelection(); return;
      case 'st-after': this.onInsertAfter?.(); return;
      case 'st-parallel': this.editor.addParallelSelection(); return;
      case 'sel-st': S.select(i); this.editor.view.focus(i); return;
      case 'st-dup': this.editor.duplicateSelection(); return;
      case 'st-del': this.editor.deleteSelection(); return;
      case 'cv-del': this.editor.deleteSelection(); return;
      case 'cv-reverse': {
        const c = L.conveyors.get(S.selection.id);
        if (L.conveyorBetween(c.to_id, c.from_id)) return;
        [c.from_id, c.to_id] = [c.to_id, c.from_id];
        L.touch();
        break;
      }
      case 'reset-sim': S.reset(); return;
      case 'add-scen':
        if (!s.cycle_scenarios.length) s.cycle_scenarios.push({ name: 'Normal', probability: 100, cycle_time: s.cycle_time });
        else s.cycle_scenarios.push({ name: 'Yeni', probability: 0, cycle_time: s.cycle_time });
        break;
      case 'del-scen': s.cycle_scenarios.splice(i, 1); break;
      case 'add-bin': s.bins.push({ name: `Sınıf-${s.bins.length + 1}`, probability: 0, capacity: 100, current: 0 }); break;
      case 'del-bin': if (s.bins.length > 1) s.bins.splice(i, 1); break;
      case 'add-con': s.consumes.push({ material_id: L.materials[0].id, qty: 1 }); break;
      case 'del-con': s.consumes.splice(i, 1); break;
      case 'add-brk': L.settings.breaks.push({ name: 'Mola', at_min: 120, dur_min: 15 }); break;
      case 'del-brk': L.settings.breaks.splice(i, 1); break;
      case 'add-pt': L.addProductType(); break;
      case 'del-pt': L.productTypes = L.productTypes.filter(p => p.id !== i); break;
      case 'add-mat': L.addMaterial(); L.touch(); break;
      case 'del-mat': L.removeMaterial(i); L.touch(); break;
      case 'add-bom': addStandardBOM(L); L.touch(); break;
      default: return;
    }
    this._commit();
    this.render();
  }

  // Kendi düzenlememizde 'edit' olayıyla formu yeniden çizme (odak kaybolmasın)
  _commit() {
    this._selfEdit = true;
    try { this.session.commit(); } finally { this._selfEdit = false; }
  }

  dispose() {
    this._offs.forEach(off => off());
    this.el.removeEventListener('click', this._onClick);
    this.el.removeEventListener('change', this._onChange);
  }
}
