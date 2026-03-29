# Research Interfaces

These interfaces are internal prototype contracts for the extension. They are intentionally not public APIs yet.

## `TaskArtifacts`

- Durable task container for objective, constraints, deliverables, milestones, and continuity state.
- Must survive local reloads and future local/cloud handoff.
- Backed by `.codex-research/state.json` plus human-readable markdown files.

## `SubagentRun`

- Captures visible child-run state, focus area, ownership, spend, and summary.
- Optimized for inspection and routing, not low-level execution traces.

## `ContextSource`

- Provenance-tagged context item with type, ranking score, rationale, pin state, and related artifacts.
- Used to explain why context was included and to tune ranking policy over time.

## `VerificationGate`

- Milestone-linked validation step with command or check, status, and repair policy.
- Makes verification inspectable before changes are treated as complete.
