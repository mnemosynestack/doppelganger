# Action Blocks

In "Agent" mode, tasks are built from a sequence of actions. These actions are executed sequentially by the browser.

## Basic Actions

### `click`
Simulates a left-click on an element.
*   **Selector**: The CSS selector of the target element (e.g., `#btn`, `.link`).
*   **Wait**: Optional delay (in seconds) after clicking.

### `type`
Types text into an input field.
*   **Selector**: The target input (e.g., `input[name="q"]`).
*   **Value**: The text to type. Can include `{$variables}`.
*   **Mode**: `Replace` (clears existing text) or `Append` (adds to end).

### `wait`
Pauses execution for a fixed duration.
*   **Value**: Duration in seconds (e.g., `2.5`).

### `wait_selector`
Waits until a specific element appears in the DOM.
*   **Selector**: The element to wait for.
*   **Value**: Timeout in seconds (default: 30).

### `press`
Simulates a keyboard key press.
*   **Key**: The key name (e.g., `Enter`, `Tab`, `Escape`, `ArrowDown`).
*   **Selector**: (Optional) Focus this element before pressing.

### `scroll`
Scrolls the page or a specific element.
*   **Selector**: (Optional) The element to scroll. If empty, scrolls the window.
*   **Value**: Pixels to scroll (e.g., `500`) or specific commands (`bottom`, `top`).

### `hover`
Moves the mouse cursor over an element.
*   **Selector**: The target element.

### `navigate`
Redirects the browser to a new URL.
*   **Value**: The full URL (e.g., `https://example.com/login`).

## Logic & Flow Control

### `if` / `else` / `end`
Conditional execution block.
*   **Condition**: A JavaScript expression (e.g., `exists('.error')`).
*   **Selector**: (Structured mode) Target element.
*   **Operator**: `equals`, `contains`, `exists`, etc.

### `while` / `end`
Repeats a block of actions while a condition is true.
*   **Condition**: Same as `if`.
*   **Value**: (Optional) Max iterations to prevent infinite loops.

### `foreach` / `end`
Iterates over a list of elements.
*   **Selector**: The elements to iterate (e.g., `.product-item`).
*   **Var Name**: Variable to store the current element index/data.

### `repeat` / `end`
Repeats a block N times.
*   **Value**: Number of repetitions.

## Advanced Actions

### `javascript`
Executes custom JavaScript in the browser context.
*   **Value**: The JS code (e.g., `return document.title;`).
*   **Output**: The return value is stored in `block.output` for subsequent steps.

### `screenshot`
Takes a screenshot at the current state.
*   **Value**: (Optional) Filename suffix.
*   **Selector**: (Optional) Capture only this element.

### `stop`
Immediately stops the task execution.
*   **Value**: Exit status (e.g., `success`, `failure`).

### `set`
Updates a runtime variable.
*   **Var Name**: The variable to update (e.g., `counter`).
*   **Value**: The new value (can be a JS expression).

### `wait_downloads`
Waits for file downloads to complete.
*   **Value**: Timeout in seconds.

### `on_error`
Defines a block of actions to run if an error occurs in the main flow (try/catch).
