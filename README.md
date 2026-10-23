# HITL Inbox

A local human-in-the-loop inbox for coding agents. Agents submit review findings and unresolved decisions with evidence, options, and a recommendation. A human responds in the browser; the agent reads the saved decision before continuing the affected work.

**Early local prototype.** No external dependencies or cloud service. Node.js 24 or later. The current browser UI and CLI messages are in German; the agent skill is in English.

## Quick start

```sh
git clone https://github.com/b02thomas/hitl-inbox.git
cd hitl-inbox
node bin/hitl.mjs serve
```

Open **http://127.0.0.1:47831**. The server binds to loopback only. Stop it with Ctrl-C.

In another terminal, submit the explicitly synthetic example:

```sh
node bin/hitl.mjs submit --file examples/decision.json
node bin/hitl.mjs list
```

To make `hitl` available on your PATH, optionally run `npm link` from the checkout. No npm registry publication is required. The package remains marked private to prevent accidental publication.

## The workflow

1. **Investigate.** The agent distinguishes observed facts from hypotheses and checks existing requirements.
2. **Submit.** A finding includes project/run identity, source revision, observed and expected behavior, impact, evidence, options, and a recommendation.
3. **Decide.** The human compares options, explicitly selects one, supplies a name and note, and approves, rejects, or asks a question.
4. **Read back.** The agent checks the saved answer and its revision before implementing the approved option.
5. **Report completion.** The agent records the resulting revision and verification evidence. This is a completion report, not independent acceptance.

The UI presents observed/expected behavior, evidence, switchable option comparisons, pros and cons, the recommendation, and the decision history. The preview does not select an answer on the human's behalf. Evidence references are currently text; arbitrary submitted HTML and embedded prototypes are not rendered.

## CLI

All data commands return JSON. Replace `<id>` with the ID returned by `submit`.

```sh
hitl example                         # Full submission shape
hitl submit --file finding.json      # Or --file - for stdin
hitl list --project my-project --run review-42
hitl show <id>                       # Entry and event history
hitl wait <id> --revision <sha> --timeout 60
hitl check <id> --revision <sha>
hitl comment <id> --file comment.json
hitl complete <id> --file completion.json
```

| Exit | Meaning |
| --- | --- |
| `0` | Command succeeded; for `check`/`wait`, approval exists for the supplied revision |
| `2` | Error or unknown state; do not continue dependent work |
| `4` | Pending, clarification requested, rejected, or stale; do not continue dependent work |

A successful `submit` only confirms durable receipt. A recommendation, comment, timeout, or unavailable inbox is never approval. The caller must provide the actual relevant revision; the CLI does not inspect Git or detect dirty working-tree changes itself.

Comment input:

```json
{"actor":"review-agent","text":"Additional evidence and its source."}
```

Completion input uses the current entry version after approval:

```json
{"version":2,"revision":"result-commit-sha","evidence":"Verification command, result, and artifact reference."}
```

## Agent skill

The reusable skill is in [`skill/SKILL.md`](skill/SKILL.md), with the detailed submission contract in [`skill/references/submission.md`](skill/references/submission.md).

After installing the CLI on PATH, copy the skill directory to an unused location in your runtime's skill directory, for example `~/.codex/skills/hitl-review`. Do not overwrite an existing skill. New sessions can discover it; an existing session can read the file explicitly.

The skill requires unresolved product, design, scope, and conflicting-requirement decisions to wait. Already-authorized, unambiguous corrections can proceed within scope unless the user requires approval for every finding. Merely submitting a record does not decide which work must block; the calling workflow owns that policy.

The skill was independently written using the principles described in Matt Pocock's [writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md), [skill mechanics](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL-MECHANICS.md), and [grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md): precise triggers, actionable steps, details on demand, and a distinction between discoverable facts and human choices.

## Persistence

Data lives in `~/.local/share/hitl-inbox/inbox.sqlite`, outside the checkout. Set `HITL_HOME` to use a separate inbox:

```sh
HITL_HOME=/path/to/separate-inbox hitl serve --port 47832
```

Use the same `HITL_HOME` for the server and its CLI clients. SQLite transactions serialize concurrent writers and commit decisions together with their audit events. Retrying the same project/run/key and payload returns the same entry. Reusing the key with changed content fails. Stale form versions cannot overwrite a newer decision.

States: `open` → `approved`, `rejected`, or `clarification`; `clarification` can receive a later decision; `approved` → `completed` with a matching version and evidence. Changed circumstances require a fresh entry referencing the previous one. For a consistent filesystem backup, stop the server and CLI writers before copying the data directory.

## Enforcement boundary

This is a **cooperative local workflow, not a security boundary against an agent running as the same OS user**. There is no CLI approval command. The browser API validates Host, Origin, CSRF, and entry version. Operator names are self-reported, not authenticated identities.

An agent with unrestricted shell/browser access could still bypass the workflow or edit the database. A non-bypassable approval system requires a separate operator identity and a dispatcher outside the agent's control. Do not expose this server publicly or use it as a multi-user approval service.

A dispatcher can call `hitl check <id> --revision <actual-revision>` before dependent work and stop on any nonzero exit. Automatic agent callbacks, mandatory tool hooks, authenticated operator accounts, and global gate integration are **not implemented**. Installing the skill does not change runtime permissions or hook configuration.

## Development

```sh
npm test
```

Tests exercise real CLI processes, persistent SQLite state, concurrent submissions, idempotency, validation, pending/rejected/stale decisions, clarification, timeout, version conflicts, HTTP boundaries, and completion evidence. Tests use temporary inboxes and synthetic approvals. CI runs on Node 24 and 26.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE).
