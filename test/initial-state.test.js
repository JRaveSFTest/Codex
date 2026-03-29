"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createInitialState } = require("../src/initialState");

test("createInitialState builds a pending repo-aware workspace bundle", () => {
  const state = createInitialState(
    "m4b-deck",
    {
      displayName: "m4b-deck",
      summary: "This is a local-first Electron desktop player for DRM-free .m4b audiobooks.",
      guidanceFiles: ["AGENTS.md", "docs/M4B_DECK_PLAN.md"],
      priorities: ["Follow docs/MP3_IMPLEMENTATION_PLAN.litcoffee before adding new features."],
      linkedDocs: [{ path: "docs/MP3_IMPLEMENTATION_PLAN.litcoffee", summary: "Active next feature plan." }]
    },
    { generatedAt: "2026-03-29T12:00:00.000Z" }
  );

  assert.equal(state.taskArtifacts.title, "m4b-deck workspace bundle");
  assert.match(state.taskArtifacts.objective, /repo's own context/i);
  assert.equal(state.taskArtifacts.milestones[0].status, "in_progress");
  assert.equal(state.verificationGates[0].label, "Repo context review");
  assert.equal(state.approvals.length, 0);
  assert.equal(state.workspaceSnapshot.projectContext.guidanceFiles[0], "AGENTS.md");
  assert.match(state.statusNotes[0].text, /repo context/i);
});
