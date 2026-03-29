"use strict";

function statusWeight(status) {
  return {
    pending: 0,
    in_progress: 1,
    blocked: 1,
    completed: 2
  }[status] ?? 0;
}

function summarizeState(state) {
  const milestoneCount = state.taskArtifacts.milestones.length;
  const completedMilestones = state.taskArtifacts.milestones.filter((item) => item.status === "completed").length;
  const completedVerification = state.verificationGates.filter((item) => item.status === "completed").length;
  const blockedApprovals = state.approvals.filter((item) => item.status === "blocked" || item.status === "pending").length;
  const averageContextScore =
    state.contextSources.length === 0
      ? 0
      : Math.round(
          (state.contextSources.reduce((sum, item) => sum + item.score, 0) / state.contextSources.length) * 10
        ) / 10;

  return {
    milestoneCount,
    completedMilestones,
    milestoneCompletionRate: milestoneCount === 0 ? 0 : Math.round((completedMilestones / milestoneCount) * 100),
    completedVerification,
    verificationCount: state.verificationGates.length,
    blockedApprovals,
    averageContextScore,
    activeSubagents: state.subagentRuns.filter((item) => item.state === "in_progress").length,
    estimatedCostUsd: Math.round(
      state.subagentRuns.reduce((sum, item) => sum + item.costUsd, 0) * 100
    ) / 100
  };
}

function derivePriorityQueue(state) {
  const tasks = [];

  for (const approval of state.approvals) {
    if (approval.status !== "completed") {
      tasks.push({
        kind: "approval",
        title: `Resolve approval: ${approval.scope}`,
        weight: 5
      });
    }
  }

  for (const gate of state.verificationGates) {
    if (gate.status !== "completed") {
      tasks.push({
        kind: "verification",
        title: `Run verification: ${gate.label}`,
        weight: 4
      });
    }
  }

  for (const milestone of state.taskArtifacts.milestones) {
    if (milestone.status !== "completed") {
      tasks.push({
        kind: "milestone",
        title: `Advance milestone: ${milestone.title}`,
        weight: 3 + statusWeight(milestone.status)
      });
    }
  }

  return tasks.sort((left, right) => right.weight - left.weight || left.title.localeCompare(right.title));
}

function createSkillDraft(state) {
  const topContext = [...state.contextSources]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => `- ${item.label}: ${item.rationale}`)
    .join("\n");

  const checkpoints = state.verificationGates
    .map((gate) => `- ${gate.label}: \`${gate.command}\` (${gate.repairPolicy})`)
    .join("\n");

  return `---
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

${topContext || "- No context sources captured yet."}

## Verification checkpoints

${checkpoints || "- No verification gates defined yet."}
`;
}

module.exports = {
  summarizeState,
  derivePriorityQueue,
  createSkillDraft
};
