import { NextResponse } from "next/server";

export const runtime = "nodejs";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400, headers: corsHeaders() });
  }

  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    return NextResponse.json({ error: "Gamma fetch failed" }, { status: 502, headers: corsHeaders() });
  }

  const data = await r.json();

  // Gamma returns an array; we return the first match for your UI
  const market = Array.isArray(data) ? data[0] : data;

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404, headers: corsHeaders() });
  }

  return NextResponse.json(market, { status: 200, headers: corsHeaders() });
}
