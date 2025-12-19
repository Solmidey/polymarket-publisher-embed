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

function parseStrArray(v: any): string[] | null {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") {
    const p = safeParse(v);
    if (Array.isArray(p)) return p.map((x) => String(x));
  }
  return null;
}

function parseNumArray(v: any): number[] | null {
  const arr = parseStrArray(v);
  if (!arr) return null;
  const nums = arr.map((x) => Number(x));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return nums;
}

function firstEventEndDate(m: any) {
  const e0 = Array.isArray(m?.events) ? m.events[0] : null;
  return norm(e0?.endDate ?? m?.endDate);
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

  const priceJump = Number(process.env.WATCH_PRICE_JUMP || "0"); // e.g. 0.15

  for (const slug of slugs) {
    checked++;

    const prev = getWatchRow(slug) as any;
    const prevMarket = safeParse(prev?.last_market_json);

    const prevDesc = String(prevMarket?.description || "");
    const prevDescHash = prevDesc ? sha256(prevDesc) : null;
    const prevDescSig = prevDescHash ? `${prevDescHash}:${prevDesc.length}` : null;

    const prevEndDate = firstEventEndDate(prevMarket);
    const prevRestricted = prevMarket?.restricted === true ? 1 : 0;

    const prevOutcomes = parseStrArray(prevMarket?.outcomes);
    const prevPrices = parseNumArray(prevMarket?.outcomePrices);
    const prevYes = prevPrices?.[0] ?? null;

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
    const updatedAt = norm(market?.updatedAt); // still stored, but NOT alerted on

    const restricted = market?.restricted === true ? 1 : 0;
    const endDate = firstEventEndDate(market);

    const outcomes = parseStrArray(market?.outcomes);
    const prices = parseNumArray(market?.outcomePrices);
    const yes = prices?.[0] ?? null;

    const desc = String(market?.description || "");
    const descHash = desc ? sha256(desc) : null;
    const descSig = descHash ? `${descHash}:${desc.length}` : null;

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
          restricted,
          endDate,
          descSig,
          outcomes,
        }),
        created_at: now,
      });
      changes.push({ slug, kind: "watch_initialized" });
    } else {
      // question change
      const prevQ = norm(prev.question);
      if (prevQ !== question) {
        insertAlert({
          slug,
          kind: "question_changed",
          old_value: prevQ,
          new_value: question,
          created_at: now,
        });
        changes.push({ slug, kind: "question_changed" });
      }

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

      // restricted change
      if (prevRestricted !== restricted) {
        insertAlert({
          slug,
          kind: "restricted_changed",
          old_value: String(prevRestricted),
          new_value: String(restricted),
          created_at: now,
        });
        changes.push({ slug, kind: "restricted_changed" });
      }

      // end date change
      if (prevEndDate !== endDate) {
        insertAlert({
          slug,
          kind: "end_date_changed",
          old_value: prevEndDate,
          new_value: endDate,
          created_at: now,
        });
        changes.push({ slug, kind: "end_date_changed" });
      }

      // outcomes change
      const prevOutSig = prevOutcomes ? JSON.stringify(prevOutcomes) : null;
      const outSig = outcomes ? JSON.stringify(outcomes) : null;
      if (prevOutSig !== outSig) {
        insertAlert({
          slug,
          kind: "outcomes_changed",
          old_value: prevOutSig,
          new_value: outSig,
          created_at: now,
        });
        changes.push({ slug, kind: "outcomes_changed" });
      }

      // rules text change (description)
      if (prevDescSig !== descSig) {
        insertAlert({
          slug,
          kind: "description_changed",
          old_value: prevDescSig,
          new_value: descSig,
          created_at: now,
        });
        changes.push({ slug, kind: "description_changed" });
      }

      // optional: yes price jump (only if WATCH_PRICE_JUMP set)
      if (priceJump > 0 && typeof prevYes === "number" && typeof yes === "number") {
        const d = Math.abs(yes - prevYes);
        if (d >= priceJump) {
          insertAlert({
            slug,
            kind: "yes_price_jump",
            old_value: String(prevYes),
            new_value: String(yes),
            created_at: now,
          });
          changes.push({ slug, kind: "yes_price_jump" });
        }
      }

      // ❌ removed: updated_at_changed (too noisy)
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
