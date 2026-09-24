# whatTheFrock

A browser-extension prototype for explaining garment-composition information in context on supported retailer pages.

## What it does

The extension extracts a visible composition string from supported product pages, sends structured context to a background analyzer, and renders a non-blocking overlay with a prototype score, explanation, source link, and alternatives. The repository contains a mock-data UI harness that shows the overlay’s loading, risk, and error states.

The public `index.html` hosts that harness in a framed walkthrough. It presents a hardcoded simulation of Hanes style WPC622—a current 100% cotton basics listing with a direct source link—then lets a reviewer trigger the actual overlay UI. It does not access retailer pages, user data, or an API key; price and availability are explicitly non-live demo content.

## Architecture

```text
Supported product page → content script extracts composition → background analyzer → overlay UI
Public walkthrough → fixed mock result controls → same overlay UI states
```

- `content.js`: retailer-specific composition extraction and context assembly.
- `background.js`: extension worker boundary for model-backed analysis.
- `overlay.js` and `overlay.css`: isolated, fixed-position UI.
- `test.html`: local mock-data overlay harness; embedded by `index.html` for GitHub Pages.

## Stack

| Layer | Technology | Why it is here |
| --- | --- | --- |
| Extension | Manifest V3 and JavaScript | Runs page extraction only on supported retailers. |
| UI | Vanilla HTML, CSS, JavaScript | Keeps overlay states easy to inspect without a build step. |
| Public demo | Static GitHub Pages | Shows interaction without a retailer session, secret, or request. |

## Running it

Open `test.html` in a browser to exercise mock UI states. To test the extension, load the repository with Chrome Developer Mode and visit a supported product page. There is no build step. The public walkthrough starts at `index.html` and is static.

## Decisions and tradeoffs

| Decision | Chosen | Rejected or alternative | Why / tradeoff |
| --- | --- | --- | --- |
| Public demo | Fixed Hanes-product simulation and mock UI states | Live retailer or model analysis | Makes the interaction reviewable without reading shopper data or exposing keys, while showing a realistic shopper flow. |
| Public claims | Explicit prototype boundary | Presenting a score as validated health guidance | The heuristic needs domain-expert review before it can support health claims. |
| Product UI | Non-blocking overlay | Replacing the retailer page | Preserves product-page context and keeps the shopper in control. |
