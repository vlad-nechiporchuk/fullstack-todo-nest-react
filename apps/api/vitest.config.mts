import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // SWC emits decorator metadata, which NestJS dependency injection relies on (esbuild does not).
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.unit-spec.ts"],
  },
})
