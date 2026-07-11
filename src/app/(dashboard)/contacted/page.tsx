"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Laptop, MessageCircle, Save, Target, TrendingUp, UsersRound } from "lucide-react";
import { buildWhatsAppDesktopUrl, buildWhatsAppWebUrl, personalizeWhatsAppMessage } from "@/lib/whatsapp";
import type { AppSettings, LeadRecord, LeadStatus } from "@/types";

type Filter = LeadStatus | "pipeline" | "due";
type Segment = { label: string; contacts: number; replies: number; customers: number; responseRate: number };
type Stats = {
  today: number; week: number; total: number; replies: number; interested: number; customers: number; due: number;
  dailyGoal: number; conversionRate: number; pipeline: Record<string, number>; segments: Segment[];
};

const FILTERS: Array<[Filter, string]> = [
  ["due", "Bugün takip"], ["pipeline", "Aktif görüşmeler"], ["contacted", "İlk mesaj"], ["replied", "Cevap verdi"],
  ["interested", "İlgileniyor"], ["demo_sent", "Demo/teklif"], ["follow_up", "Takip edildi"], ["customer", "Müşteriler"], ["opted_out", "İletişim istemiyor"],
];

const STATUS_OPTIONS: Array<[LeadStatus, string]> = [
  ["contacted", "İlk mesaj gönderildi"], ["replied", "Cevap verdi"], ["interested", "İlgileniyor"],
  ["demo_sent", "Demo / teklif gönderildi"], ["follow_up", "Takip mesajı gönderildi"], ["customer", "Müşteri oldu"],
  ["not_suitable", "Uygun değil"], ["no_whatsapp", "WhatsApp yok"], ["opted_out", "İletişim istemiyor"], ["archived", "Arşivlendi"],
];

const EMPTY_STATS: Stats = { today: 0, week: 0, total: 0, replies: 0, interested: 0, customers: 0, due: 0, dailyGoal: 20, conversionRate: 0, pipeline: {}, segments: [] };

