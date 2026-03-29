"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EXTENSION_MODES,
  getExtensionModeLabel,
  isDebugMode,
  shouldAutoOpenDashboard,
  formatActivationBanner,
  formatDiagnosticsReport
} = require("../src/activationModel");

test("getExtensionModeLabel maps VS Code extension modes", () => {
  assert.equal(getExtensionModeLabel(EXTENSION_MODES.production), "installed");
  assert.equal(getExtensionModeLabel(EXTENSION_MODES.development), "development host");
  assert.equal(getExtensionModeLabel(EXTENSION_MODES.test), "test");
});

test("shouldAutoOpenDashboard always opens in debug mode", () => {
  assert.equal(
    shouldAutoOpenDashboard({ extensionMode: EXTENSION_MODES.development, hasOpenedForWorkspace: true }),
    true
  );
  assert.equal(
    shouldAutoOpenDashboard({ extensionMode: EXTENSION_MODES.test, hasOpenedForWorkspace: true }),
    true
  );
});

test("shouldAutoOpenDashboard opens once in installed mode", () => {
  assert.equal(
    shouldAutoOpenDashboard({ extensionMode: EXTENSION_MODES.production, hasOpenedForWorkspace: false }),
    true
  );
  assert.equal(
    shouldAutoOpenDashboard({ extensionMode: EXTENSION_MODES.production, hasOpenedForWorkspace: true }),
    false
  );
});

test("isDebugMode recognizes development and test modes", () => {
  assert.equal(isDebugMode(EXTENSION_MODES.production), false);
  assert.equal(isDebugMode(EXTENSION_MODES.development), true);
  assert.equal(isDebugMode(EXTENSION_MODES.test), true);
});

test("formatActivationBanner and formatDiagnosticsReport include key runtime data", () => {
  const details = {
    activationRan: true,
    activatedAt: "2026-03-29T12:00:00.000Z",
    extensionVersion: "0.1.0",
    extensionModeLabel: "installed",
    isDebugMode: false,
    extensionPath: "c:/extensions/codex-agent-research",
    workspaceFolderCount: 1,
    workspaceRoot: "c:/repo",
    stateFileExists: true,
    stateFilePath: "c:/repo/.codex-research/state.json",
    dashboardAutoOpenAttempted: true,
    dashboardAutoOpenSucceeded: true,
    dashboardAutoOpenPolicy: "first activation in installed mode",
    dashboardAutoOpenKey: "codexResearch.dashboardAutoOpened.v1",
    lastStartupError: null
  };

  const banner = formatActivationBanner(details);
  const diagnostics = formatDiagnosticsReport(details);

  assert.match(banner, /Codex Research Activation/);
  assert.match(banner, /Mode: installed/);
  assert.match(diagnostics, /Activation ran: yes/);
  assert.match(diagnostics, /Dashboard auto-open succeeded: yes/);
  assert.match(diagnostics, /Research state path: c:\/repo\/.codex-research\/state.json/);
});
