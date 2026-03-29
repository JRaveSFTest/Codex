"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getVsixPath, resolveVsceEntrypoint, run } = require("./vsix-utils.cjs");

const outputPath = getVsixPath();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { force: true });
}

run(process.execPath, [resolveVsceEntrypoint(), "package", "--out", outputPath]);
console.log(`Created ${outputPath}`);
