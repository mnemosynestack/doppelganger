---
name: Doppelganger API Provider
description: A REST API-focused OpenClaw skill that executes and manages headless/headful browser automation tasks via the local Doppelganger engine.
version: 1.0.0
author: OpenClaw Community
keywords: [automation, scraping, playwright, doppelganger, api]
---

# Doppelganger API Integration Skill for OpenClaw

This document enables OpenClaw agents to interface with the Doppelganger browser automation REST API. It is designed to be comprehensive, ensuring that any agent utilizing this skill understands the precise schemas, headers, response types, and endpoints available for executing scraping, autonomous agent tasks, and managing metadata.

## Table of Contents
1. [Base URL & Authentication](#1-base-url--authentication)
2. [Core Execution Endpoints](#2-core-execution-endpoints)
    - [POST /scrape](#21-post-scrape)
    - [POST /agent](#22-post-agent)
    - [POST /headful](#23-post-headful)
    - [POST /headful/stop](#24-post-headfulstop)
3. [Task Management API](#3-task-management-api)
    - [GET /api/tasks](#31-get-apitasks)
    - [POST /api/tasks](#32-post-apitasks)
    - [PUT /api/tasks/:id](#33-put-apitasksid)
    - [POST /api/tasks/:id/api](#34-post-apitasksidapi)
4. [Execution & Logging API](#4-execution--logging-api)
    - [GET /api/executions](#41-get-apiexecutions)
    - [GET /api/executions/:id](#42-get-apiexecutionsid)
5. [Data Management API](#5-data-management-api)
    - [GET /api/data/captures](#51-get-apidatacaptures)
    - [GET /api/data/captures/:name](#52-get-apidatacapturesname)
6. [Settings API](#6-settings-api)
    - [GET /api/settings/proxies](#61-get-apisettingsproxies)
7. [Payload Type Schemas Reference](#7-payload-type-schemas-reference)

---

## 1. Base URL & Authentication

The Doppelganger API is designed to run locally. Ensure all endpoints are accessed via the host port.

**Default Base URL:**
```
http://localhost:11345
```
*(Optionally configurable via the `PORT` or `VITE_BACKEND_PORT` environment variable.)*

**Authentication:**
If the user has enabled authentication on the Doppelganger instance, all endpoints require the `x-api-key` header. Note that for private networks, anonymous access might be permitted by default unless explicitly locked.

**Headers:**
```http
Content-Type: application/json
x-api-key: your-api-key-here
```

---

## 2. Core Execution Endpoints

These endpoints trigger direct browser automation instances. They are synchronous for `/scrape` and `/agent`, keeping the HTTP connection open until the run completes. Ensure your HTTP client does not timeout prematurely (some instances can take up to 60+ seconds).

### 2.1. POST `/scrape`
Executes a single-pass extraction workflow. Best used when intermediate clicks or typing are unnecessary. The system fully renders the DOM, optionally traverses Shadow DOM boundaries, and runs sandboxed JavaScript extraction logic.

**Endpoint:** `POST http://127.0.0.1:11345/scrape`

**Request Body Schema:**
```json
{
  "url": "string (Required) - Target URL",
  "selector": "string (Optional) - CSS selector to restrict HTML extraction",
  "wait": "number (Optional) - Idle wait time in seconds before extraction",
  "rotateUserAgents": "boolean (Optional) - Enable UA rotation pool",
  "rotateProxies": "boolean (Optional) - Enable configured proxies",
  "rotateViewport": "boolean (Optional) - Randomizes viewport dimensions",
  "includeShadowDom": "boolean (Optional) - Inline shadow wrappers (default: true)",
  "disableRecording": "boolean (Optional) - Do not save WebM recordings",
  "statelessExecution": "boolean (Optional) - Bypass saving cookies to storage_state.json",
  "extractionScript": "string (Optional) - Custom JS routine executed in sandbox",
  "extractionFormat": "'json' | 'csv' (Optional) - Determines data parse mode",
  "headers": "object (Optional) - Custom key-value pairs for HTTP headers",
  "variables": "object (Optional) - Templating keys for mapping inputs"
}
```

**Variables Expansion:**
You can use `{$variableName}` inside `url`, `selector`, or `extractionScript` to dynamically inject mapping variables provided in the `variables` block.

**Success Response (200 OK):**
```json
{
  "title": "Page Document Title",
  "url": "https://resolved-url-after-redirects.com",
  "html": "<Cleaned DOM string>",
  "data": "Result of the extractionScript evaluation (JSON Array, Object, or CSV String)",
  "is_partial": true, // False if the selector matched and returning partial HTML
  "selector_used": "body (default)",
  "links": ["https://found.link.com/1", "https://found.link.com/2"],
  "screenshot_url": "/captures/run_01_scrape_88291.png"
}
```

---

### 2.2. POST `/agent`
Executes an interactive, step-by-step workflow capable of clicking, typing, conditional logic, and looping.

**Endpoint:** `POST http://127.0.0.1:11345/agent`

**Request Body Schema:**
```json
{
  "url": "string (Optional) - Initial starting URL",
  "actions": "array (Required) - Linear list of Action objects (see Section 7)",
  "stealth": "object (Optional) - Human interaction modifiers",
  "rotateUserAgents": "boolean (Optional)",
  "rotateProxies": "boolean (Optional)",
  "rotateViewport": "boolean (Optional)",
  "humanTyping": "boolean (Optional)",
  "includeShadowDom": "boolean (Optional)",
  "disableRecording": "boolean (Optional)",
  "statelessExecution": "boolean (Optional)",
  "extractionScript": "string (Optional)",
  "extractionFormat": "'json' | 'csv' (Optional)",
  "variables": "object (Optional)",
  "runId": "string (Optional) - Client-side UUID to trace execution"
}
```

**Stealth Configuration Object:**
```json
{
  "allowTypos": false, // Simulates human mistakes via backspacing
  "idleMovements": false, // Creates random cursor movement when doing nothing
  "overscroll": false, // Rapid bounce-backs when scrolling
  "deadClicks": false, // Meaningless clicks on non-interactive regions
  "fatigue": false, // Progressively slows down action timing
  "naturalTyping": false // Varies character delays for bursts
}
```

**Success Response (200 OK):**
```json
{
  "final_url": "https://app.com/dashboard",
  "downloads": [
    {
      "name": "report.pdf",
      "url": "blob:https://app.com/uuid",
      "path": "/captures/run_dl_xxxx.pdf"
    }
  ],
  "logs": [
    "Navigating to: https://app.com",
    "Typing into input[name='user']: admin",
    "Clicking: #submit"
  ],
  "html": "<Cleaned DOM Context>",
  "data": "Result of extractionScript (JSON or CSV)",
  "screenshot_url": "/captures/run_xxxx.png"
}
```

---

### 2.3. POST `/headful`
Spawns a debugging browser window. Uses standard GUI chromium. Returns immediately upon launching the process, unlike `/scrape` and `/agent` which are synchronous blocks. In server/VPS environments, it leverages NoVNC if configured.

**Endpoint:** `POST http://127.0.0.1:11345/headful`

**Request Body Schema:**
```json
{
  "url": "string (Required) - Initial starting URL",
  "rotateUserAgents": "boolean (Optional)",
  "rotateProxies": "boolean (Optional)",
  "variables": "object (Optional)"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Headful browser launched",
  "pid": 48210
}
```

---

### 2.4. POST `/headful/stop`
Terminates the currently running headful debugging process.

**Endpoint:** `POST http://127.0.0.1:11345/headful/stop`

**Request Body Schema:**
Empty Body.

**Success Response (200 OK):**
```json
{
  "message": "Headful browser stopped"
}
```

---

## 3. Task Management API

Tasks represent saved automation profiles representing a specific scrape or agent routine. OpenClaw can create them permanently to re-run later.

### 3.1. GET `/api/tasks`
Lists all known tasks persisted on disk (`data/tasks.json`).

**Success Response (200 OK):**
```json
[
  {
    "id": "c1f7a08b",
    "name": "Extract Acme Pricing",
    "url": "https://acme.com",
    "mode": "agent",
    "wait": 2,
    "actions": [...],
    "variables": {}
  }
]
```

---

### 3.2. POST `/api/tasks`
Creates a newly persisted task.

**Request Body Schema:**
Requires the full `Task` schema (See Section 7 for details).

**Success Response (200 OK):**
```json
{ "message": "Task created successfully" }
```

---

### 3.3. PUT `/api/tasks/:id`
Updates an existing task profile. Will overwrite previous variants natively unless autosave is used carefully.

**Request Body Schema:**
Full `Task` schema.

**Success Response (200 OK):**
```json
{ "message": "Task updated successfully" }
```

---

### 3.4. POST `/api/tasks/:id/api`
Executes a task explicitly by its recorded ID. Acts identical to calling `/agent` or `/scrape` directly, but loads the parameters from the DB matching the provided ID.

**Request Body Schema:**
```json
{
  "variables": "object (Optional) - Overrides defined task variables"
}
```

**Success Response (200 OK):**
Returns the same standard response schema as `/scrape` or `/agent` depending on the `mode` defined within the task profile.

---

## 4. Execution & Logging API

Tracks historical runs and metadata for both API triggered instances and UI triggered instances.

### 4.1. GET `/api/executions`
Retrieves the paginated list of all execution logs.

**Query Parameters:**
- `page` (number): Starting at 1 (default 1)
- `limit` (number): Items per page (default 50)
- `status` (number): Filter by HTTP status code (e.g., 200, 500)
- `mode` (string): Filter by mode (`scrape`, `agent`, `headful`)

**Success Response (200 OK):**
```json
{
  "total": 142,
  "execs": [
    {
      "id": "exec_1690000_123",
      "timestamp": 1690000000,
      "method": "POST",
      "path": "/agent",
      "status": 200,
      "durationMs": 4500,
      "source": "api",
      "mode": "agent",
      "taskId": "c1f7a08b",
      "taskName": "Extract Acme Pricing"
    }
  ],
  "page": 1,
  "pages": 3,
  "limit": 50
}
```

---

### 4.2. GET `/api/executions/:id`
Retrieves strictly the full details of a specific execution, including the final JSON result payload snapshot and the task snapshot configuration used at execution time.

**Success Response (200 OK):**
```json
{
  "id": "exec_1690000_123",
  "result": {
    "final_url": "https://acme.com",
    "html": "<html>...",
    "data": [{"price": "$12"}],
    "logs": [
      "Navigating to https://acme.com",
      "Clicking select[name=currency]"
    ]
  },
  "taskSnapshot": {
    "mode": "agent",
    "actions": [...]
  }
}
```

---

## 5. Data Management API

Endpoints used to query the underlying disk captures created by executions.

### 5.1. GET `/api/data/captures`
Lists all images, videos, and downloads stored within the `public/captures` directory.

**Success Response (200 OK):**
```json
[
  {
    "name": "run_16900_agent_123.png",
    "url": "/captures/run_16900_agent_123.png",
    "size": 142500,
    "modified": 1690000000,
    "type": "screenshot"
  },
  {
    "name": "run_16900_agent_dl_data.csv",
    "url": "/captures/run_16900_agent_dl_data.csv",
    "size": 850,
    "modified": 1690000000,
    "type": "recording"
  }
]
```

*(Note that the `type` determines if it is an asset generated visually or from network interception.)*

---

### 5.2. DELETE `/api/data/captures/:name`
Deletes a specific capture file from the disk.

**Success Response (200 OK):**
```json
{ "message": "Capture deleted" }
```

**Success Response (404 Not Found):**
```json
{ "error": "Capture not found" }
```

---

## 6. Settings API

Global server settings overrides. Includes user agent definitions, proxies, and runtime configurations.

### 6.1. GET `/api/settings/proxies`
Retrieves all configured proxy rotational profiles available to the system.

**Success Response (200 OK):**
```json
{
  "proxies": [
    {
      "id": "host",
      "server": "host_ip",
      "label": "Host IP (no proxy)"
    },
    {
      "id": "proxy_a1b2",
      "server": "http://192.168.1.5:8080",
      "username": "user",
      "password": "pwd",
      "label": "US Node"
    }
  ],
  "defaultProxyId": "host",
  "includeDefaultInRotation": false,
  "rotationMode": "round-robin"
}
```

*Creating/Updating proxies uses `POST /api/settings/proxies` and `PUT /api/settings/proxies/:id` using standard RESTful schemas targeting the proxy shapes.*

---

## 7. Payload Type Schemas Reference

Reference objects primarily focused on the `/agent` endpoint definitions, as these map direct sequential instructions to Playwright contexts. OpenClaw must strictly adhere to these interfaces when forging JSON definitions.

### `Action` Object Schema Structure
Every item within the `actions: []` array must include a specific `type` string defining its core operation.

```typescript
export interface Action {
    id: string; // Unique identifier (e.g. "act_101")
    type:
    | 'click'         // Click an element
    | 'type'          // Type text into a field
    | 'wait'          // Pause for seconds
    | 'wait_selector' // Wait until element appears
    | 'press'         // Press a native keyboard key (e.g., 'Enter')
    | 'scroll'        // Scroll the page or container
    | 'javascript'    // Run custom JS
    | 'csv'           // Parse CSV into rows
    | 'hover'         // Hover an element
    | 'merge'         // Merge inputs into a single output
    | 'screenshot'    // Capture a screenshot
    | 'if'            // Conditional block start
    | 'else'          // Conditional alternate path
    | 'end'           // Close a block (if/while/repeat/foreach/onerror)
    | 'while'         // Loop while condition true
    | 'repeat'        // Repeat block N times
    | 'foreach'       // Loop through items
    | 'set'           // Update variable value
    | 'stop'          // Stop task with status
    | 'on_error'      // Run on failure
    | 'navigate'      // Navigate to a URL
    | 'wait_downloads'// Wait until downloads finish
    | 'start';        // Execute another Task via ID reference

    selector?: string;        // Target node lookup string
    value?: string;           // Core instruction payload (URLs, timers, inputs)
    key?: string;             // Press logic lookup map ('Tab', 'Escape')
    disabled?: boolean;       // Skips evaluation if true
    varName?: string;         // Designation variable for assignments (`set` / `csv`)
    
    // Structured Conditionals exclusively used for `if` and `while` types
    conditionVar?: string;    // Variable string `{$varName}`
    conditionVarType?: 'string' | 'number' | 'boolean';
    conditionOp?: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'matches' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_true' | 'is_false';
    conditionValue?: string;  // Explicit evaluation value
    typeMode?: 'append' | 'replace'; // Specific for the `type` action payload
}
```

### `Task` Object Schema Structure
```typescript
export interface Task {
    id?: string;
    name: string;
    url: string;
    mode: 'scrape' | 'agent' | 'headful';
    wait: number;
    selector?: string;
    rotateUserAgents: boolean;
    rotateProxies: boolean;
    rotateViewport: boolean;
    humanTyping: boolean;
    includeShadowDom?: boolean;
    disableRecording?: boolean;
    statelessExecution?: boolean;
    stealth: {
        allowTypos: boolean;
        idleMovements: boolean;
        overscroll: boolean;
        deadClicks: boolean;
        fatigue: boolean;
        naturalTyping: boolean;
    };
    actions: Action[];
    variables: Record<string, { type: 'string'|'number'|'boolean', value: any }>;
    extractionScript?: string;
    extractionFormat?: 'json' | 'csv';
}
```