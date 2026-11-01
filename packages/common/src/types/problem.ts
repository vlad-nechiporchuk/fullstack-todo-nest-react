import type { z } from "zod"
import type { problemSchema } from "../schemas/problem"

export type Problem = z.infer<typeof problemSchema>
