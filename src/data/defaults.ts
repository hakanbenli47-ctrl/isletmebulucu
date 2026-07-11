import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "./sectors";
import type { AppSettings } from "@/types";

export const DEFAULT_WEBSITE_MESSAGE = `Merhaba, iyi çalışmalar.

Google işletme profilinizde müşterilerinize güvenle gösterebileceğiniz bağımsız bir web sitesi görünmüyor. İşletmeniz için mobil uyumlu, WhatsApp, telefon ve harita bağlantılı anahtar teslim bir web sitesi hazırlıyoruz.

İşletmenize özel ücretsiz bir örnek ana sayfa hazırlayıp paylaşmamı ister misiniz?

Sitemix · www.sitemix.com.tr
Bu konuda tekrar yazmamamızı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_INSTAGRAM_MESSAGE = `Merhaba, iyi çalışmalar.

Instagram sayfanızdaki çalışmalarınızı müşterilerinizin daha düzenli inceleyebileceği, Google'da bulunabilen ve doğrudan WhatsApp'tan size ulaşabilecekleri anahtar teslim bir web sitesinde toplayabiliriz.

İşletmenize özel ücretsiz bir örnek ana sayfa hazırlayıp paylaşmamı ister misiniz?

Sitemix · www.sitemix.com.tr
Bu konuda tekrar yazmamamızı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_ACCOUNTING_MESSAGE = `Merhaba, iyi çalışmalar.

Toptan ve stoklu çalışan işletmeler için cari hesap, stok, kasa, borç-alacak ve günlük satış takibini tek ekranda kolaylaştıran Sitemix Ön Muhasebe’yi geliştirdik.

Sistemi incelemek için şimdi kayıt olun ve 7 gün ücretsiz deneyin:
https://www.sitemix.com.tr/on-muhasebe/kayit

Sitemix
Bu konuda tekrar yazmamamızı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_WEBSITE_FOLLOW_UP_MESSAGE = `Merhaba, birkaç gün önce işletmeniz için ücretsiz anahtar teslim web sitesi örneği hakkında yazmıştım. Uygunsanız kısa bir örnek paylaşabilirim. Tekrar yazmamamı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_INSTAGRAM_FOLLOW_UP_MESSAGE = `Merhaba, birkaç gün önce Instagram çalışmalarınızı bağımsız bir web sitesinde toplamak için ücretsiz örnek hazırlayabileceğimizi paylaşmıştım. İşletmenize özel örneği görmek isterseniz hazırlayabilirim. Tekrar yazmamamı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE = `Merhaba, birkaç gün önce stok, cari, kasa ve borç-alacak takibini kolaylaştıran Sitemix Ön Muhasebe hakkında yazmıştım.

Şimdi kayıt olun ve 7 gün ücretsiz deneyin:
https://www.sitemix.com.tr/on-muhasebe/kayit

Tekrar yazmamamı isterseniz “istemiyorum” demeniz yeterlidir.`;

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
  firstFollowUpDays: 3,
  finalFollowUpDays: 7,
  maxFollowUps: 2,
};
