# PV Modül Tasarım · Netlify yayını

`web/` klasörü derleme gerektirmeyen statik bir sitedir:

| Yol | İçerik |
|---|---|
| `/` | Tanıtım sitesi (örnek modül, uygulamanın hesap motoruyla canlı hesaplanır) |
| `/app/` | Uygulama (PWA: telefona yüklenir, çevrimdışı çalışır) |
| `assets/js/library.js` | Hammadde kütüphanesi: 19 kategori, 219 varyant, alan şemaları |
| `assets/js/engine.js` | Hesap motoru: geometri, CTM, datasheet, BOM, Monte Carlo (arayüzden bağımsız) |
| `assets/js/app.js` | Uygulama arayüzü |
| `assets/js/libview.js` | Kütüphane sekmesi: arama, karşılaştırma, özel malzeme, fiyat listesi |
| `/app/#hat` | Hat simülasyonu bölümü (üstteki **Modül tasarımı / Hat simülasyonu** anahtarı) |
| `sim/` | 3D üretim hattı simülatörü (ES modülleri, Three.js r170 ve yazı tipleri gömülü). İlk açılışta yüklenir, sonra çevrimdışı çalışır. PV-DATA deposundaki `sim3d/` projesinden `node tools/export-site.mjs <web/sim>` ile kopyalanır; burada düzenlemeyin |
| `assets/js/hat.js` | Bölüm anahtarı ve simülatörün yüklenmesi |
| `sw.js`, `manifest.webmanifest` | Çevrimdışı önbellek ve kurulum bilgisi |
| `_headers`, `_redirects`, `404.html` | Netlify ayarları |

## Yayınlama yolları

### 1. Sürükle-bırak (en hızlı)
1. https://app.netlify.com/drop adresini açın.
2. `web` klasörünü sayfaya sürükleyin.
3. Netlify bir adres verir (ör. `https://adiniz.netlify.app`). Site ayarlarından adı değiştirebilirsiniz.

### 2. GitHub deposunu bağlama (her push'ta otomatik yayın)
1. Netlify'da **Add new site ▸ Import an existing project ▸ GitHub** seçin ve bu depoyu seçin.
2. Dal olarak yayınlamak istediğiniz dalı seçin.
3. Derleme ayarları depodaki `netlify.toml` dosyasından gelir (`publish = "web"`, derleme komutu yok). **Deploy** deyin.

### 3. Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify deploy --dir web --functions netlify/functions          # önizleme
netlify deploy --dir web --functions netlify/functions --prod   # canlı
```

## PVGIS sunucu fonksiyonu (Saha sekmesi)
Saha sekmesi, konuma göre enerji verimini AB Ortak Araştırma Merkezi'nin PVGIS servisinden alır. PVGIS tarayıcıdan doğrudan çağrılamadığı için istek `netlify/functions/pvgis.mjs` fonksiyonu üzerinden `/api/pvgis` adresine gider. Fonksiyon, GitHub bağlantılı yayında ve CLI ile `--functions` seçeneğiyle otomatik kurulur; ek ayar, API anahtarı veya paket gerekmez. **Sürükle-bırak yayında fonksiyon kurulmaz**; o durumda Saha sekmesi dışındaki her şey çalışır. Son PVGIS sonucu cihazda saklanır, çevrimdışıyken o kullanılır.

## Telefona kurulum
- **Android / Chrome:** `/app/` adresini açın, üstteki **Uygulamayı yükle** düğmesine dokunun.
- **iPhone / Safari:** **Paylaş ▸ Ana Ekrana Ekle**.
- **Masaüstü Chrome / Edge:** adres çubuğundaki yükleme simgesi.

PWA kurulumu HTTPS ister; Netlify adresleri varsayılan olarak HTTPS'tir.

## Güncelleme
Dosyaları değiştirip yeniden yayınlayın. Uygulama açılışta yeni sürümü arka planda indirir ve altta **Yeni sürüm hazır ▸ Yenile** çubuğunu gösterir. Büyük değişikliklerde `sw.js` içindeki `VERSION` değerini artırın (ör. `pvm-v2`); eski önbellek silinir.

## Uygulama mağazası (isteğe bağlı)
Aynı PWA, https://www.pwabuilder.com ile Google Play (TWA) ve App Store paketlerine dönüştürülebilir. Site adresini girip paketleri indirmeniz yeterli; kod değişikliği gerekmez.

## Veri ve gizlilik
Tasarımlar, revizyonlar, sertifikalı mekanik kapsam listesi, özel malzemeler ve fiyat listesi tarayıcının yerel deposunda (localStorage) tutulur; sunucuya gönderilmez. Yüklenen flasher dosyası yalnız açık oturumda bellekte tutulur. Sunucuya giden tek istek Saha sekmesindeki PVGIS sorgusudur (yalnız konum, eğim, azimut ve kayıp oranı). Başka cihaza taşımak için **Kayıt ▸ JSON indir** ve **Kütüphane ▸ Kütüphanemi indir** kullanın. Tarayıcı verilerini silmek bu kayıtları da siler.

## Yerelde deneme
```bash
cd web && python3 -m http.server 8080
# http://localhost:8080/
```

## Üçüncü taraf
- SheetJS (xlsx 0.18.5, Apache-2.0) `assets/vendor/` altında yerel olarak barındırılır; Excel dışa aktarımı çevrimdışı da çalışır.
- Three.js r170 (MIT), Barlow ve IBM Plex Mono yazı tipleri (SIL OFL) `sim/vendor/` altında yerel olarak barındırılır; lisans metinleri yanlarındadır.
- Yazı tipleri Google Fonts'tan yüklenir ve service worker tarafından önbelleğe alınır; bağlantı yoksa sistem yazı tipi kullanılır.
