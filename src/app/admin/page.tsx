"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  LogOut,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  Database,
  HardDrive,
  Cloud,
  WifiOff,
  Search,
  FolderPlus,
  LayoutDashboard,
  Settings,
  ListOrdered,
  Menu,
  Users,
  TrendingUp,
  RefreshCw,
  Globe,
  Clock,
  Activity,
  Lightbulb,
  MessageSquare,
  ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DatabaseSetupWizard from "@/components/DatabaseSetupWizard";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";

// ── Types ─────────────────────────────────────────────────────

interface Category {
  id: string | number;
  title: string;
  iconName: string;
  color: string;
  bg: string;
  services: { id?: number; name: string; price: string }[];
}

interface AdminStats {
  storage: string;
  source?: string | null;
  persistent: boolean;
  alive?: boolean;        // did the actual DB respond?
  error?: string | null;  // human-readable error if not alive
  checkedAt?: string;
  visitors: { uniqueIps: number; totalPageViews: number; lastVisit: string };
  totals: { categories: number; services: number };
}

type Tab = "dashboard" | "services" | "visitors" | "suggestions" | "security" | "settings" | "database" | "account";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType; desc: string }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & quick actions" },
  { id: "services", label: "Services & Prices", icon: ListOrdered, desc: "Manage your price list" },
  { id: "visitors", label: "Visitors", icon: Users, desc: "Who's visited your site" },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb, desc: "What customers asked for" },
  { id: "security", label: "Security", icon: Shield, desc: "Visit log, lockouts & blocked IPs" },
  { id: "settings", label: "Site Settings", icon: Settings, desc: "Name, phone, emails, hero text" },
  { id: "database", label: "Database", icon: Database, desc: "Connect a persistent storage" },
  { id: "account", label: "Account", icon: KeyRound, desc: "Change admin password" },
];

// ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Services tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string | number>>(new Set());
  const [editingPrice, setEditingPrice] = useState<{ catId: string | number; svcIdx: number } | null>(null);
  const [editingName, setEditingName] = useState<{ catId: string | number; svcIdx: number } | null>(null);
  const [newPrices, setNewPrices] = useState<Record<string, string>>({});
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalCat, setAddModalCat] = useState<string | number | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  // Add Category modal
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatIcon, setNewCatIcon] = useState<string>("Briefcase");
  const [newCatColor, setNewCatColor] = useState<string>("blue");

  // DB wizard
  const [showDbWizard, setShowDbWizard] = useState(false);

  // Account/password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── Auth ──
  useEffect(() => {
    const saved = localStorage.getItem("tecxpert_admin_token");
    if (saved) setToken(saved);
  }, []);

  const showMsg = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      const data = await res.json();
      if (data.categories) {
        setCategories(data.categories);
        setExpandedCats(new Set(data.categories.map((c: Category) => c.id)));
      }
    } catch {
      showMsg("Failed to load services", "error");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchServices();
      fetchStats();
      const interval = setInterval(fetchStats, 30000); // refresh stats every 30s
      return () => clearInterval(interval);
    }
  }, [token, fetchServices, fetchStats]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("tecxpert_admin_token", data.token);
        setToken(data.token);
        setPassword("");
        // If the server flagged any setup warnings (default password,
        // missing ADMIN_SECRET, etc.) surface them as an info toast.
        if (data.warning) {
          setTimeout(() => {
            setMessage("ℹ️ " + data.warning);
            setMessageType("error"); // amber-style toast
            setTimeout(() => setMessage(""), 8000);
          }, 500);
        }
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch {
      setLoginError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tecxpert_admin_token");
    setToken(null);
    setCategories([]);
    setStats(null);
  };

  /**
   * "Logout from all devices" — calls the server to bump the token version,
   * which invalidates every JWT we've ever issued. Then clears the local
   * session too.
   */
  const handleLogoutAll = async () => {
    if (
      !confirm(
        "Log out from EVERY device that's currently signed in to admin?\n\nThis will sign you out here too. Anyone with a stolen token will lose access immediately."
      )
    )
      return;
    try {
      await fetch("/api/admin/logout-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* ignore — we still log out locally */
    }
    handleLogout();
  };

  // ── Service CRUD ──
  const apiPost = async (body: object) => {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleUpdatePrice = async (catId: string | number, svcIdx: number, serviceId?: number) => {
    const key = `${catId}-${svcIdx}`;
    const price = newPrices[key];
    if (!price || !serviceId) {
      setEditingPrice(null);
      return;
    }
    setLoading(true);
    const data = await apiPost({ action: "updatePrice", id: serviceId, price });
    setLoading(false);
    if (data.success) {
      showMsg("Price updated");
      setEditingPrice(null);
      fetchServices();
    } else showMsg(data.error || "Failed to update", "error");
  };

  const handleUpdateName = async (catId: string | number, svcIdx: number, serviceId?: number) => {
    const key = `${catId}-${svcIdx}`;
    const name = newNames[key];
    if (!name || !serviceId) {
      setEditingName(null);
      return;
    }
    setLoading(true);
    const data = await apiPost({ action: "updateServiceName", id: serviceId, name });
    setLoading(false);
    if (data.success) {
      showMsg("Name updated");
      setEditingName(null);
      fetchServices();
    } else showMsg(data.error || "Failed to update", "error");
  };

  const handleDelete = async (serviceId: number) => {
    if (!confirm("Delete this service?")) return;
    setLoading(true);
    const data = await apiPost({ action: "deleteService", id: serviceId });
    setLoading(false);
    if (data.success) {
      showMsg("Service deleted");
      fetchServices();
    } else showMsg(data.error || "Failed to delete", "error");
  };

  const handleAddService = async () => {
    if (!addModalCat || !newServiceName.trim() || !newServicePrice.trim()) return;
    const cat = categories.find((c) => c.id === addModalCat);
    if (!cat) return;
    setLoading(true);
    const data = await apiPost({
      action: "addService",
      categoryId: addModalCat,
      name: newServiceName.trim(),
      price: newServicePrice.trim(),
      sortOrder: cat.services.length,
    });
    setLoading(false);
    if (data.success) {
      showMsg("Service added");
      setShowAddModal(false);
      setNewServiceName("");
      setNewServicePrice("");
      setAddModalCat(null);
      fetchServices();
    } else showMsg(data.error || "Failed to add", "error");
  };

  const handleAddCategory = async () => {
    if (!newCatTitle.trim()) return;
    const colorMap: Record<string, { color: string; bg: string }> = {
      blue: { color: "text-blue-400", bg: "bg-blue-400/10" },
      emerald: { color: "text-emerald-400", bg: "bg-emerald-400/10" },
      purple: { color: "text-purple-400", bg: "bg-purple-400/10" },
      amber: { color: "text-amber-400", bg: "bg-amber-400/10" },
      rose: { color: "text-rose-400", bg: "bg-rose-400/10" },
      cyan: { color: "text-cyan-400", bg: "bg-cyan-400/10" },
      orange: { color: "text-orange-400", bg: "bg-orange-400/10" },
      pink: { color: "text-pink-400", bg: "bg-pink-400/10" },
    };
    const { color, bg } = colorMap[newCatColor] || colorMap.blue;
    setLoading(true);
    const data = await apiPost({
      action: "addCategory",
      title: newCatTitle.trim(),
      iconName: newCatIcon,
      color,
      bg,
      sortOrder: categories.length,
    });
    setLoading(false);
    if (data.success) {
      showMsg("Category added");
      setShowAddCategory(false);
      setNewCatTitle("");
      setNewCatIcon("Briefcase");
      setNewCatColor("blue");
      fetchServices();
    } else showMsg(data.error || "Failed to add category", "error");
  };

  const handleDeleteCategory = async (catId: string | number, catTitle: string) => {
    if (!confirm(`Delete category "${catTitle}" and ALL its services?\nThis cannot be undone.`))
      return;
    setLoading(true);
    const data = await apiPost({ action: "deleteCategory", id: catId });
    setLoading(false);
    if (data.success) {
      showMsg("Category deleted");
      fetchServices();
    } else showMsg(data.error || "Failed to delete", "error");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return showMsg("Passwords do not match", "error");
    if (newPassword.length < 4) return showMsg("Password must be at least 4 characters", "error");
    setLoading(true);
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      showMsg("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else showMsg(data.error || "Failed to change password", "error");
  };

  const toggleCat = (id: string | number) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatTime = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // ─────────────── LOGIN SCREEN ───────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-white mb-2">Admin Panel</h1>
            <p className="text-slate-400 text-center mb-8 text-sm">Manage your website</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    autoFocus
                  />
                </div>
              </div>
              {loginError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
            <p className="text-center text-slate-500 text-xs mt-6">
              Default password: <span className="text-slate-400 font-mono">cyber</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────── DASHBOARD ───────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Sidebar overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 p-5 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base">Admin Panel</h1>
            <p className="text-xs text-slate-400 truncate">
              {stats?.persistent ? "● Persistent" : "● Ephemeral"} storage
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                  active
                    ? "bg-blue-500/15 text-white"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <Icon
                  className={cn("w-5 h-5 flex-shrink-0 mt-0.5", active && "text-blue-400")}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{t.desc}</p>
                </div>
                {active && <span className="w-1 h-6 bg-blue-400 rounded-full flex-shrink-0" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Logout (this device)
          </button>
          <button
            onClick={handleLogoutAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-semibold"
            title="Sign out every device that's currently logged in to admin"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout EVERYWHERE
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-base sm:text-lg truncate">
                {TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-xs text-slate-400 hidden sm:block">
                {TABS.find((t) => t.id === tab)?.desc}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View site
            </a>
          </div>
        </header>

        {/* Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2",
                messageType === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              )}
            >
              {messageType === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {/* DASHBOARD TAB */}
          {tab === "dashboard" && (
            <div className="space-y-6 max-w-5xl">
              {/* Persistence banner — based on REAL liveness probe */}
              {(() => {
                const isAlive = stats?.alive === true;
                const isPersistent = stats?.persistent === true;
                const isConfiguredButDown =
                  stats?.storage !== "json-file" && stats !== null && !isAlive;

                let tone: "good" | "bad" | "down";
                if (isPersistent) tone = "good";
                else if (isConfiguredButDown) tone = "down";
                else tone = "bad";

                const wrapCls = cn(
                  "p-4 rounded-2xl border flex items-start sm:items-center gap-3 flex-col sm:flex-row",
                  tone === "good"
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : tone === "down"
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                );

                const Icon =
                  tone === "good" ? Cloud : tone === "down" ? AlertCircle : WifiOff;
                const iconCls =
                  tone === "good"
                    ? "text-emerald-400"
                    : tone === "down"
                      ? "text-red-400"
                      : "text-amber-400";
                const titleCls =
                  tone === "good"
                    ? "text-emerald-400"
                    : tone === "down"
                      ? "text-red-400"
                      : "text-amber-400";
                const subCls =
                  tone === "good"
                    ? "text-emerald-400/60"
                    : tone === "down"
                      ? "text-red-400/70"
                      : "text-amber-400/70";

                let title: string;
                let sub: string;
                if (tone === "good") {
                  title = `✓ Connected & persistent — ${
                    stats!.storage === "postgres"
                      ? "PostgreSQL"
                      : stats!.storage === "upstash-redis"
                        ? "Redis"
                        : "Database"
                  }`;
                  sub = `Live. Detected from ${stats!.source ?? "env"}. Last verified ${
                    stats?.checkedAt
                      ? new Date(stats.checkedAt).toLocaleTimeString()
                      : "just now"
                  }.`;
                } else if (tone === "down") {
                  title = `🔴 Database configured but NOT responding — ${stats!.storage}`;
                  sub = `Source: ${stats!.source ?? "env"}. ${
                    stats!.error ? `Error: ${stats!.error}` : "No reply from the database."
                  } Saves will FAIL until the connection is fixed.`;
                } else {
                  title = "⚠ Ephemeral storage (changes may reset)";
                  sub =
                    "No persistent database connected. Configure one to keep changes forever.";
                }

                const btnCls = cn(
                  "px-4 py-2 text-sm rounded-lg font-semibold transition-colors flex-shrink-0 w-full sm:w-auto",
                  tone === "good"
                    ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300"
                    : tone === "down"
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-amber-500 hover:bg-amber-400 text-slate-900"
                );

                return (
                  <div className={wrapCls}>
                    <div className="flex items-start sm:items-center gap-3 flex-1">
                      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0", iconCls)} />
                      <div>
                        <p className={cn("font-semibold text-sm", titleCls)}>{title}</p>
                        <p className={cn("text-xs mt-0.5", subCls)}>{sub}</p>
                      </div>
                    </div>
                    <button onClick={() => setTab("database")} className={btnCls}>
                      {tone === "good"
                        ? "Manage"
                        : tone === "down"
                          ? "Fix now →"
                          : "Setup now →"}
                    </button>
                  </div>
                );
              })()}

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Unique Visitors"
                  value={stats?.visitors.uniqueIps ?? "—"}
                  color="text-emerald-400"
                  bg="bg-emerald-500/10"
                  onClick={() => setTab("visitors")}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Total Page Views"
                  value={stats?.visitors.totalPageViews ?? "—"}
                  color="text-blue-400"
                  bg="bg-blue-500/10"
                  onClick={() => setTab("visitors")}
                />
                <StatCard
                  icon={ListOrdered}
                  label="Services"
                  value={stats?.totals.services ?? categories.reduce((s, c) => s + c.services.length, 0)}
                  color="text-purple-400"
                  bg="bg-purple-500/10"
                  onClick={() => setTab("services")}
                />
                <StatCard
                  icon={FolderPlus}
                  label="Categories"
                  value={stats?.totals.categories ?? categories.length}
                  color="text-amber-400"
                  bg="bg-amber-500/10"
                  onClick={() => setTab("services")}
                />
              </div>

              {stats?.visitors.lastVisit && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Eye className="w-3 h-3" />
                  Last visit: {formatTime(stats.visitors.lastVisit)}
                  <span className="text-slate-700">·</span>
                  <span>Auto-refreshing every 30 seconds</span>
                </div>
              )}

              {/* Quick actions */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4">Quick actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <QuickAction
                    icon={Plus}
                    title="Add a service"
                    desc="Create a new price entry"
                    onClick={() => {
                      setTab("services");
                      if (categories[0]) {
                        setAddModalCat(categories[0].id);
                        setShowAddModal(true);
                      }
                    }}
                  />
                  <QuickAction
                    icon={FolderPlus}
                    title="Add a category"
                    desc="Group related services"
                    onClick={() => {
                      setTab("services");
                      setShowAddCategory(true);
                    }}
                  />
                  <QuickAction
                    icon={Settings}
                    title="Edit site info"
                    desc="Phone, email, name…"
                    onClick={() => setTab("settings")}
                  />
                  <QuickAction
                    icon={Database}
                    title="Database setup"
                    desc="Make data permanent"
                    onClick={() => setTab("database")}
                  />
                  <QuickAction
                    icon={Users}
                    title="View visitors"
                    desc="See who's been on your site"
                    onClick={() => setTab("visitors")}
                  />
                  <QuickAction
                    icon={KeyRound}
                    title="Change password"
                    desc="Update admin login"
                    onClick={() => setTab("account")}
                  />
                  <QuickAction
                    icon={Eye}
                    title="View public site"
                    desc="Open as a customer"
                    onClick={() => window.open("/", "_blank")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SERVICES TAB */}
          {tab === "services" && (
            <div className="max-w-5xl">
              <ServicesTab
                categories={categories}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAddCategory={() => setShowAddCategory(true)}
                onAddService={(catId) => {
                  setAddModalCat(catId);
                  setShowAddModal(true);
                }}
                onDeleteCategory={handleDeleteCategory}
                onDeleteService={handleDelete}
                expandedCats={expandedCats}
                toggleCat={toggleCat}
                editingPrice={editingPrice}
                setEditingPrice={setEditingPrice}
                editingName={editingName}
                setEditingName={setEditingName}
                newPrices={newPrices}
                setNewPrices={setNewPrices}
                newNames={newNames}
                setNewNames={setNewNames}
                onUpdatePrice={handleUpdatePrice}
                onUpdateName={handleUpdateName}
              />
            </div>
          )}

          {/* SETTINGS TAB */}
          {tab === "settings" && (
            <div className="max-w-4xl">
              <SiteSettingsForm token={token} />
            </div>
          )}

          {/* DATABASE TAB */}
          {tab === "database" && (
            <div className="max-w-3xl space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Database Connection</h3>
                    <p className="text-xs text-slate-400">
                      Connect any Postgres or Redis to make data permanent
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-xl border mb-4",
                    stats?.persistent
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  {stats?.persistent ? (
                    <div className="flex items-start gap-2">
                      <Cloud className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-400 font-semibold text-sm">
                          ✓ Connected to {stats.storage === "postgres" ? "PostgreSQL" : "Redis"}
                        </p>
                        <p className="text-emerald-400/60 text-xs mt-0.5">
                          Source:{" "}
                          <code className="px-1 py-0.5 bg-emerald-500/20 rounded">
                            {stats.source}
                          </code>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <HardDrive className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-400 font-semibold text-sm">
                          ⚠ Using ephemeral local storage
                        </p>
                        <p className="text-amber-400/70 text-xs mt-0.5">
                          On serverless platforms (Vercel/Netlify) data may reset.
                          Connect a database below to fix this permanently.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowDbWizard(true)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  Open Database Setup Wizard
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-sm text-slate-400 space-y-3">
                <h4 className="font-bold text-white">How auto-detection works</h4>
                <p>
                  The site automatically scans for these environment variables (in order):
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><code>DATABASE_URL</code> — manual / generic Postgres URL</li>
                  <li><code>POSTGRES_URL</code> — Vercel Postgres / Supabase / Neon integration</li>
                  <li><code>POSTGRES_PRISMA_URL</code> — Vercel Postgres pooled</li>
                  <li><code>UPSTASH_REDIS_REST_URL</code> — Upstash Redis direct</li>
                  <li><code>KV_REST_API_URL</code> — Vercel KV integration</li>
                  <li><strong>Admin panel runtime config</strong> (set via wizard above)</li>
                </ul>
                <p className="text-xs text-slate-500">
                  The first one found wins. If you set the env var on Vercel and redeploy, it
                  will be auto-detected — no other action needed.
                </p>
              </div>
            </div>
          )}

          {/* VISITORS TAB */}
          {tab === "visitors" && (
            <div className="max-w-5xl">
              <VisitorsPanel token={token} />
            </div>
          )}

          {/* SUGGESTIONS TAB */}
          {tab === "suggestions" && (
            <div className="max-w-4xl">
              <SuggestionsPanel token={token} />
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === "security" && (
            <div className="max-w-5xl">
              <SecurityPanel token={token} />
            </div>
          )}

          {/* ACCOUNT TAB */}
          {tab === "account" && (
            <div className="max-w-md">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Change Password</h3>
                    <p className="text-xs text-slate-400">Update your admin login</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Current password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      New password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                      minLength={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <KeyRound className="w-5 h-5" />
                    )}
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Service Modal */}
      <AnimatePresence>
        {showAddModal && (
          <Modal onClose={() => setShowAddModal(false)} title="Add Service">
            <p className="text-slate-400 text-sm mb-4">
              Adding to:{" "}
              <span className="text-blue-400 font-semibold">
                {categories.find((c) => c.id === addModalCat)?.title}
              </span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Service Name
                </label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Business Registration"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Price
                </label>
                <input
                  type="text"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder='e.g. 500 or "Contact us"'
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddService}
                disabled={!newServiceName.trim() || !newServicePrice.trim() || loading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {showAddCategory && (
          <Modal onClose={() => setShowAddCategory(false)} title="Add Category" wide>
            <p className="text-slate-400 text-sm mb-4">
              Create a new section for grouping related services.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCatTitle}
                  onChange={(e) => setNewCatTitle(e.target.value)}
                  placeholder="e.g. Insurance Services"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Icon</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    "Briefcase",
                    "ShieldCheck",
                    "Globe",
                    "GraduationCap",
                    "Printer",
                    "Laptop",
                    "CreditCard",
                    "MousePointer2",
                  ].map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setNewCatIcon(iconName)}
                      className={cn(
                        "p-3 rounded-lg border text-xs font-medium transition-all",
                        newCatIcon === iconName
                          ? "bg-blue-500/20 border-blue-500 text-blue-300"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      {iconName.replace(/([A-Z])/g, " $1").trim()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "blue", cls: "bg-blue-400" },
                    { name: "emerald", cls: "bg-emerald-400" },
                    { name: "purple", cls: "bg-purple-400" },
                    { name: "amber", cls: "bg-amber-400" },
                    { name: "rose", cls: "bg-rose-400" },
                    { name: "cyan", cls: "bg-cyan-400" },
                    { name: "orange", cls: "bg-orange-400" },
                    { name: "pink", cls: "bg-pink-400" },
                  ].map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setNewCatColor(c.name)}
                      className={cn(
                        "w-9 h-9 rounded-full transition-all",
                        c.cls,
                        newCatColor === c.name
                          ? "ring-4 ring-offset-2 ring-offset-slate-900 ring-white scale-110"
                          : "opacity-60 hover:opacity-100"
                      )}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddCategory(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCatTitle.trim() || loading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                Create
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* DB Wizard */}
      <DatabaseSetupWizard
        open={showDbWizard}
        onClose={() => setShowDbWizard(false)}
        token={token}
        onConnected={() => {
          fetchStats();
          fetchServices();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper presentational components
// ─────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
            <Icon className={cn("w-4 h-4", color)} />
          </span>
          <p className="text-slate-400 text-xs uppercase tracking-wider truncate">{label}</p>
        </div>
        {onClick && (
          <ChevronDown className="w-3 h-3 text-slate-600 -rotate-90 flex-shrink-0" />
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all w-full"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      {inner}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl text-left transition-all"
    >
      <span className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
      </div>
    </button>
  );
}

function Modal({
  children,
  onClose,
  title,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-h-[90vh] overflow-y-auto",
          wide ? "max-w-lg" : "max-w-md"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Services tab — extracted for clarity
// ─────────────────────────────────────────────────────────────

function ServicesTab(props: {
  categories: Category[];
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  onAddCategory: () => void;
  onAddService: (catId: string | number) => void;
  onDeleteCategory: (catId: string | number, catTitle: string) => void;
  onDeleteService: (serviceId: number) => void;
  expandedCats: Set<string | number>;
  toggleCat: (id: string | number) => void;
  editingPrice: { catId: string | number; svcIdx: number } | null;
  setEditingPrice: (v: { catId: string | number; svcIdx: number } | null) => void;
  editingName: { catId: string | number; svcIdx: number } | null;
  setEditingName: (v: { catId: string | number; svcIdx: number } | null) => void;
  newPrices: Record<string, string>;
  setNewPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  newNames: Record<string, string>;
  setNewNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onUpdatePrice: (catId: string | number, svcIdx: number, serviceId?: number) => void;
  onUpdateName: (catId: string | number, svcIdx: number, serviceId?: number) => void;
}) {
  const {
    categories,
    searchQuery,
    setSearchQuery,
    onAddCategory,
    onAddService,
    onDeleteCategory,
    onDeleteService,
    expandedCats,
    toggleCat,
    editingPrice,
    setEditingPrice,
    editingName,
    setEditingName,
    newPrices,
    setNewPrices,
    newNames,
    setNewNames,
    onUpdatePrice,
    onUpdateName,
  } = props;

  // Smart price-aware search (same logic as customer page):
  //   "5"        → exact price 5
  //   "ksh 5"    → exact price 5
  //   "<100"     → less than 100
  //   "100-300"  → range
  //   "passport" → fuzzy text
  const q = searchQuery.trim().toLowerCase();
  const cleaned = q
    .replace(/k(sh|es)?|sh|\/=|=|kenya/gi, "")
    .replace(/\s+/g, "")
    .trim();

  type PQ =
    | { kind: "exact"; n: number }
    | { kind: "lt" | "lte" | "gt" | "gte"; n: number }
    | { kind: "range"; from: number; to: number }
    | { kind: "none" };

  const parsePQ = (input: string): PQ => {
    if (!input) return { kind: "none" };
    const r = input.match(/^(\d+)\s*(?:-|to|\.\.)\s*(\d+)$/);
    if (r) {
      const a = parseInt(r[1], 10);
      const b = parseInt(r[2], 10);
      return { kind: "range", from: Math.min(a, b), to: Math.max(a, b) };
    }
    const op = input.match(/^(<=|>=|<|>)\s*(\d+)$/);
    if (op) {
      const n = parseInt(op[2], 10);
      const map = { "<": "lt", "<=": "lte", ">": "gt", ">=": "gte" } as const;
      return { kind: map[op[1] as keyof typeof map], n };
    }
    if (/^\d+$/.test(input)) return { kind: "exact", n: parseInt(input, 10) };
    return { kind: "none" };
  };

  const pq = parsePQ(cleaned);

  const matchPrice = (p: string) => {
    if (pq.kind === "none") return false;
    const n = parseInt(p, 10);
    if (Number.isNaN(n)) return false;
    if (pq.kind === "exact") return n === pq.n;
    if (pq.kind === "lt") return n < pq.n;
    if (pq.kind === "lte") return n <= pq.n;
    if (pq.kind === "gt") return n > pq.n;
    if (pq.kind === "gte") return n >= pq.n;
    if (pq.kind === "range") return n >= pq.from && n <= pq.to;
    return false;
  };

  const visible = q
    ? categories
        .map((cat) => {
          if (pq.kind !== "none") {
            return { ...cat, services: cat.services.filter((s) => matchPrice(s.price)) };
          }
          if (cat.title.toLowerCase().includes(q)) return cat;
          return {
            ...cat,
            services: cat.services.filter(
              (s) => s.name.toLowerCase().includes(q) || s.price.toLowerCase().includes(q)
            ),
          };
        })
        .filter((c) => c.services.length > 0)
    : categories;

  const total = visible.reduce((s, c) => s + c.services.length, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ksh 5, 200, <100, 100-300…"
            className="w-full pl-11 pr-11 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={onAddCategory}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-all flex-shrink-0"
        >
          <FolderPlus className="w-4 h-4" />
          Add Category
        </button>
      </div>
      {searchQuery && (
        <p className="text-xs text-slate-500 px-1">
          {total > 0
            ? `Showing ${total} matching ${total === 1 ? "service" : "services"}`
            : `No services match "${searchQuery}"`}
        </p>
      )}

      {/* Empty state */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
          <Search className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm mb-3">
            {searchQuery ? `No services match "${searchQuery}"` : "No categories yet"}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              Clear Search
            </button>
          ) : (
            <button
              onClick={onAddCategory}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Create your first category
            </button>
          )}
        </div>
      ) : (
        visible.map((cat) => {
          const isExpanded = q ? true : expandedCats.has(cat.id);
          return (
            <div
              key={cat.id}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("w-3 h-3 rounded-full", cat.color.replace("text-", "bg-"))} />
                  <h2 className="font-bold text-base truncate">{cat.title}</h2>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    {cat.services.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddService(cat.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAddService(cat.id);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors cursor-pointer select-none"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCategory(cat.id, cat.title);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDeleteCategory(cat.id, cat.title);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer select-none"
                    title="Delete category"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-800">
                      {cat.services.length === 0 ? (
                        <p className="p-4 text-slate-500 text-sm text-center">
                          No services in this category
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-800">
                          {cat.services.map((svc, idx) => {
                            const priceKey = `${cat.id}-${idx}`;
                            const nameKey = `${cat.id}-${idx}`;
                            const isEditingPrice =
                              editingPrice?.catId === cat.id &&
                              editingPrice?.svcIdx === idx;
                            const isEditingName =
                              editingName?.catId === cat.id &&
                              editingName?.svcIdx === idx;
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-800/30 transition-colors group"
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={newNames[nameKey] ?? svc.name}
                                        onChange={(e) =>
                                          setNewNames((p) => ({
                                            ...p,
                                            [nameKey]: e.target.value,
                                          }))
                                        }
                                        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            onUpdateName(cat.id, idx, svc.id);
                                          if (e.key === "Escape") setEditingName(null);
                                        }}
                                      />
                                      <button
                                        onClick={() =>
                                          onUpdateName(cat.id, idx, svc.id)
                                        }
                                        className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditingName(null)}
                                        className="p-1.5 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-slate-200 truncate">
                                        {svc.name}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setEditingName({ catId: cat.id, svcIdx: idx });
                                          setNewNames((p) => ({
                                            ...p,
                                            [nameKey]: svc.name,
                                          }));
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-blue-400 transition-all"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {isEditingPrice ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={newPrices[priceKey] ?? svc.price}
                                        onChange={(e) =>
                                          setNewPrices((p) => ({
                                            ...p,
                                            [priceKey]: e.target.value,
                                          }))
                                        }
                                        className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white text-right focus:outline-none focus:border-blue-500"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            onUpdatePrice(cat.id, idx, svc.id);
                                          if (e.key === "Escape")
                                            setEditingPrice(null);
                                        }}
                                      />
                                      <button
                                        onClick={() =>
                                          onUpdatePrice(cat.id, idx, svc.id)
                                        }
                                        className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30"
                                      >
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditingPrice(null)}
                                        className="p-1.5 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingPrice({
                                          catId: cat.id,
                                          svcIdx: idx,
                                        });
                                        setNewPrices((p) => ({
                                          ...p,
                                          [priceKey]: svc.price,
                                        }));
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold text-blue-400 transition-colors"
                                    >
                                      {svc.price === "Contact us"
                                        ? svc.price
                                        : `${svc.price} Ksh`}
                                      <Edit3 className="w-3 h-3 opacity-50" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => svc.id && onDeleteService(svc.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Delete service"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Visitors panel — detailed visitor analytics
// ─────────────────────────────────────────────────────────────

interface VisitorReport {
  visitors: Array<{ ip: string; firstSeen?: string; lastSeen?: string }>;
  adminVisitors?: Array<{ ip: string; firstSeen?: string; lastSeen?: string }>;
  totalUnique: number;
  totalPageViews: number;
  lastVisit: string;
  visitorsToday: number;
  visitorsThisWeek: number;
}

function VisitorsPanel({ token }: { token: string }) {
  const [data, setData] = useState<VisitorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/visitors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json();
      if (!json.error) {
        setData(json);
        setLastFetched(new Date());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const formatTime = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const relativeTime = (iso: string | undefined) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const days = Math.floor(hr / 24);
      return `${days}d ago`;
    } catch {
      return iso;
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero stats — big numbers */}
      <div className="bg-gradient-to-br from-blue-500/10 via-emerald-500/10 to-purple-500/10 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              People who&apos;ve visited your site
            </p>
            <p className="text-5xl sm:text-6xl font-black text-white leading-none">
              {data?.totalUnique ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Unique visitors all-time · counts every device/network once
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                autoRefresh
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              )}
              title={autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
            >
              <span className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat
            icon={Activity}
            label="Page views"
            value={data?.totalPageViews ?? 0}
            color="text-blue-400"
          />
          <MiniStat
            icon={Clock}
            label="Today"
            value={data?.visitorsToday ?? 0}
            hint="last 24h"
            color="text-emerald-400"
          />
          <MiniStat
            icon={Users}
            label="This week"
            value={data?.visitorsThisWeek ?? 0}
            hint="last 7 days"
            color="text-purple-400"
          />
          <MiniStat
            icon={TrendingUp}
            label="Avg / visitor"
            value={
              data && data.totalUnique > 0
                ? (data.totalPageViews / data.totalUnique).toFixed(1)
                : "0"
            }
            hint="page views"
            color="text-amber-400"
          />
        </div>
      </div>

      {/* Footer with last-visit info */}
      <div className="text-xs text-slate-500 flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          Most recent visit: {data?.lastVisit ? formatTime(data.lastVisit) : "—"}
        </span>
        {lastFetched && (
          <span>Refreshed {lastFetched.toLocaleTimeString()}</span>
        )}
      </div>

      {/* Recent visitors table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Recent visitors</h3>
              <p className="text-xs text-slate-400">
                Showing {data?.visitors.length ?? 0} most-recent visitors
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!data || data.visitors.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No visitors yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Open your site in another browser/device to see this fill up.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">#</th>
                  <th className="text-left px-5 py-3 font-semibold">IP Address</th>
                  <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">
                    First seen
                  </th>
                  <th className="text-left px-5 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.visitors.map((v, i) => (
                  <tr key={v.ip + i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                      {i + 1}
                    </td>
                    <td className="px-5 py-3 text-white font-mono text-xs">
                      {v.ip}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs hidden sm:table-cell">
                      {v.firstSeen ? relativeTime(v.firstSeen) : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-300 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            v.lastSeen &&
                              new Date().getTime() - new Date(v.lastSeen).getTime() < 5 * 60 * 1000
                              ? "bg-emerald-400 animate-pulse"
                              : "bg-slate-600"
                          )}
                        />
                        {v.lastSeen ? relativeTime(v.lastSeen) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Admin panel visitors — separate from customers */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Admin panel visitors</h3>
              <p className="text-xs text-slate-400">
                IPs that loaded the /admin page (not necessarily logged in)
              </p>
            </div>
          </div>
          <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full font-semibold">
            {data?.adminVisitors?.length ?? 0} unique
          </span>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          {!data?.adminVisitors || data.adminVisitors.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No one has loaded the admin page yet (besides you).
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">#</th>
                  <th className="text-left px-4 py-2 font-semibold">IP</th>
                  <th className="text-left px-4 py-2 font-semibold hidden sm:table-cell">First seen</th>
                  <th className="text-left px-4 py-2 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.adminVisitors.map((v, i) => (
                  <tr key={v.ip + i} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-500 font-mono">{i + 1}</td>
                    <td className="px-4 py-2 text-white font-mono">{v.ip}</td>
                    <td className="px-4 py-2 text-slate-400 hidden sm:table-cell">
                      {v.firstSeen ? relativeTime(v.firstSeen) : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {v.lastSeen ? relativeTime(v.lastSeen) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* How it works info */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
        <p className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          How visitor tracking works
        </p>
        <p>
          Every page view (homepage, services, even admin) sends a quiet ping to{" "}
          <code className="px-1 bg-slate-800 rounded">/api/track</code>. The
          server records the visitor&apos;s IP address. Repeat visits from the
          same IP only count as one unique visitor.
        </p>
        <p className="text-slate-500">
          Storage backend:{" "}
          <code className="px-1 bg-slate-800 rounded text-slate-300">
            persisted in your database
          </code>{" "}
          — survives restarts and deploys.
        </p>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  color: string;
}) {
  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-white leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Suggestions panel — view, delete, and manage user suggestions
// ─────────────────────────────────────────────────────────────

interface SuggestionItem {
  id: number | string;
  message: string;
  ip?: string;
  createdAt: string;
}
interface SuggestionsReport {
  items: SuggestionItem[];
  count: number;
  ttlHours: number;
  cleanupRanCount: number;
}

function SuggestionsPanel({ token }: { token: string }) {
  const [data, setData] = useState<SuggestionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/suggestions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json();
      if (!json.error) setData(json);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 20000); // refresh every 20s
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const deleteOne = async (id: number | string) => {
    if (!confirm("Delete this suggestion?")) return;
    setBusyId(String(id));
    try {
      await fetch(`/api/admin/suggestions?id=${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const clearAll = async () => {
    if (!data || data.count === 0) return;
    if (
      !confirm(
        `Permanently delete ALL ${data.count} suggestion${data.count === 1 ? "" : "s"}? This cannot be undone.`
      )
    )
      return;
    setBusyId("ALL");
    try {
      await fetch("/api/admin/suggestions", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const relativeTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  const overflowMode = (data?.count ?? 0) > 50;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Customer suggestions
            </p>
            <p className="text-5xl font-black text-white leading-none">
              {data?.count ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Active suggestions · auto-deleted after{" "}
              <span
                className={cn(
                  "font-semibold px-1.5 py-0.5 rounded",
                  overflowMode
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-amber-500/20 text-amber-300"
                )}
              >
                {data?.ttlHours ?? 24}h
              </span>
              {overflowMode && " (overflow mode — too many suggestions)"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                autoRefresh
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  autoRefresh
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-slate-500"
                )}
              />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
            {data && data.count > 0 && (
              <button
                onClick={clearAll}
                disabled={busyId === "ALL"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {busyId === "ALL" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Latest suggestions</h3>
              <p className="text-xs text-slate-400">
                Newest first
              </p>
            </div>
          </div>
        </div>
        {!data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <Lightbulb className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No suggestions yet</p>
            <p className="text-xs text-slate-600 mt-1">
              When customers submit ideas, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {data.items.map((s) => (
              <li
                key={String(s.id)}
                className="p-5 hover:bg-slate-800/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                      {s.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 flex-wrap">
                      <span>{relativeTime(s.createdAt)}</span>
                      {s.ip && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{s.ip}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteOne(s.id)}
                    disabled={busyId === String(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
                    aria-label="Delete suggestion"
                  >
                    {busyId === String(s.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* How it works */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
        <p className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          Auto-cleanup rules
        </p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>
            Normally, suggestions older than{" "}
            <span className="text-slate-300 font-semibold">24 hours</span> are
            deleted.
          </li>
          <li>
            If there are more than{" "}
            <span className="text-slate-300 font-semibold">50</span> at once,
            the cutoff drops to{" "}
            <span className="text-slate-300 font-semibold">1 hour</span>{" "}
            (overflow mode).
          </li>
          <li>
            Cleanup runs automatically each time someone submits a new
            suggestion or you open this tab.
          </li>
          <li>
            Each visitor is rate-limited to 1 suggestion every 30 seconds and
            5 per hour.
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Security panel — visit log, login attempts, blocked IPs
// ─────────────────────────────────────────────────────────────

interface SecurityReport {
  visits: {
    items: Array<{ id: number | string; ip: string; path?: string; ts: string }>;
    count24h: number;
    topIps: Array<{ ip: string; count: number }>;
  };
  loginAttempts: Array<{
    ip: string;
    failCount: number;
    lockCount: number;
    lockedUntil?: string;
    lastFail?: string;
    lastSuccess?: string;
    reason?: string;
  }>;
  blocked: {
    active: Array<{ ip: string; blockedUntil: string; reason: string; blockedAt: string }>;
    expired: Array<{ ip: string; blockedUntil: string; reason: string; blockedAt: string }>;
  };
}

function SecurityPanel({ token }: { token: string }) {
  const [data, setData] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // manual block form
  const [blockIpInput, setBlockIpInput] = useState("");
  const [blockHours, setBlockHours] = useState(24);
  const [blockReason, setBlockReason] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/security", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json();
      if (!json.error) setData(json);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const action = async (body: object) => {
    return fetch("/api/admin/security", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  };

  const onBlock = async () => {
    if (!blockIpInput.trim()) return;
    setBusy("block");
    try {
      await action({
        action: "block",
        ip: blockIpInput.trim(),
        hours: blockHours,
        reason: blockReason.trim() || "Manually blocked by admin",
      });
      setBlockIpInput("");
      setBlockReason("");
      load();
    } finally {
      setBusy(null);
    }
  };

  const onUnblock = async (ip: string) => {
    if (!confirm(`Unblock ${ip}?`)) return;
    setBusy("unblock-" + ip);
    try {
      await action({ action: "unblock", ip });
      load();
    } finally {
      setBusy(null);
    }
  };

  const onCleanup = async () => {
    setBusy("cleanup");
    try {
      const res = await action({ action: "cleanup" });
      alert(`Removed ${res.removed ?? 0} old visit log entries.`);
      load();
    } finally {
      setBusy(null);
    }
  };

  const relTime = (iso?: string) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const sec = Math.floor(Math.abs(diff) / 1000);
      const future = diff < 0;
      const fmt = (n: number, unit: string) => `${n}${unit}${future ? " left" : " ago"}`;
      if (sec < 60) return fmt(sec, "s");
      const min = Math.floor(sec / 60);
      if (min < 60) return fmt(min, "m");
      const hr = Math.floor(min / 60);
      if (hr < 24) return fmt(hr, "h");
      const days = Math.floor(hr / 24);
      return fmt(days, "d");
    } catch {
      return iso;
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
      </div>
    );
  }

  const activeBlocks = data?.blocked.active ?? [];
  const expiredBlocks = data?.blocked.expired ?? [];
  const lockedAttempts = (data?.loginAttempts ?? []).filter(
    (a) => a.lockedUntil && new Date(a.lockedUntil) > new Date()
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-red-500/10 via-orange-500/10 to-amber-500/10 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Site security
              </p>
              <p className="text-2xl font-bold text-white">
                {activeBlocks.length} blocked &middot; {lockedAttempts.length} locked-out IPs
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data?.visits.count24h ?? 0} visits in the last 24h (logged for security audit)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                autoRefresh
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                )}
              />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
            <button
              onClick={onCleanup}
              disabled={busy === "cleanup"}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {busy === "cleanup" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Purge old
            </button>
          </div>
        </div>
      </div>

      {/* Active locked-out IPs (admin login) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Login lockouts</h3>
            <p className="text-xs text-slate-400">
              IPs currently blocked from admin login (3 fails → 1h, then 2h, 3h…)
            </p>
          </div>
        </div>
        {lockedAttempts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <CheckCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
            No active lockouts. All clear.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {lockedAttempts.map((a) => (
              <li key={a.ip} className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-white">{a.ip}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.reason || "Too many failed login attempts"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Unlocks {relTime(a.lockedUntil)} · lock #{a.lockCount}
                      {a.lastFail && ` · last fail ${relTime(a.lastFail)}`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Blocked IPs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ShieldOff className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Blocked IPs</h3>
              <p className="text-xs text-slate-400">
                Auto-blocked for excessive traffic, or manually blocked by you
              </p>
            </div>
          </div>
        </div>

        {/* Manual block form */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800">
          <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">
            Manually block an IP
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
            <input
              type="text"
              value={blockIpInput}
              onChange={(e) => setBlockIpInput(e.target.value)}
              placeholder="e.g. 1.2.3.4"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm font-mono"
            />
            <input
              type="number"
              min={1}
              max={720}
              value={blockHours}
              onChange={(e) => setBlockHours(parseInt(e.target.value, 10) || 24)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              title="Hours"
            />
            <button
              onClick={onBlock}
              disabled={!blockIpInput.trim() || busy === "block"}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
            >
              {busy === "block" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
              Block
            </button>
          </div>
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Reason (optional, e.g. spamming /api/track)"
            className="mt-2 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 text-sm"
          />
        </div>

        {activeBlocks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <CheckCircle className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
            No IPs are currently blocked.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {activeBlocks.map((b) => (
              <li key={b.ip} className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldOff className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-white">{b.ip}</p>
                    <p className="text-xs text-slate-400 mt-0.5 break-words">
                      {b.reason}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Blocked {relTime(b.blockedAt)} · expires {relTime(b.blockedUntil)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onUnblock(b.ip)}
                  disabled={busy === "unblock-" + b.ip}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {busy === "unblock-" + b.ip ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}

        {expiredBlocks.length > 0 && (
          <details className="border-t border-slate-800">
            <summary className="p-4 text-xs text-slate-500 hover:text-slate-300 cursor-pointer">
              Recent expired blocks ({expiredBlocks.length})
            </summary>
            <ul className="divide-y divide-slate-800/50">
              {expiredBlocks.slice(0, 10).map((b) => (
                <li key={b.ip} className="p-3 text-xs flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-500">{b.ip}</span>
                  <span className="text-slate-600">
                    {b.reason} · expired {relTime(b.blockedUntil)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Recent visit log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">Visit log (last 24h)</h3>
              <p className="text-xs text-slate-400">
                Every page-view ping. Auto-purged after 24 hours.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="text-blue-400 font-semibold text-base">
              {data?.visits.count24h ?? 0}
            </span>{" "}
            total
          </div>
        </div>

        {/* Top IPs */}
        {data && data.visits.topIps.length > 0 && (
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Top visitors (24h)
            </p>
            <div className="flex flex-wrap gap-2">
              {data.visits.topIps.map((t) => (
                <span
                  key={t.ip}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs"
                >
                  <span className="font-mono text-slate-300">{t.ip}</span>
                  <span className="text-blue-400 font-semibold">{t.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Latest entries */}
        {!data || data.visits.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No visit log entries yet.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">When</th>
                  <th className="text-left px-4 py-2 font-semibold">IP</th>
                  <th className="text-left px-4 py-2 font-semibold hidden sm:table-cell">Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.visits.items.map((v) => (
                  <tr key={String(v.id)} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                      {relTime(v.ts)}
                    </td>
                    <td className="px-4 py-2 text-white font-mono">{v.ip}</td>
                    <td className="px-4 py-2 text-slate-500 hidden sm:table-cell truncate max-w-xs">
                      {v.path || "/"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How security works */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2">
        <p className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-red-400" />
          Security rules
        </p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>
            <strong className="text-slate-300">Visit log:</strong> every page
            view records IP + path + timestamp. Entries older than 24 hours are
            auto-deleted.
          </li>
          <li>
            <strong className="text-slate-300">Login lockout:</strong> 3 failed
            admin logins from the same IP in 1 hour → IP locked. First lock:
            <span className="text-amber-300"> 1 hour</span>, then{" "}
            <span className="text-amber-300">2h</span>, <span className="text-amber-300">3h</span>… up to{" "}
            <span className="text-amber-300">24h</span> (escalates each time).
            The error message tells the user exactly why and when they unlock.
          </li>
          <li>
            <strong className="text-slate-300">Strange traffic:</strong> if any
            IP makes more than{" "}
            <span className="text-rose-300 font-semibold">60 requests in 60 seconds</span>,
            it&apos;s automatically blocked for{" "}
            <span className="text-rose-300 font-semibold">24 hours</span>.
          </li>
          <li>
            <strong className="text-slate-300">Manual block:</strong> use the
            form above to block any IP for any duration.
          </li>
          <li>
            Full IP addresses are visible in this admin panel for forensic
            investigation. They are stored server-side as well.
          </li>
        </ul>
      </div>
    </div>
  );
}
