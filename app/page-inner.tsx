"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function toArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (typeof x === "string") {
    try { return JSON.parse(x); } catch { return []; }
  }
  return [];
}

export default function Home() {
  const sp = useSearchParams();
  const slug = useMemo(() => sp.get("slug") || "", [sp]);
  const pub = useMemo(() => sp.get("pub") || "", [sp]);
  const article = useMemo(() => sp.get("article") || "", [sp]);

  const [market, setMarket] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!slug) {
        setMarket(null);
        setStatus("idle");
        return;
      }

      setStatus("loading");
      try {
        const r = await fetch(`/api/gamma/market?slug=${encodeURIComponent(slug)}`);
        if (!r.ok) throw new Error(await r.text());
        const m = await r.json();
        if (!cancelled) {
          setMarket(m);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setMarket(null);
          setStatus("error");
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [slug]);

  const outcomes = market ? toArray(market.outcomes) : [];
  const prices = market ? toArray(market.outcomePrices) : [];

  return (
    <main style={{ maxWidth: 520, margin: "32px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 18, marginBottom: 10 }}>Polymarket Publisher Embed</h1>
      <div style={{ marginBottom: 12 }}><a href="/embed">Open Embed Generator →</a></div>

      {(pub || article) && (
        <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.75 }}>
          pub: <code>{pub || "-"}</code> &nbsp; article: <code>{article || "-"}</code>
        </div>
      )}

      {!slug && (
        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ marginBottom: 6 }}>No slug yet.</div>
          <div>Try: <code>/?slug=YOUR_MARKET_SLUG</code></div>
          <div style={{ marginTop: 8 }}>Or test embed: <a href="/publisher-test.html">/publisher-test.html</a></div>
        </div>
      )}

      {slug && status === "loading" && (
        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          Loading market for <code>{slug}</code>…
        </div>
      )}

      {slug && status === "error" && (
        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          Couldn’t load market for <code>{slug}</code>. Check the slug.
        </div>
      )}

      {status === "ready" && market && (
        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{market.question || slug}</div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <div style={{ fontWeight: 700 }}>{outcomes[0] ?? "YES"}</div>
              <div style={{ opacity: 0.8 }}>{prices[0] ?? "?"}</div>
            </div>
            <div style={{ flex: 1, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <div style={{ fontWeight: 700 }}>{outcomes[1] ?? "NO"}</div>
              <div style={{ opacity: 0.8 }}>{prices[1] ?? "?"}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
