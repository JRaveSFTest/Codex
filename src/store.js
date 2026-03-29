"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createSampleState } = require("./sampleState");
const {
  summarizeState,
  derivePriorityQueue,
  deriveContextStrategy,
  deriveApprovalSummary,
  derivePreflightBrief,
  createSkillDraft
} = require("./domain");
const {
  normalizeState,
  appendStatusNote,
  setMilestoneStatus,
  setVerificationGateStatus,
  setApprovalStatus,
  setSubagentStatus,
  applyWorkspaceSnapshot
} = require("./stateModel");

const RESEARCH_DIR = ".codex-research";
const STATE_FILE = "state.json";
const SKIP_DIRECTORIES = new Set([".git", "node_modules", ".codex-research", ".vscode-test"]);

function getWorkspaceRoot() {
  const vscode = require("vscode");
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

function getStatePath(rootPath) {
  return path.join(rootPath, RESEARCH_DIR, STATE_FILE);
}

function getResearchDir(rootPath) {
  return path.join(rootPath, RESEARCH_DIR);
}

function toRelativePath(rootPath, targetPath) {
  return path.relative(rootPath, targetPath).split(path.sep).join("/");
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPersistedState(rootPath) {
  const statePath = getStatePath(rootPath);
  if (!(await fileExists(statePath))) {
    return normalizeState(createSampleState(path.basename(rootPath)));
  }

  const content = await fs.readFile(statePath, "utf8");
  return normalizeState(JSON.parse(content));
}

async function loadState() {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    return normalizeState(createSampleState("No Workspace"));
  }

  const baseState = await readPersistedState(rootPath);
  return hydrateState(baseState, rootPath);
}

async function getResearchStateStatus() {
  const rootPath = getWorkspaceRoot();
  const stateFilePath = rootPath ? getStatePath(rootPath) : null;
  return {
    workspaceRoot: rootPath,
    stateFilePath,
    stateFileExists: stateFilePath ? await fileExists(stateFilePath) : false
  };
}

async function hydrateState(state, rootPath) {
  const snapshot = await captureWorkspaceSnapshot(rootPath);
  return applyWorkspaceSnapshot(state, snapshot);
}

async function seedWorkspaceArtifacts() {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error("Open a workspace folder before seeding research artifacts.");
  }

  const workspaceName = path.basename(rootPath);
  const state = await hydrateState(normalizeState(createSampleState(workspaceName)), rootPath);
  await writeArtifactsForState(rootPath, state);
  return state;
}

async function saveState(state) {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error("Open a workspace folder before saving research state.");
  }

  const hydratedState = await hydrateState(normalizeState(state), rootPath);
  await writeArtifactsForState(rootPath, hydratedState);
  return hydratedState;
}

async function captureWorkspaceContext() {
  const state = await loadState();
  const nextState = appendStatusNote(state, "Refreshed live workspace context.", "system", "context");
  return saveState(nextState);
}

async function exportSnapshot(state) {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error("Open a workspace folder before exporting a snapshot.");
  }

  const reportDir = path.join(rootPath, "reports");
  const reportPath = path.join(reportDir, "codex-research-snapshot.md");
  const summary = summarizeState(state);
  const queue = derivePriorityQueue(state);
  const contextStrategy = deriveContextStrategy(state);
  const approvalSummary = deriveApprovalSummary(state);
  const preflight = derivePreflightBrief(state);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    reportPath,
    `# Codex Research Snapshot

Generated: ${new Date().toISOString()}

## Summary

- Workspace: ${state.workspaceName}
- Milestones complete: ${summary.completedMilestones}/${summary.milestoneCount}
- Verification gates complete: ${summary.completedVerification}/${summary.verificationCount}
- Active subagents: ${summary.activeSubagents}
- Pending or blocked approvals: ${summary.blockedApprovals}
- Approval friction score: ${summary.approvalFrictionScore}
- Average context score: ${summary.averageContextScore}
- Stale context sources: ${summary.staleContextCount}
- Preflight status: ${preflight.status} (${preflight.riskLevel})
- Estimated subagent cost: $${summary.estimatedCostUsd.toFixed(2)}

## Priority Queue

${queue.map((item) => `- [${item.kind}] ${item.title}`).join("\n")}

## Preflight

- Summary: ${preflight.summary}
- Current milestone: ${preflight.currentMilestoneTitle}
- Open verification gates: ${preflight.currentGateBacklog}

### Next actions

${preflight.nextActions.map((item) => `- ${item}`).join("\n")}

## Approval Groups

${approvalSummary.groups
  .filter((group) => group.count > 0)
  .map((group) => `- ${group.status}: ${group.scopes.join(", ")}`)
  .join("\n")}

## Context Strategy

- Summary: ${contextStrategy.summary}
- Blind spots: ${contextStrategy.blindSpots.length > 0 ? contextStrategy.blindSpots.join("; ") : "none"}
`,
    "utf8"
  );

  return reportPath;
}

