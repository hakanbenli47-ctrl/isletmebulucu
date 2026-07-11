"use client";

import { useCallback, useEffect, useState } from "react";
import { Handshake, Plus, Save, Trash2, UserRoundCheck } from "lucide-react";
import type { ReferralPartner } from "@/types";

const TYPES = [["accountant", "Mali müşavir"], ["it", "Bilgisayarcı / BT"], ["printing", "Matbaa"], ["agency", "Ajans / tasarımcı"], ["supplier", "Tedarikçi"], ["customer", "Mevcut müşteri"], ["other", "Diğer"]] as const;
const STATUSES = [["candidate", "Aday ortak"], ["contacted", "Görüşüldü"], ["active", "Aktif ortak"], ["paused", "Beklemede"]] as const;

export default function PartnersPage() {
  const [partners, setPartners] = useState<ReferralPartner[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, referrals: 0, customers: 0 });
  const [form, setForm] = useState({ name: "", partnerType: "accountant", contact: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    fetch("/api/partners").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setPartners(data.partners); setStats(data.stats); setError(""); }).catch((caught) => setError(caught instanceof Error ? caught.message : "İş ortakları yüklenemedi.")).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addPartner(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      const response = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, notes: form.notes || null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setForm({ name: "", partnerType: "accountant", contact: "", notes: "" }); setNotice("İş ortağı adayı eklendi."); load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "İş ortağı eklenemedi."); }
  }

  return <section className="partners-page">
    <div className="page-heading compact"><div><p className="eyebrow">Tavsiye kanalı</p><h1>Referans Ağı</h1><p>Mali müşavir, bilgisayarcı, tedarikçi ve mevcut müşterilerden düzenli tavsiye alın.</p></div></div>
    <div className="sales-kpis partner-kpis"><MiniStat icon={Handshake} value={stats.total} label="Toplam ortak" /><MiniStat icon={UserRoundCheck} value={stats.active} label="Aktif ortak" /><MiniStat icon={Plus} value={stats.referrals} label="Gelen referans" /><MiniStat icon={UserRoundCheck} value={stats.customers} label="Referanstan müşteri" /></div>
    <div className="partner-layout">
      <form className="partner-form" onSubmit={addPartner}><h2>Yeni iş ortağı adayı</h2><p>Önce tanıdığınız kişilerden başlayın. Karşılıklı faydayı net anlatın.</p><label>Ad / işletme<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Ortak türü<select value={form.partnerType} onChange={(event) => setForm({ ...form, partnerType: event.target.value })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Telefon / bağlantı<input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label><label>Not<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="primary-button" type="submit"><Plus size={16} />Ağa Ekle</button></form>
      <div className="partner-content">{notice && <div className="notice success">{notice}</div>}{error && <div className="notice error">{error}</div>}{loading ? <div className="state"><span className="spinner" />Ağ yükleniyor…</div> : partners.length ? <div className="partner-list">{partners.map((partner) => <PartnerCard key={partner.id} partner={partner} onDone={load} onError={setError} />)}</div> : <div className="empty-state"><strong>Referans ağınız henüz boş</strong><span>İlk olarak sizi tanıyan bir mali müşavir veya mevcut müşteriyi ekleyin.</span></div>}</div>
    </div>
  </section>;
}

function MiniStat({ icon: Icon, value, label }: { icon: typeof Handshake; value: number; label: string }) { return <div className="sales-kpi"><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>; }

function PartnerCard({ partner, onDone, onError }: { partner: ReferralPartner; onDone: () => void; onError: (message: string) => void }) {
  const [draft, setDraft] = useState(partner);
  async function request(method: "PATCH" | "DELETE") {
    try {
      const body = method === "DELETE" ? { id: partner.id } : { id: partner.id, status: draft.status, contact: draft.contact, notes: draft.notes, referralsCount: draft.referrals_count, customersCount: draft.customers_count, nextFollowUpAt: draft.next_follow_up_at };
      const response = await fetch("/api/partners", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); onDone();
    } catch (caught) { onError(caught instanceof Error ? caught.message : "İş ortağı güncellenemedi."); }
  }
  return <article className="partner-card"><div><span>{TYPES.find(([value]) => value === draft.partner_type)?.[1]}</span><h3>{draft.name}</h3></div><div className="partner-fields"><label>Durum<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReferralPartner["status"] })}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>İletişim<input value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} /></label><label>Referans<input type="number" min={0} value={draft.referrals_count} onChange={(event) => setDraft({ ...draft, referrals_count: Number(event.target.value) })} /></label><label>Müşteri<input type="number" min={0} value={draft.customers_count} onChange={(event) => setDraft({ ...draft, customers_count: Number(event.target.value) })} /></label><label className="partner-notes">Not<textarea rows={2} value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })} /></label></div><div className="partner-actions"><button className="primary-button" onClick={() => request("PATCH")}><Save size={15} />Kaydet</button><button className="action-button danger" onClick={() => request("DELETE")}><Trash2 size={15} />Sil</button></div></article>;
}
