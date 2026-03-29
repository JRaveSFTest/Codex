"use strict";

const vscode = require("vscode");
const {
  loadState,
  getResearchStateStatus,
  seedWorkspaceArtifacts,
  captureWorkspaceContext,
  exportSnapshot,
  promoteWorkflowToSkill,
  updateMilestoneState,
  updateVerificationGateState,
  reviewVerificationGate,
  updateApprovalState,
  reviewApproval,
  updateSubagentRunState,
  addUserStatusNote,
  openResearchDocument
} = require("./store");
const { STATUS_VALUES } = require("./stateModel");
const { deriveApprovalSummary, deriveVerificationSummary } = require("./domain");
const {
  getExtensionModeLabel,
  isDebugMode,
  shouldAutoOpenDashboard,
  formatActivationBanner,
  formatDiagnosticsReport
} = require("./activationModel");
const {
  TaskArtifactsProvider,
  SubagentRunsProvider,
  ContextSourcesProvider,
  ApprovalsProvider
} = require("./providers");
const { openDashboard } = require("./dashboard");

function activate(context) {
  const output = vscode.window.createOutputChannel("Codex Research");
  const taskProvider = new TaskArtifactsProvider(loadState);
  const subagentProvider = new SubagentRunsProvider(loadState);
  const contextProvider = new ContextSourcesProvider(loadState);
  const approvalsProvider = new ApprovalsProvider(loadState);
  const providers = [taskProvider, subagentProvider, contextProvider, approvalsProvider];
  const runtime = {
    activatedAt: new Date().toISOString(),
    activationRan: true,
    dashboardAutoOpenAttempted: false,
    dashboardAutoOpenSucceeded: false,
    dashboardAutoOpenPolicy: "not evaluated",
    dashboardAutoOpenKey: null,
    lastStartupError: null
  };

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.text = "$(beaker) Codex Research";
  statusBar.command = "codexResearch.openDashboard";
  statusBar.tooltip = "Open the Codex Research dashboard";
  statusBar.show();

  context.subscriptions.push(
    output,
    statusBar,
    vscode.window.registerTreeDataProvider("codexResearch.taskArtifacts", taskProvider),
    vscode.window.registerTreeDataProvider("codexResearch.subagentRuns", subagentProvider),
    vscode.window.registerTreeDataProvider("codexResearch.contextSources", contextProvider),
    vscode.window.registerTreeDataProvider("codexResearch.approvals", approvalsProvider)
  );

  function logInfo(message) {
    output.appendLine(`[info] ${message}`);
  }

  function logError(scope, error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && error.stack ? error.stack : message;
    runtime.lastStartupError = `${scope}: ${message}`;
    output.appendLine(`[error] ${scope}: ${message}`);
    output.appendLine(stack);
  }

  async function refreshAll() {
    for (const provider of providers) {
      provider.refresh();
    }
  }

  function getAutoOpenTracking() {
    const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    return {
      key: hasWorkspace
        ? "codexResearch.dashboardAutoOpened.v1"
        : "codexResearch.dashboardAutoOpened.noWorkspace.v1",
      storage: hasWorkspace ? context.workspaceState : context.globalState
    };
  }

  async function collectDiagnostics() {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const stateStatus = await getResearchStateStatus();
    return {
      activationRan: runtime.activationRan,
      activatedAt: runtime.activatedAt,
      extensionVersion: context.extension.packageJSON.version,
      extensionModeLabel: getExtensionModeLabel(context.extensionMode),
      isDebugMode: isDebugMode(context.extensionMode),
      extensionPath: context.extension.extensionPath,
      workspaceFolderCount: workspaceFolders.length,
      workspaceRoot: stateStatus.workspaceRoot,
      stateFileExists: stateStatus.stateFileExists,
      stateFilePath: stateStatus.stateFilePath,
      dashboardAutoOpenAttempted: runtime.dashboardAutoOpenAttempted,
      dashboardAutoOpenSucceeded: runtime.dashboardAutoOpenSucceeded,
      dashboardAutoOpenPolicy: runtime.dashboardAutoOpenPolicy,
      dashboardAutoOpenKey: runtime.dashboardAutoOpenKey,
      lastStartupError: runtime.lastStartupError
    };
  }

  async function showDiagnostics() {
    const diagnostics = await collectDiagnostics();
    output.clear();
    output.appendLine(formatDiagnosticsReport(diagnostics));
    output.show(true);
    return diagnostics;
  }

  async function runAction(work, successMessage, scope = "action") {
    try {
      const value = await work();
      await refreshAll();
      if (successMessage) {
        vscode.window.showInformationMessage(successMessage(value));
      }
      return value;
    } catch (error) {
      logError(scope, error);
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(message);
      return undefined;
    }
  }

  async function promptForStatus(targetLabel, currentStatus) {
    const choice = await vscode.window.showQuickPick(
      STATUS_VALUES.map((status) => ({
        label: status,
        description: status === currentStatus ? "current" : undefined
      })),
      {
        title: `Set status for ${targetLabel}`
      }
    );
    return choice?.label;
  }

  async function promptForStateUpdate(items, title, updateFn, currentStatusField, labelField) {
    if (!items || items.length === 0) {
      vscode.window.showInformationMessage("No tracked items are available for that update yet.");
      return;
    }

    const target = await vscode.window.showQuickPick(
      items.map((item) => ({
        label: item[labelField],
        description: item[currentStatusField],
        id: item.id
      })),
      { title }
    );
    if (!target) {
      return;
    }

    const nextStatus = await promptForStatus(target.label, target.description);
    if (!nextStatus) {
      return;
    }

    await runAction(
      () => updateFn(target.id, nextStatus),
      () => `Updated ${target.label} to ${nextStatus}.`,
      `update ${target.label}`
    );
  }

  async function promptForVerificationReview() {
    const state = await loadState();
    const summary = deriveVerificationSummary(state);
    const availableGates = summary.openGates.length > 0 ? summary.openGates : state.verificationGates;
    const target = await vscode.window.showQuickPick(
      availableGates.map((gate) => ({
        label: gate.label,
        description: `${gate.status} | ${gate.milestoneTitle ?? "verification gate"}`,
        detail: `${gate.command}${gate.repairPolicy ? ` | ${gate.repairPolicy}` : ""}`,
        id: gate.id
      })),
      { title: "Review a verification gate" }
    );
    if (!target) {
      return;
    }

    const nextStatus = await vscode.window.showQuickPick(
      STATUS_VALUES.map((status) => ({
        label: status,
        description:
          status === "completed"
            ? "Verification passed"
            : status === "blocked"
              ? "Verification found a blocking issue"
              : status === "in_progress"
                ? "Verification started but is not finished"
                : "Verification has not started"
      })),
      { title: `Record verification outcome for ${target.label}` }
    );
    if (!nextStatus) {
      return;
    }

    const evidence = await vscode.window.showInputBox({
      title: "Record verification evidence",
      prompt: "Summarize what was checked and why this gate is in its new state.",
      placeHolder: "Example: Ran node --test and npm.cmd run check; dashboard and sidebar show the new verification sections.",
      validateInput: (value) => (value.trim() ? undefined : "Enter verification evidence.")
    });
    if (!evidence) {
      return;
    }

    await runAction(
      () => reviewVerificationGate(target.id, nextStatus.label, evidence),
      () => `Reviewed ${target.label} as ${nextStatus.label}.`,
      `review verification ${target.label}`
    );
  }

  async function promptForApprovalReview() {
    const state = await loadState();
    const summary = deriveApprovalSummary(state);
    const availableApprovals = state.approvals.filter((item) => item.status !== "completed");
    const targets = availableApprovals.length > 0 ? availableApprovals : state.approvals;
    if (targets.length === 0) {
      vscode.window.showInformationMessage("No approvals are currently tracked in this workspace bundle.");
      return;
    }

    const target = await vscode.window.showQuickPick(
      targets.map((approval) => ({
        label: approval.scope,
        description: `${approval.status} | ${approval.requestedBy}`,
        detail: `${approval.command ?? "no command"}${approval.rationale ? ` | ${approval.rationale}` : ""}`,
        id: approval.id
      })),
      { title: `Review an approval (${summary.nextCheckpoint})` }
    );
    if (!target) {
      return;
    }

    const nextStatus = await vscode.window.showQuickPick(
      STATUS_VALUES.map((status) => ({
        label: status,
        description:
          status === "completed"
            ? "Approval cleared"
            : status === "blocked"
              ? "Approval remains blocked"
              : status === "in_progress"
                ? "Approval is under active review"
                : "Approval is waiting on more information"
      })),
      { title: `Record approval outcome for ${target.label}` }
    );
    if (!nextStatus) {
      return;
    }

    const evidence = await vscode.window.showInputBox({
      title: "Record approval evidence",
      prompt: "Explain why this approval moved and what policy or decision supports it.",
      placeHolder: "Example: Prototype completion accepts local-only validation; live external benchmark deferred until production telemetry exists.",
      validateInput: (value) => (value.trim() ? undefined : "Enter approval evidence.")
    });
    if (!evidence) {
      return;
    }

    const resolution = await vscode.window.showInputBox({
      title: "Record approval resolution",
      prompt: "Capture the final approval decision or policy outcome.",
      placeHolder: "Example: approved-with-local-validation"
    });

    await runAction(
      () => reviewApproval(target.id, nextStatus.label, evidence, "user", resolution ?? ""),
      () => `Reviewed ${target.label} as ${nextStatus.label}.`,
      `review approval ${target.label}`
    );
  }

  async function openDashboardPanel(source = "manual") {
    try {
      logInfo(`Opening dashboard (${source}).`);
      return await openDashboard(
        context,
        loadState,
        {
          seed: async () =>
            runAction(() => seedWorkspaceArtifacts(), () => "Seeded .codex-research workspace artifacts.", "seed workspace"),
          export: async () =>
            runAction(
              async () => {
                const state = await loadState();
                return exportSnapshot(state);
              },
              (reportPath) => `Exported snapshot to ${reportPath}.`,
              "export snapshot"
            ),
          skill: async () =>
              runAction(
                async () => {
                  const state = await loadState();
                  return promoteWorkflowToSkill(state);
                },
                (skillPath) => `Generated workflow pack at ${skillPath}.`,
                "generate workflow pack"
              ),
          refreshContext: async () =>
            runAction(() => captureWorkspaceContext(), () => "Refreshed workspace context.", "refresh workspace context"),
          milestone: async () => {
            const state = await loadState();
            return promptForStateUpdate(
              state.taskArtifacts.milestones,
              "Choose a milestone to update",
              updateMilestoneState,
              "status",
              "title"
            );
          },
          verification: async () => {
            const state = await loadState();
            return promptForStateUpdate(
              state.verificationGates,
              "Choose a verification gate to update",
              updateVerificationGateState,
              "status",
              "label"
            );
          },
          reviewVerification: async () => promptForVerificationReview(),
          reviewApproval: async () => promptForApprovalReview(),
          approval: async () => {
            const state = await loadState();
            return promptForStateUpdate(
              state.approvals,
              "Choose an approval to update",
              updateApprovalState,
              "status",
              "scope"
            );
          },
          subagent: async () => {
            const state = await loadState();
            return promptForStateUpdate(
              state.subagentRuns,
              "Choose a subagent run to update",
              updateSubagentRunState,
              "state",
              "title"
            );
          },
          note: async () => {
            const note = await vscode.window.showInputBox({
              title: "Add a status note",
              prompt: "Capture a task update, blocker, or decision.",
              validateInput: (value) => (value.trim() ? undefined : "Enter a note.")
            });
            if (!note) {
              return;
            }
            return runAction(() => addUserStatusNote(note), () => "Added status note.", "add status note");
          },
          openSpec: async () => runAction(() => openResearchDocument("spec"), undefined, "open spec"),
          openPlan: async () => runAction(() => openResearchDocument("plan"), undefined, "open plan"),
          openImplement: async () => runAction(() => openResearchDocument("implement"), undefined, "open implementation runbook"),
          openStatus: async () => runAction(() => openResearchDocument("status"), undefined, "open status log"),
          openContext: async () => runAction(() => openResearchDocument("context"), undefined, "open context"),
          showDiagnostics: async () => runAction(() => showDiagnostics(), () => "Opened Codex Research diagnostics.", "show diagnostics")
        },
        async () => ({
          diagnostics: await collectDiagnostics()
        })
      );
    } catch (error) {
      logError("open dashboard", error);
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(message);
      throw error;
    }
  }

  async function maybePromptForSeed() {
    const diagnostics = await collectDiagnostics();
    if (diagnostics.stateFileExists) {
      return;
    }

    const selection = await vscode.window.showInformationMessage(
      "Codex Research is active, but the workspace has not been seeded yet.",
      "Seed Research Workspace",
      "Open Dashboard",
      "Show Diagnostics"
    );

    switch (selection) {
      case "Seed Research Workspace":
        await runAction(() => seedWorkspaceArtifacts(), () => "Seeded .codex-research workspace artifacts.", "seed prompt");
        break;
      case "Open Dashboard":
        await openDashboardPanel("seed prompt");
        break;
      case "Show Diagnostics":
        await showDiagnostics();
        break;
      default:
        break;
    }
  }

  async function initializeStartup() {
    const tracking = getAutoOpenTracking();
    runtime.dashboardAutoOpenKey = tracking.key;
    const alreadyOpened = tracking.storage.get(tracking.key, false);
    const shouldOpen = shouldAutoOpenDashboard({
      extensionMode: context.extensionMode,
      hasOpenedForWorkspace: alreadyOpened
    });

    runtime.dashboardAutoOpenPolicy = isDebugMode(context.extensionMode)
      ? "always in development/test mode"
      : alreadyOpened
        ? "already opened once for this workspace"
        : "first activation in installed mode";

    logInfo(formatActivationBanner(await collectDiagnostics()));

    if (shouldOpen) {
      runtime.dashboardAutoOpenAttempted = true;
      try {
        await openDashboardPanel("startup");
        runtime.dashboardAutoOpenSucceeded = true;
        if (!isDebugMode(context.extensionMode)) {
          await tracking.storage.update(tracking.key, true);
        }
      } catch (error) {
        logError("startup dashboard auto-open", error);
        vscode.window.showErrorMessage("Codex Research failed to auto-open the dashboard. Use 'Codex Research: Show Diagnostics'.");
      }
    }

    await maybePromptForSeed();
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      refreshAll();
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => {
      refreshAll();
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      refreshAll();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codexResearch.refreshViews", async () => {
      await refreshAll();
    }),
    vscode.commands.registerCommand("codexResearch.seedResearchWorkspace", async () => {
      await runAction(
        () => seedWorkspaceArtifacts(),
        () => "Seeded .codex-research workspace artifacts.",
        "seed workspace"
      );
    }),
    vscode.commands.registerCommand("codexResearch.captureWorkspaceContext", async () => {
      await runAction(() => captureWorkspaceContext(), () => "Refreshed workspace context.", "capture workspace context");
    }),
    vscode.commands.registerCommand("codexResearch.exportSnapshot", async () => {
      await runAction(
        async () => {
          const state = await loadState();
          return exportSnapshot(state);
        },
        (reportPath) => `Exported snapshot to ${reportPath}.`,
        "export snapshot"
      );
    }),
    vscode.commands.registerCommand("codexResearch.promoteWorkflowToSkill", async () => {
      await runAction(
        async () => {
          const state = await loadState();
          return promoteWorkflowToSkill(state);
        },
        (skillPath) => `Generated workflow pack at ${skillPath}.`,
        "generate workflow pack"
      );
    }),
    vscode.commands.registerCommand("codexResearch.updateMilestoneStatus", async () => {
      const state = await loadState();
      await promptForStateUpdate(
        state.taskArtifacts.milestones,
        "Choose a milestone to update",
        updateMilestoneState,
        "status",
        "title"
      );
    }),
    vscode.commands.registerCommand("codexResearch.updateVerificationGateStatus", async () => {
      const state = await loadState();
      await promptForStateUpdate(
        state.verificationGates,
        "Choose a verification gate to update",
        updateVerificationGateState,
        "status",
        "label"
      );
    }),
    vscode.commands.registerCommand("codexResearch.reviewVerificationGate", async () => {
      await promptForVerificationReview();
    }),
    vscode.commands.registerCommand("codexResearch.reviewApproval", async () => {
      await promptForApprovalReview();
    }),
    vscode.commands.registerCommand("codexResearch.updateApprovalStatus", async () => {
      const state = await loadState();
      await promptForStateUpdate(
        state.approvals,
        "Choose an approval to update",
        updateApprovalState,
        "status",
        "scope"
      );
    }),
    vscode.commands.registerCommand("codexResearch.updateSubagentStatus", async () => {
      const state = await loadState();
      await promptForStateUpdate(
        state.subagentRuns,
        "Choose a subagent run to update",
        updateSubagentRunState,
        "state",
        "title"
      );
    }),
    vscode.commands.registerCommand("codexResearch.addStatusNote", async () => {
      const note = await vscode.window.showInputBox({
        title: "Add a status note",
        prompt: "Capture a task update, blocker, or decision.",
        validateInput: (value) => (value.trim() ? undefined : "Enter a note.")
      });
      if (!note) {
        return;
      }
      await runAction(() => addUserStatusNote(note), () => "Added status note.", "add status note");
    }),
    vscode.commands.registerCommand("codexResearch.openSpec", async () => {
      await runAction(() => openResearchDocument("spec"), undefined, "open spec");
    }),
    vscode.commands.registerCommand("codexResearch.openPlan", async () => {
      await runAction(() => openResearchDocument("plan"), undefined, "open plan");
    }),
    vscode.commands.registerCommand("codexResearch.openImplementationRunbook", async () => {
      await runAction(() => openResearchDocument("implement"), undefined, "open implementation runbook");
    }),
    vscode.commands.registerCommand("codexResearch.openStatusLog", async () => {
      await runAction(() => openResearchDocument("status"), undefined, "open status log");
    }),
    vscode.commands.registerCommand("codexResearch.showDiagnostics", async () => {
      await runAction(() => showDiagnostics(), () => "Opened Codex Research diagnostics.", "show diagnostics");
    }),
    vscode.commands.registerCommand("codexResearch.openDashboard", async () => {
      await openDashboardPanel("manual");
    })
  );

  void initializeStartup().catch((error) => {
    logError("startup", error);
    vscode.window.showErrorMessage("Codex Research failed during activation. Use 'Codex Research: Show Diagnostics'.");
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
