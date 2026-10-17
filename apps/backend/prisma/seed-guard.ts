/**
 * The demo seed's safety check, in its own file so `seed:demo` can run it FIRST — before
 * the base seed, which would otherwise upsert societies, an admin and services into
 * whatever database DATABASE_URL names before the demo step refused (CHORE-019).
 *
 * The base seed alone (`node prisma/dist/seed.js`) stays unguarded: DEPLOY.md §4 runs it
 * against production on purpose.
 */
export function assertLocalDatabase(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo refuses to run with NODE_ENV=production.');
  }
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // Unparseable: treated as not-local.
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host) && process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error(
      `seed-demo only runs against a local database (DATABASE_URL host is "${host || 'unset'}"). ` +
        'Set ALLOW_DEMO_SEED=1 to override — it promotes +919999900209 to SUPER_ADMIN.',
    );
  }
}

// Run directly (`node prisma/dist/seed-guard.js`): exit non-zero so `&&` stops the chain.
if (require.main === module) {
  try {
    assertLocalDatabase();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
