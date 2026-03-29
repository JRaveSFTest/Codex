"use strict";

const vscode = require("vscode");
const { loadState, seedWorkspaceArtifacts, exportSnapshot, promoteWorkflowToSkill } = require("./store");
const {
  TaskArtifactsProvider,
  SubagentRunsProvider,
  ContextSourcesProvider,
  ApprovalsProvider
} = require("./providers");
const { openDashboard } = require("./dashboard");

function activate(context) {
  const taskProvider = new TaskArtifactsProvider(loadState);
  const subagentProvider = new SubagentRunsProvider(loadState);
  const contextProvider = new ContextSourcesProvider(loadState);
  const approvalsProvider = new ApprovalsProvider(loadState);
  const providers = [taskProvider, subagentProvider, contextProvider, approvalsProvider];

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("codexResearch.taskArtifacts", taskProvider),
    vscode.window.registerTreeDataProvider("codexResearch.subagentRuns", subagentProvider),
    vscode.window.registerTreeDataProvider("codexResearch.contextSources", contextProvider),
    vscode.window.registerTreeDataProvider("codexResearch.approvals", approvalsProvider)
  );

  async function refreshAll() {
    for (const provider of providers) {
      provider.refresh();
    }
  }

  async function runAction(work, successMessage) {
    try {
      const value = await work();
      await refreshAll();
      if (successMessage) {
        vscode.window.showInformationMessage(successMessage(value));
      }
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(message);
      return undefined;
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("codexResearch.refreshViews", async () => {
      await refreshAll();
    }),
    vscode.commands.registerCommand("codexResearch.seedResearchWorkspace", async () => {
      await runAction(
        () => seedWorkspaceArtifacts(),
        () => "Seeded .codex-research workspace artifacts."
      );
    }),
    vscode.commands.registerCommand("codexResearch.exportSnapshot", async () => {
      await runAction(
        async () => {
          const state = await loadState();
          return exportSnapshot(state);
        },
        (reportPath) => `Exported snapshot to ${reportPath}.`
      );
    }),
    vscode.commands.registerCommand("codexResearch.promoteWorkflowToSkill", async () => {
      await runAction(
        async () => {
          const state = await loadState();
          return promoteWorkflowToSkill(state);
        },
        (skillPath) => `Generated skill draft at ${skillPath}.`
      );
    }),
    vscode.commands.registerCommand("codexResearch.openDashboard", async () => {
      openDashboard(context, loadState, {
        seed: async () =>
          runAction(() => seedWorkspaceArtifacts(), () => "Seeded .codex-research workspace artifacts."),
        export: async () =>
          runAction(
            async () => {
              const state = await loadState();
              return exportSnapshot(state);
            },
            (reportPath) => `Exported snapshot to ${reportPath}.`
          ),
        skill: async () =>
          runAction(
            async () => {
              const state = await loadState();
              return promoteWorkflowToSkill(state);
            },
            (skillPath) => `Generated skill draft at ${skillPath}.`
          )
      });
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
