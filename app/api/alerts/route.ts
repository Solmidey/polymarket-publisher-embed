import { NextResponse } from "next/server";
import { listAlertsBySlug } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const slug = (url.searchParams.get("slug") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const alerts = await listAlertsBySlug(slug, limit);
  return NextResponse.json({ slug, alerts });
}
