"use strict";

const vscode = require("vscode");
const {
  summarizeState,
  derivePriorityQueue,
  deriveContextStrategy,
  deriveApprovalSummary,
  derivePreflightBrief
} = require("./domain");

let currentPanel;

function renderDashboardHtml(webview, state, meta) {
  const summary = summarizeState(state);
  const queue = derivePriorityQueue(state).slice(0, 6);
  const contextStrategy = deriveContextStrategy(state);
  const approvalSummary = deriveApprovalSummary(state);
  const preflight = derivePreflightBrief(state);
  const nonce = String(Date.now());
  const statusNotes = state.statusNotes?.slice(0, 6) ?? [];
  const snapshot = state.workspaceSnapshot ?? {};
  const diagnostics = meta?.diagnostics ?? {};

  const cards = [
    { label: "Milestone completion", value: `${summary.completedMilestones}/${summary.milestoneCount}` },
    { label: "Verification coverage", value: `${summary.completedVerification}/${summary.verificationCount}` },
    { label: "Preflight status", value: `${summary.preflightStatus}` },
    { label: "Risk level", value: `${summary.riskLevel}` },
    { label: "Approval friction", value: `${summary.approvalFrictionScore}` },
    { label: "Stale context", value: `${summary.staleContextCount}` },
    { label: "Active subagents", value: `${summary.activeSubagents}` },
    { label: "Estimated spend", value: `$${summary.estimatedCostUsd.toFixed(2)}` }
  ];

  const milestoneRows = state.taskArtifacts.milestones
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(
          item.acceptanceCriteria.join("; ")
        )}</td></tr>`
    )
    .join("");

  const subagentRows = state.subagentRuns
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.state)}</td><td>${escapeHtml(
          item.focus
        )}</td><td>$${item.costUsd.toFixed(2)}</td></tr>`
    )
    .join("");

  const contextRows = contextStrategy.rankedSources
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.tier)}</td><td>${escapeHtml(
          item.freshness
        )}</td><td>${item.score}</td><td>${escapeHtml(item.rationale)}</td></tr>`
    )
    .join("");

  const approvalRows = state.approvals
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.scope)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(
          item.requestedBy
        )}</td><td>${escapeHtml(item.rationale)}</td></tr>`
    )
    .join("");

  const noteItems = statusNotes
    .map(
      (item) =>
        `<div class="recommendation"><strong>${escapeHtml(item.kind)}</strong> | ${escapeHtml(item.timestamp)}<br/>${escapeHtml(
          item.text
        )}</div>`
    )
    .join("");

  const onboardingItems = [
    "Seed the research workspace if `.codex-research/state.json` is missing.",
    "Refresh workspace context after changing files or switching focus.",
    "Use milestone, gate, approval, and subagent updates to keep the run inspectable.",
    "Open diagnostics whenever activation or auto-open behavior looks suspicious."
  ];
  const approvalGroupItems = approvalSummary.groups
    .filter((group) => group.count > 0)
    .map(
      (group) =>
        `<div class="recommendation"><span class="status-chip ${statusTone(group.status)}">${escapeHtml(
          group.status
        )}</span>${group.count} approval${group.count === 1 ? "" : "s"}<br/>${escapeHtml(group.scopes.join(", "))}</div>`
    )
    .join("");
  const preflightMessages = [
    ...preflight.blockers.map((item) => ({ kind: "blocker", text: item })),
    ...preflight.warnings.map((item) => ({ kind: "warning", text: item }))
  ];
  const topContextItems = contextStrategy.topSources
    .map(
      (item) =>
        `<div class="recommendation"><strong>${escapeHtml(item.label)}</strong><br/>${escapeHtml(
          `${item.tier} | ${item.freshness} | score ${item.score}`
        )}<br/>${escapeHtml(item.rationale)}</div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Codex Research Dashboard</title>
    <style>
      :root {
        color-scheme: light dark;
        --panel: rgba(15, 23, 42, 0.78);
        --panel-border: rgba(148, 163, 184, 0.24);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --accent: #f59e0b;
        --accent-2: #14b8a6;
        --danger: #fb7185;
        --success: #22c55e;
      }

      body {
        margin: 0;
        padding: 24px;
        background:
          radial-gradient(circle at top left, rgba(245, 158, 11, 0.2), transparent 32%),
          radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 28%),
          linear-gradient(180deg, #020617 0%, #111827 100%);
        color: var(--text);
        font: 13px/1.5 Consolas, "Liberation Mono", Menlo, monospace;
      }

      .shell {
        display: grid;
        gap: 16px;
      }

      .hero,
      .panel {
        border: 1px solid var(--panel-border);
        border-radius: 16px;
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: 0 16px 48px rgba(2, 6, 23, 0.28);
      }

      .hero {
        padding: 24px;
      }

      .eyebrow {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 11px;
      }

      h1 {
        margin: 8px 0;
        font-size: 26px;
        line-height: 1.2;
      }

      p {
        margin: 0;
        color: var(--muted);
        max-width: 78ch;
      }

      .actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
        flex-wrap: wrap;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 9px 14px;
        font: inherit;
        cursor: pointer;
        color: #08111f;
        background: linear-gradient(135deg, var(--accent), #facc15);
      }

      button.secondary {
        background: linear-gradient(135deg, var(--accent-2), #67e8f9);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }

      .card {
        padding: 16px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.62);
      }

      .label {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .value {
        font-size: 24px;
        color: #f8fafc;
      }

      .columns {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 16px;
      }

      .panel {
        padding: 18px;
      }

      .panel h2 {
        margin: 0 0 12px;
        font-size: 16px;
      }

      .queue,
      .recommendations {
        display: grid;
        gap: 10px;
      }

      .queue-item,
      .recommendation {
        border-left: 3px solid var(--danger);
        padding-left: 12px;
      }

      .queue-item {
        border-left-color: var(--accent);
      }

      .status-chip {
        display: inline-block;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.2);
        color: #e2e8f0;
        margin-right: 8px;
      }

      .status-chip.ok {
        background: rgba(34, 197, 94, 0.18);
        color: #dcfce7;
      }

      .status-chip.warn {
        background: rgba(251, 113, 133, 0.18);
        color: #ffe4e6;
      }

      .status-chip.review {
        background: rgba(245, 158, 11, 0.18);
        color: #fef3c7;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-weight: 600;
      }

      ul {
        margin: 0;
        padding-left: 18px;
      }

      @media (max-width: 900px) {
        .columns {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Trusted Autonomous Task Completion</div>
        <h1>${escapeHtml(state.taskArtifacts.title)}</h1>
        <p>${escapeHtml(state.taskArtifacts.objective)}</p>
        <div class="actions">
          <button data-command="seed">Seed Workspace Bundle</button>
          <button class="secondary" data-command="export">Export Snapshot</button>
          <button class="secondary" data-command="skill">Generate Skill Draft</button>
          <button class="secondary" data-command="refreshContext">Refresh Context</button>
          <button class="secondary" data-command="showDiagnostics">Show Diagnostics</button>
        </div>
      </section>

      <section class="grid">
        ${cards
          .map(
            (item) =>
              `<div class="card"><div class="label">${escapeHtml(item.label)}</div><div class="value">${escapeHtml(
                item.value
              )}</div></div>`
          )
          .join("")}
      </section>

      <section class="columns">
        <div class="panel">
          <h2>Getting Started</h2>
          <div class="recommendations">
            ${onboardingItems.map((item) => `<div class="recommendation">${escapeHtml(item)}</div>`).join("")}
          </div>
          <div class="actions">
            <button class="secondary" data-command="note">Add Status Note</button>
            <button class="secondary" data-command="milestone">Update Milestone</button>
            <button class="secondary" data-command="verification">Update Gate</button>
            <button class="secondary" data-command="approval">Update Approval</button>
            <button class="secondary" data-command="subagent">Update Subagent</button>
          </div>
        </div>
        <div class="panel">
          <h2>Preflight</h2>
          <div class="recommendations">
            <div class="recommendation">
              <span class="status-chip ${statusTone(preflight.status)}">${escapeHtml(preflight.status)}</span>
              ${escapeHtml(preflight.summary)}
            </div>
            <div class="recommendation">
              <strong>Risk:</strong> ${escapeHtml(preflight.riskLevel)}<br/>
              <strong>Current milestone:</strong> ${escapeHtml(preflight.currentMilestoneTitle)}<br/>
              <strong>Open gates:</strong> ${preflight.currentGateBacklog}
            </div>
            ${preflightMessages
              .map(
                (item) =>
                  `<div class="recommendation"><span class="status-chip ${statusTone(item.kind)}">${escapeHtml(
                    item.kind
                  )}</span>${escapeHtml(item.text)}</div>`
              )
              .join("") || `<div class="recommendation">No blockers or warnings are currently open.</div>`}
            ${preflight.nextActions
              .map((item) => `<div class="recommendation"><strong>Next:</strong> ${escapeHtml(item)}</div>`)
              .join("")}
          </div>
        </div>
      </section>

      <section class="columns">
        <div class="panel">
          <h2>Activation</h2>
          <div class="recommendations">
            <div class="recommendation">
              <span class="status-chip ${diagnostics.stateFileExists ? "ok" : "warn"}">${escapeHtml(
                diagnostics.extensionModeLabel ?? "unknown"
              )}</span>
              ${escapeHtml(diagnostics.stateFileExists ? "Research state present" : "Research state missing")}
            </div>
            <div class="recommendation">Activated: ${escapeHtml(diagnostics.activatedAt ?? "n/a")}</div>
            <div class="recommendation">Workspace root: ${escapeHtml(diagnostics.workspaceRoot ?? "none")}</div>
            <div class="recommendation">Auto-open: ${escapeHtml(
              diagnostics.dashboardAutoOpenAttempted
                ? diagnostics.dashboardAutoOpenSucceeded
                  ? "attempted and succeeded"
                  : "attempted and failed"
                : diagnostics.dashboardAutoOpenPolicy ?? "not attempted"
            )}</div>
          </div>
        </div>
        <div class="panel">
          <h2>Approval Groups</h2>
          <div class="recommendations">
            <div class="recommendation">
              <strong>Friction score:</strong> ${approvalSummary.frictionScore}<br/>
              <strong>Next checkpoint:</strong> ${escapeHtml(approvalSummary.nextCheckpoint)}
            </div>
            ${approvalGroupItems || `<div class="recommendation">No approvals are currently tracked.</div>`}
          </div>
        </div>
      </section>

      <section class="columns">
        <div class="panel">
          <h2>Priority Queue</h2>
          <div class="queue">
            ${queue
              .map(
                (item) =>
                  `<div class="queue-item"><strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(
                    item.kind
                  )}</div></div>`
              )
              .join("")}
          </div>
        </div>
        <div class="panel">
          <h2>Context Strategy</h2>
          <div class="recommendations">
            <div class="recommendation">
              <strong>Captured:</strong> ${escapeHtml(contextStrategy.capturedAt ?? "n/a")}<br/>
              <strong>Age:</strong> ${escapeHtml(
                contextStrategy.ageMinutes === null ? "unknown" : `${contextStrategy.ageMinutes} min`
              )}<br/>
              <strong>Summary:</strong> ${escapeHtml(contextStrategy.summary)}
            </div>
            ${topContextItems || `<div class="recommendation">No context sources ranked yet.</div>`}
            ${contextStrategy.blindSpots
              .map((item) => `<div class="recommendation"><span class="status-chip review">gap</span>${escapeHtml(item)}</div>`)
              .join("")}
          </div>
        </div>
      </section>

      <section class="columns">
        <div class="panel">
          <h2>Workspace Snapshot</h2>
          <table>
            <tbody>
              <tr><th>Captured</th><td>${escapeHtml(snapshot.capturedAt ?? "n/a")}</td></tr>
              <tr><th>Active editor</th><td>${escapeHtml(snapshot.activeEditor ?? "none")}</td></tr>
              <tr><th>Selection</th><td>${escapeHtml(snapshot.selection ?? "none")}</td></tr>
              <tr><th>Visible editors</th><td>${escapeHtml((snapshot.visibleEditors ?? []).join(", ") || "none")}</td></tr>
              <tr><th>AGENTS files</th><td>${escapeHtml((snapshot.agentFiles ?? []).join(", ") || "none")}</td></tr>
              <tr><th>Skill draft</th><td>${snapshot.generatedSkillDraft ? "yes" : "no"}</td></tr>
              <tr><th>Git detected</th><td>${snapshot.gitDetected ? "yes" : "no"}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="panel">
          <h2>Research Artifacts</h2>
          <div class="actions">
            <button class="secondary" data-command="openSpec">Open Spec</button>
            <button class="secondary" data-command="openPlan">Open Plan</button>
            <button class="secondary" data-command="openStatus">Open Status</button>
            <button class="secondary" data-command="openContext">Open Context</button>
          </div>
          <div class="recommendations">
            ${(snapshot.researchArtifacts ?? [])
              .map((item) => `<div class="recommendation">${escapeHtml(item)}</div>`)
              .join("")}
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>Milestones</h2>
        <table>
          <thead>
            <tr><th>Milestone</th><th>Status</th><th>Acceptance Criteria</th></tr>
          </thead>
          <tbody>${milestoneRows}</tbody>
        </table>
      </section>

      <section class="columns">
        <div class="panel">
          <h2>Subagents</h2>
          <table>
            <thead>
              <tr><th>Run</th><th>Status</th><th>Focus</th><th>Spend</th></tr>
            </thead>
            <tbody>${subagentRows}</tbody>
          </table>
        </div>
        <div class="panel">
          <h2>Approvals</h2>
          <table>
            <thead>
              <tr><th>Scope</th><th>Status</th><th>Requested By</th><th>Reason</th></tr>
            </thead>
            <tbody>${approvalRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Context Ranking</h2>
        <table>
          <thead>
            <tr><th>Source</th><th>Tier</th><th>Freshness</th><th>Score</th><th>Why Included</th></tr>
          </thead>
          <tbody>${contextRows}</tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Recent Notes</h2>
        <div class="recommendations">
          ${noteItems || `<div class="recommendation">No status notes captured yet.</div>`}
        </div>
      </section>

      <section class="panel">
        <h2>Research Guidance</h2>
        <div class="recommendations">
          ${state.recommendations
            .map((item) => `<div class="recommendation">${escapeHtml(item)}</div>`)
            .join("")}
        </div>
      </section>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      for (const button of document.querySelectorAll("button[data-command]")) {
        button.addEventListener("click", () => {
          vscode.postMessage({ command: button.dataset.command });
        });
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusTone(status) {
  if (status === "completed" || status === "ready" || status === "ok") {
    return "ok";
  }
  if (status === "blocked" || status === "blocker") {
    return "warn";
  }
  return "review";
}

async function openDashboard(context, stateLoader, actions, metaLoader) {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One, true);
  } else {
    currentPanel = vscode.window.createWebviewPanel(
      "codexResearch.dashboard",
      "Codex Research Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
    }, undefined, context.subscriptions);

    currentPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "seed":
          await actions.seed();
          break;
        case "export":
          await actions.export();
          break;
        case "skill":
          await actions.skill();
          break;
        case "refreshContext":
          await actions.refreshContext();
          break;
        case "milestone":
          await actions.milestone();
          break;
        case "verification":
          await actions.verification();
          break;
        case "approval":
          await actions.approval();
          break;
        case "subagent":
          await actions.subagent();
          break;
        case "note":
          await actions.note();
          break;
        case "openSpec":
          await actions.openSpec();
          break;
        case "openPlan":
          await actions.openPlan();
          break;
        case "openStatus":
          await actions.openStatus();
          break;
        case "openContext":
          await actions.openContext();
          break;
        case "showDiagnostics":
          await actions.showDiagnostics();
          break;
        default:
          break;
      }
      await refreshDashboard(currentPanel, stateLoader, metaLoader);
    }, undefined, context.subscriptions);
  }

  await refreshDashboard(currentPanel, stateLoader, metaLoader);
  return currentPanel;
}

async function refreshDashboard(panel, stateLoader, metaLoader) {
  const [state, meta] = await Promise.all([stateLoader(), metaLoader ? metaLoader() : Promise.resolve({})]);
  panel.webview.html = renderDashboardHtml(panel.webview, state, meta);
}

module.exports = {
  openDashboard
};
