"use client";

import { useEffect, useState } from "react";
import LeadList from "@/components/lead-list";
import type { LeadRecord, LeadStatus } from "@/types";

type Period = "today" | "week" | "all";
type Stats = { today: number; week: number; total: number; customers: number };

export default function ContactedPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ today: 0, week: 0, total: 0, customers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads?status=contacted&period=${period}&pageSize=20`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setLeads(data.leads); setStats(data.stats); setError("");
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Kayıtlar yüklenemedi.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period]);

  async function changeStatus(lead: LeadRecord, status: LeadStatus) {
    setLeads((current) => current.filter((item) => item.place_id !== lead.place_id));
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(lead.place_id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error((await response.json()).error);
      if (status === "customer") setStats((current) => ({ ...current, customers: current.customers + 1 }));
    } catch (caught) {
      setLeads((current) => current.some((item) => item.place_id === lead.place_id) ? current : [lead, ...current]);
      setError(caught instanceof Error ? caught.message : "Durum güncellenemedi.");
    }
  }

  return (
    <section>
      <div className="page-heading compact"><div><p className="eyebrow">İletişim geçmişi</p><h1>Mesaj Gönderilenler</h1><p>WhatsApp konuşmasını açtığınız işletmeleri ve sonuçlarını takip edin.</p></div></div>
      <div className="stats-line" aria-label="İletişim özeti"><div><strong>{stats.today}</strong><span>Bugün gönderilen</span></div><div><strong>{stats.week}</strong><span>Bu hafta gönderilen</span></div><div><strong>{stats.total}</strong><span>Toplam gönderilen</span></div><div><strong>{stats.customers}</strong><span>Müşteri olan</span></div></div>
      <div className="filter-tabs" role="tablist" aria-label="Tarih filtresi">
        {([['today', 'Bugün'], ['week', 'Son 7 gün'], ['all', 'Tümü']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={period === value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{label}</button>)}
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <LeadList leads={leads} loading={loading} contacted onStatus={changeStatus} />
    </section>
  );
}
