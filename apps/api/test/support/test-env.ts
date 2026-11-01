/** Created by `docker/postgres/init`, separate from the development database. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://todo:todo@localhost:55432/todo_test"

export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: TEST_DATABASE_URL,
  LOG_LEVEL: "silent",
  SWAGGER_ENABLED: "true",
} as const
