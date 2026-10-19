// Types for class-lists.mjs (BUG-012), so the web workspace can test the class gate's extractor.
export declare const CLASSY: RegExp;
export declare const SYSTEM_CLASS: RegExp;
/** Every string literal in a TS/TSX file, found by the TypeScript parser. */
export declare function stringLiterals(source: string, fileName?: string): string[];
/** The string literals in a file that are class lists, split into tokens. */
export declare function classLists(source: string, fileName?: string): string[][];
