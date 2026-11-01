import { z } from "zod"

/** RFC 9457 "Problem Details for HTTP APIs" — every API error has this shape. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
})
