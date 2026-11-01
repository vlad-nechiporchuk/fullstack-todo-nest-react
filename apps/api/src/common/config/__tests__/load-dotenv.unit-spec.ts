import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { loadDotenvIfPresent } from "../load-dotenv"

const KEY = "LOAD_DOTENV_SPEC_VALUE"

describe("loadDotenvIfPresent", () => {
  beforeEach(() => {
    delete process.env[KEY]
  })

  it("should load variables from the file when it exists", () => {
    loadDotenvIfPresent(writeEnvFile(`${KEY}=from-file\n`))

    expect(process.env[KEY]).toBe("from-file")
  })

  it("should keep a variable when it is already set in the environment", () => {
    process.env[KEY] = "from-environment"

    loadDotenvIfPresent(writeEnvFile(`${KEY}=from-file\n`))

    expect(process.env[KEY]).toBe("from-environment")
  })

  it("should change nothing when the file does not exist", () => {
    loadDotenvIfPresent("/definitely/missing/.env")

    expect(process.env[KEY]).toBeUndefined()
  })
})

function writeEnvFile(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "dotenv-")), ".env")
  writeFileSync(path, contents)
  return path
}
