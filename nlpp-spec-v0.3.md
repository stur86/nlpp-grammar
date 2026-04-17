# NL++ Language Specification
**Version:** 0.3.1 (Draft)
**File Extension:** `.nlpp`
**Language ID:** `nlpp`

---

## Overview

NL++ (Natural Language++) is a pseudocode language for expressing software architecture and implementation intent. It is not compiled or executed. Its output is a structured prompt: resolved pseudocode with an appended glossary of keyword definitions, ready to be passed to a coding agent.

The language enforces just enough structure to be toolable — syntax highlighting, autocomplete, symbol resolution, import inlining — while leaving semantic interpretation deliberately open. The LLM is the compiler.

---

## Tooling Architecture

All tooling lives in a single MCP server. It provides:

1. **Language Server** — LSP implementation for the VSCode extension. Handles syntax, diagnostics, autocomplete, and symbol resolution across `.nlpp` files.
2. **Keyword Registry** — Hardcoded definitions for all built-in keywords. User-defined terms via `define` are merged at parse time.
3. **`nlpp_preprocessor` tool** — Accepts an entry file, resolves imports recursively, strips comments, collects all keywords and `define`d terms used, appends their definitions as a glossary, and returns a single string to be injected in the prompt.

The VSCode extension wraps the MCP's LSP surface. No separate language server binary.

---

## Syntax

### General Rules

- Whitespace is insignificant beyond token separation.
- Statements are newline-terminated. No semicolons.
- Blocks are delimited by `{ }`. The opening `{` **must be on the same line** as the statement that owns it.
- Identifiers are commonly `snake_case` or `PascalCase`, but all names conforming to the regex `[a-zA-Z_][a-zA-Z0-9_]*` are valid. No enforcement.
- Identical/overlapping identifiers will raise a warning; this is appended also to the prompt to guide the agent to resolve the naming conflict if real.
- Type annotations are optional everywhere.
- Unrecognised tokens are passed through as opaque content. There are no syntax errors.

---

### Comments

```nlpp
// This is a comment. Visible to the author in the editor, stripped by the preprocessor.
// Never reaches the LLM.
```

Comments are for the author only. To communicate intent to the LLM, write natural language directly in the body of a block — it passes through as-is.

---

### Fill-in Marker

```nlpp
???
??? "add pagination support here"
```

`???` is an explicit delegation marker. It signals that the author is intentionally leaving this area open for the agent to expand. The optional string hint provides direction. It is not required — plain natural language in a block body serves the same purpose — but it is a useful convention for marking intentional gaps versus incidental ones.

---

### Definitions

```nlpp
define aggregate "A DDD aggregate root. Enforces invariants internally and never exposes raw internal state."
define saga "A long-running process coordinator. Implements compensating transactions on failure."
```

- `define` binds a word to a definition string (though quotes are optional, they help readability). The word is to all effect an identifier from now on.
- Defined words are treated identically to built-in keywords by `nlpp_preprocessor` — if the word appears anywhere in the resolved file, its definition is appended to the glossary.
- Definitions propagate naturally through import inlining.
- The conventional location for project-wide vocabulary is `definitions.nlpp`, imported at the top of the entry file.

---

### Imports

```nlpp
import "./definitions.nlpp"
import "./domain/orders.nlpp"
```

- Inlines the full contents of the target file at the point of import. No selective imports.
- `nlpp_preprocessor` resolves imports recursively and deduplicates on canonical path.
- Circular imports are a diagnostic warning but do not prevent processing (order of inlining is non-deterministic in this case).

---

### Block Syntax and Ownership

A block keyword followed by `{` on the same line opens a scope. Everything between the keyword and the `{` is the **header** — the parser accepts arbitrary content there, treating the first identifier as the symbol name for resolution purposes and passing the remainder through as context.

```
<block-keyword> <header content> {
    <body>
}
```

A `{` on its own line always opens an anonymous block — no ownership, no symbol, passed through as opaque content.

A block keyword on a line without a `{` is a standalone hint — valid, no scope opened.

---

### Keywords

#### Block Keywords

These may own a block. The block is optional — a block keyword without `{` is a valid standalone statement.

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
| `function` | A standalone callable. |
| `method` | A callable member. Signature is optional and advisory. |
| `getter` | A read accessor for a value. |
| `setter` | A write accessor for a value. |

The definitions should stress that these are to be intended as architectural concepts. For example, `class` will easily map to a first-order concept in any OOP language, but in a language like C or Julia it may be more of a logical grouping of type + methods that accept that type as the first argument. The agent should be guided to interpret these keywords in a way that makes sense for the target language and context.

