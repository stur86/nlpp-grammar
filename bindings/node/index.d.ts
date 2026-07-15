type BaseNode = {
  type: string;
  named: boolean;
};

type ChildNode = {
  multiple: boolean;
  required: boolean;
  types: BaseNode[];
};

type NodeInfo =
  | (BaseNode & {
      subtypes: BaseNode[];
    })
  | (BaseNode & {
      fields: { [name: string]: ChildNode };
      children: ChildNode[];
    });

/**
 * Absolute filesystem path to the compiled grammar WASM.
 *
 * This package ships WebAssembly only — there is no native addon, so parsing is
 * the consumer's job. Load the WASM with web-tree-sitter:
 *
 * @example
 * import { Parser, Language } from "web-tree-sitter";
 * import { wasmPath } from "nlpp-grammar";
 *
 * await Parser.init();
 * const parser = new Parser();
 * parser.setLanguage(await Language.load(wasmPath));
 */
export declare const wasmPath: string;

/** Absolute filesystem path to the syntax highlighting query. */
export declare const highlightsQueryPath: string;

/** The syntax highlighting query for this grammar. */
export declare const HIGHLIGHTS_QUERY: string;

/**
 * The content of the `node-types.json` file for this grammar.
 *
 * @see {@linkplain https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types Static Node Types}
 */
export declare const nodeTypeInfo: NodeInfo[];
