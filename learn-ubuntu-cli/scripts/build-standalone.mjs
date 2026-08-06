#!/usr/bin/env node
/* ==========================================================================
   build-standalone.mjs — flatten a multi-file lesson into one self-contained
   page, for hosting somewhere that can't serve ../assets/.

   The workspace keeps lessons split across shared components on purpose:
   one stylesheet, one quiz widget, one checklist widget, reused by every
   lesson. That structure is the source of truth. This script is the export
   step, not a second copy to maintain — never edit the output by hand.

   Usage:
     node scripts/build-standalone.mjs <input.html> [more.html ...]

   Emits <name>.html into dist/, with:
     - referenced stylesheets and scripts inlined
     - <html>/<head>/<body> stripped, since the host wraps its own skeleton
     - local links rewritten via scripts/link-map.json, or unwrapped to plain
       text when the target won't exist at the destination
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const MAP_PATH = join(ROOT, "scripts", "link-map.json");

const linkMap = existsSync(MAP_PATH)
  ? JSON.parse(readFileSync(MAP_PATH, "utf8"))
  : {};

const STYLESHEET = /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g;
const SCRIPT_SRC = /<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g;

/** Collect the contents of every file referenced by `pattern`. */
function collect(html, pattern, dir, kind) {
  const parts = [];
  for (const [, href] of html.matchAll(pattern)) {
    const file = resolve(dir, href);
    if (!existsSync(file)) throw new Error(`missing ${kind}: ${href}`);
    parts.push(readFileSync(file, "utf8").trim());
  }
  return parts;
}

/**
 * Rewrite links that point at other files in the workspace.
 * A mapped target becomes its published URL. An unmapped one would 404 at the
 * destination, so the anchor is unwrapped to its own text — a dead-looking
 * link is worse than no link.
 */
function rewriteLinks(html) {
  return html.replace(
    /<a href="((?!https?:|mailto:|#)[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g,
    (whole, href, attrs, text) => {
      const key = href.replace(/^\.\.\//, "").replace(/^\.\//, "");
      const mapped = linkMap[key];
      return mapped ? `<a href="${mapped}"${attrs}>${text}</a>` : text;
    }
  );
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("usage: node scripts/build-standalone.mjs <input.html> ...");
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });

for (const input of inputs) {
  const path = resolve(ROOT, input);
  const dir = dirname(path);
  const raw = readFileSync(path, "utf8");

  const title = (raw.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1].trim();
  const styles = collect(raw, STYLESHEET, dir, "stylesheet");
  const scripts = collect(raw, SCRIPT_SRC, dir, "script");

  const body = (raw.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [, raw])[1]
    .replace(SCRIPT_SRC, "")
    .trim();

  const out = [
    `<title>${title}</title>`,
    `<style>\n${styles.join("\n\n")}\n</style>`,
    rewriteLinks(body),
    ...scripts.map((s) => `<script>\n${s}\n</script>`),
  ].join("\n\n") + "\n";

  const name = basename(path);
  writeFileSync(join(DIST, name), out);
  console.log(`built dist/${name}  (${(out.length / 1024).toFixed(1)} kB)`);
}
