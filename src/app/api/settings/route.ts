import {
  getSiteSettings,
  ensureDbInitialized,
  getDefaultSiteSettings,
  type SiteSettings,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Strip secret credentials before sending to the public.
 * Daraja keys must NEVER be exposed in the browser.
 */
function publicSafe(s: SiteSettings) {
  // Use destructuring to drop the secret fields explicitly.
  const {
    mpesaConsumerKey: _ck,
    mpesaConsumerSecret: _cs,
    mpesaPasskey: _pk,
    ...safe
  } = s;
  void _ck;
  void _cs;
  void _pk;
  // Also let the client know whether STK push is configured (no values leaked)
  return {
    ...safe,
    mpesaStkConfigured: Boolean(
      s.mpesaConsumerKey && s.mpesaConsumerSecret && s.mpesaPasskey
    ),
  };
}

// GET /api/settings — public site settings (no auth needed)
export async function GET() {
  try {
    await ensureDbInitialized();
    const settings = await getSiteSettings();
    return Response.json(publicSafe(settings));
  } catch {
    return Response.json(publicSafe(getDefaultSiteSettings()));
  }
}
