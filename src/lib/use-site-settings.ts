"use client";

import { useEffect, useState } from "react";

export interface ClientSiteSettings {
  // Branding
  name: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  // Contact
  phone: string;
  whatsappNumber: string;
  emails: string[];
  location: string;
  // CTA
  ctaLabel: string;
  // Social / footer
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  footerNote?: string;
  // Payment (public-safe — no secrets)
  mpesaEnabled?: boolean;
  mpesaPaybill?: string;
  mpesaAccountNumber?: string;
  mpesaInstructions?: string;
  mpesaStkConfigured?: boolean; // true when Daraja credentials are set on server
  // Section copy
  servicesHeroTitle?: string;
  servicesHeroSubtitle?: string;
  whyTitle?: string;
  whySubtitle?: string;
  whyFeature1Title?: string;
  whyFeature1Desc?: string;
  whyFeature2Title?: string;
  whyFeature2Desc?: string;
  whyFeature3Title?: string;
  whyFeature3Desc?: string;
  ctaSectionTitle?: string;
  ctaSectionSubtitle?: string;
}

const DEFAULTS: ClientSiteSettings = {
  name: "Tecxpert Cyber Services",
  tagline: "Fast. Reliable. Affordable.",
  heroTitle: "TECXPERT CYBER SERVICES",
  heroSubtitle:
    "Fast, reliable, and affordable digital solutions for all your business, government, and personal documentation needs.",
  phone: "+254 702 988155",
  whatsappNumber: "254702988155",
  emails: ["tecxpertcyber@gmail.com"],
  location: "Kenya",
  ctaLabel: "Order on WhatsApp",
  mpesaEnabled: true,
  mpesaPaybill: "880100",
  mpesaAccountNumber: "111181",
  mpesaInstructions: "Pay via M-Pesa. After payment, send your order via WhatsApp.",
  mpesaStkConfigured: false,
  servicesHeroTitle: "TECXPERT CYBER SERVICES",
  servicesHeroSubtitle:
    "Fast, reliable, and affordable digital solutions for all your business, government, and personal documentation needs.",
  whyTitle: "Why Choose Us?",
  whySubtitle: "We make complicated processes simple and fast.",
  whyFeature1Title: "Reliable & Secure",
  whyFeature1Desc:
    "Your documents and data are handled with the utmost security and confidentiality.",
  whyFeature2Title: "Extremely Fast",
  whyFeature2Desc:
    "We value your time. Most services are completed within minutes or hours.",
  whyFeature3Title: "Best Prices",
  whyFeature3Desc:
    "Quality service doesn't have to be expensive. We offer the most competitive rates.",
  ctaSectionTitle: "Ready to get started?",
  ctaSectionSubtitle:
    "Don't wait in long queues. Contact us today and let us handle the paperwork for you!",
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<ClientSiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data && typeof data === "object" && !data.error) {
          setSettings({ ...DEFAULTS, ...data });
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
