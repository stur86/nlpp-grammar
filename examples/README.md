# Examples

Between them these files exercise every feature in the
[spec](../nlpp-spec-v1.0.md). Every one is parsed by CI, so they cannot drift
away from the grammar.

| File | What it shows |
|---|---|
| `class.nlpp` | The smallest useful file — a `define`, a `class`, a `???`. Start here. |
| `definitions.nlpp` | `define`d vocabulary, quoted and unquoted; line and block comments |
| `types.nlpp` | Every type-annotation form: `&`, `[ … ]`, nesting, `auto`, integer arguments |
| `catalogue.nlpp` | Object blocks (`layer`/`module`/`class`/`interface`/`enum`/`type`), function blocks (`function`/`method`/`getter`/`setter`), access modifiers, `inherits`/`implements`, `uses` at both scopes |
| `lending.nlpp` | Custom blocks and header clauses, prose blocks, all three `???` forms |
| `app.nlpp` | An entry file: `import`, standalone keyword hints, composition |

Compile the whole system to the prompt an agent would receive:

```bash
npx nlpp-compile examples/app.nlpp
```

`app.nlpp` imports the other files, so this resolves the lot into a single
prompt (~10k characters) with the keyword glossary appended.

## Two deliberate quirks

**`lending.nlpp` uses an undefined keyword on purpose.** The `workflow` block
resolves to nothing, so compiling emits
`warning: unresolved_custom_keyword: "workflow"`. That warning *is* the
demonstration: the grammar doesn't police your vocabulary, and an unknown block
keyword is a warning rather than a parse error.

**Prose is not parsed.** Inside `/? … ?/`, braces, keywords and even `???` are
opaque text. The one thing you cannot write there is `?/` itself — the first one
always closes the block.

## Gotchas worth knowing

- `enum` bodies hold **statements** (`field available`), not bare
  comma-separated names. `enum Role { admin, member }` does not parse — `enum`
  is an ordinary object keyword and its body is an ordinary block body.
- **There is no `T[]` shorthand.** Template brackets take at least one argument:
  write `Array[Copy]`, not `Copy[]`.
- **Implementation logic goes in prose.** Bare imperative lines (`total = 0`,
  `for item in items`) are parse errors. Wrap them in `/? … ?/` — the agent
  reads them as intent just the same.
- **Modifier order is fixed:** `public override method` is valid,
  `override public method` is not.
