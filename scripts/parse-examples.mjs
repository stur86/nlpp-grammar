#!/usr/bin/env node
//
// Parse every examples/*.nlpp with the compiled WASM, through web-tree-sitter,
// exactly as a consumer would.
//
// The grammar being correct and the *shipped artifact* being correct are
// different claims — `tree-sitter test` checks the former, this checks the
// latter. Between them the examples cover every feature in the spec, so this
// doubles as the guard that stops them drifting away from the grammar.
//
//   node scripts/parse-examples.mjs [wasm-path]
//
// Exits non-zero if any example fails to parse.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Parser, Language } from "web-tree-sitter";

const root = new URL("../", import.meta.url);
const wasm = process.argv[2] ?? fileURLToPath(new URL("tree-sitter-nlpp.wasm", root));
const examplesDir = fileURLToPath(new URL("examples/", root));

// GitHub renders `::error file=…::` as an annotation on the file itself; locally
// it's just noise, so only emit it under Actions.
const annotate = (file, message) =>
  process.env.GITHUB_ACTIONS ? `::error file=${file}::${message}` : `${file}: ${message}`;

if (!existsSync(wasm)) {
  console.error(`WASM not found: ${wasm}\nRun \`npm run build\` first.`);
  process.exit(1);
}

/** Every ERROR or MISSING node in the tree, as readable "line N: source" strings. */
function syntaxErrors(tree, src) {
  const lines = src.split("\n");
  const found = [];
  // `isMissing` matters as much as ERROR: tree-sitter recovers from some invalid
  // input by inserting a zero-width MISSING node instead of an ERROR node, so a
  // check that only looks for ERROR passes on input the parser actually rejected.
  const walk = (node) => {
    if (node.type === "ERROR" || node.isMissing) {
      const what = node.isMissing ? `missing ${node.type}` : "syntax error";
      found.push(`line ${node.startPosition.row + 1}: ${what} — ${lines[node.startPosition.row].trim()}`);
    }
    node.children.forEach(walk);
  };
  walk(tree.rootNode);
  return found;
}

await Parser.init();
const language = await Language.load(wasm);
const parser = new Parser();
parser.setLanguage(language);

const files = readdirSync(examplesDir).filter((f) => f.endsWith(".nlpp")).sort();
if (files.length === 0) {
  console.error("no examples found to parse");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const src = readFileSync(examplesDir + file, "utf8");
  const tree = parser.parse(src);
  const errors = syntaxErrors(tree, src);
  if (errors.length > 0) {
    failed++;
    console.error(annotate(`examples/${file}`, errors[0]));
    errors.slice(1).forEach((e) => console.error(`  ${e}`));
  } else {
    console.log(`ok  examples/${file} (${tree.rootNode.namedChildCount} top-level nodes)`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${files.length} examples failed to parse`);
  process.exit(1);
}
console.log(`\nall ${files.length} examples parsed`);
