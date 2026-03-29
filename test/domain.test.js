"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSampleState } = require("../src/sampleState");
const { summarizeState, derivePriorityQueue, createSkillDraft } = require("../src/domain");

test("summarizeState returns aggregate metrics for the sample research state", () => {
  const state = createSampleState("Codex");
  const summary = summarizeState(state);

  assert.equal(summary.milestoneCount, 4);
  assert.equal(summary.completedMilestones, 1);
  assert.equal(summary.milestoneCompletionRate, 25);
  assert.equal(summary.completedVerification, 2);
  assert.equal(summary.verificationCount, 7);
  assert.equal(summary.activeSubagents, 1);
  assert.equal(summary.blockedApprovals, 2);
  assert.equal(summary.estimatedCostUsd, 1.51);
});

test("derivePriorityQueue ranks unresolved approvals ahead of milestones", () => {
  const state = createSampleState("Codex");
  const queue = derivePriorityQueue(state);

  assert.ok(queue.length > 0);
  assert.equal(queue[0].kind, "approval");
  assert.match(queue[0].title, /Resolve approval:/);
});

test("createSkillDraft captures context and verification checkpoints", () => {
  const state = createSampleState("Codex");
  const skillDraft = createSkillDraft(state);

  assert.match(skillDraft, /# Codex Agent Runbook/);
  assert.match(skillDraft, /Open files and active selection/);
  assert.match(skillDraft, /Telemetry schema review/);
});
