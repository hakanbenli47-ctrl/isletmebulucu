# İşletme Bulucu

İşletme Bulucu; Türkiye genelindeki satış adaylarını ücretsiz Overture Maps ve
OpenStreetMap verileri üzerinden bulan, uygun adayları Supabase'e kaydeden ve
görüşme/takip aşamalarını yöneten özel kullanımlı bir Next.js uygulamasıdır.

Harita sağlayıcısı için ücretli API veya kredi kartı gerekmez. İşletme araması
önce projeyle birlikte dağıtılan hızlı Overture işletme dizininden yapılır. Dizinde
sonuç olmayan şehir/sektör çiftlerinde Overpass API, eski OpenStreetMap kayıt
ayrıntısı gerektiğinde Nominatim kullanılır.

## Yerelde çalıştırma

Node.js 20.9 veya daha yeni bir sürüm kullanın:

```bash
npm install
npm run dev
```

Ardından `http://localhost:3000` adresini açın.

## Ortam değişkenleri

`.env.example` dosyasını `.env.local` adıyla kopyalayın:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJE.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-anahtari
ALLOWED_USER_EMAIL=eposta@adresiniz.com
NOMINATIM_API_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=IsletmeBulucu/1.0
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
OVERPASS_API_URLS=https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass.private.coffee/api/interpreter,https://overpass-api.de/api/interpreter
PLACES_MAX_CALLS_PER_SEARCH=4
NEXT_PUBLIC_USE_MOCK_DATA=false
```

`NOMINATIM_USER_AGENT` uygulamayı tanımlayan sabit ve benzersiz bir değer olmalıdır.
Tarayıcıya gizli anahtar gönderilmez.

## Supabase kurulumu

Yeni kurulumda Supabase **SQL Editor** içinde `supabase/schema.sql` dosyasının
tamamını bir kez çalıştırın.

Mevcut kurulumda dosyaları tarih sırasıyla çalıştırın. OpenStreetMap sonuçlarını
saklayan son yükseltme mutlaka uygulanmalıdır:

```text
supabase/migrations/20260711190000_sales_network.sql
supabase/migrations/20260711210000_instagram_channel.sql
supabase/migrations/20260716190000_sales_bulk_outcomes.sql
supabase/migrations/20260717150000_openstreetmap_lead_cache.sql
```

Son yükseltme mevcut adayları silmez. `lead_records` tablosuna `data_source`,
`details_cache` ve `details_cached_at` alanlarını ekler.

## Kullanıcı oluşturma

1. Supabase panelinde **Authentication → Users** sayfasını açın.
2. **Add user → Create new user** ile e-posta ve şifre belirleyin.
3. İsterseniz aynı e-postayı `ALLOWED_USER_EMAIL` alanına yazın.

Uygulamada herkese açık kayıt ekranı yoktur.

## Ücretsiz açık veri araması ve kayıt davranışı

- Kuaför, güzellik merkezi, berber, nakliyat, oto yıkama, halı yıkama ve tırnak
  salonu aramaları Overture Maps'in `2026-06-17.0` açık veri sürümünden hazırlanmış
  yerel dizinden gelir. Telefonu BTK mobil planına uymayan, kapalı görünen ve
  Foursquare kaynaklı kayıtlar dizine alınmaz.
- Yerel dizin uzak API çağrısı yapmadan bellekte şehir/sektör bazında aranır. Böylece
  ücretsiz kamu servisleri yavaş veya erişilemez olsa bile uygun havuz bulunan
  aramalar anında sonuç verir. Supabase'de yeni tablo ya da şema değişikliği gerekmez.
- Yerel dizinde sonuç bulunmayan şehir/sektör çiftleri bu iş için tasarlanmış ücretsiz
  Overpass API üzerinden aranır. Kamu Nominatim servisi sistematik işletme taramasında
  kullanılmaz.
- Aynı şehir/sektör aramaları 6 saat önbelleğe alınır; eşzamanlı aynı istekler tek
  HTTP çağrısında birleştirilir. Overpass kullanım politikasına uygun olarak sorgular
  sırayla çalışır. Bir kullanıcı aramasında en fazla 4 birleşim denenir. Filtre yoksa
  sonuçların yaklaşık `%40`ı demo/ilgi/müşteri alınan birleşimlerden gelir. Kalan
  bölümde her aktif sektör ayrı sorgulanır; 81 il × aktif sektör
  birleşimleri tekrar etmeden dolaşılır ve tarama sonraki çağrıda kaldığı yerden devam
  eder. Sektör başına dengeli sonuç payı, kuaför gibi yoğun bir kategorinin tabloyu
  tek başına doldurmasını önler. Tüm uygun adaylar mevcut `lead_records` tablosunda
  birleştirilir; yeni tablo veya veritabanı şema değişikliği gerekmez.
- Bir Overpass sunucusu yanıt vermezse sıradaki ücretsiz sunucu denenir. Tüm ücretsiz
  uç noktalar yanıt vermezse sonraki şehirleri bekletmek yerine
  daha önce kaydedilmiş ve henüz mesaj gönderilmemiş adaylar hemen gösterilir.
- Son iki takvim yılı içinde açıldığı doğrulanan işletmeler önce gösterilir. Açılış
  tarihi açık veride bulunmayan ancak kapanış/terk edilme işareti taşımayan ve BTK
  planına uygun Türkiye cep telefonu olan işletmeler yedek aday olarak kabul edilir.
  Açılış tarihi açıkça iki yıldan eski olan kayıtlar elenir.
- Uygun sonuçların ad, adres, telefon, web ve harita bilgileri `status = 'new'`
  olarak Supabase'e kaydedilir.
- WhatsApp sohbet ekranının açıldığı kullanıcı tarafından onaylanınca kayıt
  `contacted` durumuna geçer ve bir daha yeni aday/yedek aday olarak gösterilmez.
- Açık veri servisleri geçici hata verirse yalnızca daha önce kaydedilmiş, `status = 'new'`
  olan ve mesaj gönderilmemiş adaylar gösterilir.
- Aynı OpenStreetMap kimliği her kullanıcı için yalnızca bir kez saklanır.
- `İlgileniyor`, `Detay / demo` veya `Müşteri` sonucu alınan şehir/sektör çiftleri
  sonraki filtresiz genel aramaların yaklaşık `%40`lık bölümünde değerlendirilir.
  Bu öncelik mevcut satış kayıtlarından
  hesaplanır; ek tablo veya veritabanı şema değişikliği gerektirmez.
- Sabit telefonlar değil, BTK'nın güncel numaralandırma planındaki Türkiye cep
  telefonu blokları kabul edilir. OpenStreetMap'te WhatsApp etiketi veya bağlantısı
  bulunan kayıtlar önce gösterilir.
- Ücretsiz ve güvenilir bir WhatsApp hesap-sorgulama API'si olmadığı için aday,
  WhatsApp mesaj ekranı gerçekten açıldıktan sonra `contacted` durumuna geçirilir.
  Ekran açılmazsa `WhatsApp yok` sonucu kaydedilir ve aynı aday yeniden gösterilmez.
- OpenStreetMap puan/yorum sağlamadığı için aday kalitesi konum, sektör, telefon,
  web sitesi ihtiyacı ve profil doluluğu üzerinden hesaplanır.

Overture dizinini yeni bir resmi sürümle yenilemek için Python 3 üzerinde:

```bash
py -m pip install duckdb
py scripts/update_overture_places.py --release YIL-AY-GUN.0
```

Komut yalnızca Türkiye'deki aktif sektörleri ve mobil telefonlu kayıtları indirerek
`src/data/overture-places.json` dosyasını yeniden üretir. Çalışan uygulamada Python
veya DuckDB bağımlılığı yoktur.

Kamu Nominatim servisi ücretsizdir fakat yüksek hacimli toplu veri çıkarma hizmeti
değildir. Daha yoğun kullanımda kendi Nominatim sunucunuzu kurun veya kullanım
politikasına uygun başka bir OpenStreetMap sağlayıcısına `NOMINATIM_API_URL` ile
geçin. Overture Maps ve OpenStreetMap atıfları arayüzde görünür tutulmalıdır.

## Demo modu

```env
NEXT_PUBLIC_USE_MOCK_DATA=true
```

Demo modunda gerçek Supabase veya OpenStreetMap isteği yapılmaz.

## İsteğe bağlı Instagram etkinlik kontrolü

```env
META_INSTAGRAM_USER_ID=
META_INSTAGRAM_ACCESS_TOKEN=
META_GRAPH_API_VERSION=v23.0
```

Alanlar boşsa Instagram bağlantısı yine gösterilir, etkinlik durumu doğrulanmaz.

## Kontroller

```bash
npm run lint
npm test
npm run build
```

WhatsApp düğmesi mesajı otomatik göndermez; yalnızca konuşmayı hazır kısa selamla
açar. Satış durumları ve takip tarihleri kullanıcı tarafından yönetilir.
