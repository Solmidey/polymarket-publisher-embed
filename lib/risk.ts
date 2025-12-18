export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export function computeRisk(market: any) {
  const desc = String(market?.description || "").toLowerCase();
  const resSource = String(market?.resolutionSource || "").trim();
  const startDate = market?.startDate ? new Date(market.startDate).getTime() : null;
  const now = Date.now();

  let score = 0;
  const reasons: string[] = [];

  // 1) Weak or missing resolution source
  if (!resSource) {
    score += 20;
    reasons.push("Missing resolution source (harder to verify).");
  } else {
    try {
      const u = new URL(resSource);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        score += 10;
        reasons.push("Resolution source is not a normal web URL.");
      }
    } catch {
      score += 10;
      reasons.push("Resolution source is not a valid URL.");
    }
  }

  // 2) Subjective / “consensus” wording
  const subjectiveSignals = [
    "consensus",
    "considered",
    "qualify",
    "interpret",
    "based on",
    "reporting",
    "first entity",
    "announcement",
    "non-finalized",
    "will not qualify",
    "at the discretion",
    "resolve according",
  ];
  const hits = subjectiveSignals.filter((k) => desc.includes(k));
  if (hits.length) {
    const add = Math.min(30, 8 + hits.length * 3);
    score += add;
    reasons.push(`Subjective/ambiguous wording detected (${hits.slice(0, 5).join(", ")}).`);
  }

  // 3) Long horizon (more things can go wrong)
  if (startDate) {
    const ageDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    // If it’s extremely new OR extremely long-running, both can be risky.
    if (ageDays < 3) {
      score += 6;
      reasons.push("Very new market (details may change / clarifications may arrive).");
    }
  }

  // 4) Restricted markets often behave differently
  if (market?.restricted === true) {
    score += 8;
    reasons.push("Restricted market.");
  }

  // 5) Incentive risk (high volume/open interest proxies)
  const vol24 = Number(market?.volume24hr ?? 0);
  if (vol24 > 50_000) {
    score += 10;
    reasons.push("High 24h volume (strong incentives around resolution).");
  } else if (vol24 > 10_000) {
    score += 6;
    reasons.push("Moderate 24h volume.");
  }

  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel = "LOW";
  if (score >= 60) level = "HIGH";
  else if (score >= 30) level = "MEDIUM";

  return { score, level, reasons };
}
