// Fixtures for the highlighter lockstep check (scripts/check-highlight-parity.mjs).
//
// Each fixture is a snippet plus a list of token assertions. A case names a token
// by its text — `nth` picks the occurrence (1-based, default 1) — and the KIND
// that BOTH the tree-sitter query and the TextMate grammar must assign it.
//
// Assert only lexically determinable tokens. Do NOT assert the type-vs-name
// boundary in ambiguous single-identifier cases, or custom-block keywords — a
// regex grammar cannot resolve those and the two highlighters are expected to
// differ there by design.

export const FIXTURES = [
  {
    name: 'comments-and-strings',
    src: [
      '// a line comment',
      '/* a block',
      '   comment */',
      'import "./other.nlpp"',
    ].join('\n'),
    cases: [
      { text: '// a line comment', kind: 'comment' },
      { text: 'a block', kind: 'comment' },
      { text: 'import', kind: 'keyword' },
      { text: '"./other.nlpp"', kind: 'string' },
    ],
  },

  {
    name: 'prose-and-fill-in',
    src: ['/? freeform text for the agent ?/', '??? expand this from context'].join('\n'),
    cases: [
      { text: 'freeform text for the agent', kind: 'special' },
      { text: '/?', kind: 'special' },
      { text: '?/', kind: 'special' },
      { text: '???', kind: 'special' },
      { text: 'expand this from context', kind: 'special' },
    ],
  },

  {
    name: 'define-and-uses',
    src: ['define aggregate "a DDD root"', 'uses PaymentGateway.charge'].join('\n'),
    cases: [
      { text: 'define', kind: 'keyword' },
      { text: 'aggregate', kind: 'constant' },
      { text: 'uses', kind: 'keyword' },
      { text: 'PaymentGateway.charge', kind: 'variable' },
    ],
  },

  {
    name: 'object-and-function',
    src: ['class User {', '    method Array[Loan] overdue(Map[string, int] grace)', '}'].join('\n'),
    cases: [
      { text: 'class', kind: 'keyword' },
      { text: 'User', kind: 'type' },
      { text: 'method', kind: 'keyword' },
      { text: 'Array', kind: 'type' },
      { text: 'Loan', kind: 'type' },
      { text: 'overdue', kind: 'function' },
      { text: 'string', kind: 'type' },
      { text: 'int', kind: 'type' },
      { text: 'grace', kind: 'parameter' },
    ],
  },

  {
    name: 'field-types',
    src: [
      'class Showcase {',
      '    field string isbn',
      '    field &Catalogue source',
      '    field Array[Copy, 32] slots',
      '    field auto id',
      '}',
    ].join('\n'),
    cases: [
      { text: 'field', kind: 'keyword', nth: 1 },
      { text: 'string', kind: 'type' },
      { text: 'isbn', kind: 'member' },
      { text: '&', kind: 'operator' },
      { text: 'Catalogue', kind: 'type' },
      { text: 'source', kind: 'member' },
      { text: 'Array', kind: 'type' },
      { text: 'Copy', kind: 'type' },
      { text: '32', kind: 'number' },
      { text: 'slots', kind: 'member' },
      { text: 'auto', kind: 'keyword' },
      { text: 'id', kind: 'member' },
    ],
  },

  {
    name: 'modifiers-and-relations',
    src: ['public override method save', 'class Admin inherits User {', '}'].join('\n'),
    cases: [
      { text: 'public', kind: 'keyword' },
      { text: 'override', kind: 'keyword' },
      { text: 'method', kind: 'keyword' },
      { text: 'save', kind: 'function' },
      { text: 'inherits', kind: 'keyword' },
    ],
  },

  {
    name: 'keyword-sets',
    comment: 'the remaining object/function keywords, so dropping one from either grammar trips a check',
    src: [
      'interface Repo {',
      '    getter name',
      '    setter value',
      '}',
      'enum Role {',
      '    field admin',
      '}',
      'module Billing {',
      '}',
    ].join('\n'),
    cases: [
      { text: 'interface', kind: 'keyword' },
      { text: 'getter', kind: 'keyword' },
      { text: 'setter', kind: 'keyword' },
      { text: 'enum', kind: 'keyword' },
      { text: 'module', kind: 'keyword' },
    ],
  },

  {
    name: 'opaque-regions',
    comment: 'a define body is one opaque token — the quotes are NOT a string — and prose is inert to anything that looks like syntax. kind:null means "no highlight" and must hold on BOTH sides.',
    src: ['define term "class method field"', '/? a class inside prose ?/', 'class X {', '    ???', '}'].join('\n'),
    cases: [
      { text: 'term', kind: 'constant' },
      { text: 'class method field', kind: null },
      { text: 'a class inside prose', kind: 'special' },
      { text: '???', kind: 'special' },
    ],
  },
]
