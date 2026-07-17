# İşletme Bulucu

İşletme Bulucu; Türkiye genelindeki satış adaylarını ücretsiz OpenStreetMap verisi
üzerinden bulan, uygun adayları Supabase'e kaydeden ve görüşme/takip aşamalarını
yöneten özel kullanımlı bir Next.js uygulamasıdır.

Ücretli harita sağlayıcı entegrasyonu yoktur. Uygulama ücretli bir harita API
anahtarı okumaz; yalnızca OpenStreetMap tabanlı açık veri servislerini kullanır.

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
OVERPASS_API_URLS=https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter
PLACES_MAX_CALLS_PER_SEARCH=3
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

## Açık veri araması ve kayıt davranışı

- İşletme aramaları OpenStreetMap'in Overpass servisine; yalnızca telefon etiketi
  ve `start_date`/`opening_date` açılış tarihi bulunan sektör kayıtlarını getirecek şekilde yapılır. Nominatim yalnızca açık
  veri ayrıntısı yenilemesinde kullanılır.
- Kamu Nominatim servisine saygı için Nominatim istekleri en az 1,1 saniye aralıkla
  sıraya alınır. Tüm açık veri cevapları sunucu tarafında önbelleğe alınır ve bir
  kullanıcı aramasında en fazla 3 sektör/şehir çağrısı yapılır.
- Bir Overpass sunucusu geçici hata verirse `OVERPASS_API_URLS` listesindeki sıradaki
  açık sunucu denenir; başarılı cevap önbelleğe alınarak gereksiz tekrar önlenir.
- Yalnızca son iki takvim yılı içinde açıldığı açık veride doğrulanan, kapanmış/
  terk edilmiş yaşam döngüsü etiketi bulunmayan ve BTK planına uygun Türkiye cep
  telefonu olan işletmeler kabul edilir. Açılış tarihi bilinmeyen kayıtlar elenir.
- Uygun sonuçların ad, adres, telefon, web ve harita bilgileri `status = 'new'`
  olarak Supabase'e kaydedilir.
- WhatsApp sohbet ekranının açıldığı kullanıcı tarafından onaylanınca kayıt
  `contacted` durumuna geçer ve bir daha yeni aday/yedek aday olarak gösterilmez.
- Nominatim geçici hata verirse yalnızca daha önce kaydedilmiş, `status = 'new'`
  olan ve mesaj gönderilmemiş adaylar gösterilir.
- Aynı OpenStreetMap kimliği her kullanıcı için yalnızca bir kez saklanır.
- Sabit telefonlar değil, BTK'nın güncel numaralandırma planındaki Türkiye cep
  telefonu blokları kabul edilir. OpenStreetMap'te WhatsApp etiketi veya bağlantısı
  bulunan kayıtlar önce gösterilir.
- Ücretsiz ve güvenilir bir WhatsApp hesap-sorgulama API'si olmadığı için aday,
  WhatsApp mesaj ekranı gerçekten açıldıktan sonra `contacted` durumuna geçirilir.
  Ekran açılmazsa `WhatsApp yok` sonucu kaydedilir ve aynı aday yeniden gösterilmez.
- OpenStreetMap puan/yorum sağlamadığı için aday kalitesi konum, sektör, telefon,
  web sitesi ihtiyacı ve profil doluluğu üzerinden hesaplanır.

Kamu Nominatim servisi ücretsizdir fakat yüksek hacimli toplu veri çıkarma hizmeti
değildir. Daha yoğun kullanımda kendi Nominatim sunucunuzu kurun veya kullanım
politikasına uygun başka bir OpenStreetMap sağlayıcısına `NOMINATIM_API_URL` ile
geçin. OpenStreetMap atfı arayüzde görünür tutulmalıdır.

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
