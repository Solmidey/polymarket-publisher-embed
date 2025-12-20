(function () {
  "use strict";

  function getScriptSrc() {
    try {
      var cs = document.currentScript;
      if (cs && cs.src) return cs.src;
      var scripts = document.getElementsByTagName("script");
      var last = scripts[scripts.length - 1];
      return last && last.src ? last.src : "";
    } catch (e) {
      return "";
    }
  }

  var scriptSrc = getScriptSrc();
  var ORIGIN = (function () {
    try {
      if (scriptSrc) return new URL(scriptSrc, window.location.href).origin;
      return window.location.origin;
    } catch (e) {
      return window.location.origin;
    }
  })();

  function postTrack(payload) {
    if (!payload || !payload.token) return;

    try {
      fetch(ORIGIN + "/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
      }).catch(function () {});
    } catch (e) {}
  }

  function parseArrayMaybeJson(v) {
    try {
      if (Array.isArray(v)) return v;
      if (typeof v === "string" && v.trim()) return JSON.parse(v);
      return [];
    } catch (e) {
      return [];
    }
  }

  function setHtml(el, html) {
    el.innerHTML = html;
  }

  function safeText(v) {
    return String(v == null ? "" : v);
  }

  var cards = document.querySelectorAll(".pm-card");
  if (!cards || !cards.length) return;

  cards.forEach(function (el) {
    (async function () {
      var slugRaw = (el.getAttribute("data-slug") || "").trim();
      var pub = (el.getAttribute("data-pub") || "unknown").trim();
      var article = (el.getAttribute("data-article") || "unknown").trim();
      var token = (el.getAttribute("data-token") || "").trim();

      if (!slugRaw) {
        setHtml(el, '<div style="font-family:system-ui">Missing data-slug</div>');
        return;
      }

      setHtml(el, '<div style="font-family:system-ui">Loading market…</div>');

      try {
        var marketRes = await fetch(
          ORIGIN + "/api/gamma/market?slug=" + encodeURIComponent(slugRaw),
          { mode: "cors" }
        );
        if (!marketRes.ok) throw new Error("HTTP " + marketRes.status);

        var market = await marketRes.json();

        var outcomes = parseArrayMaybeJson(market.outcomes);
        var prices = parseArrayMaybeJson(market.outcomePrices);

        var tradeUrl =
          ORIGIN +
          "/trade/" +
          encodeURIComponent(slugRaw) +
          "?pub=" +
          encodeURIComponent(pub) +
          "&article=" +
          encodeURIComponent(article);

        var common = {
          slug: slugRaw,
          question: safeText(market.question || ""),
          pub: pub,
          article: article,
          token: token,
          page_url: window.location.href,
          referrer: document.referrer || "",
        };

        postTrack({
          event: "impression",
          ts: Date.now(),
          slug: common.slug,
          pub: common.pub,
          article: common.article,
          token: common.token,
        });

        setHtml(
          el,
          [
            '<div style="font-family:system-ui;max-width:520px;border:1px solid #e5e7eb;border-radius:14px;padding:14px">',
            '  <div style="font-weight:800;margin-bottom:10px">' +
              safeText(market.question || slugRaw) +
              "</div>",
            '  <div style="display:flex;gap:10px;margin:10px 0">',
            '    <button class="pm-go" data-go="' +
              tradeUrl +
              '" style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;text-align:left;cursor:pointer">',
            '      <div style="font-weight:700">' +
              safeText(outcomes[0] != null ? outcomes[0] : "YES") +
              "</div>",
            '      <div style="opacity:.7">' +
              safeText(prices[0] != null ? prices[0] : "?") +
              "</div>",
            "    </button>",
            '    <button class="pm-go" data-go="' +
              tradeUrl +
              '" style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;text-align:left;cursor:pointer">',
            '      <div style="font-weight:700">' +
              safeText(outcomes[1] != null ? outcomes[1] : "NO") +
              "</div>",
            '      <div style="opacity:.7">' +
              safeText(prices[1] != null ? prices[1] : "?") +
              "</div>",
            "    </button>",
            "  </div>",
            '  <button class="pm-go" data-go="' +
              tradeUrl +
              '" style="width:100%;border:0;border-radius:12px;padding:10px;background:#111827;color:#fff;font-weight:800;cursor:pointer">Trade</button>',
            "</div>",
          ].join("\n")
        );

        try {
          if (el.dataset.pmBadged === "1") return;
          el.dataset.pmBadged = "1";

          el.style.position = el.style.position || "relative";

          var metaRes = await fetch(
            ORIGIN + "/api/embed/meta?slug=" + encodeURIComponent(slugRaw),
            { cache: "no-store" }
          );
          if (metaRes.ok) {
            var meta = await metaRes.json().catch(function () {
              return null;
            });
            if (meta) {
              var level =
                String(meta.risk && meta.risk.level ? meta.risk.level : "LOW")
                  .toUpperCase();
              var evCount = Number(meta.evidenceCount || 0);

              var a = document.createElement("a");
              a.href = ORIGIN + "/risk/" + encodeURIComponent(slugRaw);
              a.target = "_blank";
              a.rel = "noreferrer";
              a.textContent = "Risk: " + level + " · Evidence: " + evCount;
              a.style.cssText =
                "position:absolute;top:10px;right:10px;font:800 12px/1 system-ui;padding:6px 10px;border-radius:999px;background:#0b1220;color:#fff;text-decoration:none;opacity:.92;z-index:9999";
              el.appendChild(a);
            }
          }
        } catch (e) {}

        el.querySelectorAll(".pm-go").forEach(function (btn) {
          btn.addEventListener("click", function () {
            postTrack({
              event: "click",
              ts: Date.now(),
              slug: common.slug,
              pub: common.pub,
              article: common.article,
              token: common.token,
            });

            window.open(btn.getAttribute("data-go"), "_blank");
          });
        });
      } catch (e) {
        setHtml(
          el,
          '<div style="font-family:system-ui">Couldn’t load this market. Check the slug.</div>'
        );
        console.error(e);
      }
    })();
  });
})();
