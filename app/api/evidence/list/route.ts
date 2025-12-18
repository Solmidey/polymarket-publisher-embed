import { NextResponse } from "next/server";
import * as db from "../../../../lib/db";

export const runtime = "nodejs";

function safeJsonParse(s: any) {
  try {
    if (!s) return null;
    if (typeof s === "object") return s;
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  // Try to find whatever evidence-listing function your db module exposes
  const listFn =
    (db as any).listEvidence ||
    (db as any).listEvidenceBySlug ||
    (db as any).getEvidence ||
    (db as any).getEvidenceBySlug ||
    (db as any).getEvidenceForSlug;

  if (!listFn) {
    return NextResponse.json(
      { error: "No evidence list function found in lib/db.ts" },
      { status: 500 }
    );
  }

  const out = await Promise.resolve(listFn(slug));
  const rows = Array.isArray(out) ? out : Array.isArray(out?.evidence) ? out.evidence : [];

  const evidence = rows.map((row: any) => {
    const mj = safeJsonParse(row?.market_json);
    const meta = mj?._disputeShield || null;

    return {
      id: row?.id,
      slug: row?.slug,
      created_at: row?.created_at,
      resolution_url: row?.resolution_url,

      // extra useful fields (best-effort)
      question: meta?.question || mj?.question || null,
      resolution_source: meta?.resolution_source || mj?.resolutionSource || null,
      manual_evidence_url: meta?.manual_evidence_url || null,
      notes: meta?.notes || null,
      saved_at: meta?.saved_at || row?.created_at || null,
    };
  });

  return NextResponse.json({ slug, evidence });
}
