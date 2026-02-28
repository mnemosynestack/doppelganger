## 2025-02-28 - [Frontend Performance: CookiePanel Optimization]
**Learning:** `CookiesPanel.tsx` previously re-rendered all cookies and executed expensive decoding logic (`decodeURIComponent`, `atob`, regex checks) on every re-render (e.g. expanding/collapsing a row), because this computation was tightly coupled with the loop inside the component render body.
**Action:** Use `useMemo` to precalculate derived data structure for collections before the render `map` loop, particularly when components have internal state triggers that cause frequent re-renders.
