## 2026-03-25 - [Server Security Hardening]
**Vulnerability:** Missing CSP/HSTS headers, insecure session cookie (missing HttpOnly), and redirect-based SSRF risk in webhooks.
**Learning:** Even with existing CSRF and rate-limiting protections, defense-in-depth requires hardening cookies and restricting outbound fetch behavior. Standard headers like CSP provide critical protection against XSS-based exfiltration.
**Prevention:** Always default to HttpOnly for sensitive cookies and restrict redirects in server-side outbound requests (webhooks, etc.).
