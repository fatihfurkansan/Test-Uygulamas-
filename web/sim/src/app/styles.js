// Simülatör stilleri — tek seferlik <style> olarak eklenir, tümü .pvsim altında kapsüllü
// (barındıran sitenin stilleriyle çakışmaz). Fontlar pakete gömülü (vendor/fonts, OFL).
import { STATUS_COLORS } from '../core/index.js';

const font = file => new URL(`../../vendor/fonts/${file}`, import.meta.url).href;
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const faces = (family, prefix, weights) => weights.flatMap(w => [['latin', LATIN], ['latin-ext', LATIN_EXT]].map(([sub, range]) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;`
  + `src:url(${font(`${prefix}-${sub}-${w}-normal.woff2`)}) format("woff2");unicode-range:${range}}`)).join('\n');

const statusClasses = Object.entries(STATUS_COLORS).map(([k, c]) => `.pvsim .st-${k}{background:${c}}`).join('\n');

const CSS = `
${faces('PVSim Barlow', 'barlow', [400, 500, 600, 700])}
${faces('PVSim Plex Mono', 'ibm-plex-mono', [400, 500])}

.pvsim{--paper:#f2f0eb;--sheet:#faf9f6;--ink:#16181b;--ink-2:#4b5058;--ink-3:#868b92;--rule:#d9d5cd;--rule-2:#e7e3dc;
  --accent:#e8571b;--accent-wash:#fbeee6;--run:#23955a;--block:#e3a008;--stop:#d23b2f;--idle:#9a9ea4;
  --ui:"PVSim Barlow","Barlow","Segoe UI",system-ui,sans-serif;--mono:"PVSim Plex Mono","IBM Plex Mono",ui-monospace,monospace;
  position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:320px;
  background:var(--paper);color:var(--ink);font:400 14px/1.35 var(--ui);overflow:hidden;-webkit-font-smoothing:antialiased;outline:none}
.pvsim *{box-sizing:border-box}
.pvsim :where(button){font:inherit;color:inherit;touch-action:manipulation}
.pvsim :where(button:disabled){opacity:.35;cursor:default}
.pvsim svg{display:block;flex:none}
/* barındıran sitenin öğe stillerini (tablo, başlık, small) sıfırla; sınıflı kurallar bunları ezer */
.pvsim :where(table){border-collapse:collapse;font-size:inherit}
.pvsim :where(th,td){padding:0;border:0;text-align:left;vertical-align:middle;font-size:inherit;font-weight:inherit;
  letter-spacing:normal;text-transform:none;color:inherit;white-space:normal}
.pvsim :where(h2,h3,h4){margin:0;font:inherit;letter-spacing:normal}
.pvsim :where(small){color:inherit}
.pvsim :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pvsim .cap{font:600 10.5px/1 var(--ui);letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3)}
.pvsim .mono{font-family:var(--mono);font-size:12px}
.pvsim .sq{display:inline-block;width:9px;height:9px;flex:none}
${statusClasses}

