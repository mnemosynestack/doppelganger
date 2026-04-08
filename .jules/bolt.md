
## 2026-04-08 - Proxy Identity Anti-pattern
**Learning:** The sandbox implementation used a redundant function wrapper in the 'get' trap, causing 'p.fn !== p.fn'. This broke reference stability and added ~40% overhead to function property access.
**Action:** Always utilize 'proxyMap' to return existing proxies and let the 'apply' trap handle function calls instead of wrapping in 'get'.
