import { z } from "zod";

export type Metrics = z.infer<typeof metricsSchema>;
export const metricsSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("page_view"),
    service: z.enum(["dietcode", "blob-city"]),
    path: z.string(),
  }),
]);

export type Logs = z.infer<typeof logsSchema>;
export const logsSchema = z.object({
  service: z.enum(["raft"]),
});

export type Traces = z.infer<typeof tracesSchema>;
export const tracesSchema = z.object({
  service: z.enum(["raft"]),
});
