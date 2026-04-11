// Person 2 owns this file — content.js (H&M DOM scraper)

(function () {
  "use strict";

  // --- URL guard: only run on H&M product pages ---
  if (
    !window.location.href.includes("hm.com") ||
    !window.location.href.includes("productpage")
  ) {
    return;
  }

  // Prevent double-init on same page load
  if (window.__whatTheFrockInit) return;
  window.__whatTheFrockInit = true;

  console.log("[whatTheFrock] content.js running on:", window.location.href);

  // --- Garment type inference from product title ---
  function inferGarmentType(title) {
    const t = title.toLowerCase();
    if (/legging|tight|swimwear|underwear|bra/.test(t)) return "leggings";
    if (/top|t-shirt|vest|blouse/.test(t)) return "top";
    if (/pant|trouser|jean|skirt/.test(t)) return "trousers";
    if (/jacket|coat|blazer/.test(t)) return "jacket";
    return "top";
  }

  // --- Open MATERIALS accordion if it is currently collapsed ---
  // H&M renders a button with aria-expanded="false" when closed.
  // We search for any button whose visible text is (or contains) "MATERIALS",
  // click it once if needed, and return true so the caller knows to wait.
  function openMaterialsAccordion() {
    const buttons = Array.from(
      document.querySelectorAll("button, [role='button']")
    );

    for (const btn of buttons) {
      const text = btn.textContent.trim();
      if (!/materials/i.test(text)) continue;

      const expanded = btn.getAttribute("aria-expanded");
      // aria-expanded absent or "false" → accordion is closed
      if (expanded === "true") {
        return false; // already open, no click needed
      }
      btn.click();
      return true; // clicked — caller should wait before scraping
    }

    return false; // button not found (will rely on fallback in extraction)
  }

  // --- Extract composition string from expanded accordion ---
  // Primary: walk every text node looking for the "COMPOSITION" label,
  //          then grab the immediately following text.
  // Fallback: regex scan over all visible text-bearing elements.
  function extractComposition() {
    // Strategy 1 — text-node walk
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim().toUpperCase() !== "COMPOSITION") continue;

      const parent = node.parentElement;

      // a) next text sibling right after this node
      let sib = node.nextSibling;
      while (sib) {
        const t = (sib.textContent || "").trim();
        if (t && /\d+%/.test(t)) return t;
        sib = sib.nextSibling;
      }

      // b) parent element's next element sibling
      if (parent) {
        const nextEl = parent.nextElementSibling;
        if (nextEl) {
          const t = nextEl.textContent.trim();
          if (/\d+%/.test(t)) return t;
        }

        // c) grandparent's next element sibling
        const grandNext = parent.parentElement?.nextElementSibling;
        if (grandNext) {
          const t = grandNext.textContent.trim();
          if (/\d+%/.test(t)) return t;
        }

        // d) scan all descendants of the closest named container
        const container = parent.closest("section, [class*='accordion'], [class*='product-detail'], [class*='description']");
        if (container) {
          const els = container.querySelectorAll("p, span, li, dd");
          for (const el of els) {
            if (/\d+%/.test(el.textContent)) {
              return el.textContent.trim().replace(/\s+/g, " ");
            }
          }
        }
      }
    }

    // Strategy 2 — regex fallback across the whole document
    const COMP_RE = /\d+%\s*(polyester|cotton|nylon|wool|linen|acrylic|viscose|elastane|spandex)/i;
    const candidates = document.querySelectorAll("p, span, li, dd");
    for (const el of candidates) {
      if (COMP_RE.test(el.textContent)) {
        return el.textContent.trim().replace(/\s+/g, " ");
      }
    }

    return null;
  }

  // --- Inject the overlay container into the page ---
  // Position is handled by Person 3's CSS (position: fixed; bottom: 0).
  // We append to body so it is always present regardless of H&M's layout.
  function injectOverlayPlaceholder() {
    if (document.getElementById("fabricguard-overlay")) return;
    const div = document.createElement("div");
    div.id = "fabricguard-overlay";
    document.body.appendChild(div);
  }

  // --- Main scrape → send → render flow ---
  async function runExtraction() {
    injectOverlayPlaceholder();

    // Let Person 3's overlay show loading state immediately
    if (typeof window.whatTheFrockRenderLoading === "function") {
      window.whatTheFrockRenderLoading();
    }

    // Open accordion if needed, then wait for animation / re-render
    const clicked = openMaterialsAccordion();
    if (clicked) {
      await new Promise((r) => setTimeout(r, 700));
    }

    const fabricText = extractComposition();

    if (!fabricText) {
      console.warn("[whatTheFrock] Could not extract composition on:", window.location.href);
      if (typeof window.whatTheFrockRenderError === "function") {
        window.whatTheFrockRenderError("Could not detect fabric composition on this page.");
      }
      return;
    }

    console.log("[whatTheFrock] Extracted composition:", fabricText);

    // Infer garment type from the product <h1>
    const titleEl = document.querySelector("h1");
    const garmentType = inferGarmentType(titleEl?.textContent || "");
    console.log("[whatTheFrock] Inferred garment type:", garmentType);

    // Send to background.js — background calls Claude and sends back JSON
    chrome.runtime.sendMessage(
      { type: "ANALYZE_FABRIC", fabric: fabricText, garmentType },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[whatTheFrock] Runtime error:", chrome.runtime.lastError.message);
          if (typeof window.whatTheFrockRenderError === "function") {
            window.whatTheFrockRenderError("Extension error — could not reach background.");
          }
          return;
        }

        if (response?.type === "FABRIC_RESULT") {
          if (typeof window.whatTheFrockRender === "function") {
            window.whatTheFrockRender(response.data);
          } else {
            // Person 3's overlay not yet loaded; log so it's visible in DevTools
            console.log("[whatTheFrock] FABRIC_RESULT (overlay pending):", response.data);
          }
        } else {
          const msg = response?.message || "Unknown error";
          console.error("[whatTheFrock] Analysis failed:", msg);
          if (typeof window.whatTheFrockRenderError === "function") {
            window.whatTheFrockRenderError(msg);
          }
        }
      }
    );
  }

  // --- SPA navigation watcher ---
  // H&M is a React SPA: clicking a different product changes window.location
  // without a full page reload. Poll once per second for URL changes.
  let lastHref = window.location.href;

  setInterval(() => {
    const href = window.location.href;
    if (href === lastHref) return;
    lastHref = href;

    if (href.includes("hm.com") && href.includes("productpage")) {
      console.log("[whatTheFrock] SPA navigation detected:", href);
      // Remove stale overlay and re-run on the new product
      const old = document.getElementById("fabricguard-overlay");
      if (old) old.remove();
      runExtraction();
    }
  }, 1000);

  // --- Entry point ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runExtraction);
  } else {
    runExtraction();
  }
})();
