// ─────────────────────────────────────────
//  SİTEYE MONTAJ: "Hat Simülasyonu" sekmesi
// ─────────────────────────────────────────
//   const sim = mountLineSimulator(document.querySelector('#hat-simulasyonu'));
//   sim.load(simjson); sim.session.play(); … sim.destroy();
import { createDefaultLayout, catalogOf, categoryOf, stationTag, STATUS_LABELS } from '../core/index.js';
import { LineView3D } from '../view3d/view.js';
import { kindTone } from '../view3d/materials.js';
import { SimSession } from './session.js';
import { LineEditor } from './editor.js';
import { Inspector } from './inspector.js';
import { Palette } from './palette.js';
import { ReportPanel } from './report.js';
import { injectStyles } from './styles.js';
import { ICON, clock, num } from './ui.js';

const SPEEDS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const SAMPLES = {
  sample: new URL('../../samples/ornek_hat.simjson', import.meta.url),
  full: new URL('../../samples/tam_hat.simjson', import.meta.url),
};
const FAST = [[3600, '+1 saat'], [8 * 3600, '+8 saat (vardiya)'], [24 * 3600, '+24 saat'], [7 * 86400, '+1 hafta']];
const HINT = {
  '3d': '<span><kbd>Sol</kbd>döndür</span><span><kbd>Sağ</kbd>kaydır</span><span><kbd>Tekerlek</kbd>yakınlaştır</span><span><kbd>Çift tık</kbd>odaklan</span>',
  top: '<span><kbd>Sürükle</kbd>kaydır</span><span><kbd>Tekerlek</kbd>yakınlaştır</span><span><kbd>Çift tık</kbd>odaklan</span>',
};
const TOUCH_HINT = {
  '3d': '<span><kbd>1 parmak</kbd>döndür</span><span><kbd>2 parmak</kbd>kaydır · yakınlaştır</span><span><kbd>Basılı tut</kbd>istasyonu taşı</span>',
  top: '<span><kbd>1 parmak</kbd>kaydır</span><span><kbd>2 parmak</kbd>yakınlaştır</span><span><kbd>Basılı tut</kbd>istasyonu taşı</span>',
};
// Dar ekran (telefon dikey) veya kısa ekran (telefon yatay): denetçi alttan açılan panel olur
const COMPACT = '(max-width: 900px), (max-height: 520px)';

