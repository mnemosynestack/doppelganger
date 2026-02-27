# Task Structure (JSON)

Doppelganger tasks are defined by a JSON object. This structure is used both internally by the storage system and externally when importing/exporting tasks or using the API.

## Full Schema

```json
{
  "id": "task_123456789",
  "name": "My Automation Task",
  "mode": "agent", // "agent" | "scrape" | "headful"
  "url": "https://example.com",
  "wait": 2, // Initial wait time in seconds
  "rotateUserAgents": false,
  "rotateProxies": false,
  "rotateViewport": false,
  "humanTyping": false, // Simulates human typing speed
  "includeShadowDom": true,
  "disableRecording": false,
  "statelessExecution": false, // If true, cookies are not saved
  "stealth": {
    "allowTypos": false,
    "idleMovements": false,
    "overscroll": false,
    "deadClicks": false,
    "fatigue": false,
    "naturalTyping": false
  },
  "actions": [
    {
      "id": "act_1",
      "type": "click",
      "selector": "#submit-button",
      "disabled": false
    },
    {
      "id": "act_2",
      "type": "wait",
      "value": "2"
    }
  ],
  "variables": {
    "query": { "type": "string", "value": "search term" }
  },
  "extractionScript": "return document.title;",
  "extractionFormat": "json" // "json" | "csv"
}
```

## Key Fields

### `mode`
*   `agent`: Executes a sequence of actions (click, type, etc.). Most powerful.
*   `scrape`: Simple "visit and extract" mode. Useful for static pages.
*   `headful`: Opens a visible browser window for debugging (requires VNC).

### `actions`
An array of steps to execute. See [Action Blocks](../03-basics/03-action-blocks.md) for details.

### `variables`
Dynamic values that can be injected into `url`, `selector`, `value`, or scripts using `{$varName}` syntax.

### `stealth`
Configuration for bot detection evasion.
*   `naturalTyping`: Random delays between keystrokes.
*   `idleMovements`: Random mouse movements when waiting.

### `extractionScript`
A JavaScript snippet that runs in the browser context **after** all actions are complete. The return value is saved as the task result.
