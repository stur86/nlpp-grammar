# nlpp-grammar

Tree-sitter grammar for [NL++](https://github.com/stur86/nlpp-grammar) — a pseudocode language for expressing software architecture and implementation intent to AI coding agents.

NL++ files use the `.nlpp` extension and language ID `nlpp`.

---

## What this repo contains

| Path | Purpose |
|---|---|
| `grammar.js` | Tree-sitter grammar definition |
| `src/` | Generated C parser (output of `tree-sitter generate`) |
| `queries/highlights.scm` | Syntax highlighting capture groups |
| `integrations/neovim/` | Neovim setup module (nvim-treesitter) |
| `bindings/` | Language bindings (Node, Python, Rust, Go, Swift, C) |
| `test/` | Corpus tests (`tree-sitter test`) |
| `nlpp-spec-v0.4.md` | Full NL++ language specification |

---

## Building

Requires the [tree-sitter CLI](https://tree-sitter.github.io/tree-sitter/creating-parsers#installation).

```bash
npm install
tree-sitter generate   # regenerate src/ from grammar.js
tree-sitter build      # compile the shared library
tree-sitter test       # run corpus tests
```

`npm run build` runs `generate` + `build` in one step.

---

## Publishing

### Local install (for use in other packages during development)

**Option 1 — `npm link` (live symlink, changes reflected immediately):**

```bash
# In this repo
npm run build
npm link

# In your consuming project
npm link tree-sitter-nlpp
```

**Option 2 — `npm pack` (closest to a real install):**

```bash
# In this repo
npm run build
npm pack                          # produces tree-sitter-nlpp-<version>.tgz

# In your consuming project
npm install /path/to/tree-sitter-nlpp-<version>.tgz
```

Both options compile the native binding from source on the consuming machine.
To ship a pre-compiled binary instead (skips the C toolchain requirement), run
`npm run prebuild` before packing — this places a `.node` file under `prebuilds/`
that will be picked up automatically at install time via `node-gyp-build`.

### Publishing to npm

1. Make sure you are logged in: `npm login`
2. Bump the version in `package.json` as appropriate.
3. Run:

```bash
npm publish
```

`prepublishOnly` will regenerate the parser and rebuild the WASM automatically.
For a release intended to avoid requiring a C toolchain on the consumer side,
build prebuilds via CI (see below) before publishing, or run `npm run prebuild`
locally for a single-platform prebuild.

### Prebuilds and the GitHub Actions release workflow

The `.github/workflows/publish.yml` workflow automates multi-platform prebuild
compilation and npm publication. To use it:

1. Add an `NPM_TOKEN` secret to the repository
   (Settings → Secrets → Actions → New repository secret).
2. Push a version tag to trigger the workflow:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow builds native binaries for Linux x64/arm64, macOS x64/arm64, and
Windows x64, then publishes the package with all prebuilds included.

---

## Syntax highlighting

Capture groups defined in `queries/highlights.scm`:

| Capture | Tokens |
|---|---|
| `@comment.line` | `//` line comments, `???` hint text |
| `@comment.block` | `/* */` block comments |
| `@keyword` | `define`, `uses`, `inherits`, `implements`, custom block keywords |
| `@keyword.import` | `import` |
| `@keyword.function` | `function`, `method`, `getter`, `setter` |
| `@keyword.type` | object keywords (`class`, `interface`, `layer`, …), `auto` |
| `@keyword.modifier` | `public`, `private`, `override` |
| `@string` | quoted strings (`"…"`) |
| `@string.special` | prose block content (`/? … ?/`) |
| `@punctuation.special` | prose delimiters `/?` `?/`, fill-in marker `???` |
| `@constant` | `define` names |
| `@type.definition` | object and custom block names |
| `@function` | function / method / getter / setter names |
| `@variable.member` | `field` names |
| `@type` | type annotations (fields, params, return types) |
| `@variable.parameter` | parameter names |
| `@variable` | `uses` targets |
| `@number` | numeric literals |
