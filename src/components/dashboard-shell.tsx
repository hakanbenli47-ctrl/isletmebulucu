"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Calculator, Globe2, Handshake, LogOut, MessageCircleMore, Settings } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const nav = [
  { href: "/website", label: "Web Sitesi Adayları", icon: Globe2 },
  { href: "/accounting", label: "Ön Muhasebe Adayları", icon: Calculator },
  { href: "/contacted", label: "Satış Merkezi", icon: MessageCircleMore },
  { href: "/partners", label: "Referans Ağı", icon: Handshake },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

export default function DashboardShell({ children, email, isDemo }: { children: React.ReactNode; email: string; isDemo: boolean }) {
  const pathname = usePathname();
  async function signOut() {
    if (!isDemo) await createSupabaseBrowserClient().auth.signOut();
    window.location.assign("/login");
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/website"><span className="brand-mark small"><Building2 size={18} /></span><span>İşletme Bulucu</span></Link>
        <nav className="desktop-nav" aria-label="Ana menü">
          {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={17} /><span>{label}</span></Link>)}
        </nav>
        <div className="account-area"><span className="account-email">{isDemo ? "Demo modu" : email}</span><button onClick={signOut} className="icon-button" aria-label="Çıkış yap" title="Çıkış yap"><LogOut size={18} /></button></div>
      </header>
      <main className="content">{children}</main>
      <nav className="mobile-nav" aria-label="Mobil menü">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><Icon size={20} /><span>{label.replace(" Adayları", "")}</span></Link>)}
      </nav>
    </div>
  );
}
