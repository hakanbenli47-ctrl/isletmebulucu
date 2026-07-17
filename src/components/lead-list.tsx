"use client";

import { Archive, Ban, Camera, ChevronDown, CircleOff, ExternalLink, Laptop, MessageCircle, Smartphone, Star, UserRoundCheck } from "lucide-react";
import { FIRST_CONTACT_MESSAGE } from "@/data/defaults";
import { buildWhatsAppDesktopUrl, buildWhatsAppUrl, buildWhatsAppWebUrl } from "@/lib/whatsapp";
import { isInstagramProfile } from "@/lib/places/website";
import { formatPhoneSearch } from "@/lib/phone-search";
import type { LeadRecord, LeadStatus, LeadType } from "@/types";

export default function LeadList({ leads, leadType, loading, onContact, onStatus, contacted = false }: { leads: LeadRecord[]; leadType?: LeadType; loading: boolean; onContact?: (lead: LeadRecord) => void; onStatus: (lead: LeadRecord, status: LeadStatus) => void; contacted?: boolean }) {
  if (loading) return <div className="state"><span className="spinner" />İşletmeler yükleniyor…</div>;
  if (!leads.length) return <div className="empty-state"><strong>Gösterilecek işletme yok</strong><span>{contacted ? "Bu filtrede iletişim kaydı bulunamadı." : "Yeni bir tarama başlatarak aday listenizi oluşturun."}</span></div>;
  return (
    <div className="lead-table-wrap">
      <div className={`lead-table ${contacted ? "contacted" : ""}`} role="table">
        <div className="lead-head" role="row"><span>İşletme</span><span>Konum ve sektör</span><span>Telefon / web</span>{contacted && <span>İletişim</span>}<span className="right">İşlemler</span></div>
        {leads.map((lead) => {
          const place = lead.details;
          const isOpenData = place.dataSource === "openstreetmap" || lead.data_source === "openstreetmap" || lead.place_id.startsWith("osm:");
          const hasInstagram = isInstagramProfile(place.websiteUri);
          const phone = place.internationalPhone ?? place.phone ?? "";
          const displayPhone = formatPhoneSearch(phone);
          const whatsappUrl = buildWhatsAppUrl(phone, FIRST_CONTACT_MESSAGE);
          const desktopUrl = buildWhatsAppDesktopUrl(phone, FIRST_CONTACT_MESSAGE);
          const webUrl = buildWhatsAppWebUrl(phone, FIRST_CONTACT_MESSAGE);
          return <article className="lead-row" role="row" key={lead.place_id}>
            <div className="lead-name"><div><strong>{place.name}</strong><div className="badges">{place.isDemo && <span className="badge demo">Demo veri</span>}{place.potentialScore !== undefined && <span className={`badge ${place.potentialLevel === "high" ? "potential" : "score"}`}>{place.potentialScore}/100 potansiyel</span>}{place.openedAt && <span className="badge activity">Son 2 yılda açıldı · {place.openedAt}</span>}{leadType === "website" && <span className={`badge ${hasInstagram ? "instagram" : "warning"}`}>{hasInstagram ? "Instagram var · site yok" : "Web sitesi görünmüyor"}</span>}{hasInstagram && <span className={`badge instagram-${place.instagramActivity ?? "unverified"}`}>{instagramActivityLabel(place.instagramActivity)}</span>}</div>{place.rating !== null ? <span className="rating-line"><Star size={13} fill="currentColor" />{place.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span>· {place.userRatingCount} yorum</span></span> : <span className="rating-line">Faal açık veri kaydı · doğrulanmış açılış tarihi</span>}</div><a className="maps-source" href={place.mapUri} target="_blank" rel="noreferrer">{isOpenData ? "OpenStreetMap" : "Harita"} <ExternalLink size={13} /></a></div>
            <div className="lead-location"><strong>{place.province || "Şehir bilgisi yok"}</strong><span>{place.address}</span><small>{formatType(place.sector ?? place.primaryType)}</small>{place.potentialReason && <small className="potential-reason">{place.potentialReason}</small>}</div>
            <div className="lead-contact"><a href={phone ? `tel:${phone}` : undefined}>{displayPhone || "Telefon yok"}</a>{place.activityReason && <small>{place.activityReason}</small>}{hasInstagram ? <a className="instagram-source" href={place.websiteUri!} target="_blank" rel="noreferrer"><Camera size={13} />Instagram profilini aç</a> : <span>{leadType === "website" ? "Açık veri kaydında bağımsız site yok" : place.websiteUri ? "Web sitesi mevcut" : "Web sitesi bilgisi yok"}</span>}</div>
            {contacted && <div className="contact-date"><strong>{lead.lead_type === "website" ? "Web sitesi" : "Ön muhasebe"}</strong><span>{lead.contacted_at ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lead.contacted_at)) : "—"}</span></div>}
            <div className="lead-actions">
              {!contacted && (whatsappUrl && desktopUrl && webUrl
                ? <details className="whatsapp-menu"><summary className="whatsapp-button"><MessageCircle size={16} />1. mesaj<ChevronDown size={13} /></summary><div className="whatsapp-options"><a className="desktop-option" href={desktopUrl} onClick={() => onContact?.(lead)}><Laptop size={16} /><span><strong>Masaüstü uygulaması</strong><small>Yalnızca “Merhaba, iyi çalışmalar.”</small></span></a><a className="desktop-option" href={webUrl} target="isletme-bulucu-whatsapp" onClick={() => onContact?.(lead)}><MessageCircle size={16} /><span><strong>WhatsApp Web</strong><small>Yalnızca kısa selamı açar</small></span></a><a className="mobile-option" href={whatsappUrl} onClick={() => onContact?.(lead)}><Smartphone size={16} /><span><strong>WhatsApp’ta aç</strong><small>Yalnızca kısa selamı açar</small></span></a></div></details>
                : <button className="whatsapp-button" disabled title="Geçerli cep telefonu yok"><MessageCircle size={16} />WhatsApp</button>)}
              <a className="action-button" href={place.mapUri} target="_blank" rel="noreferrer"><ExternalLink size={15} />Harita</a>
              {hasInstagram && <a className="action-button instagram-button" href={place.websiteUri!} target="_blank" rel="noreferrer"><Camera size={15} />Instagram</a>}
              <button className="action-button danger" onClick={() => onStatus(lead, "not_suitable")}><Ban size={15} />Uygun Değil</button>
              <div className="more-actions">
                <button onClick={() => onStatus(lead, "no_whatsapp")}><CircleOff size={15} />WhatsApp Yok</button>
                <button onClick={() => onStatus(lead, "customer")}><UserRoundCheck size={15} />Müşteri Oldu</button>
                <button onClick={() => onStatus(lead, "archived")}><Archive size={15} />Arşivle</button>
                {contacted && <button onClick={() => onStatus(lead, "new")}>Adaylara Geri Taşı</button>}
              </div>
            </div>
          </article>;
        })}
      </div>
      <p className="data-attribution">İşletme verisi © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap katkıda bulunanları</a>.</p>
    </div>
  );
}

function formatType(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("tr-TR")); }
function instagramActivityLabel(activity: LeadRecord["details"]["instagramActivity"]) {
  if (activity === "active") return "Instagram aktif · son 90 gün";
  if (activity === "inactive") return "Instagram güncel görünmüyor";
  return "Instagram etkinliği doğrulanmadı";
}
