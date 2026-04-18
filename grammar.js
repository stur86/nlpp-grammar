/**
 * @file Parser for the Natural Language++ pseudo-code spec for AI agents
 * @author Simone Sturniolo <simonesturniolo@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "nlpp",

  // Only horizontal whitespace is invisible; newlines are significant
  extras: $ => [/[ \t]+/],
  word: $ => $.identifier,

  // GLR conflicts for the optional type-before-name pattern:
  // after a keyword, the first identifier could be return/field type OR name.
  conflicts: $ => [
    [$.function_block, $.type],
    [$.field_statement, $.type],
  ],

  rules: {

    source_file: $ => repeat($._statement),

    // A statement is either a blank-line separator, a comment, a structured
    // construct, or one of the keyword-led statement forms.
    _statement: $ => choice(
      /\n+/,
      $.line_comment,
      $.block_comment,
      $.prose_block,
      $.fill_in,
      $.import_statement,
      $.define_statement,
      $.uses_statement,
      $.field_statement,
      $.function_block,
      $.object_block,
      $.custom_block,
    ),

    // ── Comments ──────────────────────────────────────────────────────────
    // Both forms are first-class AST nodes (not extras) so editors can fold,
    // toggle, and position them. The preprocessor strips them.

    line_comment: $ => token(seq('//', /[^\n]*/)),

    block_comment: $ => token(seq(
      '/*',
      /([^*]|\*[^\/])*/,
      '*/',
    )),

    // ── Prose block ───────────────────────────────────────────────────────
    // /? … ?/ — fully opaque freeform text that reaches the LLM verbatim.
    // ?/ is reserved and forbidden inside prose, so the first ?/ always closes.
    // Everything between the delimiters is a single prose_text token.

    prose_block: $ => seq(
      '/?',
      optional($.prose_text),
      '?/',
    ),

    // Any characters (including newlines) that do not contain `?/`.
    // Regex: non-? char  |  ? not followed by /
    prose_text: $ => token(/([^?]|\?[^\/])+/),

    // ── Fill-in marker ────────────────────────────────────────────────────
    // ??? is the inline prose / delegation marker.
    // Everything on the rest of the line (until \n) is the hint text.

    fill_in: $ => seq(
      '???',
      optional($.hint_text),
    ),

    hint_text: $ => token(/[^\n]+/),

    // ── Import ────────────────────────────────────────────────────────────

    import_statement: $ => seq(
      'import',
      field('path', $.string),
    ),

    // ── Define ────────────────────────────────────────────────────────────

    define_statement: $ => seq(
      'define',
      field('name', $.identifier),
      optional(field('definition', $.define_body)),
    ),

    // Captures the entire remainder of the line. Preprocessor handles quotes.
    define_body: $ => token(/[^\n]+/),

    // ── Uses ──────────────────────────────────────────────────────────────

    uses_statement: $ => seq(
      'uses',
      field('target', $.qualified_identifier),
    ),

    // Supports dotted paths: PaymentGateway.charge
    qualified_identifier: $ => prec.left(seq(
      $.identifier,
      repeat(seq('.', $.identifier)),
    )),

    // ── Field statement ───────────────────────────────────────────────────

    field_statement: $ => seq(
      optional($.modifiers),
      'field',
      optional(field('type', $.type)),
      field('name', $.identifier),
    ),

    // ── Modifiers ─────────────────────────────────────────────────────────
    // Ordering rule: [public|private] [override]. At least one must be present.

    modifiers: $ => choice(
      seq($.access_modifier, optional('override')),
      'override',
    ),

    access_modifier: $ => choice('public', 'private'),

    // ── Function block ────────────────────────────────────────────────────
    // function / method / getter / setter
    // Header: [return_type] name [(params)]
    // Body optional; standalone (no body) is a valid hint.

    function_block: $ => seq(
      optional($.modifiers),
      field('keyword', $.function_keyword),
      optional(field('return_type', $.type)),
      field('name', $.identifier),
      optional(field('params', $.param_clause)),
      optional(field('body', $.body)),
    ),

    function_keyword: $ => choice('function', 'method', 'getter', 'setter'),

    param_clause: $ => seq(
      '(',
      optional($.param_list),
      ')',
    ),

    param_list: $ => seq(
      $.param,
      repeat(seq(',', $.param)),
    ),

    // [type] name — type is optional, GLR resolves the ambiguity
    param: $ => choice(
      seq(field('type', $.type), field('name', $.identifier)),
      field('name', $.identifier),
    ),

    // ── Object block ──────────────────────────────────────────────────────
    // layer / module / service / component / class / interface / enum / type
    // Header: zero or more inherits/implements pairs

    object_block: $ => seq(
      optional($.modifiers),
      field('keyword', $.object_keyword),
      field('name', $.identifier),
      optional(field('header', $.object_header)),
      optional(field('body', $.body)),
    ),

    object_keyword: $ => choice(
      'layer', 'module', 'service', 'component',
      'class', 'interface', 'enum', 'type',
    ),

    object_header: $ => repeat1($.header_relation),

    header_relation: $ => seq(
      field('keyword', choice('inherits', 'implements')),
      field('target', $.identifier),
    ),

    // ── Custom block ──────────────────────────────────────────────────────
    // Any non-reserved identifier as keyword (e.g. defined terms like `aggregate`).
    // Header: zero or more <word> <name_list> clauses (user-extensible).
    // Semantic resolution (defined term vs unknown) is handled by the LSP.

    // prec.right: prefer shifting more header_clauses over reducing the rule early
    custom_block: $ => prec.right(seq(
      optional($.modifiers),
      field('keyword', $.identifier),
      field('name', $.identifier),
      repeat($.header_clause),
      optional(field('body', $.body)),
    )),

    header_clause: $ => seq(
      field('word', $.identifier),
      $.identifier_list,
    ),

    identifier_list: $ => seq(
      $.identifier,
      repeat(seq(',', $.identifier)),
    ),

    // ── Body (shared by all block types) ──────────────────────────────────

    body: $ => seq(
      '{',
      repeat($._statement),
      '}',
    ),

    // ── Type annotation ───────────────────────────────────────────────────

    type: $ => choice('auto', $.identifier),

    // ── Basic tokens ──────────────────────────────────────────────────────

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    string: $ => /"(?:\\.|[^"\\])*"/,
    number: $ => /-?\d+(\.\d+)?/,
  },
});
