import SaveEvidenceButton from "./SaveEvidenceButton";
import { computeRisk } from "../../../lib/risk";
import { listEvidenceBySlug } from "../../../lib/db";

export const runtime = "nodejs";

async function getMarket(slug: string) {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json();
  const market = Array.isArray(data) ? data[0] : data;
  return market || null;
}

export default async function RiskPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug || "").trim();

  const market = slug ? await getMarket(slug) : null;

  if (!slug) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>DisputeShield</h1>
        <p>Missing slug in URL.</p>
      </main>
    );
  }

  if (!market) {
    return (
      <main style={{ maxWidth: 980, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 30, fontWeight: 900 }}>DisputeShield</h1>
        <p style={{ opacity: 0.75 }}>Resolution risk + evidence locker for Polymarket markets.</p>

        <div style={{ marginTop: 18, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Market slug</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{slug}</div>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Market not found. This usually means you used an <b>event</b> slug.
            Use the final part after <b>/market/</b> on Polymarket.
          </p>
        </div>

        <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Evidence locker</div>
          <SaveEvidenceButton slug={slug} />
        </div>
      </main>
    );
  }

  const { score, level, reasons } = computeRisk(market);
  const evidence = listEvidenceBySlug(slug, 25) as any[];

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>DisputeShield</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>Resolution risk + evidence locker for Polymarket markets.</p>

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Market</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{market.question}</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{market.slug}</div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Risk level</div>
          <div style={{ fontSize: 26, fontWeight: 950, marginTop: 6 }}>{level}</div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 6 }}>Score: <b>{score}/100</b></div>
        </div>

        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Resolution source</div>
          <div style={{ marginTop: 8 }}>
            {market.resolutionSource ? (
              <a href={market.resolutionSource} target="_blank" style={{ wordBreak: "break-all" }}>
                {market.resolutionSource}
              </a>
            ) : (
              <span style={{ opacity: 0.7 }}>None</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Why this score</div>
        <ul style={{ marginTop: 8, lineHeight: 1.6 }}>
          {reasons.length ? reasons.map((r, i) => <li key={i}>{r}</li>) : <li>No major risk signals detected.</li>}
        </ul>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Evidence locker</div>
        <SaveEvidenceButton slug={slug} />

        <div style={{ marginTop: 12, fontSize: 14, fontWeight: 900 }}>Saved packs</div>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {evidence.length ? evidence.map((e) => (
            <div key={e.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>#{e.id} • {new Date(e.created_at).toLocaleString()}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {e.resolution_url ? (
                  <a href={e.resolution_url} target="_blank" style={{ wordBreak: "break-all" }}>{e.resolution_url}</a>
                ) : (
                  <span style={{ opacity: 0.7 }}>No resolution URL</span>
                )}
              </div>
            </div>
          )) : (
            <div style={{ opacity: 0.7, marginTop: 8 }}>No evidence packs saved yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}
