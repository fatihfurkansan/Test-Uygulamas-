# PV Modül Tasarım

PV modül tasarım, verim ve maliyet simülasyonu: ölçekli teknik çizim, CTM kayıp/kazanç zinciri, Monte Carlo tolerans analizi, BOM maliyeti, tasarım karşılaştırma ve 219 varyantlı hammadde kütüphanesi. Arayüz Türkçe; telefona yüklenebilir (PWA) ve çevrimdışı çalışır.

- `web/` — Netlify'a yayınlanan site (`/` tanıtım, `/app/` uygulama)
- `prototip/` — tek dosyalık ilk prototip
- `DEPLOY.md` — Netlify yayın ve telefona kurulum adımları

Hızlı başlangıç: Netlify'da bu depoyu bağlayın; `netlify.toml` yayın klasörünü (`web`) otomatik ayarlar. Yerelde denemek için `cd web && python3 -m http.server 8080`.
