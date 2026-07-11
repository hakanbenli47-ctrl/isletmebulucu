"use client";

import { Archive, Ban, ChevronDown, CircleOff, ExternalLink, Laptop, MessageCircle, Smartphone, Star, UserRoundCheck } from "lucide-react";
import { buildWhatsAppDesktopUrl, buildWhatsAppUrl, buildWhatsAppWebUrl, personalizeWhatsAppMessage } from "@/lib/whatsapp";
import type { LeadRecord, LeadStatus, LeadType } from "@/types";

export default function LeadList({ leads, leadType, loading, whatsappMessage = "", onContact, onStatus, contacted = false }: { leads: LeadRecord[]; leadType?: LeadType; loading: boolean; whatsappMessage?: string; onContact?: (lead: LeadRecord) => void; onStatus: (lead: LeadRecord, status: LeadStatus) => void; contacted?: boolean }) {
  if (loading) return <div className="state"><span className="spinner" />İşletmeler yükleniyor…</div>;
  if (!leads.length) return <div className="empty-state"><strong>Gösterilecek işletme yok</strong><span>{contacted ? "Bu filtrede iletişim kaydı bulunamadı." : "Yeni bir tarama başlatarak aday listenizi oluşturun."}</span></div>;
  return (
    <div className="lead-table-wrap">
      <div className={`lead-table ${contacted ? "contacted" : ""}`} role="table">
        <div className="lead-head" role="row"><span>İşletme</span><span>Konum ve sektör</span><span>Telefon / web</span>{contacted && <span>İletişim</span>}<span className="right">İşlemler</span></div>
        {leads.map((lead) => {
          const place = lead.details;
          const personalizedMessage = personalizeWhatsAppMessage(whatsappMessage, place.name);
          const phone = place.internationalPhone ?? place.phone ?? "";
          const whatsappUrl = buildWhatsAppUrl(phone, personalizedMessage);
          const desktopUrl = buildWhatsAppDesktopUrl(phone, personalizedMessage);
          const webUrl = buildWhatsAppWebUrl(phone, personalizedMessage);
          return <article className="lead-row" role="row" key={lead.place_id}>
            <div className="lead-name"><div><strong>{place.name}</strong><div className="badges">{place.isDemo && <span className="badge demo">Demo veri</span>}{place.potentialScore !== undefined && <span className={`badge ${place.potentialLevel === "high" ? "potential" : "score"}`}>{place.potentialScore}/100 potansiyel</span>}{leadType === "website" && <span className="badge warning">Web sitesi görünmüyor</span>}</div><span className="rating-line"><Star size={13} fill="currentColor" />{place.rating?.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? "—"}<span>· {place.userRatingCount} yorum</span></span></div><a className="maps-source" href={place.googleMapsUri} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={13} /></a></div>
            <div className="lead-location"><strong>{place.province || "Şehir bilgisi yok"}</strong><span>{place.address}</span><small>{formatType(place.sector ?? place.primaryType)}</small>{place.potentialReason && <small className="potential-reason">{place.potentialReason}</small>}</div>
            <div className="lead-contact"><a href={place.phone ? `tel:${place.phone}` : undefined}>{place.phone ?? place.internationalPhone ?? "Telefon yok"}</a><span>{leadType === "website" ? "Google profilinde bağımsız site yok" : place.websiteUri ? "Web sitesi mevcut" : "Web sitesi bilgisi yok"}</span></div>
            {contacted && <div className="contact-date"><strong>{lead.lead_type === "website" ? "Web sitesi" : "Ön muhasebe"}</strong><span>{lead.contacted_at ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lead.contacted_at)) : "—"}</span></div>}
            <div className="lead-actions">
              {!contacted && (whatsappUrl && desktopUrl && webUrl
                ? <details className="whatsapp-menu"><summary className="whatsapp-button"><MessageCircle size={16} />WhatsApp<ChevronDown size={13} /></summary><div className="whatsapp-options"><a className="desktop-option" href={desktopUrl} onClick={() => onContact?.(lead)}><Laptop size={16} /><span><strong>Masaüstü uygulaması</strong><small>Yeni sekme açmaz</small></span></a><a className="desktop-option" href={webUrl} target="isletme-bulucu-whatsapp" onClick={() => onContact?.(lead)}><MessageCircle size={16} /><span><strong>WhatsApp Web</strong><small>Tek çalışma sekmesi</small></span></a><a className="mobile-option" href={whatsappUrl} onClick={() => onContact?.(lead)}><Smartphone size={16} /><span><strong>WhatsApp’ta aç</strong><small>Telefon uygulaması</small></span></a></div></details>
                : <button className="whatsapp-button" disabled title="Geçerli cep telefonu yok"><MessageCircle size={16} />WhatsApp</button>)}
              <a className="action-button" href={place.googleMapsUri} target="_blank" rel="noreferrer"><ExternalLink size={15} />Harita</a>
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
      <p className="google-attribution">İşletme bilgileri Google Maps kaynağından canlı olarak gösterilir.</p>
    </div>
  );
}

function formatType(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("tr-TR")); }
