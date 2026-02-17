import { execFileSync } from "node:child_process";
import fs from "node:fs";

const APP_PREFIX = "src/app/";
const PAGE_SUFFIX = "/page.tsx";
const DYNAMIC_SEGMENT_SAMPLES = {
  address: "0xabc",
  collection: "0xabc",
  tokenId: "1",
  token: "1",
  id: "sample",
  slug: "sample",
};

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").trim();
}

function sampleDynamicSegment(segmentName) {
  return DYNAMIC_SEGMENT_SAMPLES[segmentName] ?? "sample";
}

function normalizeRoute(route) {
  if (!route) {
    return "/";
  }

  const withoutTrailingSlash = route.endsWith("/") && route !== "/"
    ? route.slice(0, -1)
    : route;

  return withoutTrailingSlash;
}

export function routeFromAppPage(filePath) {
  const normalizedPath = normalizePath(filePath);
  if (!normalizedPath.startsWith(APP_PREFIX) || !normalizedPath.endsWith(PAGE_SUFFIX)) {
    return null;
  }

  const relativeDir = normalizedPath.slice(APP_PREFIX.length, -PAGE_SUFFIX.length);
  if (relativeDir.length === 0) {
    return "/";
  }

  const segments = relativeDir
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const dynamicMatch = /^\[(.+)\]$/.exec(segment);
      if (!dynamicMatch) {
        return segment;
      }

      return sampleDynamicSegment(dynamicMatch[1]);
    });

  return normalizeRoute(`/${segments.join("/")}`);
}

function isFrontendFeatureFile(filePath) {
  return (
    filePath.startsWith("src/app/") ||
    filePath.startsWith("src/features/") ||
    filePath.startsWith("src/components/marketplace/")
  );
}

function routeHintsForFile(filePath) {
  const routes = [];

  const appRoute = routeFromAppPage(filePath);
  if (appRoute) {
    routes.push(appRoute);
  }

  if (
    filePath === "src/app/layout.tsx" ||
    filePath === "src/app/globals.css" ||
    filePath.startsWith("src/components/marketplace/")
  ) {
    routes.push("/");
  }

  if (
    filePath.startsWith("src/features/collections/") ||
    filePath.startsWith("src/app/collections/")
  ) {
    routes.push("/collections/0xabc");
  }

  if (filePath.startsWith("src/features/ops/") || filePath.startsWith("src/app/ops/")) {
    routes.push("/ops");
  }

  return routes;
}

export function collectFeatureScreenshotRoutes(changedFiles) {
  const normalizedFiles = changedFiles.map(normalizePath).filter(Boolean);
  const frontendFiles = normalizedFiles.filter(isFrontendFeatureFile);
  if (frontendFiles.length === 0) {
    return [];
  }

  const routes = new Set();
  frontendFiles.forEach((filePath) => {
    routeHintsForFile(filePath).forEach((route) => {
      routes.add(normalizeRoute(route));
    });
  });

  return Array.from(routes).sort((a, b) => a.localeCompare(b));
}

function parseChangedFilesInput(raw) {
  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function isNullSha(sha) {
  return /^0+$/.test(sha);
}

function gitDiffFiles(baseSha, headSha) {
  if (!baseSha || !headSha || isNullSha(baseSha) || isNullSha(headSha)) {
    return [];
  }

  try {
    const output = execFileSync("git", ["diff", "--name-only", `${baseSha}...${headSha}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return parseChangedFilesInput(output);
  } catch {
    return [];
  }
}

function resolveChangedFilesFromEnv() {
  const directList = parseChangedFilesInput(process.env.CHANGED_FILES);
  if (directList.length > 0) {
    return directList;
  }

  const bySha = gitDiffFiles(process.env.CI_BASE_SHA, process.env.CI_HEAD_SHA);
  if (bySha.length > 0) {
    return bySha;
  }

  try {
    const output = execFileSync("git", ["diff", "--name-only", "HEAD~1...HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseChangedFilesInput(output);
  } catch {
    return [];
  }
}

function writeGitHubOutputs(routes) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  fs.appendFileSync(outputPath, `has_routes=${routes.length > 0}\n`);
  fs.appendFileSync(outputPath, `routes_json=${JSON.stringify(routes)}\n`);
}

function main() {
  const changedFiles = resolveChangedFilesFromEnv();
  const routes = collectFeatureScreenshotRoutes(changedFiles);

  writeGitHubOutputs(routes);

  if (routes.length === 0) {
    console.log("No feature routes changed.");
    return;
  }

  routes.forEach((route) => console.log(route));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
