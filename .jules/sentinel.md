# Sentinel Journal - Critical Security Learnings

## 2025-02-15 - [SSRF via Template Variable Resolution]
**Vulnerability:** A Server-Side Request Forgery (SSRF) bypass was identified in the `handleAgent` function. The function validated the user-provided URL string *before* resolving template variables (e.g., `{$host}`). This allowed an attacker to supply a benign template (e.g., `http://{$host}`) that bypassed the `validateUrl` check (which failed to resolve the template string via DNS and leniently allowed it), while the subsequent navigation action (`page.goto`) used the resolved value (e.g., `http://127.0.0.1`), leading to internal network access.
**Learning:** Input validation must always occur *after* all transformations and substitutions are applied. Validating the raw input is insufficient when the input undergoes significant modification (like template resolution) before usage.
**Prevention:** Ensure that security checks (like `validateUrl`) are performed on the final, resolved value that will be used in the critical operation. Move variable resolution logic before validation logic.
