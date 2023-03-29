import { z } from "zod";

export type Analytics = z.infer<typeof analyticsSchema>;
export const analyticsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("page_view"),
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

export type Metrics = z.infer<typeof metricsSchema>;
export const metricsSchema = z.object({
  service: z.enum(["raft"]),
});
