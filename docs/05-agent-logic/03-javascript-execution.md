# JavaScript Execution

Doppelganger allows you to execute custom JavaScript in the browser context at any point in a task. This is the most powerful feature for handling complex logic, data transformation, and unsupported interactions.

## The `javascript` Block

Add a **Javascript** action block to your task.

### Execution Context
The code runs directly in the browser console (via `page.evaluate()`).
*   **Scope**: Global `window` object is available.
*   **DOM**: Full access to `document`, `querySelector`, etc.
*   **Variables**: Access runtime variables using `{$varName}` syntax.

### Return Values
The return value of your script is captured and stored in `block.output`.
*   **String/Number/Boolean**: Saved directly.
*   **Object/Array**: Automatically JSON stringified.
*   **Promise**: Doppelganger awaits the promise resolution.

### Examples

**1. Extract Text Content**
```javascript
return document.querySelector('.price').innerText;
```

**2. Scroll to Bottom**
```javascript
window.scrollTo(0, document.body.scrollHeight);
return true; // Simple confirmation
```

**3. Complex Logic**
```javascript
const items = document.querySelectorAll('.item');
let total = 0;
items.forEach(item => {
  const price = parseFloat(item.dataset.price);
  if (price > 100) total += price;
});
return total;
```

**4. Using Variables**
```javascript
const user = "{$username}"; // Injected by Doppelganger
document.cookie = `user=${user}; path=/`;
```

## Security Note

Scripts run with the same privileges as the page itself. Be cautious when executing untrusted code or exposing sensitive variables.
