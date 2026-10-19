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
import { classLists } from './class-lists.mjs';
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

/** Tailwind escapes these when it writes a selector. */
const escapeClass = (token) => token.replace(/[.:/[\]()%#,!'"+*~^$=@&|?<>{}]/g, (c) => `\\${c}`);

/**
 * Does the sheet contain a rule for exactly this class?
 *
 * A substring test is NOT enough, and the difference is the whole bug class: an
 * off-scale alpha step is usually a prefix of an on-scale one, so `.bg-shade\/2`
 * "matches" inside `.bg-shade\/20{…}` and a class that paints nothing reports fine.
 * So the character before the dot must not be part of a class name, and the one
 * after must end it.
 */
function hasRule(css, token) {
  const needle = `.${escapeClass(token)}`;
  for (let i = css.indexOf(needle); i !== -1; i = css.indexOf(needle, i + 1)) {
    const before = i === 0 ? '' : css[i - 1];
    const after = css[i + needle.length] ?? '';
    const startsCleanly = before === '' || !/[A-Za-z0-9_\\-]/.test(before);
    const endsCleanly = after === '' || /[{,:.\s>+~[)]/.test(after);
    if (startsCleanly && endsCleanly) return true;
  }
  return false;
}

const css = builtCss();
const missing = new Map();
let inspected = 0;

for (const file of sources(join(WEB, 'src'))) {
  // Admin is out of FEAT-011's scope but shares the stylesheet, so it is checked too:
  // a class that emits nothing is a defect wherever it lives.
  const source = readFileSync(file, 'utf8');
  for (const tokens of classLists(source, file)) {
    inspected += tokens.length;
    for (const token of tokens) {
      if (hasRule(css, token)) continue;
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
