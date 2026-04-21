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
