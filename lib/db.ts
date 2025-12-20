import { createClient } from "@libsql/client";

/**
 * Turso / libSQL config
 * - On Vercel: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * - Locally: TURSO_DATABASE_URL can be file:./dev.db (works for dev)
 */
const url = process.env.TURSO_DATABASE_URL || "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient(authToken ? { url, authToken } : { url });

let didInit = false;

async function exec(sql: string, args: any[] = []) {
  return db.execute({ sql, args });
}

export async function initDb() {
  if (didInit) return;
  didInit = true;

  // Tables
  await exec(`
    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      market_json TEXT,
      resolution_url TEXT,
      resolution_html TEXT,
      question TEXT,
      resolution_source TEXT,
      manual_evidence_url TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      saved_at INTEGER NOT NULL
    )
  `);

  await exec(`
    CREATE INDEX IF NOT EXISTS idx_evidence_slug_created
    ON evidence(slug, created_at)
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS watch (
      slug TEXT PRIMARY KEY,
      question TEXT,
      last_resolution_source TEXT,
      last_active INTEGER,
      last_closed INTEGER,
      last_updated_at TEXT,
      last_checked INTEGER,
      last_market_json TEXT
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      kind TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  await exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_slug_created
    ON alerts(slug, created_at)
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,               -- "impression" | "click"
      slug TEXT,
      question TEXT,
      pub TEXT,
      article TEXT,
      page_url TEXT,
      referrer TEXT,
      ts INTEGER NOT NULL                -- unix ms
    )
  `);

  await exec(`
    CREATE INDEX IF NOT EXISTS idx_events_ts
    ON events(ts)
  `);

  await exec(`
    CREATE INDEX IF NOT EXISTS idx_events_pub_article_ts
    ON events(pub, article, ts)
  `);
}

/** -----------------------------
 * Evidence
 * ----------------------------- */
export async function insertEvidence(row: {
  slug: string;
  market_json: string | null;
  resolution_url: string | null;
  resolution_html: string | null;
  question?: string | null;
  resolution_source?: string | null;
  manual_evidence_url?: string | null;
  notes?: string | null;
  created_at: number;
  saved_at?: number;
}) {
  await initDb();
  const saved_at = row.saved_at ?? row.created_at;

  await exec(
    `INSERT INTO evidence
      (slug, market_json, resolution_url, resolution_html, question, resolution_source, manual_evidence_url, notes, created_at, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.slug,
      row.market_json,
      row.resolution_url,
      row.resolution_html,
      row.question ?? null,
      row.resolution_source ?? null,
      row.manual_evidence_url ?? null,
      row.notes ?? null,
      row.created_at,
      saved_at,
    ]
  );
}

export async function listEvidenceBySlug(slug: string, limit = 20) {
  await initDb();
  const rs = await exec(
    `SELECT id, slug, created_at, saved_at, resolution_url, question, resolution_source, manual_evidence_url, notes
     FROM evidence
     WHERE slug = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [slug, limit]
  );
  return rs.rows;
}

export async function countEvidenceBySlug(slug: string) {
  await initDb();
  const rs = await exec(`SELECT COUNT(1) AS c FROM evidence WHERE slug = ?`, [slug]);
  const c = rs.rows?.[0]?.c;
  return typeof c === "number" ? c : Number(c || 0);
}

export async function listDistinctEvidenceSlugs(limit = 1000) {
  await initDb();
  const rs = await exec(`SELECT DISTINCT slug FROM evidence LIMIT ?`, [limit]);
  return rs.rows.map((r: any) => String(r.slug));
}

/** -----------------------------
 * Watch + Alerts
 * ----------------------------- */
export async function getWatchRow(slug: string) {
  await initDb();
  const rs = await exec(`SELECT * FROM watch WHERE slug = ? LIMIT 1`, [slug]);
  return rs.rows[0] ?? null;
}

