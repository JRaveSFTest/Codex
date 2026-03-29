"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { captureProjectContext } = require("../src/projectContext");

test("captureProjectContext reads AGENTS guidance and linked docs from the active repo", async () => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-project-context-"));

  await fs.mkdir(path.join(rootPath, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(rootPath, "package.json"),
    JSON.stringify({
      name: "m4b-deck",
      description: "Electron player for DRM-free audiobooks."
    }),
    "utf8"
  );
  await fs.writeFile(path.join(rootPath, "README.md"), "# m4b-deck\n\nWarm desktop audiobook player.\n", "utf8");
  await fs.writeFile(
    path.join(rootPath, "AGENTS.md"),
    [
      "# AGENTS.md",
      "",
      "## Purpose",
      "",
      "This is a local-first Electron desktop player for DRM-free `.m4b` audiobooks.",
      "",
      "## Current priorities",
      "",
      "- Keep the lower-right dashboard reachable.",
      "- Follow [docs/MP3_IMPLEMENTATION_PLAN.litcoffee](docs/MP3_IMPLEMENTATION_PLAN.litcoffee).",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootPath, "docs", "MP3_IMPLEMENTATION_PLAN.litcoffee"),
    "# Plan\n\nMP3 import is the active next feature.\n",
    "utf8"
  );

  const context = await captureProjectContext(rootPath, ["AGENTS.md"]);

  assert.equal(context.displayName, "m4b-deck");
  assert.match(context.summary, /local-first Electron desktop player/i);
  assert.ok(context.guidanceFiles.includes("AGENTS.md"));
  assert.ok(context.guidanceFiles.includes("docs/MP3_IMPLEMENTATION_PLAN.litcoffee"));
  assert.ok(context.priorities.some((item) => item.includes("lower-right dashboard")));
  assert.equal(context.linkedDocs[0].path, "docs/MP3_IMPLEMENTATION_PLAN.litcoffee");
});
