import { NextRequest } from "next/server";
import {
  getDarajaConfig,
  initiateStkPush,
  normaliseKenyanPhone,
} from "@/lib/mpesa";
import { getSiteSettings } from "@/lib/storage";
import {
  safeJson,
  safeString,
  safeInt,
  SafeInputError,
} from "@/lib/safe-input";
import { isIpBlocked } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// POST /api/payment/stk-push
export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req);

    // Strict rate limit so attackers can't spam STK pushes to a victim's
    // phone (each push triggers a real popup on someone's M-Pesa).
    // Max 3 push requests per minute and 10 per hour from one IP.
    const rlMin = rateLimit(`stk-min:${ip}`, 3, 60_000);
    const rlHour = rateLimit(`stk-hour:${ip}`, 10, 60 * 60_000);
    if (!rlMin.ok || !rlHour.ok) {
      const retry = Math.max(rlMin.retryAfterSeconds ?? 0, rlHour.retryAfterSeconds ?? 0);
      return Response.json(
        { error: `Too many payment requests. Please wait ${retry}s.` },
        { status: 429, headers: { "Retry-After": String(retry) } }
      );
    }

    const blocked = await isIpBlocked(ip).catch(() => null);
    if (blocked) {
      return Response.json(
        { error: "Your IP is blocked. " + blocked.reason },
        { status: 403 }
      );
    }

    const settings = await getSiteSettings();
    if (!settings.mpesaEnabled) {
      return Response.json(
        { error: "Online payment is currently disabled" },
        { status: 400 }
      );
    }

    const body = await safeJson<Record<string, unknown>>(req, {
      maxBytes: 2 * 1024,
    });

    const phoneRaw = safeString(body.phone, {
      min: 9,
      max: 16,
      field: "phone",
    });
    const phone = normaliseKenyanPhone(phoneRaw);
    const amount = safeInt(body.amount, {
      min: 1,
      max: 1_000_000,
      field: "amount",
    });

    if (!phone) {
      return Response.json(
        {
          error:
            "Invalid phone number. Use a Kenyan mobile, e.g. 0712345678 or 254712345678.",
        },
        { status: 400 }
      );
    }
    if (!amount || amount < 1) {
      return Response.json(
        { error: "Amount must be at least 1 Ksh" },
        { status: 400 }
      );
    }

    const cfg = await getDarajaConfig();

    // ── DEMO MODE ──
    // No Daraja credentials configured? Don't fail — return a friendly
    // response so the customer can pay manually using paybill + account.
    if (!cfg) {
      return Response.json({
        success: true,
        demo: true,
        message:
          "Online STK Push is not yet configured. Please pay manually using the paybill details below.",
        paybill: settings.mpesaPaybill,
        accountNumber: settings.mpesaAccountNumber,
        amount,
        phone,
      });
    }

    // ── REAL STK PUSH ──
    // Sanitize ref + desc — Daraja restricts to alphanumerics and short length
    const refRaw = body.reference
      ? safeString(body.reference, { max: 12, field: "reference", allowEmpty: true })
      : "ORDER";
    const descRaw = body.description
      ? safeString(body.description, { max: 13, field: "description", allowEmpty: true })
      : "Order payment";
    const ref = refRaw.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 12) || "ORDER";
    const desc = descRaw.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 13) || "Order";

    // Build callback URL from request origin so it always points back to us
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "";
    const callbackUrl = host ? `${proto}://${host}/api/payment/callback` : undefined;

    const result = await initiateStkPush(cfg, {
      phone,
      amount,
      accountReference: ref,
      description: desc,
      callbackUrl,
    });

    return Response.json({
      success: true,
      demo: false,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      message:
        result.CustomerMessage ||
        "Check your phone — enter your M-Pesa PIN in the popup to complete payment.",
      phone,
      amount,
    });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
