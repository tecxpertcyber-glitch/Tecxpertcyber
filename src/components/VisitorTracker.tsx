"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Pings /api/track on every page mount AND every client-side navigation.
 *
 * Sends a `kind` flag so the server can bucket admin visits separately
 * from normal customer visits:
 *   - "admin"    → /admin* routes
 *   - "internal" → /hacker* routes (developer-only)
 *   - "visitor"  → everything else (real customers)
 */
export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const path = pathname || "/";
    const kind = path.startsWith("/admin")
      ? "admin"
      : path.startsWith("/hacker")
        ? "internal"
        : "visitor";

    const send = () => {
      try {
        const url = "/api/track";
        const body = JSON.stringify({ path, kind });
        if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          const blob = new Blob([body], { type: "application/json" });
          const ok = navigator.sendBeacon(url, blob);
          if (ok) return;
        }
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* noop */
      }
    };
    send();
  }, [pathname]);

  return null;
}
