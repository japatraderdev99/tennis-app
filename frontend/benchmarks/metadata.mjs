/** Capture local source provenance; no network, credential reads or external tool run. */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "frontend"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const digest = createHash("sha256");
for (const relative of [...new Set(paths)].sort()) {
  // Include missing tracked files in the digest as a deletion, not silent omission.
  digest.update(relative + "\0");
  try { const data = readFileSync(path.join(root, relative)); digest.update(String(data.length) + "\0"); digest.update(data); }
  catch (error) { if (error.code === "ENOENT") digest.update("<deleted>\0"); else throw error; }
}
console.log(JSON.stringify({
  run_id: randomUUID(), generated_at: new Date().toISOString(),
  source_commit: git(["rev-parse", "HEAD"]), source_tree_sha256: digest.digest("hex"),
  working_tree_clean: git(["status", "--porcelain", "--", "frontend"]) === "",
  environment: "local_synthetic", node_version: process.version,
  execution_kind: "deterministic_playwright",
}, null, 2));
