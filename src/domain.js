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
  if (!snapshot.projectContext?.summary) {
    blindSpots.push("No project summary was derived from AGENTS.md, README.md, or package.json.");
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

function deriveVerificationSummary(state) {
  const milestonesById = new Map((state.taskArtifacts.milestones ?? []).map((item) => [item.id, item.title]));
  const currentMilestone =
    state.taskArtifacts.milestones.find((item) => item.status === "in_progress") ??
    state.taskArtifacts.milestones.find((item) => item.status === "pending") ??
    null;
  const currentMilestoneId = currentMilestone?.id ?? null;
  const gates = (state.verificationGates ?? []).map((gate) => ({
    ...gate,
    milestoneTitle: milestonesById.get(gate.milestoneId) ?? "Unmapped milestone"
  }));
  const openGates = gates
    .filter((gate) => gate.status !== "completed")
    .sort((left, right) => {
      const leftPriority = left.milestoneId === currentMilestoneId ? 1 : 0;
      const rightPriority = right.milestoneId === currentMilestoneId ? 1 : 0;
      return rightPriority - leftPriority || right.label.localeCompare(left.label);
    });
  const completedGates = gates.filter((gate) => gate.status === "completed");
  const missingEvidenceGates = completedGates.filter((gate) => !String(gate.evidence ?? "").trim());
  const nextGate = openGates[0] ?? null;

  return {
    totalCount: gates.length,
    openCount: openGates.length,
    completedCount: completedGates.length,
    reviewedCount: completedGates.filter((gate) => Boolean(gate.lastReviewedAt)).length,
    missingEvidenceCount: missingEvidenceGates.length,
    currentMilestoneOpenCount: openGates.filter((gate) => gate.milestoneId === currentMilestoneId).length,
    nextGate,
    openGates,
    missingEvidenceGates,
    summary:
      openGates.length === 0
        ? "All verification gates are complete."
        : `Focus on ${nextGate?.label ?? "the next verification gate"} before advancing the current milestone.`
  };
}

function derivePreflightBrief(state, options = {}) {
  const now = options.now ?? new Date();
  const context = deriveContextStrategy(state, { now });
  const approvals = deriveApprovalSummary(state);
  const verification = deriveVerificationSummary(state);
  const allMilestonesCompleted =
    state.taskArtifacts.milestones.length > 0 &&
    state.taskArtifacts.milestones.every((item) => item.status === "completed");
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

  if (!currentMilestone && !allMilestonesCompleted) {
    warnings.push("No active milestone is selected, so progress tracking is weak.");
  }
  if (verification.missingEvidenceCount > 0) {
    warnings.push(
      `${verification.missingEvidenceCount} completed verification gate${
        verification.missingEvidenceCount === 1 ? "" : "s"
      } are missing evidence.`
    );
  }

  const riskScore =
    approvals.frictionScore +
    incompleteCurrentGates.length * 2 +
    context.staleCount * 2 +
    verification.missingEvidenceCount;
  const status = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "needs_review" : "ready";
  const riskLevel = riskScore >= 8 ? "high" : riskScore >= 4 ? "medium" : "low";

  return {
    status,
    riskLevel,
    blockers,
    warnings,
    nextActions: [...new Set(nextActions)].slice(0, 4),
    currentMilestoneTitle: currentMilestone?.title ?? (allMilestonesCompleted ? "All milestones completed" : "No active milestone"),
    currentGateBacklog: incompleteCurrentGates.length,
    staleContextCount: context.staleCount,
    approvalFrictionScore: approvals.frictionScore,
    summary:
      allMilestonesCompleted && status === "ready"
        ? "The research bundle is complete, verified, and ready to share or reuse."
        : status === "ready"
        ? "Local context, approvals, and verification signals are aligned well enough to proceed."
        : status === "blocked"
          ? "Autonomous execution is blocked until the approval queue is cleared."
          : "The run can continue, but context freshness or verification gaps should be reviewed first."
  };
}

function deriveResumeBrief(state) {
  const latestNote = state.statusNotes?.[0] ?? null;
  const allMilestonesCompleted =
    state.taskArtifacts.milestones.length > 0 &&
    state.taskArtifacts.milestones.every((item) => item.status === "completed");
  const currentMilestone =
    state.taskArtifacts.milestones.find((item) => item.status === "in_progress") ??
    state.taskArtifacts.milestones.find((item) => item.status === "pending") ??
    null;
  const currentGateIds = currentMilestone?.verificationGateIds ?? [];
  const currentGates = state.verificationGates.filter((gate) => currentGateIds.includes(gate.id));
  const nextGate = currentGates.find((gate) => gate.status !== "completed") ?? null;
  const nextApproval =
    state.approvals.find(
      (item) => item.milestoneId === currentMilestone?.id && item.status !== "completed"
    ) ?? state.approvals.find((item) => item.status !== "completed") ?? null;
  const continuity = state.taskArtifacts.continuity ?? {};
  const documents = state.taskArtifacts.documents ?? {};
  const documentsToOpen = [documents.spec, documents.plan, documents.implement, documents.statusLog].filter(Boolean);

  let nextCheckpoint = "Review the current run state before continuing.";
  if (allMilestonesCompleted && !nextApproval && !nextGate) {
    nextCheckpoint = "Share the generated workflow pack or export a final snapshot.";
  } else if (nextApproval) {
    nextCheckpoint = `Resolve approval: ${nextApproval.scope}`;
  } else if (nextGate) {
    nextCheckpoint = `Run verification: ${nextGate.label}`;
  } else if (currentMilestone) {
    nextCheckpoint = `Advance milestone: ${currentMilestone.title}`;
  }

  return {
    status: continuity.resumable === false ? "non_resumable" : "resumable",
    continuityMode: continuity.mode ?? "local",
    threadId: continuity.threadId ?? "local-only",
    resumable: continuity.resumable !== false,
    currentMilestoneTitle: currentMilestone?.title ?? (allMilestonesCompleted ? "All milestones completed" : "No active milestone"),
    nextCheckpoint,
    lastUpdatedAt: state.updatedAt ?? state.generatedAt ?? null,
    latestNote: latestNote?.text ?? "No status notes captured yet.",
    documentsToOpen,
    summary:
      continuity.resumable === false
        ? "The current task package is not marked resumable."
        : allMilestonesCompleted
          ? "The research bundle is complete. Reopen the artifacts only when you need to share the workflow pack or reuse the runbook."
        : `Resume with ${currentMilestone?.title ?? "the next queued milestone"} and use the persisted runbook/documents to restore context quickly.`
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
  const verificationSummary = deriveVerificationSummary(state);
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
    missingVerificationEvidenceCount: verificationSummary.missingEvidenceCount,
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

function createSkillBundle(state, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const approvalSummary = deriveApprovalSummary(state);
  const verificationSummary = deriveVerificationSummary(state);
  const resume = deriveResumeBrief(state);
  const skillDraft = createSkillDraft(state);

  const manifest = {
    schemaVersion: 1,
    generatedAt,
    name: "codex-agent-runbook",
    workspaceName: state.workspaceName,
    objective: state.taskArtifacts.objective,
    continuity: state.taskArtifacts.continuity,
    documents: state.taskArtifacts.documents,
    milestones: state.taskArtifacts.milestones.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status
    })),
    verification: {
      summary: verificationSummary.summary,
      nextGate: verificationSummary.nextGate?.label ?? null,
      openCount: verificationSummary.openCount,
      missingEvidenceCount: verificationSummary.missingEvidenceCount,
      gates: state.verificationGates.map((gate) => ({
        id: gate.id,
        label: gate.label,
        status: gate.status,
        evidence: gate.evidence ?? "",
        repairPolicy: gate.repairPolicy,
        milestoneId: gate.milestoneId
      }))
    },
    approvals: {
      frictionScore: approvalSummary.frictionScore,
      nextCheckpoint: approvalSummary.nextCheckpoint,
      groups: approvalSummary.groups
        .filter((group) => group.count > 0)
        .map((group) => ({
          status: group.status,
          count: group.count,
          scopes: group.scopes
        }))
    }
  };

  const readme = `# Codex Agent Workflow Pack

Generated: ${generatedAt}

This bundle captures the current reusable Codex workflow for durable multi-step work in VS Code.

## Included files

- \`SKILL.md\`: runnable skill draft
- \`workflow-pack.json\`: machine-readable workflow metadata
- \`README.md\`: human-readable summary for handoff or sharing

## Continuation

- Mode: ${resume.continuityMode}
- Thread: ${resume.threadId}
- Current milestone: ${resume.currentMilestoneTitle}
- Next checkpoint: ${resume.nextCheckpoint}

## Verification

- Summary: ${verificationSummary.summary}
- Open gates: ${verificationSummary.openCount}
- Missing evidence: ${verificationSummary.missingEvidenceCount}

## Approval posture

- Friction score: ${approvalSummary.frictionScore}
- Next checkpoint: ${approvalSummary.nextCheckpoint}
`;

  return {
    skillDraft,
    manifest,
    readme
  };
}

module.exports = {
  summarizeState,
  derivePriorityQueue,
  deriveContextStrategy,
  deriveApprovalSummary,
  deriveVerificationSummary,
  derivePreflightBrief,
  deriveResumeBrief,
  createSkillDraft,
  createSkillBundle
};
