"use strict";

const STATUS_VALUES = ["pending", "in_progress", "blocked", "completed"];

function normalizeState(inputState) {
  const state = clone(inputState);
  const generatedAt = state.generatedAt ?? new Date().toISOString();
  const workspaceName = String(state.workspaceName ?? "Workspace");

  state.version = state.version ?? 2;
  state.workspaceName = workspaceName;
  state.generatedAt = generatedAt;
  state.updatedAt = state.updatedAt ?? generatedAt;
  state.taskArtifacts = {
    id: "task-main",
    title: `${workspaceName} workspace bundle`,
    objective: `Use repo-local context to guide work in ${workspaceName}.`,
    constraints: [],
    deliverables: [],
    milestones: [],
    continuity: {
      mode: "local",
      threadId: `workspace-${slugify(workspaceName)}`,
      resumable: true
    },
    ...(state.taskArtifacts ?? {})
  };
  state.taskArtifacts.constraints = Array.isArray(state.taskArtifacts.constraints) ? state.taskArtifacts.constraints : [];
  state.taskArtifacts.deliverables = Array.isArray(state.taskArtifacts.deliverables) ? state.taskArtifacts.deliverables : [];
  state.taskArtifacts.milestones = Array.isArray(state.taskArtifacts.milestones) ? state.taskArtifacts.milestones : [];
  state.taskArtifacts.continuity = {
    mode: "local",
    threadId: `workspace-${slugify(workspaceName)}`,
    resumable: true,
    ...(state.taskArtifacts.continuity ?? {})
  };
  state.taskArtifacts.documents = {
    spec: ".codex-research/spec.md",
    plan: ".codex-research/plan.md",
    statusLog: ".codex-research/status.md",
    context: ".codex-research/workspace-context.md",
    implement: ".codex-research/implement.md",
    ...(state.taskArtifacts.documents ?? {})
  };
  state.statusNotes = Array.isArray(state.statusNotes) ? state.statusNotes : [];
  state.subagentRuns = Array.isArray(state.subagentRuns) ? state.subagentRuns : [];
  state.recommendations = Array.isArray(state.recommendations) ? state.recommendations : [];
  state.contextSources = Array.isArray(state.contextSources) ? state.contextSources : [];
  state.verificationGates = Array.isArray(state.verificationGates)
    ? state.verificationGates.map((gate) => ({
        lastReviewedAt: null,
        lastReviewedBy: null,
        evidence: "",
        ...(gate ?? {})
      }))
    : [];
  state.approvals = Array.isArray(state.approvals)
    ? state.approvals.map((approval) => ({
        lastReviewedAt: null,
        lastReviewedBy: null,
        evidence: "",
        resolution: null,
        ...(approval ?? {})
      }))
    : [];
  state.workspaceSnapshot = {
    capturedAt: generatedAt,
    activeEditor: null,
    selection: null,
    visibleEditors: [],
    agentFiles: [],
    repoSample: [],
    researchArtifacts: [],
    generatedSkillDraft: false,
    gitDetected: false,
    projectContext: {
      displayName: workspaceName,
      packageName: null,
      packageDescription: null,
      readmeSummary: null,
      summary: null,
      guidanceFiles: [],
      priorities: [],
      agentContexts: [],
      linkedDocs: []
    },
    ...(state.workspaceSnapshot ?? {})
  };

  if (state.statusNotes.length === 0) {
    state.statusNotes.push({
      id: "note-seed",
      timestamp: generatedAt,
      author: "system",
      kind: "seed",
      text: "Initialized the workspace bundle from repo context."
    });
  }

  state.taskArtifacts.status = deriveTaskStatus(state);
  return state;
}

function appendStatusNote(inputState, note, author = "user", kind = "note") {
  const state = normalizeState(inputState);
  const text = String(note ?? "").trim();
  if (!text) {
    throw new Error("Status note cannot be empty.");
  }

  state.statusNotes.unshift({
    id: createId("note"),
    timestamp: new Date().toISOString(),
    author,
    kind,
    text
  });
  state.updatedAt = new Date().toISOString();
  return state;
}

function setMilestoneStatus(inputState, milestoneId, status) {
  return updateItemStatus(inputState, milestoneId, status, (state) => state.taskArtifacts.milestones, "status");
}

function setVerificationGateStatus(inputState, gateId, status) {
  return updateItemStatus(inputState, gateId, status, (state) => state.verificationGates, "status");
}

