"use strict";

const fs = require("node:fs");
const { getVsixPath, resolveCodeCommand, run } = require("./vsix-utils.cjs");

const vsixPath = getVsixPath();
if (!fs.existsSync(vsixPath)) {
  throw new Error(`VSIX not found at ${vsixPath}. Run \`npm run package:vsix\` first.`);
}

run(resolveCodeCommand(), ["--install-extension", vsixPath, "--force"]);
console.log(`Installed ${vsixPath}`);
