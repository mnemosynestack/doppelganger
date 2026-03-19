# Changelog

## [0.11.0] - 2026-03-19

### Security
- **[HIGH] Fix protocol validation bypass in `validateUrl`** — protocols were not being checked strictly, allowing potential SSRF via alternative schemes.
- **Harden SSRF protection** — additional edge-case coverage for IPv6 and private-network ranges in `isPrivateIP` / `validateUrl`.
- **Login timing-safety** — timing-safe comparison now used across all login checks to prevent user-enumeration via response-time differences.
- **Standardize accessibility and focus states for global overlays** — keyboard focus is no longer lost or trapped unexpectedly in modal overlays.

### Features
- **Switch primary font to Questrial** — replaced Geologica with Questrial site-wide for a cleaner, more legible aesthetic.
- **Disable font synthesis** — prevent browsers from artificially bolding/italicising Questrial, preserving its intended rendering.
- **Auto-enable inspect mode** — opening a headful session for selector finding now automatically activates inspect mode, removing a manual step.
- **Optimize task cloning for versioning** — task clone operations are now significantly faster and produce leaner copies.
- **Larger page headings** — Dashboard, Run History, Settings, and Captures screen headings increased from `text-base` to `text-2xl`.

### Bug Fixes
- **Fix headful session and agent handoff** — a null browser reference caused headful sessions to fail silently; reference is now guarded correctly.
- **Fix inspect-mode click interception** — clicks in headful mode were being swallowed by the inspect overlay when it should not have been active.
- **Fix URL variable interpolation in headful mode** — variables resolving to objects were being coerced to `[object Object]` instead of their string value.
- **Fix headful modal sizing, context menu dismissal, and selector finder heuristics** — several UX regressions in the headful UI corrected in one pass.

### Improvements
- **Restyle screen headings** — page-level titles moved to minimal all-caps uppercase labels for a more refined look, now also larger.
- **Standardize accessibility roles** — `role`, `aria-*`, and focus-visible styles audited and normalised across ActionItem, tabs, and editor CTAs.
- **Remove unused `memo` import in ActionItem** — dead import and its wrapper removed; no behavioural change.