export async function upsertWatchRow(row: {
  slug: string;
  question: string | null;
  last_resolution_source: string | null;
  last_active: number | null;
  last_closed: number | null;
  last_updated_at: string | null;
  last_checked: number;
  last_market_json: string | null;
}) {
  await initDb();
  await exec(
    `INSERT INTO watch
      (slug, question, last_resolution_source, last_active, last_closed, last_updated_at, last_checked, last_market_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       question=excluded.question,
       last_resolution_source=excluded.last_resolution_source,
       last_active=excluded.last_active,
       last_closed=excluded.last_closed,
       last_updated_at=excluded.last_updated_at,
       last_checked=excluded.last_checked,
       last_market_json=excluded.last_market_json`,
    [
      row.slug,
      row.question,
      row.last_resolution_source,
      row.last_active,
      row.last_closed,
      row.last_updated_at,
      row.last_checked,
      row.last_market_json,
    ]
  );
}

export async function insertAlert(row: {
  slug: string;
  kind: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
}) {
  await initDb();
  await exec(
    `INSERT INTO alerts (slug, kind, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [row.slug, row.kind, row.old_value, row.new_value, row.created_at]
  );
}

export async function listAlerts(slug: string, limit = 20) {
  await initDb();
  const rs = await exec(
    `SELECT * FROM alerts WHERE slug = ? ORDER BY created_at DESC LIMIT ?`,
    [slug, limit]
  );
  return rs.rows;
}

/** -----------------------------
 * Events + Stats (analytics)
 * ----------------------------- */
export async function insertEvent(row: {
  event: "impression" | "click";
  slug?: string | null;
  question?: string | null;
  pub?: string | null;
  article?: string | null;
  page_url?: string | null;
  referrer?: string | null;
  ts?: number | null;
}) {
  await initDb();
  const ts = Number.isFinite(row.ts as any) ? Number(row.ts) : Date.now();

  await exec(
    `INSERT INTO events (event, slug, question, pub, article, page_url, referrer, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.event,
      row.slug ?? null,
      row.question ?? null,
      row.pub ?? null,
      row.article ?? null,
      row.page_url ?? null,
      row.referrer ?? null,
      ts,
    ]
  );
}

function buildFilters(pub?: string, article?: string) {
  const where: string[] = [`ts >= ?`];
  const args: any[] = [];

  // placeholder for since at args[0]
  // actual since is added by caller

  if (pub) {
    where.push(`pub = ?`);
    args.push(pub);
  }
  if (article) {
    where.push(`article = ?`);
    args.push(article);
  }

  return { where: where.join(" AND "), args };
}

export async function getStats(days = 7, pub?: string, article?: string) {
  await initDb();
  const d = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
  const since = Date.now() - d * 24 * 60 * 60 * 1000;

  const filters = buildFilters(pub || undefined, article || undefined);

  // Totals
  const totalsRs = await exec(
    `SELECT
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks
     FROM events
     WHERE ${filters.where}`,
    [since, ...filters.args]
  );

  const impressions = Number(totalsRs.rows?.[0]?.impressions || 0);
  const clicks = Number(totalsRs.rows?.[0]?.clicks || 0);

  // By day
  const byDayRs = await exec(
    `SELECT
      date(ts/1000, 'unixepoch') AS day,
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks
     FROM events
     WHERE ${filters.where}
     GROUP BY day
     ORDER BY day ASC`,
    [since, ...filters.args]
  );

  // By article
  const byArticleRs = await exec(
    `SELECT
      COALESCE(article, 'unknown') AS article,
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks
     FROM events
     WHERE ${filters.where}
     GROUP BY article
     ORDER BY impressions DESC`,
    [since, ...filters.args]
  );

  return {
    ok: true,
    days: d,
    since,
    filters: {
      pub: pub || null,
      article: article || null,
    },
    totals: { impressions, clicks },
    byDay: byDayRs.rows,
    byArticle: byArticleRs.rows,
  };
}
