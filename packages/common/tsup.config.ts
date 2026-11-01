import { defineConfig } from "tsup"

// Dual build: the web app consumes ESM, the NestJS API consumes CommonJS.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["zod"],
})
