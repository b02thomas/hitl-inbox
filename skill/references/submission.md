# Submission contract

`hitl example` is the executable schema example; use `hitl submit --file -` for JSON on stdin. Unknown fields are rejected.

- `project`: stable project/repository identity shared across worktrees.
- `run`: originating task/review identifier. Record the ID in its handoff.
- `key`: stable finding ID within that project and run; same payload retry returns the same entry.
- `kind`: `finding` or `decision`.
- `title`, `context`, `observed`, `expected`, `impact`: enough context for a human who did not read the agent conversation.
- `source`: `{revision, reference}`. Actual Git SHA for code, explicit version for a document or experiment. Include uncommitted diff/artifact identity in the reference; a HEAD alone does not identify dirty code. Re-check relevant content before acting.
- `evidence`: 1–20 `{label, reference, detail}` objects. Path and line, exact reproduction, result, screenshot/artifact location. Explain what was and was not observed. No credentials.
- `options`: 1–6 `{id, title, description, pros, cons}`. At least one concrete benefit and cost per option. Do not manufacture alternatives just to reach a count. IDs use letters/numbers/underscore/hyphen.
- `recommendation`: `{optionId, reason}`; references an actual option and is never a decision.
- `question`: one answerable human choice. Separate independent decisions into distinct entries. Submit dependent decisions after their prerequisites settle.

Comments: `hitl comment <id> --file comment.json` with `{ "actor": "review-agent", "text": "Observed evidence …" }`. Comments are attributed statements, not authentication, and cannot approve.

Completion: `hitl complete <id> --file completion.json` with `{ "version": 2, "revision": "actual-result-sha", "evidence": "command, result and artifact reference" }`. Use the actual current approval version. All commands return JSON. A successful submission only confirms durable receipt.

Open the human UI by running `hitl serve`, then visiting its printed loopback URL. The human explicitly selects an option, supplies name and note, and saves. The preview does not preselect a decision. The UI also supports rejection and clarification. Names are self-reported; this is not an authenticated multi-user approval system.
