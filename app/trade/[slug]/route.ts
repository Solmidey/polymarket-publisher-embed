import { NextResponse } from "next/server";

type Params = { slug?: string };

function normalizeToSlug(input: string) {
  let s = (input || "").trim();

  try {
    if (s.startsWith("http://") || s.startsWith("https://")) s = new URL(s).pathname;
  } catch {}

  s = s.split("?")[0].split("#")[0];
  const parts = s.split("/").filter(Boolean);
  if (!parts.length) return "";

  if (parts[0] === "event" && parts[1]) return parts[1];
  if (parts[0] === "market" && parts[1]) return parts[1];

  return parts[parts.length - 1];
}

function buildRedirect(req: Request, rawSlug: string) {
  const url = new URL(req.url);
  const dest = new URL("/", url.origin);

  // keep any existing query params (pub/article/etc)
  url.searchParams.forEach((v, k) => dest.searchParams.set(k, v));

  const slug = normalizeToSlug(rawSlug);

  if (slug && slug !== "undefined" && slug !== "null") {
    dest.searchParams.set("slug", slug);
  } else {
    dest.searchParams.delete("slug");
  }

  return NextResponse.redirect(dest, 307);
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const p = await ctx.params;
  return buildRedirect(req, p?.slug || "");
}

export async function HEAD(req: Request, ctx: { params: Promise<Params> }) {
  const p = await ctx.params;
  return buildRedirect(req, p?.slug || "");
}
