import { NextResponse } from "next/server";
import { listAlerts } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);

  const alerts = listAlerts(slug, limit);
  return NextResponse.json({ slug: slug || null, alerts });
}
