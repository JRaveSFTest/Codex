# Codex Agent Research

This repository contains a VS Code extension prototype for improving trusted autonomous task completion.

## What This Is

This is a **VS Code extension**, not a PowerShell or terminal tool.

- Commands like `Codex Research: Open Dashboard` are **Command Palette commands**
- They are **not** shell commands you type into PowerShell
- To use them in a normal VS Code window, the extension must be installed
- To use them during development, launch the Extension Development Host with `F5`

## What It Prototypes

- Durable task memory through a `TaskArtifacts` bundle stored in `.codex-research/`
- IDE-native visibility for `SubagentRun` state, scope, and spend
- Live-refreshable `ContextSource` ranking based on current workspace signals
- Approval and `VerificationGate` views for safe autonomy experiments
- Workflow capture into a generated `SKILL.md` draft
- Persistent status notes and synchronized markdown artifacts
- Startup diagnostics, first-run onboarding, and automatic dashboard opening

## VS Code Commands

- `Codex Research: Open Dashboard`
- `Codex Research: Seed Research Workspace`
- `Codex Research: Refresh Workspace Context`
- `Codex Research: Export Snapshot`
- `Codex Research: Promote Workflow To Skill Draft`
- `Codex Research: Update Milestone Status`
- `Codex Research: Update Verification Gate Status`
- `Codex Research: Update Approval Status`
- `Codex Research: Update Subagent Status`
- `Codex Research: Add Status Note`
- `Codex Research: Open Spec`
- `Codex Research: Open Plan`
- `Codex Research: Open Status Log`
- `Codex Research: Show Diagnostics`
- `Codex Research: Refresh Views`

## Normal Local VS Code Usage

Use this flow if you want the commands to appear in your regular VS Code window.

1. Install dependencies.
   On Windows PowerShell, use `npm.cmd install` if `npm install` is blocked by execution policy.
2. Build the VSIX:
   `npm run package:vsix`
3. Install it into VS Code:
   `npm run install:vsix`
4. Reload VS Code.
5. Open the Command Palette with `Ctrl+Shift+P`.
6. Run `Codex Research: Open Dashboard`.

Useful iteration commands:

- `npm run uninstall:vsix`
- `npm run reinstall:vsix`

## F5 Development Workflow

Use this flow if you are developing the extension itself.

1. Open this folder in VS Code.
2. Press `F5`.
3. In the Extension Development Host, open the Command Palette.
4. Run `Codex Research: Open Dashboard`.

In the Extension Development Host, the dashboard should auto-open on every activation.

## First-Run Behavior

On activation, the extension should:

- create a `Codex Research` output channel
- log activation details and diagnostics context
- auto-open the dashboard every time in the Extension Development Host
- auto-open the dashboard once per workspace in a normally installed window
- prompt you to seed `.codex-research/` if the research bundle is missing

## Dashboard Workflow

From the dashboard you can:

- seed the workspace bundle
- refresh workspace context
- open spec, plan, status log, and workspace context docs
- update milestones, verification gates, approvals, and subagent status
- add status notes
- open diagnostics

## Generated Workspace Artifacts

Seeding the workspace creates or maintains:

- `.codex-research/spec.md`
- `.codex-research/plan.md`
- `.codex-research/status.md`
- `.codex-research/workspace-context.md`
- `.codex-research/implement.md`
- `.codex-research/state.json`

Additional outputs:

- `reports/codex-research-snapshot.md`
- `generated-skill/SKILL.md`

## Packaging Notes

- The local packaging workflow uses `@vscode/vsce`
- The VSIX install target is the local extension id `local.codex-agent-research`
- `.vscodeignore` excludes tests, scripts, reports, seeded workspace artifacts, and other development-only files from the packaged extension

## Verification

- `node --check src/extension.js`
- `node --check src/dashboard.js`
- `node --check src/providers.js`
- `node --check src/store.js`
- `node --check src/domain.js`
- `node --check src/stateModel.js`
- `node --check src/activationModel.js`
- `node --test`
