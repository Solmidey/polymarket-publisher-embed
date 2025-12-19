"use client";

import { useEffect, useMemo, useState } from "react";

type AlertRow = {
  id: number;
  slug: string;
  kind: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
};

export default function AlertsPage() {
  const [slug, setSlug] = useState("");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [err, setErr] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    if (slug.trim()) p.set("slug", slug.trim());
    return "/api/alerts?" + p.toString();
  }, [slug, limit]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setAlerts(j?.alerts || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Alerts</h1>
      <div style={{ opacity: 0.7, marginBottom: 16 }}>
        View watcher output stored in your DB.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Filter by slug (optional)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 360 }}
        />
        <input
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value || 50))}
          type="number"
          min={1}
          max={200}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", width: 120 }}
        />
        <button
          onClick={load}
          style={{ padding: "10px 14px", borderRadius: 10, border: 0, fontWeight: 800, cursor: "pointer" }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        <a href="/" style={{ marginLeft: "auto" }}>Home</a>
      </div>

      {err ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12 }}>
          {err}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {alerts.length === 0 && !loading ? (
          <div style={{ opacity: 0.7 }}>No alerts yet.</div>
        ) : null}

        {alerts.map((a) => (
          <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{a.kind}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{a.slug}</div>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13 }}>
              <div><b>old</b>: {String(a.old_value ?? "")}</div>
              <div><b>new</b>: {String(a.new_value ?? "")}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
