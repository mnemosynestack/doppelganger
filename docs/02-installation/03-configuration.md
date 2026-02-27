# Configuration

Doppelganger uses environment variables to configure key aspects of the server and automation environment. These variables are defined in `src/server/constants.js`.

## Core Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `11345` | The port the backend server listens on. |
| `SESSION_SECRET` | *(Required)* | A random string used to sign session cookies. |
| `NODE_ENV` | `production` | Set to `development` for local dev mode. |
| `ALLOWED_IPS` | `*` (Open) | Comma-separated list of allowed IP addresses or CIDR ranges. |
| `ALLOW_PRIVATE_NETWORKS` | `true` | Set to `false` or `0` to block access to local/private networks (SSRF protection). |
| `TRUST_PROXY` | `false` | Set to `true` or `1` if running behind a reverse proxy (e.g., Nginx, AWS ALB). |

## Rate Limiting

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max failed login attempts per window (15 mins). |
| `DATA_RATE_LIMIT_MAX` | `100` | Max data requests (captures, logs) per window (15 mins). |

## VNC / Headful Mode

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NOVNC_PORT` | `54311` | Port for the noVNC web interface. |

## Feature Flags

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` if serving over HTTPS. |

## Example `.env` File

```env
PORT=11345
SESSION_SECRET=super_secret_key_12345
ALLOWED_IPS=127.0.0.1,192.168.1.0/24
ALLOW_PRIVATE_NETWORKS=false
TRUST_PROXY=true
AUTH_RATE_LIMIT_MAX=20
DATA_RATE_LIMIT_MAX=500
NOVNC_PORT=54311
SESSION_COOKIE_SECURE=true
```

## Notes

*   **Allow Private Networks**: By default, `ALLOW_PRIVATE_NETWORKS` is `true`, meaning Doppelganger can access internal services. In production environments exposed to untrusted users, set this to `false`.
*   **Session Secret**: If `SESSION_SECRET` is not provided, Doppelganger will generate a random one on startup (or read from `data/session_secret.txt` if available). However, for consistent sessions across restarts, set a static secret.
*   **Allowed IPs**: If you expose Doppelganger to the internet, **always restrict access** using `ALLOWED_IPS` or authentication.
