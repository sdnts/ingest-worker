import { z } from "zod";
import { Endpoint, EnvironmentSchema } from "./types";

export const LogLevelSchema = z
  .enum(["trace", "debug", "info", "warn", "error", "fatal"])
  .default("info");
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const LogKVSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()]).optional(),
);
export type LogKV = z.infer<typeof LogKVSchema>;

export const LogSchema = z.object({
  level: LogLevelSchema,
  timestamp: z.object({
    p: z.enum(["ms", "ns"]).default("ms"), // Precision of the timestamp value
    v: z.string(), // Value of the (unix) timestamp in the precision specified abovr
  }),

  // Text content of the log
  message: z.string(),

  // Metadata specific to this log line
  kv: LogKVSchema.optional(),
});
export type Log = z.infer<typeof LogSchema>;

const schema = z.object({
  // A unique identifier for the service sending logs
  service: z.string(),
  environment: EnvironmentSchema,

  // Common metadata to attach to every log line
  kv: LogKVSchema.optional(),

  // Individual log lines
  logs: z.array(LogSchema).min(1),
});

export const endpoint: Endpoint<typeof schema> = {
  path: "/l",
  schema,
  async ship(params, env) {
    // Use labels for things that have a finite set of values
    // Use metadata for everything else

    // Serialize logs to the Loki log entry format
    // https://grafana.com/docs/loki/latest/reference/api/#push-log-entries-to-loki

    const levelBuckets = params.data.logs.reduce(
      (acc, l) => {
        if (acc[l.level]) acc[l.level].push(l);
        else acc[l.level] = [l];
        return acc;
      },
      {} as Record<LogLevel, Log[]>,
    );

    const body = JSON.stringify({
      streams: Object.entries(levelBuckets).map(([level, logs]) => {
        return {
          stream: {
            environment: params.data.environment,
            service: params.data.service,
            level,
          },
          values: logs.map((l) => {
            // Loki wants timestamps in nanoseconds
            if (l.timestamp.p === "ms")
              l.timestamp.v = `${l.timestamp.v}000000`;

            // Loki supports structured metadata that is supposed to be treated
            // as labels, but it is experimental and doesn't seem to be working.
            // Specifically, I don't see these structured metadata labels and
            // cannot query using them.
            // So instead I'll send a logfmt-style string as the message instead,
            // which will let me use the `logfmt` stream processor.
            // JSON is another option but stringified JSON be ugly.
            // Reference: https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/
            // TODO: We should just use structured metadata once it lands as stable

            const log = Object.entries({
              ...params.data.kv,
              ...l.kv,
              msg: l.message,
            })
              .filter(([_, v]) => v !== undefined) // Leave null values untouched
              .map(([k, v]) => {
                if (typeof v === "string") return `${k}="${v}"`;
                return `${k}=${v}`;
              })
              .join(" ");
            return [l.timestamp.v, log];
          }),
        };
      }),
    });

    return fetch(env.lokiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-access-client-id": env.cfAccessClientId,
        "cf-access-client-secret": env.cfAccessClientSecret,
      },
      body,
    });
  },
};
