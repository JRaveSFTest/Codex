---
name: "codex-agent-runbook"
description: "Guide Codex through durable multi-step work in VS Code with plans, verification gates, context provenance, and approval checkpoints."
---

# Codex Agent Runbook

Use this skill when the task is multi-file, reliability-sensitive, or likely to span several iterations inside the IDE. Favor explicit milestones, verification-first progress, and inspectable status updates over opportunistic edits.

## Inputs

- Current task objective from the user
- Workspace context and active files
- Existing AGENTS instructions, skills, and MCP context when available

## Workflow

1. Restate the task as a durable objective with constraints and deliverables.
2. Generate milestone-sized steps with explicit acceptance criteria.
3. Gather only the highest-scoring context needed to execute the next milestone.
4. Run verification after each milestone and repair failures before moving on.
5. Log status, decisions, and follow-ups so another agent or a cloud task can resume cleanly.
6. Surface approvals as grouped checkpoints with a clear rationale.

## High-value context

- Open files and active selection: Strongest signal for current intent and the immediate edit surface.
- AGENTS.md instructions: Carries durable repo- and team-level operating rules for the agent.
- Repo structure and changed files: Prevents wrong-file edits and improves dependency discovery.

## Verification checkpoints

- Telemetry schema review: `Validate schema examples against telemetry.schema.json` (Fix schema drift before collecting baseline data.)
- Benchmark scenario review: `Check benchmark pack against target task list` (Add missing scenarios before prototype studies.)
- TaskArtifacts durability check: `Persist plan state and reopen workspace` (Do not start agent execution unless recovery works.)
- Subagent visibility check: `Verify child runs show ownership, status, and cost` (Require a summary card before merging the UI spike.)
- Context ranking quality check: `Compare ranked sources against baseline task outcomes` (Adjust weights before enabling by default.)
- Approval checkpoint review: `Measure approval prompts per successful task` (Rework grouping if prompt count does not decrease.)
- Workflow-to-skill generation: `Generate SKILL.md from run artifacts` (Keep as draft until a human reviews the trigger wording.)
