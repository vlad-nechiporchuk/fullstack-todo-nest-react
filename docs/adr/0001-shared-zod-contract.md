# 0001: Shared Zod contract

- **Status:** accepted
- **Date:** 2026-11-01

## Context

The API and the web app must agree on every request, response and error shape. When the two sides describe the same
shape separately, they drift: a field renamed in the API still type-checks in the UI and breaks at runtime.

## Decision

The contract is a set of Zod schemas in `packages/common`, built for both ESM and CommonJS.

- The API validates every request with them (`ZodValidationPipe`) and serializes every response through them
  (`ZodSerializerInterceptor`), so a field that is not in the schema never leaves the API.
- Swagger is generated from the same schemas through `nestjs-zod`.
- The web app infers its types from the schemas and parses API responses with them, so a mismatch fails loudly at the
  boundary instead of deep in a component.

## Rejected alternatives

- **class-validator DTOs plus an OpenAPI client generator.** Two sources of truth joined by a codegen step that has to
  be rerun and committed; the generated client is code nobody reads.
- **Hand-written TypeScript types on each side.** No runtime validation, and nothing stops the two copies drifting.

## Consequences

- A contract change is made once, then `pnpm --filter @workspace/common build`.
- Both apps depend on Zod at runtime.
