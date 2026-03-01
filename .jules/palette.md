## 2024-05-18 - Icon-only buttons with titles need aria-labels
**Learning:** Adding a `title` attribute to an icon-only button (e.g., `<button title="Delete"><Icon/></button>`) provides a tooltip on hover, but it is not consistently announced by all screen readers. An explicit `aria-label` is still required for robust accessibility.
**Action:** When creating icon-only buttons, ensure both `title` (for visual users) and `aria-label` (for screen reader users) are present, or use visually hidden text.
