import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const db = createClient(authToken ? { url, authToken } : { url });

// Run once per warm lambda / dev server instance
let didInit = false;

export async function initDb() {
  if (didInit) return;
  didInit = true;

  await db.batch(
    [
      {
        sql: `CREATE TABLE IF NOT EXISTS evidence (
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
        )`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_evidence_slug_created
              ON evidence(slug, created_at)`,
        args: [],
      },

      {
        sql: `CREATE TABLE IF NOT EXISTS watch (
          slug TEXT PRIMARY KEY,
          question TEXT,
          last_resolution_source TEXT,
          last_active INTEGER,
          last_closed INTEGER,
          last_updated_at TEXT,
          last_checked INTEGER,
          last_market_json TEXT
        )`,
        args: [],
      },

      {
        sql: `CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL,
          kind TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          created_at INTEGER NOT NULL
        )`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_alerts_slug_created
              ON alerts(slug, created_at)`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_alerts_kind_created
              ON alerts(kind, created_at)`,
        args: [],
      },

      // Public analytics (impressions/clicks)
      {
        sql: `CREATE TABLE IF NOT EXISTS track (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pub TEXT NOT NULL,
          article TEXT NOT NULL,
          slug TEXT,
          event TEXT NOT NULL,   -- 'impression' | 'click'
          ts INTEGER NOT NULL
        )`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_track_ts ON track(ts)`,
        args: [],
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_track_pub_article_ts
              ON track(pub, article, ts)`,
        args: [],
      },
    ],
    "write"
  );
}

function n(v: any) {
  return v === undefined ? null : v;
}

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

  await db.execute({
    sql: `INSERT INTO evidence
      (slug, market_json, resolution_url, resolution_html, question, resolution_source, manual_evidence_url, notes, created_at, saved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.slug,
      n(row.market_json),
      n(row.resolution_url),
      n(row.resolution_html),
      n(row.question ?? null),
      n(row.resolution_source ?? null),
      n(row.manual_evidence_url ?? null),
      n(row.notes ?? null),
      row.created_at,
      saved_at,
    ],
  });
}

export async function listEvidenceBySlug(slug: string, limit = 20) {
  await initDb();
  const rs = await db.execute({
    sql: `SELECT id, slug, created_at, saved_at, resolution_url, question, resolution_source, manual_evidence_url, notes
          FROM evidence
          WHERE slug = ?
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [slug, limit],
  });
  return rs.rows;
}

export async function countEvidenceBySlug(slug: string) {
  await initDb();
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM evidence WHERE slug = ?`,
    args: [slug],
  });
  return Number((rs.rows?.[0] as any)?.n || 0);
}

export async function listDistinctEvidenceSlugs(limit = 1000) {
  await initDb();
  const rs = await db.execute({
    sql: `SELECT DISTINCT slug FROM evidence LIMIT ?`,
    args: [limit],
  });
  return rs.rows.map((r: any) => String(r.slug));
}

export async function getWatchRow(slug: string) {
  await initDb();
  const rs = await db.execute({
    sql: `SELECT * FROM watch WHERE slug = ? LIMIT 1`,
    args: [slug],
  });
  return (rs.rows[0] as any) ?? null;
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
  await db.execute({
    sql: `INSERT INTO watch
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
    args: [
      row.slug,
      n(row.question),
      n(row.last_resolution_source),
      row.last_active,
      row.last_closed,
      n(row.last_updated_at),
      row.last_checked,
      n(row.last_market_json),
    ],
  });
}

export async function insertAlert(row: {
  slug: string;
  kind: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
}) {
  await initDb();
  await db.execute({
    sql: `INSERT INTO alerts (slug, kind, old_value, new_value, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [row.slug, row.kind, n(row.old_value), n(row.new_value), row.created_at],
  });
}

export async function listAlertsBySlug(slug: string, limit = 20) {
  await initDb();
  const rs = await db.execute({
    sql: `SELECT * FROM alerts WHERE slug = ? ORDER BY created_at DESC LIMIT ?`,
    args: [slug, limit],
  });
  return rs.rows;
}

// Back-compat (if some code still imports listAlerts)
export const listAlerts = listAlertsBySlug;

export async function countAlertsForSlug(slug: string) {
  await initDb();
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM alerts WHERE slug = ?`,
    args: [slug],
  });
  return Number((rs.rows?.[0] as any)?.n || 0);
}

// Delete alerts by kind (optionally by slug). Useful for noisy kinds.
export async function deleteAlertsByKind(kind: string, opts?: { slug?: string; limit?: number }) {
  await initDb();

  const limit = opts?.limit ?? 5000;
  const slug = opts?.slug;

  // SQLite: delete with limit via subquery
  if (slug) {
    const r = await db.execute({
      sql: `DELETE FROM alerts
            WHERE id IN (
              SELECT id FROM alerts
              WHERE kind = ? AND slug = ?
              ORDER BY created_at ASC
              LIMIT ?
            )`,
      args: [kind, slug, limit],
    });
    return { deleted: Number((r as any).rowsAffected ?? 0) };
  }

  const r = await db.execute({
    sql: `DELETE FROM alerts
          WHERE id IN (
            SELECT id FROM alerts
            WHERE kind = ?
            ORDER BY created_at ASC
            LIMIT ?
          )`,
    args: [kind, limit],
  });

  return { deleted: Number((r as any).rowsAffected ?? 0) };
}

// ---------- Tracking / Stats ----------

export async function insertTrack(row: {
  pub: string;
  article: string;
  slug: string | null;
  event: "impression" | "click";
  ts: number;
}) {
  await initDb();
  await db.execute({
    sql: `INSERT INTO track (pub, article, slug, event, ts) VALUES (?, ?, ?, ?, ?)`,
    args: [row.pub, row.article, n(row.slug), row.event, row.ts],
  });
}

export async function getStats(days = 7, pub?: string, article?: string) {
  await initDb();

  const msDays = days * 24 * 60 * 60 * 1000;
  const since = Date.now() - msDays;

  const where: string[] = ["ts >= ?"];
  const args: any[] = [since];

  if (pub) {
    where.push("pub = ?");
    args.push(pub);
  }
  if (article) {
    where.push("article = ?");
    args.push(article);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalsRs = await db.execute({
    sql: `SELECT
            SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions,
            SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks
          FROM track
          ${whereSql}`,
    args,
  });

  const totalsRow: any = totalsRs.rows?.[0] ?? {};
  const totals = {
    impressions: Number(totalsRow.impressions || 0),
    clicks: Number(totalsRow.clicks || 0),
  };

  const byDayRs = await db.execute({
    sql: `SELECT
            strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day,
            SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions,
            SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks
          FROM track
          ${whereSql}
          GROUP BY day
          ORDER BY day ASC`,
    args,
  });

  const byArticleRs = await db.execute({
    sql: `SELECT
            article,
            SUM(CASE WHEN event='impression' THEN 1 ELSE 0 END) AS impressions,
            SUM(CASE WHEN event='click' THEN 1 ELSE 0 END) AS clicks
          FROM track
          ${whereSql}
          GROUP BY article
          ORDER BY clicks DESC`,
    args,
  });

  return {
    ok: true,
    days,
    since,
    filters: {
      pub: pub ?? null,
      article: article ?? null,
    },
    totals,
    byDay: byDayRs.rows.map((r: any) => ({
      day: String(r.day),
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
    })),
    byArticle: byArticleRs.rows.map((r: any) => ({
      article: String(r.article),
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
    })),
  };
}
