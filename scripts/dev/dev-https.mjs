import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function createNextDevHttpsArgs(extraArgs = []) {
  const normalizedArgs =
    extraArgs[0] === "--" ? extraArgs.slice(1) : extraArgs;
  return ["dev", "--experimental-https", ...normalizedArgs];
}

export function defaultOnExit(code, signal) {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
}

export function defaultOnError(error) {
  console.error("Failed to start HTTPS dev server.", error);
  process.exit(1);
}

export function runDevHttps({
  spawnImpl = spawn,
  command = "next",
  extraArgs = process.argv.slice(2),
  onExit = defaultOnExit,
  onError = defaultOnError,
} = {}) {
  const child = spawnImpl(command, createNextDevHttpsArgs(extraArgs), {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => onExit(code, signal));
  child.on("error", (error) => onError(error));

  return child;
}

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  runDevHttps();
}
