"use client";

import { useState } from "react";
import { Archive, Ban, Camera, ChevronDown, CircleOff, ExternalLink, Laptop, MessageCircle, Smartphone, Star, UserRoundCheck } from "lucide-react";
import { FIRST_CONTACT_MESSAGE } from "@/data/defaults";
import { buildWhatsAppDesktopUrl, buildWhatsAppUrl, buildWhatsAppWebUrl } from "@/lib/whatsapp";
import { openingRecencyStatus } from "@/lib/places/activity";
import { isInstagramProfile } from "@/lib/places/website";
import { formatPhoneSearch } from "@/lib/phone-search";
import type { LeadRecord, LeadStatus, LeadType } from "@/types";

export default function LeadList({ leads, leadType, loading, onContact, onStatus, contacted = false }: { leads: LeadRecord[]; leadType?: LeadType; loading: boolean; onContact?: (lead: LeadRecord) => void; onStatus: (lead: LeadRecord, status: LeadStatus) => void; contacted?: boolean }) {
  const [checkingLeadId, setCheckingLeadId] = useState<string | null>(null);
  if (loading) return <div className="state"><span className="spinner" />İşletmeler yükleniyor…</div>;
  if (!leads.length) return <div className="empty-state"><strong>Gösterilecek işletme yok</strong><span>{contacted ? "Bu filtrede iletişim kaydı bulunamadı." : "Yeni bir tarama başlatarak aday listenizi oluşturun."}</span></div>;
  return (
    <div className="lead-table-wrap">
      <div className={`lead-table ${contacted ? "contacted" : ""}`} role="table">
        <div className="lead-head" role="row"><span>İşletme</span><span>Konum ve sektör</span><span>Telefon / web</span>{contacted && <span>İletişim</span>}<span className="right">İşlemler</span></div>
        {leads.map((lead) => {
          const place = lead.details;
          const sourceLabel = place.dataSource === "overture" || lead.place_id.startsWith("overture:")
            ? "Overture Maps"
            : place.dataSource === "openstreetmap" || lead.data_source === "openstreetmap" || lead.place_id.startsWith("osm:")
              ? "OpenStreetMap"
              : "Harita";
          const hasInstagram = isInstagramProfile(place.websiteUri);
          const phone = place.internationalPhone ?? place.phone ?? "";
          const displayPhone = formatPhoneSearch(phone);
          const whatsappUrl = buildWhatsAppUrl(phone, FIRST_CONTACT_MESSAGE);
          const desktopUrl = buildWhatsAppDesktopUrl(phone, FIRST_CONTACT_MESSAGE);
          const webUrl = buildWhatsAppWebUrl(phone, FIRST_CONTACT_MESSAGE);
          const openingStatus = openingRecencyStatus(place.openedAt);
          return <article className="lead-row" role="row" key={lead.place_id}>
            <div className="lead-name"><div><strong>{place.name}</strong><div className="badges">{place.isDemo && <span className="badge demo">Demo veri</span>}{place.potentialScore !== undefined && <span className={`badge ${place.potentialLevel === "high" ? "potential" : "score"}`}>{place.potentialScore}/100 potansiyel</span>}{openingStatus === "recent" ? <span className="badge activity">Son 2 yılda açıldı · {place.openedAt}</span> : openingStatus === "unknown" ? <span className="badge activity-unverified">Açılış tarihi kayıtlı değil</span> : <span className="badge warning">Açılış tarihi eski</span>}<span className={`badge ${isExplicitWhatsApp(place.whatsappEvidence) ? "whatsapp-explicit" : "whatsapp-pending"}`}>{whatsappEvidenceLabel(place.whatsappEvidence)}</span>{leadType === "website" && <span className={`badge ${hasInstagram ? "instagram" : "warning"}`}>{hasInstagram ? "Instagram var · site yok" : "Web sitesi görünmüyor"}</span>}{hasInstagram && <span className={`badge instagram-${place.instagramActivity ?? "unverified"}`}>{instagramActivityLabel(place.instagramActivity)}</span>}</div>{place.rating !== null ? <span className="rating-line"><Star size={13} fill="currentColor" />{place.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span>· {place.userRatingCount} yorum</span></span> : <span className="rating-line">{openingStatus === "recent" ? "Faal işletme kaydı · doğrulanmış yeni açılış" : "Faal işletme kaydı · kapanış işareti yok"}</span>}</div><a className="maps-source" href={place.mapUri} target="_blank" rel="noreferrer">{sourceLabel} <ExternalLink size={13} /></a></div>
            <div className="lead-location"><strong>{place.province || "Şehir bilgisi yok"}</strong><span>{place.address}</span><small>{formatType(place.sector ?? place.primaryType)}</small>{place.potentialReason && <small className="potential-reason">{place.potentialReason}</small>}</div>
            <div className="lead-contact"><a href={phone ? `tel:${phone}` : undefined}>{displayPhone || "Telefon yok"}</a>{place.whatsappReason && <small className="whatsapp-reason">{place.whatsappReason}</small>}{place.activityReason && <small>{place.activityReason}</small>}{hasInstagram ? <a className="instagram-source" href={place.websiteUri!} target="_blank" rel="noreferrer"><Camera size={13} />Instagram profilini aç</a> : <span>{leadType === "website" ? "Açık veri kaydında bağımsız site yok" : place.websiteUri ? "Web sitesi mevcut" : "Web sitesi bilgisi yok"}</span>}</div>
            {contacted && <div className="contact-date"><strong>{lead.lead_type === "website" ? "Web sitesi" : "Ön muhasebe"}</strong><span>{lead.contacted_at ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lead.contacted_at)) : "—"}</span></div>}
            <div className="lead-actions">
              {!contacted && (whatsappUrl && desktopUrl && webUrl
                ? <details className="whatsapp-menu"><summary className="whatsapp-button"><MessageCircle size={16} />WhatsApp kontrol<ChevronDown size={13} /></summary><div className="whatsapp-options"><a className="desktop-option" href={desktopUrl} onClick={() => setCheckingLeadId(lead.place_id)}><Laptop size={16} /><span><strong>Masaüstünde kontrol et</strong><small>Sohbet açılırsa aşağıdan onaylayın</small></span></a><a className="desktop-option" href={webUrl} target="isletme-bulucu-whatsapp" onClick={() => setCheckingLeadId(lead.place_id)}><MessageCircle size={16} /><span><strong>WhatsApp Web’de kontrol et</strong><small>Sohbet açılırsa aşağıdan onaylayın</small></span></a><a className="mobile-option" href={whatsappUrl} onClick={() => setCheckingLeadId(lead.place_id)}><Smartphone size={16} /><span><strong>WhatsApp’ta kontrol et</strong><small>Sohbet açılırsa aşağıdan onaylayın</small></span></a></div></details>
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
              {!contacted && checkingLeadId === lead.place_id && <div className="whatsapp-check-result" role="status"><strong>Sohbet ekranı açıldı mı?</strong><button className="whatsapp-confirm" onClick={() => { setCheckingLeadId(null); onContact?.(lead); }}><MessageCircle size={14} />Evet, mesaj ekranı açıldı</button><button className="whatsapp-reject" onClick={() => { setCheckingLeadId(null); onStatus(lead, "no_whatsapp"); }}><CircleOff size={14} />Hayır, WhatsApp yok</button></div>}
            </div>
          </article>;
        })}
      </div>
      <p className="data-attribution">İşletme verisi © <a href="https://overturemaps.org/" target="_blank" rel="noreferrer">Overture Maps Foundation</a> ve <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap katkıda bulunanları</a>.</p>
    </div>
  );
}

function formatType(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("tr-TR")); }
function instagramActivityLabel(activity: LeadRecord["details"]["instagramActivity"]) {
  if (activity === "active") return "Instagram aktif · son 90 gün";
  if (activity === "inactive") return "Instagram güncel görünmüyor";
  return "Instagram etkinliği doğrulanmadı";
}

function isExplicitWhatsApp(evidence: LeadRecord["details"]["whatsappEvidence"]) {
  return evidence === "explicit_tag" || evidence === "explicit_link";
}

function whatsappEvidenceLabel(evidence: LeadRecord["details"]["whatsappEvidence"]) {
  return isExplicitWhatsApp(evidence) ? "WhatsApp açık veride işaretli" : "WhatsApp canlı kontrol bekliyor";
}
