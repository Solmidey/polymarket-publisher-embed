import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "pm_embed.sqlite");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  slug TEXT,
  question TEXT,
  pub TEXT,
  article TEXT,
  page_url TEXT,
  referrer TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_pub ON events(pub);
CREATE INDEX IF NOT EXISTS idx_events_article ON events(article);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  market_json TEXT NOT NULL,
  resolution_url TEXT,
  resolution_html TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_slug_created ON evidence (slug, created_at);
`);


type TrackEvent = {
  event: "impression" | "click";
  slug?: string;
  question?: string;
  pub?: string;
  article?: string;
  page_url?: string;
  referrer?: string;
  ts?: number;
};

export function insertEvent(e: TrackEvent) {
  const ts = Number.isFinite(e.ts) ? Number(e.ts) : Date.now();

  const stmt = db.prepare(`
    INSERT INTO events (event, slug, question, pub, article, page_url, referrer, ts)
    VALUES (@event, @slug, @question, @pub, @article, @page_url, @referrer, @ts)
  `);

  stmt.run({
    event: e.event,
    slug: (e.slug || "").slice(0, 200),
    question: (e.question || "").slice(0, 300),
    pub: (e.pub || "").slice(0, 120),
    article: (e.article || "").slice(0, 200),
    page_url: (e.page_url || "").slice(0, 500),
    referrer: (e.referrer || "").slice(0, 500),
    ts,
  });
}

function buildWhere(days: number, pub?: string, article?: string) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const where: string[] = ["ts >= ?"];
  const params: any[] = [cutoff];

  if (pub) { where.push("pub = ?"); params.push(pub); }
  if (article) { where.push("article = ?"); params.push(article); }

  return { where: where.join(" AND "), params };
}

// 30-min uniqueness key computed at query time (no schema changes needed)
const uniqKeyExpr = `
  CAST(ts / 1800000 AS INTEGER) || ':' ||
  IFNULL(pub,'') || ':' ||
  IFNULL(article,'') || ':' ||
  IFNULL(slug,'') || ':' ||
  IFNULL(page_url,'')
`;

export function getStats(days = 7, pub?: string, article?: string) {
  const { where, params } = buildWhere(days, pub, article);

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions_total,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks_total,
      COUNT(DISTINCT CASE WHEN event='impression' THEN ${uniqKeyExpr} END) AS impressions_unique,
      COUNT(DISTINCT CASE WHEN event='click' THEN ${uniqKeyExpr} END) AS clicks_unique
    FROM events
    WHERE ${where}
  `).get(...params) as any;

  const impressions_total = Number(totals?.impressions_total || 0);
  const clicks_total = Number(totals?.clicks_total || 0);
  const impressions_unique = Number(totals?.impressions_unique || 0);
  const clicks_unique = Number(totals?.clicks_unique || 0);

  const ctr = impressions_unique > 0 ? clicks_unique / impressions_unique : 0;

  const byArticle = db.prepare(`
    SELECT
      article,
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions_total,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks_total,
      COUNT(DISTINCT CASE WHEN event='impression' THEN ${uniqKeyExpr} END) AS impressions_unique,
      COUNT(DISTINCT CASE WHEN event='click' THEN ${uniqKeyExpr} END) AS clicks_unique
    FROM events
    WHERE ${where}
    GROUP BY article
    ORDER BY clicks_unique DESC, impressions_unique DESC
    LIMIT 25
  `).all(...params) as any[];

  const bySlug = db.prepare(`
    SELECT
      slug,
      MAX(question) AS question,
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions_total,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks_total,
      COUNT(DISTINCT CASE WHEN event='impression' THEN ${uniqKeyExpr} END) AS impressions_unique,
      COUNT(DISTINCT CASE WHEN event='click' THEN ${uniqKeyExpr} END) AS clicks_unique
    FROM events
    WHERE ${where}
    GROUP BY slug
    ORDER BY clicks_unique DESC, impressions_unique DESC
    LIMIT 25
  `).all(...params) as any[];

  const byPub = db.prepare(`
    SELECT
      pub,
      SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions_total,
      SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks_total,
      COUNT(DISTINCT CASE WHEN event='impression' THEN ${uniqKeyExpr} END) AS impressions_unique,
      COUNT(DISTINCT CASE WHEN event='click' THEN ${uniqKeyExpr} END) AS clicks_unique
    FROM events
    WHERE ${where}
    GROUP BY pub
    ORDER BY clicks_unique DESC, impressions_unique DESC
    LIMIT 25
  `).all(...params) as any[];

  const recent = db.prepare(`
    SELECT event, pub, article, slug, page_url, ts
    FROM events
    WHERE ${where}
    ORDER BY ts DESC
    LIMIT 50
  `).all(...params) as any[];

  return {
    days,
    filters: { pub: pub || "", article: article || "" },
    totals: { impressions_total, clicks_total, impressions_unique, clicks_unique, ctr },
    byPub,
    byArticle,
    bySlug,
    recent,
  };
}


