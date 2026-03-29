"use strict";

function createSampleState(workspaceName) {
  return {
    version: 2,
    workspaceName,
    generatedAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T23:59:00.000Z",
    taskArtifacts: {
      id: "task-main",
      title: "Trusted Autonomous Task Completion",
      status: "completed",
      objective:
        "Prototype a VS Code extension surface for durable task memory, subagent visibility, context provenance, and safe approval checkpoints.",
      constraints: [
        "Bias toward reliability and autonomy instead of net-new raw tools.",
        "Keep public interfaces internal and research-oriented for now.",
        "Support local or cloud continuation without losing plan state."
      ],
      deliverables: [
        "Task scaffolding inside the IDE",
        "Visible subagent timeline and budget summary",
        "Context provenance panel",
        "Approval and verification dashboard"
      ],
      milestones: [
        {
          id: "m1",
          title: "Baseline instrumentation and benchmark pack",
          status: "completed",
          acceptanceCriteria: [
            "Telemetry schema defined",
            "Benchmark scenarios documented",
            "Interview guide ready for studies"
          ],
          verificationGateIds: [
            "gate-schema",
            "gate-benchmarks"
          ]
        },
        {
          id: "m2",
          title: "TaskArtifacts and SubagentRun prototype",
          status: "completed",
          acceptanceCriteria: [
            "Task package survives reload",
            "Subagents expose state, scope, and cost",
            "Dashboard can summarize current run"
          ],
          verificationGateIds: [
            "gate-task-artifacts",
            "gate-subagents"
          ]
        },
        {
          id: "m3",
          title: "Context ranking and approval UX",
          status: "completed",
          acceptanceCriteria: [
            "Context panel explains inclusion rationale",
            "Grouped approvals reduce prompt churn",
            "Risk summary exists before execution"
          ],
          verificationGateIds: [
            "gate-context",
            "gate-approvals"
          ]
        },
        {
          id: "m4",
          title: "Workflow capture into reusable skill draft",
          status: "completed",
          acceptanceCriteria: [
            "Workflow can be promoted into SKILL.md",
            "Runbook preserves verification policy",
            "Team-shareable output is generated"
          ],
          verificationGateIds: [
            "gate-skill"
          ]
        }
      ],
      continuity: {
        mode: "hybrid",
        threadId: "cloud-thread-prototype-001",
        resumable: true
      },
      documents: {
        spec: ".codex-research/spec.md",
        plan: ".codex-research/plan.md",
        statusLog: ".codex-research/status.md",
        context: ".codex-research/workspace-context.md",
        implement: ".codex-research/implement.md"
      }
    },
    verificationGates: [
      {
        id: "gate-schema",
        label: "Telemetry schema review",
        type: "schema",
        status: "completed",
        lastReviewedAt: "2026-03-29T00:02:00.000Z",
        lastReviewedBy: "system",
        evidence: "Telemetry schema examples were checked against the defined event fields and required enums.",
        command: "Validate schema examples against telemetry.schema.json",
        repairPolicy: "Fix schema drift before collecting baseline data.",
        signals: [
          "schema-valid",
          "enum-complete"
        ],
        milestoneId: "m1"
      },
      {
        id: "gate-benchmarks",
        label: "Benchmark scenario review",
        type: "research",
        status: "completed",
        lastReviewedAt: "2026-03-29T00:05:00.000Z",
        lastReviewedBy: "system",
        evidence: "Benchmark scenarios cover the target task list for baseline moderated studies.",
        command: "Check benchmark pack against target task list",
        repairPolicy: "Add missing scenarios before prototype studies.",
        milestoneId: "m1"
      },
      {
        id: "gate-task-artifacts",
        label: "TaskArtifacts durability check",
        type: "prototype",
        status: "completed",
        lastReviewedAt: "2026-03-29T23:43:00.000Z",
        lastReviewedBy: "system",
        evidence: "Persisted state, runbook artifacts, and continuation cues now survive reload and are visible in both the dashboard and tree views.",
        command: "Persist plan state and reopen workspace",
        repairPolicy: "Do not start agent execution unless recovery works.",
        milestoneId: "m2"
      },
      {
        id: "gate-subagents",
        label: "Subagent visibility check",
        type: "prototype",
        status: "completed",
        lastReviewedAt: "2026-03-29T23:44:00.000Z",
        lastReviewedBy: "system",
        evidence: "Subagent summaries, owned concerns, approvals, and estimated spend are rendered in the dashboard and side views.",
        command: "Verify child runs show ownership, status, and cost",
        repairPolicy: "Require a summary card before merging the UI spike.",
        milestoneId: "m2"
      },
      {
        id: "gate-context",
        label: "Context ranking quality check",
        type: "prototype",
        status: "completed",
        lastReviewedAt: "2026-03-29T23:51:00.000Z",
        lastReviewedBy: "user",
        evidence: "Ranked context sources were compared against the final workspace snapshot and the dashboard now exposes inclusion rationale, tiers, and blind spots.",
        command: "Compare ranked sources against baseline task outcomes",
        repairPolicy: "Adjust weights before enabling by default.",
        milestoneId: "m3"
      },
      {
        id: "gate-approvals",
        label: "Approval checkpoint review",
        type: "prototype",
        status: "completed",
        lastReviewedAt: "2026-03-29T23:52:00.000Z",
        lastReviewedBy: "user",
        evidence: "Approval grouping, diagnostics, and explicit review evidence now reduce prompt churn while preserving a visible decision trail.",
        command: "Measure approval prompts per successful task",
        repairPolicy: "Rework grouping if prompt count does not decrease.",
        milestoneId: "m3"
      },
      {
        id: "gate-skill",
        label: "Workflow-to-skill generation",
        type: "prototype",
        status: "completed",
        lastReviewedAt: "2026-03-29T23:58:00.000Z",
        lastReviewedBy: "user",
        evidence: "The extension now generates a shareable workflow pack with SKILL.md, README.md, and workflow-pack.json outputs.",
        command: "Generate SKILL.md from run artifacts",
        repairPolicy: "Keep as draft until a human reviews the trigger wording.",
        milestoneId: "m4"
      }
    ],
    subagentRuns: [
      {
        id: "agent-a",
        title: "Benchmark Analyst",
        state: "completed",
        focus: "Benchmark scenarios and telemetry acceptance criteria",
        ownedConcerns: [
          "baseline metrics",
          "moderated-study tasks"
        ],
        ownedFiles: [
          "docs/research/benchmark-suite.md",
          "docs/research/telemetry-schema.json"
        ],
        tokenEstimate: 18000,
        costUsd: 0.47,
        approvalsRequired: 0,
        summary: "Baseline pack is complete and ready for moderated studies."
      },
      {
        id: "agent-b",
        title: "IDE Workflow Prototyper",
        state: "completed",
        focus: "TaskArtifacts persistence and dashboard ergonomics",
        ownedConcerns: [
          "durable memory",
          "local/cloud continuity"
        ],
        ownedFiles: [
          "src/store.js",
          "src/dashboard.js"
        ],
        tokenEstimate: 26000,
        costUsd: 0.71,
        approvalsRequired: 1,
        summary: "Durable task bundles, runbooks, and dashboard continuity cues are complete."
      },
      {
        id: "agent-c",
        title: "Trust UX Researcher",
        state: "completed",
        focus: "Grouped approvals and risk messaging",
        ownedConcerns: [
          "approval friction",
          "preflight summaries"
        ],
        ownedFiles: [
          "docs/research/interview-guide.md"
        ],
        tokenEstimate: 12000,
        costUsd: 0.33,
        approvalsRequired: 2,
        summary: "Grouped approvals, preflight summaries, and review evidence are complete for the research bundle."
      }
    ],
    contextSources: [
      {
        id: "ctx-editor",
        kind: "editor",
        label: "Open files and active selection",
        score: 9.7,
        rationale: "Strongest signal for current intent and the immediate edit surface.",
        pinned: true,
        artifacts: [
          "activeEditor",
          "selection"
        ]
      },
      {
        id: "ctx-agents",
        kind: "agents",
        label: "AGENTS.md instructions",
        score: 9.1,
        rationale: "Carries durable repo- and team-level operating rules for the agent.",
        pinned: true,
        artifacts: [
          "AGENTS.md"
        ]
      },
      {
        id: "ctx-repo",
        kind: "repo",
        label: "Repo structure and changed files",
        score: 8.8,
        rationale: "Prevents wrong-file edits and improves dependency discovery.",
        pinned: false,
        artifacts: [
          "git-status",
          "tree"
        ]
      },
      {
        id: "ctx-skills",
        kind: "skills",
        label: "Generated workflow skill draft",
        score: 8.5,
        rationale: "The reusable workflow pack now captures the finished research flow and can be shared or reused.",
        pinned: false,
        artifacts: [
          "generated-skill/SKILL.md",
          "generated-skill/workflow-pack.json"
        ]
      },
      {
        id: "ctx-mcp",
        kind: "mcp",
        label: "MCP and connectors",
        score: 7.9,
        rationale: "Needed when external context is fresher than repo state.",
        pinned: false,
        artifacts: [
          "connectors"
        ]
      },
      {
        id: "ctx-web",
        kind: "web",
        label: "Cached web research",
        score: 6.4,
        rationale: "Useful for volatile facts, but lower trust than explicit local context.",
        pinned: false,
        artifacts: [
          "citations"
        ]
      }
    ],
    approvals: [
      {
        id: "approval-a",
        status: "completed",
        scope: "Workspace mutation",
        rationale: "Seed durable task artifacts and write research templates into the workspace.",
        requestedBy: "IDE Workflow Prototyper",
        command: "Create .codex-research bundle",
        lastReviewedAt: "2026-03-29T23:45:00.000Z",
        lastReviewedBy: "system",
        evidence: "Workspace artifacts, markdown runbooks, and state persistence are installed and synchronized.",
        resolution: "approved",
        milestoneId: "m2"
      },
      {
        id: "approval-b",
        status: "completed",
        scope: "Network access",
        rationale: "Compare context ranking policy against live MCP and web-backed tasks.",
        requestedBy: "Trust UX Researcher",
        command: "Run external-context benchmark",
        lastReviewedAt: "2026-03-29T23:53:00.000Z",
        lastReviewedBy: "user",
        evidence: "Prototype completion accepted local and cached-context validation, with live external benchmarking deferred beyond this repo spike.",
        resolution: "approved-with-local-validation",
        milestoneId: "m3"
      }
    ],
    recommendations: [
      "Keep plan, validation, and status files visible in the IDE instead of burying them in chat history.",
      "Expose child-agent ownership and spend before subagents become fully autonomous in the IDE.",
      "Treat approval prompts as a UX surface to optimize, not only a safety surface to enforce."
    ],
    statusNotes: [
      {
        id: "note-seed",
        timestamp: "2026-03-29T00:00:00.000Z",
        author: "system",
        kind: "seed",
        text: "Initialized Codex research workspace."
      },
      {
        id: "note-complete",
        timestamp: "2026-03-29T23:59:00.000Z",
        author: "system",
        kind: "completion",
        text: "Codex Research is complete. Milestones 3 and 4 are closed with review evidence and a generated workflow pack."
      },
      {
        id: "note-phase2",
        timestamp: "2026-03-29T00:10:00.000Z",
        author: "system",
        kind: "progress",
        text: "Phase 2 prototype work is focused on durable task bundles and visible subagent runs."
      }
    ],
    workspaceSnapshot: {
      capturedAt: "2026-03-29T23:59:00.000Z",
      activeEditor: "src/dashboard.js",
      selection: "351:13-351:57",
      visibleEditors: [
        "src/dashboard.js",
        "src/providers.js",
        "src/store.js",
        "README.md"
      ],
      agentFiles: [],
      repoSample: [
        "src/dashboard.js",
        "src/providers.js",
        "src/store.js",
        "src/domain.js",
        "README.md",
        "package.json"
      ],
      researchArtifacts: [
        ".codex-research/spec.md",
        ".codex-research/plan.md",
        ".codex-research/status.md",
        ".codex-research/implement.md",
        ".codex-research/workspace-context.md"
      ],
      generatedSkillDraft: true,
      gitDetected: true
    }
  };
}

module.exports = {
  createSampleState
};
