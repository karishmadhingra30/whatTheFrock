const ANTHROPIC_KEY = "YOUR_KEY_HERE";

const SYSTEM_PROMPT = `You are an expert in textile toxicology, hormonal disruption and health.
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

risk_level must be: "low" (0-3), "medium" (4-6), "high" (7-10)`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_FABRIC") {
    if (!message.fabric || message.fabric.trim() === "") {
      sendResponse({ type: "FABRIC_ERROR", message: "No fabric text provided" });
      return true;
    }
    analyzeFabric(message.fabric, message.garmentType).then(sendResponse);
    return true;
  }
});

async function analyzeFabric(fabricText, garmentType = "top") {
  if (!fabricText || fabricText.trim() === "") {
    return { type: "FABRIC_ERROR", message: "Empty fabric text" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
      }),
      signal: controller.signal
    });
    const data = await response.json();
    const result = JSON.parse(data.content[0].text);
    return { type: "FABRIC_RESULT", data: result };
  } catch (err) {
    if (err.name === "AbortError") {
      return { type: "FABRIC_ERROR", message: "Analysis timed out" };
    }
    return { type: "FABRIC_ERROR", message: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

// Hour 1 self-test — remove before shipping
analyzeFabric("Polyester 100%", "leggings").then(result => {
  console.log("[whatTheFrock] Hour 1 test result:", JSON.stringify(result, null, 2));
});
