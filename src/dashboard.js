"use strict";

const vscode = require("vscode");
const { summarizeState, derivePriorityQueue } = require("./domain");

function renderDashboardHtml(webview, state) {
  const summary = summarizeState(state);
  const queue = derivePriorityQueue(state).slice(0, 6);
  const nonce = String(Date.now());

  const cards = [
    { label: "Milestone completion", value: `${summary.completedMilestones}/${summary.milestoneCount}` },
    { label: "Verification coverage", value: `${summary.completedVerification}/${summary.verificationCount}` },
    { label: "Active subagents", value: `${summary.activeSubagents}` },
    { label: "Blocked approvals", value: `${summary.blockedApprovals}` },
    { label: "Context score", value: `${summary.averageContextScore}` },
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

  const contextRows = [...state.contextSources]
    .sort((left, right) => right.score - left.score)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.kind)}</td><td>${item.score}</td><td>${escapeHtml(
          item.rationale
        )}</td></tr>`
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
        --bg: #0f172a;
        --panel: rgba(15, 23, 42, 0.72);
        --panel-border: rgba(148, 163, 184, 0.24);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --accent: #f59e0b;
        --accent-2: #14b8a6;
        --danger: #fb7185;
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
        margin: 8px 0 8px;
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

      .card .label {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .card .value {
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

      .queue {
        display: grid;
        gap: 10px;
      }

      .queue-item {
        border-left: 3px solid var(--accent);
        padding-left: 12px;
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

      .recommendations {
        display: grid;
        gap: 8px;
      }

      .recommendation {
        border-left: 3px solid var(--danger);
        padding-left: 12px;
        color: #f8fafc;
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
          <h2>Recommendations</h2>
          <div class="recommendations">
            ${state.recommendations
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
            <tr><th>Source</th><th>Kind</th><th>Score</th><th>Why Included</th></tr>
          </thead>
          <tbody>${contextRows}</tbody>
        </table>
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

function openDashboard(context, stateLoader, actions) {
  const panel = vscode.window.createWebviewPanel(
    "codexResearch.dashboard",
    "Codex Research Dashboard",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  async function refresh() {
    const state = await stateLoader();
    panel.webview.html = renderDashboardHtml(panel.webview, state);
  }

  panel.webview.onDidReceiveMessage(async (message) => {
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
      default:
        break;
    }
    await refresh();
  }, undefined, context.subscriptions);

  refresh();
  return panel;
}

module.exports = {
  openDashboard
};
