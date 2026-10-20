// ─────────────────────────────────────────
//  RAPORLAR (görünümün üstünde açılan panel)
// ─────────────────────────────────────────
// Genel · İstasyonlar (OEE + durum dağılımı) · Zaman serisi · Vardiya · Depo · Malzeme · CSV
// Grafikler satır içi SVG: tek eksen, ince işaretler, 2px aralık, üzerine gelince ipucu,
// her grafiğin tablo karşılığı.
import { stationTag, categoryOf, STATUS_COLORS, STATUS_LABELS, shiftReport, warehouseSummary } from '../core/index.js';
import { BIN_COLORS } from '../view3d/materials.js';
import { esc, num, pct, duration, sec, ICON } from './ui.js';

const TABS = [['overview', 'Genel'], ['stations', 'İstasyonlar'], ['series', 'Zaman serisi'],
              ['shift', 'Vardiya raporu'], ['warehouse', 'Depo'], ['materials', 'Malzeme']];
const STATE_ORDER = ['working', 'setup', 'blocked', 'idle', 'no_operator', 'no_material', 'down', 'maint', 'break', 'offshift', 'paused'];
const INK = { grid: '#e7e3dc', axis: '#868b92', text: '#4b5058' };

// Temiz eksen adımları (0, 1, 2, 5 × 10ⁿ)
function ticks(max, n = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * p).find(s => s >= raw);
  const out = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out.at(-1) < max) out.push(out.at(-1) + step);
  return out;
}
const compact = v => v >= 1000 ? `${num(v / 1000, v >= 10000 ? 0 : 1)}B` : num(v, v < 10 && v % 1 ? 1 : 0);

export class ReportPanel {
  constructor(host, session) {
    this.session = session;
    this.tab = 'overview';
    this.refId = null;
    this.hours = null;
    const el = this.el = document.createElement('div');
    el.className = 'pv-report';
    el.hidden = true;
    host.appendChild(el);
    this.tip = document.createElement('div');
    this.tip.className = 'pv-tip';
    this.tip.hidden = true;
    el.addEventListener('click', e => this._click(e));
    el.addEventListener('change', e => this._change(e));
    el.addEventListener('pointermove', e => this._hover(e));
    el.addEventListener('pointerleave', () => this._hideTip());
  }

  get open() { return !this.el.hidden; }

  show() { this.el.hidden = false; this.render(); }
  hide() { this.el.hidden = true; }

  render() {
    const S = this.session;
    this.stats = S.stats();
    const st = this.stats;
    this.charts = {};
    const head = `<div class="pv-rep-head"><div><h2>Simülasyon raporu</h2>`
      + `<small>${duration(st.statsTime)} istatistik${st.warmup ? ' · ısınma sürüyor' : ''}`
      + `${S.engine.statsT0 > 0 ? ` · ilk ${duration(S.engine.statsT0)} ısınma hariç` : ''} · sim. saati ${duration(st.time)}</small></div>`
      + `<div class="pv-rep-actions"><button class="pv-tbtn" data-act="refresh">${ICON.reset}Yenile</button>`
      + `<button class="pv-tbtn" data-act="csv">${ICON.save}CSV</button>`
      + `<button class="pv-ibtn" data-act="close" aria-label="Kapat">${ICON.close}</button></div></div>`
      + `<div class="pv-tabs" role="tablist">${TABS.map(([k, t]) =>
        `<button role="tab" data-rtab="${k}" aria-selected="${this.tab === k}">${t}</button>`).join('')}</div>`;
    this.el.innerHTML = head + `<div class="pv-rep-body">${this[`_${this.tab}`]()}</div>`;
    this.el.appendChild(this.tip);
  }

