import { NextResponse } from "next/server";
import crypto from "crypto";
import { insertEvent } from "../../../lib/db";

export const runtime = "nodejs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sign(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyToken(pub: string, token: string, secret: string) {
  try {
    const [b64, sig] = (token || "").split(".");
    if (!b64 || !sig) return false;

    const payload = Buffer.from(b64, "base64url").toString("utf8"); // pub:issuedAt
    const [tPub, issuedAtStr] = payload.split(":");
    if (tPub !== pub) return false;

    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt)) return false;

    // token lifetime: 30 days
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - issuedAt > maxAge) return false;

    const expected = sign(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Origin allowlist (blocks other sites from posting stats)
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length) {
    const origin = req.headers.get("origin") || "";
    if (!origin || !allowed.includes(origin)) {
      return NextResponse.json({ ok: false, error: "Origin not allowed" }, { status: 403, headers: cors });
    }
  }


  const event = body?.event;
  if (event !== "impression" && event !== "click") {
    return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400, headers: cors });
  }

  const pub = String(body?.pub || "unknown");
  const token = String(body?.token || "");
  const secret = process.env.EMBED_SIGNING_SECRET || "";

  // If secret is set, require valid token
  if (secret) {
    if (!verifyToken(pub, token, secret)) {
      return NextResponse.json({ ok: false, error: "Invalid publisher token" }, { status: 401, headers: cors });
    }
  }

  insertEvent({
    event,
    slug: body?.slug,
    question: body?.question,
    pub,
    article: body?.article,
    page_url: body?.page_url,
    referrer: body?.referrer,
    ts: body?.ts,
  });

  return NextResponse.json({ ok: true }, { headers: cors });
}
