import { NextResponse } from "next/server";
import { countEvidenceBySlug } from "../../../../lib/db";

export const runtime = "nodejs";

async function fetchMarket(slug: string) {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

function computeRisk(market: any) {
  // Simple, stable heuristic (you can refine later)
  let score = 0;

  const restricted = market?.restricted === true;
  const closed = market?.closed === true;
  const resolutionSourceEmpty = !String(market?.resolutionSource || "").trim();

  // End date (from events[0].endDate if present)
  const endDate = (() => {
    const e0 = Array.isArray(market?.events) ? market.events[0] : null;
    return e0?.endDate || market?.endDate || null;
  })();

  if (restricted) score += 3;
  if (closed) score += 2;
  if (resolutionSourceEmpty) score += 1;

  if (endDate) {
    const ms = Date.parse(endDate);
    if (!Number.isNaN(ms)) {
      const hoursLeft = (ms - Date.now()) / 36e5;
      if (hoursLeft <= 48) score += 1;
      if (hoursLeft <= 6) score += 1;
    }
  }

  const level = score >= 5 ? "HIGH" : score >= 2 ? "MED" : "LOW";
  return { level, score };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const market = await fetchMarket(slug);
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  const risk = computeRisk(market);
  const evidenceCount = countEvidenceBySlug(slug);

  return NextResponse.json({
    slug,
    risk,
    evidenceCount,
  });
}