  // ── Genel ──
  _overview() {
    const st = this.stats;
    const tile = (label, value, sub = '') => `<div class="pv-tile"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const live = st.statsTime > 0;
    return `<div class="pv-hero"><span>Tamamlanan modül</span><b>${st.completed.toLocaleString('tr-TR')}</b>`
      + `<small>${live ? `${num(st.plannedRatePerHour)} modül / planlı saat` : 'Simülasyonu başlatın'}</small></div>`
      + `<div class="pv-tiles">`
      + tile('Hat verimi (OEE)', live && st.theoreticalPerHour ? pct(st.lineEfficiency) : '—', st.bottleneck ? `darboğaz ${esc(st.bottleneck.name)}` : '')
      + tile('Teorik kapasite', st.theoreticalPerHour ? `${num(st.theoreticalPerHour)} /sa` : '—')
      + tile('Verim', live ? pct(st.yield) : '—', `${st.scrapped} hurda`)
      + tile('İlk geçiş verimi', st.completed ? pct(st.firstPassYield) : '—', `${st.escaped} kaçan hata`)
      + tile('Ortalama akış süresi', st.lead.n ? duration(st.lead.avg) : '—', st.lead.n ? `P90 ${duration(st.lead.p90)}` : '')
      + tile('Sistemdeki ürün', st.wip, `${st.pallets} palet depoda`)
      + `</div>` + this._hourlyChart() + this._wipChart();
  }

  // ── Zaman serisi ──
  _hourly() {
    const s = this.session.engine.series;
    return s.map((p, i) => ({
      h: p.h,
      out: p.completed - (i ? s[i - 1].completed : 0),
      scrap: p.scrapped - (i ? s[i - 1].scrapped : 0),
      wip: p.wip,
    }));
  }

  _hourlyChart() {
    const data = this._hourly();
    if (!data.length) return sec('Saatlik üretim', '<p class="pv-muted">İlk simülasyon saati tamamlanınca grafik oluşur.</p>');
    return sec('Saatlik üretim (modül)', this._columns('hourly', data.map(d => ({ x: d.h, y: d.out, label: `${d.h}. saat` })), '#2a78d6'));
  }

  _wipChart() {
    const data = this._hourly();
    if (data.length < 2) return '';
    return sec('Sistemdeki ürün (WIP, saat sonunda)', this._lines('wip', data.map(d => d.h), [{ name: 'WIP', color: '#6250d6', ys: data.map(d => d.wip) }]));
  }

  _series() {
    const data = this._hourly();
    if (!data.length) return '<p class="pv-muted">İlk simülasyon saati tamamlanınca seri oluşur. Hızlı koşu için araç çubuğundaki ⏩ düğmesini kullanın.</p>';
    return this._hourlyChart()
      + (data.some(d => d.scrap) ? sec('Saatlik hurda (modül)', this._columns('scrap', data.map(d => ({ x: d.h, y: d.scrap, label: `${d.h}. saat` })), '#e34948')) : '')
      + this._wipChart()
      + sec('Tablo', `<table class="pv-table"><tr><th>Saat</th><th>Üretim</th><th>Hurda</th><th>WIP</th></tr>`
        + data.map(d => `<tr><td>${d.h}</td><td>${d.out}</td><td>${d.scrap}</td><td>${d.wip}</td></tr>`).join('') + `</table>`);
  }

  // ── İstasyonlar ──
  _stations() {
    const st = this.stats;
    const L = this.session.layout;
    const bn = new Set(st.bottleneck?.ids ?? []);
    const legend = `<div class="pv-legend inline">${STATE_ORDER.map(k =>
      `<div><i class="sq" style="background:${STATUS_COLORS[k]}"></i>${STATUS_LABELS[k]}</div>`).join('')}</div>`;
    const rows = st.stations.map(r => {
      const s = L.stations.get(r.id);
      const total = Object.values(r.stateTime).reduce((a, v) => a + v, 0);
      const bar = total > 0 ? `<div class="pv-stack" data-chart="state" data-id="${r.id}">`
        + STATE_ORDER.filter(k => r.stateTime[k] > 0).map(k =>
          `<i style="width:${r.stateTime[k] / total * 100}%;background:${STATUS_COLORS[k]}" data-tip="${STATUS_LABELS[k]}|${num(r.stateTime[k] / total * 100)} %|${duration(r.stateTime[k])}"></i>`).join('')
        + `</div>` : '';
      const o = r.oee;
      const p = v => o ? num(v * 100, 0) : '—';
      return `<tr${bn.has(r.id) ? ' class="bn"' : ''}><td class="mono">${stationTag(s)}</td><td>${esc(r.name)}${bn.has(r.id) ? ' <span class="pv-flag">darboğaz</span>' : ''}</td>`
        + `<td>${r.processed}</td><td>${num(r.utilization, 0)}</td><td>${p(o?.A)}</td><td>${p(o?.P)}</td><td>${p(o?.Q)}</td>`
        + `<td><b>${p(o?.oee)}</b></td><td>${r.scrapped || ''}</td><td>${r.rejected || ''}</td><td>${r.failures || ''}</td><td class="pv-barcell">${bar}</td></tr>`;
    }).join('');
    return sec('İstasyon performansı', legend + `<div class="pv-scroll"><table class="pv-table wide"><tr><th>Etiket</th><th>İstasyon</th>`
      + `<th>İşlenen</th><th>Kull. %</th><th>A %</th><th>P %</th><th>Q %</th><th>OEE %</th><th>Hurda</th><th>Red</th><th>Arıza</th><th>Durum dağılımı</th></tr>`
      + rows + `</table></div>`
      + `<p class="pv-hint">A: kullanılabilirlik (arıza, bakım, ayar hariç planlı süre) · P: performans (ideal çevrimle üretilebilecek miktara oran) · Q: kalite (hurda ve red hariç). Buffer ve kürleme için OEE hesaplanmaz.</p>`);
  }

  // ── Vardiya raporu ──
  _shift() {
    const L = this.session.layout;
    const sts = [...L.stations.values()].filter(s => categoryOf(s) !== 'buffer');
    if (!sts.length) return '<p class="pv-muted">Hatta istasyon yok.</p>';
    if (!L.stations.has(this.refId)) this.refId = this.stats.bottleneck?.ids[0] ?? sts.at(-1).id;
    this.hours ??= L.settings.shift_hours;
    const rep = shiftReport(L, this.session.engine, this.refId, this.hours);
    const controls = `<div class="pv-controls"><label class="pv-field"><span>Referans istasyon</span><span class="pv-in"><select data-r="ref">`
      + sts.map(s => `<option value="${s.id}"${s.id === this.refId ? ' selected' : ''}>${stationTag(s)} ${esc(s.name)}</option>`).join('')
      + `</select></span></label><label class="pv-field"><span>Vardiya süresi</span><span class="pv-in"><input type="number" min="0.5" step="0.5" data-r="hours" value="${this.hours}"><em>saat</em></span></label></div>`;
    const tiles = `<div class="pv-tiles">`
      + `<div class="pv-tile"><span>Teorik saatlik</span><b>${num(rep.theoreticalHourly)}</b><small>panel / saat · efektif cycle ${num(rep.ref.ect)} sn</small></div>`
      + `<div class="pv-tile"><span>Teorik vardiya</span><b>${rep.theoreticalShift}</b><small>panel</small></div>`
      + (rep.real ? `<div class="pv-tile"><span>Gerçek hız</span><b>${num(rep.real.ratePerHour)}</b><small>panel / saat · ${rep.real.processed} geçen panel</small></div>`
        + `<div class="pv-tile"><span>Vardiya projeksiyonu</span><b>${rep.real.shiftProjection}</b><small>panel · OEE ${pct(rep.real.oee)}</small></div>` : '')
      + `</div>`;
    const table = `<div class="pv-scroll"><table class="pv-table wide"><tr><th>İstasyon</th><th>Cycle sn</th><th>Kaynak</th><th>Eff. CT sn</th>`
      + `<th>Kap. /sa</th><th>Kap. vardiya</th><th>Geçen</th><th>Gerçek /sa</th><th>Proj. vardiya</th></tr>`
      + rep.rows.map(r => `<tr class="${r.isRef ? 'ref' : r.isBottleneck ? 'bn' : ''}"><td>${esc(r.name)}${r.isRef ? ' <span class="pv-flag ref">referans</span>' : r.isBottleneck ? ' <span class="pv-flag">darboğaz</span>' : ''}</td>`
        + `<td>${num(r.cycle)}</td><td>${r.resources}</td><td>${num(r.ect)}</td><td>${num(r.capHour)}</td><td>${r.capShift}</td>`
        + `<td>${r.processed}</td><td>${num(r.realRate)}</td><td>${r.realShift}</td></tr>`).join('') + `</table></div>`;
    return controls + tiles + sec('İstasyon detayı', table);
  }

  // ── Depo ──
  _warehouse() {
    const wh = warehouseSummary(this.session.layout, this.session.engine);
    if (!wh.bins.length) return '<p class="pv-muted">Hatta sınıflandırma istasyonu yok.</p>';
    const max = Math.max(1, ...wh.bins.map(b => b.pallets));
    return `<div class="pv-tiles"><div class="pv-tile"><span>Toplam palet</span><b>${wh.totalPallets}</b></div>`
      + `<div class="pv-tile"><span>Paletlenmiş modül</span><b>${wh.totalModules.toLocaleString('tr-TR')}</b></div></div>`
      + sec('Hazne bazında', `<table class="pv-table"><tr><th>Hazne</th><th>Palet</th><th>Modül</th><th>Pay</th><th>Açık palet</th><th></th></tr>`
        + wh.bins.map((b, i) => `<tr><td><i class="sw" style="background:${BIN_COLORS[i % BIN_COLORS.length]}"></i>${esc(b.name)}</td>`
          + `<td>${b.pallets}</td><td>${b.modules}</td><td>${num(b.share)} %</td><td>${b.active} / ${b.capacity}</td>`
          + `<td class="pv-barcell"><div class="pv-hbar"><i style="width:${b.pallets / max * 100}%;background:${BIN_COLORS[i % BIN_COLORS.length]}"></i></div></td></tr>`).join('')
        + `</table>`);
  }

  // ── Malzeme ──
  _materials() {
    const L = this.session.layout, eng = this.session.engine;
    if (!L.materials.length) return '<p class="pv-muted">Malzeme tanımlı değil (Hat › Malzemeler).</p>';
    const hrs = Math.max(eng.statsTime / 3600, 1e-9);
    const table = `<table class="pv-table"><tr><th>Malzeme</th><th>Stok</th><th>Yolda</th><th>Sipariş noktası</th><th>Gelen</th><th>Tüketim /sa</th></tr>`
      + L.materials.map((m, i) => {
        const st = eng.stock.get(m.id) ?? { stock: m.stock, received: 0, orders: [] };
        const used = m.stock + st.received - st.stock;
        return `<tr><td><i class="sw" style="background:${BIN_COLORS[i % BIN_COLORS.length]}"></i>${esc(m.name)}</td><td>${num(st.stock, 0)} ${esc(m.unit)}</td>`
          + `<td>${num(st.orders.reduce((a, o) => a + o.qty, 0), 0)}</td><td>${num(m.reorder_point, 0)}</td><td>${num(st.received, 0)}</td><td>${num(used / hrs)}</td></tr>`;
      }).join('') + `</table>`;
    const s = eng.series;
    const chart = s.length >= 2
      ? sec('Stok seyri (saat sonunda, başlangıç stoğuna göre %)', this._lines('stock', s.map(p => p.h), L.materials.slice(0, 8).map((m, i) => ({
        name: m.name, color: BIN_COLORS[i], ys: s.map(p => (p.stock[m.id] ?? 0) / Math.max(1e-9, m.stock) * 100) })), '%'))
      : '';
    return chart + sec('Malzemeler', table);
  }

  // ──────────────────────────────────────
  //  SVG GRAFİKLER
  // ──────────────────────────────────────
  _size() {
    return { w: Math.max(320, Math.min(1100, this.el.clientWidth - 64)), h: 190, l: 44, r: 16, t: 10, b: 26 };
  }

  // Tek seri sütun grafiği: ≤24px sütun, üstte 4px yuvarlak, 2px aralık, sütun başına ipucu
  _columns(id, pts, color) {
    const { w, h, l, r, t, b } = this._size();
    const max = Math.max(1, ...pts.map(p => p.y));
    const ts = ticks(max);
    const top = ts.at(-1);
    const iw = w - l - r, ih = h - t - b;
    const band = iw / pts.length;
    const bw = Math.max(1, Math.min(24, band - 2));
    const y = v => t + ih - v / top * ih;
    const every = Math.ceil(pts.length / Math.max(1, Math.floor(iw / 36)));
    let svg = ts.map(v => `<line x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}" stroke="${INK.grid}"/>`
      + `<text x="${l - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`).join('');
    const maxI = pts.reduce((bi, p, i) => (p.y > pts[bi].y ? i : bi), 0);
    pts.forEach((p, i) => {
      const x = l + i * band + (band - bw) / 2;
      const hgt = ih - (y(p.y) - t);
      if (hgt > 0) {
        const rr = Math.min(4, bw / 2, hgt);
        svg += `<path d="M${x},${t + ih}V${y(p.y) + rr}q0,-${rr} ${rr},-${rr}h${bw - 2 * rr}q${rr},0 ${rr},${rr}V${t + ih}z" fill="${color}"/>`;
      }
      svg += `<rect x="${l + i * band}" y="${t}" width="${band}" height="${ih}" fill="transparent" data-tip="${esc(p.label)}|${p.y}"/>`;
      if (i % every === 0) svg += `<text x="${l + i * band + band / 2}" y="${h - 8}" text-anchor="middle">${p.x}</text>`;
    });
    if (pts.length) {
      const p = pts[maxI];
      svg += `<text class="v" x="${l + maxI * band + band / 2}" y="${y(p.y) - 6}" text-anchor="middle">${p.y}</text>`;
    }
    return `<svg class="pv-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="sütun grafiği">${svg}</svg>`;
  }

  // Çizgi grafiği: 2px çizgiler, ≥2 seride lejant, ≤4 seride uç etiketi, artı imleçli ipucu
  _lines(id, xs, series, unit = '') {
    const { w, h, l, t, b } = this._size();
    const r = series.length <= 4 && series.length > 1 ? 110 : 16;
    const max = Math.max(1, ...series.flatMap(s => s.ys));
    const ts = ticks(max);
    const top = ts.at(-1);
    const iw = w - l - r, ih = h - t - b;
    const x = i => l + (xs.length > 1 ? i / (xs.length - 1) * iw : iw / 2);
    const y = v => t + ih - v / top * ih;
    let svg = ts.map(v => `<line x1="${l}" x2="${l + iw}" y1="${y(v)}" y2="${y(v)}" stroke="${INK.grid}"/>`
      + `<text x="${l - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}${unit}</text>`).join('');
    const every = Math.ceil(xs.length / Math.max(1, Math.floor(iw / 40)));
    xs.forEach((v, i) => { if (i % every === 0) svg += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${v}</text>`; });
    for (const s of series) {
      svg += `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.ys.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
      const li = s.ys.length - 1;
      svg += `<circle cx="${x(li)}" cy="${y(s.ys[li])}" r="4" fill="${s.color}" stroke="#faf9f6" stroke-width="2"/>`;
      if (r > 16) svg += `<text x="${x(li) + 8}" y="${y(s.ys[li]) + 4}">${esc(s.name)}</text>`;
    }
    svg += `<line class="pv-xhair" x1="0" x2="0" y1="${t}" y2="${t + ih}" stroke="${INK.axis}" visibility="hidden"/>`;
    svg += `<rect x="${l}" y="${t}" width="${iw}" height="${ih}" fill="transparent" data-line="${id}"/>`;
    this.charts[id] = { xs, series, unit, x0: l, iw, x };
    const legend = series.length > 1 ? `<div class="pv-legend inline">${series.map(s =>
      `<div><i class="line" style="background:${s.color}"></i>${esc(s.name)}</div>`).join('')}</div>` : '';
    return legend + `<svg class="pv-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="çizgi grafiği">${svg}</svg>`;
  }

  // ── İpucu ──
  _hover(e) {
    const line = e.target.closest('[data-line]');
    if (line) {
      const c = this.charts[line.dataset.line];
      const svg = line.ownerSVGElement;
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (svg.viewBox.baseVal.width / rect.width);
      const i = Math.max(0, Math.min(c.xs.length - 1, Math.round((px - c.x0) / c.iw * (c.xs.length - 1))));
      const xh = svg.querySelector('.pv-xhair');
      xh.setAttribute('x1', c.x(i));
      xh.setAttribute('x2', c.x(i));
      xh.setAttribute('visibility', 'visible');
      this._showTip(e, `${c.xs[i]}. saat`, c.series.map(s => [s.color, s.name, `${num(s.ys[i], c.unit ? 1 : 0)}${c.unit}`]));
      return;
    }
    const m = e.target.closest('[data-tip]');
    if (m) {
      const [a, v, extra] = m.dataset.tip.split('|');
      this._showTip(e, a, [[null, extra ?? '', v]]);
      return;
    }
    this._hideTip();
  }

  _showTip(e, title, rows) {
    const tip = this.tip;
    tip.replaceChildren();
    const h = document.createElement('div');
    h.className = 'h';
    h.textContent = title;
    tip.appendChild(h);
    for (const [color, name, value] of rows) {
      const r = document.createElement('div');
      if (color) { const k = document.createElement('i'); k.style.background = color; r.appendChild(k); }
      const b = document.createElement('b');
      b.textContent = value;
      r.appendChild(b);
      if (name) r.appendChild(document.createTextNode(` ${name}`));
      tip.appendChild(r);
    }
    const box = this.el.getBoundingClientRect();
    tip.hidden = false;
    const x = Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${e.clientY - box.top + this.el.scrollTop + 14}px`;
  }

  _hideTip() {
    this.tip.hidden = true;
    this.el.querySelectorAll('.pv-xhair').forEach(x => x.setAttribute('visibility', 'hidden'));
  }

  // ── Olaylar ──
  _click(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.rtab) { this.tab = btn.dataset.rtab; this.render(); return; }
    switch (btn.dataset.act) {
      case 'close': this.hide(); break;
      case 'refresh': this.render(); break;
      case 'csv': this._csv(); break;
    }
  }

  _change(e) {
    const r = e.target.dataset.r;
    if (r === 'ref') this.refId = Number(e.target.value);
    if (r === 'hours') this.hours = Math.max(0.5, Number(e.target.value) || 8);
    if (r) this.render();
  }

  // Excel uyumlu CSV (; ayraç, virgüllü ondalık, UTF-8 BOM)
  _csv() {
    const st = this.session.stats();
    const L = this.session.layout;
    const n = v => typeof v === 'number' ? String(Number(v.toFixed(3))).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`;
    const line = cells => cells.map(n).join(';');
    const out = [line(['Simülasyon raporu', `istatistik süresi (sa)`, st.statsTime / 3600])];
    out.push(line(['Tamamlanan', st.completed]), line(['Saatlik (planlı)', st.plannedRatePerHour]),
             line(['Hat verimi %', st.lineEfficiency]), line(['Verim %', st.yield]), line(['FPY %', st.firstPassYield]),
             line(['Hurda', st.scrapped]), line(['Kaçan hata', st.escaped]), line(['Ort. akış süresi (sn)', st.lead.avg]), '');
    out.push(line(['Etiket', 'İstasyon', 'İşlenen', 'Kullanım %', 'A %', 'P %', 'Q %', 'OEE %', 'Hurda', 'Red', 'Arıza',
                   ...STATE_ORDER.map(k => `${STATUS_LABELS[k]} (sn)`)]));
    for (const r of st.stations) {
      const o = r.oee;
      out.push(line([stationTag(L.stations.get(r.id)), r.name, r.processed, r.utilization,
                     o ? o.A * 100 : '', o ? o.P * 100 : '', o ? o.Q * 100 : '', o ? o.oee * 100 : '',
                     r.scrapped, r.rejected, r.failures, ...STATE_ORDER.map(k => r.stateTime[k] ?? 0)]));
    }
    out.push('', line(['Saat', 'Üretim', 'Hurda', 'WIP']));
    for (const d of this._hourly()) out.push(line([d.h, d.out, d.scrap, d.wip]));
    this.exporter?.('hat-raporu.csv', '\ufeff' + out.join('\r\n'), 'text/csv;charset=utf-8');
  }
}

