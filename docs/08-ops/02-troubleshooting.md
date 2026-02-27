# Troubleshooting

Common issues and solutions when running Doppelganger.

## 1. Browser fails to launch

**Error**: `Failed to launch browser: Chromium revision is not downloaded.`

*   **Cause**: Playwright needs specific browser binaries.
*   **Fix (Docker)**:
    *   Rebuild the image: `docker compose build --no-cache`.
*   **Fix (NPM)**:
    *   Run `npx playwright install chromium`.

**Error**: `Protocol error (Target.detachFromTarget): Target closed.`

*   **Cause**: The browser crashed due to memory limits.
*   **Fix**:
    *   Increase Docker memory: `--memory="2g" --shm-size="1g"`.
    *   Use `--disable-dev-shm-usage` flag (Doppelganger does this by default).

## 2. Proxies not working

**Error**: `ERR_PROXY_CONNECTION_FAILED`

*   **Cause**: Invalid proxy credentials or network firewall.
*   **Fix**:
    *   Verify proxy server address and port.
    *   Check `Settings > Proxies` for connectivity status (future feature).
    *   Ensure your server can reach the proxy (check outbound rules).

## 3. Element not found

**Error**: `Timeout 30000ms exceeded while waiting for selector ".foo"`

*   **Cause**: The selector is incorrect or the element loads dynamically.
*   **Fix**:
    *   Use **Headful Mode** to inspect the page live.
    *   Increase `wait` time before the action.
    *   Use `wait_selector` explicitly.
    *   Check for iframes (Doppelganger does not support cross-origin iframes yet).

## 4. Session Expired frequently

**Error**: You are logged out repeatedly.

*   **Cause**:
    *   `SESSION_SECRET` changed (server restart).
    *   Cookies are blocked by browser.
*   **Fix**:
    *   Set a static `SESSION_SECRET` in `.env`.
    *   Ensure `SESSION_COOKIE_SECURE` matches your protocol (HTTP vs HTTPS).

## 5. CAPTCHA / Bot Detection

**Error**: Page shows a CAPTCHA or "Access Denied".

*   **Cause**: The site detected automation.
*   **Fix**:
    *   Enable **Stealth Mode** options in Task Editor.
    *   Use high-quality **Residential Proxies**.
    *   Rotate **User Agents**.
    *   Add random `wait` times between actions.
