"use client";

import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, MapPin, RotateCcw, Search, Undo2 } from "lucide-react";
import { useLeads } from "@/hooks/use-leads";
import LeadList from "@/components/lead-list";
import { TURKIYE_ILLERI } from "@/data/turkiye-illeri";
import type { AppSettings, LeadQuality, LeadRecord, LeadStatus, LeadType } from "@/types";

export default function CandidatePage({ leadType, title, description }: { leadType: LeadType; title: string; description: string }) {
  const { leads, setLeads, page, setPage, total, setTotal, loading, error, setError, warning } = useLeads(leadType);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [resultsPerSearch, setResultsPerSearch] = useState(10);
  const [provinceFilter, setProvinceFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState<LeadQuality>("recommended");
  const [undoLead, setUndoLead] = useState<LeadRecord | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data: { settings: AppSettings }) => {
      setMessage(leadType === "website" ? data.settings.websiteMessage : data.settings.accountingMessage);
      setAvailableSectors(leadType === "website" ? data.settings.websiteSectors : data.settings.accountingSectors);
      setResultsPerSearch(data.settings.resultsPerSearch);
    }).catch(() => setMessage("Merhaba, iyi çalışmalar."));
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, [leadType]);

  async function search() {
    setSearching(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadType, province: provinceFilter || undefined, sector: sectorFilter || undefined, quality: qualityFilter }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLeads((current) => [...data.leads, ...current].slice(0, 10));
      setTotal((current) => current + data.found);
      setPage(1); setNotice(data.message);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tarama tamamlanamadı."); }
    finally { setSearching(false); }
  }

  async function changeStatus(lead: LeadRecord, status: LeadStatus) {
    setLeads((current) => current.filter((item) => item.place_id !== lead.place_id));
    setTotal((current) => Math.max(0, current - 1));
    if (status === "contacted") {
      setUndoLead(lead);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoLead(null), 10_000);
    }
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.place_id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
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
    try { await changeStatus(lead, "contacted"); }
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
        <label><span><MapPin size={15} />Şehir</span><select value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)}><option value="">Tüm şehirler · öncelik sırası</option>{TURKIYE_ILLERI.map((province) => <option key={province} value={province}>{province}</option>)}</select></label>
        <label><span><BriefcaseBusiness size={15} />Meslek / sektör</span><select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}><option value="">Tüm aktif meslekler</option>{availableSectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}</select></label>
        <label><span><Search size={15} />Aday kalitesi</span><select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value as LeadQuality)}><option value="recommended">Dengeli · önerilen</option><option value="selective">Seçici · güçlü profil</option><option value="broad">Geniş · daha çok aday</option></select></label>
        {(provinceFilter || sectorFilter || qualityFilter !== "recommended") && <button className="clear-filters" onClick={() => { setProvinceFilter(""); setSectorFilter(""); setQualityFilter("recommended"); }}><RotateCcw size={14} />Filtreleri temizle</button>}
        <p>{provinceFilter && sectorFilter ? "Seçilen şehir ve meslek için hedefli arama yapılır." : qualityFilter === "selective" ? "Daha yüksek puan ve yorum sinyali bulunan işletmeler seçilir." : qualityFilter === "broad" ? "Daha az yorumlu işletmeler de değerlendirilir; sonuç sayısı artabilir." : "Boş bırakılan alanlarda kayıtlı öncelik sırası ve dengeli kalite kuralları kullanılır."}</p>
      </div>
      {notice && <div className="notice success" role="status">{notice}</div>}
      {warning && <div className="notice warning" role="status">{warning}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <LeadList leads={leads} leadType={leadType} loading={loading} whatsappMessage={message} onContact={contact} onStatus={changeStatus} />
      <Pagination page={page} total={total} onPage={setPage} />
      {undoLead && <div className="undo-toast"><span><strong>{undoLead.details.name}</strong> mesaj gönderilenlere taşındı.</span><button onClick={undo}><Undo2 size={16} />Geri Al</button><span className="undo-progress" /></div>}
    </section>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  if (total <= 10) return null;
  return <div className="pagination"><button disabled={page === 1} onClick={() => onPage(page - 1)}>Önceki</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Sonraki</button></div>;
}
