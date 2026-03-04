## 2026-03-04 - [Security: Unsafe execSync for Session Secret]
**Vulnerability:** Use of `execSync` to shell out to `openssl` for session secret generation.
**Learning:** Shelling out to external binaries for cryptographic operations is unnecessary when Node.js has a built-in `crypto` module. It introduces risks of command injection (though not directly exploitable here as the command was static) and unnecessary overhead/dependencies.
**Prevention:** Use `crypto.randomBytes()` for all cryptographic random generation needs within the Node.js environment.
