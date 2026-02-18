import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function parseNpmrc(raw) {
  const entries = new Map();

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex < 0) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      entries.set(key, value);
    });

  return entries;
}

function readLockfileAutoInstallPeers(rawLockfile) {
  const match = rawLockfile.match(/^\s*autoInstallPeers:\s*(true|false)\s*$/m);
  return match ? match[1] : null;
}

describe("pnpm lockfile config", () => {
  it("pins auto-install-peers in .npmrc to match lockfile settings", () => {
    const npmrc = parseNpmrc(readFile(".npmrc"));
    const lockfileAutoInstallPeers = readLockfileAutoInstallPeers(
      readFile("pnpm-lock.yaml"),
    );

    expect(lockfileAutoInstallPeers).toBe("false");
    expect(npmrc.get("auto-install-peers")).toBe(lockfileAutoInstallPeers);
  });
});
