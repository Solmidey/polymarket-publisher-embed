import RunWatchButton from "./RunWatchButton";
import { listDistinctEvidenceSlugs, getWatchRow, countAlertsForSlug } from "../../lib/db";
import { computeRisk } from "../../lib/risk";

function safeJson(s: any) {
  try { return s ? JSON.parse(String(s)) : null; } catch { return null; }
}

export const runtime = "nodejs";

export default async function WatchlistPage() {
  const slugs = await listDistinctEvidenceSlugs(200);

  const rows = slugs.map((slug) => {
    const watch = getWatchRow(slug) as any;
    const alerts = countAlertsForSlug(slug);
    const market = safeJson(watch?.last_market_json);
    const risk = market ? computeRisk(market) : null;

    return {
      slug,
      question: watch?.question || market?.question || slug,
      last_checked: watch?.last_checked || null,
      last_resolution_source: watch?.last_resolution_source || null,
      status: watch ? `${watch.last_active}/${watch.last_closed}` : "-",
      alerts,
      riskLevel: risk?.level || "-",
      riskScore: risk?.score ?? null,
    };
  });

  return (
    <main style={{ maxWidth: 1050, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>DisputeShield Watchlist</h1>
      <p style={{ opacity: 0.75 }}>Tracks saved slugs and alerts when resolutionSource / status changes.</p>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <RunWatchButton />
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: 10 }}>Market</th>
              <th style={{ padding: 10 }}>Risk</th>
              <th style={{ padding: 10 }}>Alerts</th>
              <th style={{ padding: 10 }}>Last checked</th>
              <th style={{ padding: 10 }}>Resolution source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 10, verticalAlign: "top" }}>
                  <div style={{ fontWeight: 900 }}>{r.question}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{r.slug}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href={`/risk/${encodeURIComponent(r.slug)}`}>Risk page</a>
                    <a href={`/trade/${encodeURIComponent(r.slug)}`}>Trade redirect</a>
                  </div>
                </td>
                <td style={{ padding: 10, verticalAlign: "top" }}>
                  <div style={{ fontWeight: 900 }}>{r.riskLevel}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.riskScore !== null ? `${r.riskScore}/100` : "-"}</div>
                </td>
                <td style={{ padding: 10, verticalAlign: "top" }}>
                  <div style={{ fontWeight: 900 }}>{r.alerts}</div>
                </td>
                <td style={{ padding: 10, verticalAlign: "top", fontSize: 13, opacity: 0.85 }}>
                  {r.last_checked ? new Date(r.last_checked).toLocaleString() : "-"}
                </td>
                <td style={{ padding: 10, verticalAlign: "top", fontSize: 13 }}>
                  {r.last_resolution_source ? (
                    <a href={r.last_resolution_source} target="_blank" style={{ wordBreak: "break-all" }}>
                      {r.last_resolution_source}
                    </a>
                  ) : (
                    <span style={{ opacity: 0.7 }}>None</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>No slugs yet. Save an evidence pack first.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
