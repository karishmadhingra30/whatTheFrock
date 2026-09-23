# whatTheFrock

A Chrome extension prototype that reads garment-composition information on supported retailer product pages and presents a plain-language fabric-risk explainer with links to cited research and lower-risk material alternatives.

## The user problem

Product pages usually list fabric composition, but shoppers have to translate that information themselves. This prototype tests a faster workflow: detect the composition in context, explain the heuristic behind a score, and give the shopper a path to inspect the evidence.

## What it does

1. Detects a supported product page and opens the retailer's materials section when needed.
2. Extracts fabric composition and infers a broad garment type from the page.
3. Sends the structured context to a model-backed analyzer through the extension background worker.
4. Renders a non-blocking overlay with a score, explanation, source link, and suggested alternatives.

The current manifest includes H&M and Lululemon URL patterns. Retailer DOMs change frequently, so extraction logic should be treated as prototype code and tested against the supported page types.

## Try the interface without a retailer page

The [public interactive walkthrough](https://karishmadhingra30.github.io/whatTheFrock/) exposes this mock-data harness directly in the browser. It does not visit retailer sites, analyze a real product, or make health claims.

Open `test.html` in a browser to exercise the loading, low-, medium-, high-risk, and error overlay states with mock data. This is the quickest way to review the product interaction without sending a request to an external service.

## Load the extension locally

1. Clone this repository.
2. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and select this repository directory.
4. Visit a supported product page and open the materials/composition section if the retailer has changed its markup.

There is no build step.

## Technical highlights

- Manifest V3 with a background service worker for model requests.
- Content scripts that keep retailer-page extraction separate from the UI overlay.
- Fixed-position overlay designed to leave the retailer's page layout intact.
- A local mock-data harness for UI-state review without retailer access.

## Important limitations

This is a hackathon-style product prototype, not medical advice or a validated exposure assessment. The scoring heuristic and generated explanations require domain-expert review before they could support health claims. The extension must never contain a production API key in source code; configure secrets through a secure extension/backend design before any public release.

## Project status

Prototype complete. Strong next steps are a documented evidence rubric, retailer-specific extraction tests, and a static explainer/demo page with an annotated product walkthrough.
