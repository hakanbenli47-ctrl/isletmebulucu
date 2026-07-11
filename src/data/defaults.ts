import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "./sectors";
import type { AppSettings } from "@/types";

export const DEFAULT_WEBSITE_MESSAGE = `Merhaba, iyi çalışmalar.

Google işletme profilinizde bağımsız bir web sitesi göremedim. İşletmeniz için mobil uyumlu, WhatsApp ve harita bağlantılı ücretsiz bir örnek ana sayfa hazırlayabilirim.

Anahtar teslim örneği görmek ister misiniz?

Sitemix · www.sitemix.com.tr
Bu konuda tekrar yazmamamızı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_ACCOUNTING_MESSAGE = `Merhaba, iyi çalışmalar.

Toptan ve stoklu çalışan işletmeler için cari, stok, kasa ve borç-alacak takibini kolaylaştıran Sitemix Ön Muhasebe’yi geliştiriyoruz.

7 günlük ücretsiz deneme bağlantısını paylaşmamı ister misiniz?

Sitemix
Bu konuda tekrar yazmamamızı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_WEBSITE_FOLLOW_UP_MESSAGE = `Merhaba, birkaç gün önce işletmeniz için ücretsiz anahtar teslim web sitesi örneği hakkında yazmıştım. Uygunsanız kısa bir örnek paylaşabilirim. Tekrar yazmamamı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE = `Merhaba, birkaç gün önce Sitemix Ön Muhasebe'nin 7 günlük ücretsiz denemesi hakkında yazmıştım. Uygunsanız kısa tanıtım bağlantısını paylaşabilirim. Tekrar yazmamamı isterseniz “istemiyorum” demeniz yeterlidir.`;

export const DEFAULT_SETTINGS: AppSettings = {
  resultsPerSearch: 10,
  dailyContactGoal: 20,
  websiteSectors: [...WEBSITE_SECTORS],
  accountingSectors: [...ACCOUNTING_SECTORS],
  websiteMessage: DEFAULT_WEBSITE_MESSAGE,
  accountingMessage: DEFAULT_ACCOUNTING_MESSAGE,
  websiteFollowUpMessage: DEFAULT_WEBSITE_FOLLOW_UP_MESSAGE,
  accountingFollowUpMessage: DEFAULT_ACCOUNTING_FOLLOW_UP_MESSAGE,
  firstFollowUpDays: 3,
  finalFollowUpDays: 7,
  maxFollowUps: 2,
};
