"use strict";

const vscode = require("vscode");
const { summarizeState } = require("./domain");

function iconForStatus(status) {
  switch (status) {
    case "completed":
      return new vscode.ThemeIcon("pass");
    case "blocked":
      return new vscode.ThemeIcon("warning");
    case "in_progress":
      return new vscode.ThemeIcon("sync");
    default:
      return new vscode.ThemeIcon("circle-outline");
  }
}

class BaseProvider {
  constructor(loader) {
    this.loader = loader;
    this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  }

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }
}

class TaskArtifactsProvider extends BaseProvider {
  async getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (element) {
      return element.children ?? [];
    }

    const state = await this.loader();
    const summary = summarizeState(state);

    return [
      new NodeItem(
        `${state.taskArtifacts.title} (${state.taskArtifacts.status})`,
        vscode.TreeItemCollapsibleState.Expanded,
        iconForStatus(state.taskArtifacts.status),
        [
          new NodeItem(`Objective: ${state.taskArtifacts.objective}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Completion: ${summary.milestoneCompletionRate}%`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(
            `Continuity: ${state.taskArtifacts.continuity.mode} / ${state.taskArtifacts.continuity.threadId}`,
            vscode.TreeItemCollapsibleState.None
          ),
          new NodeItem(
            "Milestones",
            vscode.TreeItemCollapsibleState.Expanded,
            new vscode.ThemeIcon("list-unordered"),
            state.taskArtifacts.milestones.map((milestone) => {
              const gateLabels = milestone.verificationGateIds.join(", ");
              return new NodeItem(
                `${milestone.title} (${milestone.status})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                iconForStatus(milestone.status),
                [
                  ...milestone.acceptanceCriteria.map(
                    (criterion) => new NodeItem(criterion, vscode.TreeItemCollapsibleState.None)
                  ),
                  new NodeItem(`Verification: ${gateLabels}`, vscode.TreeItemCollapsibleState.None)
                ]
              );
            })
          )
        ]
      )
    ];
  }
}

class SubagentRunsProvider extends BaseProvider {
  async getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (element) {
      return element.children ?? [];
    }

    const state = await this.loader();
    return state.subagentRuns.map((agent) =>
      new NodeItem(
        `${agent.title} (${agent.state})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        iconForStatus(agent.state),
        [
          new NodeItem(`Focus: ${agent.focus}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Owned concerns: ${agent.ownedConcerns.join(", ")}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Approvals required: ${agent.approvalsRequired}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(
            `Estimated spend: $${agent.costUsd.toFixed(2)} / ${agent.tokenEstimate.toLocaleString()} tokens`,
            vscode.TreeItemCollapsibleState.None
          ),
          new NodeItem(`Summary: ${agent.summary}`, vscode.TreeItemCollapsibleState.None)
        ]
      )
    );
  }
}

class ContextSourcesProvider extends BaseProvider {
  async getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (element) {
      return element.children ?? [];
    }

    const state = await this.loader();
    const sorted = [...state.contextSources].sort((left, right) => right.score - left.score);

    return sorted.map((source) => {
      const label = `${source.label} (${source.score})`;
      const children = [
        new NodeItem(`Kind: ${source.kind}`, vscode.TreeItemCollapsibleState.None),
        new NodeItem(`Pinned: ${source.pinned ? "yes" : "no"}`, vscode.TreeItemCollapsibleState.None),
        new NodeItem(`Why included: ${source.rationale}`, vscode.TreeItemCollapsibleState.None),
        ...((source.artifacts ?? []).map(
          (artifact) => new NodeItem(`Artifact: ${artifact}`, vscode.TreeItemCollapsibleState.None)
        ))
      ];
      return new NodeItem(
        label,
        vscode.TreeItemCollapsibleState.Collapsed,
        new vscode.ThemeIcon(source.pinned ? "pin" : "symbol-key"),
        children
      );
    });
  }
}

class ApprovalsProvider extends BaseProvider {
  async getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (element) {
      return element.children ?? [];
    }

    const state = await this.loader();
    const gates = state.verificationGates.map((gate) =>
      new NodeItem(
        `${gate.label} (${gate.status})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        iconForStatus(gate.status),
        [
          new NodeItem(`Command: ${gate.command}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Repair policy: ${gate.repairPolicy}`, vscode.TreeItemCollapsibleState.None)
        ]
      )
    );
    const approvals = state.approvals.map((item) =>
      new NodeItem(
        `${item.scope} (${item.status})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        iconForStatus(item.status),
        [
          new NodeItem(`Requested by: ${item.requestedBy}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Reason: ${item.rationale}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Command: ${item.command ?? "n/a"}`, vscode.TreeItemCollapsibleState.None)
        ]
      )
    );

    return [
      new NodeItem("Verification Gates", vscode.TreeItemCollapsibleState.Expanded, new vscode.ThemeIcon("shield"), gates),
      new NodeItem("Approval Queue", vscode.TreeItemCollapsibleState.Expanded, new vscode.ThemeIcon("lock"), approvals)
    ];
  }
}

class NodeItem extends vscode.TreeItem {
  constructor(label, collapsibleState, iconPath, children = []) {
    super(label, collapsibleState);
    this.children = children;
    this.iconPath = iconPath;
    this.contextValue = "codexResearch.node";
  }
}

module.exports = {
  TaskArtifactsProvider,
  SubagentRunsProvider,
  ContextSourcesProvider,
  ApprovalsProvider
};
