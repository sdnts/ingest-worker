import { z } from "zod";
import { Endpoint, EnvironmentSchema } from "./types";

const LogLevel = z
  .enum(["trace", "debug", "info", "warn", "error", "fatal"])
  .default("info");
type LogLevel = z.infer<typeof LogLevel>;

const schema = z.object({
  environment: EnvironmentSchema,

  // A unique identifier for the service sending logs. Generally a URL.
  origin: z.string(),

  // Common metadata to attach to every log line
  kv: z.record(z.union([z.string(), z.number()])).optional(),

  // Individual log lines
  logs: z
    .array(
      z.object({
        level: LogLevel,
        timestamp: z.object({
          p: z.enum(["ms", "ns"]).default("ms"), // Precision of the timestamp value
          v: z.string(), // Value of the (unix) timestamp in the precision specified abovr
        }),
        // Text content of the log
        message: z.string(),
        // Metadata specific to this log line
        kv: z.record(z.union([z.string(), z.number()])).optional(),
      }),
    )
    .min(1),
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
      {} as Record<LogLevel, z.infer<typeof schema>["logs"]>,
    );

    const body = JSON.stringify({
      streams: Object.entries(levelBuckets).map(([level, logs]) => {
        return {
          stream: {
            environment: params.data.environment,
            origin: params.data.origin,
            level,
          },
          values: logs.map((l) => {
            // Loki wants timestamps in nanoseconds
            if (l.timestamp.p === "ms")
              l.timestamp.v = `${l.timestamp.v}000000`;

            if (!l.kv && !params.data.kv) return [l.timestamp.v, l.message];
            return [l.timestamp.v, l.message, { ...params.data.kv, ...l.kv }];
          }),
        };
      }),
    });

    const response = await fetch(env.lokiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-access-client-id": env.cfAccessClientId,
        "cf-access-client-secret": env.cfAccessClientSecret,
      },
      body,
    });

    console.log("Shipped logs");
    console.log("Status:", response.status);
    if (response.status != 204) console.log("Body:", await response.text());
  },
};
