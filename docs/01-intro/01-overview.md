# Doppelganger Overview

Doppelganger is a self-hosted, block-based browser automation platform designed for teams and developers who need predictable, auditable, and secure automation workflows without relying on third-party SaaS solutions.

At its core, Doppelganger combines the power of **Playwright** for browser instrumentation with a **React-based visual editor** and an **Express.js backend** to manage tasks, proxies, and executions.

## Key Philosophy

1.  **Block-First Design**: Complex automation logic is broken down into simple, composable blocks (Click, Type, Wait, Javascript, If/Else). This makes automation accessible to non-engineers while retaining the power needed by developers.
2.  **Self-Hosted & Private**: All data—including task definitions, cookies, local storage, and execution logs—lives on your machine or server. No sensitive data is sent to the cloud.
3.  **Hybrid Execution**: Run tasks via the visual editor for debugging, trigger them via a REST API for integration, or use the CLI for headless operation.
4.  **Stealth & Resilience**: Built-in support for proxy rotation, user-agent rotation, and stealth plugins helps automation tasks blend in with normal traffic.

## What Can You Build?

*   **Data Scrapers**: Extract structured data (JSON/CSV) from websites, handling pagination and dynamic content.
*   **Authentication Bots**: Automate login flows to refresh cookies or session tokens for other applications.
*   **Testing Agents**: Run end-to-end tests on your own web applications with visual feedback.
*   **Workflow Automation**: Fill out forms, upload files, or interact with complex single-page applications (SPAs).

## Core Components

*   **Dashboard**: Manage your library of tasks and view execution history.
*   **Task Editor**: A drag-and-drop interface to build automation flows with real-time validation.
*   **Execution Engine**: A robust backend runner that handles browser context, stealth evasion, and result storage.
*   **Proxy Manager**: A dedicated system for managing and rotating HTTP/SOCKS proxies.
