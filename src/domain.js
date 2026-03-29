"use strict";

function statusWeight(status) {
  return {
    pending: 0,
    in_progress: 1,
    blocked: 1,
    completed: 2
  }[status] ?? 0;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAgeMinutes(timestamp, now = new Date()) {
  const parsed = parseTimestamp(timestamp);
  const current = now instanceof Date ? now : new Date(now);
  if (!parsed || Number.isNaN(current.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((current.getTime() - parsed.getTime()) / 60000));
}

function getFreshnessThresholds(kind) {
  switch (kind) {
    case "editor":
      return { fresh: 15, aging: 60 };
    case "agents":
      return { fresh: 60, aging: 180 };
    case "repo":
      return { fresh: 45, aging: 120 };
    case "skills":
      return { fresh: 240, aging: 1440 };
    case "mcp":
      return { fresh: 30, aging: 90 };
    case "web":
      return { fresh: 20, aging: 60 };
    default:
      return { fresh: 45, aging: 120 };
  }
}

function deriveContextTier(source) {
  if (source.pinned || source.score >= 9) {
    return "primary";
  }
  if (source.score >= 7.5) {
    return "supporting";
  }
  return "fallback";
}

function deriveContextFreshness(kind, capturedAt, now = new Date()) {
  const ageMinutes = getAgeMinutes(capturedAt, now);
  if (ageMinutes === null) {
    return { label: "unknown", ageMinutes: null };
  }

  const thresholds = getFreshnessThresholds(kind);
  if (ageMinutes <= thresholds.fresh) {
    return { label: "fresh", ageMinutes };
  }
  if (ageMinutes <= thresholds.aging) {
    return { label: "aging", ageMinutes };
  }
  return { label: "stale", ageMinutes };
}

function deriveContextStrategy(state, options = {}) {
  const now = options.now ?? new Date();
  const snapshot = state.workspaceSnapshot ?? {};
  const rankedSources = [...state.contextSources]
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .map((source, index) => {
      const freshness = deriveContextFreshness(source.kind, snapshot.capturedAt, now);
      return {
        ...source,
        rank: index + 1,
        tier: deriveContextTier(source),
        freshness: freshness.label,
        ageMinutes: freshness.ageMinutes,
        artifactCount: (source.artifacts ?? []).length
      };
    });

  const blindSpots = [];
  if (!snapshot.activeEditor) {
    blindSpots.push("No active editor is captured, so immediate intent is less explicit.");
  }
  if ((snapshot.agentFiles ?? []).length === 0) {
    blindSpots.push("No AGENTS.md instructions are currently available.");
  }
  if (!snapshot.gitDetected) {
    blindSpots.push("Git metadata is missing, so repo intent is weaker.");
  }
  if (!snapshot.generatedSkillDraft) {
    blindSpots.push("No reusable workflow draft is available yet.");
  }

  const staleCount = rankedSources.filter((item) => item.freshness === "stale").length;
  const primaryCount = rankedSources.filter((item) => item.tier === "primary").length;
  const supportingCount = rankedSources.filter((item) => item.tier === "supporting").length;
  const fallbackCount = rankedSources.filter((item) => item.tier === "fallback").length;

  return {
    capturedAt: snapshot.capturedAt ?? null,
    ageMinutes: getAgeMinutes(snapshot.capturedAt, now),
    staleCount,
    primaryCount,
    supportingCount,
    fallbackCount,
    blindSpots,
    topSources: rankedSources.slice(0, 3),
    rankedSources,
    summary:
      rankedSources.length === 0
        ? "No context sources are available yet."
        : `Use ${rankedSources
            .slice(0, 2)
            .map((item) => item.label)
            .join(" and ")} first, then fall back to lower-trust sources only if the local signals are insufficient.`
  };
}

function deriveApprovalSummary(state) {
  const milestonesById = new Map((state.taskArtifacts.milestones ?? []).map((item) => [item.id, item.title]));
  const orderedStatuses = ["blocked", "pending", "in_progress", "completed"];
  const groups = orderedStatuses.map((status) => {
    const items = state.approvals.filter((item) => item.status === status);
    return {
      status,
      count: items.length,
      scopes: items.map((item) => item.scope),
      milestones: items.map((item) => milestonesById.get(item.milestoneId) ?? "Unmapped milestone"),
      items
    };
  });

  const blockedCount = groups.find((group) => group.status === "blocked")?.count ?? 0;
  const pendingCount = groups.find((group) => group.status === "pending")?.count ?? 0;
  const completedCount = groups.find((group) => group.status === "completed")?.count ?? 0;
  const approvalDemand = state.subagentRuns.reduce((sum, item) => sum + (item.approvalsRequired ?? 0), 0);
  const frictionScore = blockedCount * 3 + pendingCount * 2 + approvalDemand;

  return {
    groups,
    blockedCount,
    pendingCount,
    completedCount,
    approvalDemand,
    frictionScore,
    blockedScopes: groups.find((group) => group.status === "blocked")?.scopes ?? [],
    pendingScopes: groups.find((group) => group.status === "pending")?.scopes ?? [],
    nextCheckpoint:
      blockedCount > 0
        ? `Resolve blocked approvals first: ${(groups.find((group) => group.status === "blocked")?.scopes ?? []).join(", ")}`
        : pendingCount > 0
          ? `Batch the pending approvals before the next milestone handoff.`
          : "Approval queue is clear."
  };
}

function derivePreflightBrief(state, options = {}) {
  const now = options.now ?? new Date();
  const context = deriveContextStrategy(state, { now });
  const approvals = deriveApprovalSummary(state);
  const currentMilestone =
    state.taskArtifacts.milestones.find((item) => item.status === "in_progress") ??
    state.taskArtifacts.milestones.find((item) => item.status === "pending") ??
    null;
  const currentGateIds = currentMilestone?.verificationGateIds ?? [];
  const currentGates = state.verificationGates.filter((gate) => currentGateIds.includes(gate.id));
  const incompleteCurrentGates = currentGates.filter((gate) => gate.status !== "completed");
  const blockers = [];
  const warnings = [];
  const nextActions = [];

  if (approvals.blockedCount > 0) {
    blockers.push(
      `${approvals.blockedCount} blocked approval${approvals.blockedCount === 1 ? "" : "s"} must be resolved before autonomous execution.`
    );
    nextActions.push(`Resolve blocked approvals: ${approvals.blockedScopes.join(", ")}`);
  }

  if (context.staleCount > 0) {
    warnings.push(
      `${context.staleCount} context source${context.staleCount === 1 ? "" : "s"} are stale and should be refreshed before risky edits.`
    );
    nextActions.push("Refresh workspace context.");
  }

  if (incompleteCurrentGates.length > 0) {
    warnings.push(
      `${incompleteCurrentGates.length} verification gate${incompleteCurrentGates.length === 1 ? "" : "s"} remain open for the current milestone.`
    );
    nextActions.push(`Run verification for ${incompleteCurrentGates.map((gate) => gate.label).join(", ")}`);
  }

  if (approvals.pendingCount > 0) {
    warnings.push(
      `${approvals.pendingCount} pending approval${approvals.pendingCount === 1 ? "" : "s"} should be batched to reduce prompt churn.`
    );
    nextActions.push(`Batch pending approvals: ${approvals.pendingScopes.join(", ")}`);
  }

  if (!currentMilestone) {
    warnings.push("No active milestone is selected, so progress tracking is weak.");
  }

  const riskScore = approvals.frictionScore + incompleteCurrentGates.length * 2 + context.staleCount * 2;
  const status = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "needs_review" : "ready";
  const riskLevel = riskScore >= 8 ? "high" : riskScore >= 4 ? "medium" : "low";

  return {
    status,
    riskLevel,
    blockers,
    warnings,
    nextActions: [...new Set(nextActions)].slice(0, 4),
    currentMilestoneTitle: currentMilestone?.title ?? "No active milestone",
    currentGateBacklog: incompleteCurrentGates.length,
    staleContextCount: context.staleCount,
    approvalFrictionScore: approvals.frictionScore,
    summary:
      status === "ready"
        ? "Local context, approvals, and verification signals are aligned well enough to proceed."
        : status === "blocked"
          ? "Autonomous execution is blocked until the approval queue is cleared."
          : "The run can continue, but context freshness or verification gaps should be reviewed first."
  };
}

function summarizeState(state) {
  const milestoneCount = state.taskArtifacts.milestones.length;
  const completedMilestones = state.taskArtifacts.milestones.filter((item) => item.status === "completed").length;
  const completedVerification = state.verificationGates.filter((item) => item.status === "completed").length;
  const blockedApprovals = state.approvals.filter((item) => item.status === "blocked" || item.status === "pending").length;
  const approvalSummary = deriveApprovalSummary(state);
  const contextStrategy = deriveContextStrategy(state);
  const preflight = derivePreflightBrief(state);
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
    staleContextCount: contextStrategy.staleCount,
    approvalFrictionScore: approvalSummary.frictionScore,
    preflightStatus: preflight.status,
    riskLevel: preflight.riskLevel,
    activeSubagents: state.subagentRuns.filter((item) => item.state === "in_progress").length,
    estimatedCostUsd: Math.round(
      state.subagentRuns.reduce((sum, item) => sum + item.costUsd, 0) * 100
    ) / 100
  };
}

function derivePriorityQueue(state) {
  const tasks = [];
  const contextStrategy = deriveContextStrategy(state);

  if (contextStrategy.staleCount > 0) {
    tasks.push({
      kind: "context",
      title: "Refresh workspace context before the next risky edit",
      weight: 4
    });
  }

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
  const approvalSummary = deriveApprovalSummary(state);
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

## Approval posture

- Approval friction score: ${approvalSummary.frictionScore}
- Next checkpoint: ${approvalSummary.nextCheckpoint}
`;
}

module.exports = {
  summarizeState,
  derivePriorityQueue,
  deriveContextStrategy,
  deriveApprovalSummary,
  derivePreflightBrief,
  createSkillDraft
};
