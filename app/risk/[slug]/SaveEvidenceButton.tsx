"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SaveEvidenceButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [resolutionUrl, setResolutionUrl] = useState("");
  const [notes, setNotes] = useState("");
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
      body: JSON.stringify({ slug, resolutionUrl, notes }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Failed");

    setMsg("Saved ✅");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        slug: <b>{slug || "(empty)"}</b>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="ADMIN_KEY"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
        />

        <input
          value={resolutionUrl}
          onChange={(e) => setResolutionUrl(e.target.value)}
          placeholder="Evidence URL (optional) e.g. Reuters / official statement link"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
        />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional): what are you tracking / why is this evidence relevant?"
          rows={3}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={save}
            style={{ padding: "10px 14px", borderRadius: 10, border: 0, fontWeight: 800, cursor: "pointer" }}
          >
            Save evidence pack
          </button>
          <span style={{ opacity: 0.75 }}>{msg}</span>
        </div>
      </div>
    </div>
  );
}
