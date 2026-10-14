# PV Modül Tasarım

PV modül tasarım, verim ve maliyet simülasyonu: ölçekli teknik çizim (SVG, DXF, A4 datasheet), CTM kayıp/kazanç zinciri ve tek diyot I-V modeli, gölge ve bypass analizi, Monte Carlo tolerans ve hassasiyet (tornado) analizi, flasher verisiyle kalibrasyon ve kontrol grafiği, PVGIS ile konuma göre enerji, BOM maliyeti, revizyon yönetimi, tasarım karşılaştırma ve 234 varyantlı hammadde kütüphanesi. Arayüz Türkçe; telefona yüklenebilir (PWA) ve çevrimdışı çalışır.

- `web/` — Netlify'a yayınlanan site (`/` tanıtım, `/app/` uygulama)
- `netlify/functions/` — PVGIS sorgusu için sunucu fonksiyonu (`/api/pvgis`)
- `prototip/` — tek dosyalık ilk prototip
- `DEPLOY.md` — Netlify yayın ve telefona kurulum adımları

Hızlı başlangıç: Netlify'da bu depoyu bağlayın; `netlify.toml` yayın klasörünü (`web`) otomatik ayarlar. Yerelde denemek için `cd web && python3 -m http.server 8080`.
