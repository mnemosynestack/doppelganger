# Login Flows

Automating login flows is a common use case for Doppelganger. This guide walks you through building a robust login task.

## 1. Identify Selectors
Inspect the login page (Headful mode is great for this). Find:
*   Username input (e.g., `#username`, `input[name="email"]`)
*   Password input (e.g., `#password`)
*   Submit button (e.g., `button[type="submit"]`)
*   Success indicator (e.g., `.dashboard`, `a[href="/logout"]`)
*   Error message (e.g., `.alert-danger`)

## 2. Build the Task
Create a new **Agent** task.

### Step 1: Navigate
*   **Action**: `navigate`
*   **Value**: `https://example.com/login`

### Step 2: Wait for Load
*   **Action**: `wait_selector`
*   **Selector**: `#username` (Ensure inputs are ready)

### Step 3: Input Credentials
*   **Action**: `type`
    *   Selector: `#username`
    *   Value: `{$user}` (Use a variable!)
*   **Action**: `type`
    *   Selector: `#password`
    *   Value: `{$pass}`

### Step 4: Submit
*   **Action**: `click`
    *   Selector: `button[type="submit"]`

### Step 5: Verification (Crucial!)
*   **Action**: `wait`
    *   Value: `2` (Allow redirect time)
*   **Action**: `if`
    *   Condition: `exists('.dashboard')`
*   **Inside If**:
    *   **Action**: `stop`
        *   Value: `success`
*   **Else**:
    *   **Action**: `stop`
        *   Value: `failure` (Login failed)
*   **End If**

## 3. Handling 2FA / CAPTCHA
If the site uses CAPTCHA or 2FA, fully automated login might be impossible.
*   **Option A**: Use **Headful Mode** to log in manually once. Cookies are saved to `storage_state.json`. Subsequent tasks reuse this session.
*   **Option B**: Use an external CAPTCHA solving service (requires custom JS integration).

## 4. Reusing the Session
Once logged in, any subsequent task (even a different one) will use the saved cookies, provided `statelessExecution` is **false**.
