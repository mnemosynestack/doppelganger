# CSS Selectors

Selectors are the "coordinates" Doppelganger uses to find and interact with elements on a webpage. Doppelganger relies heavily on **CSS Selectors** (and sometimes XPath, though CSS is preferred for speed and readability).

## Basic Selectors

*   **ID**: `#login-button` (Targets an element with `id="login-button"`)
*   **Class**: `.btn-primary` (Targets elements with `class="btn-primary"`)
*   **Tag**: `button` (Targets all `<button>` elements)
*   **Attribute**: `[type="submit"]` (Targets elements with specific attribute values)

## Combining Selectors

*   **Descendant**: `.form-group input` (Finds `input` inside `.form-group`)
*   **Child**: `.menu > li` (Finds direct children `li` inside `.menu`)
*   **Sibling**: `h2 + p` (Finds the paragraph immediately following an h2)

## Advanced Selection

*   **Contains Text**: `button:has-text("Submit")` (Finds buttons containing "Submit")
*   **Nth Child**: `li:nth-child(3)` (Finds the 3rd list item)
*   **Visible**: `button:visible` (Finds only visible buttons, ignoring hidden ones)

## Testing Selectors

The Doppelganger Editor includes a **Highlight** feature (planned) or you can use the browser's developer tools:
1.  Right-click an element > Inspect.
2.  Press `Ctrl+F` in the Elements tab.
3.  Type your selector to see matches.

## Best Practices

1.  **Prefer ID**: IDs are usually unique and stable.
2.  **Avoid Long Chains**: Don't use `body > div > div > span`. Use specific classes instead.
3.  **Use Attributes**: `[data-testid="submit"]` is often more reliable than classes like `.btn-blue`.
