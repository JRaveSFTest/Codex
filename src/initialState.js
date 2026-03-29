"use strict";

function createInitialState(workspaceName, projectContext = {}, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const displayName = projectContext.displayName || workspaceName || "Workspace";
  const guidanceFiles = (projectContext.guidanceFiles ?? []).slice(0, 6);
  const linkedDocs = (projectContext.linkedDocs ?? []).slice(0, 6);
  const priorities = (projectContext.priorities ?? []).slice(0, 6);
  const summary =
    projectContext.summary ||
    (workspaceName === "No Workspace"
      ? "Open a workspace folder to derive repo-specific context."
      : `Use repo-local instructions and source files to guide work in ${displayName}.`);

  const constraints =
    priorities.length > 0
      ? priorities.slice(0, 4)
      : workspaceName === "No Workspace"
        ? ["Open a workspace folder before seeding or updating research artifacts."]
        : [
            "Ground plans and edits in the active repo's own instructions, code, and visible files.",
            "Refresh workspace context after switching focus or changing key files.",
            "Record verification evidence and handoff notes inside the current workspace bundle."
          ];

  const deliverables = [
    "Project-aware spec, plan, status, and workspace-context artifacts inside `.codex-research/`.",
    guidanceFiles.length > 0
      ? `Repo guidance tracked from ${guidanceFiles.join(", ")}.`
      : "Repo guidance captured from available local project files.",
    linkedDocs.length > 0
      ? `Linked handoff docs reflected in the workspace context: ${linkedDocs.map((item) => item.path).join(", ")}.`
      : "Current project focus and follow-up notes captured for later continuation.",
    "Verification notes and next checkpoints tied to the active repo."
  ];

  return {
    version: 2,
    workspaceName: displayName,
    generatedAt,
    updatedAt: generatedAt,
    taskArtifacts: {
      id: "task-main",
      title: workspaceName === "No Workspace" ? "Open a workspace to start" : `${displayName} workspace bundle`,
      objective:
        workspaceName === "No Workspace"
          ? "Open a repository so Codex Research can derive project-specific context instead of using generic placeholders."
          : `Use the repo's own context to guide work in ${displayName}. ${summary}`,
      constraints,
      deliverables,
      milestones: createMilestones(guidanceFiles, linkedDocs, priorities),
      continuity: {
        mode: workspaceName === "No Workspace" ? "detached" : "local",
        threadId: `workspace-${slugify(displayName || workspaceName || "workspace")}`,
        resumable: workspaceName !== "No Workspace"
      }
    },
    verificationGates: createVerificationGates(guidanceFiles, linkedDocs),
    approvals: [],
    subagentRuns: [],
    recommendations: createRecommendations(guidanceFiles, linkedDocs, priorities, workspaceName === "No Workspace"),
    statusNotes: [
      {
        id: "note-seed",
        timestamp: generatedAt,
        author: "system",
        kind: "seed",
        text:
          workspaceName === "No Workspace"
            ? "Initialized a detached workspace bundle. Open a repo to capture project context."
            : `Initialized the workspace bundle from repo context for ${displayName}.`
      }
    ],
    workspaceSnapshot: {
      capturedAt: generatedAt,
      activeEditor: null,
      selection: null,
      visibleEditors: [],
      agentFiles: [],
      repoSample: [],
      researchArtifacts: [],
      generatedSkillDraft: false,
      gitDetected: false,
      projectContext
    }
  };
}

