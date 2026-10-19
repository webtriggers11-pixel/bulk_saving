// Extracted from check-css-classes.mjs (BUG-012) so the extractor can be tested on its own.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// TypeScript lives in the web workspace; resolve it from there.
const ts = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../apps/web/package.json'))('typescript');

/**
 * Every string literal in a TS/TSX file, found by the TypeScript parser (BUG-012).
 *
 * It used to be a regex that paired quote characters across the WHOLE file, so a single
 * apostrophe in a comment or in JSX text shifted the pairing: everything after it was read
 * as the wrong strings and real class lists went unchecked — HomePage had 0 of 32 read.
 * The parser knows what is a comment, what is JSX text and what is a string. Template
 * literals count only without substitutions (`${...}` makes a list unknowable).
 */
export function stringLiterals(source, fileName = 'source.tsx') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const out = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** A token that looks like a utility or a system class, e.g. `bg-brand/20`, `h-[52px]`, `surface-glass`. */
export const CLASSY = /^-?[a-z][a-z0-9]*(?:[-:/.][a-z0-9[\]()%#.,_-]+)*$/i;

/**
 * Prefixes that mean "this single word is a class, not a string". Needed because a
 * one-token literal like 'surface-glass' (the Card SURFACES map) is indistinguishable
 * from 'one-time-code' (an autocomplete value) without one of these.
 */
/**
 * A ONE-token literal is only treated as a class when it is one the design system
 * owns. Tailwind's own families are hopeless to recognise in isolation — `my-rating`
 * looks exactly like a margin utility and `text` like a colour one — and every such
 * guess is a false failure that teaches people to disable the check. The bespoke
 * namespace is unambiguous, and it is where the bug this script exists for lived
 * (a variant map, and its sibling the Card surface map).
 */
export const SYSTEM_CLASS =
  /^(?:surface-|paint-|skeleton|card-|halo|sheen|sweep|ripple|press|nudge|field|bar-fill|stagger|animate-|num$|t$|sr-only-text$)/;

/**
 * A string literal counts as a class list when every token looks like a class. Prose
 * ("Loading rounds…"), bare words and format strings are excluded by the token shape;
 * a SINGLE token additionally has to start with a class-ish prefix, or 'one-time-code'
 * would be treated as a class. Deliberately not scoped to className attributes: the
 * `fill-*` bug lived in a variant map, and the Card surface map is one-token values.
 */
export function classLists(source, fileName = 'source.tsx') {
  const lists = [];
  // The caller counts what it inspected and fails if that collapses: an extractor that
  // finds nothing would otherwise pass vacuously.
  for (const quoted of stringLiterals(source, fileName)) {
    if (quoted.includes('\n')) continue;
    const tokens = quoted.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    if (!tokens.every((t) => CLASSY.test(t))) continue;
    // A class never starts with a capital: "Sign-in progress" (an aria-label) is words.
    if (tokens.some((t) => /^-?[A-Z]/.test(t))) continue;
    if (tokens.length === 1) {
      if (!SYSTEM_CLASS.test(tokens[0])) continue;
    } else if (!tokens.some((t) => /[-:/[]/.test(t))) {
      continue;
    }
    lists.push(tokens);
  }
  return lists;
}