export default function SalesCenterPage() {
  const [filter, setFilter] = useState<Filter>("due");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

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
        setLeads(data.leads); setStats(data.stats); setError(""); setWarning(data.warning ?? "");
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Satış kayıtları yüklenemedi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, refreshKey]);

  const goalPercent = Math.min(100, Math.round((stats.today / Math.max(1, stats.dailyGoal)) * 100));
  return (
    <section className="sales-center">
      <div className="page-heading compact"><div><p className="eyebrow">Reklamsız müşteri ağı</p><h1>Satış Merkezi</h1><p>Adayı bulduktan müşteriye dönüşene kadar her görüşmeyi tek yerde yönetin.</p></div></div>

      <div className="sales-kpis">
        <Kpi icon={Target} value={`${stats.today}/${stats.dailyGoal}`} label="Bugünkü kaliteli temas" />
        <Kpi icon={CalendarClock} value={stats.due} label="Takibi gelen görüşme" tone={stats.due ? "warning" : undefined} />
        <Kpi icon={MessageCircle} value={stats.replies} label="Cevap veren" />
        <Kpi icon={UsersRound} value={stats.customers} label="Kazanılan müşteri" />
        <Kpi icon={TrendingUp} value={`%${stats.conversionRate}`} label="Temastan müşteriye" />
      </div>
      <div className="goal-bar"><span style={{ width: `${goalPercent}%` }} /><small>Günlük hedef %{goalPercent} tamamlandı. Kaliteyi korumak için toplu gönderim yapılmaz.</small></div>

      <div className="filter-tabs sales-tabs" role="tablist" aria-label="Satış aşaması filtresi">
        {FILTERS.map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => { setLoading(true); setFilter(value); }}>{label}{value === "due" && stats.due > 0 ? ` · ${stats.due}` : ""}</button>)}
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {warning && <div className="notice warning" role="status">{warning}</div>}
      {loading ? <div className="state"><span className="spinner" />Görüşmeler yükleniyor…</div> : leads.length ? <div className="crm-list">{leads.map((lead) => <CrmLeadCard key={lead.place_id} lead={lead} settings={settings} onUpdated={refresh} onError={setError} />)}</div> : <div className="empty-state"><strong>Bu aşamada kayıt yok</strong><span>{filter === "due" ? "Bugün için gecikmiş takip bulunmuyor." : "Adayların durumunu güncelledikçe bu liste oluşur."}</span></div>}

      <section className="segment-section"><div><p className="eyebrow">Dönüşüm sinyalleri</p><h2>En verimli şehir ve sektörler</h2><p>Yeterli veri oluştuğunda, zamanınızı cevap veren alanlara yönlendirin.</p></div>{stats.segments.length ? <div className="segment-grid">{stats.segments.map((segment) => <div key={segment.label}><strong>{segment.label}</strong><span>{segment.contacts} temas · {segment.replies} cevap · {segment.customers} müşteri</span><small>%{segment.responseRate} cevap oranı</small></div>)}</div> : <div className="segment-empty">İlk sonuçlar için mesajlara gelen cevapları “Cevap verdi” olarak işaretleyin.</div>}</section>
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
  const template = lead.lead_type === "website" ? settings?.websiteFollowUpMessage : settings?.accountingFollowUpMessage;
  const message = personalizeWhatsAppMessage(template ?? "Merhaba, önceki mesajımla ilgili dönüşünüzü bekliyorum.", lead.details.name);
  const desktopUrl = buildWhatsAppDesktopUrl(phone, message);
  const webUrl = buildWhatsAppWebUrl(phone, message);
  const followUpsSent = Math.max(0, lead.contact_count - 1);
  const canFollowUp = Boolean(desktopUrl && webUrl && settings && followUpsSent < settings.maxFollowUps && lead.status !== "opted_out");

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
    update({ status, notes: notes || null, nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null });
  }

  function recordFollowUp() {
    void update({ status: "follow_up", recordContact: true, notes: notes || null });
  }

  return <article className="crm-card">
    <div className="crm-business"><div><div className="badges"><span className={`badge stage ${lead.status}`}>{statusLabel(lead.status)}</span>{lead.details.potentialScore !== undefined && <span className="badge score">{lead.details.potentialScore}/100</span>}<span className="badge type">{lead.lead_type === "website" ? "Web sitesi" : "Ön muhasebe"}</span></div><h3>{lead.details.name}</h3><p>{lead.details.address}</p><small>{[lead.source_sector, lead.source_province].filter(Boolean).join(" · ") || "Kaynak bilgisi eski kayıtta yok"}</small></div><div className="crm-links"><a href={lead.details.googleMapsUri} target="_blank" rel="noreferrer">Harita <ExternalLink size={13} /></a><span>{lead.contact_count} temas</span></div></div>
    <div className="crm-editor"><label>Aşama<select value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Sonraki takip<input type="datetime-local" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label><label className="crm-notes">Görüşme notu<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="İhtiyaç, fiyat, karar verici veya konuşma sonucu…" /></label><button className="primary-button" disabled={saving} onClick={save}><Save size={15} />{saving ? "Kaydediliyor…" : "Kaydet"}</button></div>
    <div className="crm-footer"><span>{lead.next_follow_up_at ? `Takip: ${formatDate(lead.next_follow_up_at)}` : "Planlanmış takip yok"}</span>{canFollowUp ? <details className="followup-menu"><summary><MessageCircle size={15} />Takip mesajı</summary><div><a href={desktopUrl!} onClick={recordFollowUp}><Laptop size={15} />Masaüstü WhatsApp</a><a href={webUrl!} target="isletme-bulucu-whatsapp" onClick={recordFollowUp}><MessageCircle size={15} />WhatsApp Web</a></div></details> : <small>{lead.status === "opted_out" ? "İletişim talebi nedeniyle mesaj kapalı" : settings && followUpsSent >= settings.maxFollowUps ? "Takip sınırına ulaşıldı" : "Geçerli telefon bulunamadı"}</small>}</div>
  </article>;
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function statusLabel(status: LeadStatus) { return STATUS_OPTIONS.find(([value]) => value === status)?.[1] ?? "Yeni aday"; }
