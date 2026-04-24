// ============================================================
// M-PESA DARAJA STK PUSH HELPER
// ============================================================
// Implements Safaricom's Lipa Na M-Pesa Online STK Push.
// Configurable from the admin panel (Site Settings → Payment).
// ============================================================

import { getSiteSettings } from "@/lib/storage";

interface DarajaConfig {
  shortcode: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
  baseUrl: string; // sandbox or production
}

export async function getDarajaConfig(): Promise<DarajaConfig | null> {
  const s = await getSiteSettings();
  // Allow env vars to override (good for security in production)
  const shortcode = process.env.MPESA_SHORTCODE || s.mpesaShortcode || s.mpesaPaybill;
  const passkey = process.env.MPESA_PASSKEY || s.mpesaPasskey;
  const consumerKey = process.env.MPESA_CONSUMER_KEY || s.mpesaConsumerKey;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || s.mpesaConsumerSecret;
  const env = process.env.MPESA_ENV || s.mpesaEnv || "sandbox";

  if (!shortcode || !passkey || !consumerKey || !consumerSecret) return null;

  return {
    shortcode,
    passkey,
    consumerKey,
    consumerSecret,
    baseUrl:
      env === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
  };
}

/**
 * Normalise any common Kenyan phone number format to "2547XXXXXXXX"
 * which is what Daraja requires.
 *  0712345678   → 254712345678
 *  +254712345678 → 254712345678
 *  712345678    → 254712345678
 *  254712345678 → 254712345678
 */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1")))
    return "254" + digits;
  if (digits.length === 10 && digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("254")) return digits;
  if (digits.length === 13 && digits.startsWith("254")) return digits.slice(1); // strip stray leading
  return null;
}

function buildTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function buildPassword(shortcode: string, passkey: string, ts: string): string {
  return Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
}

async function getAccessToken(cfg: DarajaConfig): Promise<string> {
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString(
    "base64"
  );
  const res = await fetch(
    `${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Daraja OAuth failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in Daraja response");
  return data.access_token;
}

export interface StkPushParams {
  phone: string; // 254XXXXXXXXX
  amount: number;
  accountReference: string; // shows on customer's M-Pesa SMS
  description: string;
  callbackUrl?: string;
}

export interface StkPushResult {
  CheckoutRequestID: string;
  MerchantRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateStkPush(
  cfg: DarajaConfig,
  params: StkPushParams
): Promise<StkPushResult> {
  const token = await getAccessToken(cfg);
  const ts = buildTimestamp();
  const password = buildPassword(cfg.shortcode, cfg.passkey, ts);

  const body = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(params.amount)),
    PartyA: params.phone,
    PartyB: cfg.shortcode,
    PhoneNumber: params.phone,
    CallBackURL:
      params.callbackUrl || "https://example.com/api/payment/callback",
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.description.slice(0, 13),
  };

  const res = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as Partial<StkPushResult> & {
    errorMessage?: string;
  };
  if (!res.ok || json.errorMessage) {
    throw new Error(json.errorMessage || `STK push failed (${res.status})`);
  }
  if (!json.CheckoutRequestID) throw new Error("No CheckoutRequestID returned");
  return json as StkPushResult;
}

export interface StkQueryResult {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

export async function queryStkPush(
  cfg: DarajaConfig,
  checkoutRequestId: string
): Promise<StkQueryResult> {
  const token = await getAccessToken(cfg);
  const ts = buildTimestamp();
  const password = buildPassword(cfg.shortcode, cfg.passkey, ts);

  const body = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: ts,
    CheckoutRequestID: checkoutRequestId,
  };

  const res = await fetch(`${cfg.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as Partial<StkQueryResult> & {
    errorMessage?: string;
  };
  if (!res.ok || json.errorMessage) {
    throw new Error(json.errorMessage || `STK query failed (${res.status})`);
  }
  return json as StkQueryResult;
}
