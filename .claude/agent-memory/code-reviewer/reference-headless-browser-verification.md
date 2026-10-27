---
name: reference-headless-browser-verification
description: How to run real-browser behavioral checks in this repo without playwright package (CDP + cached headless shell); smoke tests that only count DOM nodes missed real bugs
metadata:
  type: reference
---

No playwright/puppeteer npm package installed, but a Chromium headless shell exists at
`~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
Drive it with a tiny Node 24 script: spawn with `--remote-debugging-port`, fetch `/json`, use global `WebSocket`,
`Page.navigate` then `Runtime.evaluate` (awaitPromise, returnByValue). `--dump-dom` with timeouts does not run timers reliably.

**Why:** prior "smoke test" only counted `<article>` nodes / UI state; behavioral probes (scroll and read spacer heights; compare UI reaction state vs server `/api/feed`) exposed critical virtualization and race bugs it missed.
**How to apply:** for lesson UI claims, verify against server truth and scroll geometry, not just DOM counts. Start `npm run dev` in background, reset `/__mock/config` afterwards, stop the process.
