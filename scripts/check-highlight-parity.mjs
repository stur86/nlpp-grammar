#!/usr/bin/env node
//
// Lockstep check between the two NL++ highlighters:
//
//   - grammar.js + queries/highlights.scm   (tree-sitter, precise)
//   - nlpp.tmLanguage.json                  (TextMate, first-paint + web)
//
// They are different formalisms with different granularity, so "identical
// output" is not a meaningful goal. Instead each side is normalised to a small
// shared vocabulary of KINDS (keyword, type, function, string, ...), and the
// fixtures in scripts/parity-fixtures.mjs assert that specific, lexically
// determinable tokens carry the same kind in both. That is the tripwire: add a
// keyword to one grammar and forget the other, and its assertion fails.
//
// Deliberately NOT asserted: the type-vs-name disambiguation and custom-block
// keywords, which a regex grammar cannot resolve. Fixtures avoid them.
//
//   node scripts/check-highlight-parity.mjs           # run the assertions
//   node scripts/check-highlight-parity.mjs --dump FILE  # eyeball both sides
//
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Parser, Language, Query } from 'web-tree-sitter'
import onigDefault from 'vscode-oniguruma'
import vsctmDefault from 'vscode-textmate'
import { FIXTURES } from './parity-fixtures.mjs'

// vscode-oniguruma and vscode-textmate are CJS; their API lives on the default
// export when imported from ESM.
const oniguruma = onigDefault
const vsctm = vsctmDefault

const root = new URL('../', import.meta.url)
const p = (rel) => fileURLToPath(new URL(rel, root))

// ── Shared vocabulary ───────────────────────────────────────────────────────
// Both a tree-sitter capture name and a TextMate scope collapse to one of these.
// Coarse on purpose: finer distinctions produce false mismatches without adding
// real safety. `null` means "carries no highlight" (whitespace, braces, a define
// body) and is never asserted on.

// tree-sitter capture (from highlights.scm) → kind. Longest prefix wins.
const CAPTURE_KIND = [
  ['comment', 'comment'],
  ['keyword.import', 'keyword'],
  ['keyword.function', 'keyword'],
  ['keyword.modifier', 'keyword'],
  ['keyword.type', 'keyword'],
  ['keyword', 'keyword'],
  ['type.definition', 'type'],
  ['type', 'type'],
  ['function', 'function'],
  ['constant', 'constant'],
  ['variable.member', 'member'],
  ['variable.parameter', 'parameter'],
  ['variable', 'variable'],
  ['number', 'number'],
  ['operator', 'operator'],
  ['punctuation', 'punctuation'],
  ['string.special', 'special'],
  ['string', 'string'],
]

// TextMate scope → kind. Longest prefix wins.
const SCOPE_KIND = [
  ['comment', 'comment'],
  ['string.other.prose', 'special'],
  ['string.other.fill-in', 'special'],
  ['string.quoted', 'string'],
  ['constant.character.escape', 'string'],
  ['constant.numeric', 'number'],
  ['constant.other.definition', 'constant'],
  ['keyword.operator', 'operator'],
  ['keyword.other.auto', 'keyword'],
  ['keyword', 'keyword'],
  ['storage.modifier', 'keyword'],
  ['entity.name.type', 'type'],
  ['entity.name.function', 'function'],
  ['variable.other.member', 'member'],
  ['variable.parameter', 'parameter'],
  ['variable.other', 'variable'],
  ['punctuation.section.parameters', 'punctuation'],
  ['punctuation.definition.typeargs', 'punctuation'],
  ['punctuation.separator', 'punctuation'],
  // meta.definition.body and bare source.nlpp intentionally have no kind.
]

const longestPrefixMatch = (table, name) => {
  let best = null
  let bestLen = -1
  for (const [prefix, kind] of table) {
    if ((name === prefix || name.startsWith(prefix + '.')) && prefix.length > bestLen) {
      best = kind
      bestLen = prefix.length
    }
  }
  return best
}

const captureKind = (name) => longestPrefixMatch(CAPTURE_KIND, name)
const scopeKind = (scopes) => {
  // innermost (last) scope that maps to a kind wins
  for (let i = scopes.length - 1; i >= 0; i--) {
    const k = longestPrefixMatch(SCOPE_KIND, scopes[i])
    if (k !== null) return k
  }
  return null
}

// ── tree-sitter side ─────────────────────────────────────────────────────────
await Parser.init()
const language = await Language.load(p('tree-sitter-nlpp.wasm'))
const tsParser = new Parser()
tsParser.setLanguage(language)
const query = new Query(language, readFileSync(p('queries/highlights.scm'), 'utf8'))

