(() => {
  const scriptSrc = (() => {
    const cs = document.currentScript;
    if (cs && cs.src) return cs.src;
    const scripts = document.getElementsByTagName("script");
    const last = scripts[scripts.length - 1];
    return (last && last.src) ? last.src : "";
  })();

  // works for both absolute and relative script src
  const base = scriptSrc ? new URL(scriptSrc, window.location.href).origin : window.location.origin;

  function postTrack(payload) {
    // Avoid spamming 401s if token is missing
    if (!payload?.token) return;

    try {
      fetch(`${base}/api/track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
      }).catch(() => {});
    } catch {}
  }

  const els = document.querySelectorAll(".pm-card");
  if (!els.length) return;

  els.forEach(async (el) => {
    const slugRaw = el.getAttribute("data-slug") || "";
    const pub = el.getAttribute("data-pub") || "unknown";
    const article = el.getAttribute("data-article") || "unknown";
    const token = el.getAttribute("data-token") || "";

    if (!slugRaw) {
      el.innerHTML = `<div style="font-family:system-ui">Missing data-slug</div>`;
      return;
    }

    el.innerHTML = `<div style="font-family:system-ui">Loading market…</div>`;

    try {
      const r = await fetch(`${base}/api/gamma/market?slug=${encodeURIComponent(slugRaw)}`, { mode: "cors" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const m = await r.json();

      const outcomes = Array.isArray(m.outcomes) ? m.outcomes : JSON.parse(m.outcomes || "[]");
      const prices = Array.isArray(m.outcomePrices) ? m.outcomePrices : JSON.parse(m.outcomePrices || "[]");

      const tradeUrl =
        `${base}/trade/${encodeURIComponent(slugRaw)}?pub=${encodeURIComponent(pub)}&article=${encodeURIComponent(article)}`;

      const common = {
        slug: slugRaw,
        question: m.question || "",
        pub,
        article,
        token,
        page_url: window.location.href,
        referrer: document.referrer || "",
      };

      // Impression
      postTrack({ event: "impression", ts: Date.now(), ...common });

      // Render
      el.innerHTML = `
        <div style="font-family:system-ui;max-width:520px;border:1px solid #e5e7eb;border-radius:14px;padding:14px">
          <div style="font-weight:800;margin-bottom:10px">${m.question || slugRaw}</div>
          <div style="display:flex;gap:10px;margin:10px 0">
            <button class="pm-go" data-go="${tradeUrl}" style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;text-align:left;cursor:pointer">
              <div style="font-weight:700">${outcomes[0] ?? "YES"}</div>
              <div style="opacity:.7">${prices[0] ?? "?"}</div>
            </button>
            <button class="pm-go" data-go="${tradeUrl}" style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;text-align:left;cursor:pointer">
              <div style="font-weight:700">${outcomes[1] ?? "NO"}</div>
              <div style="opacity:.7">${prices[1] ?? "?"}</div>
            </button>
          </div>
          <button class="pm-go" data-go="${tradeUrl}" style="width:100%;border:0;border-radius:12px;padding:10px;background:#111827;color:#fff;font-weight:800;cursor:pointer">
            Trade
          </button>
        </div>
      `;

      el.querySelectorAll(".pm-go").forEach((btn) => {
        btn.addEventListener("click", () => {
          // Click
          postTrack({ event: "click", ts: Date.now(), ...common });
          window.open(btn.getAttribute("data-go"), "_blank");
        });
      });
    } catch (e) {
      el.innerHTML = `<div style="font-family:system-ui">Couldn’t load this market. Check the slug.</div>`;
      console.error(e);
    }
  });
})();
