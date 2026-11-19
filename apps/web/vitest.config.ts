import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The `~/*` path of tsconfig.json, which Next resolves on its own.
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
});
