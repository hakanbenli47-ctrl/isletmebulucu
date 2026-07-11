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
      <div className="settings-grid numbers"><label>Tek aramada istenen işletme sayısı<input type="number" min={1} max={50} value={settings.resultsPerSearch} onChange={(event) => setSettings({ ...settings, resultsPerSearch: Number(event.target.value) })} /><small>En fazla 50</small></label><label>Günlük iletişim hedefi<input type="number" min={1} max={500} value={settings.dailyContactGoal} onChange={(event) => setSettings({ ...settings, dailyContactGoal: Number(event.target.value) })} /><small>Kaliteli ve kişiselleştirilmiş temas hedefi</small></label><label>İlk takip günü<input type="number" min={1} max={30} value={settings.firstFollowUpDays} onChange={(event) => setSettings({ ...settings, firstFollowUpDays: Number(event.target.value) })} /><small>İlk mesajdan kaç gün sonra?</small></label><label>Son takip günü<input type="number" min={2} max={60} value={settings.finalFollowUpDays} onChange={(event) => setSettings({ ...settings, finalFollowUpDays: Number(event.target.value) })} /><small>İlk mesajdan itibaren toplam gün</small></label><label>En fazla takip sayısı<input type="number" min={0} max={3} value={settings.maxFollowUps} onChange={(event) => setSettings({ ...settings, maxFollowUps: Number(event.target.value) })} /><small>Toplu gönderim yapılmaz; önerilen 2</small></label></div>
      <div className="settings-section"><div><h2>Web sitesi WhatsApp mesajı</h2><p>Web sitesi adaylarının WhatsApp bağlantısında kullanılır. İşletme adı gönderim sırasında otomatik eklenir.</p>{defaults && <button className="text-button" onClick={() => setSettings({ ...settings, websiteMessage: defaults.websiteMessage })}>Önerilen anahtar teslim metnini kullan</button>}</div><textarea value={settings.websiteMessage} onChange={(event) => setSettings({ ...settings, websiteMessage: event.target.value })} rows={10} /></div>
      <div className="settings-section"><div><h2>Instagram adayı WhatsApp mesajı</h2><p>Instagram profili bulunan fakat bağımsız sitesi olmayan işletmelere otomatik seçilir.</p>{defaults && <button className="text-button" onClick={() => setSettings({ ...settings, instagramMessage: defaults.instagramMessage })}>Önerilen Instagram metnini kullan</button>}</div><textarea value={settings.instagramMessage} onChange={(event) => setSettings({ ...settings, instagramMessage: event.target.value })} rows={10} /></div>
      <div className="settings-section"><div><h2>Ön muhasebe WhatsApp mesajı</h2><p>Ön muhasebe adaylarının WhatsApp bağlantısında kullanılır. İşletme adı gönderim sırasında otomatik eklenir.</p>{defaults && <button className="text-button" onClick={() => setSettings({ ...settings, accountingMessage: defaults.accountingMessage })}>Önerilen toptan satış metnini kullan</button>}</div><textarea value={settings.accountingMessage} onChange={(event) => setSettings({ ...settings, accountingMessage: event.target.value })} rows={10} /></div>
      <div className="settings-section"><div><h2>Web sitesi takip mesajı</h2><p>İlk mesaja cevap gelmezse Satış Merkezi&apos;nden elle gönderilir.</p>{defaults && <button className="text-button" onClick={() => setSettings({ ...settings, websiteFollowUpMessage: defaults.websiteFollowUpMessage })}>Önerilen takip metnini kullan</button>}</div><textarea value={settings.websiteFollowUpMessage} onChange={(event) => setSettings({ ...settings, websiteFollowUpMessage: event.target.value })} rows={6} /></div>
      <div className="settings-section"><div><h2>Instagram adayı takip mesajı</h2><p>Instagram adayları için ayrı takip metni kullanılır.</p>{defaults && <button className="text-button" onClick={() => setSettings({ ...settings, instagramFollowUpMessage: defaults.instagramFollowUpMessage })}>Önerilen Instagram takip metnini kullan</button>}</div><textarea value={settings.instagramFollowUpMessage} onChange={(event) => setSettings({ ...settings, instagramFollowUpMessage: event.target.value })} rows={6} /></div>
      <div className="settings-section"><div><h2>Ön muhasebe takip mesajı</h2><p>İlk mesaja cevap gelmezse Satış Merkezi&apos;nden elle gönderilir.</p>{defaults && <button className="text-button" onClick={() => setSettings({ ...settings, accountingFollowUpMessage: defaults.accountingFollowUpMessage })}>Önerilen takip metnini kullan</button>}</div><textarea value={settings.accountingFollowUpMessage} onChange={(event) => setSettings({ ...settings, accountingFollowUpMessage: event.target.value })} rows={6} /></div>
      <SectorSection title="Aktif web sitesi sektörleri" sectors={WEBSITE_SECTORS} active={settings.websiteSectors} onToggle={(sector) => toggle("websiteSectors", sector)} />
      <SectorSection title="Aktif ön muhasebe sektörleri" description="Yalnızca toptan satış, stok, üretim ve dağıtım ihtiyacı yüksek işletmeler." sectors={ACCOUNTING_SECTORS} active={settings.accountingSectors} onToggle={(sector) => toggle("accountingSectors", sector)} />
    </section>
  );
}

function SectorSection({ title, description, sectors, active, onToggle }: { title: string; description?: string; sectors: readonly string[]; active: string[]; onToggle: (sector: string) => void }) {
  return <div className="settings-section sectors"><div><h2>{title}</h2><p>{description ?? `${active.length} sektör aktif`}</p>{description && <p className="sector-count">{active.length} sektör aktif</p>}</div><div className="sector-list">{sectors.map((sector) => <label key={sector}><input type="checkbox" checked={active.includes(sector)} onChange={() => onToggle(sector)} /><span>{sector}</span></label>)}</div></div>;
}
