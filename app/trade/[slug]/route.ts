import { NextResponse } from "next/server";

export const runtime = "nodejs";

function buildRedirect(req: Request, slug: string) {
  const url = new URL(req.url);
  const pub = url.searchParams.get("pub") || "";
  const article = url.searchParams.get("article") || "";
  const to = new URL("/", url.origin);
  if (pub) to.searchParams.set("pub", pub);
  if (article) to.searchParams.set("article", article);
  if (slug) to.searchParams.set("slug", slug);
  return NextResponse.redirect(to.toString(), 307);
}

export async function GET(req: Request, ctx: { params: Promise<{ slug?: string }> }) {
  const { slug = "" } = await ctx.params;
  return buildRedirect(req, slug);
}

export async function HEAD(req: Request, ctx: { params: Promise<{ slug?: string }> }) {
  const { slug = "" } = await ctx.params;
  return buildRedirect(req, slug);
}
