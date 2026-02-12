# GEMINI.md: Developer Guide & AI Agent Protocol

## 1. Role & Context
You are a **Senior Full-Stack Engineer** working on the Doppelganger repository. Your goal is to maintain and enhance this self-hosted browser automation platform. The system uses Playwright for browser control, Express for the backend API, and React with Tailwind CSS for the frontend.

## 2. Tech Stack
- **Backend**: Node.js, Express.js (REST API).
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React (Icons).
- **Automation**: Playwright (Browser automation), `puppeteer-extra-plugin-stealth`.
- **Database/Storage**: JSON files in `data/` (e.g., `tasks.json`, `captures/`). No SQL database is used by default.
- **Process Management**: Native Node.js processes; `server.js` is the entry point.

## 3. Directory Map
Key files and folders you will interact with:

- **Root Files**:
  - `server.js`: Main Express server entry point. Handles API routes (`/api/tasks`, `/api/settings`) and static file serving.
  - `agent.js`: Core logic for executing automation tasks. Bridge between API and Playwright.
  - `scrape.js`: Handles standalone scraping jobs and video recording management.
  - `headful.js`: Launcher for headful browser sessions (VNC/debugging).
  - `proxy-rotation.js`: Manages proxy lists and rotation logic.
  - `common-utils.js`: Shared utilities (boolean parsing, CSV handling) used by both frontend and backend.
  - `GEMINI.md`: This file.
  - `AGENT_SPEC.md`: JSON schema and behavior specification for automation tasks. **Read this before modifying task logic.**

- **Source Code (`src/`)**:
  - `src/App.tsx`: Main React component and routing logic.
  - `src/components/`: Reusable UI components (Sidebar, TaskCard, etc.).
  - `src/agent/`: Modularized agent logic (Sandbox, DOM utils).

- **Data & Config**:
  - `data/`: Runtime storage for tasks, recordings, and logs. **Do not commit files in this directory.**
  - `public/`: Static assets served by Express.

## 4. Development Workflow

### Starting the Dev Environment
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start Backend & Frontend**:
    ```bash
    npm run dev    # Starts Vite dev server
    npm run server # Starts Express backend
    ```
    *Note: In development, you may need to run these in separate terminals.*

### Building for Production
1.  **Build Frontend**:
    ```bash
    npm run build
    ```
    This compiles React code to `dist/`.
2.  **Start Production Server**:
    ```bash
    npm start
    ```
    Runs `server.js` which serves the `dist/` folder.

## 5. Testing Protocol
There is no standard test runner (Jest/Mocha) configured in `package.json`. Verification relies on **ad-hoc scripts** in the `tests/` directory.

- **Existing Tests**:
  - `tests/test_functionality.js`: Verifies file system operations and API logic.
  - `tests/proxy-utils.test.js`: Tests proxy rotation logic.
  - `tests/url-utils.test.js`: Tests URL validation and SSRF protection.

- **Creating New Tests**:
  - When adding a feature, create a standalone script in `tests/` (e.g., `tests/my_feature_test.js`) that asserts the expected behavior.
  - Run it with `node tests/my_feature_test.js`.
  - Ensure it exits with code 0 on success and 1 on failure.

## 6. Coding Standards
- **Modules**: The codebase uses a mix of CommonJS (root files like `server.js`) and ESM (frontend in `src/`). Be mindful of `require()` vs `import`.
- **Async/Await**: Prefer `async/await` over callbacks or raw promises.
- **Error Handling**: Use `try/catch` blocks in async functions. Ensure errors are logged to the console or returned in API responses.
- **File I/O**: Use `fs.promises` for non-blocking operations.
- **Security**:
  - Never commit secrets (API keys, session secrets).
  - Use `validateUrl` from `url-utils.js` to prevent SSRF.
  - sanitize inputs before using them in shell commands or file paths.

## 7. Troubleshooting & Common Pitfalls
- **"Module not found"**: Ensure you are in the root directory and have run `npm install`.
- **Port Conflicts**: The server defaults to port 3000. If in use, kill the process or change the port in `server.js`.
- **Playwright Issues**: If browsers fail to launch, try `npx playwright install`.
- **Frontend not updating**: Ensure you ran `npm run build` if running via `node server.js`, or use `npm run dev` for hot reloading.

## 8. Agent Specification
When working on automation logic (task generation, execution), strictly adhere to **`AGENT_SPEC.md`**. It defines:
- Task JSON schema.
- Supported action types (`click`, `type`, `wait`, etc.).
- Variable templating (`{$varName}`).
- Control flow (`if`, `while`, `foreach`).

**Do not invent new action types without updating `AGENT_SPEC.md` and the execution logic in `agent.js`.**
