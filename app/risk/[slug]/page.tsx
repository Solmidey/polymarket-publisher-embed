import Link from "next/link";
import crypto from "crypto";
import SaveEvidenceButton from "./SaveEvidenceButton";
import { listEvidenceBySlug, listAlertsBySlug } from "../../../lib/db";

export const runtime = "nodejs";

function norm(x: any) {
  const s = String(x ?? "").trim();
  return s ? s : null;
}

function fmt(ms: number) {
  try {
    return new Date(ms).toLocaleString("en-GB", { timeZone: "Africa/Lagos" });
  } catch {
    return new Date(ms).toISOString();
  }
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function descSig(desc: string) {
  const h = sha256(desc);
  return `${h}:${desc.length}`;
}

function safeJson(s: any) {
  try {
    return s ? JSON.parse(String(s)) : null;
  } catch {
    return null;
  }
}

function summarizeAlert(a: any) {
  const kind = String(a?.kind || "");
  if (kind === "watch_initialized") return "Started watching this market (baseline snapshot saved).";
  if (kind === "resolution_source_changed") return "Resolution source changed.";
  if (kind === "status_changed") return "Market status changed (active/closed).";
  if (kind === "updated_at_changed") return "Market updatedAt changed.";
  if (kind === "description_changed") return "Rules text changed (market description changed).";
  if (kind === "market_missing") return "Market disappeared from Gamma (or API error).";
  return kind || "alert";
}

async function fetchMarket(slug: string) {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

function computeRisk(market: any, alerts: any[]) {
  let score = 0;

  const resolutionSource = norm(market?.resolutionSource);
  const restricted = market?.restricted ? 1 : 0;
  const endDate = norm(market?.events?.[0]?.endDate || market?.endDate);

  if (!resolutionSource) score += 2;
  if (restricted) score += 1;

  // “Recent changes” in last 7 days increases risk
  const now = Date.now();
  const recent = alerts.some((a) => {
    const kind = String(a?.kind || "");
    const t = Number(a?.created_at || 0);
    if (!t) return false;
    const isImportant = ["resolution_source_changed", "description_changed", "status_changed", "market_missing"].includes(kind);
    return isImportant && now - t < 7 * 24 * 60 * 60 * 1000;
  });
  if (recent) score += 2;

  if (endDate) {
    const ms = Date.parse(endDate);
    if (!Number.isNaN(ms)) {
      const daysLeft = (ms - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysLeft <= 14) score += 2;
      else if (daysLeft <= 45) score += 1;
    }
  }

  const level = score >= 6 ? "HIGH" : score >= 3 ? "MED" : "LOW";
  return { level, score };
}

export default async function RiskPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params;
  const slug = decodeURIComponent(p?.slug || "").trim();

  const evidence = (slug ? (listEvidenceBySlug(slug, 25) as any[]) : []) ?? [];
  const alerts = (slug ? (listAlertsBySlug(slug, 50) as any[]) : []) ?? [];

  const market = slug ? await fetchMarket(slug) : null;

  const question = norm(market?.question) || (slug ? slug : "Risk");
  const resolutionSource = norm(market?.resolutionSource);
  const active = market?.active === true;
  const closed = market?.closed === true;

  const outcomes = safeJson(market?.outcomes) || [];
  const prices = safeJson(market?.outcomePrices) || [];

  const tradePath = `/trade/${encodeURIComponent(slug)}`;
  const endDate = norm(market?.events?.[0]?.endDate || market?.endDate);
  const restricted = market?.restricted ? true : false;

  const sig = market?.description ? descSig(String(market.description)) : null;
  const risk = market ? computeRisk(market, alerts) : { level: "MED", score: 3 };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px", display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            <Link href="/risk">Risk</Link> <span style={{ opacity: 0.5 }}>/</span> <span>{slug || "(no slug)"}</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>{question}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, opacity: 0.85 }}>
            <span style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
              Risk: <b>{risk.level}</b> (score {risk.score})
            </span>
            <span style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
              Status: <b>{active ? "active" : "inactive"}</b> / <b>{closed ? "closed" : "open"}</b>
            </span>
            {restricted && (
              <span style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
                restricted
              </span>
            )}
            {endDate && (
              <span style={{ padding: "3px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
                endDate: <b>{endDate}</b>
              </span>
            )}
          </div>
        </div>

        {slug ? (
          <a
            href={tradePath}
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 12,
              background: "#111827",
              color: "white",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            Trade ↗
          </a>
        ) : null}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Market snapshot</div>
        <div style={{ display: "grid", gap: 6, fontSize: 13, opacity: 0.9 }}>
          <div>
            slug: <b>{slug || "(empty)"}</b>
          </div>
          <div>
            resolutionSource:{" "}
            {resolutionSource ? (
              <a href={resolutionSource} target="_blank" rel="noreferrer">
                {resolutionSource}
              </a>
            ) : (
              <b>(none)</b>
            )}
          </div>
          <div>
            rules signature: <b>{sig || "(missing)"}</b>
          </div>
        </div>

        {!!outcomes?.length && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Outcomes</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ flex: "1 1 220px", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>{outcomes[i] ?? "—"}</div>
                  <div style={{ opacity: 0.7 }}>price: {prices[i] ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Admin actions</div>
        <SaveEvidenceButton slug={slug} />
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Tip: after saving, run watcher (<code>/api/watch/run</code>) to generate change alerts.
        </div>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>Evidence ({evidence.length})</div>
          <a href={`/api/evidence/list?slug=${encodeURIComponent(slug)}&limit=25`} style={{ fontSize: 12 }}>
            view JSON ↗
          </a>
        </div>

        {evidence.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No evidence saved yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {evidence.map((e) => (
              <div key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>#{e.id} • {fmt(Number(e.created_at))}</div>
                <div style={{ fontWeight: 900, marginTop: 4 }}>{e.question || "(question missing)"}</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9, display: "grid", gap: 4 }}>
                  <div>resolution_url: <b>{e.resolution_url ?? "—"}</b></div>
                  <div>manual_evidence_url: <b>{e.manual_evidence_url ?? "—"}</b></div>
                  <div>notes: <b>{e.notes ?? "—"}</b></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>Alert timeline ({alerts.length})</div>
          <a href={`/api/alerts?slug=${encodeURIComponent(slug)}&limit=50`} style={{ fontSize: 12 }}>
            view JSON ↗
          </a>
        </div>

        {alerts.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No alerts yet. Run watcher to create baseline + change alerts.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {alerts.map((a) => (
              <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>#{a.id} • {fmt(Number(a.created_at))}</div>
                  <div style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
                    <b>{a.kind}</b>
                  </div>
                </div>

                <div style={{ marginTop: 6, fontWeight: 900 }}>{summarizeAlert(a)}</div>

                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", opacity: 0.8, fontSize: 12 }}>details (old/new)</summary>
                  <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere", opacity: 0.9 }}>
old: {String(a.old_value ?? "")}

new: {String(a.new_value ?? "")}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
