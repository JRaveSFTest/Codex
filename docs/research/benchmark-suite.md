# Benchmark Suite

This benchmark pack turns the research plan into repeatable, reviewable tasks for the VS Code extension prototype.

## Goals

- Measure trusted autonomous completion, not raw token throughput.
- Compare baseline Codex workflows against prototypes that add durable task memory, subagent visibility, context ranking, and grouped approvals.
- Keep tasks representative of real editor use instead of synthetic micro-benchmarks.

## Scenarios

### 1. Multi-file bug fix

- Starting point: failing integration path with at least 3 impacted files.
- Success: bug fixed, verification run, and no unrelated files changed.
- Metrics:
  - time to first correct root-cause hypothesis
  - human interruptions
  - wrong-file edits
  - verification-before-apply rate

### 2. Constrained refactor with stable API

- Starting point: module with circular responsibilities and existing callers.
- Success: internal structure improved, public API stable, tests still pass.
- Metrics:
  - milestone completion rate
  - behavior regressions
  - rollback need
  - approval prompts per successful task

### 3. Greenfield feature from screenshot or spec

- Starting point: target screenshot, written spec, or both.
- Success: implemented feature matches target constraints and ships with validation steps.
- Metrics:
  - plan quality before edits
  - context sufficiency
  - amount of user steering required

### 4. PR review with parallel concerns

- Starting point: medium-size diff with bugs, risks, and missing tests.
- Success: issues identified and separated into coherent review threads or subagent concerns.
- Metrics:
  - bug-finding recall
  - duplicate findings
  - review quality by severity ordering

### 5. Local-to-cloud long task resume

- Starting point: task that spans multiple milestones and a context switch.
- Success: task can be resumed with no loss of spec, plan, or current status.
- Metrics:
  - resume accuracy
  - stale-context errors
  - status-log completeness

### 6. External-context task with MCP and cached web research

- Starting point: repo work that depends on volatile external facts.
- Success: extension chooses fresh context when needed and explains provenance.
- Metrics:
  - citation quality
  - context-source ranking quality
  - approval friction for external access

## Study Format

- Use the same six scenarios for baseline and prototype runs.
- Capture both moderated and unmoderated sessions.
- Require participants to narrate when they no longer trust the agent.
- Store outcome artifacts in `.codex-research/` plus a separate experiment log.

## Acceptance Thresholds

- `+20%` autonomous completion on medium and long tasks
- `-30%` human interruptions per successful task
- higher verification coverage without increased dangerous-access usage