function recordVerificationReview(inputState, gateId, review) {
  const state = normalizeState(inputState);
  const gate = state.verificationGates.find((item) => item.id === gateId);
  if (!gate) {
    throw new Error(`Unknown verification gate: ${gateId}`);
  }

  const status = String(review?.status ?? "").trim();
  const evidence = String(review?.evidence ?? "").trim();
  validateStatus(status);

  if (!evidence) {
    throw new Error("Verification evidence cannot be empty.");
  }

  const reviewedAt = new Date().toISOString();
  gate.status = status;
  gate.evidence = evidence;
  gate.lastReviewedAt = reviewedAt;
  gate.lastReviewedBy = String(review?.reviewer ?? "user");
  state.taskArtifacts.status = deriveTaskStatus(state);
  state.updatedAt = reviewedAt;
  return state;
}

function setApprovalStatus(inputState, approvalId, status) {
  return updateItemStatus(inputState, approvalId, status, (state) => state.approvals, "status");
}

function recordApprovalReview(inputState, approvalId, review) {
  const state = normalizeState(inputState);
  const approval = state.approvals.find((item) => item.id === approvalId);
  if (!approval) {
    throw new Error(`Unknown approval: ${approvalId}`);
  }

  const status = String(review?.status ?? "").trim();
  const evidence = String(review?.evidence ?? "").trim();
  validateStatus(status);

  if (!evidence) {
    throw new Error("Approval evidence cannot be empty.");
  }

  const reviewedAt = new Date().toISOString();
  approval.status = status;
  approval.evidence = evidence;
  approval.lastReviewedAt = reviewedAt;
  approval.lastReviewedBy = String(review?.reviewer ?? "user");
  approval.resolution =
    String(review?.resolution ?? "").trim() ||
    (status === "completed" ? "approved" : status === "blocked" ? "blocked" : "pending");
  state.taskArtifacts.status = deriveTaskStatus(state);
  state.updatedAt = reviewedAt;
  return state;
}

function setSubagentStatus(inputState, agentId, status) {
  return updateItemStatus(inputState, agentId, status, (state) => state.subagentRuns, "state");
}

function applyWorkspaceSnapshot(inputState, snapshot) {
  const state = normalizeState(inputState);
  state.workspaceSnapshot = {
    ...state.workspaceSnapshot,
    ...snapshot
  };
  state.contextSources = buildContextSources(snapshot, state.contextSources ?? []);
  return state;
}

