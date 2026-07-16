import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "./sectors";
import type { AppSettings } from "@/types";

export const FIRST_CONTACT_MESSAGE = "Merhaba, iyi çalışmalar.";

// Bu metinler ilk selamdan sonra yalnızca işletme cevap verdiğinde açılır.
export const DEFAULT_WEBSITE_MESSAGE = `Teşekkür ederim. Sitemix olarak işletmeler için mobil uyumlu, telefon, WhatsApp ve harita bağlantılı web siteleri hazırlıyoruz.

Google işletme profilinizde bağımsız bir web sitesi görünmediği için yazdım. Uygun olursa işletmenize özel ücretsiz bir örnek ana sayfa hazırlayıp paylaşabilirim. Görmek ister misiniz?`;

export const DEFAULT_INSTAGRAM_MESSAGE = `Teşekkür ederim. Instagram'daki çalışmalarınızı müşterilerinizin daha düzenli inceleyebileceği, Google'da bulunabilen ve doğrudan WhatsApp'tan ulaşabilecekleri bağımsız bir web sitesinde toplayabiliyoruz.

Uygun olursa işletmenize özel ücretsiz bir örnek ana sayfa hazırlayıp paylaşabilirim. Görmek ister misiniz?`;

export const DEFAULT_ACCOUNTING_MESSAGE = `Teşekkür ederim. Sitemix Ön Muhasebe; stok, cari hesap, kasa, borç-alacak ve günlük satış takibini tek ekranda toplamaya yardımcı oluyor.

Size doğru bilgiyi verebilmem için sorayım: işletmenizde bu takipleri şu anda defterle mi, Excel'le mi, yoksa başka bir programla mı yapıyorsunuz?`;

// Bu metinler ancak işletme ikinci mesaja ilgi gösterdiğinde açılır.
export const DEFAULT_WEBSITE_FOLLOW_UP_MESSAGE = `Memnuniyetle. İşletmenize uygun örneği hazırlayabilmem için özellikle öne çıkarmamızı istediğiniz hizmeti ve hizmet verdiğiniz bölgeyi yazabilir misiniz? Buna göre kısa bir ana sayfa taslağı paylaşayım.`;

export const DEFAULT_INSTAGRAM_FOLLOW_UP_MESSAGE = `Memnuniyetle. Örneği Instagram çalışmalarınıza uygun hazırlayabilmem için özellikle öne çıkarmamızı istediğiniz hizmeti ve hizmet verdiğiniz bölgeyi yazabilir misiniz? Buna göre kısa bir ana sayfa taslağı paylaşayım.`;

export const DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE = `Memnuniyetle. Sistemi 7 gün ücretsiz deneyebilirsiniz:
https://www.sitemix.com.tr/on-muhasebe/kayit

Dilerseniz önce stok, cari hesap, kasa veya borç-alacak takibinde en çok zaman alan kısmı yazın; size en uygun ekranları göstereyim.`;

export const DEFAULT_SETTINGS: AppSettings = {
  resultsPerSearch: 10,
  dailyContactGoal: 20,
  websiteSectors: [...WEBSITE_SECTORS],
  accountingSectors: [...ACCOUNTING_SECTORS],
  websiteMessage: DEFAULT_WEBSITE_MESSAGE,
  accountingMessage: DEFAULT_ACCOUNTING_MESSAGE,
  instagramMessage: DEFAULT_INSTAGRAM_MESSAGE,
  websiteFollowUpMessage: DEFAULT_WEBSITE_FOLLOW_UP_MESSAGE,
  accountingFollowUpMessage: DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE,
  instagramFollowUpMessage: DEFAULT_INSTAGRAM_FOLLOW_UP_MESSAGE,
  // Eski kurulumlarla API uyumluluğu için korunur; yeni akış otomatik takip planlamaz.
  firstFollowUpDays: 3,
  finalFollowUpDays: 7,
  maxFollowUps: 2,
};
