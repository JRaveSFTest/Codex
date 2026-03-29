"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldUseShell, quotePowerShellArgument, buildPowerShellCommand } = require("../scripts/vsix-utils.cjs");

test("shouldUseShell enables shell execution for Windows cmd shims only", () => {
  assert.equal(shouldUseShell("vsce.cmd", "win32"), true);
  assert.equal(shouldUseShell("code.cmd", "win32"), true);
  assert.equal(shouldUseShell("install.bat", "win32"), true);
  assert.equal(shouldUseShell("vsce", "win32"), false);
  assert.equal(shouldUseShell("vsce.cmd", "linux"), false);
});

test("PowerShell command helpers quote paths and arguments safely", () => {
  assert.equal(quotePowerShellArgument("C:\\Users\\Josh\\Documents\\VS Code Projects\\Codex"), "'C:\\Users\\Josh\\Documents\\VS Code Projects\\Codex'");
  assert.equal(quotePowerShellArgument("it's"), "'it''s'");
  assert.equal(
    buildPowerShellCommand("code.cmd", ["--install-extension", "C:\\output path\\bundle.vsix", "--force"]),
    "& 'code.cmd' '--install-extension' 'C:\\output path\\bundle.vsix' '--force'"
  );
});
