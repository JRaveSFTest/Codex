"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSampleState } = require("../src/sampleState");
const {
  normalizeState,
  appendStatusNote,
  setMilestoneStatus,
  recordVerificationReview,
  recordApprovalReview,
  setApprovalStatus,
  applyWorkspaceSnapshot
} = require("../src/stateModel");

test("normalizeState backfills new state fields", () => {
  const state = normalizeState(createSampleState("Codex"));

  assert.ok(Array.isArray(state.statusNotes));
  assert.ok(state.taskArtifacts.documents.context);
  assert.ok(state.taskArtifacts.documents.implement);
  assert.ok(state.workspaceSnapshot.capturedAt);
});

test("setMilestoneStatus updates task status when milestones change", () => {
  let state = normalizeState(createSampleState("Codex"));
  state = setMilestoneStatus(state, "m4", "pending");

  assert.equal(state.taskArtifacts.status, "pending");

  state = setMilestoneStatus(state, "m4", "completed");

  assert.equal(state.taskArtifacts.status, "completed");
});

test("appendStatusNote prepends a user note", () => {
  const state = appendStatusNote(createSampleState("Codex"), "Validated a live context refresh.");

  assert.equal(state.statusNotes[0].text, "Validated a live context refresh.");
  assert.equal(state.statusNotes[0].author, "user");
});

test("applyWorkspaceSnapshot rebuilds context sources from workspace signals", () => {
  const state = applyWorkspaceSnapshot(createSampleState("Codex"), {
    capturedAt: "2026-03-29T01:00:00.000Z",
    activeEditor: "src/store.js",
    selection: "10:1-10:5",
    visibleEditors: ["src/store.js", "src/dashboard.js"],
    agentFiles: ["AGENTS.md"],
    repoSample: ["src/store.js", "src/dashboard.js"],
    researchArtifacts: [".codex-research/spec.md"],
    generatedSkillDraft: true,
    gitDetected: true
  });

  assert.equal(state.workspaceSnapshot.activeEditor, "src/store.js");
  assert.equal(state.contextSources[0].id, "ctx-editor");
  assert.equal(state.contextSources[1].id, "ctx-agents");
});

test("setApprovalStatus updates the target approval", () => {
  const state = setApprovalStatus(createSampleState("Codex"), "approval-a", "blocked");
  const approval = state.approvals.find((item) => item.id === "approval-a");

  assert.equal(approval.status, "blocked");
});

test("recordVerificationReview stores evidence and reviewer metadata", () => {
  const state = recordVerificationReview(createSampleState("Codex"), "gate-context", {
    status: "completed",
    evidence: "Compared ranked sources against the milestone 3 dashboard outputs.",
    reviewer: "user"
  });
  const gate = state.verificationGates.find((item) => item.id === "gate-context");

  assert.equal(gate.status, "completed");
  assert.equal(gate.lastReviewedBy, "user");
  assert.match(gate.evidence, /ranked sources/);
  assert.ok(gate.lastReviewedAt);
});

test("recordApprovalReview stores evidence, reviewer metadata, and resolution", () => {
  const state = recordApprovalReview(createSampleState("Codex"), "approval-b", {
    status: "completed",
    evidence: "Accepted local validation for the prototype completion pass.",
    reviewer: "user",
    resolution: "approved-with-local-validation"
  });
  const approval = state.approvals.find((item) => item.id === "approval-b");

  assert.equal(approval.status, "completed");
  assert.equal(approval.lastReviewedBy, "user");
  assert.equal(approval.resolution, "approved-with-local-validation");
  assert.match(approval.evidence, /local validation/);
  assert.ok(approval.lastReviewedAt);
});
