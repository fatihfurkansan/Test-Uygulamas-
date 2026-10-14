// PVGIS PVcalc vekili (Netlify Functions v2). PVGIS API tarayıcıdan çağrılamadığı (CORS) için
// uygulama bu uç noktayı kullanır: /api/pvgis?lat=..&lon=..&angle=..&aspect=..&loss=..&mountingplace=free|building
// Yanıt 1 kWp kristal silisyum sistem içindir; modüle özgü çarpanlar uygulamada eklenir.
const API = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });

export default async (req) => {
  const u = new URL(req.url);
  const num = (k, lo, hi, def) => {
    const s = u.searchParams.get(k);
    if (s === null || s === '') return def;
    const v = Number(s);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : NaN;
  };
  const lat = num('lat', -90, 90, NaN), lon = num('lon', -180, 180, NaN);
  const angle = num('angle', 0, 90, 30), aspect = num('aspect', -180, 180, 0), loss = num('loss', 0, 50, 14);
  if ([lat, lon, angle, aspect, loss].some(Number.isNaN)) return json({ error: 'Geçersiz parametre: enlem, boylam, eğim, azimut veya kayıp aralık dışında.' }, 400);
  const q = new URLSearchParams({
    lat: lat.toFixed(4), lon: lon.toFixed(4), peakpower: '1', loss: String(loss),
    angle: String(angle), aspect: String(aspect),
    mountingplace: u.searchParams.get('mountingplace') === 'building' ? 'building' : 'free',
    pvtechchoice: 'crystSi', outputformat: 'json',
  });
  let r, txt;
  try {
    r = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(25000) });
    txt = await r.text();
  } catch (e) {
    return json({ error: `PVGIS’e ulaşılamadı (${e.name === 'TimeoutError' ? 'zaman aşımı' : e.message}).` }, 502);
  }
  let d = null;
  try { d = JSON.parse(txt); } catch { /* PVGIS hata metni düz metin olabilir */ }
  if (!r.ok || !d || !d.outputs) {
    const msg = (d && d.message) || txt.slice(0, 300) || `HTTP ${r.status}`;
    return json({ error: `PVGIS: ${msg}` }, r.status >= 400 && r.status < 500 ? 400 : 502);
  }
  const t = d.outputs.totals.fixed;
  return json({
    lat, lon, angle, aspect, loss,
    db: d.inputs?.meteo_data?.radiation_db || '',
    E_y: t.E_y, H_y: t['H(i)_y'], SD_y: t.SD_y,
    l_aoi: t.l_aoi, l_spec: t.l_spec, l_tg: t.l_tg, l_total: t.l_total,
    monthly: d.outputs.monthly.fixed.map((m) => ({ month: m.month, E_m: m.E_m, H_m: m['H(i)_m'] })),
  }, 200, { 'Cache-Control': 'public, max-age=86400' });
};

export const config = { path: '/api/pvgis' };
