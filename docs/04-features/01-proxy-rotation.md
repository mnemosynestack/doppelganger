# Proxy Rotation

Doppelganger includes a robust proxy management system to evade IP-based blocking. You can configure proxies globally or enable rotation on a per-task basis.

## Configuring Proxies

Navigate to **Settings > Proxies** to manage your proxy list.

### Adding a Proxy
Click **Add Proxy** and enter the details:
*   **Server**: The proxy address (e.g., `http://192.168.1.5:8080`, `socks5://10.0.0.5:1080`).
*   **Username/Password**: Optional credentials for authentication.
*   **Label**: A friendly name (e.g., "US Residential").

### Importing Proxies
You can bulk import proxies using a JSON file or paste a list. The format is:

```json
[
  {
    "server": "http://user:pass@proxy1.com:8080",
    "label": "Proxy 1"
  },
  {
    "server": "socks5://proxy2.com:1080",
    "label": "Proxy 2"
  }
]
```

## Rotation Strategies

Doppelganger supports two rotation modes:
1.  **Round-Robin**: Cycles through the list sequentially (Proxy 1 -> Proxy 2 -> ...). This ensures even usage.
2.  **Random**: Picks a random proxy from the list for each execution.

### Default Proxy
You can designate a specific proxy as the "Default". This proxy will be used for all tasks unless rotation is explicitly enabled.

### Include Host IP
You can choose whether your server's own IP address should be included in the rotation pool. This is useful for testing or when running on a residential connection.

## Enabling Rotation in Tasks

In the **Task Editor**, enable the **Rotate Proxies** checkbox.
*   When enabled: The task will use a proxy from the rotation pool according to the strategy.
*   When disabled: The task will use the **Default Proxy** (if set) or the **Host IP**.

## API Management

You can also manage proxies via the API:
*   `GET /api/settings/proxies`: List all proxies.
*   `POST /api/settings/proxies`: Add a proxy.
*   `POST /api/settings/proxies/rotation`: Update rotation settings.
