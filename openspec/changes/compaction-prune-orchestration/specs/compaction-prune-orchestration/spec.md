# Spec Delta

## Purpose
Specifies what Kimi Code does with a validated prune decision during compaction, when it still writes a summary, and how the outcome is reported to the user and to hooks.

## ADDED Requirements

### Requirement: Prune runs before any summary
When a compaction starts and a validated prune decision is present, Kimi SHALL apply the prune to the context before deciding whether to request a summary.

#### Scenario: Manual compact with a decision
- **WHEN** the user runs `/compact` and the hook returns a valid prune
- **THEN** the prune is applied and recorded before any request to the model

#### Scenario: No decision
- **WHEN** no hook returns a prune decision
- **THEN** compaction behaves exactly as the unpatched build

### Requirement: Summary only when the prune is not enough
After the prune, Kimi SHALL request the built-in summary only if the recounted context still meets the block threshold that would prevent the next turn from starting. Otherwise the compaction finishes in prune mode with no model request.

#### Scenario: Prune frees enough
- **WHEN** an auto-compaction triggers at 85 % of the window and the prune brings the context to 40 %
- **THEN** no summary request is made and the context contains no new compaction summary message

#### Scenario: Prune is not enough
- **WHEN** the prune brings the context from 90 % to 87 % and the block threshold is 85 %
- **THEN** the built-in summary compaction runs over the pruned history, and the result mode is `prune_then_summary`

#### Scenario: Manual compact with a small prune
- **WHEN** the user runs `/compact` in a short session and the prune frees little but the context is far below the block threshold
- **THEN** compaction finishes in prune mode without a summary

### Requirement: Outcome is reported
Every compaction SHALL report its `mode` (`summary`, `prune`, or `prune_then_summary`), the number of dropped calls, the number of truncated results, and tokens before and after, to: the user-facing compaction-finished notice, the `PostCompact` hook payload (`mode`, `dropped_calls`, `truncated_results`, `estimated_token_count`), and telemetry.

#### Scenario: User sees the mode
- **WHEN** a prune-mode compaction finishes having dropped 12 calls and truncated 5 results
- **THEN** the notice reads, in substance, "Compacted (prune): dropped 12 tool calls, truncated 5 results, N → M tokens" and includes the hook's `note` when present

#### Scenario: PostCompact carries the mode
- **WHEN** a `PostCompact` hook runs after a prune-mode compaction
- **THEN** its payload has `mode: "prune"` and the counts

### Requirement: Prune errors fall back
If applying the prune throws, Kimi SHALL log the error, leave the context unchanged, and continue with the built-in summary compaction for that run.

#### Scenario: Apply failure
- **WHEN** the context memory service rejects the prune
- **THEN** the compaction still completes using the summary path and the user notice mentions the fallback

### Requirement: Cancellation and guards are preserved
Cancelling a compaction during the prune step SHALL leave the context unchanged, and the existing one-compaction-at-a-time guard SHALL cover prune-mode compactions.

#### Scenario: Cancel during prune
- **WHEN** the user cancels while the prune is being applied
- **THEN** no `context.apply_prune` record is written and the context equals its pre-compaction state
