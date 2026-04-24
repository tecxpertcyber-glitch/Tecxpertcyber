"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plug,
  Unplug,
  Cloud,
  HardDrive,
  Zap,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DbStatus {
  backend: "postgres" | "upstash-redis" | "json-file";
  persistent: boolean;
  source: string | null;
  hasRuntimeConfig: boolean;
  runtimeConfiguredAt: string | null;
  runtimeConfigStorage: { path: string; isPersistent: boolean };
  envVarsDetected: Record<string, boolean>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  onConnected?: () => void;
}

const PROVIDERS = [
  {
    id: "supabase",
    name: "Supabase",
    type: "postgres" as const,
    color: "from-emerald-500 to-green-600",
    url: "https://supabase.com/dashboard/projects",
    free: "Free 500MB · forever",
    instructions: "Sign in → New Project → Connect → Connection string → Transaction pooler → URI",
  },
  {
    id: "neon",
    name: "Neon",
    type: "postgres" as const,
    color: "from-cyan-500 to-blue-600",
    url: "https://console.neon.tech/signup",
    free: "Free 0.5GB · forever",
    instructions: "Sign up → Create project → Connection string → Pooled connection",
  },
  {
    id: "vercel-postgres",
    name: "Vercel Postgres",
    type: "postgres" as const,
    color: "from-slate-500 to-slate-700",
    url: "https://vercel.com/dashboard/stores",
    free: "Free 256MB · 60h/mo",
    instructions: "Storage → Create → Postgres → Connect to project (auto-injects POSTGRES_URL)",
  },
  {
    id: "upstash",
    name: "Upstash Redis",
    type: "redis" as const,
    color: "from-rose-500 to-red-600",
    url: "https://console.upstash.com/redis",
    free: "Free 10k cmds/day · forever",
    instructions: "Sign up → Create database → REST API tab → Copy URL + Token",
  },
];

export default function DatabaseSetupWizard({ open, onClose, token, onConnected }: Props) {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [tab, setTab] = useState<"postgres" | "redis">("postgres");
  const [pgUrl, setPgUrl] = useState("");
  const [redisUrl, setRedisUrl] = useState("");
  const [redisToken, setRedisToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/database", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.error) setStatus(data);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (open) loadStatus();
  }, [open, loadStatus]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body = tab === "postgres"
        ? { action: "test", type: "postgres", url: pgUrl }
        : { action: "test", type: "redis", url: redisUrl, token: redisToken };
      const res = await fetch("/api/admin/database", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ ok: true, msg: data.serverVersion ? `✓ Connected (${data.serverVersion})` : "✓ Connection successful" });
      } else {
        setTestResult({ ok: false, msg: data.error || "Connection failed" });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : "Network error" });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setTestResult(null);
    try {
      const body = tab === "postgres"
        ? { action: "connect", type: "postgres", url: pgUrl }
        : { action: "connect", type: "redis", url: redisUrl, token: redisToken };
      const res = await fetch("/api/admin/database", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ ok: true, msg: "✓ Connected! Existing data migrated." });
        setPgUrl("");
        setRedisUrl("");
        setRedisToken("");
        await loadStatus();
        onConnected?.();
      } else {
        setTestResult({ ok: false, msg: data.error || "Failed to connect" });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : "Network error" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect the database? Data already saved there will remain in the database, but the site will stop using it.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/database", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ ok: true, msg: "Disconnected." });
        await loadStatus();
        onConnected?.();
      }
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl my-4 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-white">Database Setup</h2>
                  <p className="text-xs text-slate-400">Connect a database to make your data permanent</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {/* Current status */}
              {status && (
                <div
                  className={cn(
                    "mb-5 p-4 rounded-xl border flex items-start gap-3",
                    status.persistent
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  {status.persistent ? (
                    <Cloud className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <HardDrive className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm flex-1 min-w-0">
                    <p className={cn("font-semibold", status.persistent ? "text-emerald-400" : "text-amber-400")}>
                      {status.persistent ? "✓ Persistent storage active" : "⚠ Using ephemeral JSON storage"}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Backend: <span className="font-mono text-white">{status.backend}</span>
                      {status.source && (
                        <> · Source: <span className="font-mono text-white">{status.source}</span></>
                      )}
                    </p>
                    {status.hasRuntimeConfig && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">
                          Configured via admin panel
                          {!status.runtimeConfigStorage.isPersistent && (
                            <span className="text-amber-400"> · stored in /tmp (resets on cold start)</span>
                          )}
                        </span>
                        <button
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                        >
                          {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vercel ephemeral warning */}
              {status && !status.runtimeConfigStorage.isPersistent && (
                <div className="mb-5 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300">
                    <strong>Vercel detected.</strong> Connections saved here persist for the life of one serverless instance.
                    For <strong>permanent persistence across all instances</strong>, also add the same URL to Vercel → Settings →
                    Environment Variables as <code className="px-1 py-0.5 bg-blue-500/20 rounded">DATABASE_URL</code> and redeploy.
                    Once set in env, this panel becomes optional.
                  </p>
                </div>
              )}

              {/* Free provider quick-links */}
              <div className="mb-5">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                  Don&apos;t have a database? Get one free in 60 seconds:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg transition-all"
                      title={p.instructions}
                    >
                      <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0", p.color)}>
                        {p.type === "postgres" ? (
                          <Database className="w-4 h-4 text-white" />
                        ) : (
                          <Zap className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-white">{p.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                        </div>
                        <p className="text-[10px] text-slate-500">{p.free}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg mb-4">
                <button
                  onClick={() => { setTab("postgres"); setTestResult(null); }}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                    tab === "postgres" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Database className="w-4 h-4" />
                  PostgreSQL
                </button>
                <button
                  onClick={() => { setTab("redis"); setTestResult(null); }}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
                    tab === "redis" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Zap className="w-4 h-4" />
                  Redis (Upstash)
                </button>
              </div>

              {/* Postgres form */}
              {tab === "postgres" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      PostgreSQL Connection String
                    </label>
                    <input
                      type="text"
                      value={pgUrl}
                      onChange={(e) => setPgUrl(e.target.value)}
                      placeholder="postgresql://user:password@host:5432/database"
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Works with: Supabase, Neon, Vercel Postgres, Render, Railway, AWS RDS, etc. SSL is auto-enabled.
                    </p>
                  </div>
                </div>
              )}

              {/* Redis form */}
              {tab === "redis" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Upstash REST URL
                    </label>
                    <input
                      type="text"
                      value={redisUrl}
                      onChange={(e) => setRedisUrl(e.target.value)}
                      placeholder="https://your-db.upstash.io"
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Upstash REST Token
                    </label>
                    <input
                      type="password"
                      value={redisToken}
                      onChange={(e) => setRedisToken(e.target.value)}
                      placeholder="AX••••••••••••••••••••"
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div
                  className={cn(
                    "mt-4 p-3 rounded-lg text-sm flex items-start gap-2",
                    testResult.ok
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/10 border border-red-500/30 text-red-400"
                  )}
                >
                  {testResult.ok ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="break-all">{testResult.msg}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleTest}
                  disabled={testing || connecting || (tab === "postgres" ? !pgUrl : !redisUrl || !redisToken)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Test
                </button>
                <button
                  onClick={handleConnect}
                  disabled={testing || connecting || (tab === "postgres" ? !pgUrl : !redisUrl || !redisToken)}
                  className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                  {connecting ? "Connecting & migrating..." : "Connect & Migrate Data"}
                </button>
              </div>

              <p className="text-[10px] text-slate-500 mt-3 text-center">
                When you click Connect, your existing prices, services & admin password are automatically copied to the new database.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
