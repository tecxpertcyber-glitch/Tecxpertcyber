import { NextRequest } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import {
  getSiteSettings,
  updateSiteSettings,
  ensureDbInitialized,
  type SiteSettings,
} from "@/lib/storage";
import {
  safeJson,
  safeString,
  safeBool,
  safeEnum,
  safeEmail,
  safeHttpUrl,
  SafeInputError,
} from "@/lib/safe-input";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (!(await verifyAdminToken(token))) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureDbInitialized();
    const settings = await getSiteSettings();
    return Response.json(settings);
  } catch (err) {
    console.error("Settings GET error:", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

/** Whitelist of fields the admin is allowed to update + their per-field validators. */
const FIELD_VALIDATORS: Partial<{
  [K in keyof SiteSettings]: (v: unknown) => SiteSettings[K];
}> = {
  name: (v) => safeString(v, { max: 100, min: 1, field: "name" }),
  tagline: (v) => safeString(v, { max: 200, field: "tagline", allowEmpty: true }),
  heroTitle: (v) =>
    safeString(v, { max: 200, field: "heroTitle", allowEmpty: true }),
  heroSubtitle: (v) =>
    safeString(v, { max: 500, field: "heroSubtitle", allowEmpty: true }),
  phone: (v) => safeString(v, { max: 30, field: "phone", allowEmpty: true }),
  whatsappNumber: (v) =>
    safeString(v, { max: 20, field: "whatsappNumber", allowEmpty: true }).replace(
      /\D/g,
      ""
    ),
  emails: (v) => {
    if (!Array.isArray(v))
      throw new SafeInputError("emails must be an array");
    if (v.length > 20)
      throw new SafeInputError("Too many emails (max 20)");
    return v.map((e) => safeEmail(e));
  },
  location: (v) =>
    safeString(v, { max: 100, field: "location", allowEmpty: true }),
  ctaLabel: (v) =>
    safeString(v, { max: 60, field: "ctaLabel", allowEmpty: true }),
  facebookUrl: (v) =>
    v ? safeHttpUrl(v, "facebookUrl") : undefined,
  instagramUrl: (v) =>
    v ? safeHttpUrl(v, "instagramUrl") : undefined,
  twitterUrl: (v) => (v ? safeHttpUrl(v, "twitterUrl") : undefined),
  footerNote: (v) =>
    safeString(v, { max: 200, field: "footerNote", allowEmpty: true }),
  // Payment fields
  mpesaEnabled: (v) => safeBool(v),
  mpesaPaybill: (v) =>
    safeString(v, { max: 12, field: "mpesaPaybill", allowEmpty: true }).replace(
      /\D/g,
      ""
    ),
  mpesaAccountNumber: (v) =>
    safeString(v, { max: 30, field: "mpesaAccountNumber", allowEmpty: true }),
  mpesaInstructions: (v) =>
    safeString(v, { max: 300, field: "mpesaInstructions", allowEmpty: true }),
  mpesaShortcode: (v) =>
    safeString(v, { max: 12, field: "mpesaShortcode", allowEmpty: true }).replace(
      /\D/g,
      ""
    ),
  mpesaConsumerKey: (v) =>
    safeString(v, { max: 200, field: "mpesaConsumerKey", allowEmpty: true }),
  mpesaConsumerSecret: (v) =>
    safeString(v, { max: 200, field: "mpesaConsumerSecret", allowEmpty: true }),
  mpesaPasskey: (v) =>
    safeString(v, { max: 200, field: "mpesaPasskey", allowEmpty: true }),
  mpesaEnv: (v) => safeEnum(v, ["sandbox", "production"] as const, "mpesaEnv"),
  // Section copy
  servicesHeroTitle: (v) =>
    safeString(v, { max: 100, field: "servicesHeroTitle", allowEmpty: true }),
  servicesHeroSubtitle: (v) =>
    safeString(v, { max: 500, field: "servicesHeroSubtitle", allowEmpty: true }),
  whyTitle: (v) =>
    safeString(v, { max: 100, field: "whyTitle", allowEmpty: true }),
  whySubtitle: (v) =>
    safeString(v, { max: 200, field: "whySubtitle", allowEmpty: true }),
  whyFeature1Title: (v) =>
    safeString(v, { max: 60, field: "whyFeature1Title", allowEmpty: true }),
  whyFeature1Desc: (v) =>
    safeString(v, { max: 250, field: "whyFeature1Desc", allowEmpty: true }),
  whyFeature2Title: (v) =>
    safeString(v, { max: 60, field: "whyFeature2Title", allowEmpty: true }),
  whyFeature2Desc: (v) =>
    safeString(v, { max: 250, field: "whyFeature2Desc", allowEmpty: true }),
  whyFeature3Title: (v) =>
    safeString(v, { max: 60, field: "whyFeature3Title", allowEmpty: true }),
  whyFeature3Desc: (v) =>
    safeString(v, { max: 250, field: "whyFeature3Desc", allowEmpty: true }),
  ctaSectionTitle: (v) =>
    safeString(v, { max: 100, field: "ctaSectionTitle", allowEmpty: true }),
  ctaSectionSubtitle: (v) =>
    safeString(v, { max: 250, field: "ctaSectionSubtitle", allowEmpty: true }),
};

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await safeJson<Record<string, unknown>>(req, {
      maxBytes: 32 * 1024,
    });

    // Build a sanitised update — only whitelisted keys with validated values
    const updates: Partial<SiteSettings> = {};
    for (const key of Object.keys(body) as Array<keyof SiteSettings>) {
      const validate = FIELD_VALIDATORS[key];
      if (!validate) continue; // ignore unknown keys silently
      const value = body[key];
      if (value === undefined || value === null) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updates as any)[key] = validate(value as never);
    }

    await ensureDbInitialized();
    const updated = await updateSiteSettings(updates);
    return Response.json({ success: true, settings: updated });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("Settings POST error:", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
