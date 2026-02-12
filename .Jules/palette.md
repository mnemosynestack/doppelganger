## 2025-05-15 - Accessibility Gaps in Icon-Only and Toggle Buttons
**Learning:** The application heavily relies on icon-only buttons (Refresh, Clear, Delete) and toggle groups (Scraper/Agent, Visual/JSON) without semantic accessibility attributes. `aria-label` is missing for actions, and `aria-pressed` or `aria-current` is missing for states.
**Action:** Systematically audit and add `aria-label` to all icon-only buttons and ensure toggle states are communicated via ARIA attributes when modifying UI components.
