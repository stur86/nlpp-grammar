/**
 * @file Parser for the Natural Language++ pseudo-code spec for AI agents
 * @author Simone Sturniolo <simonesturniolo@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "nlpp",
  extras: $ => [/\s+/],

  rules: {
    source_file: $ => repeat(
      choice($.identifier, $.number, $.plain_text, $.string, $.inline_keyword)
    ),

    // Keywords
    inline_keyword: $ => choice(
      "define", "import", "field", "uses", "implements", "inherits"
    ),

    // Basic elements
    identifier: $ => token(/[a-zA-Z_][a-zA-Z0-9_]*/),
    number: $ => token(/-?\d+(\.\d+)?/),
    string: $ => token(/"(?:\\.|[^"\\])*"/),
    plain_text: $ => prec(-1, /[^\s]+/),
  }
});
