import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ActiveSiteProvider } from "@/components/ActiveSite/ActiveSiteContext";
import { SiteSettingsStoreProvider } from "@/components/Settings/siteSettingsStore";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Edify",
  description: "Hospitality operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full`}>
      <body className="h-full">
        <ActiveSiteProvider>
          <SiteSettingsStoreProvider>
            {children}
          </SiteSettingsStoreProvider>
        </ActiveSiteProvider>
      </body>
    </html>
  );
}
