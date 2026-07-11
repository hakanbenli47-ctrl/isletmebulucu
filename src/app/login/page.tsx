import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/website");
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-mark"><Building2 size={22} aria-hidden="true" /></div>
        <p className="eyebrow">Özel kullanım</p>
        <h1 id="login-title">İşletme Bulucu</h1>
        <p className="muted">Satış adaylarını bulun, WhatsApp iletişimlerinizi tek yerde takip edin.</p>
        <LoginForm />
      </section>
    </main>
  );
}
