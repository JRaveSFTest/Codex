"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSampleState } = require("../src/sampleState");
const {
  summarizeState,
  derivePriorityQueue,
  deriveContextStrategy,
  deriveApprovalSummary,
  derivePreflightBrief,
  createSkillDraft
} = require("../src/domain");

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

test("deriveContextStrategy classifies ranked sources and flags blind spots", () => {
  const state = createSampleState("Codex");
  const strategy = deriveContextStrategy(state, { now: "2026-03-29T03:00:00.000Z" });

  assert.equal(strategy.topSources[0].tier, "primary");
  assert.equal(strategy.topSources[0].freshness, "stale");
  assert.ok(strategy.blindSpots.some((item) => item.includes("AGENTS.md")));
  assert.ok(strategy.blindSpots.some((item) => item.includes("Git metadata")));
});

test("deriveApprovalSummary groups approvals and computes friction", () => {
  const state = createSampleState("Codex");
  const summary = deriveApprovalSummary(state);

  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.frictionScore, 8);
  assert.match(summary.nextCheckpoint, /Resolve blocked approvals first/);
});

test("derivePreflightBrief reports blocked execution when approvals are unresolved", () => {
  const state = createSampleState("Codex");
  const brief = derivePreflightBrief(state, { now: "2026-03-29T03:00:00.000Z" });

  assert.equal(brief.status, "blocked");
  assert.equal(brief.riskLevel, "high");
  assert.match(brief.summary, /blocked/i);
  assert.ok(brief.nextActions.some((item) => item.includes("Resolve blocked approvals")));
});

test("createSkillDraft captures context and verification checkpoints", () => {
  const state = createSampleState("Codex");
  const skillDraft = createSkillDraft(state);

  assert.match(skillDraft, /# Codex Agent Runbook/);
  assert.match(skillDraft, /Open files and active selection/);
  assert.match(skillDraft, /Telemetry schema review/);
  assert.match(skillDraft, /Approval friction score/);
});
