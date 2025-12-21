import { NextResponse } from "next/server";
import crypto from "crypto";
import { insertTrack } from "../../../lib/db";

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
    const [b64, sigHex] = (token || "").split(".");
    if (!b64 || !sigHex) return false;

    const payload = Buffer.from(b64, "base64url").toString("utf8"); // pub:issuedAt
    const [tPub, issuedAtStr] = payload.split(":");
    if (tPub !== pub) return false;

    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt)) return false;

    // token lifetime: 30 days
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - issuedAt > maxAge) return false;

    if (!/^[0-9a-fA-F]+$/.test(sigHex)) return false;

    const expectedHex = sign(payload, secret);

    const sigBuf = Buffer.from(sigHex, "hex");
    const expBuf = Buffer.from(expectedHex, "hex");
    if (sigBuf.length !== expBuf.length) return false;

    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Origin allowlist (optional)
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length) {
    const origin = (req.headers.get("origin") || "").trim();
    if (!origin || !allowed.includes(origin)) {
      return NextResponse.json(
        { ok: false, error: "Origin not allowed" },
        { status: 403, headers: cors }
      );
    }
  }

  const event = body?.event;
  if (event !== "impression" && event !== "click") {
    return NextResponse.json(
      { ok: false, error: "Invalid event" },
      { status: 400, headers: cors }
    );
  }

  const pub = String(body?.pub || "unknown").trim() || "unknown";
  const article = String(body?.article || "unknown").trim() || "unknown";
  const slug = String(body?.slug || "").trim() || null;
  const token = String(body?.token || "").trim();

  const secret = (process.env.EMBED_SIGNING_SECRET || "").trim();
  if (secret) {
    if (!verifyToken(pub, token, secret)) {
      return NextResponse.json(
        { ok: false, error: "Invalid publisher token" },
        { status: 401, headers: cors }
      );
    }
  }

  const tsRaw = Number(body?.ts);
  const ts = Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : Date.now();

  await insertTrack({ pub, article, slug, event, ts });

  return NextResponse.json({ ok: true }, { headers: cors });
}
