## 2024-05-24 - Unauthenticated Telemetry Data Leak
**Vulnerability:** User names and email addresses were being sent in plaintext to a hardcoded external analytics endpoint upon signup and login without explicit consent, via an automatically executed `fetch` request.
**Learning:** Hardcoded secrets (like `x-telemetry-secret: 'doppelganger-telemetry-v1'`) and opt-out-by-default tracking can expose user data to unauthorized parties. The telemetry feature bypassed configuration flags.
**Prevention:** Ensure external data transmissions are explicitly gated by environment variables (e.g., `TELEMETRY_SECRET`). Avoid hardcoding tokens in source files.
