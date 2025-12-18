"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunWatchButton() {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [msg, setMsg] = useState("");

  async function run() {
    setMsg("Running…");
    const r = await fetch("/api/watch/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({}),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Failed");

    setMsg(`Done ✅ changes: ${j.changeCount}`);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
        placeholder="ADMIN_API_KEY"
        style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 260 }}
      />
      <button
        onClick={run}
        style={{ padding: "10px 14px", borderRadius: 10, border: 0, fontWeight: 900, cursor: "pointer" }}
      >
        Run watch check
      </button>
      <span style={{ opacity: 0.75 }}>{msg}</span>
    </div>
  );
}
