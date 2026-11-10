import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
// نفس خطوط الموقع، من غير Google Fonts (متخزّنة مع الملفات)
import "@fontsource-variable/alexandria/wght.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/latin-400.css";
import "@fontsource/ibm-plex-sans-arabic/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRATIX HQ",
  description: "لوحة تحكم فريق STRATIX",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#14102a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
