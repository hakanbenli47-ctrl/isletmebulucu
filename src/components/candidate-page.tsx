"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, Camera, MapPin, RotateCcw, Search, Undo2 } from "lucide-react";
import { useLeads } from "@/hooks/use-leads";
import LeadList from "@/components/lead-list";
import { TURKIYE_ILLERI } from "@/data/turkiye-illeri";
import { assessPotential, orderPotentialPlaces } from "@/lib/places/potential";
import { isInstagramProfile, socialProfileType } from "@/lib/places/website";
import type { AppSettings, LeadQuality, LeadRecord, LeadStatus, LeadType } from "@/types";

type PresenceFilter = "all" | "instagram" | "no_social";

export default function CandidatePage({ leadType, title, description }: { leadType: LeadType; title: string; description: string }) {
  const { leads, setLeads, total, setTotal, loading, loadingMore, hasMore, loadMore, error, setError, warning } = useLeads(leadType);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [resultsPerSearch, setResultsPerSearch] = useState(10);
  const [provinceFilter, setProvinceFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState<LeadQuality>("recommended");
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>("all");
  const [undoLead, setUndoLead] = useState<LeadRecord | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const visibleLeads = useMemo(() => filterAndSortLeads(leads, leadType, provinceFilter, sectorFilter, qualityFilter, presenceFilter), [leads, leadType, provinceFilter, sectorFilter, qualityFilter, presenceFilter]);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data: { settings: AppSettings }) => {
      setAvailableSectors(leadType === "website" ? data.settings.websiteSectors : data.settings.accountingSectors);
      setResultsPerSearch(data.settings.resultsPerSearch);
    }).catch(() => setError("Arama ayarları yüklenemedi."));
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, [leadType, setError]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void loadMore(); }, { rootMargin: "500px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  async function search() {
    setSearching(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadType, province: provinceFilter || undefined, sector: sectorFilter || undefined, quality: qualityFilter, presence: leadType === "website" ? presenceFilter : "all" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error || `Arama isteği tamamlanamadı (${response.status}).`,
        );
      }
      if (!data || !Array.isArray(data.leads)) {
        throw new Error("Arama sunucusu geçerli bir sonuç döndürmedi.");
      }
      setLeads((current) => mergeNewLeads(data.leads, current));
      setTotal((current) => current + data.found);
      setNotice(data.message);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tarama tamamlanamadı."); }
    finally { setSearching(false); }
  }

  async function changeStatus(lead: LeadRecord, status: LeadStatus, recordContact = false) {
    setLeads((current) => current.filter((item) => item.place_id !== lead.place_id));
    setTotal((current) => Math.max(0, current - 1));
    if (status === "contacted") {
      setUndoLead(lead);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoLead(null), 10_000);
    }
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.place_id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, recordContact, phone: lead.details.internationalPhone ?? lead.details.phone ?? undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
    } catch (caught) {
      setLeads((current) => current.some((item) => item.place_id === lead.place_id) ? current : [lead, ...current]);
      setTotal((current) => current + 1);
      if (status === "contacted") setUndoLead(null);
      throw caught;
    }
  }

  async function contact(lead: LeadRecord) {
    try { await changeStatus(lead, "contacted", true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Durum güncellenemedi."); }
  }

  async function undo() {
    if (!undoLead) return;
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(undoLead.place_id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "new" }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setLeads((current) => [undoLead, ...current]); setTotal((current) => current + 1); setUndoLead(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "İşlem geri alınamadı."); }
  }

  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">Aday havuzu</p><h1>{title}</h1><p>{description}</p></div><button onClick={search} disabled={searching} className="primary-button search-button"><Search size={19} />{searching ? "İşletmeler aranıyor…" : `${resultsPerSearch} Yeni İşletme Bul`}</button></div>
      <div className="search-filters" aria-label="Arama filtreleri">
        <label><span><MapPin size={15} />Şehir</span><select value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)}><option value="">Tüm Türkiye · 81 il</option>{TURKIYE_ILLERI.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
        <label><span><BriefcaseBusiness size={15} />Meslek / sektör</span><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}><option value="">Tüm aktif sektörler · dengeli tarama</option>{availableSectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}</select></label>
        <label><span><Search size={15} />Aday kalitesi</span><select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value as LeadQuality)}><option value="recommended">Dengeli · önerilen</option><option value="selective">Seçici · güçlü profil</option><option value="broad">Geniş · daha çok aday</option></select></label>
        {leadType === "website" && <label><span><Camera size={15} />Dijital kanal</span><select value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as PresenceFilter)}><option value="all">Tümü · site ihtiyacı olanlar</option><option value="instagram">Instagram var · site yok</option><option value="no_social">Sosyal profil görünmüyor</option></select></label>}
        {(provinceFilter || sectorFilter || qualityFilter !== "recommended" || presenceFilter !== "all") && <button className="clear-filters" onClick={() => { setProvinceFilter(""); setSectorFilter(""); setQualityFilter("recommended"); setPresenceFilter("all"); }}><RotateCcw size={14} />Filtreleri temizle</button>}
        <p>{presenceFilter === "instagram" ? "Faal, geçerli cep telefonlu, Instagram bağlantılı ve bağımsız sitesi olmayan işletmeler aranır. Son iki yılda açıldığı doğrulananlar önce gelir; tarih kaydı olmayan uygun adaylar artık kaybedilmez." : provinceFilter && sectorFilter ? "Seçilen şehir ve meslekte faal görünen, sektörle eşleşen ve BTK planına uygun mobil numarası olan işletmeler aranır. WhatsApp işareti ve yeni açılış tarihi bulunanlar önce gösterilir." : provinceFilter ? `Yalnızca ${provinceFilter} ilindeki aktif sektörler ayrı ayrı ve dengeli aranır; başka illerden sonuç getirilmez.` : sectorFilter ? `Yalnızca ${sectorFilter} sektöründeki işletmeler 81 il genelinde aranır; başka sektörlerden sonuç getirilmez.` : qualityFilter === "selective" ? "Seçici modda geçerli mobilin yanında çalışma saati veya yakın tarihli doğrulama gibi faal işletme sinyali de zorunludur." : qualityFilter === "broad" ? "Geniş mod daha fazla sektör eşleşmesi getirir; açıkça eski açılış tarihli, kapanmış veya geçersiz numaralı kayıtları yine eler." : "Filtre yoksa her aktif sektör kendi OpenStreetMap etiketiyle ayrı aranır ve sonuçlar aynı aday tablosunda birleştirilir. Yoğun bir sektör tüm sonuçları kaplayamaz; tarama kaldığı şehir-sektör sırasından devam eder. Demo, ilgi veya müşteri başarısı olan eşleşmelere yaklaşık %40 öncelik korunur."}</p>
      </div>
      {notice && <div className="notice success" role="status">{notice}</div>}
      {warning && <div className="notice warning" role="status">{warning}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {!loading && <div className="result-summary"><strong>{visibleLeads.length}</strong> eşleşen aday · <span>{leads.length}/{total} aday yüklendi</span></div>}
      <LeadList leads={visibleLeads} leadType={leadType} loading={loading} onContact={contact} onStatus={changeStatus} />
      <div ref={loadMoreRef} className="infinite-loader">{loadingMore && <><span className="spinner" />Diğer adaylar sıralanıyor…</>}{!loadingMore && hasMore && <button onClick={() => void loadMore()}>Daha fazla aday yükle</button>}{!hasMore && leads.length > 0 && <span>Tüm adaylar gösterildi.</span>}</div>
      {undoLead && <div className="undo-toast"><span><strong>{undoLead.details.name}</strong> için ilk selam açıldı ve Satış Merkezi&apos;ne taşındı.</span><button onClick={undo}><Undo2 size={16} />Geri Al</button><span className="undo-progress" /></div>}
    </section>
  );
}

function filterAndSortLeads(leads: LeadRecord[], leadType: LeadType, province: string, sector: string, quality: LeadQuality, presence: PresenceFilter) {
  const filtered = leads.filter((lead) => {
    const details = lead.details;
    if (province && details.province !== province && lead.source_province !== province) return false;
    if (sector && details.sector !== sector && lead.source_sector !== sector) return false;
    if (details.businessStatus !== "UNKNOWN" && !assessPotential(details, leadType, quality).eligible) return false;
    if (leadType === "website" && presence === "instagram" && !isInstagramProfile(details.websiteUri)) return false;
    if (leadType === "website" && presence === "no_social" && socialProfileType(details.websiteUri) !== null) return false;
    return true;
  });
  const order = new Map(orderPotentialPlaces(filtered.map((lead) => lead.details), leadType, quality).map((details, index) => [details.placeId, index]));
  return filtered.sort((a, b) => (order.get(a.place_id) ?? 9999) - (order.get(b.place_id) ?? 9999));
}

function mergeNewLeads(incoming: LeadRecord[], current: LeadRecord[]) {
  const incomingIds = new Set(incoming.map((lead) => lead.place_id));
  return [...incoming, ...current.filter((lead) => !incomingIds.has(lead.place_id))];
}
