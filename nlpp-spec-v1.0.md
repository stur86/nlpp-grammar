# NL++ Language Specification
**Version:** 1.0  
**File Extension:** `.nlpp`  
**Language ID:** `nlpp`

---

## Overview

NL++ (Natural Language++) is a pseudocode language for expressing software architecture and implementation intent. It is not compiled or executed. Its output is a structured prompt: resolved pseudocode with an appended glossary of keyword definitions, ready to be passed to a coding agent.

The language enforces just enough structure to be toolable — syntax highlighting, autocomplete, symbol resolution, import inlining — while leaving semantic interpretation deliberately open. The LLM is the compiler.

---

## Syntax

### General Rules

- Whitespace (spaces and tabs) is insignificant beyond token separation.
- **Statements are newline-terminated.** A statement ends at the first of: a newline (`\n`), a closing brace (`}`), a fill-in marker (`???`), a line comment (`//`), a block comment (`/*`), a prose block opener (`/?`), or end of file. The terminating token is never consumed by the statement that precedes it — it belongs to the enclosing structure or starts a new statement.
- Blocks are delimited by `{ }`. The opening `{` **must be on the same line** as the statement that owns it.
- Identifiers conform to the regex `[a-zA-Z_][a-zA-Z0-9_]*`. `snake_case` and `PascalCase` are conventional but not enforced.
- Type annotations are optional everywhere and advisory when present.
- **Freeform text for the LLM must be enclosed in a prose block** (`/? … ?/`) **or be part of a fill-in marker** (`???`). A bare non-keyword line outside either of these is a parse error. Tree-sitter will still recover gracefully, but the grammar does not sanction it.

---

### Comments

Comments are for the author only. They are stripped during processing and never reach the LLM. Two forms are supported:

```nlpp
// This is a line comment. Stripped at the end of the line.

/*
  This is a block comment.
  Spans multiple lines. Stripped entirely.
*/
```

Both forms produce AST nodes (`line_comment`, `block_comment`) so editor tooling can fold, toggle, and format them. They are not `extras` — they appear as siblings in the parse tree.

To communicate intent to the LLM, use a prose block (`/? … ?/`) or a fill-in marker (`???`).

---

### Prose Blocks

A prose block is freeform text that **is** passed to the LLM verbatim. It is the designated place for natural language explanations, constraints, and design notes within a file.

```nlpp
/?
  This service owns the full order lifecycle from placement to fulfilment.
  Do not expose internal state directly — all access must go through methods.
  Leave room for cancellation edge cases.
?/
```

- Content between the delimiters is **fully opaque text** — a single raw token including newlines, passed through verbatim to the LLM. No structure is parsed inside a prose block.
- `?/` is a reserved token — it may not appear anywhere inside prose content. The first `?/` encountered always closes the block unconditionally.
- Prose blocks may appear anywhere a statement is valid: top-level, or inside a block body.

---

### Fill-in Marker

```nlpp
???
??? add pagination support here
??? "or with quotes if you prefer"
```

`???` is the **single-line prose form** — its relationship to a prose block (`/? … ?/`) mirrors that of `//` to `/* … */`. Everything following `???` on the same line is freeform text passed to the LLM verbatim. Quotes are optional and carry no special meaning — they are a style choice.

A bare `???` with no trailing text is an explicit delegation point: the author is intentionally leaving this area open for the agent to expand.

`???` is valid as a standalone statement or inside a block body. Inside a prose block (`/? … ?/`) it is treated as opaque text — it produces no AST node and carries no special meaning there.

---

### Definitions

```nlpp
define aggregate "A DDD aggregate root. Enforces invariants internally and never exposes raw internal state."
define saga "A long-running process coordinator. Implements compensating transactions on failure."
```