function createMilestones(guidanceFiles, linkedDocs, priorities) {
  const linkedDocPaths = linkedDocs.map((item) => item.path).slice(0, 3);
  const guidanceSummary = guidanceFiles.length > 0 ? guidanceFiles.join(", ") : "README.md, package.json, and current repo files";
  const prioritySummary = priorities.length > 0 ? priorities.slice(0, 3).join("; ") : "the repo's visible goals and constraints";

  return [
    {
      id: "m1",
      title: "Review repo guidance",
      status: "in_progress",
      acceptanceCriteria: [
        `Review primary repo guidance: ${guidanceSummary}.`,
        linkedDocPaths.length > 0
          ? `Open linked handoff docs: ${linkedDocPaths.join(", ")}.`
          : "Capture the strongest local context signals even if no linked docs are declared.",
        "Refresh workspace context so the bundle reflects the current project state."
      ],
      verificationGateIds: ["gate-context"]
    },
    {
      id: "m2",
      title: "Define the active task plan",
      status: "pending",
      acceptanceCriteria: [
        "Translate repo guidance into the current plan and status documents.",
        `Capture the current priorities or constraints: ${prioritySummary}.`,
        "Make the next implementation checkpoint explicit before editing."
      ],
      verificationGateIds: ["gate-plan"]
    },
    {
      id: "m3",
      title: "Implement and verify the requested change",
      status: "pending",
      acceptanceCriteria: [
        "Keep edits scoped to the active repo task rather than the extension's original prototype data.",
        "Run repo-appropriate verification and record concrete evidence.",
        "Update status when verification or scope changes."
      ],
      verificationGateIds: ["gate-verify"]
    },
    {
      id: "m4",
      title: "Capture handoff and continuity",
      status: "pending",
      acceptanceCriteria: [
        "Leave spec, plan, status, and implementation runbook aligned with the current repo.",
        "Record remaining risks, follow-ups, and next checkpoints.",
        "Preserve enough context for another agent or a later session to resume cleanly."
      ],
      verificationGateIds: ["gate-handoff"]
    }
  ];
}

function createVerificationGates(guidanceFiles, linkedDocs) {
  const linkedDocPaths = linkedDocs.map((item) => item.path).slice(0, 3);
  const contextCommand =
    guidanceFiles.length > 0
      ? `Review ${guidanceFiles.join(", ")}${linkedDocPaths.length > 0 ? ` and ${linkedDocPaths.join(", ")}` : ""}`
      : "Review README.md, package.json, and the current repo structure";

  return [
    {
      id: "gate-context",
      label: "Repo context review",
      type: "context",
      status: "pending",
      command: contextCommand,
      repairPolicy: "Refresh workspace context if the repo guidance or active files change.",
      milestoneId: "m1"
    },
    {
      id: "gate-plan",
      label: "Plan alignment check",
      type: "planning",
      status: "pending",
      command: "Compare plan.md and status.md against the repo's declared priorities",
      repairPolicy: "Update the plan before implementation if the workspace intent is still ambiguous.",
      milestoneId: "m2"
    },
    {
      id: "gate-verify",
      label: "Repo-specific verification",
      type: "verification",
      status: "pending",
      command: "Run the repo's relevant tests, checks, or manual verification steps",
      repairPolicy: "Do not mark implementation complete without evidence tied to this repo.",
      milestoneId: "m3"
    },
    {
      id: "gate-handoff",
      label: "Handoff completeness",
      type: "handoff",
      status: "pending",
      command: "Confirm status.md, implement.md, and workspace-context.md reflect the latest repo state",
      repairPolicy: "Capture next steps and residual risks before ending the run.",
      milestoneId: "m4"
    }
  ];
}

function createRecommendations(guidanceFiles, linkedDocs, priorities, isDetachedWorkspace) {
  if (isDetachedWorkspace) {
    return [
      "Open a repo folder before seeding or refreshing the research bundle.",
      "Once a workspace is open, reseed the bundle so project files replace the generic placeholders.",
      "Use the workspace bundle to keep plan, status, and verification notes in sync."
    ];
  }

  const recommendations = [];

  if (guidanceFiles.length > 0) {
    recommendations.push(`Start with ${guidanceFiles.join(", ")} before making larger changes.`);
  } else {
    recommendations.push("Start with README.md, package.json, and the visible repo structure if no AGENTS.md is present.");
  }
  if (linkedDocs.length > 0) {
    recommendations.push(`Treat linked handoff docs as part of the active project context: ${linkedDocs.map((item) => item.path).join(", ")}.`);
  }
  if (priorities.length > 0) {
    recommendations.push(`Preserve the repo's declared priorities: ${priorities.slice(0, 3).join("; ")}.`);
  }
  recommendations.push("Refresh workspace context after switching focus or updating key files.");
  recommendations.push("Record verification evidence and next checkpoints in the current workspace bundle.");

  return recommendations;
}

function slugify(value) {
  return String(value ?? "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

module.exports = {
  createInitialState
};
