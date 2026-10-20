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
import { LineWizard } from './wizard.js';
import { injectStyles } from './styles.js';
import { ICON, clock, num, esc } from './ui.js';

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
// Tarayıcı deposu: son çalışma (otomatik) ve adlı kayıtlı hatlar — yalnız bu cihazda
const AUTOSAVE = 'pvsim.autosave.v1', LINES = 'pvsim.lines.v1';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

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
    <div class="pv-ro"><span class="cap">A kalite</span><b data-k="yield">—</b></div>
    <div class="pv-ro bn"><span class="cap">Darboğaz</span><b data-k="bn">—</b></div>
  </div>
  <div class="pv-tools">
    <button class="pv-tbtn" data-act="report" aria-label="Rapor">${ICON.report}Rapor</button>
    <div class="pv-menuwrap">
      <button class="pv-tbtn" data-menu="file" aria-label="Dosya">${ICON.file}Dosya</button>
      <div class="pv-menu right" data-for="file" hidden>
        <button data-act="wizard">Yeni hat sihirbazı…</button>
        <button data-act="new">Boş hat</button>
        <button data-act="sample">Örnek hat (20 istasyon)</button>
        <button data-act="full">Tam PV modül hattı (tüm süreçler)</button>
        <hr>
        <button data-act="lines">Kayıtlı hatlarım…</button>
        <hr>
        <button data-act="open">Dosyadan aç… (.simjson)</button>
        <button data-act="paste">Metinden aç (yapıştır)…</button>
        <button data-act="save">Dosyaya kaydet (.simjson)</button>
      </div>
    </div>
    <button class="pv-ibtn" data-act="fullscreen" aria-pressed="false" aria-label="Tam ekran" title="Tam ekran">${ICON.expand}</button>
  </div>
</div>
<div class="pvsim-main">
  <div class="pvsim-viewport">
    <div class="pv-rail" role="toolbar" aria-label="Düzenleme araçları">
      <button class="pv-ibtn" data-act="library" aria-pressed="false" aria-label="Süreç kütüphanesi" title="Süreç kütüphanesi: ekle">${ICON.library}</button>
      <button class="pv-ibtn" data-act="wizard" aria-label="Yeni hat sihirbazı" title="Yeni hat sihirbazı">${ICON.wand}</button>
      <span class="pv-rail-sep"></span>
      <button class="pv-ibtn" data-tool="select" aria-pressed="true" aria-label="Seç / taşı" title="Seç / taşı (V)">${ICON.cursor}</button>
      <button class="pv-ibtn" data-tool="connect" aria-pressed="false" aria-label="Konveyör bağla" title="Konveyör bağla (C)">${ICON.link}</button>
      <button class="pv-ibtn" data-act="arrange" aria-label="Otomatik yerleşim" title="Otomatik yerleşim: akışa göre düzenle">${ICON.arrange}</button>
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
    <div class="pv-empty" hidden><div>
      <span class="cap">Boş hat</span>
      <h3>Üretim hattını sıfırdan kurun</h3>
      <p>Sihirbazda hedef kapasiteyi ve süreç adımlarını seçin; hat bağlanmış ve yerleşmiş olarak gelir. Ya da kütüphaneden ilk istasyonu yerleştirin, sonrakileri <b>Sonrasına ekle</b> ile sırayla ekleyin.</p>
      <div class="pv-actions"><button class="pv-tbtn pri" data-act="wizard">${ICON.wand}Sihirbazla oluştur</button>
      <button class="pv-tbtn" data-act="library">${ICON.library}Kütüphaneden ekle</button></div>
    </div></div>
    <div class="pvsim-hint"></div>
  </div>
  <aside class="pvsim-side" aria-label="Denetçi">
    <button class="pv-sheet-handle" aria-expanded="false"><span class="grip"></span><span class="pv-tag">HAT</span><span class="t"></span><span class="s"></span>${ICON.chevron}</button>
    <div class="pv-side-body"></div>
  </aside>
