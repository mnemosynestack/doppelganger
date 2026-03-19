## 2025-05-22 - [Keyboard Accessibility for Action Items]
**Learning:** Interactive elements implemented as `div` or `span` without proper ARIA roles and keyboard listeners are invisible to screen readers and inaccessible to keyboard users. In a complex drag-and-drop interface like the Task Editor, custom interactive targets must also be explicitly excluded from drag operations (e.g., via `isInteractiveTarget` helpers) to prevent interaction conflicts.
**Action:** Always use `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) for custom interactive elements. Ensure they have descriptive `aria-label` and `title` attributes. Update drag-and-drop boundary checks to include these new interactive roles.

## 2025-05-22 - [Standardized Tab Accessibility and Focus States]
**Learning:** Button groups used as tabs (Settings, History filters, Results views) lack inherent semantic structure for screen readers and often have invisible focus indicators when the active state is high-contrast (e.g., solid white background).
**Action:** Standardize tab patterns with `role="tablist"`, `role="tab"`, and `aria-selected`. Use `focus-visible:ring-2 focus-visible:ring-blue-500` for active/high-contrast tab states to ensure keyboard focus is always visible against any background.

## 2025-05-22 - [Standardized Accessibility for Global Overlays]
**Learning:** Global app overlays (alerts, confirmations, and modals) often lack consistent ARIA roles and visible focus indicators, making critical system feedback inaccessible to keyboard and screen reader users. High-contrast elements (like white buttons) require specific ring colors (e.g., `blue-500`) to remain visible against light backgrounds.
**Action:** Implement `role="alert"` or `role="status"` on notification containers based on severity. Ensure all modal/alert buttons have `focus-visible:ring-2` with context-appropriate colors (`blue-500` for light, `white/50` for dark) and explicit `aria-label` for icon-only actions.
