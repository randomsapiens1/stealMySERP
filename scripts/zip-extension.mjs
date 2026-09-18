// Regenerates public/stealmyserp-extension.zip from extension/ — run this
// after any change under extension/ so the self-install download (see
// app/extension/page.tsx) stays in sync. Shells out to the system `zip`
// (present on macOS/Linux) rather than adding a dependency for something
// this infrequent.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const extensionDir = join(repoRoot, "extension");
const outputZip = join(repoRoot, "public", "stealmyserp-extension.zip");
const archiveRootName = "stealmyserp-extension";

const stagingParent = mkdtempSync(join(tmpdir(), "stealmyserp-ext-"));
const stagingDir = join(stagingParent, archiveRootName);

try {
  mkdirSync(stagingDir, { recursive: true });
  cpSync(extensionDir, stagingDir, { recursive: true });

  if (existsSync(outputZip)) rmSync(outputZip);
  execFileSync("zip", ["-r", "-X", outputZip, archiveRootName, "-x", "*.DS_Store"], {
    cwd: stagingParent,
    stdio: "inherit",
  });
} finally {
  rmSync(stagingParent, { recursive: true, force: true });
}

console.log(`Wrote ${outputZip}`);
