# Contributing

---

## Build system

The build pipeline has two layers:

**Tree-sitter layer** — `tree-sitter generate` reads `grammar.js` and writes the generated C parser into `src/` (`parser.c`, `grammar.json`, `node-types.json`). `tree-sitter build` compiles `src/parser.c` into a shared library (`.so` / `.dylib` / `.dll`) used by the CLI and by tests. `tree-sitter build --wasm` produces `tree-sitter-nlpp.wasm` for browser and web-based tooling.

**Node binding layer** — `node-gyp` compiles `bindings/node/binding.cc` (a thin N-API wrapper around the C parser) into a native `.node` addon. `node-gyp-build` (the `install` script) picks up a pre-compiled binary from `prebuilds/` if one is present for the current platform, and falls back to compiling from source otherwise.

Key npm scripts:

| Script | What it does |
|---|---|
| `npm run build` | `tree-sitter generate && tree-sitter build` |
| `npm run prebuild` | Compile a native `.node` binary via `prebuildify` and place it in `prebuilds/` |
| `npm run prepublishOnly` | `tree-sitter generate && tree-sitter build --wasm` — runs automatically before `npm publish` |
| `npm start` | Launch the Tree-sitter playground (interactive web UI for testing the parser) |
| `npm test` | Run the Node.js binding tests |

To run the corpus tests (the `.txt` files in `test/corpus/`) use `tree-sitter test` directly — these are not wired into `npm test`.

---

## Local install (for use in other packages during development)

**Option 1 — `npm link` (live symlink, changes reflected immediately):**

```bash
# In this repo
npm run build
npm link

# In your consuming project
npm link nlpp-grammar
```

**Option 2 — `npm pack` (closest to a real publish):**

```bash
# In this repo
npm run build
npm pack                          # produces nlpp-grammar-<version>.tgz

# In your consuming project
npm install /path/to/nlpp-grammar-<version>.tgz
```

Both options compile the native binding from source on the consuming machine. To skip the C toolchain requirement on the consumer side, build a prebuild first (see below).

---

## Prebuilds

A prebuild is a pre-compiled `.node` binary placed under `prebuilds/<platform>-<arch>/`. At install time, `node-gyp-build` detects a matching prebuild and uses it directly, bypassing the C compilation step. This is what makes it possible to install the package without having a C toolchain.

To build a prebuild for the current platform:

```bash
npm run prebuild
```

For distribution, prebuilds should be built on all target platforms (Linux x64/arm64, macOS x64/arm64, Windows x64) and committed to the release artifact. The GitHub Actions workflow handles this automatically — see below.

---

## Publishing to npm

1. Make sure you are logged in: `npm login`
2. Bump the version in `package.json` as appropriate.
3. Run:

```bash
npm publish
```

`prepublishOnly` regenerates the parser and rebuilds the WASM automatically before the package is packed. For a release that does not require a C toolchain on the consumer side, build prebuilds via CI before publishing (see below), or run `npm run prebuild` locally for a single-platform prebuild.

---

## GitHub Actions release workflow

`.github/workflows/publish.yml` automates multi-platform prebuild compilation and npm publication.

**Setup (once):**

Add an `NPM_TOKEN` secret to the repository (Settings → Secrets → Actions → New repository secret). The token must have publish access to the package.

**Triggering a release:**

Push a version tag to trigger the workflow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

**What the workflow does:**

1. **Prebuild job** (runs in parallel on 5 platforms: Linux x64, Linux arm64, macOS x64, macOS arm64, Windows x64) — installs dependencies, runs `npm run prebuild`, and uploads the resulting `prebuilds/` directory as a GitHub Actions artifact.
2. **Publish job** (runs after all prebuild jobs succeed) — downloads all prebuild artifacts, merges them, and runs `npm publish --provenance --access public`. npm provenance attaches a signed attestation linking the published package to this workflow run.
