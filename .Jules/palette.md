## 2025-05-15 - Accessibility Gaps in Icon-Only and Toggle Buttons
**Learning:** The application heavily relies on icon-only buttons (Refresh, Clear, Delete) and toggle groups (Scraper/Agent, Visual/JSON) without semantic accessibility attributes. `aria-label` is missing for actions, and `aria-pressed` or `aria-current` is missing for states.
**Action:** Systematically audit and add `aria-label` to all icon-only buttons and ensure toggle states are communicated via ARIA attributes when modifying UI components.

## 2026-02-13 - Context-Dependent Input Accessibility
**Learning:** Edit modes that replace text with inputs often drop context (labels/placeholders), relying on the user's memory of the original text's meaning.
**Action:** Always ensure inputs in edit modes retain the context via placeholders and aria-labels, mirroring the read-only state's semantics.
