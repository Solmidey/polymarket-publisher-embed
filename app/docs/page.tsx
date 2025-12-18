export default function Docs() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Polymarket Embed – Install</h1>
      <p style={{ opacity: 0.75 }}>
        Copy/paste the snippet into your article HTML where you want the card to appear.
      </p>

      <h2 style={{ marginTop: 24 }}>1) Get a snippet</h2>
      <p>
        Go to <code>/admin</code>, mint a token for your <b>pub</b>, and copy the snippet.
      </p>

      <h2 style={{ marginTop: 24 }}>2) Paste into your site</h2>
      <p><b>WordPress:</b> use a “Custom HTML” block. <br/>
         <b>Webflow:</b> use an “Embed” element. <br/>
         <b>Ghost/Substack:</b> paste into the HTML editor (if allowed).
      </p>

      <h2 style={{ marginTop: 24 }}>Example snippet</h2>
      <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
{`<!-- Polymarket Embed -->
<div class="pm-card"
  data-slug="will-netflix-close-warner-bros-acquisition"
  data-pub="demoPub"
  data-article="demoArticle1"
  data-token="PASTE_TOKEN_HERE"></div>
<script async src="https://YOUR_APP_DOMAIN/embed/polymarket.js"></script>`}
      </pre>

      <h2 style={{ marginTop: 24 }}>Metrics</h2>
      <ul>
        <li><b>Impression (unique)</b> = unique page loads that rendered the card</li>
        <li><b>Click (unique)</b> = unique users who clicked Trade at least once</li>
        <li><b>Click (total)</b> = all Trade clicks</li>
      </ul>
    </main>
  );
}
