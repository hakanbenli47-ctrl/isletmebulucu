import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "./sectors";
import type { AppSettings } from "@/types";

export const DEFAULT_WEBSITE_MESSAGE = `Merhaba, iyi çalışmalar.

Sitemix olarak işletmenizin dijitalde daha güvenilir ve profesyonel görünmesi için tasarımından yayına alınmasına kadar tüm süreci kapsayan anahtar teslim web siteleri hazırlıyoruz.

Hazırladığımız mobil uyumlu sitelerde müşterileriniz size WhatsApp, telefon ve konum üzerinden kolayca ulaşabilir; hizmetlerinizi ve çalışmalarınızı tek yerde inceleyebilir.

İşletmenize özel ücretsiz bir örnek ana sayfa hazırlayıp sunabiliriz. Uygun görürseniz örnek çalışmayı paylaşalım.

Sitemix
www.sitemix.com.tr`;

export const DEFAULT_ACCOUNTING_MESSAGE = `Merhaba, iyi çalışmalar.

Sitemix Ön Muhasebe; toptan satış, stok ve cari hareketi bulunan işletmelerin kasa, borç-alacak ve ürün takibini tek panelden yönetebilmesi için geliştirilmiştir.

Hızlı kurulum, anlaşılır kullanım, PDF çıktıları ve WhatsApp bilgilendirme özellikleriyle günlük işlemleri düzenli ve pratik hale getirir.

Sistemi 7 gün ücretsiz deneyebilirsiniz. Kısa tanıtım ve deneme bağlantısını paylaşalım mı?

Sitemix`;

export const DEFAULT_SETTINGS: AppSettings = {
  resultsPerSearch: 10,
  dailyContactGoal: 20,
  websiteSectors: [...WEBSITE_SECTORS],
  accountingSectors: [...ACCOUNTING_SECTORS],
  websiteMessage: DEFAULT_WEBSITE_MESSAGE,
  accountingMessage: DEFAULT_ACCOUNTING_MESSAGE,
};
