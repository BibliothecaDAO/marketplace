import { describe, expect, it, vi } from "vitest";
import { createNextDevHttpsArgs, runDevHttps } from "./dev-https.mjs";

function createMockChild() {
  const listeners = {};
  return {
    on(event, callback) {
      listeners[event] = callback;
      return this;
    },
    emit(event, ...args) {
      if (listeners[event]) {
        listeners[event](...args);
      }
    },
  };
}

describe("createNextDevHttpsArgs", () => {
  it("includes experimental https flag and extra args", () => {
    expect(createNextDevHttpsArgs(["-p", "3001"])).toEqual([
      "dev",
      "--experimental-https",
      "-p",
      "3001",
    ]);
  });

  it("drops npm/pnpm arg separator", () => {
    expect(createNextDevHttpsArgs(["--", "--port", "3001"])).toEqual([
      "dev",
      "--experimental-https",
      "--port",
      "3001",
    ]);
  });
});

describe("runDevHttps", () => {
  it("spawns next dev with https args and inherited stdio", () => {
    const child = createMockChild();
    const spawnImpl = vi.fn(() => child);

    runDevHttps({
      spawnImpl,
      extraArgs: ["-p", "3001"],
      onExit: vi.fn(),
      onError: vi.fn(),
    });

    expect(spawnImpl).toHaveBeenCalledWith(
      "next",
      ["dev", "--experimental-https", "-p", "3001"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("forwards child process exit events", () => {
    const child = createMockChild();
    const spawnImpl = vi.fn(() => child);
    const onExit = vi.fn();

    runDevHttps({
      spawnImpl,
      onExit,
      onError: vi.fn(),
    });
    child.emit("exit", 0, null);

    expect(onExit).toHaveBeenCalledWith(0, null);
  });

  it("forwards child process errors", () => {
    const child = createMockChild();
    const spawnImpl = vi.fn(() => child);
    const onError = vi.fn();
    const error = new Error("spawn failed");

    runDevHttps({
      spawnImpl,
      onExit: vi.fn(),
      onError,
    });
    child.emit("error", error);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
