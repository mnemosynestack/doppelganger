# Changelog

## v0.10.0 — 2026-03-18

### New Features

- **Baserow output provider** — Task extraction results can now be pushed directly to Baserow tables. Configure credentials in the API Keys panel and select a database/table via auto-discovered dropdowns in the task Output tab. Falls back to manual table ID entry for tokens without browse access.
- **Credentials system** — New credential CRUD API with encrypted storage in `data/credentials.json`. Database credentials appear as rows in the API Keys panel (with a Baserow icon) alongside existing AI keys.
- **Stealth plugin & persistent browser profiles** — All three browser launchers (`browser.js`, `scrape.js`, `headful.js`) now use `playwright-extra` with `puppeteer-extra-plugin-stealth`. Cookies and storage persist across runs via `launchPersistentContext`. Chrome user-agent updated from v121 to v143.
- **DNS-over-HTTPS** — Cloudflare DoH is applied across all browser entry points when no proxy is active; automatically disabled when a proxy is configured to avoid conflicts.
- **`includeHtml` task setting** — New per-task toggle to control whether HTML is included in API responses, reducing payload size when HTML is not needed.
- **Sliding session TTL** — Sessions now use a rolling cookie with `resave: true`, so the TTL resets on activity rather than expiring from the original login time.

### Improvements

- **Headful browser UX** — Browser window now maximizes on launch, closes automatically after a selector is picked, and the inspect overlay cursor color has been updated.
- **Cookie migration** — One-time migration moves existing cookies from `storage_state.json` into the new persistent browser profile on first run.
- **Login state sync** — Cookies saved during headful sessions are now correctly propagated to subsequent headless agent/scrape runs.
- **Headful storage state sync** — Browser storage state is flushed to disk when the headful browser window is closed, preventing data loss.
- **O(1) execution lookup** — Execution records are now indexed by ID in a `Map` cache, eliminating repeated linear scans and reducing memory overhead in hot paths.
- **Conditional outerHTML fetching** — `outerHTML` is only fetched in agent logic and actions when actually needed, cutting unnecessary DOM serialisation on every step.
- **Optimized foreach loop** — `innerHTML` is fetched conditionally in foreach iterations, reducing unnecessary page round-trips.
- **EditorScreen refactor** — `EditorScreen.tsx` has been split into focused hook and component modules under `src/components/editor/` and `src/hooks/`, improving maintainability.

### Security

- **SSRF protection hardening** — URL validation and credential field sanitisation tightened across API endpoints to block server-side request forgery vectors.
- **Authentication hardening** — Session lifecycle improved: sessions are regenerated on login, destroyed on logout, and inactivity timeouts are enforced.
- **Timing-safe login** — Login endpoint now uses a constant-time comparison to prevent user enumeration through response timing.
- **Path traversal fix** — Resolved a path traversal vulnerability in the `agent start` action that could allow escaping the intended working directory.
- **Static captures protected** — Screenshot and capture files under `public/captures/` are now served behind authentication, preventing unauthenticated access.
- **Email validation hardened** — Login email validation tightened to reject malformed inputs that bypassed previous checks.

### Accessibility

- **Tab focus states** — Standardized keyboard focus rings and ARIA states across all tab components (Editor, Settings, Schedule).
- **ActionItem header** — Improved focus visibility and keyboard interaction for action item headers in the editor.
- **Zoom controls & CTAs** — Editor zoom buttons and primary call-to-action buttons now have consistent accessible focus styles.
- **ScheduleTab** — Focus states and ARIA attributes improved throughout the scheduling interface.

### Bug Fixes

- Fixed inspect mode toggle button not updating its visual state when toggled.
- Fixed stealth plugin crashes and `page.evaluate` failures that occurred after switching from a headful to a headless session.
- Fixed stateless (incognito) mode to be truly stateless, removing leftover `storage_state.json` reads/writes in that path.
