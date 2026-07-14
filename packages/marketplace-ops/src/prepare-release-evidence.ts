import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { requiredEnvironment } from "./evidence-io.js";
import {
  createReleaseEvidenceManifest,
  verifyReleaseEvidenceBundle,
} from "./release-evidence.js";

const evidenceDirectory = resolve(requiredEnvironment("RELEASE_EVIDENCE_DIRECTORY"));
const manifest = await createReleaseEvidenceManifest(evidenceDirectory, {
  measuredAt: requiredEnvironment("RELEASE_EVIDENCE_MEASURED_AT"),
  evidenceS3Uri: requiredEnvironment("RELEASE_EVIDENCE_S3_URI"),
});
const releaseInputs = await verifyReleaseEvidenceBundle(evidenceDirectory, manifest);
const manifestPath = resolve(
  process.env.RELEASE_EVIDENCE_MANIFEST_PATH?.trim() ||
    `${evidenceDirectory}/manifest.json`,
);
const tfvarsPath = resolve(requiredEnvironment("RELEASE_TFVARS_PATH"));
await Promise.all([
  mkdir(dirname(manifestPath), { recursive: true }),
  mkdir(dirname(tfvarsPath), { recursive: true }),
]);
await Promise.all([
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 }),
  writeFile(tfvarsPath, `${JSON.stringify(releaseInputs, null, 2)}\n`, { mode: 0o600 }),
]);
process.stdout.write(`${JSON.stringify({ manifestPath, tfvarsPath }, null, 2)}\n`);
