import { NextResponse } from "next/server";
import { deleteAlertsByKind } from "../../../../lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-admin-key") || "";
  if (!process.env.ADMIN_API_KEY) return NextResponse.json({ error: "Missing ADMIN_API_KEY" }, { status: 500 });
  if (adminKey !== process.env.ADMIN_API_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind || "updated_at_changed").trim();

  const res: any = deleteAlertsByKind(kind);
  return NextResponse.json({ ok: true, kind, deleted: res?.changes ?? 0 });
}