#### Inline Keywords

These are always single-line. A `{` following an inline keyword is a diagnostic warning.

| Keyword | Intent |
|---|---|
| `define` | Binds a word to a definition string. |
| `import` | Inlines the contents of another `.nlpp` file. |
| `field` | A data member. |
| `uses` | A dependency or reference. Scope-sensitive — see below. |
| `implements` | Declares conformance to a named interface or contract, without inheriting implementation. |
| `inherits` | Extends a parent type, taking on its implementation. |

#### Access Modifiers

`public`, `private`, and `override` are optional modifiers that may prefix any block or inline keyword.

```nlpp
private field auto id
public method auto place_order(Order order) {
    ???
}
private getter auto internal_state {
    ???
}
public override method auto place_order(Order order) {
    prioritise fulfillment queue, otherwise same as parent
}
```

Modifiers are advisory — the agent applies the appropriate construct for the target language. Omitting a modifier leaves the decision to the agent. Modifiers may be combined where it makes sense: `public override method`.

---

### `uses` — Scope Semantics

`uses` carries different weight depending on where it appears.

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
    kicks off fulfillment after payment, must be idempotent
}
```

Same keyword, looser semantics at inner scope. This is intentional — the LLM resolves it from context.

---

### `implements` vs `inherits`

```nlpp
class Dog inherits Animal implements ITrainable {
    ???
}
```

- `implements` — conform to a contract. No implementation is inherited; the agent must provide it.
- `inherits` — extend a parent type. The parent's implementation is taken on; the agent extends or overrides as needed.

Both are inline keywords and may appear together. The agent maps them to the target language's idiomatic constructs.

---

### Type Annotations

Optional everywhere. Advisory when present — the agent adapts to the target language.

```nlpp
method int compute_factorial(int x)
method auto process(auto input)
method Promise<auto> fetch_user(string id)
```

- `auto` — explicit deferral, infer the appropriate type.
- Any other identifier is a type name. Host-language types (`string`, `Promise<T>`, `Result<T, E>`, etc.) are valid.
- Previously defined identifiers (`define`d terms, `type`s, `class`es, etc.) are also valid types.
- The agent is tasked with interpreting the spirit of the hint and inferring the closest match in the target language. 
- No special collection syntax. Use whatever fits the target context: `Array<Order>`, `Vec<Order>`, `auto`.

---

### Full Example

```nlpp
import "./definitions.nlpp"

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
            consider soft-delete support
        }

        class OrderService implements IOrderService {
            uses PaymentGateway
            uses OrderRepository
            private field auto in_flight_tracker

            public method auto place_order(Order order) {
                uses validate_order
                uses PaymentGateway.charge
                must be idempotent, kicks off fulfillment on success
            }

            ???
        }

        class ExpressOrderService inherits OrderService {
            override method auto place_order(Order order) {
                prioritise fulfillment queue, otherwise same as parent
            }
        }

    }

}

layer infra {

    service PaymentGateway {
        external, do not implement — define the boundary only
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

---

## Preprocessor

Before `craft_prompt` appends the glossary, the preprocessor:

1. Resolves `import` statements recursively, inlining file contents at import site. Deduplicates on canonical path.
2. Strips all `//` comments.
3. Walks the result, collecting all distinct built-in keywords and `define`d terms that appear in the file.

No other transformation. Natural language content in block bodies is passed through verbatim.

---

## `nlpp_preprocessor` Tool

**Signature:**
```
nlpp_preprocessor(entry_file: string) -> string
```

**Output format:**
```
<preprocessed nlpp content>

---
KEYWORD GLOSSARY
The following terms appear in the pseudocode above. Treat them as architectural intent.

layer: ...
module: ...
aggregate: ...
uses: ...
???: ...
```

Only keywords present in the file are included.

---

## Language Server Features (VSCode)

| Feature | Behaviour |
|---|---|
| Syntax highlighting | Block keywords, inline keywords, modifiers, `define`, `import`, `???`, type annotations, comments |
| Autocomplete | Built-in keywords, `define`d terms in scope, symbols from imported files |
| Diagnostics | Unresolved `import` paths, circular imports, `{` following an inline keyword |
| Go to definition | Resolves named entities across files |
| Hover | Shows keyword or `define`d term definition inline |

---

## Appendix: Built-in Keyword Definitions (Registry)

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
| `???` | An explicit fill-in marker. The author is intentionally leaving this area open. Expand it with reasonable implementation detail based on surrounding context. An optional string hint may follow. |
