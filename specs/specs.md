# File Downloading Specs
## 1. Logic (Backend & Data Structure)

**Objective**: Implement a server-side endpoint to receive file requests, aggregate file data, and return a single, uncompressed JSON object for download.

| Aspect | Detail |
| :--- | :--- |
| **API Endpoint** | `POST /api/download/files` |
| **Request Body** | `JSON` payload: `{ "file_ids": ["id_123", "id_456", ...] }` (Array of strings) |
| **Server Process** | 1. **Authentication/Authorization**: Validate user permissions for each file ID.<br>2. **File Retrieval**: Fetch file content from storage.<br>3. **Data Encoding**: Base64 encode the binary content of each file.<br>4. **JSON Aggregation**: Construct the final JSON payload. |
| **Response Format (Success)** | **Status**: `200 OK`<br>**Content-Type**: `application/json`<br>**Body**: `[{ "filename": "report.pdf", "mime_type": "application/pdf", "content_base64": "..." }, ...]` |
| **Error Handling** | - **File Not Found**: `404 Not Found` (with details in response body).<br>- **Permission Denied**: `403 Forbidden`.<br>- **Server Error**: `500 Internal Server Error`. |

### JSON Structure
File content must be Base64 encoded to be safely embedded within the JSON structure. The structure should include all necessary metadata for client-side reconstruction.

```json
[
  {
    "filename": "report.pdf",
    "mime_type": "application/pdf",
    "content_base64": "JVBERi0xLjQ..."
  },
  ...
]
```

## 2. UI (Front-End Components & State)

**Objective**: Ensure the visual components are robust, accessible, and reflect the current download state.

| Component | State & Detail |
| :--- | :--- |
| **DownloadAllButton** | - **Location**: Top left of the `FilesResultsPane`.<br>- **Initial State**: Displays the 'Download' SVG icon.<br>- **Active State (Downloading)**: SVG icon replaced by an animated loading spinner component (e.g., `<SpinnerIcon />`). Button is disabled (`disabled=true`) to prevent multiple clicks.<br>- **Accessibility**: Must have an `aria-label` that changes with the state (e.g., "Download all files" to "Downloading files..."). |
| **FileCardComponent** | - **Per-file Download Button**: Displays a small 'Download' SVG icon on each file card.<br>- **Active State (Downloading)**: Per-file icon replaced by a small, localized loading spinner. Button disabled.<br>- **Interaction**: Clicking triggers a call to `POST /api/v1/download/file/:id` (or the main API with a single ID). |
| **FilesResultsPane** | - **Structure**: Dedicated section for displaying file cards. Should manage the global state that affects the `DownloadAllButton`. |

## 3. UX (Client-Side Interaction Flow)

**Objective**: Provide a clear, non-blocking, and feedback-rich experience for the user.

### Download All
1.  **Trigger**: User clicks the `DownloadAllButton`.
2.  **State Change**: Button state transitions to **Active/Disabled** (spinner displays).
3.  **API Call**: Client initiates the `POST /api/v1/download/files` call.
4.  **On API Success (200)**:
    -   Iterate through the JSON array.
    -   Decode the Base64 content for each file.
    -   Use the **Blob API** to create a file object.
    -   Programmatically trigger a download for each file using a temporary anchor tag (or a file-saving library).
5.  **Completion**: Button state transitions back to **Initial**.
6.  **Feedback**: Display a "Download Complete" toast notification.

### Per-File Download
1.  **Trigger**: User clicks the per-file button on a `FileCardComponent`.
2.  **State Change**: The specific file button transitions to **Active/Disabled**.
3.  **API Call**: Client initiates the API call for the single file.
4.  **On API Success (200)**: Decode content and trigger a single file download.
5.  **Completion**: Button state transitions back to **Initial**.

### Client-Side Error
-   **On API Failure (4xx/5xx)**:
    -   Button state transitions immediately back to **Initial**.
    -   Display a clear, dismissible error message (e.g., "Download failed. Please try again or check file permissions.") using a toast or banner notification.
