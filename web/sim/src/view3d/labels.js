// ─────────────────────────────────────────
//  İSTASYON ETİKETLERİ (2D'deki yazıların karşılığı)
// ─────────────────────────────────────────
// Başlık: durum karesi + etiket kodu + isim. Detay: [ad, değer] çiftleri (değerler monospace).
import { categoryOf, stationTag } from '../core/catalog.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function room(r, now) {
  if (!r) return '—';
  const rem = r.doneTime - now;
  return `${r.items.length} · ${rem > 0 ? `${Math.ceil(rem)}s` : 'bitti'}`;
}

export function stationFields(s, rt, engine) {
  switch (categoryOf(s)) {
    case 'buffer':
      return [['stok', `${rt.queue.length}/${s.buffer_capacity}`]];
    case 'curing':
      return [['stok', `${rt.queue.length}/${s.buffer_capacity}`], ['süre', `${s.cycle_time}s`]];
    case 'classification': {
      const pallets = engine.warehouse.reduce((n, p) => n + (p.station_id === s.id), 0);
      return [['işlenen', rt.processed], ['palet', pallets]];
    }
  }
  if (s.kind === 'lamination') {
    const feed = `${rt.lamFeed.length}/${Math.max(s.lam_batch_size, s.lam_feed_cap)}`;
    return [
      ['besleme', rt.queue.length ? `${feed} +${rt.queue.length}` : feed],
      ['oda 1', room(rt.lamRoom1, engine.time)],
      ['oda 2', room(rt.lamRoom2, engine.time)],
      ['soğutma', rt.lamCooling.length],
    ];
  }
  if (s.kind === 'layup') return [['string', `${rt.stringCount}/${s.strings_per_panel}`], ['işlenen', rt.processed]];
  return [['kuyruk', rt.queue.length], ['işlenen', rt.processed]];
}

// level: 0 = sadece etiket kodu · 1 = kod + isim · 2 = kod + isim + canlı değerler
export function stationLabelHTML(s, rt, engine, status, level) {
  const head = `<div class="h"><i class="sq st-${status}"></i><span class="pvl-tag">${stationTag(s)}</span>`
    + (level > 0 ? `<span class="nm">${esc(s.name)}</span>` : '') + `</div>`;
  if (level < 2) return head;
  const fields = stationFields(s, rt, engine).map(([k, v]) => `<em>${k}<b>${esc(v)}</b></em>`).join('');
  return `${head}<div class="d">${fields}</div>`;
}
