import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = resolve(
  projectRoot,
  "node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh",
);

const signingMarker = "    COMPILER_INDEX_STORE_ENABLE=NO \\\n    SWIFT_COMPILATION_MODE=wholemodule \\";
const signingPatch = "    COMPILER_INDEX_STORE_ENABLE=NO \\\n    CODE_SIGNING_ALLOWED=NO \\\n    CODE_SIGNING_REQUIRED=NO \\\n    SWIFT_COMPILATION_MODE=wholemodule \\";
const metadataMarker = `  if [[ ! -d "$framework_src" ]]; then
    log "error: xcodebuild did not produce \${framework_src}"
    exit 1
  fi

  # Replace the slice in place.`;
const metadataPatch = `  if [[ ! -d "$framework_src" ]]; then
    log "error: xcodebuild did not produce \${framework_src}"
    exit 1
  fi

  # File Provider-backed workspaces can attach Finder/resource-fork metadata
  # that Apple's signing tools reject. The parent app build signs the embedded
  # framework, so keep this intermediate slice unsigned and metadata-free.
  if command -v xattr >/dev/null 2>&1; then
    xattr -cr "$framework_src"
  fi

  # Replace the slice in place.`;

let source = readFileSync(scriptPath, "utf8");
let changed = false;

if (!source.includes("CODE_SIGNING_ALLOWED=NO \\")) {
  if (!source.includes(signingMarker)) {
    throw new Error("ExpoModulesJSI signing marker changed; review the upstream build script before installing.");
  }
  source = source.replace(signingMarker, signingPatch);
  changed = true;
}

if (!source.includes('xattr -cr "$framework_src"')) {
  if (!source.includes(metadataMarker)) {
    throw new Error("ExpoModulesJSI framework marker changed; review the upstream build script before installing.");
  }
  source = source.replace(metadataMarker, metadataPatch);
  changed = true;
}

if (changed) {
  writeFileSync(scriptPath, source);
  console.log("Patched ExpoModulesJSI intermediate framework signing for File Provider-safe iOS builds.");
} else {
  console.log("ExpoModulesJSI iOS build patch already applied.");
}
