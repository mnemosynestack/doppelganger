## 2025-03-04 - Insecure Default for SSRF Prevention
**Vulnerability:** The Server-Side Request Forgery (SSRF) mitigation flag (`ALLOW_PRIVATE_NETWORKS`) defaulted to `true`, rendering the application vulnerable to SSRF out-of-the-box by allowing requests to private IPs.
**Learning:** Security controls that must be enabled or opted-into are prone to being skipped by users. By defaulting to true, the application's out-of-the-box state was insecure, requiring the user to explicitly secure it by passing env variables.
**Prevention:** Always ensure that security features (like restricting access to private network IPs for agents) default to the most secure configuration (`false`), and make insecure behaviors strictly opt-in.
