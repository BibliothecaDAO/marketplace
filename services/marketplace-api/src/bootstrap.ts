import { telemetry } from "./telemetry.js";

await import("./server.js");

process.once("beforeExit", () => {
  void telemetry?.shutdown();
});
