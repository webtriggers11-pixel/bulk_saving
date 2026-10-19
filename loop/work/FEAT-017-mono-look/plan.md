# FEAT-017 — plan

Decision record: ADR-0029.

1. **Tokens (theme.css + tailwind).** Move radii and the sans stack to CSS variables in the
   shared `:root` block (values unchanged). Add `[data-theme='mono']` (day) and
   `html[data-scheme='dark'][data-theme='mono']` (night) colour blocks; give every night an
   explicit `--on-fill`. Tailwind `borderRadius`/`fontFamily` read the variables.
2. **Mono geometry + surfaces.** One `html[data-theme='mono']` section: radii, fonts, and
   overrides of the system classes (`surface-*`, `paint-*`, `card-hover`, `card-glow`,
   `sweep`, `sheen`, `halo-sweep`, `animate-glide`, `ambient-ground`, `bar-fill`) plus the
   grid ground. Specificity (attribute + class) beats the base rules and single utilities,
   so no component changes for the look.
3. **on-fill codemod.** `text-white`/`white/NN` on accent fills → `on-fill` equivalents
   (button, stat, monogram, Home hero/brand mark, admin brand mark, swatch tick). Identical
   render in the three tinted palettes (on-fill is white there).
4. **Appearance.** `mono` in `PALETTES` (first) as "Mono", default in `asPalette` and the
   pre-paint script, status-bar table, Geist font link.
5. **Tests.** Extend the palette/night/contrast/parity tests to mono; on-fill contrast;
   radius/font tokens unchanged for the three palettes; white allowlist recount; default
   palette; byte-identical markup ×4.
6. **Browser pass** in both schemes; fix what the tests could not see.
