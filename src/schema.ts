import { z } from "zod";

export type Metrics = z.infer<typeof metricsSchema>;
export const metricsSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("page_view"),
    path: z.string(),
  }),
  z.object({
    name: z.literal("request"),
    method: z.string(),
    path: z.string(),
    status: z.number(),
    rayId: z.string(),
  }),
]);

export type Logs = z.infer<typeof logsSchema>;
export const logsSchema = z.object({});

export type Traces = z.infer<typeof tracesSchema>;
export const tracesSchema = z.object({});
