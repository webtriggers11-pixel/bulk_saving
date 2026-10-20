// Same rules as apps/web (ESLint 9 flat config, typescript-eslint). `.astro` files are
// type-checked by `astro check`; ESLint covers the TypeScript (islands, scene, content, tests).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '.astro', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
