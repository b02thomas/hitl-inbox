---
name: hitl-review
description: Submit review findings and unresolved product, design, scope, or conflicting-requirement decisions to the local HITL inbox. Use entscheidungsseite for visual or grouped choices, then read the human decision before implementing the affected change.
---

# HITL review

Use `hitl` to put a concrete, evidence-backed choice in front of the human. Facts are the agent's work; unresolved decisions belong to the human.

## Triage

Read the relevant code, requirements and existing decisions first. Report uncertainty as uncertainty. Do not invent requirements, decide product behavior through a test expectation, or silently widen scope.

An already authorized, unambiguous correction can proceed within its original scope. A new product/design choice, contradictory requirement, uncertain intended behavior, or proposed scope expansion must wait. If the user asks to approve every finding, every finding waits. Existing explicit decisions remain binding; do not escalate them again without changed evidence.

## Decision pages

For UI alternatives, multiple independent human choices, or an explicit request for `/entscheidungsseite`, use the companion `entscheidungsseite` skill before submission. Read [the integration guide](references/entscheidungsseite.md) for skill discovery, page-to-inbox mapping, and the approval boundary. Simple individual factual decisions can use the inbox directly.

## Submit

1. Run `hitl help`. If unavailable, report the missing tool and keep the dependent action blocked; ask in the active conversation instead. Never treat an unavailable inbox as approval.
2. Use `hitl example` for the exact JSON shape. Read [the submission reference](references/submission.md) when preparing a record. Replace every demonstration field with real evidence; never submit the fixture as a real finding.
3. Write the JSON to a local file and run `hitl submit --file <path>`. Keep the returned ID in the existing task handoff. Reuse the same `key` for an identical retry; a changed factual basis needs a new key referencing the previous ID.
4. Explain the actual state, expected contract, effect, evidence, options and recommendation in the user's language. Separate observed facts from hypotheses. Reference the actual revision and source. For visual choices use the decision-page workflow above, attach the verified page reference, and describe what differs; the inbox compares text and does not render arbitrary submitted HTML.
5. Run `hitl wait <id> --revision <submitted-revision> --timeout 60`, or `hitl show <id>` when resuming. Continue independent work only. Do not repeatedly poll without useful work or leave an agent running indefinitely.

## Readback

`hitl check <id> --revision <current-relevant-revision>` returns 0 only for an approved/completed record on the same revision. Exit 4 means blocked/rejected/stale; exit 2 means unknown/error. Neither permits the dependent action. A timeout, recommendation, comment or request for clarification is not approval.

Read the saved option, note, actor and version. Implement only that option within the original authorization. A rejected proposal stays rejected. A clarification is a question: investigate and append evidence with `hitl comment`; wait for a subsequent human decision. Do not change original evidence to fit the desired answer. If the relevant code or contract changed, submit a fresh decision explaining the delta.

Never submit a human decision yourself, automate clicks on the decision form, impersonate the operator, or edit the inbox database to unblock work. Controlled synthetic tests may exercise decisions only in an isolated test inbox.

After implementation and verification, use `hitl complete` with the approval version, resulting revision and actual evidence. This records an agent's completion report, not an independent review or merge. If already completed, read the evidence rather than repeating the change. Copy the decision reference to the project's established specification/ADR/issue when that workflow requires it; the inbox is not a replacement issue tracker.

## Enforcement boundary

The CLI is a cooperative local workflow. Agents running as the same OS user can bypass it; a skill cannot prevent that. A caller must honor the nonzero exit before dispatch or dependent work. Do not claim global enforcement, automatic agent resumption, or installed hooks without verifying that integration. Installing this skill does not change runtime permissions.