async function promoteWorkflowToSkill(state) {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error("Open a workspace folder before generating a skill draft.");
  }

  const skillDir = path.join(rootPath, "generated-skill");
  const skillPath = path.join(skillDir, "SKILL.md");
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(skillPath, createSkillDraft(state), "utf8");
  return skillPath;
}

async function updateMilestoneState(milestoneId, status) {
  const state = await loadState();
  const milestone = state.taskArtifacts.milestones.find((item) => item.id === milestoneId);
  const nextState = appendStatusNote(
    setMilestoneStatus(state, milestoneId, status),
    `Milestone "${milestone?.title ?? milestoneId}" set to ${status}.`,
    "user",
    "milestone"
  );
  return saveState(nextState);
}

async function updateVerificationGateState(gateId, status) {
  const state = await loadState();
  const gate = state.verificationGates.find((item) => item.id === gateId);
  const nextState = appendStatusNote(
    setVerificationGateStatus(state, gateId, status),
    `Verification gate "${gate?.label ?? gateId}" set to ${status}.`,
    "user",
    "verification"
  );
  return saveState(nextState);
}

async function updateApprovalState(approvalId, status) {
  const state = await loadState();
  const approval = state.approvals.find((item) => item.id === approvalId);
  const nextState = appendStatusNote(
    setApprovalStatus(state, approvalId, status),
    `Approval "${approval?.scope ?? approvalId}" set to ${status}.`,
    "user",
    "approval"
  );
  return saveState(nextState);
}

async function updateSubagentRunState(agentId, status) {
  const state = await loadState();
  const agent = state.subagentRuns.find((item) => item.id === agentId);
  const nextState = appendStatusNote(
    setSubagentStatus(state, agentId, status),
    `Subagent "${agent?.title ?? agentId}" set to ${status}.`,
    "user",
    "subagent"
  );
  return saveState(nextState);
}

async function addUserStatusNote(note) {
  const state = await loadState();
  return saveState(appendStatusNote(state, note, "user", "note"));
}

async function openResearchDocument(kind) {
  const vscode = require("vscode");
  const state = await loadState();
  const documentMap = {
    spec: state.taskArtifacts.documents.spec,
    plan: state.taskArtifacts.documents.plan,
    status: state.taskArtifacts.documents.statusLog,
    context: state.taskArtifacts.documents.context
  };
  const relativePath = documentMap[kind];
  if (!relativePath) {
    throw new Error(`Unknown research document: ${kind}`);
  }

  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error("Open a workspace folder before opening research artifacts.");
  }

  const targetPath = path.join(rootPath, relativePath);
  if (!(await fileExists(targetPath))) {
    await saveState(state);
  }
  const document = await vscode.workspace.openTextDocument(targetPath);
  await vscode.window.showTextDocument(document, { preview: false });
  return targetPath;
}

async function captureWorkspaceSnapshot(rootPath) {
  const vscode = require("vscode");
  const activeEditor = vscode.window.activeTextEditor;
  const visibleEditors = [...new Set(
    vscode.window.visibleTextEditors
      .map((editor) => editor?.document?.uri?.fsPath)
      .filter(Boolean)
      .map((filePath) => toRelativePath(rootPath, filePath))
  )];
  const agentFiles = await vscode.workspace.findFiles("**/AGENTS.md", "**/{node_modules,.git}/**", 10);
  const researchArtifacts = await existingRelativePaths(rootPath, [
    path.join(RESEARCH_DIR, "spec.md"),
    path.join(RESEARCH_DIR, "plan.md"),
    path.join(RESEARCH_DIR, "status.md"),
    path.join(RESEARCH_DIR, "workspace-context.md")
  ]);

  return {
    capturedAt: new Date().toISOString(),
    activeEditor: activeEditor ? toRelativePath(rootPath, activeEditor.document.uri.fsPath) : null,
    selection: activeEditor ? formatSelection(activeEditor.selection) : null,
    visibleEditors,
    agentFiles: agentFiles.map((uri) => toRelativePath(rootPath, uri.fsPath)),
    repoSample: await sampleWorkspaceFiles(rootPath, 12),
    researchArtifacts,
    generatedSkillDraft: await fileExists(path.join(rootPath, "generated-skill", "SKILL.md")),
    gitDetected: await fileExists(path.join(rootPath, ".git"))
  };
}

async function existingRelativePaths(rootPath, relativePaths) {
  const results = [];
  for (const relativePath of relativePaths) {
    const targetPath = path.join(rootPath, relativePath);
    if (await fileExists(targetPath)) {
      results.push(relativePath.split(path.sep).join("/"));
    }
  }
  return results;
}

async function sampleWorkspaceFiles(rootPath, limit) {
  const results = [];
  const stack = [rootPath];

  while (stack.length > 0 && results.length < limit) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (results.length >= limit) {
        break;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      results.push(toRelativePath(rootPath, fullPath));
    }
  }

  return results;
}

function formatSelection(selection) {
  return `${selection.start.line + 1}:${selection.start.character + 1}-${selection.end.line + 1}:${selection.end.character + 1}`;
}