const TEMPLATE = `
<div class="pvsim-bar">
  <div class="pv-transport">
    <button class="pv-play" data-act="play" aria-label="Başlat" title="Başlat (Boşluk)">${ICON.play}</button>
    <button class="pv-ibtn" data-act="reset" aria-label="Sıfırla" title="Simülasyonu sıfırla">${ICON.reset}</button>
    <div class="pv-speed">
      <span class="cap">Hız</span>
      <button data-act="slower" aria-label="Yavaşlat">${ICON.minus}</button>
      <output data-k="speed">10×</output>
      <button data-act="faster" aria-label="Hızlandır">${ICON.plus}</button>
    </div>
    <div class="pv-menuwrap">
      <button class="pv-ibtn" data-menu="fast" aria-label="Hızlı koşu" title="Hızlı koşu: simülasyonu anında ilerlet">${ICON.fast}</button>
      <div class="pv-menu" data-for="fast" hidden>${FAST.map(([s, t]) => `<button data-fast="${s}">${t}</button>`).join('')}</div>
    </div>
  </div>
  <div class="pv-readouts">
    <div class="pv-ro"><span class="cap">Sim. saati</span><b data-k="time">00:00:00</b></div>
    <div class="pv-ro"><span class="cap">Tamamlanan</span><b data-k="done">0</b></div>
    <div class="pv-ro"><span class="cap">Saatlik</span><b data-k="rate">—</b></div>
    <div class="pv-ro"><span class="cap">Hat verimi</span><b data-k="eff">—</b></div>
    <div class="pv-ro"><span class="cap">Verim</span><b data-k="yield">—</b></div>
    <div class="pv-ro bn"><span class="cap">Darboğaz</span><b data-k="bn">—</b></div>
  </div>
  <div class="pv-tools">
    <button class="pv-tbtn" data-act="report" aria-label="Rapor">${ICON.report}Rapor</button>
    <div class="pv-menuwrap">
      <button class="pv-tbtn" data-menu="file" aria-label="Dosya">${ICON.file}Dosya</button>
      <div class="pv-menu right" data-for="file" hidden>
        <button data-act="new">Boş hat</button>
        <button data-act="sample">Örnek hat (20 istasyon)</button>
        <button data-act="full">Tam PV modül hattı (tüm süreçler)</button>
        <hr>
        <button data-act="open">Aç… (.simjson)</button>
        <button data-act="save">Kaydet (.simjson)</button>
      </div>
    </div>
    <button class="pv-ibtn" data-act="fullscreen" aria-pressed="false" aria-label="Tam ekran" title="Tam ekran">${ICON.expand}</button>
  </div>
</div>
<div class="pvsim-main">
  <div class="pvsim-viewport">
    <div class="pv-rail" role="toolbar" aria-label="Düzenleme araçları">
      <button class="pv-ibtn" data-act="library" aria-pressed="false" title="Süreç kütüphanesi">${ICON.library}</button>
      <span class="pv-rail-sep"></span>
      <button class="pv-ibtn" data-tool="select" aria-pressed="true" title="Seç / taşı (V)">${ICON.cursor}</button>
      <button class="pv-ibtn" data-tool="connect" aria-pressed="false" title="Konveyör bağla (C)">${ICON.link}</button>
      <span class="pv-rail-sep"></span>
      <button class="pv-ibtn" data-act="undo" title="Geri al (Ctrl+Z)">${ICON.undo}</button>
      <button class="pv-ibtn" data-act="redo" title="Yinele (Ctrl+Y)">${ICON.redo}</button>
    </div>
    <aside class="pv-palette" hidden></aside>
    <div class="pv-viewctl">
      <div class="pv-seg" role="group" aria-label="Görünüm">
        <button data-view="3d" class="on">${ICON.cube}3D</button><button data-view="top">${ICON.plan}Plan</button>
      </div>
      <button class="pv-ibtn solid" data-act="labels" aria-pressed="true" title="Etiketler">${ICON.label}</button>
      <button class="pv-ibtn solid" data-act="home" aria-label="Hattın tamamını göster" title="Hattın tamamını göster">${ICON.home}</button>
    </div>
    <div class="pv-modehint" hidden></div>
    <div class="pvsim-hint"></div>
  </div>
  <aside class="pvsim-side" aria-label="Denetçi">
    <button class="pv-sheet-handle" aria-expanded="false"><span class="grip"></span><span class="pv-tag">HAT</span><span class="t"></span><span class="s"></span>${ICON.chevron}</button>
    <div class="pv-side-body"></div>
  </aside>
</div>
<input type="file" accept=".simjson,.json" hidden>`;

