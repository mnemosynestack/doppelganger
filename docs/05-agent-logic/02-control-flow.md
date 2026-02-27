# Control Flow

Doppelganger provides robust control flow mechanisms to handle dynamic web pages, pagination, and multi-step processes.

## Conditional Execution (`if`)

The `if` block executes a sequence of actions only when a condition is met.

### Syntax
*   **Type**: `if`
*   **Condition**:
    1.  **Expression**: A JavaScript expression that evaluates to true/false.
        *   `exists('.error-message')`
        *   `text('.status') === 'Success'`
        *   `{$count} > 5`
    2.  **Structured**: Define `selector`, `operator` (e.g., `equals`, `contains`), and `value`.
*   **Else**: Optional `else` block to execute if the condition is false.
*   **End**: Required `end` block to close the conditional scope.

### Example: Login Check
```json
{
  "type": "if",
  "value": "exists('.dashboard')"
},
{
  "type": "stop",
  "value": "success"
},
{
  "type": "else"
},
{
  "type": "type",
  "selector": "#username",
  "value": "{$user}"
},
{
  "type": "end"
}
```

## Loops (`while`, `repeat`, `foreach`)

### While Loop
Executes a block of actions repeatedly as long as the condition remains true.

*   **Type**: `while`
*   **Condition**: Same as `if`.
*   **Usage**: Pagination, waiting for a specific state.

### Foreach Loop
Iterates over a list of elements matching a selector.

*   **Type**: `foreach`
*   **Selector**: The CSS selector matching multiple elements (e.g., `.product-card`).
*   **Inside Loop**: Use `loop.item` to interact with the current element.
    *   **Scope**: Actions inside the loop are scoped to the current element. `click` without a selector clicks the current item.
*   **Usage**: Scraping lists of products, processing table rows.

### Repeat Loop
Executes a block a fixed number of times.

*   **Type**: `repeat`
*   **Value**: Number of iterations.

## Error Handling (`on_error`)

The `on_error` block acts like a `try/catch`. If any action within the main flow fails (e.g., timeout, element not found), execution jumps to the `on_error` block.

*   **Usage**: Handling CAPTCHAs, closing popups, retry logic.
*   **Resume**: After the error block, execution can stop or continue (advanced).