/* ── tam ekran: tarayıcının kendi tam ekranı ya da (iPhone, gömülü çerçeve) sayfayı kaplama ── */
.pvsim:fullscreen{width:100%;height:100%;min-height:0}
.pvsim.pv-max{position:fixed;inset:0;z-index:2147483000;width:auto;height:auto;min-height:0;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
html.pvsim-lock,html.pvsim-lock body{overflow:hidden!important;overscroll-behavior:none}

/* ── araç şeridi ── */
.pvsim-bar{display:flex;align-items:stretch;min-height:58px;background:var(--sheet);border-bottom:1px solid var(--rule);position:relative;z-index:5}
.pv-transport{display:flex;align-items:center;gap:8px;padding:0 14px;border-right:1px solid var(--rule)}
.pv-play{width:40px;height:40px;display:grid;place-items:center;background:var(--ink);color:#fff;border:0;border-radius:2px;cursor:pointer}
.pv-play:hover{background:#2c2f34}
.pv-play.running{background:var(--accent)}
.pv-ibtn{width:34px;height:34px;display:grid;place-items:center;background:transparent;border:1px solid var(--rule);
  border-radius:2px;cursor:pointer;color:var(--ink-2);position:relative}
.pv-ibtn:hover:not(:disabled){border-color:var(--ink-3);color:var(--ink)}
.pv-ibtn[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.pv-ibtn.solid{background:var(--sheet)}
.pv-ibtn[aria-pressed="true"].solid{background:var(--ink)}
.pv-ibtn[data-progress]::after{content:attr(data-progress);position:absolute;top:100%;left:50%;transform:translate(-50%,4px);
  font:500 10px var(--mono);background:var(--ink);color:#fff;padding:2px 5px;border-radius:2px;white-space:nowrap}
.pv-speed{display:flex;align-items:center;margin-left:8px}
.pv-speed .cap{margin-right:8px}
.pv-speed button{width:26px;height:30px;display:grid;place-items:center;border:1px solid var(--rule);background:transparent;cursor:pointer;color:var(--ink-2)}
.pv-speed button:hover{border-color:var(--ink-3);color:var(--ink)}
.pv-speed output{min-width:56px;text-align:center;font:500 15px/1 var(--mono)}
.pv-readouts{display:flex;flex:1;min-width:0;overflow:hidden}
.pv-ro{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 16px;border-right:1px solid var(--rule-2);white-space:nowrap}
.pv-ro b{font:500 17px/1 var(--mono);font-variant-numeric:tabular-nums}
.pv-ro b small{font-size:11px;color:var(--ink-3);margin-left:3px}
.pv-ro.bn{min-width:0}
.pv-ro.bn b{display:flex;align-items:center;gap:8px;font:600 15px/1 var(--ui);overflow:hidden;text-overflow:ellipsis}
.pv-ro.bn b::before{content:"";width:8px;height:8px;flex:none;background:var(--accent)}
.pv-tools{display:flex;align-items:center;gap:6px;padding:0 14px;border-left:1px solid var(--rule)}
.pv-tbtn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:1px solid var(--rule);background:transparent;
  border-radius:2px;font-weight:600;cursor:pointer;white-space:nowrap}
.pv-tbtn:hover{border-color:var(--ink-3)}
.pv-tbtn svg{width:16px;height:16px}
.pv-tbtn.pri{background:var(--ink);border-color:var(--ink);color:#fff}
.pv-tbtn.pri:hover{background:#2c2f34;border-color:#2c2f34}
.pv-tbtn.danger{color:var(--stop)}
.pv-tbtn.danger:hover{border-color:var(--stop)}
.pv-menuwrap{position:relative}
.pv-menu{position:absolute;top:calc(100% + 6px);left:0;min-width:230px;background:var(--sheet);border:1px solid var(--rule);
  box-shadow:0 8px 24px rgba(22,24,27,.14);padding:5px;z-index:30;display:flex;flex-direction:column}
.pv-menu.right{left:auto;right:0}
.pv-menu[hidden]{display:none}
.pv-menu button{text-align:left;background:none;border:0;padding:8px 10px;font-weight:500;cursor:pointer;border-radius:2px}
.pv-menu button:hover{background:var(--paper)}
.pv-menu hr{border:0;border-top:1px solid var(--rule-2);margin:4px 0}

/* ── görünüm ve üstündeki araçlar ── */
.pvsim-main{position:relative;flex:1;display:flex;min-height:0}
.pvsim-viewport{position:relative;flex:1;min-width:0;overflow:hidden;background:#e4e3df;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.pvsim-canvas{display:block;width:100%;height:100%;touch-action:none}
.pvsim-labels{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.pv-rail{position:absolute;z-index:3;left:12px;top:12px;display:flex;flex-direction:column;gap:6px;padding:6px;
  background:var(--sheet);border:1px solid var(--rule);box-shadow:0 2px 8px rgba(22,24,27,.08)}
.pv-rail .pv-ibtn{border-color:transparent}
.pv-rail-sep{height:1px;background:var(--rule-2);margin:0 2px}
.pv-viewctl{position:absolute;z-index:3;right:12px;top:12px;display:flex;gap:6px;align-items:center}
.pv-seg{display:flex;border:1px solid var(--ink);border-radius:2px;overflow:hidden;background:var(--sheet)}
.pv-seg button{display:flex;align-items:center;gap:6px;height:32px;padding:0 11px;background:transparent;border:0;font-weight:600;cursor:pointer}
.pv-seg button+button{border-left:1px solid var(--ink)}
.pv-seg button.on{background:var(--ink);color:#fff}
.pv-modehint{position:absolute;z-index:3;left:50%;top:12px;transform:translateX(-50%);background:var(--ink);color:#fff;
  padding:7px 12px;font-size:13px;border-radius:2px;max-width:calc(100% - 300px);text-align:center}
.pv-modehint b{color:#ffb38f}
.pv-modehint button{margin-left:12px;background:none;border:1px solid rgba(255,255,255,.45);color:#fff;padding:3px 9px;border-radius:2px;font-weight:600;cursor:pointer}
.pv-modehint button:hover{border-color:#fff}
.pvsim-hint{position:absolute;z-index:1;left:12px;bottom:10px;display:flex;flex-wrap:wrap;gap:4px 14px;font:500 12px var(--ui);color:var(--ink-2);pointer-events:none}
.pvsim-hint kbd{font:500 10.5px var(--mono);padding:2px 5px;border:1px solid var(--rule);background:var(--sheet);border-radius:2px;margin-right:5px}

/* ── süreç kütüphanesi ── */
.pv-palette{position:absolute;z-index:4;left:66px;top:12px;bottom:12px;width:268px;display:flex;flex-direction:column;
  background:var(--sheet);border:1px solid var(--rule);box-shadow:0 6px 20px rgba(22,24,27,.12)}
.pv-palette[hidden]{display:none}
.pv-pal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 6px 14px}
.pv-search{margin:0 10px 8px;height:32px;border:1px solid var(--rule);background:#fff;padding:0 10px;font:inherit;border-radius:2px}
.pv-pal-list{flex:1;overflow:auto;padding:0 6px 6px}
.pv-pal-group h4{margin:12px 8px 6px}
.pv-pal-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:1px solid transparent;
  padding:6px 8px;cursor:pointer;border-radius:2px}
.pv-pal-item:hover{background:var(--paper)}
.pv-pal-item[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-wash)}
.pv-pal-item .pv-tag{min-width:42px;text-align:center}
.pv-pal-item b{display:block;font-weight:600;font-size:13.5px}
.pv-pal-item small{color:var(--ink-3);font-size:12px}
.pv-palette .pv-hint{margin:0;padding:10px 14px;border-top:1px solid var(--rule-2)}
.pv-pal-mode{display:flex;margin:0 10px 8px;border:1px solid var(--ink);border-radius:2px;overflow:hidden}
.pv-pal-mode button{flex:1;height:30px;background:var(--sheet);border:0;font-weight:600;font-size:12.5px;cursor:pointer}
.pv-pal-mode button+button{border-left:1px solid var(--ink)}
.pv-pal-mode button[aria-pressed="true"]{background:var(--ink);color:#fff}
.pv-pal-anchor{display:flex;align-items:center;gap:8px;margin:0 10px 8px;padding:7px 9px;background:var(--accent-wash);border-left:2px solid var(--accent);font-size:13px}
.pv-pal-anchor:empty{display:none}
.pv-pal-anchor b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-pal-anchor span:last-child{margin-left:auto;color:var(--ink-3);white-space:nowrap}
.pv-pal-anchor .pv-tag{padding:4px 5px;font-size:10.5px}
.pv-pal-plus{display:none;margin-left:auto;color:var(--accent)}
.pv-palette.after .pv-pal-plus{display:block}
.pv-palette.after .pv-pal-item:hover{border-color:var(--accent)}

/* ── boş hat kartı ── */
.pv-empty{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:16px;pointer-events:none}
.pv-empty[hidden]{display:none}
.pv-empty>div{pointer-events:auto;max-width:460px;background:var(--sheet);border:1px solid var(--rule);border-left:3px solid var(--accent);
  padding:18px 20px 16px;box-shadow:0 8px 24px rgba(22,24,27,.10)}
.pv-empty h3{margin:8px 0;font:600 21px/1.2 var(--ui)}
.pv-empty p{margin:0;color:var(--ink-2);line-height:1.5}
.pv-empty .pv-actions{padding:14px 0 0}

/* ── denetçi ── */
.pvsim-side{position:relative;z-index:2;width:320px;flex:none;display:flex;flex-direction:column;background:var(--sheet);border-left:1px solid var(--rule)}
.pv-side-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.pv-sheet-handle{display:none}
.pv-sec{padding:14px 16px;border-bottom:1px solid var(--rule-2)}
.pv-sec h3{margin:0 0 10px}
.pv-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:3px 0}
.pv-row span{color:var(--ink-2)}
.pv-row b{font:500 13px var(--mono);font-variant-numeric:tabular-nums;text-align:right}
.pv-row b small{font:400 11px var(--ui);color:var(--ink-3)}
.pv-row b .ui{font:600 13px var(--ui)}
.pv-meter{height:4px;background:var(--rule-2);margin:3px 0 7px}
.pv-meter i{display:block;height:100%;background:var(--ink)}
.pv-head{display:flex;gap:12px;align-items:flex-start;padding:16px 16px 12px}
.pv-tag{font:500 12px/1 var(--mono);color:#fff;background:var(--tone,var(--ink));padding:6px 7px;border-radius:2px;white-space:nowrap}
.pv-title{font:600 19px/1.15 var(--ui);min-width:0;overflow-wrap:anywhere}
.pv-title small{display:block;font:500 12.5px var(--ui);color:var(--ink-3);margin-top:3px}
.pv-state{display:flex;align-items:center;gap:8px;padding:0 16px 12px}
.pv-state .cap{color:var(--ink)}
.pv-flag{margin-left:auto;font:600 10px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--accent);
  border:1px solid var(--accent);padding:2px 5px;border-radius:2px;white-space:nowrap}
.pv-flag.ref{color:var(--ink);border-color:var(--ink)}
td .pv-flag{margin-left:6px}
.pv-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid var(--rule)}
.pv-tabs.pv-wrap{flex-wrap:wrap}
.pv-tabs.pv-wrap button{padding:9px 6px}
.pv-tabs button{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:9px 8px;font-weight:600;color:var(--ink-3);cursor:pointer}
.pv-tabs button:hover{color:var(--ink)}
.pv-tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--accent)}
.pv-field{display:grid;grid-template-columns:1fr 132px;align-items:center;gap:4px 10px;padding:4px 0}
.pv-field>span:first-child{color:var(--ink-2)}
.pv-field small{grid-column:1/-1;color:var(--ink-3);font-size:12px;margin-top:-2px}
.pv-in{display:flex;align-items:center;border:1px solid var(--rule);background:#fff;border-radius:2px;height:30px}
.pv-in:focus-within{border-color:var(--ink)}
.pv-in input,.pv-in select{flex:1;min-width:0;border:0;background:none;height:100%;padding:0 8px;font:500 13px var(--mono);color:var(--ink);outline:none}
.pv-in input[type="text"],.pv-in select{font-family:var(--ui);font-weight:500}
.pv-in em{font:400 11px var(--ui);font-style:normal;color:var(--ink-3);padding-right:8px;white-space:nowrap}
.pv-check{display:flex;align-items:center;gap:8px;padding:6px 0;color:var(--ink-2)}
.pv-check input{accent-color:var(--ink);width:16px;height:16px}
.pv-subhead{margin:12px 0 6px}
.pv-hint{margin:6px 0 0;color:var(--ink-3);font-size:12.5px;line-height:1.45}
.pv-muted{color:var(--ink-3);margin:4px 0}
.pv-grid{width:100%;border-collapse:collapse;margin-top:4px}
.pv-grid th{font:600 10px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:left;padding:0 4px 5px 0}
.pv-grid td{padding:2px 4px 2px 0}
.pv-grid input,.pv-grid select{width:100%;height:28px;border:1px solid var(--rule);background:#fff;padding:0 6px;font:500 12.5px var(--mono);border-radius:2px;min-width:0}
.pv-grid input[type="text"],.pv-grid select{font-family:var(--ui)}
.pv-grid input[type="color"]{width:30px;padding:2px}
.pv-grid td:first-child{display:flex;align-items:center;gap:6px}
.pv-grid .pv-num{font:500 12px var(--mono);text-align:right}
.pv-x{width:26px;height:26px;display:grid;place-items:center;background:none;border:0;color:var(--ink-3);cursor:pointer;border-radius:2px}
.pv-x:hover{background:var(--paper);color:var(--stop)}
.pv-x svg{width:14px;height:14px}
.pv-add{display:inline-flex;align-items:center;gap:4px;margin-top:8px;background:none;border:1px dashed var(--ink-3);
  padding:5px 10px;font-weight:600;font-size:13px;cursor:pointer;border-radius:2px}
.pv-add:hover{border-style:solid;border-color:var(--ink)}
.pv-add svg{width:14px;height:14px}
.pv-actions{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px}
.pv-actions .pv-add{margin-top:0}
.pv-st-actions{gap:6px;padding:0 16px 12px}
.pv-st-actions .pv-tbtn[aria-label]{width:34px;padding:0;justify-content:center}
.pv-dist,.pv-stack{display:flex;height:8px;margin:2px 0 12px;background:var(--rule-2);gap:2px}
.pv-stack{gap:2px;background:none}
.pv-dist i,.pv-stack i{display:block;height:100%;min-width:2px}
.pv-legend{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;font-size:12.5px;color:var(--ink-2)}
.pv-legend.inline{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:10px}
.pv-legend div{display:flex;align-items:center;gap:8px}
.pv-legend b{margin-left:auto;font:500 12.5px var(--mono);color:var(--ink)}
.pv-legend .belt{width:18px;height:6px;flex:none;border:1px solid rgba(22,24,27,.2)}
.pv-legend .line{width:16px;height:2px;flex:none}
.pv-lam{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule)}
.pv-lam>div{padding:8px 7px 9px;border-right:1px solid var(--rule)}
.pv-lam>div:last-child{border-right:0}
.pv-lam>div.on{background:var(--accent-wash)}
.pv-lam .cap{font-size:9.5px}
.pv-lam b{display:block;font:500 15px/1 var(--mono);margin:7px 0 4px}
.pv-lam small{display:block;font:400 11px var(--mono);color:var(--ink-3);margin-bottom:6px}
.pv-lam .pv-meter{margin:0}
.pv-lam .on .pv-meter i{background:var(--accent)}
.pv-oee{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
.pv-oee b{display:block;font:500 17px/1 var(--mono);margin:6px 0 2px}
.pv-bins{width:100%;border-collapse:collapse;font-size:12.5px}
.pv-bins th{font:600 10px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:right;padding:0 0 6px}
.pv-bins td{padding:5px 0;text-align:right;font:500 12px var(--mono);border-top:1px solid var(--rule-2)}
.pv-bins th:first-child,.pv-bins td:first-child{text-align:left;font-family:var(--ui);font-weight:500}
.pvsim .sw{display:inline-block;width:9px;height:9px;margin-right:7px;vertical-align:-1px;flex:none}
.pv-bins .fill{display:block;height:3px;background:var(--rule-2);margin-top:4px}
.pv-bins .fill i{display:block;height:100%}

/* ── rapor ── */
.pv-report{position:absolute;inset:0;z-index:10;background:var(--paper);overflow:auto}
.pv-report[hidden]{display:none}
.pv-rep-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 28px 12px}
.pv-rep-head h2{margin:0;font:600 24px/1.1 var(--ui)}
.pv-rep-head small{color:var(--ink-3)}
.pv-rep-actions{display:flex;gap:8px;align-items:center}
.pv-report .pv-tabs{padding:0 20px;background:var(--paper)}
.pv-rep-body{padding:8px 12px 40px;max-width:1180px}
.pv-rep-body .pv-sec{border-bottom:0;background:var(--sheet);border:1px solid var(--rule-2);margin:12px 16px}
.pv-hero{margin:16px 16px 4px}
.pv-hero span{color:var(--ink-2);font-weight:500}
.pv-hero b{display:block;font:600 56px/1.05 var(--ui);letter-spacing:-.01em}
.pv-hero small{color:var(--ink-3);font-size:13px}
.pv-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:12px 16px}
.pv-tile{background:var(--sheet);border:1px solid var(--rule-2);padding:12px 14px}
.pv-tile span{color:var(--ink-2);font-weight:500;font-size:13px}
.pv-tile b{display:block;font:600 24px/1.2 var(--ui);margin-top:4px}
.pv-tile small{color:var(--ink-3);font-size:12px}
.pv-controls{display:flex;flex-wrap:wrap;gap:6px 24px;margin:12px 16px}
.pv-controls .pv-field{grid-template-columns:auto 220px}
.pv-scroll{overflow-x:auto}
.pv-table{width:100%;border-collapse:collapse;font-size:13px}
.pv-table th{font:600 10px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:right;padding:4px 8px 8px;white-space:nowrap;border-bottom:1px solid var(--rule)}
.pv-table td{padding:6px 8px;text-align:right;font:500 12.5px var(--mono);border-bottom:1px solid var(--rule-2);white-space:nowrap}
.pv-table th:nth-child(-n+2),.pv-table td:nth-child(-n+2){text-align:left}
.pv-table td:first-child,.pv-table td:nth-child(2){font-family:var(--ui);font-weight:500}
.pv-table td.mono{font-family:var(--mono);font-weight:500}
.pv-table tr.bn td{background:#fdf2ec}
.pv-table tr.ref td{background:#eef2f7}
.pv-table td.pv-barcell{width:220px;min-width:160px}
.pv-table .pv-stack{margin:0}
.pv-hbar{height:8px;background:var(--rule-2)}
.pv-hbar i{display:block;height:100%}
.pv-chart{display:block;max-width:100%;overflow:visible}
.pv-chart text{font:500 11px var(--mono);fill:#868b92}
.pv-chart text.v{fill:var(--ink);font-weight:500}
.pv-tip{position:absolute;z-index:20;pointer-events:none;background:var(--sheet);border:1px solid var(--rule);
  box-shadow:0 6px 18px rgba(22,24,27,.14);padding:7px 10px;font-size:12.5px;min-width:120px}
.pv-tip[hidden]{display:none}
.pv-tip .h{color:var(--ink-3);font-size:11.5px;margin-bottom:3px}
.pv-tip div{display:flex;align-items:center;gap:6px;white-space:nowrap}
.pv-tip i{display:inline-block;width:12px;height:2px}
.pv-tip b{font:500 13px var(--mono)}

/* ── yeni hat sihirbazı ── */
.pv-wiz{position:absolute;inset:0;z-index:11;display:flex;flex-direction:column;background:var(--paper)}
.pv-wiz[hidden]{display:none}
.pv-wiz>.pv-rep-head{flex:none}
.pv-wiz-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 12px 24px}
.pv-wiz-body>*{max-width:1080px}
.pv-wiz-body .pv-sec{background:var(--sheet);border:1px solid var(--rule-2);margin:12px 16px}
.pv-wiz-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px 28px}
.pv-wiz-grid .pv-field{grid-template-columns:1fr 150px}
.pv-wiz-acts{padding:10px 0 0}
.pv-wiz-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 18px;margin:12px 16px;padding:14px 16px;background:var(--ink);color:#fff}
.pv-wiz-sum .cap{color:#b9bdc3}
.pv-wiz-sum b{display:block;margin-top:6px;font:600 22px/1.2 var(--ui);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-wiz-sum b small{font-size:12px;font-weight:500;color:#b9bdc3}
.pv-wiz-sum b.bad{color:#ff9b8f}
.pv-wiz-sum p{grid-column:1/-1;margin:0;font-size:13px;color:#d6d9dd}
.pv-wiz-head,.pv-wiz-row{display:grid;grid-template-columns:minmax(0,1.6fr) 112px 112px 136px minmax(130px,1fr);gap:8px 12px;align-items:center}
.pv-wiz-head{padding:0 0 6px;border-bottom:1px solid var(--rule);font:600 10px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.pv-wiz-row{padding:7px 0;border-bottom:1px solid var(--rule-2)}
.pv-wiz-row:last-child{border-bottom:0}
.pv-wiz-row.off .pv-wiz-c,.pv-wiz-row.off .pv-wiz-load{opacity:.3;pointer-events:none}
.pv-wiz-row.off .pv-wiz-name b{color:var(--ink-3)}
.pv-wiz-name{display:flex;align-items:center;gap:9px;min-width:0;cursor:pointer}
.pv-wiz-name input{flex:none;width:16px;height:16px;accent-color:var(--ink)}
.pv-wiz-name .pv-tag{min-width:38px;padding:4px 5px;font-size:10.5px;text-align:center}
.pv-wiz-name b{font-weight:600}
.pv-wiz-name small{display:block;color:var(--ink-3);font-size:11.5px}
.pv-wiz-c .pv-in{height:30px}
.pv-wiz-c .pv-check{padding:0;font-size:12.5px}
.pv-wiz-c .pv-muted{margin:0}
.pv-wiz-load{display:grid;grid-template-columns:minmax(40px,1fr) auto 40px;align-items:center;gap:8px}
.pv-wiz-load .pv-hbar{height:6px}
.pv-wiz-load .pv-hbar i{background:var(--ink-2)}
.pv-wiz-load .pv-hbar.bn i{background:var(--accent)}
.pv-wiz-load .pv-hbar.over i{background:var(--stop)}
.pv-wiz-load b{font:500 13px var(--mono);white-space:nowrap}
.pv-wiz-load b small{font:400 10.5px var(--ui);color:var(--ink-3)}
.pv-wiz-load>small{font:500 11.5px var(--mono);color:var(--ink-3);text-align:right}
.pv-wiz-quality .pv-hint{margin:0 0 10px}
.pv-wiz-qhead,.pv-wiz-q{display:grid;grid-template-columns:minmax(0,1.5fr) 120px 120px 150px minmax(200px,1.2fr);gap:8px 12px;align-items:center}
.pv-wiz-qhead{padding:0 0 6px;border-bottom:1px solid var(--rule);font:600 10px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.pv-wiz-q{padding:7px 0;border-bottom:1px solid var(--rule-2)}
.pv-wiz-q.off{opacity:.35;pointer-events:none}
.pv-wiz-q select{flex:1;min-width:0;border:0;background:none;height:100%;padding:0 8px;font:500 13px var(--ui);color:var(--ink);outline:none}
.pv-wiz-q>*,.pv-wiz-rw>*{min-width:0}
.pv-wiz-rw{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.pv-wiz-rw.off{opacity:.35;pointer-events:none}
.pv-wiz-rw .pv-in{height:30px}
.pv-wiz-qres{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 18px;margin-top:12px;padding:12px 14px;background:var(--paper);border-left:3px solid var(--accent)}
.pv-wiz-qres>.cap{grid-column:1/-1}
.pv-wiz-qres span{display:block;color:var(--ink-2);font-size:12.5px}
.pv-wiz-qres b{font:600 18px/1.3 var(--ui)}
.pv-wiz-qres b small{font-size:11.5px;font-weight:500;color:var(--ink-3)}
.pv-wiz-qres .bad b{color:var(--stop)}
.pv-wiz-foot{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 28px;background:var(--sheet);border-top:1px solid var(--rule)}
.pv-wiz-sp{flex:1}

/* ── hat dengesi ── */
.pv-bal{display:flex;flex-direction:column;gap:1px;margin:2px -6px 10px}
.pv-bal-row{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(64px,1fr) 56px;align-items:center;gap:10px;padding:5px 6px;
  background:none;border:0;border-radius:2px;text-align:left;cursor:pointer}
.pv-bal-row:hover{background:var(--paper)}
.pv-bal-name{display:flex;align-items:center;gap:7px;min-width:0;font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-bal-name .pv-tag{flex:none;padding:3px 4px;font-size:9.5px}
.pv-bal-name small{font-weight:400;color:var(--ink-3)}
.pv-bal-bar{position:relative;height:8px;background:var(--rule-2)}
.pv-bal-bar i{display:block;height:100%;background:var(--ink-2)}
.pv-bal-row.bn .pv-bal-bar i{background:var(--accent)}
.pv-bal-row.over .pv-bal-bar i{background:var(--stop)}
.pv-bal-bar em{position:absolute;top:-4px;bottom:-4px;width:0;border-left:2px dashed var(--ink)}
.pv-bal-row b{font:500 12.5px var(--mono);text-align:right;white-space:nowrap}
.pv-bal-row b small{font:400 10.5px var(--ui);color:var(--ink-3)}
.pvsim .pv-bal-legend .pv-bal-takt{width:0;height:12px;border-left:2px dashed var(--ink);background:none}

/* ── kayıtlı hatlar ── */
.pv-lines{width:min(560px,100%)}
.pv-lines-save{display:flex;gap:8px;padding:0 14px 12px;border-bottom:1px solid var(--rule-2)}
.pv-lines-save .pv-in{flex:1;height:34px}
.pv-lines-list{flex:1;min-height:80px;overflow:auto;padding:4px 14px}
.pv-lines-row{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--rule-2)}
.pv-lines-row:last-child{border-bottom:0}
.pv-lines-row>div{flex:1;min-width:0}
.pv-lines-row b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-lines-row small{color:var(--ink-3)}

/* ── pencere ve bildirim ── */
.pv-dialog{position:absolute;inset:0;z-index:40;background:rgba(22,24,27,.35);display:grid;place-items:center;padding:16px}
.pv-dialog-box{width:min(720px,100%);max-height:80%;display:flex;flex-direction:column;background:var(--sheet);border:1px solid var(--rule);box-shadow:0 12px 32px rgba(22,24,27,.2)}
.pv-dialog-head,.pv-dialog-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px}
.pv-dialog-foot small{color:var(--ink-3)}
.pv-dialog textarea{flex:1;min-height:240px;margin:0 14px;border:1px solid var(--rule);background:#fff;padding:10px;font:400 12px/1.45 var(--mono);color:var(--ink);resize:none}
.pv-file{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none}
.pv-dialog-foot{flex-wrap:wrap}
.pv-dialog-foot>span{display:flex;gap:8px;flex:none;margin-left:auto}
.pv-toast{position:absolute;z-index:45;left:50%;bottom:18px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:9px 14px;border-radius:2px;font-weight:500;box-shadow:0 6px 18px rgba(22,24,27,.2)}
.pv-toast.pv-err{background:var(--stop)}
.pv-toast[hidden]{display:none}

/* ── 3D etiketleri ── */
.pvsim-lbl{transform:translateY(-50%);background:#fff;border:1px solid rgba(22,24,27,.16);border-radius:2px;padding:4px 7px 5px;
  box-shadow:0 1px 3px rgba(22,24,27,.14);font:500 11.5px/1.25 var(--ui);color:var(--ink);white-space:nowrap}
.pvsim-lbl .h{display:flex;align-items:center;gap:6px}
.pvsim-lbl .pvl-tag{font:500 10px/1 var(--mono);color:var(--ink-3)}
.pvsim-lbl .nm{font-weight:600}
.pvsim-lbl .d{display:flex;flex-wrap:wrap;gap:1px 10px;max-width:176px;margin-top:3px;color:var(--ink-3);font-size:10.5px}
.pvsim-lbl .d em{font-style:normal}
.pvsim-lbl .d b{font:500 10.5px var(--mono);color:var(--ink);margin-left:3px}
.pvsim-lbl.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}

@media (max-width:1280px){.pv-ro.bn{display:none}}
@media (max-width:1100px){.pv-ro:nth-child(5){display:none}}
/* ── dar / kısa ekran (telefon, tablet): tek satır araç şeridi, alttan açılan denetçi ── */
@media (max-width:900px),(max-height:520px){
  .pvsim-bar{min-height:0;flex-wrap:wrap;z-index:7}
  .pv-transport{gap:6px;padding:6px 8px;border-right:0}
  .pv-play{width:38px;height:38px}
  .pv-ibtn{width:36px;height:36px}
  .pv-speed{margin-left:0}
  .pv-speed .cap{display:none}
  .pv-speed button{width:28px;height:34px}
  .pv-speed output{min-width:44px;font-size:14px}
  .pv-tools{gap:6px;padding:6px 8px;margin-left:auto;border-left:0}
  .pv-tools .pv-tbtn{width:36px;height:36px;padding:0;justify-content:center;gap:0;font-size:0}
  .pv-tools .pv-tbtn svg{width:18px;height:18px}
  .pv-readouts{overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}
  .pv-readouts::-webkit-scrollbar{display:none}
  .pv-ro{gap:4px;padding:0 12px}
  .pv-ro b{font-size:14px}
  .pv-ro .cap{font-size:9.5px}
  .pv-ro.bn,.pv-ro:nth-child(5){display:flex}
  .pv-ro.bn b{font-size:13.5px}
  .pvsim-viewport{margin-bottom:48px}
  .pv-rail{left:8px;top:8px;gap:4px;padding:4px}
  .pv-rail .pv-ibtn{width:38px;height:38px}
  .pv-viewctl{right:8px;top:8px;gap:4px}
  .pv-seg button{height:36px;padding:0 12px}
  .pv-seg button svg{display:none}
  .pv-viewctl .pv-ibtn{width:38px;height:38px}
  .pv-palette{left:8px;right:8px;top:8px;bottom:8px;width:auto;z-index:5}
  .pv-modehint{top:auto;bottom:8px;left:8px;right:8px;transform:none;max-width:none;display:flex;align-items:center;gap:10px;font-size:12.5px;text-align:left}
  .pv-modehint button{margin-left:auto;flex:none;padding:6px 12px}
  .pv-modehint[hidden]{display:none}
  .pv-side-body>.pv-head{display:none}
  .pv-side-body>.pv-state{padding-top:12px}
  .pvsim-hint{left:8px;right:8px;bottom:8px;gap:4px 10px;font-size:11.5px}
  .pvsim.hint-seen .pvsim-hint{display:none}
  .pv-toast{bottom:60px;max-width:calc(100% - 24px)}
  .pvsim-side{position:absolute;left:0;right:0;bottom:0;width:auto;height:min(64%,600px);z-index:6;border-left:0;border-top:1px solid var(--rule);
    box-shadow:0 -10px 28px rgba(22,24,27,.12);transform:translateY(calc(100% - 48px));transition:transform .24s cubic-bezier(.2,.8,.2,1)}
  .pvsim.sheet-open .pvsim-side{transform:none}
  .pv-sheet-handle{display:flex;align-items:center;gap:10px;flex:none;position:relative;width:100%;height:48px;padding:4px 14px 0;
    background:var(--sheet);border:0;border-bottom:1px solid var(--rule-2);cursor:pointer;text-align:left}
  .pv-sheet-handle .grip{position:absolute;left:50%;top:5px;width:36px;height:4px;border-radius:2px;background:var(--rule);transform:translateX(-50%)}
  .pv-sheet-handle .pv-tag{padding:5px 6px;font-size:11px}
  .pv-sheet-handle .t{min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pv-sheet-handle .s{display:flex;align-items:center;gap:6px;margin-left:auto;color:var(--ink-3);font-size:12.5px;white-space:nowrap}
  .pv-sheet-handle svg{width:18px;height:18px;color:var(--ink-2);transition:transform .2s}
  .pvsim.sheet-open .pv-sheet-handle svg{transform:rotate(180deg)}
  .pv-rep-head{flex-wrap:wrap;padding:14px 14px 8px}
  .pv-rep-head h2{font-size:20px}
  .pv-report .pv-tabs{padding:0 8px;overflow-x:auto;scrollbar-width:none}
  .pv-report .pv-tabs::-webkit-scrollbar{display:none}
  .pv-report .pv-tabs button{white-space:nowrap}
  .pv-rep-body{padding:4px 0 32px}
  .pv-rep-body .pv-sec{margin:8px}
  .pv-hero{margin:12px 12px 4px}
  .pv-hero b{font-size:40px}
  .pv-tiles{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:8px}
  .pv-controls{margin:8px 12px}
  .pv-controls .pv-field{grid-template-columns:1fr minmax(0,190px)}
  .pv-dialog-box{max-height:92%}
  .pv-wiz-body{padding:0 0 16px}
  .pv-wiz-body .pv-sec{margin:8px}
  .pv-wiz-sum{grid-template-columns:1fr 1fr;margin:8px}
  .pv-wiz-foot{padding:8px 12px}
  .pv-empty{padding:12px 12px 12px 62px}
}
@media (max-width:760px){
  .pv-wiz-head,.pv-wiz-qhead{display:none}
  .pv-wiz-q{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 8px;padding:10px 0}
  .pv-wiz-q>.pv-wiz-name,.pv-wiz-q>.pv-wiz-c:last-child{grid-column:1/-1}
  .pv-wiz-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 8px;padding:10px 0}
  .pv-wiz-name,.pv-wiz-load{grid-column:1/-1}
  .pv-wiz-c::before{content:attr(data-l);display:block;margin-bottom:3px;font:600 9.5px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
  .pv-wiz-grid .pv-field{grid-template-columns:1fr 140px}
  .pv-wiz-foot .pv-check{flex-basis:100%}
}
/* telefon dikey: göstergeler ikinci satırda, yatay kaydırılır */
@media (max-width:640px){
  .pv-readouts{order:3;flex-basis:100%;min-height:44px;border-top:1px solid var(--rule-2)}
}
/* telefon yatay: araç rayı yatay, panel daha yüksek açılır */
@media (max-height:520px){
  .pv-empty{padding:56px 12px 12px}
  .pv-rail{flex-direction:row}
  .pv-rail-sep{width:1px;height:auto;margin:2px 0}
  .pv-palette{top:56px}
}
@media (max-height:520px) and (min-width:641px){
  .pvsim-side{height:80%}
}
/* dokunmatik: odaklanınca iOS'un sayfayı büyütmemesi için 16 px giriş metni, daha büyük hedefler */
@media (pointer:coarse){
  .pvsim input,.pvsim select,.pvsim textarea{font-size:16px!important}
  .pv-in{height:38px}
  .pv-grid input,.pv-grid select{height:36px}
  .pv-tabs button{padding:11px 8px}
  .pv-menu button{padding:11px 12px}
  .pv-x{width:34px;height:34px}
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById('pvsim-styles')) return;
  const el = doc.createElement('style');
  el.id = 'pvsim-styles';
  el.textContent = CSS;
  doc.head.appendChild(el);
}
