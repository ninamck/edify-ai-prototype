import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ActiveSiteProvider } from "@/components/ActiveSite/ActiveSiteContext";
import { FranchiseProvider } from "@/components/Franchise/FranchiseContext";
import { SiteSettingsStoreProvider } from "@/components/Settings/siteSettingsStore";
import { NightShiftPolicyProvider } from "@/components/Settings/nightShiftPolicyStore";
import { CompanyContextProvider } from "@/components/Settings/companyContextStore";
import Analytics from "@/components/Analytics/Analytics";
import { isDemoBuild, demoCustomer } from "@/lib/demoConfig";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: isDemoBuild ? demoCustomer.name : "Edify",
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
        <Analytics />
        <ActiveSiteProvider>
          <FranchiseProvider>
            <SiteSettingsStoreProvider>
              <NightShiftPolicyProvider>
                <CompanyContextProvider>
                  {children}
                </CompanyContextProvider>
              </NightShiftPolicyProvider>
            </SiteSettingsStoreProvider>
          </FranchiseProvider>
        </ActiveSiteProvider>
      </body>
    </html>
  );
}
