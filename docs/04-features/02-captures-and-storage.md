# Captures & Storage

Doppelganger automatically captures visual evidence of your automation runs. This is crucial for debugging, auditing, and ensuring quality.

## Screenshots

By default, every successful task execution (in `agent` or `scrape` mode) captures a final screenshot of the page.

*   **Format**: PNG
*   **Location**: `public/captures/<run_id>_screenshot.png`
*   **Accessibility**: View in **Captures** tab or via API.

### Custom Screenshots
You can trigger additional screenshots during an `agent` task using the `screenshot` action block.
*   **Filename**: `<run_id>_<timestamp>_<custom_suffix>.png`
*   **Full Page**: (Optional) Capture the entire scrollable area.

## Video Recordings

Doppelganger can record full session videos (WebM format).

*   **Enable**: Set `disableRecording` to `false` in the task editor.
*   **Location**: `public/captures/<run_id>.webm`
*   **Playback**: View directly in the **Captures** tab.

**Note**: Recording consumes more disk space and CPU. Disable it for high-volume scraping.

## Cookie Persistence

Doppelganger stores cookies and local storage state in `storage_state.json`.

*   **Persistence**: Cookies persist across browser restarts and task executions (unless `statelessExecution` is enabled).
*   **Management**: View and delete individual cookies in **Settings > Data**.
*   **Clear All**: Use the "Clear Storage" button in Settings to wipe all session data.

### Stateless Execution
If you enable `statelessExecution` in a task, it will start with a fresh browser profile (no cookies) and discard any changes upon completion. This is ideal for testing login flows or anonymous scraping.

## Storage Management

### File Cleanup
Screenshots and videos accumulate in `public/captures`. You can delete them:
1.  **Manually**: Via the **Captures** tab (single delete).
2.  **Bulk**: Use the API `DELETE /api/data/captures/:name` or clear all via **Settings**.

### Execution Logs
Execution metadata is stored in `data/executions.json`. This file grows over time. Doppelganger automatically rotates logs (configurable via `MAX_EXECUTIONS` in `server/constants.js`, default 500) to prevent unlimited growth.
