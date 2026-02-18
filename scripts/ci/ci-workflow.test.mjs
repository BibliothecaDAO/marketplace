import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");

function readWorkflow() {
  return fs.readFileSync(workflowPath, "utf8");
}

describe("ci workflow", () => {
  it("runs the full verification gate", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("run: pnpm lint");
    expect(workflow).toContain("run: pnpm typecheck");
    expect(workflow).toContain("run: pnpm test:coverage");
    expect(workflow).toContain("run: pnpm build");
    expect(workflow).toContain("run: pnpm test:e2e");
    expect(workflow).toContain("run: pnpm run test:e2e:screenshots");
    expect(workflow).not.toContain("if: steps.feature_routes.outputs.has_routes == 'true'");
    expect(workflow).not.toContain("name: Resolve diff range");
    expect(workflow).not.toContain("name: Detect feature routes");
  });

  it("always uploads CI artifacts for debugging", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("name: Upload feature screenshots");
    expect(workflow).toContain("name: Upload Playwright artifacts");
    expect(workflow).toContain("if: always()");
  });
});
