// Arayüz yardımcıları: kaçış, biçimlendirme, küçük HTML parçaları, çizgi ikonlar
import { STATUS_COLORS, STATUS_LABELS } from '../core/index.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const num = (v, d = 1) => Number(v.toFixed(d)).toLocaleString('tr-TR');
export const pct = v => `${num(v, 1)} %`;
export const sn = v => `${num(v, 1)} sn`;

export function clock(t) {
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60);
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export function duration(t) {
  if (t < 90) return `${num(t, 0)} sn`;
  if (t < 5400) return `${num(t / 60, 1)} dk`;
  return `${num(t / 3600, 1)} sa`;
}

export const row = (k, v) => `<div class="pv-row"><span>${k}</span><b>${v}</b></div>`;
export const meter = (v, color) => `<div class="pv-meter"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(1)}%${color ? `;background:${color}` : ''}"></i></div>`;
export const sec = (title, body, extra = '') => `<section class="pv-sec"${extra}><h3 class="cap">${title}</h3>${body}</section>`;

// Durum süre dağılımı: yığılmış çubuk + yüzde listesi
const STATE_ORDER = ['working', 'setup', 'blocked', 'idle', 'no_operator', 'no_material', 'down', 'maint', 'break', 'offshift', 'paused'];
export function stateBar(stateTime) {
  const total = Object.values(stateTime).reduce((a, v) => a + v, 0);
  if (total <= 0) return '<p class="pv-muted">Henüz veri yok.</p>';
  const parts = STATE_ORDER.filter(k => stateTime[k] > 0).map(k => [k, stateTime[k] / total * 100]);
  return `<div class="pv-stack">${parts.map(([k, p]) => `<i style="width:${p}%;background:${STATUS_COLORS[k]}" title="${STATUS_LABELS[k]} ${num(p)} %"></i>`).join('')}</div>`
    + `<div class="pv-legend">${parts.map(([k, p]) => `<div><i class="sq" style="background:${STATUS_COLORS[k]}"></i>${STATUS_LABELS[k]}<b>${num(p, 0)}%</b></div>`).join('')}</div>`;
}

// Çizgi ikonlar (24×24)
const svg = (d, fill = false) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" ${fill
  ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square"'}>${d}</svg>`;
export const ICON = {
  play:    svg('<path d="M8 5.5v13l11-6.5z"/>', true),
  pause:   svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  reset:   svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  minus:   svg('<path d="M6 12h12"/>'),
  plus:    svg('<path d="M12 6v12M6 12h12"/>'),
  cube:    svg('<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7L12 12l7.5-4.3M12 12v8.5"/>'),
  plan:    svg('<path d="M4 4h16v16H4zM4 10h16M10 10v10"/>'),
  label:   svg('<path d="M4 5h16v10h-7l-3.5 3.5V15H4z"/>'),
  fit:     svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  home:    svg('<path d="M4 11.5L12 5l8 6.5"/><path d="M6.5 9.5v10h11v-10"/>'),
  open:    svg('<path d="M3.5 6h6l2 2.5h9v10.5h-17z"/>'),
  save:    svg('<path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15"/>'),
  cursor:  svg('<path d="M6 3.5l12.5 7-5.5 1.8-2.6 5.7z"/>'),
  link:    svg('<path d="M4 17h4.5l7-10H20"/><path d="M17 4l3 3-3 3"/><path d="M4 15v4"/>'),
  undo:    svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo:    svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  gear:    svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  library: svg('<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>'),
  report:  svg('<path d="M4 20h16M7 16.5v-6M12 16.5V5M17 16.5v-4"/>'),
  file:    svg('<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/>'),
  trash:   svg('<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>'),
  copy:    svg('<path d="M8 8h11v11H8z"/><path d="M5 16V5h11"/>'),
  rotate:  svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
  swap:    svg('<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>'),
  close:   svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  fast:    svg('<path d="M4 6l7 6-7 6zM12 6l7 6-7 6z"/>', true),
  expand:  svg('<path d="M4 9.5V4h5.5M14.5 4H20v5.5M20 14.5V20h-5.5M9.5 20H4v-5.5M4 4l5.5 5.5M20 4l-5.5 5.5M20 20l-5.5-5.5M4 20l5.5-5.5"/>'),
  shrink:  svg('<path d="M9.5 4v5.5H4M20 9.5h-5.5V4M14.5 20v-5.5H20M4 14.5h5.5V20M4 4l5.5 5.5M20 4l-5.5 5.5M20 20l-5.5-5.5M4 20l5.5-5.5"/>'),
  chevron: svg('<path d="M6 15l6-6 6 6"/>'),
  parallel: svg('<path d="M4 7.5h16M4 16.5h16"/><path d="M16.5 4l3.5 3.5-3.5 3.5M16.5 13l3.5 3.5-3.5 3.5"/>'),
  arrange: svg('<path d="M3.5 5h6v4h-6zM14.5 5h6v4h-6zM3.5 15h6v4h-6zM14.5 15h6v4h-6z"/><path d="M9.5 7h5M17.5 9v6M14.5 17h-5"/>'),
  wand:    svg('<path d="M4 20L15 9"/><path d="M15 4v2.5M15 11.5V14M19.5 9H17M13 9h-2.5M18.2 5.8l-1.6 1.6M18.2 12.2l-1.6-1.6"/>'),
};
