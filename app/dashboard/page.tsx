"use client";

import { useEffect, useMemo, useState } from "react";

export default function Dashboard() {
  const [days, setDays] = useState("7");
  const [pub, setPub] = useState("");
  const [article, setArticle] = useState("");
  const [data, setData] = useState<any>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("days", days || "7");
    if (pub) p.set("pub", pub);
    if (article) p.set("article", article);
    return p.toString();
  }, [days, pub, article]);

  useEffect(() => {
    fetch(`/api/stats?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [qs]);

  const ctr = data?.totals?.ctr ? (data.totals.ctr * 100).toFixed(2) : "0.00";
  const impU = data?.totals?.impressions_unique ?? "-";
  const clkU = data?.totals?.clicks_unique ?? "-";

  return (
    <main style={{ maxWidth: 980, margin: "32px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/embed">Embed Generator</a>
          <a href="/">Home</a>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input value={days} onChange={(e) => setDays(e.target.value)} placeholder="days" style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }} />
        <input value={pub} onChange={(e) => setPub(e.target.value)} placeholder="pub (optional)" style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 220 }} />
        <input value={article} onChange={(e) => setArticle(e.target.value)} placeholder="article (optional)" style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 260 }} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, minWidth: 220 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Impressions (unique)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{impU}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, minWidth: 220 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Clicks (total)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{data?.totals?.clicks_total ?? "-"}</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>Clicks (unique)</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{clkU}</div>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, minWidth: 220 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>CTR</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{ctr}%</div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16 }}>Top Articles</h2>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          {(data?.byArticle || []).map((row: any, i: number) => {
            const ctrRow = row.impressions_unique ? ((row.clicks_unique / row.impressions_unique) * 100).toFixed(2) : "0.00";
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: 12, borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ flex: 1 }}><b>{row.article || "(empty)"}</b></div>
                <div style={{ width: 110, textAlign: "right" }}>{row.impressions_unique} imp</div>
                <div style={{ width: 90, textAlign: "right" }}>{row.clicks_total} clk</div>
                <div style={{ width: 90, textAlign: "right" }}>{ctrRow}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16 }}>Top Markets</h2>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          {(data?.bySlug || []).map((row: any, i: number) => {
            const ctrRow = row.impressions_unique ? ((row.clicks_unique / row.impressions_unique) * 100).toFixed(2) : "0.00";
            return (
              <div key={i} style={{ padding: 12, borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ fontWeight: 800 }}>{row.question || row.slug}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{row.slug}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
                  <div>{row.impressions_unique} imp</div>
                  <div>{row.clicks_total} clk</div>
                  <div>{ctrRow}% CTR</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16 }}>Recent Events</h2>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          {(data?.recent || []).map((row: any, i: number) => (
            <div key={i} style={{ padding: 12, borderTop: i ? "1px solid #f1f5f9" : "none" }}>
              <div><b>{row.event}</b> — pub: <code>{row.pub}</code> article: <code>{row.article}</code></div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{row.slug}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{row.page_url}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
