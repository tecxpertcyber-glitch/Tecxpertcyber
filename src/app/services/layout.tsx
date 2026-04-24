import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Services & Price List",
  description:
    "Complete price list for Tecxpert Cyber Services. Business registration from 500 Ksh, KRA PIN 200 Ksh, Passport 600 Ksh, Web Design 800 Ksh, and more. Best prices in Kenya.",
  openGraph: {
    title: "Services & Price List | Tecxpert Cyber Services",
    description:
      "Complete price list for Tecxpert Cyber Services. Business registration, KRA PIN, Passport, Web Design, and more.",
    url: "https://tecxpert-cyber.netlify.app/services/",
  },
};

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
