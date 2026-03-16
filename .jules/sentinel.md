## 2025-05-15 - [Timing-Safe Login Check]
**Vulnerability:** User enumeration via timing attacks in the login process.
**Learning:** The previous implementation only called `bcrypt.compare` when a user was found. Since `bcrypt.compare` is computationally expensive, attackers could distinguish between valid and invalid emails by measuring server response times.
**Prevention:** Always perform a password comparison. If the user does not exist, compare against a dummy bcrypt hash to ensure consistent latency regardless of whether the account exists.

## 2025-05-22 - [TaskId Path Traversal in Agent]
**Vulnerability:** Path traversal in agent `start` action allowing auth bypass of internal endpoints.
**Learning:** The agent's `start` action used user-provided task IDs to construct internal API URLs. Since internal requests from loopback can bypass authentication via `x-internal-run: 1`, an attacker could use path traversal (e.g., `../../api/clear-cookies?`) to trigger administrative actions.
**Prevention:** Always sanitize IDs and slugs used in URL construction, especially for internal or administrative API calls. Reusing existing sanitization utilities (like `sanitizeRunId`) ensures consistency across the codebase.
