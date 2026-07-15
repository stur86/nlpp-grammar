// The package entry point resolves filesystem paths (node:fs, node:url), which
// is meaningless in a browser. The WASM itself works fine there — it just has to
// be loaded as a bundled asset rather than from a path.
throw new Error(
  "nlpp-grammar's entry point cannot run in browser contexts: it resolves " +
  "filesystem paths. Import 'nlpp-grammar/wasm' as an asset through your " +
  "bundler and hand the resulting URL to web-tree-sitter's Language.load(), " +
  "or use nlpp-ts-server's initParser()."
);
