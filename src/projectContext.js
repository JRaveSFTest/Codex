"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

async function captureProjectContext(rootPath, agentRelativePaths = []) {
  const packageInfo = await readPackageInfo(rootPath);
  const readmeSummary = await readSummaryFromFile(path.join(rootPath, "README.md"));
  const uniqueAgentPaths = unique(agentRelativePaths);
  const agentContexts = [];
  const linkedDocsByPath = new Map();

  for (const relativePath of uniqueAgentPaths) {
    const fullPath = path.join(rootPath, relativePath.split("/").join(path.sep));
    const content = await readTextIfExists(fullPath);
    if (!content) {
      continue;
    }

    const summary =
      extractSectionParagraph(content, ["Purpose", "Overview", "Objective"]) || extractFirstParagraph(content);
    const priorities = unique([
      ...extractSectionBullets(content, ["Current priorities"], 6),
      ...extractSectionBullets(content, ["Product direction"], 4),
      ...extractSectionBullets(content, ["Editing expectations"], 4),
      ...extractSectionBullets(content, ["Good defaults for future agents"], 4)
    ]).slice(0, 8);
    const linkedDocs = [];

    for (const linkedPath of await resolveWorkspaceLinks(rootPath, relativePath, content)) {
      linkedDocs.push(linkedPath);
      if (!linkedDocsByPath.has(linkedPath)) {
        const linkedSummary = await readSummaryFromFile(path.join(rootPath, linkedPath.split("/").join(path.sep)));
        linkedDocsByPath.set(linkedPath, {
          path: linkedPath,
          summary: linkedSummary
        });
      }
    }

    agentContexts.push({
      path: relativePath,
      summary,
      priorities,
      linkedDocs
    });
  }

  const linkedDocs = [...linkedDocsByPath.values()];
  const guidanceFiles = unique([
    ...agentContexts.map((item) => item.path),
    ...linkedDocs.map((item) => item.path)
  ]);
  const priorities = unique(agentContexts.flatMap((item) => item.priorities)).slice(0, 8);
  const displayName = packageInfo?.displayName || packageInfo?.name || path.basename(rootPath);
  const summary = firstNonEmpty(
    agentContexts.map((item) => item.summary),
    [packageInfo?.description, readmeSummary, linkedDocs.find((item) => item.summary)?.summary]
  );

  return {
    displayName,
    packageName: packageInfo?.name ?? null,
    packageDescription: packageInfo?.description ?? null,
    readmeSummary,
    summary,
    guidanceFiles,
    priorities,
    agentContexts,
    linkedDocs
  };
}

async function readPackageInfo(rootPath) {
  const content = await readTextIfExists(path.join(rootPath, "package.json"));
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readSummaryFromFile(targetPath) {
  const content = await readTextIfExists(targetPath);
  if (!content) {
    return null;
  }

  return extractSectionParagraph(content, ["Purpose", "Overview", "Objective", "Summary"]) || extractFirstParagraph(content);
}

async function readTextIfExists(targetPath) {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

function extractSectionParagraph(markdown, headings) {
  for (const heading of headings) {
    const sectionLines = getSectionLines(markdown, heading);
    if (sectionLines.length === 0) {
      continue;
    }

    const paragraph = extractFirstParagraph(sectionLines.join("\n"));
    if (paragraph) {
      return paragraph;
    }
  }

  return null;
}

function extractSectionBullets(markdown, headings, limit = 6) {
  for (const heading of headings) {
    const sectionLines = getSectionLines(markdown, heading);
    if (sectionLines.length === 0) {
      continue;
    }

    const bullets = sectionLines
      .map((line) => line.trim())
      .filter((line) => /^[-*+]\s+/.test(line))
      .map((line) => cleanInlineMarkdown(line.replace(/^[-*+]\s+/, "")))
      .filter(Boolean)
      .slice(0, limit);

    if (bullets.length > 0) {
      return bullets;
    }
  }

  return [];
}

function getSectionLines(markdown, headingName) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const normalizedHeading = headingName.trim().toLowerCase();
  const collected = [];
  let activeDepth = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const label = cleanInlineMarkdown(headingMatch[2]).toLowerCase();
      if (activeDepth !== null && depth <= activeDepth) {
        break;
      }
      if (label === normalizedHeading) {
        activeDepth = depth;
      }
      continue;
    }

    if (activeDepth !== null) {
      collected.push(line);
    }
  }

  return collected;
}

function extractFirstParagraph(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const paragraphs = [];
  let current = [];
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }
    if (!line) {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
      continue;
    }
    if (/^#{1,6}\s+/.test(line) || /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^</.test(line)) {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    paragraphs.push(current.join(" "));
  }

  for (const paragraph of paragraphs) {
    const cleaned = cleanInlineMarkdown(paragraph);
    if (cleaned) {
      return truncate(cleaned, 280);
    }
  }

  return null;
}

async function resolveWorkspaceLinks(rootPath, sourceRelativePath, content) {
  const matches = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  const resolved = [];
  const sourceFullPath = path.join(rootPath, sourceRelativePath.split("/").join(path.sep));
  const sourceDir = path.dirname(sourceFullPath);

  for (const match of matches) {
    const target = String(match[1] ?? "").trim();
    if (!target || isExternalLink(target)) {
      continue;
    }

    const normalizedTarget = target.split("#")[0].split("?")[0].trim();
    if (!normalizedTarget) {
      continue;
    }

    const fullPath = path.resolve(sourceDir, normalizedTarget);
    if (!isPathInsideRoot(rootPath, fullPath)) {
      continue;
    }
    if (!(await pathExists(fullPath))) {
      continue;
    }

    resolved.push(toRelativePath(rootPath, fullPath));
  }

  return unique(resolved);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isExternalLink(target) {
  return /^(?:[a-z]+:|#)/i.test(target);
}

function isPathInsideRoot(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function toRelativePath(rootPath, targetPath) {
  return path.relative(rootPath, targetPath).split(path.sep).join("/");
}

function cleanInlineMarkdown(value) {
  return truncate(
    String(value ?? "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\s+/g, " ")
      .trim(),
    280
  );
}

function truncate(value, limit) {
  if (!value || value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function firstNonEmpty(primaryValues, secondaryValues = []) {
  for (const value of [...primaryValues, ...secondaryValues]) {
    if (value) {
      return value;
    }
  }
  return null;
}

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

module.exports = {
  captureProjectContext,
  extractFirstParagraph,
  extractSectionBullets,
  extractSectionParagraph
};
