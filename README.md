# Doppelganger - Self-hosted Browser Automation 

[![Docker](https://img.shields.io/badge/docker-mnemosyneai%2Fdoppelganger-0db7ed)](https://hub.docker.com/r/mnemosyneai/doppelganger)
[![Self-Hosted](https://img.shields.io/badge/self--hosted-local--first-2f855a)](#getting-started)

Doppelganger is a self-hosted, developer-focused browser automation and extraction tool. It runs locally via Docker and provides a DIY workflow for building automation tasks with blocks and optional JavaScript customization.

This project is designed for local, controlled use cases. It does not claim to bypass protections and does not encourage unlawful activity.

## Getting Started (npm)

### Install
```bash
npm i @doppelgangerdev/doppelganger
```

### Run
```bash
npx doppelganger
```

## Getting Started (Docker)

### Requirements
- Docker Desktop or Docker Engine
- x86_64 or ARM64 host
- 4GB+ RAM recommended

### Pull the Image
```bash
docker pull mnemosyneai/doppelganger
```

### Run the Container
```bash
docker run -d \
  --name doppelganger \
  -p 11345:11345 \
  -e SESSION_SECRET=change_me_to_a_long_random_value \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public:/app/public \
  -v $(pwd)/storage_state.json:/app/storage_state.json \
  mnemosyneai/doppelganger
```

Open the dashboard at:
```
http://localhost:11345
```

### Session Secret
Set a strong, unique secret via `SESSION_SECRET` before starting the container.

Example:
```bash
export SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
```

### Update to Latest
```bash
docker pull mnemosyneai/doppelganger
docker stop doppelganger
docker rm doppelganger
docker run -d \
  --name doppelganger \
  -p 11345:11345 \
  -e SESSION_SECRET=change_me_to_a_long_random_value \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public:/app/public \
  -v $(pwd)/storage_state.json:/app/storage_state.json \
  mnemosyneai/doppelganger
```

## Usage

### Open the Dashboard
Navigate to:
```
http://localhost:11345
```

### Create a Task (Block-Based)
1. Click **New Task**
2. Choose a mode (Scrape, Agent, Headful)
3. Add action blocks (click, type, hover, wait, scroll, press, javascript)
4. Configure variables and selectors
5. Save and run

### Example Workflow (Safe Demo)
Goal: Load a public page, wait, and extract a title.
1. Create a new task
2. Set URL to `https://example.com`
3. Add a **wait** block (2 seconds)
4. Add a **javascript** block:
```js
return document.title;
```
5. Run the task and view the output

### JSON Export
In the task editor, open the JSON view and copy the task definition for reuse.

### JavaScript Blocks
JavaScript blocks allow custom extraction or page logic. Use them for:
- Parsing DOM elements
- Returning structured data
- Adding custom logic to actions

### Secure API Access
Tasks can be executed via HTTP requests using the API key. This enables secure, automated access from other services.

Key details:
- Endpoint: `POST /tasks/:id/api`
- Auth headers: `x-api-key: <key>` or `Authorization: Bearer <key>`
- Variables: send `variables` (or `taskVariables`) in the JSON body to override task variables
- API key: generate or set one in **Settings** → **API Key** (stored locally)

Example:
```bash
curl -X POST http://localhost:11345/tasks/task_123/api \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d "{\"variables\":{\"query\":\"example.com\"}}"
```

## Community and Presets
Community-contributed presets or examples may be shared in the future.
- Use community content at your own risk
- The author is not responsible for community content
- Always use the tool safely and legally

## License
This project uses a Sustainable Use License (SUL). See `LICENSE`.

## Disclaimer
The software is provided "as-is" without warranty. You are solely responsible for:
- Your scripts and automation behavior
- The data you access or collect
- Any consequences of use

Do not use this tool in ways that violate laws or third-party terms.

## Links
- Homepage/Docs: https://doppelgangerdev.com
- Docker Hub: https://hub.docker.com/r/mnemosyneai/doppelganger
