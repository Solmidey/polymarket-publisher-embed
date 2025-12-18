import { NextResponse } from "next/server";
import { insertEvidence } from "../../../../lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-admin-key") || "";
  if (!process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Missing ADMIN_API_KEY" }, { status: 500 });
  }
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  const slug = String(body?.slug || url.searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  // Optional user-provided evidence + notes (from UI)
  const manualEvidenceUrl = String(body?.resolutionUrl || body?.resolution_url || "").trim();
  const notes = String(body?.notes || "").trim() || null;

  const gammaUrl = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(gammaUrl, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "Gamma fetch failed" }, { status: 502 });

  const arr = await r.json();
  const market = Array.isArray(arr) ? arr[0] : arr;
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  const question = String(market?.question || "").trim() || null;
  const resolution_source = String(market?.resolutionSource || "").trim() || null;

  // Prefer manual evidence URL if provided, otherwise use market's resolutionSource
  const resolution_url = (manualEvidenceUrl || resolution_source || "").trim() || null;

  let resolution_html: string | null = null;
  if (resolution_url) {
    try {
      const rr = await fetch(resolution_url, { cache: "no-store" });
      const text = await rr.text();
      resolution_html = text.slice(0, 120_000);
    } catch {
      resolution_html = null;
    }
  }

  const created_at = Date.now();

  // Store extra metadata inside market_json so we don't need DB migrations yet
  const market_with_meta = {
    ...market,
    _disputeShield: {
      question,
      resolution_source,
      manual_evidence_url: manualEvidenceUrl || null,
      notes,
      saved_at: created_at,
    },
  };

  insertEvidence({
    slug,
    market_json: JSON.stringify(market_with_meta),
    resolution_url,
    resolution_html,
    created_at,
  });

  return NextResponse.json({
    ok: true,
    slug,
    question,
    resolution_source,
    resolution_url,
    notes,
    savedAt: created_at,
  });
}
