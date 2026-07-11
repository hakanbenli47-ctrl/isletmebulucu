# İşletme Bulucu

İşletme Bulucu; Türkiye genelindeki satış adaylarını Google Places API (New) ile bulan, adayları Supabase üzerinde Place ID ile takip eden ve WhatsApp iletişim geçmişini yöneten özel kullanımlı bir Next.js uygulamasıdır.

Google'dan alınan işletme adı, adresi, telefonu ve web sitesi kalıcı olarak veritabanına yazılmaz. Supabase yalnızca Place ID, aday türü ve kullanıcı tarafından verilen durumları saklar. İşletme ayrıntıları görünür sayfa için Google Places'tan canlı alınır.

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

## Kontroller

```bash
npm run lint
npm test
npm run build
```

Testler; telefon normalleştirme, WhatsApp bağlantısı, web sitesi sınıflandırma, arama sırası ve Place ID tekrar engelleme kurallarını kapsar.

## Önemli davranışlar

- WhatsApp düğmesi mesajı otomatik göndermez; yalnızca hazır mesajla konuşmayı açar.
- Düğmeye basılması uygulamada `Mesaj gönderildi` kabul edilir ve 10 saniye geri alma seçeneği sunulur.
- `Google işletme profilinde bağımsız web sitesi görünmüyor` ifadesi yalnızca Google profilindeki website alanını anlatır; internette hiç site olmadığını garanti etmez.
- Aynı Place ID uygulama genelinde bir kez saklanır ve farklı aday türünde yeniden gösterilmez.
- Şehirler alfabetik değil, ticari hareketlilik önceliğiyle taranır.
- Web sitesi adaylarında en az 4,0 puan ve 5–250 yorum; ön muhasebe adaylarında en az 3,8 puan ve 8–500 yorum aranır.
- Ön muhasebede stok/cari hareketi yoğun sabit sektörler, web sitesi adaylarında güçlü yerel görünürlük sinyali bulunan işletmeler önce gösterilir.
