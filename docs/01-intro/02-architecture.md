# Doppelganger Architecture

Doppelganger is a modular, event-driven automation platform built on top of the NodeJS ecosystem. It is designed to be self-contained and run on a single server, with optional scalability via container orchestration.

## High-Level Overview

Doppelganger is composed of three main layers:

1.  **Frontend (UI)**
2.  **Backend (API & Runner)**
3.  **Browser Engine (Playwright)**

### 1. Frontend Layer
*   **Technology**: React 19, TypeScript, Vite, Tailwind CSS.
*   **Purpose**: Provides the visual interface for creating tasks, managing settings, viewing execution logs, and inspecting captured data.
*   **Components**:
    *   **Dashboard**: Overview of tasks and recent activity.
    *   **Editor**: A drag-and-drop block editor for defining automation logic.
    *   **Settings**: Configuration panels for proxies, API keys, and system preferences.
    *   **Captures**: Visual gallery for screenshots and video recordings.

### 2. Backend Layer
*   **Technology**: Node.js, Express.js.
*   **Purpose**: Serves the API, manages data persistence, and orchestrates browser automation.
*   **Key Modules**:
    *   `server.js`: The main entry point, handling HTTP routes (`/api/*`) and WebSocket/SSE streams.
    *   `agent.js`: The core logic for executing "Agent" mode tasks (complex flows with logic).
    *   `scrape.js`: A specialized runner for high-performance, single-page data extraction.
    *   `headful.js`: Manages interactive, visible browser sessions (VNC/debugging).
    *   `storage.js`: Handles file-based persistence for tasks, executions, and settings.

### 3. Browser Engine Layer
*   **Technology**: Playwright (Chromium).
*   **Purpose**: Executes the actual browser interactions (clicking, typing, navigating).
*   **Features**:
    *   **Context Isolation**: Each task runs in a fresh or persistent browser context, depending on configuration.
    *   **Stealth Plugin**: Integrates `puppeteer-extra-plugin-stealth` to evade bot detection.
    *   **Network Interception**: Captures network requests/responses for debugging and data extraction.

## Data Storage

Doppelganger uses a **file-based storage system** by default, keeping all data local to the deployment directory. This simplifies backup and migration.

*   `data/tasks.json`: Stores task definitions.
*   `data/executions.json`: Logs execution history and metadata.
*   `data/proxies.json`: Stores proxy configurations.
*   `data/settings.json`: Stores system settings (API keys, user agents).
*   `public/captures/`: Stores screenshots and video recordings.
*   `storage_state.json`: Stores browser cookies and local storage state (if persistence is enabled).

## Execution Flow

1.  **Trigger**: A task is triggered via the UI or API (`POST /api/tasks/:id/api`).
2.  **Orchestration**: The backend validates the request and spawns a new browser context.
3.  **Execution**: The `agent.js` or `scrape.js` module executes the defined actions step-by-step.
4.  **Result**: The browser captures screenshots, extracts data, and returns a JSON payload.
5.  **Persistence**: The backend saves the execution log and any captured files to disk.
