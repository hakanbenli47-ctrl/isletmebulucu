"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Laptop, MessageCircle, Phone, RefreshCw, Save, Target, TrendingUp, UsersRound } from "lucide-react";
import { buildWhatsAppDesktopUrl, buildWhatsAppWebUrl, formatTurkishMobilePhone } from "@/lib/whatsapp";
import { isInstagramProfile } from "@/lib/google-places/website";
import type { AppSettings, LeadRecord, LeadStatus } from "@/types";

type Filter = LeadStatus | "pipeline" | "due";
type Segment = { label: string; contacts: number; replies: number; customers: number; responseRate: number };
type Stats = {
  today: number; week: number; total: number; replies: number; interested: number; customers: number; due: number;
  dailyGoal: number; conversionRate: number; pipeline: Record<string, number>; segments: Segment[];
};

const FILTERS: Array<[Filter, string]> = [
  ["contacted", "Yanıt bekleniyor"], ["replied", "2. mesaj"], ["interested", "İlgileniyor"],
  ["demo_sent", "Detay / demo"], ["due", "Planlı takip"], ["pipeline", "Tüm görüşmeler"],
  ["customer", "Müşteriler"], ["opted_out", "İletişim istemiyor"],
];

const STATUS_OPTIONS: Array<[LeadStatus, string]> = [
  ["contacted", "1. selam açıldı · cevap bekleniyor"], ["replied", "Cevap geldi · 2. mesaj açıldı"],
  ["interested", "İlgileniyor"], ["demo_sent", "Detay / demo açıldı"], ["follow_up", "Planlı takip yapıldı"],
  ["customer", "Müşteri oldu"], ["not_suitable", "Uygun değil"], ["no_whatsapp", "WhatsApp yok"],
  ["opted_out", "İletişim istemiyor"], ["archived", "Arşivlendi"],
];

const EMPTY_STATS: Stats = { today: 0, week: 0, total: 0, replies: 0, interested: 0, customers: 0, due: 0, dailyGoal: 20, conversionRate: 0, pipeline: {}, segments: [] };
const AUTO_REFRESH_MS = 15_000;

