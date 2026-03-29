"use strict";

const EXTENSION_MODES = {
  production: 1,
  development: 2,
  test: 3
};

function getExtensionModeLabel(extensionMode) {
  switch (extensionMode) {
    case EXTENSION_MODES.development:
      return "development host";
    case EXTENSION_MODES.test:
      return "test";
    case EXTENSION_MODES.production:
      return "installed";
    default:
      return "unknown";
  }
}

function isDebugMode(extensionMode) {
  return extensionMode === EXTENSION_MODES.development || extensionMode === EXTENSION_MODES.test;
}

function shouldAutoOpenDashboard({ extensionMode, hasOpenedForWorkspace }) {
  return isDebugMode(extensionMode) || !hasOpenedForWorkspace;
}

function formatActivationBanner(details) {
  return [
    "=== Codex Research Activation ===",
    `Version: ${details.extensionVersion}`,
    `Activated: ${details.activatedAt}`,
    `Mode: ${details.extensionModeLabel}`,
    `Workspace folders: ${details.workspaceFolderCount}`,
    `Workspace root: ${details.workspaceRoot ?? "none"}`,
    `Research state file: ${details.stateFileExists ? "present" : "missing"}${details.stateFilePath ? ` (${details.stateFilePath})` : ""}`
  ].join("\n");
}

function formatDiagnosticsReport(details) {
  return [
    "=== Codex Research Diagnostics ===",
    `Activation ran: ${details.activationRan ? "yes" : "no"}`,
    `Activated at: ${details.activatedAt}`,
    `Version: ${details.extensionVersion}`,
    `Mode: ${details.extensionModeLabel}`,
    `Debug mode: ${details.isDebugMode ? "yes" : "no"}`,
    `Extension path: ${details.extensionPath}`,
    `Workspace folder count: ${details.workspaceFolderCount}`,
    `Workspace root: ${details.workspaceRoot ?? "none"}`,
    `Research state file exists: ${details.stateFileExists ? "yes" : "no"}`,
    `Research state path: ${details.stateFilePath ?? "n/a"}`,
    `Dashboard auto-open attempted: ${details.dashboardAutoOpenAttempted ? "yes" : "no"}`,
    `Dashboard auto-open succeeded: ${details.dashboardAutoOpenSucceeded ? "yes" : "no"}`,
    `Dashboard auto-open policy: ${details.dashboardAutoOpenPolicy}`,
    `Dashboard first-run key: ${details.dashboardAutoOpenKey ?? "n/a"}`,
    `Last startup error: ${details.lastStartupError ?? "none"}`
  ].join("\n");
}

module.exports = {
  EXTENSION_MODES,
  getExtensionModeLabel,
  isDebugMode,
  shouldAutoOpenDashboard,
  formatActivationBanner,
  formatDiagnosticsReport
};