// exportMode: 'download' (dosya indirir) | 'dialog' (metni kopyalanabilir pencerede gösterir — indirmenin
// engellendiği gömülü önizlemeler için)
export function mountLineSimulator(container, { layout = null, sample = !layout, speed = 10, autoplay = false,
                                                 exportMode = 'download' } = {}) {
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  injectStyles(doc);
  const compact = win.matchMedia(COMPACT);
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  const hints = coarse ? TOUCH_HINT : HINT;
  const root = doc.createElement('div');
  root.className = 'pvsim';
  root.tabIndex = 0;
  root.innerHTML = TEMPLATE;
  container.appendChild(root);
  const $ = sel => root.querySelector(sel);
  const out = k => root.querySelector(`[data-k="${k}"]`);

  const session = new SimSession({ speed });
  if (layout) session.load(layout);
  const view = new LineView3D($('.pvsim-viewport'), session);
  const editor = new LineEditor(root, view, session);
  const inspector = new Inspector($('.pv-side-body'), session, editor);
  const palette = new Palette($('.pv-palette'), editor);
  const report = new ReportPanel($('.pvsim-main'), session);
  report.exporter = (name, text, mime) => exportFile(name, text, mime);
  const fileInput = $('input[type=file]');
  $('.pvsim-hint').innerHTML = hints['3d'];
  if (coarse) $('.pv-palette .pv-hint').textContent = 'Bir süreç seçin, sonra zemine dokunun.';
  $('.pvsim-viewport').addEventListener('pointerdown', () => root.classList.add('hint-seen'), { once: true });

  const setSpeed = x => {
    session.setSpeed(x);
    out('speed').textContent = `${x}×`;
  };
  const stepSpeed = dir => {
    const i = SPEEDS.findIndex(v => v >= session.speed);
    setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? SPEEDS.length - 1 : i) + dir))]);
  };
  setSpeed(speed);

  // keepPlacing: dar ekranda tip seçilince çekmece kapanır, yerleştirme sürer
  const setPalette = (open, keepPlacing = false) => {
    $('.pv-palette').hidden = !open;
    $('[data-act=library]').setAttribute('aria-pressed', String(open));
    if (open && compact.matches) setSheet(false);
    if (!open && !keepPlacing) editor.cancel();
  };
  palette.onClose = () => setPalette(false);
  palette.onPick = () => { if (compact.matches) setPalette(false, true); };

  // ── Alttan açılan denetçi paneli (dar ekran) ──
  const handle = $('.pv-sheet-handle');
  const setSheet = open => {
    root.classList.toggle('sheet-open', open);
    handle.setAttribute('aria-expanded', String(open));
  };
  handle.addEventListener('click', () => setSheet(!root.classList.contains('sheet-open')));
  let lastSel = null;
  const onSelect = () => {
    const sel = session.selection;
    const key = sel ? `${sel.type}:${sel.id}` : null;
    // seçim değişince aç / kapat; taşıma sırasında açılmaz (görünümü örtmesin)
    if (compact.matches && key !== lastSel && !editor.dragging) setSheet(key != null);
    lastSel = key;
    syncHandle();
  };
  function syncHandle() {
    const sel = session.selection, L = session.layout;
    const s = sel?.type === 'station' ? L.stations.get(sel.id) : null;
    const c = sel?.type === 'conveyor' ? L.conveyors.get(sel.id) : null;
    const status = s ? session.engine.stationStatus(s.id) : null;
    const tag = handle.querySelector('.pv-tag');
    tag.textContent = s ? stationTag(s) : c ? `KNV-${String(c.id).padStart(2, '0')}` : 'HAT';
    tag.style.setProperty('--tone', s ? kindTone(s.kind, categoryOf(s)) : c?.type === 'defect' ? '#d23b2f' : c ? '#5c6168' : '');
    handle.querySelector('.t').textContent = s ? s.name
      : c ? `${L.stations.get(c.from_id)?.name ?? '?'} → ${L.stations.get(c.to_id)?.name ?? '?'}` : 'Hat ayarları';
    handle.querySelector('.s').innerHTML = s
      ? `<i class="sq st-${status}"></i>${STATUS_LABELS[status] ?? ''}`
      : c ? '' : `${L.stations.size} istasyon`;
  }

  // ── Tam ekran: tarayıcı izin veriyorsa gerçek tam ekran, vermiyorsa (iPhone, gömülü
  //    çerçeve) simülatör sayfanın tamamını kaplar ──
  const fsElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  const setMax = on => {
    root.classList.toggle('pv-max', on);
    doc.documentElement.classList.toggle('pvsim-lock', on);
    syncFullscreen();
  };
  function syncFullscreen() {
    const on = fsElement() === root || root.classList.contains('pv-max');
    const b = $('[data-act=fullscreen]');
    b.innerHTML = on ? ICON.shrink : ICON.expand;
    b.title = on ? 'Tam ekrandan çık' : 'Tam ekran';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(on));
  }
  async function toggleFullscreen() {
    if (root.classList.contains('pv-max')) { setMax(false); return; }
    if (fsElement()) { (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc); return; }
    const req = root.requestFullscreen ?? root.webkitRequestFullscreen;
    if (req && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) {
      try { await req.call(root); return; } catch { /* izin verilmedi: sayfayı kapla */ }
    }
    setMax(true);
  }
  doc.addEventListener('fullscreenchange', syncFullscreen);
  doc.addEventListener('webkitfullscreenchange', syncFullscreen);
  // Esc: önce yerleştirme / seçim iptal olur, yapacak bir şey kalmayınca tam ekrandan çıkılır
  const onEsc = e => {
    if (e.key === 'Escape' && root.classList.contains('pv-max') && !editor.placing && editor.linkFrom == null
        && !session.selection && !e.target.closest('input, select, textarea')) setMax(false);
  };
  root.addEventListener('keydown', onEsc, true);

  // Araç / yerleştirme durumu → ray düğmeleri ve üstteki yönerge
  editor.onState = () => {
    root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === editor.tool)));
    palette.sync();
    const hint = $('.pv-modehint');
    const tap = coarse ? 'dokunun' : 'tıklayın';
    const text = editor.placing
      ? `<b>${catalogOf(editor.placing).name}</b> yerleştiriliyor — zemine ${tap}${coarse ? '' : ' · Shift: art arda'}`
      : editor.tool === 'connect'
        ? (editor.linkFrom != null ? `Hedef istasyona ${tap}` : `Konveyör bağla: kaynak istasyona ${tap}`)
        : '';
    hint.hidden = !text;
    hint.innerHTML = text && `<span>${text}</span><button data-act="cancel">${editor.placing || editor.linkFrom != null ? 'İptal' : 'Bitir'}</button>`;
  };

  const syncHistory = () => {
    $('[data-act=undo]').disabled = !session.canUndo;
    $('[data-act=redo]').disabled = !session.canRedo;
  };

  const closeMenus = () => root.querySelectorAll('.pv-menu').forEach(m => { m.hidden = true; });

  // ── Düğmeler ──
  const onClick = e => {
    const btn = e.target.closest('button');
    if (!btn || !root.contains(btn) || btn.closest('.pvsim-side, .pv-palette, .pv-report')) return;
    if (btn.dataset.menu) {
      const m = root.querySelector(`.pv-menu[data-for="${btn.dataset.menu}"]`);
      const willOpen = m.hidden;
      closeMenus();
      m.hidden = !willOpen;
      return;
    }
    closeMenus();
    if (btn.dataset.view) {
      view.setMode(btn.dataset.view);
      root.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === btn));
      $('.pvsim-hint').innerHTML = hints[btn.dataset.view];
      return;
    }
    if (btn.dataset.tool) { editor.setTool(btn.dataset.tool); return; }
    if (btn.dataset.fast) { fastRun(Number(btn.dataset.fast)); return; }
    switch (btn.dataset.act) {
      case 'play': session.toggle(); break;
      case 'reset': session.reset(); refresh(); break;
      case 'slower': stepSpeed(-1); break;
      case 'faster': stepSpeed(1); break;
      case 'home': view.resetCamera(); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'cancel': editor.placing || editor.linkFrom != null ? editor.cancel() : editor.setTool('select'); break;
      case 'labels': {
        const on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        view.setLabels(on);
        break;
      }
      case 'library': setPalette($('.pv-palette').hidden); break;
      case 'undo': session.undo(); break;
      case 'redo': session.redo(); break;
      case 'report': report.open ? report.hide() : report.show(); break;
      case 'new': {
        const L = createDefaultLayout();
        session.load(L);
        setPalette(true);
        break;
      }
      case 'sample': loadSample('sample'); break;
      case 'full': loadSample('full'); break;
      case 'open': fileInput.click(); break;
      case 'save': exportFile('hat.simjson', JSON.stringify(session.toJSON(), null, 2), 'application/json'); break;
    }
  };
  root.addEventListener('click', onClick);
  const onDocDown = e => { if (!e.target.closest('.pv-menuwrap')) closeMenus(); };
  doc.addEventListener('pointerdown', onDocDown);

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      session.load(JSON.parse(await f.text()));
      toast(`${f.name} açıldı`);
    } catch (err) {
      toast(`Dosya açılamadı: ${err.message}`, true);
    }
  });

  const offs = [
    session.on('state', () => {
      const b = $('[data-act=play]');
      b.classList.toggle('running', session.running);
      b.innerHTML = session.running ? ICON.pause : ICON.play;
      b.title = session.running ? 'Duraklat (Boşluk)' : 'Başlat (Boşluk)';
      b.setAttribute('aria-label', session.running ? 'Duraklat' : 'Başlat');
    }),
    session.on('history', syncHistory),
    session.on('select', onSelect),
    session.on('layout', () => { refresh(); syncHandle(); if (report.open) report.render(); }),
    session.on('reset', () => { refresh(); if (report.open) report.render(); }),
  ];
  syncHistory();

  async function loadSample(which) {
    const res = await fetch(SAMPLES[which]);
    session.load(await res.json());
    if (autoplay) session.play();
  }

  function exportFile(name, text, mime) {
    if (exportMode === 'dialog') { textDialog(name, text); return; }
    const blob = new Blob([text], { type: mime });
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Dışa aktarılan metni kopyalanabilir pencerede göster
  function textDialog(name, text) {
    const d = doc.createElement('div');
    d.className = 'pv-dialog';
    d.innerHTML = `<div class="pv-dialog-box" role="dialog" aria-label="${name}"><div class="pv-dialog-head"><b>${name}</b>`
      + `<button class="pv-ibtn" data-x aria-label="Kapat">${ICON.close}</button></div>`
      + `<textarea readonly spellcheck="false"></textarea><div class="pv-dialog-foot">`
      + `<small>Metni kopyalayıp <b>${name}</b> adıyla kaydedin.</small><button class="pv-tbtn" data-copy>${ICON.copy}Kopyala</button></div></div>`;
    const ta = d.querySelector('textarea');
    ta.value = text;
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-x]')) { d.remove(); return; }
      if (e.target.closest('[data-copy]')) {
        try { await navigator.clipboard.writeText(text); toast('Panoya kopyalandı'); }
        catch { ta.focus(); ta.select(); toast('Metin seçildi; Ctrl+C ile kopyalayın'); }
      }
    });
    root.appendChild(d);
    ta.focus();
    ta.select();
  }

  let toastTimer = 0;
  function toast(msg, error = false) {
    let t = $('.pv-toast');
    if (!t) { t = doc.createElement('div'); t.className = 'pv-toast'; t.setAttribute('role', 'status'); root.appendChild(t); }
    t.textContent = msg;
    t.classList.toggle('pv-err', error);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  // Hızlı koşu: motoru parça parça ilerlet, arayüz donmasın
  let fastBusy = false;
  async function fastRun(seconds) {
    if (fastBusy) return;
    fastBusy = true;
    const wasRunning = session.running;
    session.pause();
    const btn = $('[data-menu=fast]');
    const eng = session.engine;
    const end = eng.time + seconds;
    const start = eng.time;
    while (eng.time < end - 1e-9 && session.engine === eng) {
      const t0 = performance.now();
      while (eng.time < end - 1e-9 && performance.now() - t0 < 40) eng.advance(Math.min(60, end - eng.time));
      btn.dataset.progress = `${Math.round((eng.time - start) / seconds * 100)}%`;
      await new Promise(r => requestAnimationFrame(r));
    }
    delete btn.dataset.progress;
    fastBusy = false;
    refresh();
    if (report.open) report.render();
    if (wasRunning) session.play();
  }

  // ── Canlı göstergeler (saniyede 4 kez) ──
  function refresh() {
    const st = session.stats();
    const live = st.statsTime > 0;
    out('time').textContent = clock(st.time);
    out('done').textContent = st.completed.toLocaleString('tr-TR');
    out('rate').innerHTML = live ? `${num(st.plannedRatePerHour)}<small>/sa</small>` : '—';
    out('eff').innerHTML = live && st.theoreticalPerHour ? `${num(st.lineEfficiency)}<small>%</small>` : '—';
    out('yield').innerHTML = live && st.completed + st.scrapped ? `${num(st.yield)}<small>%</small>` : '—';
    const bn = st.bottleneck;
    out('bn').textContent = bn ? `${bn.name} · ${num(bn.ect)} sn` : '—';
    out('bn').title = out('bn').textContent;
    inspector.refresh(st);
    if (session.selection?.type === 'station') syncHandle();
  }

  // Gizliyken (sitede başka sekme açık) simülasyon sürer, 3D çizim durur
  let visible = true;
  const visObs = new ResizeObserver(([e]) => { visible = e.contentRect.width > 0 && e.contentRect.height > 0; });
  visObs.observe(root);

  let raf = 0, last = performance.now(), acc = 0;
  const loop = now => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!fastBusy) session.tick(dt);
    if (visible) view.frame(dt);
    acc += dt;
    if (acc >= 0.25) { acc = 0; refresh(); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  inspector.render();
  refresh();
  syncHandle();
  if (sample) loadSample('sample');
  else if (autoplay) session.play();

  return {
    session,
    view,
    editor,
    load: data => session.load(data),
    loadSample,
    destroy() {
      cancelAnimationFrame(raf);
      visObs.disconnect();
      offs.forEach(off => off());
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onEsc, true);
      doc.removeEventListener('pointerdown', onDocDown);
      doc.removeEventListener('fullscreenchange', syncFullscreen);
      doc.removeEventListener('webkitfullscreenchange', syncFullscreen);
      doc.documentElement.classList.remove('pvsim-lock');
      inspector.dispose();
      editor.dispose();
      view.dispose();
      root.remove();
    },
  };
}
