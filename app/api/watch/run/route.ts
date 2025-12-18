import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  listDistinctEvidenceSlugs,
  getWatchRow,
  upsertWatchRow,
  insertAlert,
} from "../../../../lib/db";

export const runtime = "nodejs";

function norm(s: any) {
  const x = String(s ?? "").trim();
  return x ? x : null;
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function safeParse(s: any) {
  try {
    return s ? JSON.parse(String(s)) : null;
  } catch {
    return null;
  }
}

async function fetchMarket(slug: string) {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-admin-key") || "";
  if (!process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Missing ADMIN_API_KEY" }, { status: 500 });
  }
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slugs = listDistinctEvidenceSlugs(1000);
  const now = Date.now();

  const changes: any[] = [];
  let checked = 0;

  for (const slug of slugs) {
    checked++;
    const prev = getWatchRow(slug) as any;
    const prevMarket = safeParse(prev?.last_market_json);
    const prevDesc = String(prevMarket?.description || "");
    const prevDescHash = prevDesc ? sha256(prevDesc) : null;

    const market = await fetchMarket(slug);

    if (!market) {
      if (prev) {
        insertAlert({
          slug,
          kind: "market_missing",
          old_value: "present",
          new_value: "missing",
          created_at: now,
        });
        changes.push({ slug, kind: "market_missing" });
      }

      upsertWatchRow({
        slug,
        question: prev?.question ?? null,
        last_resolution_source: prev?.last_resolution_source ?? null,
        last_active: prev?.last_active ?? null,
        last_closed: prev?.last_closed ?? null,
        last_updated_at: prev?.last_updated_at ?? null,
        last_checked: now,
        last_market_json: prev?.last_market_json ?? null,
      });
      continue;
    }

    const question = norm(market?.question);
    const resolutionSource = norm(market?.resolutionSource);
    const active = market?.active === true ? 1 : 0;
    const closed = market?.closed === true ? 1 : 0;
    const updatedAt = norm(market?.updatedAt);

    const desc = String(market?.description || "");
    const descHash = desc ? sha256(desc) : null;

    // baseline (first time)
    if (!prev) {
      insertAlert({
        slug,
        kind: "watch_initialized",
        old_value: null,
        new_value: JSON.stringify({
          resolutionSource,
          status: `${active}/${closed}`,
          updatedAt,
          descHash,
        }),
        created_at: now,
      });
      changes.push({ slug, kind: "watch_initialized" });
    } else {
      // resolution source change
      const prevRes = norm(prev.last_resolution_source);
      if (prevRes !== resolutionSource) {
        insertAlert({
          slug,
          kind: "resolution_source_changed",
          old_value: prevRes,
          new_value: resolutionSource,
          created_at: now,
        });
        changes.push({ slug, kind: "resolution_source_changed" });
      }

      // status change
      const prevStatus = `${prev.last_active ?? ""}/${prev.last_closed ?? ""}`;
      const newStatus = `${active}/${closed}`;
      if (prevStatus !== newStatus) {
        insertAlert({
          slug,
          kind: "status_changed",
          old_value: prevStatus,
          new_value: newStatus,
          created_at: now,
        });
        changes.push({ slug, kind: "status_changed" });
      }

      // updatedAt change
      const prevUpdated = norm(prev.last_updated_at);
      if (prevUpdated && updatedAt && prevUpdated !== updatedAt) {
        insertAlert({
          slug,
          kind: "updated_at_changed",
          old_value: prevUpdated,
          new_value: updatedAt,
          created_at: now,
        });
        changes.push({ slug, kind: "updated_at_changed" });
      }

      // ✅ rules text change (description)
      if (prevDescHash !== descHash) {
        insertAlert({
          slug,
          kind: "description_changed",
          old_value: prevDescHash,
          new_value: descHash,
          created_at: now,
        });
        changes.push({ slug, kind: "description_changed" });
      }
    }

    upsertWatchRow({
      slug,
      question,
      last_resolution_source: resolutionSource,
      last_active: active,
      last_closed: closed,
      last_updated_at: updatedAt,
      last_checked: now,
      last_market_json: JSON.stringify(market),
    });
  }

  return NextResponse.json({
    ok: true,
    checked,
    slugs: slugs.length,
    changeCount: changes.length,
    changes,
    ranAt: now,
  });
}
