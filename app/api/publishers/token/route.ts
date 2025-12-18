import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function sign(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function POST(req: Request) {
  const admin = req.headers.get("x-admin-key") || "";
  if (!process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Missing ADMIN_API_KEY" }, { status: 500 });
  }
  if (admin !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.EMBED_SIGNING_SECRET || "";
  if (!secret) return NextResponse.json({ error: "Missing EMBED_SIGNING_SECRET" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const pub = String(body?.pub || "").trim();
  if (!pub) return NextResponse.json({ error: "pub required" }, { status: 400 });

  const issuedAt = Date.now();
  const payload = `${pub}:${issuedAt}`;
  const sig = sign(payload, secret);
  const token = Buffer.from(payload).toString("base64url") + "." + sig;

  return NextResponse.json({ pub, token });
}
