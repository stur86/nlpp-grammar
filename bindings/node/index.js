import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// This package ships the grammar as WebAssembly only — there is no native
// addon. Parsing is the consumer's job, via web-tree-sitter; this module exists
// so callers can locate the artifacts without knowing the package layout.

const root = new URL("../../", import.meta.url);

/** Absolute filesystem path to the compiled grammar WASM. */
export const wasmPath = fileURLToPath(new URL("tree-sitter-nlpp.wasm", root));

/** Absolute filesystem path to the syntax highlighting query. */
export const highlightsQueryPath = fileURLToPath(new URL("queries/highlights.scm", root));

/** The syntax highlighting query source. */
export const HIGHLIGHTS_QUERY = readFileSync(highlightsQueryPath, "utf8");

/** Static node types, from `src/node-types.json`. */
export const nodeTypeInfo = JSON.parse(
  readFileSync(new URL("src/node-types.json", root), "utf8"),
);
