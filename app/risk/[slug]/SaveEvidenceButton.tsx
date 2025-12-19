"use client";

import { useState } from "react";

export default function SaveEvidenceButton({ slug }: { slug: string }) {
  const [adminKey, setAdminKey] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    if (!slug) return setMsg("Slug is empty (market not found).");
    setMsg("Saving…");

    const r = await fetch(`/api/evidence/save`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({ slug }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Failed");
    setMsg("Saved ✅");
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        slug: <b>{slug || "(empty)"}</b>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="ADMIN_API_KEY"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 240 }}
        />
        <button
          onClick={save}
          style={{ padding: "10px 14px", borderRadius: 10, border: 0, fontWeight: 800, cursor: "pointer" }}
        >
          Save evidence pack
        </button>
        <span style={{ opacity: 0.75 }}>{msg}</span>
      </div>
    </div>
  );
}
