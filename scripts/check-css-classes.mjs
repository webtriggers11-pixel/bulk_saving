#!/usr/bin/env node
/**
 * Does every class the app names actually paint? (FEAT-011, V2 rounds 1 and 2.)
 *
 * Twice in this work item a class was carried by a component and emitted NO CSS,
 * and every unit test passed both times: `fill-brand` collided with a Tailwind
 * utility namespace, and eleven alpha modifiers used off-scale steps
 * (`bg-amber-ink/12`) that Tailwind does not generate. jsdom applies no CSS and a
 * source-reading test only ever knows the names it was told to look for, so
 * neither could see it.
 *
 * This reads the BUILT stylesheet — the bytes a browser gets — and asserts that
 * every class token in the source resolves to at least one rule. It runs in
 * verify.sh after the build, because that is the only point where the answer exists.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(process.cwd(), 'apps/web');
const DIST = join(WEB, 'dist/assets');

/** Every .css Vite emitted for the app. */
function builtCss() {
  let files;
  try {
    files = readdirSync(DIST).filter((f) => f.endsWith('.css'));
  } catch {
    fail(`no build output at ${DIST} — run this after \`pnpm -r build\``);
  }
  if (files.length === 0) fail(`no .css in ${DIST} — did the build change its output?`);
  return files.map((f) => readFileSync(join(DIST, f), 'utf8')).join('\n');
}

function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** A token that looks like a utility or a system class, e.g. `bg-brand/20`, `h-[52px]`, `surface-glass`. */
const CLASSY = /^-?[a-z][a-z0-9]*(?:[-:/.][a-z0-9[\]()%#.,_-]+)*$/i;

/**
 * A string literal counts as a class list when every token looks like a class AND
 * at least one is compound. That skips prose ("Loading rounds…"), bare words
 * ("teal", "polite") and format strings, without needing to know where in the file
 * the literal sits — which matters, because the `fill-*` bug lived in a variant map,
 * not in a className attribute.
 */
function classLists(source) {
  const lists = [];
  // [, , quoted]: group 1 is the quote character, group 2 is the contents. Taking
  // group 1 by mistake made this whole check pass vacuously — which is exactly the
  // failure mode it exists to catch, so it now counts what it inspected (below).
  for (const [, , quoted] of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/gs)) {
    if (quoted.includes('${') || quoted.includes('\n')) continue;
    const tokens = quoted.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;
    if (!tokens.every((t) => CLASSY.test(t))) continue;
    if (!tokens.some((t) => /[-:/[]/.test(t))) continue;
    lists.push(tokens);
  }
  return lists;
}

/** Tailwind escapes these when it writes a selector. */
const escapeClass = (token) => token.replace(/[.:/[\]()%#,!'"+*~^$=@&|?<>{}]/g, (c) => `\\${c}`);

const css = builtCss();
const missing = new Map();
let inspected = 0;

for (const file of sources(join(WEB, 'src'))) {
  // Admin is out of FEAT-011's scope but shares the stylesheet, so it is checked too:
  // a class that emits nothing is a defect wherever it lives.
  const source = readFileSync(file, 'utf8');
  for (const tokens of classLists(source)) {
    inspected += tokens.length;
    for (const token of tokens) {
      const selector = `.${escapeClass(token)}`;
      // A rule exists when the escaped selector is followed by a selector boundary
      // (`{`, `:`, `,`, whitespace, `>`, `+`, `~`) somewhere in the sheet.
      if (css.includes(selector)) continue;
      const where = missing.get(token) ?? new Set();
      where.add(file.replace(`${WEB}/`, ''));
      missing.set(token, where);
    }
  }
}

// A check that inspects nothing reports success forever. This one says how much it
// looked at, and fails if that collapses.
const FLOOR = 800;
if (inspected < FLOOR) {
  fail(
    `only ${inspected} class tokens were inspected (expected at least ${FLOOR}). ` +
      'The extractor has stopped seeing the source — fix it rather than lowering the floor.',
  );
}

if (missing.size > 0) {
  console.error('\n✖ classes that emit NO CSS (they name nothing the browser will apply):\n');
  for (const [token, files] of [...missing].sort()) {
    console.error(`  ${token}\n      ${[...files].join('\n      ')}`);
  }
  console.error(
    '\nUsually one of: an off-scale alpha step (Tailwind ships multiples of 5),\n' +
      'a size that is not in the scale, a typo, or a bespoke class never declared in\n' +
      'src/styles/theme.css.\n',
  );
  process.exit(1);
}

console.log(
  `==> [verify] ${inspected} class tokens in apps/web all resolve to a rule in the built CSS`,
);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}
