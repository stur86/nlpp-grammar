# nlpp-grammar

Tree-sitter grammar for [NL++](https://github.com/stur86/nlpp-grammar) — a pseudocode language for expressing software architecture and implementation intent to AI coding agents.

NL++ files use the `.nlpp` extension and language ID `nlpp`. The language lets you sketch structure, dependencies, and intent in a form that is both human-readable and toolable: syntax highlighting, autocomplete, import inlining, and symbol resolution, all feeding into a structured prompt ready for a coding agent.

---

## Quick example

```nlpp
service OrderService {
    uses PaymentGateway

    method auto place_order(Order order) {
        uses PaymentGateway.charge
        /?
          Must be idempotent. Kick off fulfilment on success.
        ?/
    }

    ???
}
```

For the full language reference see [nlpp-spec-v1.0.md](nlpp-spec-v1.0.md).

---

## What this repo contains

| Path | Purpose |
|---|---|
| `grammar.js` | Tree-sitter grammar definition |
| `src/` | Generated C parser (output of `tree-sitter generate`) |
| `queries/highlights.scm` | Syntax highlighting capture groups |
| `bindings/node/` | Node entry point — locates the WASM and queries (no parsing, no dependencies) |
| `tree-sitter-nlpp.wasm` | Compiled grammar; the artifact JS consumers actually load |
| `test/` | Corpus tests (`tree-sitter test`) |
| `nlpp-spec-v1.0.md` | Full NL++ language specification |
| `CONTRIBUTING.md` | Build system details, local install, and release workflow |

---

## Building

Requires the [tree-sitter CLI](https://tree-sitter.github.io/tree-sitter/creating-parsers#installation).

```bash
npm install
tree-sitter generate   # regenerate src/ from grammar.js
tree-sitter build      # compile the shared library
```

`npm run build` runs `generate` + `build` in one step.

---

## Testing

```bash
tree-sitter test       # corpus tests in test/corpus/
npm test               # Node.js binding tests
```

---

## Syntax highlighting

Capture groups defined in `queries/highlights.scm`:

| Capture | Tokens |
|---|---|
| `@comment.line` | `//` line comments |
| `@comment.block` | `/* */` block comments |
| `@keyword` | `define`, `uses`, `field`, `inherits`, `implements`, custom block keywords |
| `@keyword.import` | `import` |
| `@keyword.function` | `function`, `method`, `getter`, `setter` |
| `@keyword.type` | object keywords (`layer`, `module`, `service`, `component`, `class`, `interface`, `enum`, `type`), `auto` |
| `@keyword.modifier` | `public`, `private`, `override` |
| `@string` | quoted strings (`"…"`) |
| `@string.special` | prose delimiters `/?` `?/`, prose text, `???` fill-in markers, hint text |
| `@constant` | `define` names |
| `@type.definition` | object and custom block names |
| `@function` | function / method / getter / setter names |
| `@variable.member` | `field` names |
| `@type` | type annotations (fields, parameters, return types) |
| `@variable.parameter` | parameter names |
| `@variable` | `uses` targets |

---

## Contributing / releasing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, prebuild instructions, and the npm release workflow.
