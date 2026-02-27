# Variables & Templating

Doppelganger uses a powerful variable system to make tasks reusable and dynamic.

## Variable Syntax

Anywhere in a task (URL, Selectors, Action Values, Scripts), you can reference a variable using the `{$varName}` syntax.

**Example**:
*   **Variable**: `query` = "doppelganger automation"
*   **Action**: Type into `input[name="q"]`
*   **Value**: `{$query}`

When executed, Doppelganger replaces `{$query}` with "doppelganger automation".

## Defining Variables

1.  **Task Variables**: Define default values in the **Editor > Variables** section.
    *   **Types**: String, Number, Boolean.
2.  **Runtime Variables**: Pass overrides via the API when triggering a task.
    *   `POST /api/tasks/:id/api` body: `{"variables": {"query": "new value"}}`

## Special Variables

Doppelganger provides several built-in variables:

*   `{$now}`: Current ISO timestamp.
*   `block.output`: The result of the previous action (e.g., text from a `javascript` block).
*   `loop.index`: The current index in a `foreach` loop.
*   `loop.item`: The current item in a `foreach` loop.
*   `loop.text`: The text content of the current loop item.
*   `loop.html`: The HTML content of the current loop item.

## Dynamic Usage

You can use variables to build complex logic:

1.  **URL Templating**: `https://example.com/search?q={$query}`
2.  **Selectors**: `.item[data-id="{$itemId}"]`
3.  **Scripts**: `const user = "{$username}";`

## Persistent Variables

The `set` action allows you to update variables during execution.

*   **Action**: `set`
*   **Var Name**: `counter`
*   **Value**: `{$counter} + 1` (JavaScript expression)

This value persists for the remainder of the task execution.
