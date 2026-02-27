# REST API Reference

Doppelganger exposes a local REST API for task management, execution, and data retrieval.

**Base URL**: `http://localhost:11345` (default)
**Headers**:
*   `x-api-key`: Required if authentication is enabled.

## Tasks

### `GET /api/tasks`
Lists all saved tasks.

**Response**:
```json
[
  {
    "id": "task_1",
    "name": "Scraper",
    "url": "https://example.com"
  }
]
```

### `POST /api/tasks`
Creates a new task.

**Body**:
```json
{
  "name": "New Task",
  "url": "https://example.com",
  "mode": "agent",
  "actions": []
}
```

### `POST /api/tasks/:id/api`
Triggers an execution of a specific task.

**Body**:
```json
{
  "variables": {
    "query": "override value"
  }
}
```

**Response**:
Returns the execution result (JSON).

## Executions

### `GET /api/executions`
Lists execution history.

**Query Parameters**:
*   `limit`: Number of results (default 50).
*   `status`: Filter by status code.

### `GET /api/executions/:id`
Gets detailed logs and result for a specific execution.

## Data

### `GET /api/data/captures`
Lists all captured files (screenshots, recordings).

### `DELETE /api/data/captures/:name`
Deletes a specific capture file.

## Settings

### `GET /api/settings/proxies`
Lists configured proxies.

### `POST /api/settings/proxies`
Adds a new proxy.

**Body**:
```json
{
  "server": "http://1.2.3.4:8080",
  "label": "US Proxy"
}
```

### `POST /api/settings/api-key`
Generates/regenerates the API key.