export function insertEvidence(row: {
  slug: string;
  market_json: string;
  resolution_url?: string | null;
  resolution_html?: string | null;
  created_at: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO evidence (slug, market_json, resolution_url, resolution_html, created_at)
    VALUES (@slug, @market_json, @resolution_url, @resolution_html, @created_at)
  `);
  return stmt.run({
    slug: row.slug,
    market_json: row.market_json,
    resolution_url: row.resolution_url ?? null,
    resolution_html: row.resolution_html ?? null,
    created_at: row.created_at,
  });
}

export function listEvidenceBySlug(slug: string, limit = 20) {
  const stmt = db.prepare(`
    SELECT id, slug, resolution_url, created_at, market_json
    FROM evidence
    WHERE slug = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(slug, limit);
}

export function getEvidenceById(id: number) {
  const stmt = db.prepare(`
    SELECT *
    FROM evidence
    WHERE id = ?
  `);
  return stmt.get(id);
}


// --- DisputeShield watch + alerts ---
db.exec(`
CREATE TABLE IF NOT EXISTS market_watch (
  slug TEXT PRIMARY KEY,
  question TEXT,
  last_resolution_source TEXT,
  last_active INTEGER,
  last_closed INTEGER,
  last_updated_at TEXT,
  last_checked INTEGER,
  last_market_json TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_slug_created ON alerts (slug, created_at);
`);

export function listDistinctEvidenceSlugs(limit = 500) {
  const stmt = db.prepare(`
    SELECT DISTINCT slug
    FROM evidence
    ORDER BY slug
    LIMIT ?
  `);
  const rows = stmt.all(limit) as any[];
  return rows.map(r => r.slug);
}

export function getWatchRow(slug: string) {
  const stmt = db.prepare(`
    SELECT *
    FROM market_watch
    WHERE slug = ?
  `);
  return stmt.get(slug);
}

export function upsertWatchRow(row: {
  slug: string;
  question?: string | null;
  last_resolution_source?: string | null;
  last_active?: number | null;
  last_closed?: number | null;
  last_updated_at?: string | null;
  last_checked: number;
  last_market_json?: string | null;
}) {
  const stmt = db.prepare(`
    INSERT INTO market_watch (
      slug, question, last_resolution_source, last_active, last_closed, last_updated_at, last_checked, last_market_json
    ) VALUES (
      @slug, @question, @last_resolution_source, @last_active, @last_closed, @last_updated_at, @last_checked, @last_market_json
    )
    ON CONFLICT(slug) DO UPDATE SET
      question = excluded.question,
      last_resolution_source = excluded.last_resolution_source,
      last_active = excluded.last_active,
      last_closed = excluded.last_closed,
      last_updated_at = excluded.last_updated_at,
      last_checked = excluded.last_checked,
      last_market_json = excluded.last_market_json
  `);

  return stmt.run({
    slug: row.slug,
    question: row.question ?? null,
    last_resolution_source: row.last_resolution_source ?? null,
    last_active: row.last_active ?? null,
    last_closed: row.last_closed ?? null,
    last_updated_at: row.last_updated_at ?? null,
    last_checked: row.last_checked,
    last_market_json: row.last_market_json ?? null,
  });
}

export function insertAlert(row: {
  slug: string;
  kind: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO alerts (slug, kind, old_value, new_value, created_at)
    VALUES (@slug, @kind, @old_value, @new_value, @created_at)
  `);
  return stmt.run({
    slug: row.slug,
    kind: row.kind,
    old_value: row.old_value ?? null,
    new_value: row.new_value ?? null,
    created_at: row.created_at,
  });
}

export function listAlerts(slug?: string | null, limit = 50) {
  if (slug) {
    const stmt = db.prepare(`
      SELECT id, slug, kind, old_value, new_value, created_at
      FROM alerts
      WHERE slug = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(slug, limit);
  }

  const stmt = db.prepare(`
    SELECT id, slug, kind, old_value, new_value, created_at
    FROM alerts
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function countAlertsForSlug(slug: string) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as c
    FROM alerts
    WHERE slug = ?
  `);
  return (stmt.get(slug) as any)?.c ?? 0;
}

export function deleteAlertsByKind(kind: string) {
  const stmt = db.prepare(`
    DELETE FROM alerts
    WHERE kind = ?
  `);
  return stmt.run(kind);
}


export function countEvidenceBySlug(slug: string) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as c
    FROM evidence
    WHERE slug = ?
  `);
  return (stmt.get(slug) as any)?.c ?? 0;
}

export function listAlertsBySlug(slug: string, limit = 50) {
  const stmt = db.prepare(`
    SELECT id, slug, kind, old_value, new_value, created_at
    FROM alerts
    WHERE slug = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(slug, limit);
}
