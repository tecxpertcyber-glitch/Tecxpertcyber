"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  ShieldCheck,
  Globe,
  GraduationCap,
  Printer,
  Laptop,
  CreditCard,
  MousePointer2,
  CheckCircle2,
  Phone,
  MessageCircle,
  Loader2,
  Search,
  X,
  Mail,
  ShoppingCart,
  Send,
  Check,
  Smartphone,
  AlertCircle,
  Clock,
  Banknote,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteSettings, type ClientSiteSettings } from "@/lib/use-site-settings";

const ICON_MAP: Record<string, React.ElementType> = {
  Briefcase,
  ShieldCheck,
  Globe,
  GraduationCap,
  Printer,
  Laptop,
  CreditCard,
  MousePointer2,
};

interface Category {
  id: string;
  title: string;
  iconName: string;
  color: string;
  bg: string;
  services: { name: string; price: string }[];
}

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  // Cap query length to prevent ReDoS from extremely long inputs
  if (q.length > 100) return text;
  const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let parts: string[];
  try {
    parts = text.split(new RegExp(`(${safeQuery})`, "gi"));
  } catch {
    return text;
  }
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={i}
        className="bg-yellow-400/30 text-yellow-200 rounded px-0.5"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

const ServiceCard = ({
  name,
  price,
  query,
  selected,
  onToggle,
  priceMatched,
}: {
  name: string;
  price: string;
  query: string;
  selected: boolean;
  onToggle: () => void;
  priceMatched?: boolean;
}) => (
  <motion.button
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    onClick={onToggle}
    type="button"
    className={cn(
      "w-full flex items-center justify-between p-3 rounded-lg border transition-all group text-left",
      selected
        ? "bg-blue-500/10 border-blue-500/60 ring-1 ring-blue-500/40"
        : priceMatched
          ? "bg-yellow-400/5 border-yellow-400/40 hover:border-yellow-400/70"
          : "bg-slate-900/50 border-slate-800 hover:border-blue-500/50"
    )}
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <span
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all",
          selected
            ? "bg-blue-500 border-blue-500"
            : "bg-slate-950 border-slate-700 group-hover:border-blue-400"
        )}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
      <span
        className={cn(
          "text-sm truncate transition-colors",
          selected ? "text-white" : "text-slate-300 group-hover:text-white"
        )}
      >
        {highlightMatch(name, query)}
      </span>
    </div>
    <span
      className={cn(
        "font-semibold text-sm whitespace-nowrap ml-3 px-2 py-0.5 rounded transition-colors",
        priceMatched && !selected
          ? "bg-yellow-400/20 text-yellow-200"
          : selected
            ? "text-blue-300"
            : "text-blue-400"
      )}
    >
      {price === "Contact us" || price === "-" ? price : `${price} Ksh`}
    </span>
  </motion.button>
);

interface SelectedService {
  key: string; // `${categoryId}::${serviceName}`
  name: string;
  price: string;
  category: string;
}

