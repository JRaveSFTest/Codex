"use strict";

const vscode = require("vscode");
const {
  summarizeState,
  deriveContextStrategy,
  deriveApprovalSummary,
  deriveVerificationSummary,
  derivePreflightBrief,
  deriveResumeBrief
} = require("./domain");

function iconForStatus(status) {
  switch (status) {
    case "completed":
    case "ready":
      return new vscode.ThemeIcon("pass");
    case "blocked":
    case "blocker":
    case "high":
      return new vscode.ThemeIcon("warning");
    case "in_progress":
      return new vscode.ThemeIcon("sync");
    case "needs_review":
    case "pending":
    case "medium":
      return new vscode.ThemeIcon("pulse");
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
    const resume = deriveResumeBrief(state);

    return [
      new NodeItem(
        `${state.taskArtifacts.title} (${state.taskArtifacts.status})`,
        vscode.TreeItemCollapsibleState.Expanded,
        iconForStatus(state.taskArtifacts.status),
        [
          new NodeItem(`Objective: ${state.taskArtifacts.objective}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Completion: ${summary.milestoneCompletionRate}%`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Updated: ${state.updatedAt ?? state.generatedAt}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(
            `Continuity: ${state.taskArtifacts.continuity.mode} / ${state.taskArtifacts.continuity.threadId}`,
            vscode.TreeItemCollapsibleState.None
          ),
          new NodeItem(
            `Artifacts: ${Object.values(state.taskArtifacts.documents).join(", ")}`,
            vscode.TreeItemCollapsibleState.None
          ),
          new NodeItem(
            "Continuation",
            vscode.TreeItemCollapsibleState.Expanded,
            new vscode.ThemeIcon("history"),
            [
              new NodeItem(`Mode: ${resume.continuityMode}`, vscode.TreeItemCollapsibleState.None),
              new NodeItem(`Thread: ${resume.threadId}`, vscode.TreeItemCollapsibleState.None),
              new NodeItem(`Current milestone: ${resume.currentMilestoneTitle}`, vscode.TreeItemCollapsibleState.None),
              new NodeItem(`Next checkpoint: ${resume.nextCheckpoint}`, vscode.TreeItemCollapsibleState.None),
              new NodeItem(`Last updated: ${resume.lastUpdatedAt ?? "n/a"}`, vscode.TreeItemCollapsibleState.None),
              new NodeItem(`Latest note: ${resume.latestNote}`, vscode.TreeItemCollapsibleState.None)
            ]
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
    const strategy = deriveContextStrategy(state);

    return [
      new NodeItem(
        `Snapshot: ${state.workspaceSnapshot?.capturedAt ?? "n/a"}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        new vscode.ThemeIcon("pulse"),
        [
          new NodeItem(`Active editor: ${state.workspaceSnapshot?.activeEditor ?? "none"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Selection: ${state.workspaceSnapshot?.selection ?? "none"}`, vscode.TreeItemCollapsibleState.None),
          ...((state.workspaceSnapshot?.visibleEditors ?? []).map(
            (item) => new NodeItem(`Visible: ${item}`, vscode.TreeItemCollapsibleState.None)
          ))
        ]
      ),
      new NodeItem(
        `Strategy (${strategy.primaryCount} primary / ${strategy.staleCount} stale)`,
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon("graph"),
        [
          new NodeItem(`Summary: ${strategy.summary}`, vscode.TreeItemCollapsibleState.None),
          ...(strategy.blindSpots.length > 0
            ? strategy.blindSpots.map((item) => new NodeItem(`Gap: ${item}`, vscode.TreeItemCollapsibleState.None))
            : [new NodeItem("Gap: No immediate context blind spots detected.", vscode.TreeItemCollapsibleState.None)])
        ]
      ),
      ...strategy.rankedSources.map((source) => {
        const label = `${source.label} (${source.score})`;
        const children = [
          new NodeItem(`Kind: ${source.kind}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Tier: ${source.tier}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Freshness: ${source.freshness}`, vscode.TreeItemCollapsibleState.None),
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
      })
    ];
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
    const approvalSummary = deriveApprovalSummary(state);
    const verificationSummary = deriveVerificationSummary(state);
    const preflight = derivePreflightBrief(state);
    const gates = state.verificationGates.map((gate) =>
      new NodeItem(
        `${gate.label} (${gate.status})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        iconForStatus(gate.status),
        [
          new NodeItem(`Command: ${gate.command}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Repair policy: ${gate.repairPolicy}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Last reviewed: ${gate.lastReviewedAt ?? "not reviewed"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Reviewer: ${gate.lastReviewedBy ?? "n/a"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Evidence: ${gate.evidence || "none recorded"}`, vscode.TreeItemCollapsibleState.None)
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
          new NodeItem(`Command: ${item.command ?? "n/a"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Resolution: ${item.resolution ?? "n/a"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Last reviewed: ${item.lastReviewedAt ?? "not reviewed"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Reviewer: ${item.lastReviewedBy ?? "n/a"}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Evidence: ${item.evidence || "none recorded"}`, vscode.TreeItemCollapsibleState.None)
        ]
      )
    );
    const approvalGroups = approvalSummary.groups
      .filter((group) => group.count > 0)
      .map((group) =>
        new NodeItem(
          `${group.status} (${group.count})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          iconForStatus(group.status),
          [
            ...group.scopes.map((scope) => new NodeItem(`Scope: ${scope}`, vscode.TreeItemCollapsibleState.None)),
            ...group.milestones.map(
              (milestone) => new NodeItem(`Milestone: ${milestone}`, vscode.TreeItemCollapsibleState.None)
            )
          ]
        )
      );

    return [
      new NodeItem(
        `Preflight (${preflight.status})`,
        vscode.TreeItemCollapsibleState.Expanded,
        iconForStatus(preflight.status),
        [
          new NodeItem(`Risk: ${preflight.riskLevel}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Current milestone: ${preflight.currentMilestoneTitle}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Approval friction: ${preflight.approvalFrictionScore}`, vscode.TreeItemCollapsibleState.None),
          ...preflight.blockers.map((item) => new NodeItem(`Blocker: ${item}`, vscode.TreeItemCollapsibleState.None)),
          ...preflight.warnings.map((item) => new NodeItem(`Warning: ${item}`, vscode.TreeItemCollapsibleState.None)),
          ...preflight.nextActions.map((item) => new NodeItem(`Next: ${item}`, vscode.TreeItemCollapsibleState.None))
        ]
      ),
      new NodeItem(
        `Verification Queue (${verificationSummary.openCount} open)`,
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon("checklist"),
        [
          new NodeItem(`Summary: ${verificationSummary.summary}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(
            `Reviewed completed gates: ${verificationSummary.reviewedCount}/${verificationSummary.completedCount}`,
            vscode.TreeItemCollapsibleState.None
          ),
          new NodeItem(`Missing evidence: ${verificationSummary.missingEvidenceCount}`, vscode.TreeItemCollapsibleState.None),
          new NodeItem(`Next gate: ${verificationSummary.nextGate?.label ?? "none"}`, vscode.TreeItemCollapsibleState.None)
        ]
      ),
      new NodeItem(
        "Approval Groups",
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon("layers"),
        approvalGroups.length > 0
          ? approvalGroups
          : [new NodeItem("No approvals tracked", vscode.TreeItemCollapsibleState.None)]
      ),
      new NodeItem("Verification Gates", vscode.TreeItemCollapsibleState.Expanded, new vscode.ThemeIcon("shield"), gates),
      new NodeItem("Approval Queue", vscode.TreeItemCollapsibleState.Expanded, new vscode.ThemeIcon("lock"), approvals),
      new NodeItem(
        "Recent Notes",
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon("note"),
        (state.statusNotes ?? [])
          .slice(0, 5)
          .map((item) => new NodeItem(`${item.kind}: ${item.text}`, vscode.TreeItemCollapsibleState.None))
      )
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
