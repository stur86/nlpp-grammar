# NL++ Grammar Plan

A natural-language description of the parsing rules for the NL++ Tree-sitter grammar. This document is the design handoff for the Tree-sitter implementation and is not itself executable.

---

## Lexical foundation

### Whitespace and extras

Only horizontal whitespace (spaces and tabs) is consumed as invisible extras between tokens. **Newlines are not extras** — they are significant statement terminators and must appear explicitly in the grammar rules.

### Statement terminators

A statement is terminated by the **first** of the following tokens that appears after the statement begins:

1. A newline (`\n`)
2. A closing brace `}`
3. A fill-in marker `???`
4. A line comment opener `//`
5. A block comment opener `/*`
6. A prose block opener `/?`
7. End of file

The terminating token is not consumed by the statement — `}` belongs to the enclosing block, and `???` / `//` / `/*` / `/?` begin the next statement. In Tree-sitter terms, most statements will end their rule with a newline token and rely on the grammar structure to handle `}` as the block closer.

### Token types

- **`identifier`**: matches `[a-zA-Z_][a-zA-Z0-9_]*`. This is the word token for the grammar (used by Tree-sitter's conflict resolution).
- **`number`**: matches `-?[0-9]+(\.[0-9]+)?`.
- **`string`**: matches a double-quoted sequence, supporting backslash escapes: `"(\\.|[^"\\])*"`.
- **`fill_in_marker`**: the literal token `???`.
- **`line_comment_start`**: `//`; a line comment consumes everything up to (but not including) the next newline.
- **`block_comment`**: `/*` … `*/`, spanning any content including newlines.
- **`prose_open`**: `/?`; opens a prose block.
- **`prose_close`**: `?/`, but only when preceded by whitespace or newline (scanner rule — see below).

---

## Statement-level grammar

The top-level rule (`source_file`) is a repetition of zero or more statements. Inside a block body, the rule is identical — a block body is just a `source_file` wrapped in `{ }`.

A statement is one of the following, matched by its leading token:

| Leading token | Statement kind |
|---|---|
| `//` | `line_comment` |
| `/*` | `block_comment` |
| `/?` | `prose_block` |
| `???` | `fill_in` |
| `import` | `import_statement` |
| `define` | `define_statement` |
| `uses` | `uses_statement` |
| `public`, `private`, `override` | modifier-prefixed statement (see below) |
| function-block keyword | `function_block` |
| object-block keyword | `object_block` |
| any other identifier | `custom_block` |

Everything else at statement position is an error node (Tree-sitter recovers gracefully).

---

## Individual statement rules

### `line_comment`

Matches `//` followed by any characters up to (not including) the next newline. The newline is not consumed by the comment — it will be consumed as a statement terminator by whatever follows. If the line comment is the last thing in the file before EOF, no newline is needed.

The node is named `line_comment` and is a first-class AST node (not an extra).

### `block_comment`

Matches `/*` followed by any content (including newlines) up to the first `*/`. Block comments can span multiple lines. Because they span lines, they cannot use the normal newline-termination logic — they are self-terminating via `*/`.

The node is named `block_comment`.

### `prose_block`

Matches `/?` (on its own line) through `?/` (on its own line). No external scanner is needed: `?/` is a fully reserved two-character sequence that is forbidden inside prose content. The first `?/` encountered always closes the block unconditionally.

Inside the prose body, two token types alternate:

- **`prose_text`** — a regex token matching any sequence of characters (including newlines) that contains neither `?/` nor `???`. Expressed as one-or-more characters where each character is either not `?`, or is `?` not immediately followed by `/` or another `?`. Tree-sitter's token regex handles this without lookahead by consuming `?` only when the next character makes it unambiguous.
- **`fill_in`** — triggered by `???`; same rule as the standalone `fill_in` statement, consuming the optional hint text to the end of the line.

Named `prose_block` with children: sequence of `prose_text` and `fill_in` nodes.

### `fill_in`

Matches `???` optionally followed by free-form hint text — everything remaining on the same line up to the first statement terminator (newline, `//`, `/*`, or `/?`). The hint is captured as a raw text token; quotes are permitted but not required and carry no special meaning.

```
fill_in := "???" hint_text? terminator
hint_text := any characters up to the next terminator (newline / // / /* / /?)
```

Valid as a standalone statement or inside a prose block.

### `import_statement`

Matches `import` followed by a `string` token (the file path), terminated by newline. No other content is valid on the line.

```
import_statement := "import" string newline
```

### `define_statement`

Matches `define` followed by an `identifier` (the name being defined) and an optional definition. The definition, if present, is either a `string` token or the remainder of the line treated as a raw text token (for unquoted definitions). Terminated by newline.

```
define_statement := "define" identifier (string | raw_line_text)? newline
```

Tooling should encourage quoted definitions but the grammar accepts either form.

### `uses_statement`

Matches `uses` followed by a **qualified identifier** — one or more identifiers joined by `.` (e.g. `PaymentGateway`, `PaymentGateway.charge`). Terminated by newline.

```
uses_statement := "uses" qualified_identifier newline
qualified_identifier := identifier ("." identifier)*
```

---

## Modifier-prefixed statements

A statement may be optionally prefixed with access modifiers. Modifiers are only valid before `field`, function-block keywords, object-block keywords, and custom block keywords. They are **not** valid before `define`, `import`, or `uses`.

**Modifier ordering:** an optional access modifier (`public` or `private`) followed by an optional `override`. Both are optional; neither requires the other.

```
modifiers := ("public" | "private")? "override"?
```

In Tree-sitter terms, the modifier sequence is prepended to the relevant statement rules. `public override method` parses because the grammar explicitly sequences them in that order. `override public method` does not match and produces an error node.

Modifier-prefixed statements:
- `modifiers field_statement`
- `modifiers function_block`
- `modifiers object_block`
- `modifiers custom_block`

---

## Block statements

All three block kinds share the same **body** rule:

```
body := "{" statement* "}"
```

The `{` must appear on the same line as the opening keyword (enforced implicitly because newlines terminate the header before `{` can appear on a new line). The `}` terminates the last statement inside the body (as a statement terminator) and closes the block.

### `function_block`

**Keywords:** `function`, `method`, `getter`, `setter`

```
function_block := modifiers? function_keyword identifier param_clause? return_clause? body?
function_keyword := "function" | "method" | "getter" | "setter"
param_clause := "(" param_list? ")"
param_list := param ("," param)*
param := type? identifier
type := "auto" | identifier
return_clause := "->" type
```

- The identifier after the keyword is the function name.
- `param_clause` is optional. If present, it must appear before `return_clause`.
- `return_clause` (`-> type`) is optional and must appear after `param_clause` if both are present.
- `body` (`{ … }`) is optional. A function-block keyword with no `{` is a valid standalone hint.
- All of the above (keyword, name, optional signature, optional `{`) must fit on one line because of newline significance. The body itself spans multiple lines.

**Precedence:** `function_block` takes higher precedence than `custom_block` because function keywords are reserved and unambiguous.

### `object_block`

**Keywords:** `layer`, `module`, `service`, `component`, `class`, `interface`, `enum`, `type`

```
object_block := modifiers? object_keyword identifier object_header? body?
object_keyword := "layer" | "module" | "service" | "component"
               | "class" | "interface" | "enum" | "type"
object_header := header_relation+
header_relation := ("inherits" | "implements") identifier
```

- The identifier after the keyword is the type/block name.
- `object_header` is a sequence of one or more `header_relation` pairs. Each pair is `inherits <name>` or `implements <name>`. Order and repetition are both permitted.
- No other header content is valid. Anything before `{` that isn't `inherits` or `implements` + identifier is an error node.
- `body` is optional.

**Precedence:** `object_block` takes higher precedence than `custom_block`.

### `custom_block`

The fallback block rule. Matches any statement whose first token is a non-reserved identifier.

```
custom_block := modifiers? custom_keyword identifier header_clause* body?
custom_keyword := identifier  // any non-reserved identifier
header_clause := identifier identifier_list
identifier_list := identifier ("," identifier)*
```

- The first `identifier` is the custom keyword (e.g. `aggregate`, `saga`). The grammar accepts it unconditionally; the LSP checks it against the `define` symbol table.
- The second `identifier` is the block name.
- `header_clause*` is zero or more clauses of the form `<word> <name_list>`, where `<word>` is any non-reserved identifier.
- `body` is optional.

**Precedence:** `custom_block` is the lowest-priority block rule. Reserved keywords (function-block, object-block, modifiers, inline keywords) take precedence over it due to Tree-sitter's keyword matching. In practice, `custom_block` only matches when the leading identifier is not a reserved word.

**Conflict with modifier-prefixed statements:** When the parser sees `public`, it must determine whether this is a modifier prefix. Since `public` is reserved, it is never a `custom_keyword`. The parser will look at the next token: if it is another reserved keyword or identifier, it proceeds with the modifier path.

---

## Field statement

```
field_statement := modifiers? "field" type? identifier newline
type := "auto" | identifier
```

- `type` (if present) comes before the field name. Type and name are both plain identifiers; `auto` is a special type keyword.
- Terminated by newline.
- Modifiers are valid: `private field auto id`.

---

## Type expressions

Types in NL++ are kept deliberately simple at the grammar level. A type is either the keyword `auto` or a plain `identifier`. Complex type expressions (generics, union types, etc.) are not structured by the grammar — if an author writes `Promise<auto>` or `Vec<Order>`, the `<` and `>` and their contents will produce error nodes. Authors should use `auto` or a plain named type in structured positions, and place complex type descriptions in prose blocks.

This constraint may be relaxed in a future grammar version.

---

## Precedence and conflict summary

### Reserved keyword disambiguation

Tree-sitter uses the `word` rule (set to `identifier`) to distinguish reserved keywords from identifiers. All reserved words are declared as string literals in the grammar rules, and Tree-sitter's keyword extraction ensures they are matched preferentially over the `identifier` regex.

Reserved words: `import`, `define`, `uses`, `field`, `public`, `private`, `override`, `function`, `method`, `getter`, `setter`, `layer`, `module`, `service`, `component`, `class`, `interface`, `enum`, `type`, `inherits`, `implements`, `auto`.

### Statement-leading token dispatch

Because each statement kind starts with a distinct reserved keyword (or falls through to `custom_block` for non-reserved identifiers), there are no first-token conflicts between statement kinds. Tree-sitter's GLR parser handles the modifier prefix (`public`, `private`, `override`) with one token of lookahead.

### `custom_block` vs bare identifier

The only genuine ambiguity: does `foo bar` start a `custom_block` (custom keyword `foo`, name `bar`) or is it two sequential error nodes? Because `custom_block` requires exactly two identifiers in a row (keyword + name), and bare identifiers at statement position are errors, `custom_block` wins whenever two identifiers appear consecutively at statement position. A lone identifier at statement position (with no following identifier on the same line) is an error node.

### `object_block` header vs body start

After an object-block name, the parser sees either `inherits`/`implements` (header continues), `{` (body starts), or a newline (standalone hint, no body). Because `inherits` and `implements` are reserved words and `{` is a distinct token, one token of lookahead settles it.

### `function_block` `(` vs body `{`

After a function-block name, `(` starts the parameter list, `->` starts a return type, `{` starts the body, and newline ends the statement. All four are distinct tokens — no conflict.

### Prose block tokenisation

No external scanner is required. Because `?/` is reserved and forbidden inside prose content, the prose body can be tokenised with regex rules:

- `prose_text` matches any sequence of characters (including newlines) that does not contain `?/` or `???`. The regex consumes `?` only when it is not followed by `/` or `?`, handling all ambiguous cases within the token rule itself.
- `fill_in` inside a prose block is the same token as its standalone form: `???` followed by optional hint text to end of line.
- `?/` always closes the prose block — no contextual lookahead needed.

This keeps the grammar fully within Tree-sitter's built-in scanner and avoids the complexity and maintenance cost of a C external scanner.

---

## Node types summary

Named AST nodes produced by the grammar:

| Node | Description |
|---|---|
| `source_file` | Root node; sequence of statements |
| `function_block` | function/method/getter/setter block |
| `object_block` | layer/module/class/etc. block |
| `custom_block` | User-defined or defined-term block |
| `body` | `{ statement* }` — shared by all block types |
| `param_clause` | `( param_list? )` |
| `param_list` | Comma-separated parameters |
| `param` | `[type] name` |
| `return_clause` | `-> type` |
| `object_header` | Sequence of `header_relation` nodes |
| `header_relation` | `inherits`/`implements` + identifier |
| `header_clause` | Custom block header clause: word + identifier_list |
| `modifiers` | Optional access + override prefix |
| `field_statement` | `[mods] field [type] name` |
| `uses_statement` | `uses qualified_identifier` |
| `define_statement` | `define name definition` |
| `import_statement` | `import string` |
| `fill_in` | `??? [string]` |
| `prose_block` | `/?` prose content `?/` |
| `prose_text` | Raw text chunk inside a prose block |
| `line_comment` | `// …` |
| `block_comment` | `/* … */` |
| `type` | `auto` or identifier |
| `qualified_identifier` | Dotted identifier chain |
| `identifier` | Single name token |
| `string` | Double-quoted string literal |
| `number` | Numeric literal |
