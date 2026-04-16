/**
 * @file Parser for the Natural Language++ pseudo-code spec for AI agents
 * @author Simone Sturniolo <simonesturniolo@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "nlpp",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
