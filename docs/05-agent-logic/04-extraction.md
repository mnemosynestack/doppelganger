# Data Extraction

Doppelganger offers powerful tools to extract structured data from web pages. The extraction process runs **after** all automation steps are complete.

## Extraction Script

Every task includes an **Extraction Script** field in the editor. This JavaScript code runs in the browser context to parse the final page state.

### Input
The script has access to:
*   `document`: The DOM of the page.
*   `$$data.html()`: A helper to get the raw HTML string (including Shadow DOM if enabled).
*   `variables`: Any runtime variables defined in the task.

### Output
The script must return a value (String, Object, Array). This value is saved as the `result` of the execution.
*   **JSON**: Automatically formatted.
*   **CSV**: If `extractionFormat` is set to `csv`, Doppelganger attempts to convert an array of objects to CSV.

### Example: Extracting a Product List

```javascript
// Get all product cards
const products = Array.from(document.querySelectorAll('.product-card'));

// Map each card to an object
const data = products.map(card => {
  const title = card.querySelector('.title')?.innerText.trim();
  const price = card.querySelector('.price')?.innerText.trim();
  const link = card.querySelector('a')?.href;

  return { title, price, link };
});

return data; // Returns an array of objects
```

### Example: Extracting a Single Value

```javascript
const price = document.querySelector('.main-price').innerText;
return { price };
```

## Handling Dynamic Content

If the page loads content dynamically (AJAX), ensure your task includes `wait` or `wait_selector` actions *before* the extraction script runs. The script executes only after the last action completes.

## CSV Formatting

If you select **CSV** as the output format:
1.  Ensure your script returns an **Array of Objects**.
2.  Keys in the first object become the CSV headers.
3.  Doppelganger handles quoting and escaping automatically.

```javascript
return [
  { name: "Item 1", price: 10 },
  { name: "Item 2", price: 20 }
];
// Result:
// name,price
// "Item 1",10
// "Item 2",20
```