- `define` binds a name to a definition string. Quotes around the definition are recommended for readability but optional.
- Defined names become usable as **custom block keywords** (see [Custom Blocks](#custom-blocks)). They are treated as first-class architectural vocabulary by tools that process NL++ files.
- Defined terms propagate naturally through import inlining. The conventional location for project-wide vocabulary is `definitions.nlpp`, imported at the top of the entry file.

---

### Imports

```nlpp
import "./definitions.nlpp"
import "./domain/orders.nlpp"
```

- Inlines the full contents of the target file at the point of import. No selective imports.
- Import paths are double-quoted strings.
- Circular imports are a diagnostic warning but do not prevent processing.

---

### Block Syntax

There are three kinds of block: **function blocks**, **object blocks**, and **custom blocks**. All share the same body syntax — a type-specific keyword followed by additional information (identifiers or other keywords) and a sequence of statements wrapped in `{ }`. Each block type has its own structure between the keyword and the `{`; the details are in each subsection below.

A block keyword on a line without a `{` is a valid standalone hint — no scope is opened.

---

#### Function Blocks

Function-block keywords: `function`, `method`, `getter`, `setter`.

The header may contain an optional return-type annotation and an optional parameter list.

```nlpp
function auto compute_factorial(int x) {
    ???
}

method auto place_order(Order order) {
    uses validate_order
    uses PaymentGateway.charge
    /?
      Must be idempotent. Kicks off fulfilment on success.
    ?/
}

getter auto internal_state {
    ???
}
```

Header syntax:

```
<function_keyword> [<type>] <name> [( <param_list> )] [{ <body> }]

param_list := param (, param)*
param      := [type] name
type       := auto | identifier
```

- The return type, if present, appears immediately after the keyword and before the name.
- Parameters use **type-before-name** order (`Order order`, `int x`). The type is optional.
- `auto` means explicit type deferral — infer the appropriate type from context.
- The agent adapts all type hints to the target language's idioms.

---

#### Object Blocks

Object-block keywords: `layer`, `module`, `service`, `component`, `class`, `interface`, `enum`, `type`.

The header may contain `inherits` and `implements` clauses.

```nlpp
class OrderService implements IOrderService {
    uses PaymentGateway
    uses OrderRepository
}

class ExpressOrderService inherits OrderService {
    /?
      Same as parent but prioritises the fulfilment queue.
    ?/
}
```

Header syntax:

```
<object_keyword> <name> [inherits <name>] [implements <name>] [{ <body> }]
```

- `inherits` and `implements` may appear in any order and may be repeated.
- No other header content is valid for built-in object blocks. Arbitrary header tokens before `{` are a parse error.

---

#### Custom Blocks

Any non-reserved identifier may be used as a block keyword. This is the mechanism by which `define`d terms become first-class architectural constructs.

```nlpp
define aggregate "A DDD aggregate root. Enforces invariants internally and never exposes raw internal state."

aggregate Order {
    private field auto id
    field auto line_items
    field auto status
}
```

Custom block header syntax is deliberately loose: zero or more **header clauses**, each of the form `<word> <name_list>`, where `<word>` is any non-reserved identifier.

```
<custom_keyword> <name> [<header_clause>*] [{ <body> }]

header_clause  := non_reserved_identifier identifier_list
identifier_list := identifier (, identifier)*
```

This allows user-invented relational vocabulary in headers:

```nlpp
aggregate Order publishes OrderPlaced consumes PaymentResult {
    ???
}
```

**Semantic resolution:** Tools that process NL++ check whether the custom keyword resolves to a `define`d term. If yes, the block is treated as a defined architectural construct and its definition is included in the glossary. If the keyword is unresolved, a warning is emitted — not a parse error.

---

### Keywords

#### Object-Block Keywords

These may own an object block. Standalone (without `{`) they are valid hints.

| Keyword | Intent |
|---|---|
| `layer` | An architectural tier (e.g. `layer domain`, `layer infra`). |
| `module` | A cohesive grouping of related entities. Maps loosely to a package or folder. |
| `service` | A service boundary, internal or external. |
| `component` | A UI or logical unit. |
| `class` | A concrete implementation type. |
| `interface` | An abstract contract. |
| `enum` | A fixed set of named values. |
| `type` | A data shape or alias. |

#### Function-Block Keywords

These may own a function block with an optional signature.

| Keyword | Intent |
|---|---|
| `function` | A standalone callable. |
| `method` | A callable member. Signature is optional and advisory. |
| `getter` | A read accessor for a value. |
| `setter` | A write accessor for a value. |

All block keywords are advisory — the agent maps them to appropriate constructs in the target language and context. `class` in a functional language, for example, may become a record type plus associated functions.

#### Inline Keywords

These are always single-line statements. A `{` following an inline keyword is a parse error.

| Keyword | Intent |
|---|---|
| `define` | Binds a name to a definition string. |
| `import` | Inlines the contents of another `.nlpp` file. |
| `field` | A data member. |
| `uses` | A dependency or reference. Scope-sensitive — see [`uses` Scope Semantics](#uses--scope-semantics). |

#### Header Relations

These tokens are only valid inside block headers (object blocks and custom blocks). They are not standalone statements.

| Token | Intent |
|---|---|
| `inherits` | Extends a parent type, taking on its implementation. |
| `implements` | Declares conformance to a named interface or contract. |

---

### Access Modifiers

`public`, `private`, and `override` are optional modifiers that may prefix any **field statement**, **function block**, or **object block** (built-in or custom).

```nlpp
private field auto id
public method auto place_order(Order order) {
    ???
}
public override method auto place_order(Order order) {
    /?
      Prioritise fulfilment queue, otherwise same as parent.
    ?/
}
```

**Ordering rule:** access modifier (`public` or `private`) must come before `override`. `public override method` is valid; `override public method` is a parse error.

Modifiers are advisory — the agent applies the appropriate construct for the target language. Modifiers are **not** valid on `define`, `import`, or `uses`.

---

### `uses` — Scope Semantics

The syntax of `uses` is uniform everywhere:

```nlpp
uses PaymentGateway
uses PaymentGateway.charge
```

The target may be a simple identifier or a dotted qualified name. The **semantic weight** varies by scope:

**At class/service/component scope** — a structural dependency. The agent should inject, instantiate, or import this.

```nlpp
class OrderService implements IOrderService {
    uses PaymentGateway
    uses OrderRepository
}
```

**At method scope** — an implementation hint. This callable or resource is involved; the agent determines how.

```nlpp
method auto place_order(Order order) {
    uses validate_order
    uses PaymentGateway.charge
    /?
      Must be idempotent, kicks off fulfilment on success.
    ?/
}
```

The grammar makes no distinction. Scope-sensitive interpretation is the responsibility of the tool consuming the parse tree.

---

### Reserved Keywords

The following identifiers are reserved and may not be used as custom block keywords or header-clause words:

```
import  define  uses  field
public  private  override
function  method  getter  setter
layer  module  service  component  class  interface  enum  type
inherits  implements
auto
```

---

### Full Example

```nlpp
import "./definitions.nlpp"
// definitions.nlpp contains:
//   define aggregate "A DDD aggregate root..."
//   define saga "A long-running process coordinator..."

layer domain {

    module orders {

        interface IOrderService {
            method auto place_order(Order order)
            method auto cancel_order(auto id)
            method auto get_orders_for_user(auto user_id)
            ???
        }

        aggregate Order {
            private field auto id
            field auto line_items
            field auto status
            field auto created_at
            /?
              Consider soft-delete support.
            ?/
        }

        class OrderService implements IOrderService {
            uses PaymentGateway
            uses OrderRepository
            private field auto in_flight_tracker

            public method auto place_order(Order order) {
                uses validate_order
                uses PaymentGateway.charge
                /?
                  Must be idempotent. Kicks off fulfilment on success.
                ?/
            }

            ???
        }

        class ExpressOrderService inherits OrderService {
            override method auto place_order(Order order) {
                /?
                  Prioritise fulfilment queue, otherwise same as parent.
                ?/
            }
        }

    }

}

layer infra {

    service PaymentGateway {
        /?
          External service — do not implement. Define the boundary only.
        ?/
        method bool charge(auto amount, auto payment_method)
        method bool refund(auto charge_id)
    }

    module persistence {
        interface OrderRepository {
            method auto save(Order order)
            method auto find_by_id(auto id)
            method auto find_by_user(auto user_id)
        }
    }

}
```

`aggregate` in the example is a custom block. Its keyword resolves to the `define`d term from `definitions.nlpp`. A tool appends its definition to the glossary delivered to the LLM.

---

## Processing Model

When an NL++ file is prepared for delivery to an LLM:

1. **Import resolution** — `import` statements are resolved recursively and the referenced file's content is inlined at the import site. Files are deduplicated on canonical path.
2. **Comment stripping** — all `line_comment` and `block_comment` nodes are removed. They are author-only annotations and never reach the LLM.
3. **Prose passthrough** — prose blocks (`/? … ?/`) and fill-in markers (`???`) are retained as is; the text content is emitted verbatim.
4. **Glossary** — all distinct built-in keywords and `define`d terms in the file are collected and appended as a glossary of definitions. The appendix at the end of this document lists the built-in definitions.

No other transformation is applied.

---

## Appendix: Built-in Keyword Definitions

These definitions are indicative and not verbatim. Each implementation of preprocessing NL++ files may adopt its own favoured wording, but the core intent should be preserved. The agent relies on these definitions to interpret the architectural and implementation intent of the pseudocode.

| Keyword | Definition |
|---|---|
| `layer` | An architectural tier. Does not correspond to a specific code construct. Use to indicate separation of concerns (e.g. domain, application, infrastructure, presentation). |
| `module` | A cohesive grouping of related entities. May map to a package, folder, or namespace. The agent decides physical structure. |
| `service` | A service boundary. May be internal (a bounded context) or external (a third-party API). If described as external, define an interface or client wrapper rather than an implementation. |
| `component` | A UI or logical unit. Interpret based on surrounding architectural context. |
| `class` | A concrete implementation type. |
| `interface` | An abstract contract. Implement as the target language's idiomatic abstraction (interface, protocol, trait, abstract class). |
| `enum` | A fixed set of named values. |
| `type` | A data shape or type alias. |
| `function` | A standalone callable, not a member of a type. |
| `method` | A callable member. Signature is advisory — adapt parameter and return types to fit the implementation. Block body contains implementation hints, not implementation. |
| `getter` | A read accessor. Implement as the target language's idiomatic read accessor (getter method, computed property, etc.). |
| `setter` | A write accessor. Implement as the target language's idiomatic write accessor. |
| `field` | A data member. |
| `auto` | Explicit type deferral. Infer the most appropriate type from context. |
| `uses` | A dependency or reference. At type scope: a structural dependency to inject or import. At method scope: a callable or resource involved in the implementation. Resolve the appropriate pattern from context. |
| `implements` | This entity conforms to the named interface or contract. No implementation is inherited — provide it in full. |
| `inherits` | This entity extends the named parent type. Take on the parent's implementation and extend or override as described. |
| `public` | This member is part of the public interface of its parent. Apply the target language's appropriate access modifier. |
| `private` | This member is internal to its parent. Apply the target language's appropriate access modifier. |
| `override` | This member overrides an inherited implementation from a parent type. Apply the target language's appropriate override construct. |
| `define` | Author-defined architectural vocabulary. Treat defined terms as first-class design concepts throughout the implementation. |
| `import` | The contents of the referenced file have been inlined here. Treat it as part of this file. |
| `???` | An explicit fill-in marker — the inline prose form. The author is intentionally leaving this area open. Expand it with reasonable implementation detail based on surrounding context. Free-form hint text may follow on the same line. |
