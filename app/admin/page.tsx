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
    const j = parts.indexOf("event");
    if (j >= 0 && parts[j + 1]) return parts[j + 1];
    return parts[parts.length - 1] || "";
  } catch {
    return s.split("?")[0].split("#")[0].split("/").filter(Boolean).pop() || s;
  }
}

export default function Admin() {
  const [adminKey, setAdminKey] = useState("");
  const [pub, setPub] = useState("demoPub");
  const [article, setArticle] = useState("demoArticle1");
  const [input, setInput] = useState("will-netflix-close-warner-bros-acquisition");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");

  const origin =
    (process.env.NEXT_PUBLIC_APP_URL as string) ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  const slug = useMemo(() => normalize(input), [input]);

  const snippet = useMemo(() => {
    return `<!-- Polymarket Embed -->
<div class="pm-card" data-slug="${slug || "REPLACE_WITH_SLUG"}" data-pub="${pub}" data-article="${article}" data-token="${token}"></div>
<script async src="${origin}/embed/polymarket.js"></script>`;
  }, [origin, slug, pub, article, token]);

  async function mint() {
    setMsg("");
    setToken("");
    if (!adminKey) return setMsg("Missing admin key");
    if (!pub) return setMsg("Missing pub");
    const r = await fetch("/api/publishers/token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({ pub }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Failed");
    setToken(j.token);
    setMsg("Token minted ✅");
  }

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setMsg("Snippet copied ✅");
  }

  return (
    <div style={{ maxWidth: 860, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Admin</h1>
      <p style={{ opacity: 0.75 }}>Mint publisher tokens and generate the exact embed snippet.</p>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
        <div>
          <label style={{ fontSize: 12 }}>admin key</label>
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>pub</label>
          <input value={pub} onChange={(e) => setPub(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>article</label>
          <input value={article} onChange={(e) => setArticle(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Polymarket URL or slug</label>
          <input value={input} onChange={(e) => setInput(e.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }} />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>normalized slug: <b>{slug || "-"}</b></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={mint} style={{ padding: "10px 14px", borderRadius: 12, border: 0, fontWeight: 800, cursor: "pointer" }}>Mint token</button>
        <button onClick={copy} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 800, cursor: "pointer" }}>Copy snippet</button>
        <div style={{ alignSelf: "center", opacity: 0.75 }}>{msg}</div>
      </div>

      <textarea readOnly value={snippet} style={{ width: "100%", height: 180, marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }} />
    </div>
  );
}
