# Contributing

---

## Build system

This package ships the grammar as **WebAssembly only**. There is no native
addon: no `binding.gyp`, no `node-gyp`, no prebuilds. Installing it never
requires a C toolchain, and consumers parse with
[web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter).

Two artifacts come out of `grammar.js`:

**Generated C parser** — `tree-sitter generate` reads `grammar.js` and writes
`src/parser.c`, `src/grammar.json`, and `src/node-types.json`. These are
deterministic text, and they are committed. CI regenerates them and fails on any
diff, so they can never drift from `grammar.js`.

Keeping `src/parser.c` committed is what lets any tree-sitter consumer use this
grammar straight from the repo, without npm. Editors work this way: a Zed
extension, for instance, points at `repository` + `rev` (a commit SHA) in its
`extension.toml` and builds the grammar from these sources — it never looks at
npm, and needs no language-specific manifest here. (Zed extensions keep their own
copy of the highlight queries, so `queries/highlights.scm` is the canonical
source to sync *from*, not the file Zed reads.)

The Rust, Go, Python, Swift, and C binding scaffolds were removed: they were
`tree-sitter init` output that had never been built or tested, and they only
matter for publishing to crates.io / PyPI / SwiftPM, which this project does not
do. `tree-sitter init` regenerates them in seconds if that ever changes.

**WASM** — `tree-sitter build --wasm` compiles `src/parser.c` into
`tree-sitter-nlpp.wasm` via emscripten. This is the artifact every JavaScript
consumer actually uses.

Key npm scripts:

| Script | What it does |
|---|---|
| `npm run build` | `tree-sitter generate && tree-sitter build --wasm` |
| `npm test` | Run the corpus tests in `test/corpus/` |
| `npm start` | Launch the Tree-sitter playground (interactive parser UI) |
| `npm run prepublishOnly` | Same as `build` — runs automatically before `npm publish` |

Building the WASM locally needs emscripten (`emcc`) on `PATH`; the tree-sitter
CLI falls back to Docker if it isn't found.

### A note on the committed WASM

`tree-sitter-nlpp.wasm` is committed, which is not a pattern to imitate. It is
there for one reason: the sibling repos currently depend on this package through
`git+ssh://…#main`, and **git dependencies do not run `prepublishOnly`** — that
is a publish-only lifecycle hook. Without the artifact in the tree, a git-dep
install would have no grammar at all. Adding a `prepare` script that builds it
would push emscripten onto every consumer's machine, which is exactly what
dropping the native build avoided.

Once this package is on npm and the consumers depend on the registry version,
the committed WASM should be deleted and `prepublishOnly` left to build it into
the tarball.

Its bytes depend on the emscripten version, so a local rebuild will generally
*not* match the committed file. That is expected. CI is the reference
environment — if you need the canonical artifact, take the one CI produces
rather than trying to match it locally.

---

## Package layout

| Export | What it is |
|---|---|
| `nlpp-grammar` | Native-free module: `wasmPath`, `HIGHLIGHTS_QUERY`, `highlightsQueryPath`, `nodeTypeInfo` |
| `nlpp-grammar/wasm` | The `.wasm` file itself |
| `nlpp-grammar/queries/highlights` | The highlighting query `.scm` |

The entry point only *locates* things — it does no parsing, and pulls in no
dependencies. Typical use:

```js
import { Parser, Language } from "web-tree-sitter";
import { wasmPath } from "nlpp-grammar";

await Parser.init();
const parser = new Parser();
parser.setLanguage(await Language.load(wasmPath));
```

In a browser the entry point throws on purpose — it resolves filesystem paths.
Import `nlpp-grammar/wasm` as a bundler asset and load the resulting URL instead.

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

Prefer option 2 when you want to know what consumers will actually get. A
symlinked or in-repo checkout can hide packaging mistakes, because it exposes
files that `files` does not ship. `~/nlpp-test/test-grammar.sh` automates this
whole check.

---

## Testing

```bash
npm test                    # corpus tests
npx tree-sitter parse FILE  # parse a file, exits non-zero on failure
```

When checking syntax by hand, trust `tree-sitter parse`'s **exit code**, not a
grep of its output. The parser recovers from some invalid input by inserting a
zero-width `(MISSING …)` node rather than an `ERROR` node, so grepping for
`ERROR` can report success on input that was actually rejected.

---

## CI

| Workflow | Trigger | What it does |
|---|---|---|
| `test.yml` | push to `main`, PRs | Corpus tests; regeneration drift check; builds the WASM and parses with it; packs and installs the tarball into an empty project |
| `release.yml` | manual (`workflow_dispatch`) | Runs `test.yml`, tags `v<version>`, creates a GitHub Release, then calls `publish.yml` |
| `publish.yml` | called by `release.yml` | Builds and publishes to npm with provenance |

The drift check is the important one: `tree-sitter generate` involves no
emscripten, so `src/` must always match `grammar.js` byte for byte. If CI fails
there, run `npm run build` and commit the result.

The emscripten version is pinned in both `test.yml` and `publish.yml`, and the
two must stay in step — it determines the bytes of the published artifact.

---

## Publishing to npm

Releases go through `release.yml` (Actions → Release → Run workflow). It refuses
to run if the tag for the current `package.json` version already exists, so bump
the version first.

Authentication is **npm trusted publishing (OIDC)** — there is no `NPM_TOKEN`
secret. The `id-token: write` permission lets the workflow mint a short-lived
credential, and npm verifies it against the trusted publisher configured for this
repo on npmjs.com. This also means `--provenance` works, attaching a signed
attestation linking the package to the workflow run that built it.

Trusted publishing requires **npm >= 11.5.1**; `setup-node` ships npm 10.x, so
the workflow upgrades npm explicitly. Removing that step produces an auth failure
that gives no hint about the real cause.
