(() => {
  try {
    const url = new URL(window.location.href);
    const slug = url.searchParams.get("slug");
    if (!slug) return;

    localStorage.setItem("pm:lastSlug", slug);

    // Try to auto-fill any market/slug input (best-effort)
    const inputs = Array.from(document.querySelectorAll("input"));
    const target = inputs.find((i) =>
      /slug|market/i.test(`${i.name} ${i.id} ${i.placeholder}`)
    );

    if (target) {
      target.focus();
      target.value = slug;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch (e) {}
})();
