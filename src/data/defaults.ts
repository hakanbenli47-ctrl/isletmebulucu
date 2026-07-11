import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "./sectors";
import type { AppSettings } from "@/types";

export const DEFAULT_WEBSITE_MESSAGE = `Merhaba, iyi çalışmalar.

Sitemix olarak işletmelere özel, mobil uyumlu ve müşterilerin WhatsApp, telefon ve konum üzerinden kolayca iletişime geçebildiği profesyonel web siteleri hazırlıyoruz.

İşletmeniz için ücretsiz bir ön çalışma hazırlayarak sunmak isteriz. İncelemek isterseniz örnek çalışmayı paylaşabiliriz.

İlgilenmiyorsanız belirtmeniz yeterlidir; tekrar iletişim kurulmayacaktır.

Sitemix
www.sitemix.com.tr`;

export const DEFAULT_ACCOUNTING_MESSAGE = `Merhaba, iyi çalışmalar.

Sitemix Ön Muhasebe; cari, stok, kasa, borç-alacak ve işletme hareketlerinin tek panel üzerinden kolayca takip edilmesi için geliştirilmiştir.

Hızlı kurulumu, PDF çıktıları, WhatsApp bilgilendirme özelliği ve anlaşılır kullanım yapısıyla işletmenizin günlük takibini kolaylaştırır.

Sistemi 7 gün ücretsiz deneyebilirsiniz. Tanıtım ve kayıt bağlantısını paylaşmamızı ister misiniz?

İlgilenmiyorsanız belirtmeniz yeterlidir; tekrar iletişim kurulmayacaktır.

Sitemix`;

export const DEFAULT_SETTINGS: AppSettings = {
  resultsPerSearch: 50,
  dailyContactGoal: 25,
  websiteSectors: [...WEBSITE_SECTORS],
  accountingSectors: [...ACCOUNTING_SECTORS],
  websiteMessage: DEFAULT_WEBSITE_MESSAGE,
  accountingMessage: DEFAULT_ACCOUNTING_MESSAGE,
};
