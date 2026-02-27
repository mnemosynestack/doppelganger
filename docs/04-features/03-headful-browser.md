# Headful Mode (VNC)

Doppelganger includes a powerful **Headful Browser Mode** that allows you to see and interact with the automation as it runs. This is powered by a VNC server running alongside the Playwright container.

## Why Headful?

*   **Debugging**: Step through tasks visually to identify why a selector fails.
*   **Manual Intervention**: Solve CAPTCHAs or complete complex 2FA flows that automation cannot handle.
*   **Exploration**: Browse sites naturally to discover selectors and API endpoints.
*   **Recording**: Create high-fidelity video demonstrations of your automation.

## Starting a Headful Session

1.  **Dashboard**: Click `+ New Task` and select **Headful** mode.
2.  **Editor**: Set the target URL.
3.  **Run**: Click **Run Task**.

The browser window will open inside the VNC viewer embedded in the UI.

## Controls

The VNC interface provides a standard desktop environment:
*   **Mouse/Keyboard**: Full interaction support.
*   **Clipboard**: Copy/paste text between your host and the remote browser.
*   **Resolution**: The viewport resizes dynamically (default 1280x720).

## Persistence

Headful sessions share the same **Cookie Jar** (`storage_state.json`) as automated tasks. This means:
1.  **Login once**: Log in manually in Headful mode.
2.  **Automate**: Run an Agent task that reuses the session cookies.

**Stateless Option**: Enable `statelessExecution` to launch a clean, incognito-like session that won't save cookies.

## API Integration

You can start a headful session programmatically:

```bash
curl -X POST http://localhost:11345/api/tasks/headful \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

The response includes the VNC connection URL.

## Stopping

Click **Stop Headful** in the Editor to terminate the session and close the browser. This ensures resources are freed.
