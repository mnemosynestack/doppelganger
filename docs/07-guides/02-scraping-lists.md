# Scraping Lists (Foreach)

Extracting a list of items (products, news articles, search results) is a core scraping pattern.

## 1. Analyze the List
Inspect the target page (e.g., an e-commerce category).
*   **Item Container**: Find the selector that repeats for each item (e.g., `.product-card`, `article`, `li.result`).
*   **Inside Item**:
    *   Title: `.title`
    *   Price: `.price`
    *   Link: `a.main-link`

## 2. Build the Task

### Step 1: Navigate
*   **Action**: `navigate`
*   **Value**: `https://example.com/products`

### Step 2: Scroll (Optional)
If items lazy-load, use the **Scroll** action to load more.
*   **Action**: `scroll`
    *   Value: `bottom`
*   **Action**: `wait`
    *   Value: `2`

### Step 3: Iterate
*   **Action**: `foreach`
    *   Selector: `.product-card` (The container)
    *   Var Name: `card`

### Step 4: Extract Data (Inside Loop)
Inside the `foreach` block, use `javascript` to extract data from `loop.item`.

*   **Action**: `javascript`
    *   Value:
        ```javascript
        const title = loop.item.querySelector('.title')?.innerText;
        const price = loop.item.querySelector('.price')?.innerText;
        return { title, price };
        ```

### Step 5: Collect Results
Doppelganger automatically collects `block.output` from each iteration if you use a `merge` action or build a custom array in a final extraction script.

**Alternative**: Use a single Extraction Script at the end (often simpler).

## Simplified Method (Extraction Script Only)

Instead of `foreach` blocks, you can often do everything in the **Extraction Script**:

1.  **Navigate & Wait** (using standard actions).
2.  **Extraction Script**:
    ```javascript
    const cards = Array.from(document.querySelectorAll('.product-card'));
    return cards.map(card => ({
      title: card.querySelector('.title')?.innerText,
      price: card.querySelector('.price')?.innerText
    }));
    ```
    This is faster and less prone to UI sync issues.
