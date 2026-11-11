# Spec Delta

## Purpose

Guarantees that a prune of tool calls and results is durable and deterministic: it survives resume, is reproduced by every replayer, and interacts predictably with undo and fork.

## ADDED Requirements

### Requirement: Prune is recorded durably

Applying a prune SHALL append one `context.apply_prune` record to the agent's wire log containing the dropped tool call ids, the truncated results with their `headChars`, the trigger source, token counts before and after, the number of whole messages removed, and the optional note.

#### Scenario: Record appears after prune

- **WHEN** a prune dropping two calls and truncating one result is applied
- **THEN** the wire log ends with a `context.apply_prune` record listing exactly those two ids and that one truncation

### Requirement: Prune application is deterministic

Given the same context and the same prune record, the resulting context SHALL be identical regardless of which component applies it. Specifically: a dropped call is removed from its assistant message and its tool message is removed; an assistant message left with no text and no calls is removed; a truncated result keeps its first `headChars` characters followed by a single-line note stating how many characters were omitted; all other messages are unchanged and keep their order.

#### Scenario: Resume reproduces the pruned context

- **WHEN** a session with a prune record is resumed
- **THEN** the rebuilt context equals the context the live session had immediately after the prune

#### Scenario: Assistant message with text survives

- **WHEN** an assistant message with text and one tool call has that call dropped
- **THEN** the message remains with its text and an empty call list

#### Scenario: Truncation note format

- **WHEN** a 5 000-character result is truncated with `headChars: 300`
- **THEN** its content is the first 300 characters followed by a newline and `[… 4700 chars omitted by prune; re-run the tool if needed …]`

### Requirement: Every replayer understands the record

The engine replay fold, the persistence fold, the node SDK resume replay, the transcript history fold, and the session visualiser SHALL each handle `context.apply_prune` without error and produce the same context as the engine.

#### Scenario: SDK resume matches engine

- **WHEN** the node SDK resumes a pruned session
- **THEN** the message count it reports equals the engine's

#### Scenario: Visualiser shows the prune

- **WHEN** a pruned session is opened in `kimi vis`
- **THEN** the timeline shows a prune event with its dropped and truncated counts and no decode error

### Requirement: Prune is not an undo or fork boundary

`/undo` SHALL continue to count user prompts across a prune, and `kimi fork` SHALL be able to fork from a point before a prune.

#### Scenario: Undo across a prune

- **WHEN** two prompts were submitted, a prune happened, and the user runs `/undo 2`
- **THEN** both prompts are undone and the context returns to its state before the first of them

### Requirement: Token accounting reflects the prune

After a prune, the context token estimate Kimi reports SHALL be recomputed from the pruned messages, and `tokensAfter` in the record SHALL equal that estimate.

#### Scenario: Context percentage drops

- **WHEN** a prune removes results totalling roughly half the context
- **THEN** the status line's context usage falls accordingly on the next render
