"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(repoRoot, "package.json"));
const extensionId = `${packageJson.publisher}.${packageJson.name}`;

function getVsixFileName() {
  return `${packageJson.name}-${packageJson.version}.vsix`;
}

function getVsixPath() {
  return path.join(repoRoot, "dist", getVsixFileName());
}

function resolveVsceEntrypoint() {
  const entryPoint = path.join(repoRoot, "node_modules", "@vscode", "vsce", "vsce");
  if (!fs.existsSync(entryPoint)) {
    throw new Error(
      "The VSCE packaging tool is not installed. Run `npm install` (or `npm.cmd install` on Windows PowerShell) first."
    );
  }
  return entryPoint;
}

function resolveCodeCommand() {
  return process.env.VSCODE_CLI || (process.platform === "win32" ? "code.cmd" : "code");
}

function shouldUseShell(command, platform = process.platform) {
  return platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

function quotePowerShellArgument(value) {
  const text = String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function buildPowerShellCommand(command, args) {
  const quotedArgs = args.map((arg) => quotePowerShellArgument(arg)).join(" ");
  return `& ${quotePowerShellArgument(command)}${quotedArgs ? ` ${quotedArgs}` : ""}`;
}

function run(command, args, options = {}) {
  const baseOptions = {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options
  };

  const result = shouldUseShell(command)
    ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", buildPowerShellCommand(command, args)], baseOptions)
    : spawnSync(command, args, baseOptions);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

module.exports = {
  repoRoot,
  packageJson,
  extensionId,
  getVsixPath,
  resolveVsceEntrypoint,
  resolveCodeCommand,
  shouldUseShell,
  quotePowerShellArgument,
  buildPowerShellCommand,
  run
};
