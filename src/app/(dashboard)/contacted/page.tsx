"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CalendarClock,
  ExternalLink,
  Laptop,
  ListChecks,
  MessageCircle,
  MessageCircleOff,
  Phone,
  RefreshCw,
  Save,
  Search,
  Target,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import {
  buildWhatsAppDesktopUrl,
  buildWhatsAppWebUrl,
  formatTurkishMobilePhone,
} from "@/lib/whatsapp";
import { isInstagramProfile } from "@/lib/places/website";
import { formatPhoneSearch, normalizePhoneSearch } from "@/lib/phone-search";
import type { AppSettings, LeadRecord, LeadStatus } from "@/types";

type Filter = LeadStatus | "pipeline" | "due";
type Segment = {
  label: string;
  contacts: number;
  replies: number;
  customers: number;
  responseRate: number;
};
type Stats = {
  today: number;
  week: number;
  total: number;
  replies: number;
  interested: number;
  customers: number;
  due: number;
  dailyGoal: number;
  conversionRate: number;
  pipeline: Record<string, number>;
  segments: Segment[];
};

const FILTERS: Array<[Filter, string]> = [
  ["contacted", "Yanıt bekleniyor"],
  ["replied", "2. mesaj"],
  ["interested", "İlgileniyor"],
  ["demo_sent", "Detay / demo"],
  ["due", "Planlı takip"],
  ["pipeline", "Tüm görüşmeler"],
  ["customer", "Müşteriler"],
  ["no_reply", "Cevap vermedi"],
  ["not_approved", "Onaylanmadı"],
  ["opted_out", "İletişim istemiyor"],
];

const STATUS_OPTIONS: Array<[LeadStatus, string]> = [
  ["contacted", "1. selam açıldı · cevap bekleniyor"],
  ["replied", "Cevap geldi · 2. mesaj açıldı"],
  ["interested", "İlgileniyor"],
  ["demo_sent", "Detay / demo açıldı"],
  ["follow_up", "Planlı takip yapıldı"],
  ["customer", "Müşteri oldu"],
  ["no_reply", "Cevap vermedi"],
  ["not_approved", "Onaylanmadı"],
  ["not_suitable", "Uygun değil"],
  ["no_whatsapp", "WhatsApp yok"],
  ["opted_out", "İletişim istemiyor"],
  ["archived", "Arşivlendi"],
];

const BULK_ELIGIBLE_STATUSES: LeadStatus[] = [
  "contacted",
  "replied",
  "interested",
  "demo_sent",
  "follow_up",
];
const EMPTY_STATS: Stats = {
  today: 0,
  week: 0,
  total: 0,
  replies: 0,
  interested: 0,
  customers: 0,
  due: 0,
  dailyGoal: 20,
  conversionRate: 0,
  pipeline: {},
  segments: [],
};
const AUTO_REFRESH_MS = 15_000;

