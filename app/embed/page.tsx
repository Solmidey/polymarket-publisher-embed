"use client";

import { useEffect, useMemo, useState } from "react";

function extractSlug(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  // If user pastes an /event/<eventSlug>/<marketSlug> URL, prefer the marketSlug (2nd one)
  const eventMarket = raw.match(/polymarket\.com\/event\/[^/?#]+\/([^/?#]+)/i);
  if (eventMarket?.[1]) return eventMarket[1];

  // Standard /market/<marketSlug>
  const market = raw.match(/polymarket\.com\/market\/([^/?#]+)/i);
  if (market?.[1]) return market[1];

  // If it's a full URL, parse pathname safely
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      const parts = u.pathname.split("/").filter(Boolean);

      // /event/a/b -> b
      if (parts[0] === "event" && parts[2]) return parts[2];
      // /event/a -> a (fallback)
      if (parts[0] === "event" && parts[1]) return parts[1];

      // /market/a -> a
      if (parts[0] === "market" && parts[1]) return parts[1];

      // fallback: last segment
      return parts[parts.length - 1] || "";
    }
  } catch {}

  // Fallback: treat as slug or path
  const cleaned = raw.split("?")[0].split("#")[0];
  const parts = cleaned.split("/").filter(Boolean);

  if (parts[0] === "event" && parts[2]) return parts[2];
  if (parts[0] === "event" && parts[1]) return parts[1];
  if (parts[0] === "market" && parts[1]) return parts[1];

  return parts[parts.length - 1] || "";
}

export default function EmbedGenerator() {
  const [marketInput, setMarketInput] = useState("");
  const [pub, setPub] = useState("demoPub");
  const [token, setToken] = useState("");
  const [article, setArticle] = useState("demoArticle1");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const slug = useMemo(() => extractSlug(marketInput), [marketInput]);

  const snippet = useMemo(() => {
    const safeSlug = slug || "REPLACE_WITH_SLUG";
    const base = origin || "https://YOUR_APP_DOMAIN";
    return `<!-- Polymarket Embed -->
<div class="pm-card" data-slug="${safeSlug}" data-pub="${pub}" data-article="${article}" data-token="${token}"></div>
<script async src="${base}/embed/polymarket.js"></script>`;
  }, [origin, slug, pub, article, token]);
return (
    <main style={{ maxWidth: 760, margin: "32px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Embed Generator</h1>
      <div style={{ opacity: 0.75, marginBottom: 16 }}>
        Paste a Polymarket URL/slug, set publisher + article IDs, copy the snippet.
      </div>

      <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Polymarket URL or slug</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input
        value={marketInput}
        onChange={(e) => setMarketInput(e.target.value)}
        placeholder="https://polymarket.com/market/..."
        style={{ flex: 1, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 12 }}
        onBlur={() => setMarketInput((v) => (v || "").split("#")[0].split("?")[0])}
      />
      <button
        type="button"
        onClick={() => setMarketInput((v) => (v || "").split("#")[0].split("?")[0])}
        style={{ height: 44, padding: "0 12px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }}
      >
        Clean input
      </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>pub</label>
          <input
            value={pub}
            onChange={(e) => setPub(e.target.value)}
            style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>article</label>
          <input
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}
          />
        
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>token</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste publisher token"
            style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}
          />
        </div>
</div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
        Normalized slug: <code>{slug || "-"}</code>
      </div>

      <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Copy/paste snippet</label>
      <textarea
        readOnly
        value={snippet}
        style={{
          width: "100%",
          height: 140,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          fontFamily: "ui-monospace, monospace",
        }}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => navigator.clipboard.writeText(snippet)}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }}
        >
          Copy snippet
        </button>
        <a href="/" style={{ fontSize: 14 }}>Back</a>
      </div>
    </main>
  );
}
