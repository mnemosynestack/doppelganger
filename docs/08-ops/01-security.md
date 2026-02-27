# Security Best Practices

Securing your Doppelganger instance is critical, especially when running on a public server.

## 1. Authentication

By default, the Doppelganger UI requires an account. However, you should also:

*   **API Key**: Generate a strong API Key in **Settings > System**.
*   **Rotate**: Regularly regenerate the API key if you suspect it's compromised.
*   **Header**: Always use `x-api-key` or `Authorization: Bearer` for API calls.

## 2. IP Allowlist (`ALLOWED_IPS`)

The most effective way to secure a deployment is to restrict access to trusted IP addresses.

*   **Environment Variable**: `ALLOWED_IPS`
*   **Example**: `ALLOWED_IPS=127.0.0.1,192.168.1.5,10.0.0.0/8`
*   **Config File**: Alternatively, edit `data/allowed_ips.json`.

This blocks unauthorized traffic at the network level before it reaches the application logic.

## 3. SSRF Protection (`ALLOW_PRIVATE_NETWORKS`)

Server-Side Request Forgery (SSRF) is a risk when allowing users to trigger scrapes of arbitrary URLs.

*   **Default**: `ALLOW_PRIVATE_NETWORKS=true` (Convenient for local dev).
*   **Production**: Set `ALLOW_PRIVATE_NETWORKS=false`.
    *   This prevents users from scanning your internal network (e.g., `http://169.254.169.254/latest/meta-data`).
    *   It blocks RFC 1918 private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).

## 4. Session Security

*   **HTTPS**: Always run Doppelganger behind a reverse proxy (Nginx, Caddy) that handles TLS/SSL.
*   **Secure Cookies**: Set `SESSION_COOKIE_SECURE=true` in your `.env` file to ensure cookies are only sent over HTTPS.
*   **Strong Secret**: Ensure `SESSION_SECRET` is a long, random string.

## 5. Rate Limiting

Doppelganger includes built-in rate limiting to prevent abuse.

*   **Authentication**: Max 10 failed login attempts per 15 minutes (`AUTH_RATE_LIMIT_MAX`).
*   **Data API**: Max 100 data requests per 15 minutes (`DATA_RATE_LIMIT_MAX`).

Adjust these values in `.env` if legitimate traffic is being blocked.