export default function SalesCenterPage() {
  const [filter, setFilter] = useState<Filter>("contacted");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [notice, setNotice] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSettings(data.settings);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Mesaj ayarları yüklenemedi.",
        ),
      );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = searchedPhone
      ? `phone=${encodeURIComponent(searchedPhone)}`
      : `status=${filter}&pageSize=50`;

    fetch(`/api/leads?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLeads(data.leads);
        setStats(data.stats);
        setError("");
        setWarning(data.warning ?? "");
        setLastUpdatedAt(new Date());
        const visibleIds = new Set(
          (data.leads as LeadRecord[]).map((lead) => lead.place_id),
        );
        setSelectedIds(
          (current) =>
            new Set([...current].filter((placeId) => visibleIds.has(placeId))),
        );
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Satış kayıtları yüklenemedi.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filter, refreshKey, searchedPhone]);

  useEffect(() => {
    if (searchedPhone) return;
    const interval = window.setInterval(
      () => setRefreshKey((value) => value + 1),
      AUTO_REFRESH_MS,
    );
    return () => window.clearInterval(interval);
  }, [searchedPhone]);

  const selectableLeads = leads.filter((lead) =>
    BULK_ELIGIBLE_STATUSES.includes(lead.status),
  );
  const allVisibleSelected =
    selectableLeads.length > 0 &&
    selectableLeads.every((lead) => selectedIds.has(lead.place_id));
  const goalPercent = Math.min(
    100,
    Math.round((stats.today / Math.max(1, stats.dailyGoal)) * 100),
  );

  function submitPhoneSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizePhoneSearch(phoneInput);
    if (!normalized) {
      setError("Alan koduyla birlikte geçerli bir Türkiye telefon numarası yazın.");
      return;
    }
    setError("");
    setNotice("");
    setSelectedIds(new Set());
    setPhoneInput(formatPhoneSearch(normalized));
    setSearchedPhone(normalized);
    setLoading(true);
  }

  function clearPhoneSearch() {
    setPhoneInput("");
    setSearchedPhone("");
    setSelectedIds(new Set());
    setError("");
    setNotice("");
    setLoading(true);
  }

  function toggleVisibleSelection() {
    setSelectedIds(
      allVisibleSelected
        ? new Set()
        : new Set(selectableLeads.map((lead) => lead.place_id)),
    );
  }

  function toggleLeadSelection(placeId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(placeId);
      else next.delete(placeId);
      return next;
    });
  }

  async function bulkUpdate(status: "no_reply" | "not_approved") {
    const placeIds = [...selectedIds];
    if (!placeIds.length) return;

    setBulkSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/leads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeIds, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const label = status === "no_reply" ? "Cevap vermedi" : "Onaylanmadı";
      setNotice(`${data.updatedCount} işletme “${label}” olarak taşındı.`);
      setSelectedIds(new Set());
      refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Toplu durum güncellenemedi.",
      );
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <section className="sales-center">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">Nazik ve sıralı iletişim</p>
          <h1>Satış Merkezi</h1>
          <p>
            Önce yalnızca selam verin; cevap gelirse ikinci mesajı, ilgi oluşursa
            detay veya demoyu açın.
          </p>
        </div>
        <div className="auto-refresh-status" aria-live="polite">
          <RefreshCw size={14} />
          <span>
            {searchedPhone
              ? "Telefon sonucu gösteriliyor"
              : "15 saniyede bir otomatik güncellenir"}
            {lastUpdatedAt
              ? ` · Son: ${lastUpdatedAt.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : ""}
          </span>
        </div>
      </div>

      <div className="sales-kpis">
        <Kpi
          icon={Target}
          value={`${stats.today}/${stats.dailyGoal}`}
          label="Bugünkü ilk selam"
        />
        <Kpi
          icon={CalendarClock}
          value={stats.due}
          label="Planladığınız takip"
          tone={stats.due ? "warning" : undefined}
        />
        <Kpi icon={MessageCircle} value={stats.replies} label="Cevap veren" />
        <Kpi
          icon={UsersRound}
          value={stats.customers}
          label="Kazanılan müşteri"
        />
        <Kpi
          icon={TrendingUp}
          value={`%${stats.conversionRate}`}
          label="Temastan müşteriye"
        />
      </div>
      <div className="goal-bar">
        <span style={{ width: `${goalPercent}%` }} />
        <small>
          Günlük hedef %{goalPercent} tamamlandı. Mesajlar toplu gönderilmez ve
          cevap gelmeden tanıtım yapılmaz.
        </small>
      </div>

      <div className="sales-workbench">
        <form className="crm-phone-search" onSubmit={submitPhoneSearch}>
          <label htmlFor="sales-phone-search">Numarayla işletme bul</label>
          <div>
            <Search size={17} aria-hidden="true" />
            <input
              id="sales-phone-search"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder="Örn. 0532 444 18 07"
              aria-describedby="sales-phone-help"
            />
            {searchedPhone && (
              <button
                type="button"
                className="phone-search-clear"
                onClick={clearPhoneSearch}
                aria-label="Telefon aramasını temizle"
              >
                <X size={16} />
              </button>
            )}
            <button className="primary-button" disabled={loading}>
              <Search size={16} />
              {loading && searchedPhone ? "Aranıyor…" : "İşletmeyi bul"}
            </button>
          </div>
          <small id="sales-phone-help">
            Aşaması ne olursa olsun bu numaraya ait satış kaydını getirir.
          </small>
        </form>

        <div className="bulk-outcome-tools" aria-label="Toplu durum işlemleri">
          <div>
            <strong>Kalanları toplu ayır</strong>
            <span>
              {selectedIds.size
                ? `${selectedIds.size} işletme seçildi`
                : "Önce görünen işletmeleri seçin"}
            </span>
          </div>
          <button
            className="action-button select-visible-button"
            onClick={toggleVisibleSelection}
            disabled={!selectableLeads.length || bulkSaving}
          >
            <ListChecks size={16} />
            {allVisibleSelected ? "Seçimi kaldır" : "Görünenlerin tümünü seç"}
          </button>
          <button
            className="action-button bulk-no-reply"
            onClick={() => void bulkUpdate("no_reply")}
            disabled={!selectedIds.size || bulkSaving}
          >
            <MessageCircleOff size={16} />
            Cevap vermedi
          </button>
          <button
            className="action-button bulk-not-approved"
            onClick={() => void bulkUpdate("not_approved")}
            disabled={!selectedIds.size || bulkSaving}
          >
            <Ban size={16} />
            Onaylanmadı
          </button>
        </div>
      </div>

      <div
        className="filter-tabs sales-tabs"
        role="tablist"
        aria-label="Satış aşaması filtresi"
      >
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={!searchedPhone && filter === value}
            className={!searchedPhone && filter === value ? "active" : ""}
            onClick={() => {
              setLoading(true);
              setPhoneInput("");
              setSearchedPhone("");
              setSelectedIds(new Set());
              setFilter(value);
            }}
          >
            {label}
            {value === "due" && stats.due > 0 ? ` · ${stats.due}` : ""}
          </button>
        ))}
      </div>

      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {warning && (
        <div className="notice warning" role="status">
          {warning}
        </div>
      )}

      {loading ? (
        <div className="state">
          <span className="spinner" />
          {searchedPhone ? "Numara aranıyor…" : "Görüşmeler yükleniyor…"}
        </div>
      ) : leads.length ? (
        <div className="crm-list">
          {leads.map((lead) => {
            const selectable = BULK_ELIGIBLE_STATUSES.includes(lead.status);
            return (
              <CrmLeadCard
                key={`${lead.place_id}-${lead.status}`}
                lead={lead}
                settings={settings}
                selectable={selectable}
                selected={selectedIds.has(lead.place_id)}
                onSelectedChange={(selected) =>
                  toggleLeadSelection(lead.place_id, selected)
                }
                onUpdated={refresh}
                onError={setError}
              />
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <strong>
            {searchedPhone ? "Bu numara satış kayıtlarında bulunamadı" : "Bu aşamada kayıt yok"}
          </strong>
          <span>
            {searchedPhone
              ? "Numarayı alan koduyla birlikte kontrol edin. İşletme henüz adaylara eklenmediyse satış kaydı oluşmamış olabilir."
              : filter === "contacted"
                ? "İlk kısa selamı açtığınız işletmeler burada cevap bekler."
                : filter === "due"
                  ? "Bugün için planladığınız takip bulunmuyor."
                  : "Adayların durumunu güncelledikçe bu liste oluşur."}
          </span>
        </div>
      )}

      <section className="segment-section">
        <div>
          <p className="eyebrow">Dönüşüm sinyalleri</p>
          <h2>En verimli şehir ve sektörler</h2>
          <p>
            Yeterli veri oluştuğunda, zamanınızı gerçekten cevap veren alanlara
            yönlendirin.
          </p>
        </div>
        {stats.segments.length ? (
          <div className="segment-grid">
            {stats.segments.map((segment) => (
              <div key={segment.label}>
                <strong>{segment.label}</strong>
                <span>
                  {segment.contacts} temas · {segment.replies} cevap ·{" "}
                  {segment.customers} müşteri
                </span>
                <small>%{segment.responseRate} cevap oranı</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="segment-empty">
            İlk sonuçlar için yalnızca gerçekten cevap veren işletmelerde
            “Cevap aldım · 2. mesaj” adımını kullanın.
          </div>
        )}
      </section>
    </section>
  );
}

function Kpi({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Target;
  value: string | number;
  label: string;
  tone?: string;
}) {
  return (
    <div className={`sales-kpi ${tone ?? ""}`}>
      <Icon size={18} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CrmLeadCard({
  lead,
  settings,
  selectable,
  selected,
  onSelectedChange,
  onUpdated,
  onError,
}: {
  lead: LeadRecord;
  settings: AppSettings | null;
  selectable: boolean;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onUpdated: () => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [followUp, setFollowUp] = useState(toLocalInput(lead.next_follow_up_at));
  const [saving, setSaving] = useState(false);
  const phone = lead.details.internationalPhone ?? lead.details.phone ?? "";
  const phoneDisplay =
    (formatTurkishMobilePhone(phone) ?? phone.trim()) || "Telefon yok";
  const secondMessage =
    lead.lead_type === "website"
      ? isInstagramProfile(lead.details.websiteUri)
        ? settings?.instagramMessage
        : settings?.websiteMessage
      : settings?.accountingMessage;
  const detailMessage =
    lead.lead_type === "website"
      ? isInstagramProfile(lead.details.websiteUri)
        ? settings?.instagramFollowUpMessage
        : settings?.websiteFollowUpMessage
      : settings?.accountingFollowUpMessage;
  const sequence =
    lead.status === "contacted"
      ? {
          message: secondMessage,
          nextStatus: "replied" as const,
          label: "Cevap aldım · 2. mesaj",
        }
      : lead.status === "interested"
        ? {
            message: detailMessage,
            nextStatus: "demo_sent" as const,
            label: "İlgilendi · detay mesajı",
          }
        : null;
  const desktopUrl = sequence?.message
    ? buildWhatsAppDesktopUrl(phone, sequence.message.trim())
    : null;
  const webUrl = sequence?.message
    ? buildWhatsAppWebUrl(phone, sequence.message.trim())
    : null;
  const canOpenSequence = Boolean(
    settings &&
      sequence?.message &&
      desktopUrl &&
      webUrl &&
      lead.status !== "opted_out",
  );

  async function update(input: Record<string, unknown>) {
    setSaving(true);
    onError("");
    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(lead.place_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUpdated();
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "Görüşme güncellenemedi.",
      );
    } finally {
      setSaving(false);
    }
  }

  function save() {
    void update({
      status,
      notes: notes || null,
      nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null,
    });
  }

  function recordSequenceStep() {
    if (!sequence) return;
    void update({
      status: sequence.nextStatus,
      recordContact: true,
      notes: notes || null,
    });
  }

  return (
    <article className={`crm-card ${selected ? "selected" : ""}`}>
      <div className="crm-business">
        <div>
          <div className="crm-card-topline">
            <div className="badges">
              <span className={`badge stage ${lead.status}`}>
                {statusLabel(lead.status)}
              </span>
              {lead.details.potentialScore !== undefined && (
                <span className="badge score">
                  {lead.details.potentialScore}/100
                </span>
              )}
              <span className="badge type">
                {lead.lead_type === "website" ? "Web sitesi" : "Ön muhasebe"}
              </span>
            </div>
            {selectable && (
              <label className="crm-select">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => onSelectedChange(event.target.checked)}
                />
                <span>Toplu işlem için seç</span>
              </label>
            )}
          </div>
          <h3>{lead.details.name}</h3>
          <a className="crm-phone" href={phone ? `tel:${phone}` : undefined}>
            <Phone size={15} />
            <span>{phoneDisplay}</span>
          </a>
          <p>{lead.details.address}</p>
          <small>
            {[lead.source_sector, lead.source_province]
              .filter(Boolean)
              .join(" · ") || "Kaynak bilgisi eski kayıtta yok"}
          </small>
        </div>
        <div className="crm-links">
          <a href={lead.details.mapUri} target="_blank" rel="noreferrer">
            Harita <ExternalLink size={13} />
          </a>
          <span>{lead.contact_count} mesaj adımı</span>
        </div>
      </div>
      <div className="crm-editor">
        <label>
          Aşama
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gerekirse takip planla
          <input
            type="datetime-local"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
          />
        </label>
        <label className="crm-notes">
          Görüşme notu
          <textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Verdiği cevap, ihtiyacı, kullandığı yöntem veya sonraki adım…"
          />
        </label>
        <button className="primary-button" disabled={saving} onClick={save}>
          <Save size={15} />
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
      <div className="crm-footer">
        <span>{sequenceHint(lead)}</span>
        {canOpenSequence ? (
          <details className="followup-menu">
            <summary>
              <MessageCircle size={15} />
              {sequence!.label}
            </summary>
            <div>
              <a href={desktopUrl!} onClick={recordSequenceStep}>
                <Laptop size={15} />
                Masaüstü WhatsApp
              </a>
              <a
                href={webUrl!}
                target="isletme-bulucu-whatsapp"
                onClick={recordSequenceStep}
              >
                <MessageCircle size={15} />
                WhatsApp Web
              </a>
            </div>
          </details>
        ) : (
          <small>
            {sequence && !phone
              ? "Geçerli cep telefonu bulunamadı"
              : sequence && !settings
                ? "Mesaj ayarları yükleniyor"
                : lead.status === "replied"
                  ? "Şimdi ikinci mesaja gelecek yanıtı bekleyin; ilgi varsa aşamayı güncelleyin."
                  : lead.status === "demo_sent"
                    ? "Detay gönderildi; yeni mesaj için işletmenin dönüşünü bekleyin."
                    : lead.status === "opted_out"
                      ? "İletişim talebi nedeniyle mesaj kapalı"
                      : "Bu aşamada otomatik mesaj önerilmez."}
          </small>
        )}
      </div>
    </article>
  );
}

function sequenceHint(lead: LeadRecord) {
  if (lead.status === "contacted")
    return "Yalnızca gerçekten cevap geldiyse ikinci mesajı açın.";
  if (lead.status === "interested")
    return "İlgi açıkça belirtildiyse detay veya demo adımına geçin.";
  if (lead.status === "no_reply") return "İşletmeden henüz cevap alınamadı.";
  if (lead.status === "not_approved") return "Teklif veya çalışma onaylanmadı.";
  if (lead.next_follow_up_at)
    return `Planlı takip: ${formatDate(lead.next_follow_up_at)}`;
  return "Planlanmış takip yok";
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: LeadStatus) {
  return STATUS_OPTIONS.find(([value]) => value === status)?.[1] ?? "Yeni aday";
}
