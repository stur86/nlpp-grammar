#!/usr/bin/env node
//
// Verify the package as a stranger installing it from npm would see it.
//
// This packs a tarball and installs it into an empty project, rather than
// testing the repo in place, because the two are not the same thing: the working
// tree exposes files that `files` doesn't ship, and leftover build artifacts can
// make a broken package look healthy. That gap is exactly what hid a main entry
// point that threw for every consumer while importing fine in-repo.
//
//   node scripts/check-package.mjs
//
// Exits non-zero if the packaged entry points don't work.

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = fileURLToPath(new URL("../", import.meta.url));
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

const work = mkdtempSync(join(tmpdir(), "nlpp-grammar-pkg-"));
let failed = false;

try {
  const tarball = join(work, run("npm", ["pack", "--silent", "--pack-destination", work], repo).split("\n").pop());
  console.log(`packed ${tarball.split("/").pop()}`);

  const consumer = join(work, "consumer");
  mkdirSync(consumer, { recursive: true });
  run("npm", ["init", "-y"], consumer);
  run("npm", ["install", tarball], consumer);
  console.log("installed into a clean consumer project");

  // Resolve by package name from the consumer's context, never by internal
  // path: going straight to bindings/node/index.js would bypass the `exports`
  // map, so this check would pass even with the entry point unreachable.
  const consumerRequire = createRequire(join(consumer, "/"));
  const entry = consumerRequire.resolve("nlpp-grammar");

  // The package must import with nothing else installed — it has no runtime
  // dependencies, and the entry point does no parsing.
  const mod = await import(pathToFileURL(entry).href);

  const expected = ["wasmPath", "highlightsQueryPath", "HIGHLIGHTS_QUERY", "nodeTypeInfo"];
  const missing = expected.filter((k) => mod[k] === undefined);
  if (missing.length > 0) {
    console.error(`::error::entry point is missing exports: ${missing.join(", ")}`);
    failed = true;
  }

  // A path export that points at nothing is worse than no export at all.
  if (mod.wasmPath && !existsSync(mod.wasmPath)) {
    console.error(`::error::wasmPath points at a file that does not exist: ${mod.wasmPath}`);
    failed = true;
  }

  // The subpaths nlpp-ts-server and nlpp-vscode actually consume. `./textmate`
  // is the TextMate grammar that nlpp-vscode copies in at build time and that
  // Shiki loads on the web.
  for (const subpath of ["nlpp-grammar/wasm", "nlpp-grammar/queries/highlights", "nlpp-grammar/textmate"]) {
    try {
      consumerRequire.resolve(subpath);
      console.log(`ok  ${subpath} resolves`);
    } catch (e) {
      console.error(`::error::${subpath} does not resolve: ${e.code ?? e.message}`);
      failed = true;
    }
  }

  if (!failed) console.log("ok  entry point exports and subpaths all resolve");
} finally {
  rmSync(work, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
