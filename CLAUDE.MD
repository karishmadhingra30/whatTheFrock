# whatTheFrock – Chrome Extension

## What This Does
A Chrome extension for H&M that detects clothing fabric composition on product pages and injects an inline overlay — showing a health exposure risk score out of 10, the detected composition, health risks with a link to a scientific source, and safer alternatives.

H&M ONLY for now.

## Tech Stack
- Manifest V3
- Vanilla JavaScript (no framework)
- Anthropic Claude API (called from background service worker)
- Injected HTML/CSS overlay (content script injects UI directly into H&M's page DOM)

## File Structure
```
whatTheFrock/
├── manifest.json
├── background.js
├── content.js
├── overlay.css
├── popup.html
└── CLAUDE.md
```

## User Flow
1. User browses hm.com product listing
2. Clicks into a product page
3. content.js opens the "MATERIALS" accordion if collapsed, extracts composition text
4. Fixed bottom banner appears — colour-coded by risk: "whatTheFrock: HIGH RISK — click to see why"
5. User clicks → expands detail panel (score, composition, risk summary, source link, safer alternatives)

## H&M-Specific DOM Extraction
- Only runs on URLs matching `*://www.hm.com/*/productpage*`
- Find and click the "MATERIALS" accordion button if it's not already open
- After it opens, find the element immediately after the "COMPOSITION" text node — contains e.g. "Polyester 100%"
- Fallback: scan all p/span/li for regex `/\d+%\s*(polyester|cotton|nylon|wool|linen|acrylic|viscose|elastane|spandex)/i`
- Extract garment type from the product title using this keyword map:

```javascript
function inferGarmentType(title) {
  const t = title.toLowerCase();
  if (/legging|tight|swimwear|underwear|bra/.test(t)) return "leggings";
  if (/top|t-shirt|vest|blouse/.test(t)) return "top";
  if (/pant|trouser|jean|skirt/.test(t)) return "trousers";
  if (/jacket|coat|blazer/.test(t)) return "jacket";
  return "top";
}
```

## manifest.json host_permissions
Only request permissions for H&M:
```json
"host_permissions": ["*://www.hm.com/*"],
"matches": ["*://www.hm.com/*/productpage*"]
```

## Score Colours
- 0–3 → green  (low)
- 4–6 → amber  (medium)
- 7–10 → red   (high)

## Rules — DO NOT
- Only inject on hm.com product pages — guard with URL check at top of content.js
- No fetch() in content.js — all API calls go through background.js
- Use `position: fixed; bottom: 0; z-index: 999999` for overlay — never break H&M's layout
- Do not refactor working code unless asked
- No build steps or npm dependencies

## API Key
`const ANTHROPIC_KEY = "YOUR_KEY_HERE"` in background.js — hackathon only

---

## Claude System Prompt (paste exactly into background.js)

You are an expert in textile toxicology, hormonal disruption and health.
A user has selected an outfit. For each garment provided, you will receive:
- The garment type (e.g. leggings, bra, t-shirt, jacket)
- The material composition (e.g. 92% polyester, 8% elastane)

Calculate a cumulative HEALTH EXPOSURE RISK SCORE out of 10.

Scoring criteria:

1. SYNTHETIC CONTENT (0-5 pts)
   - 5 pts: >80% synthetic (polyester, nylon, acrylic, elastane/spandex)
   - 4 pts: 60-79% synthetic
   - 2 pts: 30-59% synthetic
   - 1 pt: 10-29% synthetic or conventional viscose/rayon
   - 0 pts: <10% synthetic or all natural/Tencel/linen/hemp/wool

2. SKIN PROXIMITY (0-3 pts)
   - 3 pts: against genitals or breasts (underwear, leggings, sports bra, swimwear)
   - 2 pts: against torso or thigh (t-shirt, vest, tights)
   - 1 pt: against arms or legs loosely (shirt, trousers)
   - 0 pts: outer layer only (jacket, coat)

3. CHEMICAL FLAGS (0-2 pts)
   - 2 pts: 2+ high-risk chemicals (elastane -> phthalates, PFAS performance fabric, acrylic -> acrylonitrile, viscose -> carbon disulfide)
   - 1 pt: one high-risk chemical
   - 0 pts: none

Sum scores, normalise to out of 10, cap at 10, round to 1 decimal place.

Respond ONLY in this exact JSON, no markdown, no preamble:
{
  "score": 8,
  "risk_level": "high",
  "composition": "92% polyester, 8% elastane",
  "syntheticScore": 5,
  "proximityScore": 3,
  "chemicalScore": 2,
  "garmentTotal": 10,
  "risk_summary": "1-2 sentence plain English explanation of specific risk.",
  "risk_source_url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7068695/",
  "risk_source_label": "NIH Study on Synthetic Textiles and Endocrine Disruption",
  "safer_alternatives": ["Organic Cotton", "Linen", "Hemp", "Tencel"]
}

risk_level must be: "low" (0-3), "medium" (4-6), "high" (7-10)

---

## background.js Template

const ANTHROPIC_KEY = "YOUR_KEY_HERE";

const SYSTEM_PROMPT = `(paste full system prompt above here)`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_FABRIC") {
    analyzeFabric(message.fabric, message.garmentType).then(sendResponse);
    return true;
  }
});

async function analyzeFabric(fabricText, garmentType = "top") {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Garment type: ${garmentType}\nComposition: ${fabricText}` }]
      })
    });
    const data = await response.json();
    const result = JSON.parse(data.content[0].text);
    return { type: "FABRIC_RESULT", data: result };
  } catch (err) {
    return { type: "FABRIC_ERROR", message: err.message };
  }
}

---

## content.js URL Guard (add at very top)

if (!window.location.href.includes("hm.com") || !window.location.href.includes("productpage")) {
  // do nothing — not an H&M product page
} else {
  // run extraction logic
}

---

## content.js Message Send (after extracting fabric)

chrome.runtime.sendMessage(
  { type: "ANALYZE_FABRIC", fabric: fabricText, garmentType: inferredGarmentType },
  (response) => {
    if (response.type === "FABRIC_RESULT") {
      window.whatTheFrockRender(response.data);
    } else {
      window.whatTheFrockRenderError();
    }
  }
);
