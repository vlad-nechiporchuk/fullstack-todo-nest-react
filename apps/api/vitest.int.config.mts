import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["test/**/*.int-spec.ts"],
    globalSetup: ["test/support/global-setup.ts"],
    // One shared database: test files run one after another so they never truncate each other's rows.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
})
