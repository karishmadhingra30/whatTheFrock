// overlay.js — Person 3 owns this file
// Injects the whatTheFrock floating risk overlay into H&M product pages.
// Exposes window.whatTheFrockRender(data) and window.whatTheFrockError(msg)
// so that content.js can push real data in after the API responds.

(function () {
  'use strict';

  // Guard: don't inject twice (SPA navigation can re-run content scripts)
  if (document.getElementById('wtf-overlay')) return;

  // ── Styles ────────────────────────────────────────────────────────────────

  const styleEl = document.createElement('style');
  styleEl.id = 'wtf-styles';
  styleEl.textContent = `
    /* Reset inside our sandbox */
    #wtf-overlay, #wtf-overlay * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.4;
    }

    /* ── Overlay container ── */
    #wtf-overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      filter: drop-shadow(0 -4px 24px rgba(0,0,0,0.18));
    }

    /* ── Expanded detail panel (slides up from behind the banner) ── */
    #wtf-panel {
      max-height: 0;
      overflow: hidden;
      background: #fff;
      transition: max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #wtf-overlay.wtf-expanded #wtf-panel {
      max-height: 500px;
    }

    .wtf-panel-inner {
      padding: 22px 24px 18px;
      border-top: 4px solid #ccc;
    }
    #wtf-overlay.wtf-low    .wtf-panel-inner { border-color: #00C896; }
    #wtf-overlay.wtf-medium .wtf-panel-inner { border-color: #FF9F0A; }
    #wtf-overlay.wtf-high   .wtf-panel-inner { border-color: #FF2D87; }

    /* Score row */
    .wtf-score-row {
      display: flex;
      align-items: baseline;
      gap: 14px;
      margin-bottom: 14px;
    }
    .wtf-score-big {
      font-size: 52px;
      font-weight: 900;
      letter-spacing: -3px;
      line-height: 1;
    }
    #wtf-overlay.wtf-low    .wtf-score-big { color: #00A878; }
    #wtf-overlay.wtf-medium .wtf-score-big { color: #E08000; }
    #wtf-overlay.wtf-high   .wtf-score-big { color: #FF2D87; }

    .wtf-risk-badge {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      padding: 5px 12px;
      border-radius: 6px;
      color: #fff;
    }
    #wtf-overlay.wtf-low    .wtf-risk-badge { background: #00C896; }
    #wtf-overlay.wtf-medium .wtf-risk-badge { background: #FF9F0A; }
    #wtf-overlay.wtf-high   .wtf-risk-badge { background: #FF2D87; }

    /* Composition */
    .wtf-composition-line {
      font-size: 14px;
      color: #666;
      margin-bottom: 12px;
    }
    .wtf-composition-line strong { color: #111; font-weight: 700; }

    /* Risk summary box */
    .wtf-summary {
      font-size: 13.5px;
      line-height: 1.65;
      color: #333;
      background: #F5F5F7;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 12px;
    }

    /* Source link */
    .wtf-source-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
      color: #0066CC;
      text-decoration: none;
      margin-bottom: 16px;
    }
    .wtf-source-link:hover { text-decoration: underline; }

    /* Alternatives */
    .wtf-alts-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 8px;
    }
    .wtf-alts-row {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }
    .wtf-alt-tag {
      background: #E6F9F2;
      color: #00875A;
      font-size: 12px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1.5px solid #00C896;
    }

    /* ── Bottom banner ── */
    #wtf-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      cursor: pointer;
      user-select: none;
      transition: filter 0.15s ease;
      min-height: 54px;
    }
    #wtf-banner:hover { filter: brightness(1.07); }

    /* Risk-level gradient backgrounds */
    #wtf-overlay.wtf-loading  #wtf-banner {
      background: linear-gradient(135deg, #1C1C2E 0%, #2D2D50 100%);
    }
    #wtf-overlay.wtf-error    #wtf-banner {
      background: linear-gradient(135deg, #3A3A3A 0%, #555 100%);
    }
    #wtf-overlay.wtf-low      #wtf-banner {
      background: linear-gradient(135deg, #00C896 0%, #00A878 100%);
    }
    #wtf-overlay.wtf-medium   #wtf-banner {
      background: linear-gradient(135deg, #FFB347 0%, #E08000 100%);
    }
    #wtf-overlay.wtf-high     #wtf-banner {
      background: linear-gradient(135deg, #FF2D87 0%, #FF3B30 100%);
    }

    /* Logo */
    .wtf-logo {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: -0.2px;
      color: #fff;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Score pill (shown after results arrive) */
    .wtf-score-pill {
      display: none;
      align-items: center;
      gap: 5px;
      background: rgba(255,255,255,0.22);
      backdrop-filter: blur(4px);
      border-radius: 999px;
      padding: 4px 13px;
      font-size: 15px;
      font-weight: 900;
      color: #fff;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Risk text (small, uppercase) */
    .wtf-risk-text-sm {
      display: none;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.92);
      flex-shrink: 0;
    }

    /* Composition snippet */
    .wtf-composition-sm {
      display: none;
      font-size: 12px;
      color: rgba(255,255,255,0.72);
      font-style: italic;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Toggle button */
    .wtf-toggle-btn {
      display: none;
      background: rgba(255,255,255,0.22);
      border: 1.5px solid rgba(255,255,255,0.35);
      border-radius: 999px;
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .wtf-toggle-btn:hover { background: rgba(255,255,255,0.35); }

    /* Loading state elements */
    .wtf-spinner {
      width: 20px;
      height: 20px;
      border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: wtf-spin 0.75s linear infinite;
      flex-shrink: 0;
    }
    @keyframes wtf-spin { to { transform: rotate(360deg); } }

    .wtf-status-text {
      font-size: 14px;
      color: rgba(255,255,255,0.82);
      font-style: italic;
    }
  `;
  document.head.appendChild(styleEl);

  // ── DOM ───────────────────────────────────────────────────────────────────

  const overlay = document.createElement('div');
  overlay.id = 'wtf-overlay';
  overlay.className = 'wtf-loading';
  overlay.innerHTML = `
    <div id="wtf-panel">
      <div class="wtf-panel-inner">
        <div class="wtf-score-row">
          <span class="wtf-score-big" id="wtf-score-big">—</span>
          <span class="wtf-risk-badge" id="wtf-risk-badge">—</span>
        </div>
        <div class="wtf-composition-line" id="wtf-composition-line">🧵 —</div>
        <div class="wtf-summary" id="wtf-summary">—</div>
        <a class="wtf-source-link" id="wtf-source-link" href="#" target="_blank" rel="noopener noreferrer">🔬 —</a>
        <div class="wtf-alts-label" id="wtf-alts-label" style="display:none">🌿 Safer alternatives:</div>
        <div class="wtf-alts-row" id="wtf-alts-row"></div>
      </div>
    </div>

    <div id="wtf-banner">
      <span class="wtf-logo">💃 whatTheFrock</span>
      <div class="wtf-spinner" id="wtf-spinner"></div>
      <span class="wtf-status-text" id="wtf-status-text">Scanning fabric composition...</span>
      <span class="wtf-score-pill" id="wtf-score-pill"></span>
      <span class="wtf-risk-text-sm" id="wtf-risk-text-sm"></span>
      <span class="wtf-composition-sm" id="wtf-composition-sm"></span>
      <button class="wtf-toggle-btn" id="wtf-toggle-btn">▲ See why</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── Expand / collapse ─────────────────────────────────────────────────────

  let expanded = false;

  document.getElementById('wtf-banner').addEventListener('click', function () {
    // Only toggle if we have real results
    if (overlay.classList.contains('wtf-loading')) return;
    expanded = !expanded;
    overlay.classList.toggle('wtf-expanded', expanded);
    document.getElementById('wtf-toggle-btn').textContent = expanded ? '▼ Close' : '▲ See why';
  });

  // Stop clicks inside the panel from collapsing it
  document.getElementById('wtf-panel').addEventListener('click', function (e) {
    e.stopPropagation();
  });

  // ── Constants ─────────────────────────────────────────────────────────────

  const RISK_META = {
    low:    { emoji: '🌿', label: 'LOW RISK',    cls: 'wtf-low' },
    medium: { emoji: '⚠️',  label: 'MEDIUM RISK', cls: 'wtf-medium' },
    high:   { emoji: '☠️',  label: 'HIGH RISK',   cls: 'wtf-high' },
  };

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Called by content.js after background.js returns a FABRIC_RESULT.
   * @param {object} data - The parsed JSON from Claude (see background.js schema)
   */
  window.whatTheFrockRender = function (data) {
    const level  = (data.risk_level || 'high').toLowerCase();
    const meta   = RISK_META[level] || RISK_META.high;
    const score  = data.score !== undefined ? data.score : '?';
    const alts   = Array.isArray(data.safer_alternatives) ? data.safer_alternatives : [];

    // Swap overlay risk class
    overlay.className = meta.cls;

    // ── Banner ──
    document.getElementById('wtf-spinner').style.display = 'none';
    document.getElementById('wtf-status-text').style.display = 'none';

    const pill = document.getElementById('wtf-score-pill');
    pill.style.display = 'flex';
    pill.textContent = `${meta.emoji} ${score}/10`;

    const riskSm = document.getElementById('wtf-risk-text-sm');
    riskSm.style.display = '';
    riskSm.textContent = meta.label;

    const compSm = document.getElementById('wtf-composition-sm');
    compSm.style.display = '';
    compSm.textContent = data.composition || '';

    const btn = document.getElementById('wtf-toggle-btn');
    btn.style.display = '';
    btn.textContent = '▲ See why';

    // ── Detail panel ──
    document.getElementById('wtf-score-big').textContent = `${score}/10`;
    document.getElementById('wtf-risk-badge').textContent = `${meta.emoji} ${meta.label}`;

    document.getElementById('wtf-composition-line').innerHTML =
      `🧵 <strong>${_esc(data.composition || '—')}</strong>`;

    document.getElementById('wtf-summary').textContent = data.risk_summary || '—';

    const srcLink = document.getElementById('wtf-source-link');
    srcLink.href = data.risk_source_url || '#';
    srcLink.textContent = `🔬 ${data.risk_source_label || 'Source'}`;

    if (alts.length) {
      document.getElementById('wtf-alts-label').style.display = '';
      document.getElementById('wtf-alts-row').innerHTML =
        alts.map(a => `<span class="wtf-alt-tag">🌱 ${_esc(a)}</span>`).join('');
    }
  };

  /**
   * Called by content.js if the API call fails or times out.
   * @param {string} message - Human-readable error description
   */
  window.whatTheFrockError = function (message) {
    overlay.className = 'wtf-error';
    document.getElementById('wtf-spinner').style.display = 'none';
    const statusEl = document.getElementById('wtf-status-text');
    statusEl.style.display = '';
    statusEl.textContent = `😬 ${message || 'Analysis failed — try refreshing'}`;
  };

  // Alias used by content.js (whatTheFrockRenderError → whatTheFrockError)
  window.whatTheFrockRenderError = window.whatTheFrockError;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
