# Codex Agent Research

This repository now contains a runnable VS Code extension prototype for the research plan around trusted autonomous task completion.

## What it prototypes

- Durable task memory through a `TaskArtifacts` bundle stored in `.codex-research/`
- IDE-native visibility for `SubagentRun` state, scope, and spend
- Provenance-aware `ContextSource` ranking
- Approval and `VerificationGate` views for safe autonomy experiments
- Workflow capture into a generated `SKILL.md` draft

## Commands

- `Codex Research: Open Dashboard`
- `Codex Research: Seed Research Workspace`
- `Codex Research: Export Snapshot`
- `Codex Research: Promote Workflow To Skill Draft`
- `Codex Research: Refresh Views`

## Extension views

Open the `Codex Research` activity bar container to inspect:

- `Task Artifacts`
- `Subagents`
- `Context`
- `Approvals`

## Local workflow

1. Open this folder in VS Code.
2. Start the extension in an Extension Development Host.
3. Run `Codex Research: Open Dashboard`.
4. Run `Codex Research: Seed Research Workspace` to create `.codex-research/spec.md`, `plan.md`, `status.md`, `implement.md`, and `state.json`.
5. Run `Codex Research: Export Snapshot` to write `reports/codex-research-snapshot.md`.
6. Run `Codex Research: Promote Workflow To Skill Draft` to generate `generated-skill/SKILL.md`.

## Verification

- `node --check src/extension.js`
- `node --check src/dashboard.js`
- `node --check src/providers.js`
- `node --check src/store.js`
- `node --check src/domain.js`
- `node --test`
