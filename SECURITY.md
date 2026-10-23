# Security

HITL Inbox is an early, single-user, loopback-only application. It is not an authenticated approval service and does not isolate agents from the operator's OS account. Do not expose it through a public interface or reverse proxy.

The HTTP server validates Host, Origin, CSRF tokens, and decision versions. The CLI has no approval command. These controls do not prevent another process with the same filesystem permissions from modifying the database or using the browser API.

The application does not execute submitted commands or HTML. Keep credentials and sensitive evidence out of submissions and public issues. Local inbox files are user data, not cache.

For a suspected vulnerability, use GitHub's **Security → Report a vulnerability** when available. If private reporting is unavailable, open a minimal issue requesting a private reporting channel without including exploit details, credentials, or sensitive data.
