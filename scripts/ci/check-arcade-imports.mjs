import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = join(root, "src");
const allowed = new Set(["src/lib/marketplace/write-adapter.ts"]);
const violations = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (![".ts", ".tsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) {
      continue;
    }
    const repoPath = relative(root, path);
    const source = await readFile(path, "utf8");
    if (source.includes("@cartridge/arcade") && !allowed.has(repoPath)) {
      violations.push(repoPath);
    }
  }
}

await visit(sourceRoot);
if (violations.length > 0) {
  console.error(
    `Production Arcade imports must remain inside the write adapter:\n${violations.join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log("Arcade production import boundary verified.");
}
