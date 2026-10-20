# PV Modül Tasarım

PV modül tasarım, verim ve maliyet simülasyonu: ölçekli teknik çizim (SVG, DXF, A4 datasheet), CTM kayıp/kazanç zinciri ve tek diyot I-V modeli, gölge ve bypass analizi, büyük sehimli mekanik yük simülasyonu (IEC 61215 MQT 16), Monte Carlo tolerans ve hassasiyet (tornado) analizi, flasher verisiyle kalibrasyon ve kontrol grafiği, PVGIS ile konuma göre enerji, BOM maliyeti, revizyon yönetimi, tasarım karşılaştırma, 234 varyantlı hammadde kütüphanesi ve 3D üretim hattı simülasyonu (31 süreç tipi; arıza, bakım, vardiya, operatör, malzeme, hurda ve tamir parametreleri; darboğaz, OEE ve vardiya raporu). Arayüz Türkçe; telefona yüklenebilir (PWA) ve çevrimdışı çalışır.

- `web/` — Netlify'a yayınlanan site (`/` tanıtım, `/app/` uygulama)
- `web/sim/` — 3D hat simülatörü (`/app/#hat`); kaynağı PV-DATA deposundaki `sim3d/`, oradan kopyalanır
- `netlify/functions/` — PVGIS sorgusu için sunucu fonksiyonu (`/api/pvgis`)
- `tests/dogrulama.js` — hesap doğrulama testleri (`node tests/dogrulama.js`): elektrik modeli, mekanik çözücünün Navier, sonlu fark ve kompozit kiriş referanslarıyla karşılaştırması
- `prototip/` — tek dosyalık ilk prototip
- `DEPLOY.md` — Netlify yayın ve telefona kurulum adımları

Hızlı başlangıç: Netlify'da bu depoyu bağlayın; `netlify.toml` yayın klasörünü (`web`) otomatik ayarlar. Yerelde denemek için `cd web && python3 -m http.server 8080`.
