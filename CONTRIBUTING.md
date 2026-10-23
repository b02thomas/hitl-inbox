# Contributing

Use Node.js 24 or later. There are no external dependencies to install.

1. Open an issue describing the observable problem or proposed behavior. Keep credentials, personal data, local inbox contents, and private project evidence out of issues.
2. Make a focused change on a branch. Keep behavior ownership clear: `src/store.mjs` owns persistence and transitions, `src/schema.mjs` validates input, `src/server.mjs` owns HTTP, `bin/hitl.mjs` owns the CLI, and `web/` owns presentation.
3. Run `npm test`. For UI changes, also exercise submission, decision, reload, and CLI readback in an isolated inbox using `HITL_HOME`.
4. Open a pull request explaining the problem, resulting behavior, verification, and limitations.

Tests should protect observable contracts and realistic failures. Do not replace missing human decisions with defaults or loosen validation to make a test pass. Keep the security boundary in the README accurate.

Use synthetic evidence in examples and tests. Never commit live inbox databases, operator decisions, access tokens, or machine-specific verification reports.