</div>
<input type="file" class="pv-file" tabindex="-1" aria-hidden="true">`;

// exportMode: 'download' (dosya indirir) | 'dialog' (metni kopyalanabilir pencerede gösterir — indirmenin
// engellendiği gömülü önizlemeler için)
// restore: son çalışmayı tarayıcı deposundan aç (yoksa örnek hat)
export function mountLineSimulator(container, { layout = null, sample = !layout, speed = 10, autoplay = false,
                                                 exportMode = 'download', restore = !layout } = {}) {
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
  const palette = new Palette($('.pv-palette'), editor, { touch: coarse });
  inspector.onInsertAfter = () => setPalette(true);
  const wizard = new LineWizard($('.pvsim-main'), {
    onBuild: L => {
      session.replace(L);
      setPalette(false);
      toast('Hat oluşturuldu. Önceki hatta dönmek için Geri al.');
    },
  });
  wizard.onError = msg => toast(msg, true);
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
    $('.pv-rail [data-act=library]').setAttribute('aria-pressed', String(open));
    if (open) { palette.open(); wizard.hide(); }
    if (open && compact.matches) setSheet(false);
    if (!open && !keepPlacing) editor.cancel();
    syncEmpty();
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
    syncEmpty();
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
    if (!btn || !root.contains(btn) || btn.closest('.pvsim-side, .pv-palette, .pv-report, .pv-wiz, .pv-dialog')) return;
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
      case 'wizard': report.hide(); setPalette(false); wizard.show(); break;
      case 'arrange':
        if (!session.layout.stations.size) break;
        editor.arrange();
        toast('Yerleşim akışa göre düzenlendi. Geri al ile eski yerleşime dönebilirsiniz.');
        break;
      case 'lines': linesDialog(); break;
      case 'undo': session.undo(); break;
      case 'redo': session.redo(); break;
      case 'report': wizard.hide(); report.open ? report.hide() : report.show(); break;
      case 'new':
        session.replace(createDefaultLayout());
        currentName = '';
        break;
      case 'sample': loadSample('sample'); break;
      case 'full': loadSample('full'); break;
      case 'open': fileInput.click(); break;
      case 'save': exportFile('hat.simjson', JSON.stringify(session.toJSON(), null, 2), 'application/json'); break;
      case 'paste': pasteDialog(); break;
    }
  };
  root.addEventListener('click', onClick);
  const onDocDown = e => { if (!e.target.closest('.pv-menuwrap')) closeMenus(); };
  doc.addEventListener('pointerdown', onDocDown);

  // Dosya seçicide uzantı filtresi yok (telefonlar .simjson'u tanımayıp dosyayı soluk gösterir);
  // içerik okunup hat dosyası olduğu doğrulanır
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    let text;
    try {
      text = f.text ? await f.text() : await new Promise((ok, bad) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => bad(r.error);
        r.readAsText(f);
      });
    } catch (err) {
      toast(`Dosya okunamadı: ${err.message}`, true);
      return;
    }
    if (openText(text, f.name.replace(/(\.(simjson|json|txt))+$/i, ''))) toast(`${f.name} açıldı`);
  });

  // .simjson metnini aç; başarılıysa true
  function openText(text, name = '') {
    let data;
    try {
      data = JSON.parse(String(text).replace(/^\uFEFF/, '').trim());
    } catch {
      toast('Bu bir hat dosyası değil: içerik okunamadı (JSON bekleniyor)', true);
      return false;
    }
    if (!data || !Array.isArray(data.stations)) {
      toast('Bu bir hat dosyası değil: istasyon listesi yok', true);
      return false;
    }
    try {
      session.replace(data);
    } catch (err) {
      toast(`Hat açılamadı: ${err.message}`, true);
      return false;
    }
    currentName = session.layout.meta.name || name;
    return true;
  }

  // Dosya seçilemeyen durumlar için: .simjson metnini yapıştırarak aç
  function pasteDialog() {
    const d = doc.createElement('div');
    d.className = 'pv-dialog';
    d.innerHTML = `<div class="pv-dialog-box" role="dialog" aria-label="Metinden aç"><div class="pv-dialog-head"><b>Metinden aç</b>`
      + `<button class="pv-ibtn" data-x aria-label="Kapat">${ICON.close}</button></div>`
      + `<textarea spellcheck="false" placeholder="hat.simjson dosyasının içeriğini buraya yapıştırın"></textarea><div class="pv-dialog-foot">`
      + `<small>.simjson dosyasını bir metin uygulamasında açıp tümünü kopyalayın.</small>`
      + `<span>${navigator.clipboard?.readText ? `<button class="pv-tbtn" data-clip>${ICON.copy}Panodan</button> ` : ''}`
      + `<button class="pv-tbtn pri" data-go>${ICON.open}Aç</button></span></div></div>`;
    const ta = d.querySelector('textarea');
    d.addEventListener('click', async e => {
      if (e.target === d || e.target.closest('[data-x]')) { d.remove(); return; }
      if (e.target.closest('[data-clip]')) {
        try { ta.value = await navigator.clipboard.readText(); } catch { toast('Panoya erişilemedi; metni elle yapıştırın', true); }
        return;
      }
      if (e.target.closest('[data-go]') && openText(ta.value)) { d.remove(); toast('Hat açıldı'); }
    });
    root.appendChild(d);
    ta.focus();
  }

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
    session.on('layout', () => { refresh(); syncHandle(); syncEmpty(); scheduleSave(); if (report.open) report.render(); }),
    session.on('edit', () => { syncEmpty(); scheduleSave(); }),
    session.on('reset', () => { refresh(); if (report.open) report.render(); }),
  ];
  syncHistory();

  async function loadSample(which, initial = false) {
    try {
      const data = await (await fetch(SAMPLES[which])).json();
      if (initial) session.load(data); else session.replace(data);
      currentName = '';
    } catch (err) {
      toast(`Örnek yüklenemedi: ${err.message}`, true);
      return;
    }
    if (autoplay) session.play();
  }

  // ── Boş hat kartı ──
  // kütüphane açıkken ya da yerleştirirken kart zemini kapatmasın
  function syncEmpty() {
    $('.pv-empty').hidden = session.layout.stations.size > 0 || !$('.pv-palette').hidden || !!editor.placing;
  }

  // ── Otomatik kayıt: her düzenlemeden kısa süre sonra son çalışma bu cihaza yazılır ──
  let saveTimer = 0, currentName = '';
  const writeAutosave = () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    store.set(AUTOSAVE, { savedAt: Date.now(), name: currentName, data: session.layout.toJSON() });
  };
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeAutosave, 800);
  }
  const onHide = () => { if (saveTimer) writeAutosave(); };
  win.addEventListener('pagehide', onHide);

  // ── Kayıtlı hatlar (bu cihazda, adlı) ──
  function linesDialog() {
    const fmt = t => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const d = doc.createElement('div');
    d.className = 'pv-dialog';
    const render = () => {
      const lines = store.get(LINES) ?? [];
      d.innerHTML = `<div class="pv-dialog-box pv-lines" role="dialog" aria-label="Kayıtlı hatlar">`
        + `<div class="pv-dialog-head"><b>Kayıtlı hatlarım</b><button class="pv-ibtn" data-x aria-label="Kapat">${ICON.close}</button></div>`
        + `<div class="pv-lines-save"><span class="pv-in"><input type="text" data-name placeholder="Hat adı" value="${esc(currentName)}"></span>`
        + `<button class="pv-tbtn pri" data-save>${ICON.save}Mevcut hattı kaydet</button></div>`
        + `<div class="pv-lines-list">${lines.length ? lines.map((l, i) => `<div class="pv-lines-row"><div><b>${esc(l.name)}</b>`
          + `<small>${l.stations} istasyon · ${fmt(l.savedAt)}</small></div>`
          + `<button class="pv-tbtn" data-open="${i}">Aç</button><button class="pv-tbtn danger" data-del="${i}">Sil</button></div>`).join('')
          : '<p class="pv-muted">Henüz kayıtlı hat yok.</p>'}</div>`
        + `<div class="pv-dialog-foot"><small>Hatlar bu tarayıcıda saklanır. Başka cihaza taşımak için Dosya › Dosyaya kaydet.</small></div></div>`;
    };
    render();
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-x]')) { d.remove(); return; }
      const lines = store.get(LINES) ?? [];
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-save')) {
        const name = d.querySelector('[data-name]').value.trim() || `Hat ${fmt(Date.now())}`;
        session.layout.meta.name = name;
        const entry = { name, savedAt: Date.now(), stations: session.layout.stations.size, data: session.layout.toJSON() };
        const i = lines.findIndex(l => l.name === name);
        if (i >= 0) lines[i] = entry; else lines.unshift(entry);
        if (!store.set(LINES, lines)) { toast('Kaydedilemedi: tarayıcı deposu kapalı veya dolu', true); return; }
        currentName = name;
        scheduleSave();
        toast(i >= 0 ? `"${name}" güncellendi` : `"${name}" kaydedildi`);
        render();
      } else if (b.dataset.open != null) {
        const l = lines[Number(b.dataset.open)];
        session.replace(l.data);
        currentName = l.name;
        d.remove();
        toast(`"${l.name}" açıldı`);
      } else if (b.dataset.del != null) {
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Emin misiniz?'; return; }
        lines.splice(Number(b.dataset.del), 1);
        store.set(LINES, lines);
        render();
      }
    });
    root.appendChild(d);
  }

  async function exportFile(name, text, mime) {
    if (exportMode === 'dialog') { textDialog(name, text); return; }
    // Telefonda paylaşım menüsü (Dosyalara Kaydet, Drive, WhatsApp…); yoksa indirme
    if (coarse && navigator.share && navigator.canShare) {
      for (const type of [mime, 'text/plain']) {
        const file = new File([text], name, { type });
        if (!navigator.canShare({ files: [file] })) continue;
        try { await navigator.share({ files: [file], title: name }); }
        catch (err) { if (err.name !== 'AbortError') toast(`Paylaşılamadı: ${err.message}`, true); }
        return;
      }
    }
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
    out('yield').innerHTML = st.completed ? `${num(st.aRate)}<small>%</small>` : '—';
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
  // Açılış: verilen hat → son çalışma → örnek hat
  const auto = restore ? store.get(AUTOSAVE) : null;
  let restored = false;
  if (auto?.data) {
    try {
      session.load(auto.data);
      currentName = auto.name ?? '';
      restored = true;
      toast(auto.data.stations?.length ? 'Son çalışmanız açıldı' : 'Boş hattınız açıldı');
    } catch { /* bozuk kayıt: örnekle başla */ }
  }
  if (!restored && sample) loadSample('sample', true);
  else if (autoplay) session.play();
  syncEmpty();

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
      win.removeEventListener('pagehide', onHide);
      onHide();
      palette.dispose();
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
