import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const registry = JSON.parse(await readFile(path.join(root, "config/intelligence-benchmarks.json"), "utf8"));
const dirFlag = process.argv.indexOf("--dir");
const datasetDir = path.resolve(root, dirFlag >= 0 ? process.argv[dirFlag + 1] ?? "" : "benchmarks");
const allowUnlocked = process.argv.includes("--allow-unlocked");

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

let failed = false;
for (const dataset of registry) {
  let filePath = null;
  for (const fileName of dataset.acceptedFileNames) {
    const candidate = path.join(datasetDir, fileName);
    try {
      if ((await stat(candidate)).isFile()) {
        filePath = candidate;
        break;
      }
    } catch {
      // Try the next accepted file name.
    }
  }

  if (!filePath) {
    console.error(`MISSING ${dataset.id}: expected ${dataset.acceptedFileNames.join(" or ")}`);
    failed = true;
    continue;
  }

  const digest = await sha256(filePath);
  if (!dataset.sha256) {
    const label = allowUnlocked ? "UNLOCKED" : "LOCK_REQUIRED";
    console.log(`${label} ${dataset.id} sha256=${digest} file=${path.basename(filePath)}`);
    if (!allowUnlocked) failed = true;
    continue;
  }

  if (digest !== dataset.sha256) {
    console.error(`HASH_MISMATCH ${dataset.id}: expected ${dataset.sha256}, received ${digest}`);
    failed = true;
    continue;
  }

  console.log(`VERIFIED ${dataset.id} sha256=${digest}`);
}

if (failed) {
  console.error("Benchmark verification failed. Do not import, train, or publish benchmark results.");
  process.exitCode = 1;
}