async function writeArtifactsForState(rootPath, state) {
  const researchDir = getResearchDir(rootPath);
  const normalizedState = normalizeState(state);

  await fs.mkdir(researchDir, { recursive: true });
  const files = new Map([
    [path.join(researchDir, "spec.md"), renderSpec(normalizedState)],
    [path.join(researchDir, "plan.md"), renderPlan(normalizedState)],
    [path.join(researchDir, "status.md"), renderStatus(normalizedState)],
    [path.join(researchDir, "implement.md"), renderImplementation(normalizedState)],
    [path.join(researchDir, "workspace-context.md"), renderWorkspaceContext(normalizedState)],
    [path.join(researchDir, STATE_FILE), JSON.stringify(normalizedState, null, 2)]
  ]);

  for (const [targetPath, content] of files) {
    await fs.writeFile(targetPath, content, "utf8");
  }
}

function renderSpec(state) {
  return `# Spec

## Objective

${state.taskArtifacts.objective}

## Constraints

${state.taskArtifacts.constraints.map((item) => `- ${item}`).join("\n")}

## Deliverables

${state.taskArtifacts.deliverables.map((item) => `- ${item}`).join("\n")}
`;
}

function renderPlan(state) {
  return `# Plan

${state.taskArtifacts.milestones
    .map(
      (item, index) => `## ${index + 1}. ${item.title}

Status: ${item.status}

Acceptance criteria:
${item.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")}

Verification gates:
${item.verificationGateIds
  .map((gateId) => {
    const gate = state.verificationGates.find((candidate) => candidate.id === gateId);
    return `- ${gate?.label ?? gateId} (${gate?.status ?? "unknown"})`;
  })
  .join("\n")}
`
    )
    .join("\n")}`;
}

function renderStatus(state) {
  const summary = summarizeState(state);
  const preflight = derivePreflightBrief(state);
  return `# Status Log

Generated: ${state.generatedAt}
Updated: ${state.updatedAt}

## Summary

- Task status: ${state.taskArtifacts.status}
- Milestones complete: ${summary.completedMilestones}/${summary.milestoneCount}
- Verification gates complete: ${summary.completedVerification}/${summary.verificationCount}
- Pending or blocked approvals: ${summary.blockedApprovals}
- Approval friction score: ${summary.approvalFrictionScore}
- Active subagents: ${summary.activeSubagents}
- Preflight: ${preflight.status} (${preflight.riskLevel})

## Preflight

- Summary: ${preflight.summary}
- Current milestone: ${preflight.currentMilestoneTitle}
- Open verification gates: ${preflight.currentGateBacklog}

Next actions:
${preflight.nextActions.map((item) => `- ${item}`).join("\n")}

## Recent Notes

${state.statusNotes
  .slice(0, 10)
  .map((item) => `- ${item.timestamp} [${item.kind}] ${item.author}: ${item.text}`)
  .join("\n")}

## Recommendations

${state.recommendations.map((item) => `- ${item}`).join("\n")}
`;
}

function renderImplementation(state) {
  return `# Implementation Runbook

- Treat \`spec.md\` as the durable objective.
- Use \`plan.md\` as the source of truth for milestones.
- Run verification before marking milestones complete.
- Refresh live context before making large changes or after a context switch.
- Update \`status.md\` after each milestone or approval checkpoint.
- Review \`workspace-context.md\` when the agent appears to have weak or stale context.

## Priority Queue

${derivePriorityQueue(state).map((item) => `- [${item.kind}] ${item.title}`).join("\n")}
`;
}

function renderWorkspaceContext(state) {
  const snapshot = state.workspaceSnapshot;
  const contextStrategy = deriveContextStrategy(state);
  return `# Workspace Context

Captured: ${snapshot.capturedAt}

## Editor Focus

- Active editor: ${snapshot.activeEditor ?? "none"}
- Selection: ${snapshot.selection ?? "none"}
- Visible editors: ${snapshot.visibleEditors.length > 0 ? snapshot.visibleEditors.join(", ") : "none"}

## Repo Signals

- Git detected: ${snapshot.gitDetected ? "yes" : "no"}
- Generated skill draft: ${snapshot.generatedSkillDraft ? "yes" : "no"}
- AGENTS files: ${snapshot.agentFiles.length > 0 ? snapshot.agentFiles.join(", ") : "none"}

## Repo Sample

${snapshot.repoSample.map((item) => `- ${item}`).join("\n")}

## Context Ranking

${contextStrategy.rankedSources
  .map((item) => `- ${item.label} (${item.tier}, ${item.freshness}, ${item.score}): ${item.rationale}`)
  .join("\n")}

## Blind Spots

${contextStrategy.blindSpots.length > 0 ? contextStrategy.blindSpots.map((item) => `- ${item}`).join("\n") : "- none"}
`;
}

module.exports = {
  RESEARCH_DIR,
  loadState,
  getResearchStateStatus,
  seedWorkspaceArtifacts,
  saveState,
  captureWorkspaceContext,
  exportSnapshot,
  promoteWorkflowToSkill,
  updateMilestoneState,
  updateVerificationGateState,
  updateApprovalState,
  updateSubagentRunState,
  addUserStatusNote,
  openResearchDocument
};
