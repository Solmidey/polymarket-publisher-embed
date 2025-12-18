import { NextResponse } from "next/server";
import { getStats } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") || "7");
  const pub = url.searchParams.get("pub") || "";
  const article = url.searchParams.get("article") || "";

  const data = getStats(
    Number.isFinite(days) && days > 0 ? days : 7,
    pub || undefined,
    article || undefined
  );

  return NextResponse.json(data);
}
