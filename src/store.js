"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createSampleState } = require("./sampleState");
const { summarizeState, derivePriorityQueue, createSkillDraft } = require("./domain");

const RESEARCH_DIR = ".codex-research";
const STATE_FILE = "state.json";

function getWorkspaceRoot() {
  const vscode = require("vscode");
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

function getStatePath(rootPath) {
  return path.join(rootPath, RESEARCH_DIR, STATE_FILE);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadState() {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    return createSampleState("No Workspace");
  }

  const statePath = getStatePath(rootPath);
  if (!(await fileExists(statePath))) {
    return createSampleState(path.basename(rootPath));
  }

  const content = await fs.readFile(statePath, "utf8");
  return JSON.parse(content);
}

async function seedWorkspaceArtifacts() {
  const rootPath = getWorkspaceRoot();
  if (!rootPath) {
    throw new Error("Open a workspace folder before seeding research artifacts.");
  }

  const workspaceName = path.basename(rootPath);
  const state = createSampleState(workspaceName);
  const researchDir = path.join(rootPath, RESEARCH_DIR);

  await fs.mkdir(researchDir, { recursive: true });

  const files = new Map([
    [
      path.join(researchDir, "spec.md"),
      `# Spec\n\n## Objective\n\n${state.taskArtifacts.objective}\n\n## Constraints\n\n${state.taskArtifacts.constraints
        .map((item) => `- ${item}`)
        .join("\n")}\n\n## Deliverables\n\n${state.taskArtifacts.deliverables.map((item) => `- ${item}`).join("\n")}\n`
    ],
    [
      path.join(researchDir, "plan.md"),
      `# Plan\n\n${state.taskArtifacts.milestones
        .map(
          (item, index) =>
            `## ${index + 1}. ${item.title}\n\nStatus: ${item.status}\n\nAcceptance criteria:\n${item.acceptanceCriteria
              .map((criterion) => `- ${criterion}`)
              .join("\n")}\n`
        )
        .join("\n")}`
    ],
    [
      path.join(researchDir, "status.md"),
      `# Status Log\n\nGenerated: ${state.generatedAt}\n\n## Recommendations\n\n${state.recommendations
        .map((item) => `- ${item}`)
        .join("\n")}\n`
    ],
    [
      path.join(researchDir, "implement.md"),
      `# Implementation Runbook\n\n- Treat \`spec.md\` as the durable objective.\n- Use \`plan.md\` as the source of truth for milestones.\n- Run verification before marking milestones complete.\n- Update \`status.md\` after each milestone or approval checkpoint.\n`
    ],
    [
      path.join(researchDir, STATE_FILE),
      JSON.stringify(state, null, 2)
    ]
  ]);

  for (const [targetPath, content] of files) {
    await fs.writeFile(targetPath, content, "utf8");
  }

  return state;
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

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    reportPath,
    `# Codex Research Snapshot\n\nGenerated: ${new Date().toISOString()}\n\n## Summary\n\n- Workspace: ${state.workspaceName}\n- Milestones complete: ${summary.completedMilestones}/${summary.milestoneCount}\n- Verification gates complete: ${summary.completedVerification}/${summary.verificationCount}\n- Active subagents: ${summary.activeSubagents}\n- Pending or blocked approvals: ${summary.blockedApprovals}\n- Average context score: ${summary.averageContextScore}\n- Estimated subagent cost: $${summary.estimatedCostUsd.toFixed(
      2
    )}\n\n## Priority Queue\n\n${queue.map((item) => `- [${item.kind}] ${item.title}`).join("\n")}\n`,
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

module.exports = {
  RESEARCH_DIR,
  loadState,
  seedWorkspaceArtifacts,
  exportSnapshot,
  promoteWorkflowToSkill
};
