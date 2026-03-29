"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { extensionId, getVsixPath, resolveCodeCommand, resolveVsceEntrypoint, run } = require("./vsix-utils.cjs");

try {
  run(resolveCodeCommand(), ["--uninstall-extension", extensionId]);
} catch (error) {
  console.log(`Continuing after uninstall attempt failed: ${error.message}`);
}

const vsixPath = getVsixPath();
fs.mkdirSync(path.dirname(vsixPath), { recursive: true });

run(process.execPath, [resolveVsceEntrypoint(), "package", "--out", vsixPath]);
run(resolveCodeCommand(), ["--install-extension", vsixPath, "--force"]);
console.log(`Reinstalled ${extensionId} from ${vsixPath}`);