function buildContextSources(snapshot, previousSources) {
  const previousById = new Map((previousSources ?? []).map((item) => [item.id, item]));
  const projectContext = snapshot.projectContext ?? {};
  const activeEditorLabel = snapshot.activeEditor
    ? `Editor focus: ${snapshot.activeEditor}`
    : "Open files and active selection";
  const selectionLabel = snapshot.selection ? `Selection ${snapshot.selection}` : "No active selection";
  const guidanceArtifacts =
    projectContext.agentContexts?.length > 0
      ? projectContext.agentContexts.map((item) => (item.summary ? `${item.path}: ${item.summary}` : item.path))
      : [];
  const linkedArtifacts =
    projectContext.linkedDocs?.length > 0
      ? projectContext.linkedDocs.map((item) => (item.summary ? `${item.path}: ${item.summary}` : item.path))
      : [];
  const repoArtifacts =
    snapshot.repoSample.length > 0
      ? [
          ...(projectContext.summary ? [`Project summary: ${projectContext.summary}`] : []),
          ...snapshot.repoSample
        ]
      : projectContext.summary
        ? [`Project summary: ${projectContext.summary}`]
        : ["No workspace file sample captured"];
  const agentArtifacts =
    guidanceArtifacts.length > 0 || linkedArtifacts.length > 0
      ? [...guidanceArtifacts, ...linkedArtifacts].slice(0, 8)
      : snapshot.agentFiles.length > 0
        ? snapshot.agentFiles
        : ["No AGENTS.md found"];
  const skillArtifacts = snapshot.generatedSkillDraft
    ? ["generated-skill/SKILL.md"]
    : ["No generated skill draft yet"];
  const researchArtifacts =
    snapshot.researchArtifacts.length > 0 ? snapshot.researchArtifacts : ["No research artifacts found"];

  return [
    {
      id: "ctx-editor",
      kind: "editor",
      label: activeEditorLabel,
      score: snapshot.activeEditor ? 9.8 : 6.8,
      rationale: snapshot.activeEditor
        ? "Current editor focus and visible files are the strongest local signal for the next action."
        : "Visible editors still help anchor the next action, even without an active file.",
      pinned: true,
      artifacts: [selectionLabel, ...snapshot.visibleEditors.slice(0, 5)]
    },
    {
      id: "ctx-agents",
      kind: "agents",
      label:
        snapshot.agentFiles.length > 0 || guidanceArtifacts.length > 0
          ? "Repo instructions and linked docs"
          : "AGENTS instructions missing",
      score: snapshot.agentFiles.length > 0 || guidanceArtifacts.length > 0 ? 9.2 : 4.4,
      rationale:
        snapshot.agentFiles.length > 0 || guidanceArtifacts.length > 0
          ? "Repo-local operating guidance was discovered and should shape planning before implementation."
          : "No AGENTS.md was found, so repo-specific agent guidance is currently weak.",
      pinned: snapshot.agentFiles.length > 0 || guidanceArtifacts.length > 0,
      artifacts: agentArtifacts
    },
    {
      id: "ctx-repo",
      kind: "repo",
      label: projectContext.summary
        ? "Repo structure and declared project context"
        : snapshot.gitDetected
          ? "Repo structure and git-aware sample"
          : "Workspace structure sample",
      score: snapshot.repoSample.length > 0 ? 8.8 : 6.2,
      rationale: projectContext.summary
        ? "The repo declares product or workflow intent directly through local files, reducing the chance of carrying over stale seed data."
        : snapshot.gitDetected
          ? "Workspace structure and git presence reduce wrong-file edits and improve navigation."
          : "A sampled workspace structure is available, but git metadata is not present.",
      pinned: false,
      artifacts: repoArtifacts
    },
    {
      id: "ctx-skills",
      kind: "skills",
      label: snapshot.generatedSkillDraft ? "Generated workflow skill draft" : "Skill draft availability",
      score: snapshot.generatedSkillDraft ? 8.5 : 5.7,
      rationale: snapshot.generatedSkillDraft
        ? "A reusable workflow draft exists and can guide repeated tasks."
        : "Reusable workflow guidance is still mostly implicit.",
      pinned: false,
      artifacts: skillArtifacts
    },
    {
      id: "ctx-mcp",
      kind: "mcp",
      label: previousById.get("ctx-mcp")?.label ?? "MCP and connectors",
      score: previousById.get("ctx-mcp")?.score ?? 7.9,
      rationale:
        previousById.get("ctx-mcp")?.rationale ??
        "External connectors are still represented as research placeholders until live telemetry is added.",
      pinned: false,
      artifacts: previousById.get("ctx-mcp")?.artifacts ?? ["No live MCP capture yet"]
    },
    {
      id: "ctx-web",
      kind: "web",
      label: previousById.get("ctx-web")?.label ?? "Cached web research",
      score: previousById.get("ctx-web")?.score ?? 6.4,
      rationale:
        previousById.get("ctx-web")?.rationale ??
        "Volatile external context remains a lower-trust fallback until live capture is wired in.",
      pinned: false,
      artifacts: previousById.get("ctx-web")?.artifacts ?? researchArtifacts
    }
  ];
}

function deriveTaskStatus(state) {
  const milestones = state.taskArtifacts?.milestones ?? [];
  if (milestones.length === 0) {
    return state.taskArtifacts?.status ?? "pending";
  }
  if (milestones.every((item) => item.status === "completed")) {
    return "completed";
  }
  if (milestones.some((item) => item.status === "blocked")) {
    return "blocked";
  }
  if (milestones.some((item) => item.status === "in_progress")) {
    return "in_progress";
  }
  return "pending";
}

function updateItemStatus(inputState, targetId, status, collectionSelector, field) {
  validateStatus(status);
  const state = normalizeState(inputState);
  const items = collectionSelector(state);
  const target = items.find((item) => item.id === targetId);

  if (!target) {
    throw new Error(`Unknown state item: ${targetId}`);
  }

  target[field] = status;
  state.taskArtifacts.status = deriveTaskStatus(state);
  state.updatedAt = new Date().toISOString();
  return state;
}

function validateStatus(status) {
  if (!STATUS_VALUES.includes(status)) {
    throw new Error(`Unsupported status: ${status}`);
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value ?? "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

module.exports = {
  STATUS_VALUES,
  normalizeState,
  appendStatusNote,
  setMilestoneStatus,
  setVerificationGateStatus,
  recordVerificationReview,
  setApprovalStatus,
  recordApprovalReview,
  setSubagentStatus,
  applyWorkspaceSnapshot,
  buildContextSources,
  deriveTaskStatus
};
