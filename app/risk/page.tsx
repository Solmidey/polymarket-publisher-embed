"use client";

import { useMemo, useState } from "react";

function normalize(input: string) {
  const s = (input || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("market");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return parts[parts.length - 1] || "";
  } catch {
    return s.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || s;
  }
}

export default function RiskHome() {
  const [input, setInput] = useState("");
  const slug = useMemo(() => normalize(input), [input]);

  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>DisputeShield</h1>
      <p style={{ opacity: 0.75 }}>Paste a Polymarket URL or slug to get a resolution risk score.</p>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste Polymarket market URL or slug…"
          style={{ flex: 1, minWidth: 320, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}
        />
        <a
          href={slug ? `/risk/${encodeURIComponent(slug)}` : "#"}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "#111827",
            color: "#fff",
            fontWeight: 900,
            textDecoration: "none",
            pointerEvents: slug ? "auto" : "none",
            opacity: slug ? 1 : 0.5,
          }}
        >
          Check risk
        </a>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
        normalized slug: <b>{slug || "-"}</b>
      </div>
    </main>
  );
}
