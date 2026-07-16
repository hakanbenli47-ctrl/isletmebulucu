# İşletme Bulucu

İşletme Bulucu; Türkiye genelindeki satış adaylarını Google Places API (New) ile bulan, açıklanabilir kurallarla puanlayan, görüşme ve takip aşamalarını yöneten ve referans ortaklarından gelen işleri ölçen özel kullanımlı bir Next.js satış ağıdır.

Google'dan alınan işletme adı, adresi, telefonu ve web sitesi kalıcı olarak veritabanına yazılmaz. Supabase yalnızca Place ID, aday türü, aramada kullanılan şehir/sektör ve kullanıcı tarafından oluşturulan satış durumlarını saklar. İşletme ayrıntıları görünür sayfa için Google Places'tan canlı alınır.

## 1. Yerelde çalıştırma

Node.js 20.9 veya daha yeni bir sürüm kullanın. Terminali proje klasöründe açın:

```bash
npm install
npm run dev
```

Ardından tarayıcıda `http://localhost:3000` adresini açın.

## 2. `.env.local` oluşturma

Proje kökündeki `.env.example` dosyasını `.env.local` adıyla kopyalayın ve değerleri doldurun:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJE.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-anahtari
GOOGLE_PLACES_API_KEY=google-places-anahtari
ALLOWED_USER_EMAIL=eposta@adresiniz.com
GOOGLE_PLACES_MAX_CALLS_PER_SEARCH=20
NEXT_PUBLIC_USE_MOCK_DATA=false
```

`GOOGLE_PLACES_API_KEY` değişkeninin adını değiştirmeyin ve `NEXT_PUBLIC_` ön eki eklemeyin. `.env.local` Git tarafından yok sayılır.

## 3. Supabase projesi oluşturma

1. Supabase panelinde yeni bir proje oluşturun.
2. **Project Settings → API** bölümünden Project URL ve anon/public key değerlerini alın.
3. Bu değerleri `.env.local` içindeki `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` alanlarına yazın.

## 4. Veritabanı şemasını manuel çalıştırma

1. Supabase panelinde **SQL Editor** sayfasını açın.
2. Yeni bir sorgu oluşturun.
3. `supabase/schema.sql` dosyasının tamamını kopyalayıp editöre yapıştırın.
4. **Run** düğmesiyle bir kez çalıştırın.

Uygulama bu dosyayı kendisi çalıştırmaz. SQL; tabloları, doğrulama kısıtlarını, indeksleri, `updated_at` tetikleyicilerini ve kullanıcıya özel RLS politikalarını oluşturur.

### Daha önce şemayı kurduysanız

Mevcut kayıtları silmeyin ve `schema.sql` dosyasını yeniden çalıştırmayın. Supabase **SQL Editor** içinde yeni sorgu açıp yalnızca aşağıdaki yükseltme dosyasının tamamını bir kez çalıştırın:

```text
supabase/migrations/20260711190000_sales_network.sql
```

Bu yükseltme mevcut adayları korur; satış aşamaları, takip tarihleri, faaliyet geçmişi ve referans ağı tablolarını ekler.

Instagram kanalı güncellemesi için daha sonra şu dosyayı da bir kez çalıştırın:

```text
supabase/migrations/20260711210000_instagram_channel.sql
```

Telefonla işletme arama ve Satış Merkezi toplu sonuç güncellemesi için şu
yükseltmeyi de bir kez çalıştırın:

```text
supabase/migrations/20260716190000_sales_bulk_outcomes.sql
```

Bu dosya mevcut adayları silmeden telefon arama indeksini ve `Cevap vermedi` /
`Onaylanmadı` satış durumlarını ekler. Dosyalar tarih sırasıyla çalıştırılmalıdır.

## 5. Supabase Auth kullanıcısı oluşturma

Herkese açık kayıt ekranı yoktur. Kullanıcıyı manuel ekleyin:

1. Supabase panelinde **Authentication → Users** sayfasını açın.
2. **Add user → Create new user** seçeneğini kullanın.
3. E-posta ve şifre belirleyin.
4. İsterseniz aynı e-postayı `.env.local` içindeki `ALLOWED_USER_EMAIL` alanına yazın. Bu alan boş bırakılırsa Supabase projesindeki oturum açabilen kullanıcılar uygulamaya girebilir.

## 6. Google Places API (New) açma

1. Google Cloud Console'da bir proje seçin veya oluşturun.
2. Projeye faturalandırma hesabı bağlayın.
3. **APIs & Services → Library** bölümünde **Places API (New)** hizmetini etkinleştirin.
4. **Credentials** bölümünde bir API anahtarı oluşturun.
5. Anahtarı mümkün olduğunca sunucu/IP ve **Places API (New)** ile sınırlandırın.

Uygulama Google Maps sayfalarını kazımaz; yalnızca Text Search (New) ve Place Details (New) uçlarını kullanır.

## 7. Google anahtarını ekleme

Google anahtarını yalnızca `.env.local` içindeki şu alana yazın:

```env
GOOGLE_PLACES_API_KEY=anahtariniz
```

Anahtar tarayıcı paketine eklenmez. Google çağrıları sunucudaki `/api` rotalarından yapılır.

## 8. Demo modunu kullanma

Supabase veya Google anahtarları hazır değilse:

```env
NEXT_PUBLIC_USE_MOCK_DATA=true
```

Bu modda giriş atlanır, gerçek Supabase veya Google isteği yapılmaz ve örnek kayıtlar `Demo veri` etiketiyle gösterilir. Gerçek kullanıma geçerken değeri `false` yapın ve geliştirme sunucusunu yeniden başlatın.

## 9. API kullanım limitini ayarlama

Bir `50 Yeni İşletme Bul` çalıştırmasında yapılabilecek en yüksek Text Search çağrısı:

```env
GOOGLE_PLACES_MAX_CALLS_PER_SEARCH=20
```

Varsayılan değer 20'dir. Limit dolmadan 50 uygun yeni işletme bulunamazsa bulunanlar kaydedilir ve sonraki arama aynı şehir/sektör sırasından devam eder. Görünür listedeki işletme ayrıntıları için ayrıca Place Details çağrıları yapılır.

## 10. İsteğe bağlı Instagram etkinlik kontrolü

Google işletme profilindeki Instagram bağlantılarını ayırmak için Meta anahtarı gerekmez. Hesabın son paylaşımını resmi Meta API ile doğrulamak isterseniz profesyonel Instagram hesabınızın bilgilerini sunucu değişkenlerine ekleyin:

```env
META_INSTAGRAM_USER_ID=
META_INSTAGRAM_ACCESS_TOKEN=
META_GRAPH_API_VERSION=v23.0
```

Bu alanlar boşsa işletme yine `Instagram var · site yok` olarak gösterilir; etkinlik durumu `doğrulanmadı` olur. Bağlantı sağlandığında son 90 günde paylaşım yapan profesyonel hesaplar `Instagram aktif` olarak işaretlenir. Erişim anahtarı tarayıcıya gönderilmez ve Instagram sayfaları kazınmaz.

## Kontroller

```bash
npm run lint
npm test
npm run build
```

Testler; telefon normalleştirme, WhatsApp bağlantısı, web sitesi sınıflandırma, potansiyel puanlama, arama sırası ve Place ID tekrar engelleme kurallarını kapsar.

## Önemli davranışlar

- WhatsApp düğmesi mesajı otomatik göndermez; yalnızca hazır mesajla konuşmayı açar.
- Aday ekranındaki ilk mesaj her işletme için yalnızca `Merhaba, iyi çalışmalar.` metnidir; teklif, bağlantı veya işletme adı eklenmez.
- İlk selam açıldığında aday `Yanıt bekleniyor` aşamasına alınır; otomatik takip tarihi veya cevap gelmeden tanıtım mesajı oluşturulmaz.
- İşletme gerçekten cevap verdiyse Satış Merkezi'ndeki `Cevap aldım · 2. mesaj` adımı kullanılır. İkinci mesajdan sonra yeniden cevap beklenir.
- İşletme açıkça ilgilenirse kayıt `İlgileniyor` aşamasına alınır ve ancak bundan sonra detay/demo mesajı açılır.
- `Google işletme profilinde bağımsız web sitesi görünmüyor` ifadesi yalnızca Google profilindeki website alanını anlatır; internette hiç site olmadığını garanti etmez.
- Aynı Place ID her kullanıcı için bir kez saklanır ve farklı aday türünde yeniden gösterilmez.
- Şehirler alfabetik değil, ticari hareketlilik önceliğiyle taranır.
- Web sitesi adaylarında dengeli profilde en az 4,0 puan ve 5–250 yorum; ön muhasebe adaylarında en az 3,5 puan ve 2–300 yorum aranır.
- Yeni adayın faal olması, Türkiye ve seçilen il bilgisinin Google adres bileşenlerinden doğrulanması ve WhatsApp'a uygun gerçek bir Türkiye cep telefonu taşıması zorunludur; sabit telefonlar aday havuzuna alınmaz.
- Arama metninin yanında Google'ın birincil türü, tüm işletme türleri ve yerelleştirilmiş kategori etiketi birlikte denetlenir. Ön muhasebe adayında genel `toptancı` türüne ek olarak ikinci bir sektör sinyali aranır.
- Aynı taramada aynı Place ID veya aynı cep telefonuyla dönen şube/tekrarlar tek aday sayılır; eleme nedenlerinin özeti arama sonucunda gösterilir.
- Ön muhasebede stok/cari hareketi yoğun sabit sektörler, web sitesi adaylarında güçlü yerel görünürlük sinyali bulunan işletmeler önce gösterilir.
- Aday ekranlarında şehir ve meslek/sektör filtresiyle hedefli arama yapılabilir.
- `Dengeli`, `Seçici` ve `Geniş` kalite profilleriyle aday havuzunun sıkılığı değiştirilebilir; kurallar sabittir ve yapay zekâ kullanılmaz.
- Ön muhasebe sektörleri toptan satış, dağıtım, tedarik, üretim ve stok hareketi yüksek işletmelere odaklanır.
- Masaüstünde WhatsApp uygulaması (sekmesiz) veya WhatsApp Web (tek çalışma sekmesi) seçilebilir.
- Google kota veya geçici detay hatasında liste tamamen çökmez; Place ID kayıtları korunur ve erişilemeyen detaylar açıkça belirtilir.
- Satış Merkezi; cevap, ilgi, demo, takip, müşteri ve iletişim istememe aşamalarını; görüşme notlarını ve sıradaki takip tarihini yönetir.
- Takip tarihi yalnızca kullanıcı tarafından görüşmeye özel olarak planlanır; sistem cevap gelmeyen işletmeye otomatik takip mesajı önermez.
- `İletişim istemiyor` aşamasındaki kayıtlarda WhatsApp takibi kapatılır.
- Referans Ağı; mali müşavir, bilgisayarcı, matbaa, tedarikçi ve mevcut müşterilerden gelen tavsiyeleri manuel olarak ölçer.
- Şehir/sektör performansı sadece sizin satış sonuçlarınızdan hesaplanır; yapay zekâ kullanılmaz.
- Web adayları `Instagram var · site yok` kanalına göre aranabilir; Instagram bağlantısı ve uygun mesaj otomatik seçilir.
- Ön muhasebe kayıt bağlantısı ilk selamda veya ikinci mesajda paylaşılmaz; yalnızca işletme ilgi gösterdikten sonraki detay mesajında açılır: `https://www.sitemix.com.tr/on-muhasebe/kayit`.
- Aday listelerinde klasik sayfalama yoktur; aşağı kaydırıldıkça diğer kayıtlar otomatik yüklenir ve filtreler mevcut listeye anında uygulanır.
- Arama sonuçları sektör adı, Google işletme türleri, kategori etiketi, faaliyet durumu, il/ülke, cep telefonu, puan ve yorum kalitesiyle doğrulanır; ölçütlerden geçmeyen sonuçlar aday havuzuna eklenmez.
