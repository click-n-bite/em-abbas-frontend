# Lead handling

Lead pages expose Open, In progress, Closed, and All tabs. Active leads can Start progress, Return to Open, or Close. Closed leads can Reopen, which resets handling and closure metadata. Lead details display Started by and Started at when available. Staff attribution is informational and does not assign exclusive ownership.

Requires ema-api migration V33 and its three-status API. Deploy the API first, then the portal, and refresh existing browser sessions before staff use the new workflow. Existing leads remain Open or Closed.

Validation: npm run typecheck; npm run build; focused ESLint on changed source files. tests/lead-handling-browser.mjs covers English/Arabic at 1440px, 1280px, 1024px, and 390px with synthetic intercepted APIs: start from list, tab/URL restoration, return to Open, restart, close, and reopen. Run it against a local preview (LEAD_PREVIEW_URL, default http://127.0.0.1:3107), with playwright available or PLAYWRIGHT_MODULE_PATH pointing to its package, and Chrome installed. It also checks toolbar overflow and compact action height. Set LEAD_SCREENSHOT_DIR to save preview images; the Arabic preview uses dark mode.
