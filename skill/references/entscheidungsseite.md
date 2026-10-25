# Connect decision pages to the HITL inbox

Use this workflow for UI alternatives, several independent questions awaiting human judgment, or an explicit `/entscheidungsseite` request. The companion produces the comparison; HITL stores the binding answer and completion evidence.

## Discover and build

1. Find `entscheidungsseite` in the session's skill catalog and read its `SKILL.md`. If the runtime has no catalog entry, check its configured skill directories for `entscheidungsseite/SKILL.md`. Resolve scripts and assets relative to that file; do not assume a provider-specific Skill tool or a particular user's absolute path.
2. If the companion is unavailable, say that the visual integration is unavailable. Do not claim to have run it or install an unknown source automatically. For an explicit decision-page request, keep that deliverable outstanding; otherwise use the ordinary inbox for a decision that can be understood without a visual page.
3. Follow the companion's question gathering, format selection, data generation and verification steps. Read its `SKIZZEN.md` for UI questions. Every UI option needs a distinguishable wireframe; link a richer prototype when one screen is insufficient. Use its builder and checks rather than hand-editing generated HTML. Report a failed/unavailable check honestly; do not present the page as verified.
4. Treat the companion as a renderer and comparison workflow in this combined mode. Its standalone copy-back and decision-recording steps are replaced by the inbox handoff below. State in `SEITE.intro`: selections on this page are drafts; save the final answer in the HITL inbox. Do not change the companion's installed files or global behavior.

Only ask questions whose prerequisites are settled. Do not invent alternatives to satisfy a page's option count: a single viable proposal belongs in the ordinary inbox instead. For more than four genuinely distinct options, narrow the decision with evidence or use the ordinary inbox; do not silently discard options.

## Map each question

Keep the page data, a small mapping document, and the rendered page together in the task's review/spec directory. These are local task artifacts, not automatic public-repository content.

| Decision page | HITL submission |
| --- | --- |
| `SEITE.id` | Include in `key` and evidence; change on a new factual basis/options |
| `FRAGEN[].id`, e.g. `E01` | One distinct entry; key such as `upload-v2-E01` |
| `titel` | `question`, with a concise corresponding `title` |
| `kontext` and read sources | `context`, `observed`, `expected`, `impact`, `source`, `evidence` |
| `optionen[].key` | Identical `options[].id` |
| `label`, `text`, `skizze` | Matching option title/description, explicit pros/cons, page reference for the sketch |
| `empfohlen`, `warum` | Matching `recommendation.optionId` and reason |

The page does not supply every required inbox field: research and fill the missing fields instead of guessing. Preserve option meaning and recommendations in both representations. For a matrix, create one inbox entry per independently decidable row; use `wahl` keys as option IDs and the row's `empfohlen` value as its recommendation. Include the row key in the mapping.

Include the verified HTML path, `SEITE.id`, question/row ID, and relevant source revision in an evidence record. Run `hitl submit` and save the returned entry ID in the mapping:

```text
Page version | Question / row | Inbox ID | Option keys | Source revision
upload-v2    | E01            | returned ID | A, B     | actual revision
```

Use real returned IDs, never placeholders in the actual handoff. Existing submissions are immutable: attach a newly created page reference with `hitl comment` only if it illustrates exactly the same facts/options. Changed options or source context require a fresh entry and page version referencing the old record; an old approval does not cover them.

## Human handoff and readback

Present the verified decision page link, the HITL inbox URL printed by `hitl serve`, and the question-to-entry mapping. Evidence paths currently appear as text in the inbox; do not claim the HTML is embedded or automatically opened. The inbox has no entry deep-link route, so identify entries by their title/project and ID.

The human compares the page and saves the actual option and note in the inbox. Do not require a second confirmation after that save. A page's browser storage, “Empfehlungen übernehmen” button, or copied selection does not modify the inbox. If the human pastes a selection into the conversation, acknowledge their stated choice but explain that the current `hitl check` still requires them to save it in the inbox; do not impersonate them or invent an import command.

Before dependent work, read `hitl show` and `hitl check` for the mapped entry and actual relevant revision. The saved option and human note govern the authorized change. A note may constrain the option; if it contradicts the option or introduces a new ambiguity, clarify before acting. Open, rejected, stale, unavailable, or clarification states do not authorize that change.

After readback, record the decision ID and actual human note in the project's existing decision register if required. Archive the page using `SEITE.archiv` only when every mapped question has a terminal human answer; otherwise keep the remaining questions visibly open. Rebuild from the data file. Archiving a comparison never means implementation is complete; that is separately reported through `hitl complete` with evidence.
