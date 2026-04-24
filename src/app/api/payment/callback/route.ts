import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Safaricom calls this when an STK push completes (success/failure).
// We use polling on the client side so we don't need to do anything here,
// but Daraja still requires a valid HTTPS endpoint that responds 200.
export async function POST(req: NextRequest) {
  try {
    // Optionally log the body for debugging
    await req.json().catch(() => null);
  } catch {
    /* ignore */
  }
  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

export async function GET() {
  return Response.json({ ok: true });
}
