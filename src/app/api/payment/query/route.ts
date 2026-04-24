import { NextRequest } from "next/server";
import { getDarajaConfig, queryStkPush } from "@/lib/mpesa";
import { safeJson, safeString, SafeInputError } from "@/lib/safe-input";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await safeJson<{ checkoutRequestId?: string }>(req, {
      maxBytes: 1024,
    });
    const checkoutRequestId = safeString(body.checkoutRequestId, {
      min: 5,
      max: 100,
      field: "checkoutRequestId",
    });
    // Daraja IDs are alphanumeric + "_-" — reject anything else
    if (!/^[A-Za-z0-9._-]+$/.test(checkoutRequestId)) {
      return Response.json(
        { error: "Invalid checkoutRequestId format" },
        { status: 400 }
      );
    }

    const cfg = await getDarajaConfig();
    if (!cfg) {
      return Response.json({ error: "M-Pesa not configured" }, { status: 400 });
    }
    const result = await queryStkPush(cfg, checkoutRequestId);
    const code = String(result.ResultCode);
    let status: "pending" | "success" | "cancelled" | "timeout" | "failed";
    if (code === "0") status = "success";
    else if (code === "1032") status = "cancelled";
    else if (code === "1037") status = "timeout";
    else if (code === "1") status = "failed";
    else status = "pending";

    return Response.json({
      success: true,
      status,
      resultCode: code,
      resultDesc: result.ResultDesc,
    });
  } catch (err) {
    if (err instanceof SafeInputError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Server error";
    if (/being processed|processing|pending/i.test(msg)) {
      return Response.json({ success: true, status: "pending", resultDesc: msg });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
