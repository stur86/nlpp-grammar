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
      choice($.identifier, $.number, $.plain_text)
    ),

    // Basic elements
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    number: $ => /-?\d+(\.\d+)?/,
    plain_text: $ => prec(-1, /[^\s]+/),
  }
});
