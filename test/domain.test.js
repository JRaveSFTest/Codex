"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSampleState } = require("../src/sampleState");
const {
  summarizeState,
  derivePriorityQueue,
  deriveContextStrategy,
  deriveApprovalSummary,
  deriveVerificationSummary,
  derivePreflightBrief,
  deriveResumeBrief,
  createSkillDraft,
  createSkillBundle
} = require("../src/domain");
const { applyWorkspaceSnapshot } = require("../src/stateModel");

function cloneState() {
  return JSON.parse(JSON.stringify(createSampleState("Codex")));
}

test("summarizeState returns aggregate metrics for the sample research state", () => {
  const state = createSampleState("Codex");
  const summary = summarizeState(state);

  assert.equal(summary.milestoneCount, 4);
  assert.equal(summary.completedMilestones, 4);
  assert.equal(summary.milestoneCompletionRate, 100);
  assert.equal(summary.completedVerification, 7);
  assert.equal(summary.verificationCount, 7);
  assert.equal(summary.activeSubagents, 0);
  assert.equal(summary.blockedApprovals, 0);
  assert.equal(summary.estimatedCostUsd, 1.51);
});

test("derivePriorityQueue ranks unresolved approvals ahead of milestones", () => {
  const state = cloneState();
  state.approvals[1].status = "blocked";
  state.taskArtifacts.milestones[2].status = "in_progress";
  state.verificationGates.find((item) => item.id === "gate-context").status = "pending";
  const queue = derivePriorityQueue(state);

  assert.ok(queue.length > 0);
  assert.equal(queue[0].kind, "approval");
  assert.match(queue[0].title, /Resolve approval:/);
});

test("deriveContextStrategy classifies ranked sources and flags blind spots", () => {
  const state = applyWorkspaceSnapshot(cloneState(), {
    capturedAt: "2026-03-29T00:00:00.000Z",
    activeEditor: null,
    selection: null,
    visibleEditors: [],
    agentFiles: [],
    repoSample: ["src/store.js"],
    researchArtifacts: [".codex-research/spec.md"],
    generatedSkillDraft: false,
    gitDetected: false
  });
  const strategy = deriveContextStrategy(state, { now: "2026-03-29T03:00:00.000Z" });

  assert.equal(strategy.topSources[0].tier, "supporting");
  assert.equal(strategy.topSources[0].freshness, "stale");
  assert.ok(strategy.blindSpots.some((item) => item.includes("AGENTS.md")));
  assert.ok(strategy.blindSpots.some((item) => item.includes("Git metadata")));
});

test("deriveApprovalSummary groups approvals and computes friction", () => {
  const state = cloneState();
  state.approvals[0].status = "pending";
  state.approvals[1].status = "blocked";
  const summary = deriveApprovalSummary(state);

  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.frictionScore, 8);
  assert.match(summary.nextCheckpoint, /Resolve blocked approvals first/);
});

test("deriveVerificationSummary highlights the next open gate and missing evidence", () => {
  const state = cloneState();
  state.taskArtifacts.milestones[2].status = "in_progress";
  state.taskArtifacts.milestones[3].status = "pending";
  state.verificationGates.find((item) => item.id === "gate-context").status = "in_progress";
  state.verificationGates.find((item) => item.id === "gate-context").evidence = "";
  state.verificationGates.find((item) => item.id === "gate-context").lastReviewedAt = null;
  state.verificationGates.find((item) => item.id === "gate-context").lastReviewedBy = null;
  state.verificationGates.find((item) => item.id === "gate-approvals").status = "pending";
  state.verificationGates.find((item) => item.id === "gate-approvals").evidence = "";
  state.verificationGates.find((item) => item.id === "gate-approvals").lastReviewedAt = null;
  state.verificationGates.find((item) => item.id === "gate-approvals").lastReviewedBy = null;
  state.verificationGates.find((item) => item.id === "gate-skill").status = "pending";
  state.verificationGates.find((item) => item.id === "gate-skill").evidence = "";
  state.verificationGates.find((item) => item.id === "gate-skill").lastReviewedAt = null;
  state.verificationGates.find((item) => item.id === "gate-skill").lastReviewedBy = null;
  const summary = deriveVerificationSummary(state);

  assert.equal(summary.openCount, 3);
  assert.equal(summary.completedCount, 4);
  assert.equal(summary.missingEvidenceCount, 0);
  assert.equal(summary.currentMilestoneOpenCount, 2);
  assert.equal(summary.nextGate.label, "Context ranking quality check");
});

test("derivePreflightBrief reports blocked execution when approvals are unresolved", () => {
  const state = cloneState();
  state.taskArtifacts.milestones[2].status = "in_progress";
  state.approvals[1].status = "blocked";
  state.verificationGates.find((item) => item.id === "gate-context").status = "in_progress";
  state.verificationGates.find((item) => item.id === "gate-approvals").status = "pending";
  const brief = derivePreflightBrief(state, { now: "2026-03-29T03:00:00.000Z" });

  assert.equal(brief.status, "blocked");
  assert.equal(brief.riskLevel, "high");
  assert.match(brief.summary, /blocked/i);
  assert.ok(brief.nextActions.some((item) => item.includes("Resolve blocked approvals")));
});

test("deriveResumeBrief exposes the current continuation path", () => {
  const state = createSampleState("Codex");
  const brief = deriveResumeBrief(state);

  assert.equal(brief.status, "resumable");
  assert.equal(brief.currentMilestoneTitle, "All milestones completed");
  assert.match(brief.nextCheckpoint, /generated workflow pack|final snapshot/i);
  assert.ok(brief.documentsToOpen.some((item) => item.endsWith("implement.md")));
});

test("createSkillDraft captures context and verification checkpoints", () => {
  const state = createSampleState("Codex");
  const skillDraft = createSkillDraft(state);

  assert.match(skillDraft, /# Codex Agent Runbook/);
  assert.match(skillDraft, /Open files and active selection/);
  assert.match(skillDraft, /Telemetry schema review/);
  assert.match(skillDraft, /Approval friction score/);
});

test("createSkillBundle returns a shareable workflow pack", () => {
  const state = createSampleState("Codex");
  const bundle = createSkillBundle(state, { generatedAt: "2026-03-29T23:59:00.000Z" });

  assert.match(bundle.skillDraft, /# Codex Agent Runbook/);
  assert.equal(bundle.manifest.schemaVersion, 1);
  assert.equal(bundle.manifest.verification.openCount, 0);
  assert.equal(bundle.manifest.approvals.frictionScore, 3);
  assert.match(bundle.readme, /workflow-pack\.json/);
});
