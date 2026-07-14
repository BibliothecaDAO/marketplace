import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function environmentNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} is invalid.`);
  return value;
}

export async function emitEvidence(value: unknown, outputPath?: string): Promise<void> {
  const output = `${JSON.stringify(value, null, 2)}\n`;
  if (outputPath?.trim()) {
    const absolute = resolve(outputPath.trim());
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, output, { mode: 0o600 });
  }
  process.stdout.write(output);
}
