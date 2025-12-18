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
