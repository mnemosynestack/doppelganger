# AGENTS

## Purpose
This file summarizes the expectations for human or scripted coding agents working in the Doppelganger repository. Follow the conventions here plus the deeper references (AGENT_SPEC, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE, README) whenever you touch the code.

## Repository context
- **SUL 1.0 License** (LICENSE, 2026) governs usage, copying, and distribution. Respect the hosted-service, commercial-hosting, and Competing Product prohibitions when designing automation or service offerings.
- **AGENT_SPEC.md** describes the JSON schema, action types, and templating rules that AI-driven agents must obey when generating tasks for Doppelganger. Refer to it before building or editing any automation payloads.
- **package.json** lists the runtime/development scripts: `npm run dev` (Vite), `npm run server`/`start`, `npm run build`, and the `postinstall` helper in `scripts/postinstall.js`. Use these scripts to run and package the project.

## Setup & workflow reminders
- Install dependencies with `npm install` (or `pnpm`/`yarn` if preferred and documented elsewhere). The project bundles Node.js, Playwright, React, and Tailwind tooling.
- Build artifacts live in `dist` after `npm run build`. Runtime entry points include `server.js`, `agent.js`, `headful.js`, `scrape.js`, and the CLI binary `bin/cli.js`.
- Use `node server.js` or `npm run server` to run the backend (watch for environment variables defined in scripts or README).

## Coding agent behavior
- Prioritize understanding the user request. For changelog-like updates or minor edits, skip creating a plan; otherwise build a short plan (see developer instructions) and update it as you progress.
- Prefer ASCII-only edits unless the file already uses other characters and it is essential to keep them.
- Respect the existing Git state: never revert user edits you did not make, never run `git reset --hard` or `git checkout --` unless explicitly instructed, and avoid destructive operations.
- When editing files, prefer `apply_patch` for single-file changes unless the edit is auto-generated or better handled via another command.
- For documentation or explanation, keep answers concise and developer-focused. When referencing files in reports, include paths like `package.json:27` but keep references to single lines.
- Tests are not required by default, but consider adding or running them if you modify critical functionality; if you can't run them, note that explicitly.

## Security & compliance
- Do not remove, obscure, or alter any copyright notices, license headers, or attribution statements.
- Understand that the SUL license disallows offering the software as a hosted service, commercial hosting, or competing product; keep that in mind for feature changes that resemble SaaS offerings.
- If your change interacts with third-party data or automation (Playwright, proxies, scraping), document any extra consent/permission requirements and ensure compliance with the relevant laws or terms.

## Communication
- Document assumptions in pull requests, including any remaining TODOs or follow-up actions (tests, validation steps, version bumps) that you did not complete.
- Notify reviewers if you introduce new scripts or workflows that they must run manually.
- When relying on skills (see `.codex/skills`), follow the skill-specific instructions; mention in your summary which skill(s) you used and why.

## Additional resources
- `README.md` for product overview and usage guidance.
- `CONTRIBUTING.md` for contribution conventions.
- `CODE_OF_CONDUCT.md` for community expectations.
- `scripts/`, `server.js`, `agent.js`, etc., for automation entry points referenced by AGENT_SPEC.
