"use strict";

const { extensionId, resolveCodeCommand, run } = require("./vsix-utils.cjs");

run(resolveCodeCommand(), ["--uninstall-extension", extensionId]);
console.log(`Uninstalled ${extensionId}`);
