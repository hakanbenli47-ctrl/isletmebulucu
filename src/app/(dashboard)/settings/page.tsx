"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { ACCOUNTING_SECTORS, WEBSITE_SECTORS } from "@/data/sectors";
import type { AppSettings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [defaults, setDefaults] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSettings(data.settings); setDefaults(data.defaults);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Ayarlar yüklenemedi."));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setNotice("Ayarlar kaydedildi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ayarlar kaydedilemedi."); }
    finally { setSaving(false); }
  }

  if (!settings) return <section><div className="page-heading compact"><div><p className="eyebrow">Tercihler</p><h1>Ayarlar</h1></div></div>{error ? <div className="notice error">{error}</div> : <div className="state"><span className="spinner" />Ayarlar yükleniyor…</div>}</section>;

  function toggle(key: "websiteSectors" | "accountingSectors", sector: string) {
    const current = settings![key];
    if (current.includes(sector) && current.length === 1) return;
    setSettings({ ...settings!, [key]: current.includes(sector) ? current.filter((item) => item !== sector) : [...current, sector] });
  }

  return (
    <section className="settings-page">
      <div className="page-heading compact"><div><p className="eyebrow">Tercihler</p><h1>Ayarlar</h1><p>Arama kapsamını ve her teklif için tek seferlik mesajınızı yönetin.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => defaults && setSettings(structuredClone(defaults))}><RotateCcw size={17} />Varsayılana Döndür</button><button className="primary-button" disabled={saving} onClick={save}><Save size={17} />{saving ? "Kaydediliyor…" : "Kaydet"}</button></div></div>
      {notice && <div className="notice success">{notice}</div>}{error && <div className="notice error">{error}</div>}
      <div className="settings-grid numbers"><label>Tek aramada istenen işletme sayısı<input type="number" min={1} max={50} value={settings.resultsPerSearch} onChange={(event) => setSettings({ ...settings, resultsPerSearch: Number(event.target.value) })} /><small>En fazla 50</small></label><label>Günlük iletişim hedefi<input type="number" min={1} max={500} value={settings.dailyContactGoal} onChange={(event) => setSettings({ ...settings, dailyContactGoal: Number(event.target.value) })} /><small>Takip amaçlı hedef</small></label></div>
      <div className="settings-section"><div><h2>Web sitesi WhatsApp mesajı</h2><p>Web sitesi adaylarının WhatsApp bağlantısında kullanılır.</p></div><textarea value={settings.websiteMessage} onChange={(event) => setSettings({ ...settings, websiteMessage: event.target.value })} rows={10} /></div>
      <div className="settings-section"><div><h2>Ön muhasebe WhatsApp mesajı</h2><p>Ön muhasebe adaylarının WhatsApp bağlantısında kullanılır.</p></div><textarea value={settings.accountingMessage} onChange={(event) => setSettings({ ...settings, accountingMessage: event.target.value })} rows={10} /></div>
      <SectorSection title="Aktif web sitesi sektörleri" sectors={WEBSITE_SECTORS} active={settings.websiteSectors} onToggle={(sector) => toggle("websiteSectors", sector)} />
      <SectorSection title="Aktif ön muhasebe sektörleri" sectors={ACCOUNTING_SECTORS} active={settings.accountingSectors} onToggle={(sector) => toggle("accountingSectors", sector)} />
    </section>
  );
}

function SectorSection({ title, sectors, active, onToggle }: { title: string; sectors: readonly string[]; active: string[]; onToggle: (sector: string) => void }) {
  return <div className="settings-section sectors"><div><h2>{title}</h2><p>{active.length} sektör aktif</p></div><div className="sector-list">{sectors.map((sector) => <label key={sector}><input type="checkbox" checked={active.includes(sector)} onChange={() => onToggle(sector)} /><span>{sector}</span></label>)}</div></div>;
}
