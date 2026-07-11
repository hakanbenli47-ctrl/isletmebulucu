import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "İşletme Bulucu", template: "%s · İşletme Bulucu" },
  description: "Türkiye genelinde satış adaylarını bulma ve iletişim takibi aracı.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
