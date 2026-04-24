"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Globe,
  Phone,
  Mail,
  MessageSquare,
  Building2,
  MapPin,
  Sparkles,
  Share2,
  Hash,
  AtSign,
  CreditCard,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

interface SiteSettings {
  name: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  phone: string;
  whatsappNumber: string;
  emails: string[];
  location: string;
  ctaLabel: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  footerNote?: string;
  // M-Pesa
  mpesaEnabled?: boolean;
  mpesaPaybill?: string;
  mpesaAccountNumber?: string;
  mpesaInstructions?: string;
  mpesaShortcode?: string;
  mpesaConsumerKey?: string;
  mpesaConsumerSecret?: string;
  mpesaPasskey?: string;
  mpesaEnv?: "sandbox" | "production";
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

const EMPTY: SiteSettings = {
  name: "",
  tagline: "",
  heroTitle: "",
  heroSubtitle: "",
  phone: "",
  whatsappNumber: "",
  emails: [],
  location: "",
  ctaLabel: "",
  mpesaEnabled: true,
  mpesaPaybill: "",
  mpesaAccountNumber: "",
  mpesaInstructions: "",
  mpesaShortcode: "",
  mpesaConsumerKey: "",
  mpesaConsumerSecret: "",
  mpesaPasskey: "",
  mpesaEnv: "sandbox",
  servicesHeroTitle: "",
  servicesHeroSubtitle: "",
  whyTitle: "",
  whySubtitle: "",
  whyFeature1Title: "",
  whyFeature1Desc: "",
  whyFeature2Title: "",
  whyFeature2Desc: "",
  whyFeature3Title: "",
  whyFeature3Desc: "",
  ctaSectionTitle: "",
  ctaSectionSubtitle: "",
};

export default function SiteSettingsForm({ token }: { token: string }) {
  const [data, setData] = useState<SiteSettings>(EMPTY);
  const [original, setOriginal] = useState<SiteSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json();
      if (!json.error) {
        const merged = { ...EMPTY, ...json, emails: json.emails || [] };
        setData(merged);
        setOriginal(merged);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(data) !== JSON.stringify(original);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const json = await r.json();
      if (json.success) {
        const updated = { ...EMPTY, ...json.settings, emails: json.settings.emails || [] };
        setData(updated);
        setOriginal(updated);
        flash(true, "✓ Settings saved");
      } else {
        flash(false, json.error || "Failed to save");
      }
    } catch {
      flash(false, "Network error");
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const e = newEmail.trim();
    if (!e || data.emails.includes(e)) return;
    setData({ ...data, emails: [...data.emails, e] });
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    setData({ ...data, emails: data.emails.filter((e) => e !== email) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const Field = ({
    label,
    icon: Icon,
    children,
    hint,
  }: {
    label: string;
    icon: React.ElementType;
    children: React.ReactNode;
    hint?: string;
  }) => (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
        <Icon className="w-4 h-4 text-slate-500" />
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );

  const inputCls =
    "w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm";

  return (
    <div className="space-y-8 pb-32">
      {/* Section: Branding */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Branding</h3>
            <p className="text-xs text-slate-400">
              Your business name, tagline, and hero text
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name" icon={Building2}>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className={inputCls}
              placeholder="e.g. Tecxpert Cyber Services"
            />
          </Field>
          <Field label="Tagline" icon={Sparkles}>
            <input
              type="text"
              value={data.tagline}
              onChange={(e) => setData({ ...data, tagline: e.target.value })}
              className={inputCls}
              placeholder="e.g. Fast. Reliable. Affordable."
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Hero Title (homepage)" icon={Sparkles}>
              <input
                type="text"
                value={data.heroTitle}
                onChange={(e) => setData({ ...data, heroTitle: e.target.value })}
                className={inputCls}
                placeholder="The big bold title at the top of the homepage"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Hero Subtitle (homepage)" icon={Sparkles}>
              <textarea
                value={data.heroSubtitle}
                onChange={(e) => setData({ ...data, heroSubtitle: e.target.value })}
                rows={3}
                className={inputCls}
                placeholder="The descriptive paragraph below the hero title"
              />
            </Field>
          </div>
          <Field label="Primary Button Label" icon={Sparkles}
            hint="Text on the main call-to-action button">
            <input
              type="text"
              value={data.ctaLabel}
              onChange={(e) => setData({ ...data, ctaLabel: e.target.value })}
              className={inputCls}
              placeholder="e.g. Order on WhatsApp"
            />
          </Field>
          <Field label="Location" icon={MapPin}>
            <input
              type="text"
              value={data.location}
              onChange={(e) => setData({ ...data, location: e.target.value })}
              className={inputCls}
              placeholder="e.g. Kenya"
            />
          </Field>
        </div>
      </section>

      {/* Section: Contact */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Phone className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Contact Information</h3>
            <p className="text-xs text-slate-400">
              Phone, WhatsApp, and email addresses
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Display Phone" icon={Phone} hint="Shown on the website">
            <input
              type="text"
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
              className={inputCls}
              placeholder="+254 702 988155"
            />
          </Field>
          <Field
            label="WhatsApp Number"
            icon={MessageSquare}
            hint="Digits only, with country code (no +). e.g. 254702988155"
          >
            <input
              type="text"
              value={data.whatsappNumber}
              onChange={(e) =>
                setData({ ...data, whatsappNumber: e.target.value.replace(/\D/g, "") })
              }
              className={inputCls}
              placeholder="254702988155"
            />
          </Field>
        </div>

        {/* Emails — multiple */}
        <div className="mt-5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
            <Mail className="w-4 h-4 text-slate-500" />
            Email Addresses
            <span className="text-xs text-slate-500">
              ({data.emails.length} configured)
            </span>
          </label>
          <div className="space-y-2 mb-3">
            {data.emails.length === 0 && (
              <p className="text-xs text-slate-500 px-3 py-2 bg-slate-800/40 rounded-lg">
                No email addresses yet — add one below.
              </p>
            )}
            {data.emails.map((email, i) => (
              <div
                key={email}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg group"
              >
                {i === 0 && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-semibold">
                    Primary
                  </span>
                )}
                <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-200 flex-1 truncate">{email}</span>
                <button
                  onClick={() => removeEmail(email)}
                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                  aria-label={`Remove ${email}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEmail();
                }
              }}
              placeholder="newaddress@example.com"
              className={`${inputCls} flex-1`}
            />
            <button
              onClick={addEmail}
              disabled={!newEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            The first email is the &ldquo;primary&rdquo; one shown most prominently.
            Customers will see all of them on the contact section.
          </p>
        </div>
      </section>

      {/* Section: Social */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Social Links (Optional)</h3>
            <p className="text-xs text-slate-400">Leave blank to hide</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Facebook URL" icon={Share2}>
            <input
              type="url"
              value={data.facebookUrl ?? ""}
              onChange={(e) => setData({ ...data, facebookUrl: e.target.value })}
              className={inputCls}
              placeholder="https://facebook.com/..."
            />
          </Field>
          <Field label="Instagram URL" icon={AtSign}>
            <input
              type="url"
              value={data.instagramUrl ?? ""}
              onChange={(e) => setData({ ...data, instagramUrl: e.target.value })}
              className={inputCls}
              placeholder="https://instagram.com/..."
            />
          </Field>
          <Field label="Twitter / X URL" icon={Hash}>
            <input
              type="url"
              value={data.twitterUrl ?? ""}
              onChange={(e) => setData({ ...data, twitterUrl: e.target.value })}
              className={inputCls}
              placeholder="https://x.com/..."
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Footer Note" icon={Sparkles} hint="Optional small text shown at the very bottom">
            <input
              type="text"
              value={data.footerNote ?? ""}
              onChange={(e) => setData({ ...data, footerNote: e.target.value })}
              className={inputCls}
              placeholder="e.g. Licensed cyber café — Reg No. 12345"
            />
          </Field>
        </div>
      </section>

      {/* Section: Page Sections (text content) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Page Section Text</h3>
            <p className="text-xs text-slate-400">
              Edit the headings and copy that appear on the homepage and services page
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Services hero */}
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Services Page · Hero
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Hero title" icon={Sparkles}>
                <input
                  type="text"
                  value={data.servicesHeroTitle ?? ""}
                  onChange={(e) =>
                    setData({ ...data, servicesHeroTitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="TECXPERT CYBER SERVICES"
                />
              </Field>
              <Field label="Hero subtitle" icon={Sparkles}>
                <input
                  type="text"
                  value={data.servicesHeroSubtitle ?? ""}
                  onChange={(e) =>
                    setData({ ...data, servicesHeroSubtitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Fast, reliable, and affordable…"
                />
              </Field>
            </div>
          </div>

          {/* Why-Choose-Us section */}
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Why Choose Us · Section
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Section title" icon={Sparkles}>
                <input
                  type="text"
                  value={data.whyTitle ?? ""}
                  onChange={(e) =>
                    setData({ ...data, whyTitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Why Choose Us?"
                />
              </Field>
              <Field label="Section subtitle" icon={Sparkles}>
                <input
                  type="text"
                  value={data.whySubtitle ?? ""}
                  onChange={(e) =>
                    setData({ ...data, whySubtitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="We make complicated processes simple…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2"
                >
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Feature {n}
                  </p>
                  <input
                    type="text"
                    value={
                      (data[
                        `whyFeature${n}Title` as keyof SiteSettings
                      ] as string) ?? ""
                    }
                    onChange={(e) =>
                      setData({
                        ...data,
                        [`whyFeature${n}Title`]: e.target.value,
                      } as SiteSettings)
                    }
                    placeholder="Title"
                    className={inputCls}
                  />
                  <textarea
                    rows={2}
                    value={
                      (data[
                        `whyFeature${n}Desc` as keyof SiteSettings
                      ] as string) ?? ""
                    }
                    onChange={(e) =>
                      setData({
                        ...data,
                        [`whyFeature${n}Desc`]: e.target.value,
                      } as SiteSettings)
                    }
                    placeholder="Short description"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CTA section */}
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Call-to-action · Section
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="CTA title" icon={Sparkles}>
                <input
                  type="text"
                  value={data.ctaSectionTitle ?? ""}
                  onChange={(e) =>
                    setData({ ...data, ctaSectionTitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Ready to get started?"
                />
              </Field>
              <Field label="CTA subtitle" icon={Sparkles}>
                <input
                  type="text"
                  value={data.ctaSectionSubtitle ?? ""}
                  onChange={(e) =>
                    setData({ ...data, ctaSectionSubtitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Don't wait in long queues…"
                />
              </Field>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Payment (M-Pesa) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">M-Pesa Payment</h3>
              <p className="text-xs text-slate-400">
                Paybill, account number, and Daraja credentials for STK Push
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-slate-400">Enabled</span>
            <span className="relative">
              <input
                type="checkbox"
                checked={!!data.mpesaEnabled}
                onChange={(e) =>
                  setData({ ...data, mpesaEnabled: e.target.checked })
                }
                className="peer sr-only"
              />
              <span className="block w-10 h-6 bg-slate-700 peer-checked:bg-emerald-500 rounded-full transition-colors" />
              <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Paybill Number" icon={CreditCard}
            hint="Shown to customers on the checkout screen">
            <input
              type="text"
              value={data.mpesaPaybill ?? ""}
              onChange={(e) =>
                setData({ ...data, mpesaPaybill: e.target.value.replace(/\D/g, "") })
              }
              className={inputCls}
              placeholder="880100"
            />
          </Field>
          <Field label="Account Number" icon={Hash}
            hint="The account customers enter on M-Pesa">
            <input
              type="text"
              value={data.mpesaAccountNumber ?? ""}
              onChange={(e) =>
                setData({ ...data, mpesaAccountNumber: e.target.value })
              }
              className={inputCls}
              placeholder="111181"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Payment Instructions (optional)" icon={Sparkles}
              hint="A short message shown to customers below the paybill details">
              <input
                type="text"
                value={data.mpesaInstructions ?? ""}
                onChange={(e) =>
                  setData({ ...data, mpesaInstructions: e.target.value })
                }
                className={inputCls}
                placeholder="Pay via M-Pesa. After payment, send your order via WhatsApp."
              />
            </Field>
          </div>
        </div>

        {/* Daraja STK Push credentials (collapsed by default) */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <button
            type="button"
            onClick={() => setShowSecrets(!showSecrets)}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span className="font-semibold">Daraja STK Push Credentials</span>
            <span className="text-xs text-slate-500 font-normal">
              (optional — enables &ldquo;Pay before sending order&rdquo; popup)
            </span>
            {showSecrets ? (
              <EyeOff className="w-4 h-4 ml-1" />
            ) : (
              <Eye className="w-4 h-4 ml-1" />
            )}
          </button>

          {showSecrets && (
            <div className="mt-4 space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                Get these from{" "}
                <a
                  href="https://developer.safaricom.co.ke"
                  target="_blank"
                  rel="noopener"
                  className="underline hover:text-blue-200"
                >
                  developer.safaricom.co.ke
                </a>
                . Without these, customers will pay manually using the paybill
                above (no STK Push popup).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Daraja Environment" icon={Globe}>
                  <select
                    value={data.mpesaEnv ?? "sandbox"}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mpesaEnv: e.target.value as "sandbox" | "production",
                      })
                    }
                    className={inputCls}
                  >
                    <option value="sandbox">Sandbox (testing)</option>
                    <option value="production">Production (live money)</option>
                  </select>
                </Field>
                <Field label="STK Shortcode" icon={Smartphone}
                  hint="Usually the same as Paybill">
                  <input
                    type="text"
                    value={data.mpesaShortcode ?? ""}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mpesaShortcode: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    className={inputCls}
                    placeholder="880100"
                  />
                </Field>
                <Field label="Consumer Key" icon={Lock}>
                  <input
                    type="password"
                    value={data.mpesaConsumerKey ?? ""}
                    onChange={(e) =>
                      setData({ ...data, mpesaConsumerKey: e.target.value })
                    }
                    className={inputCls}
                    placeholder="••••••••••••••••"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Consumer Secret" icon={Lock}>
                  <input
                    type="password"
                    value={data.mpesaConsumerSecret ?? ""}
                    onChange={(e) =>
                      setData({ ...data, mpesaConsumerSecret: e.target.value })
                    }
                    className={inputCls}
                    placeholder="••••••••••••••••"
                    autoComplete="off"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Lipa na M-Pesa Online Passkey" icon={Lock}>
                    <input
                      type="password"
                      value={data.mpesaPasskey ?? ""}
                      onChange={(e) =>
                        setData({ ...data, mpesaPasskey: e.target.value })
                      }
                      className={inputCls}
                      placeholder="••••••••••••••••••••••••••••••••"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-64 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
            {feedback ? (
              <>
                {feedback.ok ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className={feedback.ok ? "text-emerald-400" : "text-red-400"}>
                  {feedback.msg}
                </span>
              </>
            ) : dirty ? (
              <span className="text-amber-400">● You have unsaved changes</span>
            ) : (
              <span className="text-slate-500">All changes saved</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {dirty && (
              <button
                onClick={() => setData(original)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors"
              >
                Discard
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
