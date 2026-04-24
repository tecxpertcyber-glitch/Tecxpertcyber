import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { BUSINESS } from "@/data/services";

export const metadata: Metadata = {
  title: {
    default: `${BUSINESS.name} | Fast & Affordable Digital Solutions`,
    template: `%s | ${BUSINESS.name}`,
  },
  description:
    `${BUSINESS.name} offers fast, reliable, and affordable digital solutions in Kenya. Business registration, KRA PIN, passport applications, visa services, web design, printing, and more. Call/WhatsApp ${BUSINESS.phone}.`,
  keywords: [
    "cyber services Kenya",
    "business registration Kenya",
    "KRA PIN registration",
    "passport application Kenya",
    "visa application",
    "web design Kenya",
    "printing services",
    "eCitizen services",
    "HELB application",
    "driving license renewal",
    "Tecxpert Cyber",
    "digital solutions Kenya",
  ],
  authors: [{ name: BUSINESS.name }],
  creator: BUSINESS.name,
  publisher: BUSINESS.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: "https://tecxpert-cyber.netlify.app",
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} | Fast & Affordable Digital Solutions`,
    description:
      "Your one-stop shop for business registration, government services, travel documents, web design, and printing in Kenya.",
    images: [
      {
        url: "https://tecxpert-cyber.netlify.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${BUSINESS.name} - Professional Cyber Services in Kenya`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BUSINESS.name} | Fast & Affordable Digital Solutions`,
    description:
      "Professional cyber services in Kenya. Business registration, KRA PIN, passport, visa, web design, and more.",
    images: ["https://tecxpert-cyber.netlify.app/og-image.jpg"],
  },
  verification: {
    google: "your-google-verification-code",
  },
  alternates: {
    canonical: "https://tecxpert-cyber.netlify.app",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

import VisitorTracker from "@/components/VisitorTracker";
import PublicSuggestionBox from "@/components/PublicSuggestionBox";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <VisitorTracker />
        <PublicSuggestionBox />
      </body>
    </html>
  );
}
