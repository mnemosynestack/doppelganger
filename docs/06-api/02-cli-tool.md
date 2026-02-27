# CLI Tool & Standalone Scripts

Doppelganger can be run entirely from the command line, either interactively or for automated scripting.

## Global Installation

```bash
npm install -g @doppelgangerdev/doppelganger
```

## Commands

### Start Server
Run the standard Doppelganger server (API + UI).

```bash
doppelganger
# or
npx @doppelgangerdev/doppelganger
```

### Modes

#### Scraper Mode (`--scrape`)
Runs a high-performance scraping task without the full agent logic. Ideal for simple data extraction.

```bash
doppelganger --scrape --url "https://example.com" --selector ".content"
```
*   `--url`: Target URL.
*   `--selector`: CSS selector to extract text from.
*   `--output`: (Optional) File to save the result.

#### Headful Mode (`--headful`)
Launches a visible browser session for debugging.

```bash
doppelganger --headful --url "https://example.com"
```

#### Agent Mode (`--agent`)
Executes a saved task by ID or a JSON definition file.

```bash
doppelganger --agent --task "task_id_or_file.json"
```

## Environment Variables

CLI commands respect the same environment variables as the server:

*   `PORT`: Server port.
*   `SESSION_SECRET`: Session encryption key.
*   `HEADLESS`: Set to `false` to see the browser window (if running locally without Docker).

## Scripting

You can pipe JSON into Doppelganger for complex workflows:

```bash
echo '{"url": "https://example.com", "actions": [{"type": "screenshot"}]}' | doppelganger --agent
```
