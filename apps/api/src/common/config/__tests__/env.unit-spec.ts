import { describe, expect, it } from "vitest"
import { type Env, loadEnv } from "../env"

const DATABASE_URL = "postgres://db.test/app"

describe("loadEnv", () => {
  it("should apply every default when only the required variable is set", () => {
    const expected: Env = {
      NODE_ENV: "development",
      PORT: 3001,
      DATABASE_URL,
      DATABASE_POOL_SIZE: 10,
      LOG_LEVEL: "info",
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
    }

    expect(loadEnv({ DATABASE_URL })).toEqual(expected)
  })

  it("should use every variable when all of them are set", () => {
    const expected: Env = {
      NODE_ENV: "production",
      PORT: 8080,
      DATABASE_URL,
      DATABASE_POOL_SIZE: 4,
      LOG_LEVEL: "warn",
      CORS_ORIGINS: ["http://a.test", "http://b.test"],
      SWAGGER_ENABLED: false,
    }

    const env = loadEnv({
      NODE_ENV: "production",
      PORT: "8080",
      DATABASE_URL,
      DATABASE_POOL_SIZE: "4",
      LOG_LEVEL: "warn",
      CORS_ORIGINS: "http://a.test, http://b.test",
      SWAGGER_ENABLED: "false",
    })

    expect(env).toEqual(expected)
  })

  it("should name every invalid variable when several are wrong", () => {
    expect(() => loadEnv({ DATABASE_URL: "mysql://nope", PORT: "-1" })).toThrow(
      new Error(
        "Invalid environment configuration:\n" +
          "  - PORT: Too small: expected number to be >0\n" +
          "  - DATABASE_URL: Invalid URL",
      ),
    )
  })
})