// Map each captured character range to a kind. Later (more specific) captures in
// the query override earlier ones at the same span, matching how tree-sitter
// highlighting resolves overlaps.
function treeSitterKinds(src) {
  const tree = tsParser.parse(src)
  const spans = [] // { start, end, kind }
  for (const c of query.captures(tree.rootNode)) {
    const kind = captureKind(c.name)
    if (kind === null) continue
    spans.push({ start: c.node.startIndex, end: c.node.endIndex, kind })
  }
  // kind at a byte offset: last matching span wins
  return (offset) => {
    let kind = null
    for (const s of spans) if (offset >= s.start && offset < s.end) kind = s.kind
    return kind
  }
}

// ── TextMate side ────────────────────────────────────────────────────────────
await oniguruma.loadWASM(readFileSync(p('node_modules/vscode-oniguruma/release/onig.wasm')).buffer)
const registry = new vsctm.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }),
  loadGrammar: async (scope) =>
    scope === 'source.nlpp'
      ? vsctm.parseRawGrammar(readFileSync(p('nlpp.tmLanguage.json'), 'utf8'), p('nlpp.tmLanguage.json'))
      : null,
})
const tmGrammar = await registry.loadGrammar('source.nlpp')

// kind at a byte offset, computed line by line (TextMate is line-oriented).
function textMateKinds(src) {
  const lines = src.split('\n')
  const lineStart = [] // byte offset of each line start
  let acc = 0
  for (const line of lines) {
    lineStart.push(acc)
    acc += line.length + 1 // +1 for the '\n'
  }
  let stack = vsctm.INITIAL
  const spans = []
  lines.forEach((line, row) => {
    const r = tmGrammar.tokenizeLine(line, stack)
    stack = r.ruleStack
    for (const t of r.tokens) {
      const kind = scopeKind(t.scopes)
      if (kind === null) continue
      spans.push({ start: lineStart[row] + t.startIndex, end: lineStart[row] + t.endIndex, kind })
    }
  })
  return (offset) => {
    for (const s of spans) if (offset >= s.start && offset < s.end) return s.kind
    return null
  }
}

// ── Assertions ───────────────────────────────────────────────────────────────
// A fixture is { src, cases: [{ text, kind, nth? }] }. Each case names a token by
// its text (nth occurrence, 1-based) and the kind BOTH highlighters must give it.
function offsetOf(src, text, nth) {
  let from = 0
  for (let i = 0; i < nth; i++) {
    const idx = src.indexOf(text, from)
    if (idx === -1) return -1
    if (i === nth - 1) return idx
    from = idx + 1
  }
  return -1
}

let failures = 0
let checks = 0
for (const fixture of FIXTURES) {
  const tsAt = treeSitterKinds(fixture.src)
  const tmAt = textMateKinds(fixture.src)
  for (const c of fixture.cases) {
    const nth = c.nth ?? 1
    const off = offsetOf(fixture.src, c.text, nth)
    checks++
    if (off === -1) {
      failures++
      console.error(`✗ [${fixture.name}] token ${JSON.stringify(c.text)} #${nth} not found in fixture`)
      continue
    }
    // probe the middle of the token so we never land on a boundary
    const probe = off + Math.floor(c.text.length / 2)
    const ts = tsAt(probe)
    const tm = tmAt(probe)
    if (ts === c.kind && tm === c.kind) continue
    failures++
    console.error(
      `✗ [${fixture.name}] ${JSON.stringify(c.text)} #${nth}: expected ${c.kind}, ` +
        `tree-sitter=${ts ?? 'none'}, textmate=${tm ?? 'none'}`,
    )
  }
}

// ── --dump mode ──────────────────────────────────────────────────────────────
if (process.argv.includes('--dump')) {
  const file = process.argv[process.argv.indexOf('--dump') + 1]
  const src = readFileSync(file, 'utf8')
  const tsAt = treeSitterKinds(src)
  const tmAt = textMateKinds(src)
  console.log(`\n${file} — token | tree-sitter | textmate (✗ = differ)\n`)
  // walk word/symbol tokens
  const re = /\/\?[\s\S]*?\?\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|\?\?\?|[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[&\[\],(){}]/g
  let m
  while ((m = re.exec(src))) {
    const probe = m.index + Math.floor(m[0].length / 2)
    const ts = tsAt(probe)
    const tm = tmAt(probe)
    const flag = ts === tm ? ' ' : '✗'
    console.log(`${flag} ${JSON.stringify(m[0].slice(0, 30)).padEnd(34)} ${String(ts).padEnd(12)} ${tm}`)
  }
  process.exit(0)
}

if (failures > 0) {
  console.error(`\n${failures} of ${checks} parity checks failed`)
  process.exit(1)
}
console.log(`highlight parity: all ${checks} checks passed across ${FIXTURES.length} fixtures`)
