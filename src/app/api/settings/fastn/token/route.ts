import { NextRequest, NextResponse } from "next/server";
import { authContextErrorResponse, requireOrgContext, requirePermission } from "@/lib/auth/context";
import { fastnBaseUrl, fastnConfigured, mintEmbedToken } from "@/lib/fastn/client";

// POST /api/settings/fastn/token: { token, widgetUrl } for the App integrations
// page. The organization comes from the session, never from the request, so
// nobody can open another organization's integrations. Owners and admins only,
// like every other integration.
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireOrgContext(req);
    requirePermission(ctx, { integrations: ["manage"] });
    if (!fastnConfigured()) {
      return NextResponse.json({ error: "App integrations are not set up on this deployment" }, { status: 503 });
    }
    const token = await mintEmbedToken({
      orgId: ctx.organizationId,
      name: ctx.organizationName,
      userId: ctx.userId,
    });
    return NextResponse.json({
      token,
      widgetUrl: `${fastnBaseUrl()}/v1/embed/iframe?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    const denied = authContextErrorResponse(error);
    if (denied) return denied;
    console.error("[fastn] embed token failed", error);
    return NextResponse.json({ error: "Could not open app integrations. Try again in a moment." }, { status: 502 });
  }
}
