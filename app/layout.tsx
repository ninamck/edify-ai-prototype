import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ActiveSiteProvider } from "@/components/ActiveSite/ActiveSiteContext";
import { SiteSettingsStoreProvider } from "@/components/Settings/siteSettingsStore";
import { NightShiftPolicyProvider } from "@/components/Settings/nightShiftPolicyStore";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="h-full">
        <ActiveSiteProvider>
          <SiteSettingsStoreProvider>
            <NightShiftPolicyProvider>
              {children}
            </NightShiftPolicyProvider>
          </SiteSettingsStoreProvider>
        </ActiveSiteProvider>
      </body>
    </html>
  );
}