export default function SalesCenterPage() {
  const [filter, setFilter] = useState<Filter>("contacted");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => { setLoading(true); setRefreshKey((value) => value + 1); }, []);

  useEffect(() => {
    fetch("/api/settings").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSettings(data.settings);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Mesaj ayarları yüklenemedi."));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads?status=${filter}&pageSize=50`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLeads(data.leads); setStats(data.stats); setError(""); setWarning(data.warning ?? ""); setLastUpdatedAt(new Date());
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Satış kayıtları yüklenemedi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, refreshKey]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefreshKey((value) => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const goalPercent = Math.min(100, Math.round((stats.today / Math.max(1, stats.dailyGoal)) * 100));
  return (
    <section className="sales-center">
      <div className="page-heading compact"><div><p className="eyebrow">Nazik ve sıralı iletişim</p><h1>Satış Merkezi</h1><p>Önce yalnızca selam verin; cevap gelirse ikinci mesajı, ilgi oluşursa detay veya demoyu açın.</p></div><div className="auto-refresh-status" aria-live="polite"><RefreshCw size={14} /><span>15 saniyede bir otomatik güncellenir{lastUpdatedAt ? ` · Son: ${lastUpdatedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span></div></div>

      <div className="sales-kpis">
        <Kpi icon={Target} value={`${stats.today}/${stats.dailyGoal}`} label="Bugünkü ilk selam" />
        <Kpi icon={CalendarClock} value={stats.due} label="Planladığınız takip" tone={stats.due ? "warning" : undefined} />
        <Kpi icon={MessageCircle} value={stats.replies} label="Cevap veren" />
        <Kpi icon={UsersRound} value={stats.customers} label="Kazanılan müşteri" />
        <Kpi icon={TrendingUp} value={`%${stats.conversionRate}`} label="Temastan müşteriye" />
      </div>
      <div className="goal-bar"><span style={{ width: `${goalPercent}%` }} /><small>Günlük hedef %{goalPercent} tamamlandı. Mesajlar toplu gönderilmez ve cevap gelmeden tanıtım yapılmaz.</small></div>

      <div className="filter-tabs sales-tabs" role="tablist" aria-label="Satış aşaması filtresi">
        {FILTERS.map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => { setLoading(true); setFilter(value); }}>{label}{value === "due" && stats.due > 0 ? ` · ${stats.due}` : ""}</button>)}
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {warning && <div className="notice warning" role="status">{warning}</div>}
      {loading ? <div className="state"><span className="spinner" />Görüşmeler yükleniyor…</div> : leads.length ? <div className="crm-list">{leads.map((lead) => <CrmLeadCard key={lead.place_id} lead={lead} settings={settings} onUpdated={refresh} onError={setError} />)}</div> : <div className="empty-state"><strong>Bu aşamada kayıt yok</strong><span>{filter === "contacted" ? "İlk kısa selamı açtığınız işletmeler burada cevap bekler." : filter === "due" ? "Bugün için planladığınız takip bulunmuyor." : "Adayların durumunu güncelledikçe bu liste oluşur."}</span></div>}

      <section className="segment-section"><div><p className="eyebrow">Dönüşüm sinyalleri</p><h2>En verimli şehir ve sektörler</h2><p>Yeterli veri oluştuğunda, zamanınızı gerçekten cevap veren alanlara yönlendirin.</p></div>{stats.segments.length ? <div className="segment-grid">{stats.segments.map((segment) => <div key={segment.label}><strong>{segment.label}</strong><span>{segment.contacts} temas · {segment.replies} cevap · {segment.customers} müşteri</span><small>%{segment.responseRate} cevap oranı</small></div>)}</div> : <div className="segment-empty">İlk sonuçlar için yalnızca gerçekten cevap veren işletmelerde “Cevap aldım · 2. mesaj” adımını kullanın.</div>}</section>
    </section>
  );
}

function Kpi({ icon: Icon, value, label, tone }: { icon: typeof Target; value: string | number; label: string; tone?: string }) {
  return <div className={`sales-kpi ${tone ?? ""}`}><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>;
}

function CrmLeadCard({ lead, settings, onUpdated, onError }: { lead: LeadRecord; settings: AppSettings | null; onUpdated: () => void; onError: (message: string) => void }) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [followUp, setFollowUp] = useState(toLocalInput(lead.next_follow_up_at));
  const [saving, setSaving] = useState(false);
  const phone = lead.details.internationalPhone ?? lead.details.phone ?? "";
  const phoneDisplay = (formatTurkishMobilePhone(phone) ?? phone.trim()) || "Telefon yok";
  const secondMessage = lead.lead_type === "website"
    ? isInstagramProfile(lead.details.websiteUri) ? settings?.instagramMessage : settings?.websiteMessage
    : settings?.accountingMessage;
  const detailMessage = lead.lead_type === "website"
    ? isInstagramProfile(lead.details.websiteUri) ? settings?.instagramFollowUpMessage : settings?.websiteFollowUpMessage
    : settings?.accountingFollowUpMessage;
  const sequence = lead.status === "contacted"
    ? { message: secondMessage, nextStatus: "replied" as const, label: "Cevap aldım · 2. mesaj" }
    : lead.status === "interested"
      ? { message: detailMessage, nextStatus: "demo_sent" as const, label: "İlgilendi · detay mesajı" }
      : null;
  const desktopUrl = sequence?.message ? buildWhatsAppDesktopUrl(phone, sequence.message.trim()) : null;
  const webUrl = sequence?.message ? buildWhatsAppWebUrl(phone, sequence.message.trim()) : null;
  const canOpenSequence = Boolean(settings && sequence?.message && desktopUrl && webUrl && lead.status !== "opted_out");

  async function update(input: Record<string, unknown>) {
    setSaving(true); onError("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.place_id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUpdated();
    } catch (caught) { onError(caught instanceof Error ? caught.message : "Görüşme güncellenemedi."); }
    finally { setSaving(false); }
  }

  function save() {
    void update({ status, notes: notes || null, nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null });
  }

  function recordSequenceStep() {
    if (!sequence) return;
    void update({ status: sequence.nextStatus, recordContact: true, notes: notes || null });
  }

  return <article className="crm-card">
    <div className="crm-business"><div><div className="badges"><span className={`badge stage ${lead.status}`}>{statusLabel(lead.status)}</span>{lead.details.potentialScore !== undefined && <span className="badge score">{lead.details.potentialScore}/100</span>}<span className="badge type">{lead.lead_type === "website" ? "Web sitesi" : "Ön muhasebe"}</span></div><h3>{lead.details.name}</h3><a className="crm-phone" href={phone ? `tel:${phone}` : undefined}><Phone size={15} /><span>{phoneDisplay}</span></a><p>{lead.details.address}</p><small>{[lead.source_sector, lead.source_province].filter(Boolean).join(" · ") || "Kaynak bilgisi eski kayıtta yok"}</small></div><div className="crm-links"><a href={lead.details.googleMapsUri} target="_blank" rel="noreferrer">Harita <ExternalLink size={13} /></a><span>{lead.contact_count} mesaj adımı</span></div></div>
    <div className="crm-editor"><label>Aşama<select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Gerekirse takip planla<input type="datetime-local" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label><label className="crm-notes">Görüşme notu<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Verdiği cevap, ihtiyacı, kullandığı yöntem veya sonraki adım…" /></label><button className="primary-button" disabled={saving} onClick={save}><Save size={15} />{saving ? "Kaydediliyor…" : "Kaydet"}</button></div>
    <div className="crm-footer"><span>{sequenceHint(lead)}</span>{canOpenSequence ? <details className="followup-menu"><summary><MessageCircle size={15} />{sequence!.label}</summary><div><a href={desktopUrl!} onClick={recordSequenceStep}><Laptop size={15} />Masaüstü WhatsApp</a><a href={webUrl!} target="isletme-bulucu-whatsapp" onClick={recordSequenceStep}><MessageCircle size={15} />WhatsApp Web</a></div></details> : <small>{sequence && !phone ? "Geçerli cep telefonu bulunamadı" : sequence && !settings ? "Mesaj ayarları yükleniyor" : lead.status === "replied" ? "Şimdi ikinci mesaja gelecek yanıtı bekleyin; ilgi varsa aşamayı güncelleyin." : lead.status === "demo_sent" ? "Detay gönderildi; yeni mesaj için işletmenin dönüşünü bekleyin." : lead.status === "opted_out" ? "İletişim talebi nedeniyle mesaj kapalı" : "Bu aşamada otomatik mesaj önerilmez."}</small>}</div>
  </article>;
}

function sequenceHint(lead: LeadRecord) {
  if (lead.status === "contacted") return "Yalnızca gerçekten cevap geldiyse ikinci mesajı açın.";
  if (lead.status === "interested") return "İlgi açıkça belirtildiyse detay veya demo adımına geçin.";
  if (lead.next_follow_up_at) return `Planlı takip: ${formatDate(lead.next_follow_up_at)}`;
  return "Planlanmış takip yok";
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(status: LeadStatus) { return STATUS_OPTIONS.find(([value]) => value === status)?.[1] ?? "Yeni aday"; }