export default function ServicesPage() {
  const { settings: BUSINESS } = useSiteSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, SelectedService>>({});
  const [showCart, setShowCart] = useState(false);
  const primaryEmail = BUSINESS.emails[0] || "tecxpertcyber@gmail.com";

  const toggleSelect = (catId: string, catTitle: string, name: string, price: string) => {
    const key = `${catId}::${name}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { key, name, price, category: catTitle };
      return next;
    });
  };

  const clearSelection = () => setSelected({});

  const selectedList = Object.values(selected);

  // Build the WhatsApp message
  const buildOrderMessage = () => {
    if (selectedList.length === 0) return "";
    const lines: string[] = [];
    lines.push("*🛒 NEW ORDER — Tecxpert Cyber Services*");
    lines.push("");
    lines.push("Hello! I'd like to order the following services:");
    lines.push("");
    let total = 0;
    let hasUnpriced = false;
    selectedList.forEach((s, i) => {
      const num = i + 1;
      const priceText =
        s.price === "Contact us" || s.price === "-"
          ? s.price
          : `${s.price} Ksh`;
      lines.push(`${num}. ${s.name} — *${priceText}*`);
      const numeric = parseInt(s.price, 10);
      if (!Number.isNaN(numeric)) total += numeric;
      else hasUnpriced = true;
    });
    lines.push("");
    if (total > 0) {
      lines.push(
        `*Estimated total: ${total} Ksh*${
          hasUnpriced ? " (some items priced on request)" : ""
        }`
      );
    }
    lines.push("");
    lines.push("Please confirm and let me know how to proceed. Thank you!");
    return lines.join("\n");
  };

  // Build live URLs so buttons can be real <a> tags (popup-blocker proof)
  const orderMessage = buildOrderMessage();
  const whatsappUrl = `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(
    orderMessage
  )}`;
  const emailSubject = `Order Request — ${selectedList.length} service${
    selectedList.length === 1 ? "" : "s"
  }`;
  const emailUrl = `mailto:${primaryEmail}?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(orderMessage)}`;

  const totalEstimate = selectedList.reduce((sum, s) => {
    const n = parseInt(s.price, 10);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {
        // Fallback: import static data if API fails
        import("@/data/services").then((mod) => setCategories(mod.CATEGORIES));
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Filtering: search query + price band ──
  // Smart price-aware search:
  //   "5"        → exact price 5
  //   "ksh 5"    → exact price 5
  //   "5 ksh"    → exact price 5
  //   "<100"     → prices below 100
  //   ">=200"    → prices 200 or more
  //   "100-300"  → range
  //   "passport" → name search (fuzzy)
  //   anything else → fuzzy name + category match
  const rawQuery = searchQuery.trim();
  const q = rawQuery.toLowerCase();

  // Strip currency words (ksh, kes, sh, /=) and whitespace to spot a numeric query
  const cleanedForNumber = q
    .replace(/k(sh|es)?|sh|\/=|=|kenya/gi, "")
    .replace(/\s+/g, "")
    .trim();

  type PriceQuery =
    | { kind: "exact"; n: number }
    | { kind: "lt" | "lte" | "gt" | "gte"; n: number }
    | { kind: "range"; from: number; to: number }
    | { kind: "none" };

  const parsePriceQuery = (input: string): PriceQuery => {
    if (!input) return { kind: "none" };
    // range: 100-300, 100 to 300, 100..300
    const rangeMatch = input.match(/^(\d+)\s*(?:-|to|\.\.)\s*(\d+)$/);
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10);
      const to = parseInt(rangeMatch[2], 10);
      return {
        kind: "range",
        from: Math.min(from, to),
        to: Math.max(from, to),
      };
    }
    // operators: <100, <=100, >100, >=100
    const opMatch = input.match(/^(<=|>=|<|>)\s*(\d+)$/);
    if (opMatch) {
      const n = parseInt(opMatch[2], 10);
      const op = opMatch[1] as "<" | "<=" | ">" | ">=";
      const kindMap = { "<": "lt", "<=": "lte", ">": "gt", ">=": "gte" } as const;
      return { kind: kindMap[op], n };
    }
    // pure number
    if (/^\d+$/.test(input)) {
      return { kind: "exact", n: parseInt(input, 10) };
    }
    return { kind: "none" };
  };

  const priceQuery = parsePriceQuery(cleanedForNumber);

  const matchesPriceQuery = (priceStr: string): boolean => {
    if (priceQuery.kind === "none") return false;
    const n = parseInt(priceStr, 10);
    if (Number.isNaN(n)) return false;
    if (priceQuery.kind === "exact") return n === priceQuery.n;
    if (priceQuery.kind === "lt") return n < priceQuery.n;
    if (priceQuery.kind === "lte") return n <= priceQuery.n;
    if (priceQuery.kind === "gt") return n > priceQuery.n;
    if (priceQuery.kind === "gte") return n >= priceQuery.n;
    if (priceQuery.kind === "range")
      return n >= priceQuery.from && n <= priceQuery.to;
    return false;
  };

  const matchesPriceFilter = (priceStr: string) => {
    if (priceFilter === "all") return true;
    if (priceFilter === "contact")
      return priceStr === "Contact us" || priceStr === "-";
    const n = parseInt(priceStr, 10);
    if (Number.isNaN(n)) return false;
    if (priceFilter === "u100") return n < 100;
    if (priceFilter === "100-300") return n >= 100 && n <= 300;
    if (priceFilter === "300-500") return n > 300 && n <= 500;
    if (priceFilter === "500p") return n > 500;
    return true;
  };

  const matchesTextSearch = (cat: Category, svc: { name: string; price: string }): boolean => {
    if (!q) return true;
    // Smart price match (exact / range / operators) takes priority
    if (priceQuery.kind !== "none") {
      return matchesPriceQuery(svc.price);
    }
    // Fallback: fuzzy text search (name / category / raw price string)
    return (
      svc.name.toLowerCase().includes(q) ||
      cat.title.toLowerCase().includes(q) ||
      svc.price.toLowerCase().includes(q)
    );
  };

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      services: cat.services.filter(
        (s) => matchesPriceFilter(s.price) && matchesTextSearch(cat, s)
      ),
    }))
    .filter((cat) => cat.services.length > 0);

  const totalMatches = filteredCategories.reduce(
    (sum, cat) => sum + cat.services.length,
    0
  );

  const PRICE_FILTERS = [
    { id: "all", label: "All" },
    { id: "u100", label: "Under 100" },
    { id: "100-300", label: "100 – 300" },
    { id: "300-500", label: "300 – 500" },
    { id: "500p", label: "500+" },
    { id: "contact", label: "Contact us" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: BUSINESS.name,
    description:
      "Professional cyber services in Kenya offering business registration, government services, travel documents, web design, and printing.",
    url: "https://tecxpert-cyber.netlify.app",
    telephone: BUSINESS.phone.replace(/\s/g, ""),
    priceRange: "$$",
    areaServed: {
      "@type": "Country",
      name: "Kenya",
    },
    serviceType: [
      "Business Registration",
      "KRA PIN Registration",
      "Passport Application",
      "Visa Application",
      "Web Design",
      "Printing Services",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: BUSINESS.phone.replace(/\s/g, ""),
      contactType: "customer service",
      availableLanguage: ["English", "Swahili"],
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      <script
        type="application/ld+json"
        // Escape `<` so that no admin-set value (e.g. business name containing
        // `</script>`) can ever break out of the script tag — XSS-safe.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, "\\u003c")
            .replace(/-->/g, "--\\u003e")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029"),
        }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-16 px-6 border-b border-slate-800">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent -z-10" />

        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-medium tracking-widest text-blue-400 uppercase bg-blue-400/10 rounded-full border border-blue-400/20">
              Professional Cyber Services
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
              {BUSINESS.servicesHeroTitle || "TECXPERT CYBER SERVICES"}
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
              {BUSINESS.servicesHeroSubtitle ||
                "Fast, reliable, and affordable digital solutions for all your business, government, and personal documentation needs."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href={`https://wa.me/${BUSINESS.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]"
            >
              <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Order via WhatsApp
            </a>
            <a
              href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all"
            >
              <Phone className="w-5 h-5" />
              Call Us Now
            </a>
            <a
              href={`mailto:${primaryEmail}`}
              className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all"
            >
              <Mail className="w-5 h-5" />
              Email Us
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-sm text-slate-500"
          >
            <span className="text-slate-400">{BUSINESS.phone}</span>
            <span className="mx-2 text-slate-700">•</span>
            <a
              href={`mailto:${primaryEmail}`}
              className="text-slate-400 hover:text-blue-400 transition-colors underline-offset-4 hover:underline"
            >
              {primaryEmail}
            </a>
          </motion.p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        {/* Multi-select tip banner */}
        {!loading && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 max-w-2xl mx-auto"
          >
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-blue-500/10 border border-blue-500/20">
              <ShoppingCart className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300 leading-relaxed">
                <span className="font-semibold text-white">Order multiple services at once:</span>{" "}
                tap any service below to add it to your order, then send the
                complete list to us via WhatsApp or email in one go.
              </p>
            </div>
          </motion.div>
        )}

        {/* Search Bar */}
        {!loading && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 max-w-2xl mx-auto"
          >
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Try: passport · ksh 5 · 200 · <100 · 100-300"
                className="w-full pl-12 pr-12 py-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                aria-label="Search services"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white rounded-full hover:bg-slate-800 transition-all"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Smart-parser tip pill — appears when input is numeric */}
            {searchQuery && priceQuery.kind !== "none" && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 rounded-full">
                  <Search className="w-3 h-3" />
                  Searching by price:{" "}
                  <span className="font-semibold text-yellow-200">
                    {priceQuery.kind === "exact" && `= ${priceQuery.n} Ksh`}
                    {priceQuery.kind === "lt" && `< ${priceQuery.n} Ksh`}
                    {priceQuery.kind === "lte" && `≤ ${priceQuery.n} Ksh`}
                    {priceQuery.kind === "gt" && `> ${priceQuery.n} Ksh`}
                    {priceQuery.kind === "gte" && `≥ ${priceQuery.n} Ksh`}
                    {priceQuery.kind === "range" &&
                      `${priceQuery.from} – ${priceQuery.to} Ksh`}
                  </span>
                </span>
              </div>
            )}

            {/* Quick price suggestions — show only when input is empty/short */}
            {!searchQuery && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="text-slate-500">Quick search:</span>
                {["5", "20", "50", "200", "500", "<100", "100-300"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSearchQuery(s)}
                    className="px-2.5 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full border border-slate-700/50 hover:border-slate-600 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {searchQuery && (
              <p className="mt-3 text-center text-sm text-slate-400">
                {totalMatches > 0 ? (
                  <>
                    Found{" "}
                    <span className="text-blue-400 font-semibold">
                      {totalMatches}
                    </span>{" "}
                    {totalMatches === 1 ? "service" : "services"} matching{" "}
                    <span className="text-white">&ldquo;{searchQuery}&rdquo;</span>
                  </>
                ) : (
                  <>
                    No services found for{" "}
                    <span className="text-white">&ldquo;{searchQuery}&rdquo;</span>
                  </>
                )}
              </p>
            )}
          </motion.div>
        )}

        {/* Price Filter Chips */}
        {!loading && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold mr-1">
                Filter by price:
              </span>
              {PRICE_FILTERS.map((f) => {
                const active = priceFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setPriceFilter(f.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                      active
                        ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
              {priceFilter !== "all" && (
                <button
                  onClick={() => setPriceFilter("all")}
                  className="px-2 py-1.5 text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="ml-3 text-slate-400">Loading services...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-12 h-12 text-slate-700 mb-4" />
            <p className="text-slate-400 text-lg mb-2">No matching services</p>
            <p className="text-slate-500 text-sm mb-6">
              Try a different keyword or contact us for custom services.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-semibold transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCategories.map((category, idx) => {
              const Icon = ICON_MAP[category.iconName];
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex flex-col"
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-t-2xl border-t border-l border-r border-slate-800",
                      category.bg
                    )}
                  >
                    {Icon && <Icon className={cn("w-6 h-6", category.color)} />}
                    <h2 className="text-xl font-bold text-slate-100">
                      {highlightMatch(category.title, searchQuery)}
                    </h2>
                    <span className="ml-auto text-xs text-slate-500 bg-slate-900/60 px-2 py-1 rounded-full">
                      {category.services.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-4 rounded-b-2xl border-b border-l border-r border-slate-800 bg-slate-900/30 backdrop-blur-sm">
                    {category.services.map((service, sIdx) => {
                      const key = `${category.id}::${service.name}`;
                      return (
                        <ServiceCard
                          key={sIdx}
                          name={service.name}
                          price={service.price}
                          query={searchQuery}
                          selected={!!selected[key]}
                          priceMatched={
                            priceQuery.kind !== "none" &&
                            matchesPriceQuery(service.price)
                          }
                          onToggle={() =>
                            toggleSelect(
                              String(category.id),
                              category.title,
                              service.name,
                              service.price
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Why Choose Us Section */}
      <section className="bg-slate-900/50 py-20 px-6 border-y border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              {BUSINESS.whyTitle || "Why Choose Us?"}
            </h2>
            <p className="text-slate-400">
              {BUSINESS.whySubtitle ||
                "We make complicated processes simple and fast."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: CheckCircle2,
                title: BUSINESS.whyFeature1Title || "Reliable & Secure",
                desc:
                  BUSINESS.whyFeature1Desc ||
                  "Your documents and data are handled with the utmost security and confidentiality.",
              },
              {
                icon: MousePointer2,
                title: BUSINESS.whyFeature2Title || "Extremely Fast",
                desc:
                  BUSINESS.whyFeature2Desc ||
                  "We value your time. Most services are completed within minutes or hours.",
              },
              {
                icon: CreditCard,
                title: BUSINESS.whyFeature3Title || "Best Prices",
                desc:
                  BUSINESS.whyFeature3Desc ||
                  "Quality service doesn't have to be expensive. We offer the most competitive rates.",
              },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-400 mb-5">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 text-center bg-slate-950 border-t border-slate-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">
            {BUSINESS.ctaSectionTitle || "Ready to get started?"}
          </h2>
          <p className="text-slate-400 mb-8">
            {BUSINESS.ctaSectionSubtitle ||
              "Don't wait in long queues. Contact us today and let us handle the paperwork for you!"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={`https://wa.me/${BUSINESS.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
            <a
              href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all"
            >
              <Phone className="w-5 h-5" />
              Call
            </a>
            <a
              href={`mailto:${primaryEmail}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all"
            >
              <Mail className="w-5 h-5" />
              Email
            </a>
          </div>
          <div className="mt-6 text-slate-500 text-sm space-y-1">
            <p>📞 {BUSINESS.phone}</p>
            <p>
              ✉️{" "}
              <a
                href={`mailto:${primaryEmail}`}
                className="hover:text-blue-400 transition-colors"
              >
                {primaryEmail}
              </a>
            </p>
          </div>
          <p className="mt-8 text-slate-600 text-sm">
            © {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ───── Floating Cart Bar ───── */}
      <AnimatedCartBar
        count={selectedList.length}
        total={totalEstimate}
        onOpen={() => setShowCart(true)}
        onClear={clearSelection}
      />

      {/* ───── Cart / Order Modal ───── */}
      <CartModal
        open={showCart}
        items={selectedList}
        total={totalEstimate}
        business={BUSINESS}
        orderMessage={orderMessage}
        whatsappUrl={whatsappUrl}
        emailUrl={emailUrl}
        onClose={() => setShowCart(false)}
        onClear={clearSelection}
        onRemove={(key) =>
          setSelected((prev) => {
            const n = { ...prev };
            delete n[key];
            return n;
          })
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating cart bar — visible whenever 1+ services are selected
// ─────────────────────────────────────────────────────────────
function AnimatedCartBar({
  count,
  total,
  onOpen,
  onClear,
}: {
  count: number;
  total: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl"
    >
      <div className="flex items-center gap-3 p-3 sm:p-4 bg-slate-900/95 backdrop-blur-md border border-blue-500/40 rounded-2xl shadow-2xl shadow-blue-500/20">
        <button
          onClick={onClear}
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <ShoppingCart className="w-6 h-6 text-blue-400" />
            <span className="absolute -top-2 -right-2 w-5 h-5 text-[10px] font-bold bg-emerald-500 text-white rounded-full flex items-center justify-center">
              {count}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {count} service{count === 1 ? "" : "s"} selected
            </p>
            {total > 0 && (
              <p className="text-xs text-slate-400">
                Estimate: <span className="text-blue-400 font-semibold">{total} Ksh</span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onOpen}
          className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/30 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send Order</span>
          <span className="sm:hidden">Send</span>
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cart / Order Modal — multi-step flow:
//   step "review"  → list of items + Continue
//   step "choice"  → Pay before / Pay after radio
//   step "pay"     → enter phone, STK push, poll status
//   step "send"    → final WhatsApp / Email choice
// ─────────────────────────────────────────────────────────────

type CartStep = "review" | "choice" | "pay" | "send";
type PayChoice = "before" | "after" | null;
type PayStatus =
  | "idle"
  | "sending"
  | "waiting"
  | "success"
  | "cancelled"
  | "timeout"
  | "failed";

function CartModal({
  open,
  items,
  total,
  business,
  orderMessage,
  whatsappUrl,
  emailUrl,
  onClose,
  onClear,
  onRemove,
}: {
  open: boolean;
  items: SelectedService[];
  total: number;
  business: ClientSiteSettings;
  orderMessage: string;
  whatsappUrl: string;
  emailUrl: string;
  onClose: () => void;
  onClear: () => void;
  onRemove: (key: string) => void;
}) {
  const [step, setStep] = useState<CartStep>("review");
  const [payChoice, setPayChoice] = useState<PayChoice>(null);
  const [phone, setPhone] = useState("");
  const [payStatus, setPayStatus] = useState<PayStatus>("idle");
  const [payError, setPayError] = useState<string>("");
  const [demoMode, setDemoMode] = useState(false);
  const [pollSecondsLeft, setPollSecondsLeft] = useState(60);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("review");
        setPayChoice(null);
        setPhone("");
        setPayStatus("idle");
        setPayError("");
        setDemoMode(false);
        setPollSecondsLeft(60);
      }, 250);
    }
  }, [open]);

  const mpesaOn = business.mpesaEnabled !== false;
  const stkAvailable = !!business.mpesaStkConfigured;

  const handleStartPayment = async () => {
    setPayStatus("sending");
    setPayError("");
    setDemoMode(false);
    try {
      const res = await fetch("/api/payment/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          amount: total,
          reference: business.mpesaAccountNumber || "ORDER",
          description: business.name?.slice(0, 13) || "Order",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setPayStatus("failed");
        setPayError(data.error || "Payment request failed");
        return;
      }
      if (data.demo) {
        // No Daraja credentials — fall back to manual paybill instructions
        setDemoMode(true);
        setPayStatus("idle");
        return;
      }
      // Real STK push initiated → poll
      setPayStatus("waiting");
      setPollSecondsLeft(60);
      pollPaymentStatus(data.checkoutRequestId);
    } catch (err) {
      setPayStatus("failed");
      setPayError(err instanceof Error ? err.message : "Network error");
    }
  };

  const pollPaymentStatus = async (checkoutRequestId: string) => {
    let elapsed = 0;
    const interval = 4; // poll every 4 seconds
    const maxWait = 60;

    const tick = async (): Promise<void> => {
      if (elapsed >= maxWait) {
        setPayStatus("timeout");
        return;
      }
      try {
        const res = await fetch("/api/payment/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutRequestId }),
        });
        const data = await res.json();
        if (data.status === "success") {
          setPayStatus("success");
          return;
        }
        if (data.status === "cancelled") {
          setPayStatus("cancelled");
          setPayError("You cancelled the payment");
          return;
        }
        if (data.status === "failed") {
          setPayStatus("failed");
          setPayError(data.resultDesc || "Payment failed (insufficient funds?)");
          return;
        }
      } catch {
        /* keep polling */
      }
      elapsed += interval;
      setPollSecondsLeft(maxWait - elapsed);
      setTimeout(tick, interval * 1000);
    };
    tick();
  };

  const goSendOrder = () => {
    setStep("send");
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {step !== "review" && (
              <button
                onClick={() => {
                  if (step === "send") setStep("choice");
                  else if (step === "pay") setStep("choice");
                  else setStep("review");
                  setPayStatus("idle");
                  setPayError("");
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              {step === "pay" ? (
                <Smartphone className="w-5 h-5 text-emerald-400" />
              ) : step === "send" ? (
                <Send className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-white truncate">
                {step === "review" && "Your Order"}
                {step === "choice" && "How would you like to pay?"}
                {step === "pay" && "M-Pesa Payment"}
                {step === "send" && "Send Order"}
              </h2>
              <p className="text-xs text-slate-400">
                {items.length} item{items.length === 1 ? "" : "s"}
                {total > 0 && ` · ${total} Ksh`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — switch on step */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── REVIEW STEP ─── */}
          {step === "review" && (
            <div className="p-5 space-y-2">
              {items.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No items selected</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-800 rounded-xl group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-semibold text-blue-400">
                        {item.price === "Contact us" || item.price === "-"
                          ? item.price
                          : `${item.price} Ksh`}
                      </span>
                      <button
                        onClick={() => onRemove(item.key)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── PAY CHOICE STEP ─── */}
          {step === "choice" && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-400 mb-2">
                Choose how you&apos;d like to handle payment:
              </p>

              {mpesaOn && (
                <button
                  onClick={() => setPayChoice("before")}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 text-left transition-all",
                    payChoice === "before"
                      ? "bg-emerald-500/10 border-emerald-500"
                      : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white">
                        Pay first via M-Pesa
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {stkAvailable
                          ? "Get a popup on your phone, enter your PIN, and the money is deducted instantly."
                          : `Send ${total > 0 ? total + " Ksh" : "the amount"} to Paybill ${business.mpesaPaybill}, Account ${business.mpesaAccountNumber}.`}
                      </p>
                      <span className="inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-semibold">
                        Recommended
                      </span>
                    </div>
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        payChoice === "before"
                          ? "bg-emerald-500 border-emerald-500"
                          : "border-slate-600"
                      )}
                    >
                      {payChoice === "before" && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </span>
                  </div>
                </button>
              )}

              <button
                onClick={() => setPayChoice("after")}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-left transition-all",
                  payChoice === "after"
                    ? "bg-blue-500/10 border-blue-500"
                    : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">Pay after</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Send the order first, then pay when you collect or by
                      arrangement with us.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                      payChoice === "after"
                        ? "bg-blue-500 border-blue-500"
                        : "border-slate-600"
                    )}
                  >
                    {payChoice === "after" && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* ─── PAY STEP ─── */}
          {step === "pay" && (
            <div className="p-5 space-y-4">
              {/* Manual paybill instructions (always visible as backup) */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  Manual M-Pesa Payment
                </p>
                <div className="space-y-1 text-sm">
                  <Row label="Paybill" value={business.mpesaPaybill || "—"} />
                  <Row label="Account No." value={business.mpesaAccountNumber || "—"} />
                  <Row
                    label="Amount"
                    value={total > 0 ? `${total} Ksh` : "Discuss with us"}
                  />
                </div>
                {business.mpesaInstructions && (
                  <p className="mt-3 text-xs text-slate-400">
                    {business.mpesaInstructions}
                  </p>
                )}
              </div>

              {stkAvailable ? (
                /* Real STK push UI */
                <div className="space-y-4">
                  {payStatus === "idle" && (
                    <>
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-sm text-emerald-300 font-semibold mb-1">
                          ⚡ Instant pay via STK Push
                        </p>
                        <p className="text-xs text-emerald-400/80">
                          Enter your M-Pesa phone — we&apos;ll send a popup
                          asking for your PIN.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Your M-Pesa Phone Number
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="0712345678"
                            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            autoFocus
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          Format: 0712345678 or 254712345678
                        </p>
                      </div>
                      <button
                        onClick={handleStartPayment}
                        disabled={!phone.trim() || total <= 0}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Smartphone className="w-4 h-4" />
                        Send Payment Request
                      </button>
                    </>
                  )}

                  {payStatus === "sending" && (
                    <div className="p-6 text-center space-y-3">
                      <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
                      <p className="text-sm text-white font-semibold">
                        Sending request…
                      </p>
                      <p className="text-xs text-slate-400">
                        Reaching Safaricom servers
                      </p>
                    </div>
                  )}

                  {payStatus === "waiting" && (
                    <div className="p-6 text-center space-y-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <Smartphone className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
                      <p className="text-sm text-white font-bold">
                        📱 Check your phone now
                      </p>
                      <p className="text-xs text-slate-300">
                        A popup is asking you to enter your M-Pesa PIN.
                        <br />
                        Waiting for confirmation…{" "}
                        <span className="text-emerald-400 font-semibold">
                          {pollSecondsLeft}s
                        </span>
                      </p>
                      <div className="flex justify-center gap-1 pt-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}

                  {payStatus === "success" && (
                    <div className="p-6 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto">
                        <Check className="w-8 h-8 text-white" strokeWidth={3} />
                      </div>
                      <p className="text-base text-white font-bold">
                        Payment received! 🎉
                      </p>
                      <p className="text-xs text-emerald-400">
                        Now send your order so we can start processing.
                      </p>
                      <button
                        onClick={goSendOrder}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Continue → Send Order
                      </button>
                    </div>
                  )}

                  {(payStatus === "cancelled" ||
                    payStatus === "timeout" ||
                    payStatus === "failed") && (
                    <div className="p-5 text-center space-y-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                      <p className="text-sm text-white font-semibold">
                        {payStatus === "cancelled" && "Payment cancelled"}
                        {payStatus === "timeout" && "Took too long"}
                        {payStatus === "failed" && "Payment failed"}
                      </p>
                      {payError && (
                        <p className="text-xs text-red-300">{payError}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setPayStatus("idle");
                            setPayError("");
                          }}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={goSendOrder}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold"
                        >
                          Skip & Send Order
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No Daraja credentials → manual-only flow */
                <div className="space-y-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                    💡 After paying via the steps above, click below to send
                    your order details. We&apos;ll confirm receipt of payment.
                  </div>
                  <button
                    onClick={goSendOrder}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    I&apos;ve Paid — Continue
                  </button>
                </div>
              )}

              {demoMode && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                  ⚠️ STK Push not configured by admin. Please pay using the
                  paybill above, then continue.
                </div>
              )}
            </div>
          )}

          {/* ─── SEND STEP ─── */}
          {step === "send" && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-300">
                {payStatus === "success" ? (
                  <>
                    <span className="text-emerald-400 font-semibold">
                      ✓ Payment confirmed.
                    </span>{" "}
                    Choose how to send your order to us:
                  </>
                ) : (
                  "Choose how to send your order to us:"
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/*
                  Real <a> tags so the browser treats them as user navigation
                  (no popup blocker). target=_blank for WhatsApp opens a new
                  tab so the customer doesn't lose their cart.
                */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(onClose, 300)}
                  className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
                <a
                  href={emailUrl}
                  onClick={() => setTimeout(onClose, 300)}
                  className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              </div>

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-300">
                  Preview message
                </summary>
                <pre className="mt-2 p-3 bg-slate-800/50 border border-slate-800 rounded-lg whitespace-pre-wrap text-[11px] text-slate-400">
                  {orderMessage}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Footer — only on review and choice */}
        {(step === "review" || step === "choice") && (
          <div className="p-5 border-t border-slate-800 space-y-3 flex-shrink-0 bg-slate-900">
            {total > 0 && step === "review" && (
              <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <span className="text-sm text-slate-300">Total</span>
                <span className="text-lg font-bold text-blue-400">
                  {total} Ksh
                </span>
              </div>
            )}

            {step === "review" && (
              <button
                onClick={() => setStep("choice")}
                disabled={items.length === 0}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                Continue to Checkout
                <Send className="w-4 h-4" />
              </button>
            )}

            {step === "choice" && (
              <button
                onClick={() => {
                  if (payChoice === "before") setStep("pay");
                  else if (payChoice === "after") setStep("send");
                }}
                disabled={!payChoice}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                Continue
                <Send className="w-4 h-4" />
              </button>
            )}

            {step === "review" && (
              <button
                onClick={() => {
                  onClear();
                  onClose();
                }}
                className="w-full py-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                Clear all and start over
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-white font-mono font-semibold flex items-center gap-1.5">
        <Banknote className="w-3 h-3 text-emerald-400" />
        {value}
      </span>
    </div>
  );
}
