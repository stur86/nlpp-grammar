# Design: reference/template type syntax + explicit method-body prose rule

**Date:** 2026-07-14
**Repos:** `nlpp-grammar` (grammar + spec, primary), `nlpp-ts-server` (downstream tooling)
**Version:** none. `nlpp-spec-v1.0.md` is edited in place; 1.0.0 remains the unreleased goal, no bump.

## Motivation

Three requests against the NL++ language:

1. Support a `&` prefix on types, meaning a reference/address (e.g. `&int`).
2. Support square brackets in types for templating (e.g. `Array[int]`), including
   integer arguments (e.g. `Array[int, 32]`).
3. Reduce friction when writing imperative pseudo-code inside a method body, where
   bare lines currently produce a cascade of syntax errors.

Items 1–2 are grammar additions. Item 3 is resolved as **documentation only** — see
Non-goals for why no grammar change is made.

## Non-goals

- **No grammar change for imperative pseudo-code in method bodies.** Allowing bare
  freeform lines requires either a greedy line token (which breaks tree-sitter's
  longest-match lexing and swallows structured forms) or an external C scanner
  (reintroducing a compiled scanner right after the project went WASM-only), and it
  collides inherently with `custom_block` (defined-term declarations are also two
  bare words). The chosen resolution keeps the grammar simple and risk-free: the
  spec is made explicit that method logic goes in a prose block `/? … ?/` or a `???`
  marker, and the existing "bare line = parse error" diagnostic stays as the signal.
- **No version bump.** The change edits the existing v1.0 spec document.
- **No changes to `nlpp-vscode` or `nlpp-claude`.**

## 1. Type syntax: `&` (reference) and `[ ]` (templating)

Today the type rule is:

```js
type: $ => choice('auto', $.identifier),
```

It is used in exactly three positions — `field_statement` (`type`), `function_block`
(`return_type`), and `param` (`type`). All three benefit automatically by extending
this one rule, made recursive:

```js
// optional & (reference) prefix, base type, optional [ template args ]
type: $ => seq(
  optional('&'),
  choice('auto', $.identifier),
  optional($.type_arguments),
),

type_arguments: $ => seq('[', $.type_arg, repeat(seq(',', $.type_arg)), ']'),

// template args are either a (recursive) type or an integer literal (e.g. a size)
type_arg: $ => choice($.type, $.number),

number: $ => /[0-9]+/,
```

### Semantics

- `&` is a single prefix denoting a reference/address. It is not repeatable (`&&`
  is not supported — YAGNI). Like all NL++ type annotations, it is advisory.
- `[ … ]` holds one or more comma-separated arguments. Each argument is itself a
  full type (so references and nesting compose) or an integer literal.
- `&` binds at the type level and `[ … ]` attaches to the base within the same type
  node, so `&Array[int]` reads as "reference to `Array[int]`" and `Array[&int]` as
  "array of references". Both are expressible.

### Accepted forms

| Example | Meaning |
|---|---|
| `&int` | reference to int |
| `Array[int]` | templated type |
| `Map[string, int]` | multiple arguments |
| `Array[Map[string, int]]` | nested templates |
| `&Array[int]` | reference to an `Array[int]` |
| `Array[&int]` | array of references |
| `Array[int, 32]` | integer literal argument (e.g. a fixed size) |
| `Array[auto]` | `auto` allowed as an argument |

### Ambiguity / conflict analysis

`&`, `[`, `]`, and integer literals are new tokens used nowhere else in the grammar,
so they do not collide with existing constructs. They also *reduce* ambiguity in the
existing type-vs-name GLR conflicts (`[$.field_statement, $.type]`,
`[$.function_block, $.type]`): an identifier name can begin with neither `&` nor `[`,
so `field &Foo bar` and `field Foo[X] bar` have an unambiguous type boundary. The
existing `conflicts` list is expected to remain sufficient; this is verified when the
parser is regenerated (`tree-sitter generate` must not report new unresolved
conflicts, and the corpus tests below must pass).

## 2. Method-body pseudo-code: explicit prose rule (docs only)

The spec already requires freeform text to live in a prose block or `???` marker, but
this is not spelled out for the specific case of imperative logic inside a method
body. Add explicit guidance and an example to the method and/or prose sections:

```nlpp
method processOrder(Order order) {
  /?
    total = sum of item.price over order.items
    return total
  ?/
}
```

State plainly: bare imperative lines (`total = 0`, `for item in …`, `return total`)
inside a body are not valid statements; wrap logic in a prose block or delegate with
`???`. No parser or LSP behavior changes.

## Affected components

### `nlpp-grammar`
- `grammar.js`: the `type`, `type_arguments`, `type_arg`, and `number` rules above.
- Regenerate the parser and `tree-sitter-nlpp.wasm` (`tree-sitter generate`, build wasm).
- `queries/highlights.scm`: the three `(type (identifier) @type)` queries currently
  match only a direct-child identifier. Update them to also highlight base type
  identifiers inside references and template arguments (recursively), highlight the
  `&` prefix (e.g. `@operator`) and the brackets (`@punctuation.bracket`), and
  highlight `number` (`@number`).
- `nlpp-spec-v1.0.md`: type-annotation section (new `&`/`[]`/number syntax with the
  table above) and the method-body prose clarification.
- Corpus tests (`test/`): one case per accepted form in the table, plus a regression
  case that a plain `identifier` and `auto` still parse as before.

### `nlpp-ts-server`
- The parser consumes the regenerated wasm; new nodes (`type_arguments`, `type_arg`,
  `number`) appear in the tree automatically — no code change required to parse them.
- Verify semantic-token highlighting still tags base type identifiers in the new
  nested shapes; adjust the highlight consumer only if it relied on the type
  identifier being a direct child of `type`.
- The preprocessor is **unaffected**: it serializes type text verbatim and the new
  tokens introduce no keywords or defined terms (the keyword glossary is unchanged;
  `auto` remains the only type keyword).
- Add parse/preprocess tests covering a field/param/return using `&`, `[]`, nesting,
  and an integer argument, asserting the compiled output preserves the type text.

## Testing plan

- **Grammar corpus:** every row of the accepted-forms table parses to the expected
  S-expression; `auto` and plain identifiers unchanged; `tree-sitter generate`
  reports no new conflicts.
- **`nlpp-ts-server`:** existing suite stays green; new tests assert (a) a document
  using the new type forms parses without diagnostics, and (b) `preprocess` output
  round-trips the exact type text (`&Array[int]`, `Array[int, 32]`, etc.).
- **Highlighting:** a fixture with `&`, templates, nesting, and a number produces
  highlight ranges for each base identifier and the number.

## Risks

- The only real risk is grammar ambiguity from the new type shapes; mitigated by the
  fact that the new tokens are otherwise unused and by the conflict analysis above,
  and gated by "`tree-sitter generate` reports no new conflicts + corpus tests pass".
- Method-body item carries no implementation risk (documentation only).
