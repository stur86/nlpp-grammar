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
  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._statement),

    // Shared statement rule — used by both source_file and block bodies
    _statement: $ => choice(
      $.block,
      $.block_keyword_statement,
      $.define_statement,
      $.import_statement,
      $.identifier,
      $.number,
      $.string,
      $.plain_text,
    ),

    // BLOCK KEYWORDS
    // Pattern: <keyword> <identifier> optional({ ..._statement... })
    block_keyword_statement: $ => prec.right(seq(
      field('keyword', $.block_keyword),
      field('name', $.identifier),
      optional(field('body', $.block))
    )),
    block_keyword: $ => choice(
      'layer',
      'module',
      'service',
      'component',
      'class',
      'interface',
      'enum',
      'type',
      'function',
      'method',
      'getter',
      'setter',
    ),

    // BLOCK
    block: $ => seq(
      '{',
      repeat($._statement),
      '}'
    ),

    // STATEMENTS
    // Define statement
    define_statement: $ => seq(
      'define',
      field('name', $.identifier),
      optional($.define_body)
    ),
    define_body: $ => token(/[^\n]+/),

    // Import statement
    import_statement: $ => seq(
      'import',
      field('path', $.string),
      token(/[^\n]*/),
    ),

    // BASIC TOKENS
    identifier: $ => token(/[a-zA-Z_][a-zA-Z0-9_]*/),
    number: $ => token(/-?\d+(\.\d+)?/),
    string: $ => token(/"(?:\\.|[^"\\])*"/),
    plain_text: $ => prec(-1, token(/[^\s]+/)),
  }
});
