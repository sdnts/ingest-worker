import { z } from "zod";
import { Endpoint, EnvironmentSchema } from "./types";

const schema = z
  .object({
    service: z.string(),
    environment: EnvironmentSchema,
  })
  .and(
    z.discriminatedUnion("name", [
      z.object({
        name: z.literal("page_view"),
        path: z.string(),
        fields: z.object({
          visitor: z.string(),
          location: z.string(),
        }),
      }),

      z.object({
        name: z.literal("request"),
        method: z.string(),
        path: z.string(),
        status: z.number(),
        fields: z.record(z.string(), z.string()),
      }),
    ]),
  );

/*
 * Endpoint for metrics, secured by Access. Generally used by server-side code.
 */
export const endpoint: Endpoint<typeof schema> = {
  path: "/m",
  schema,
  ship: async (params, env) => {
    // Tags are indexed by InfluxDB, fields are not
    // Use tags sparingly, for data that has a known set of possible values

    const tags: Record<string, string> = {
      bucket: "metrics",
      environment: params.environment,
      service: params.service,
    };
    const fields = params.fields;

    switch (params.name) {
      case "page_view":
        tags.path = params.path;
        break;

      case "request":
        tags.method = params.method;
        tags.path = params.path;
        tags.status = String(params.status);
        break;

      default:
        break;
    }

    // Serialize metric to the InfluxDB Line Protocol
    // https://docs.influxdata.com/influxdb/v2/reference/syntax/line-protocol/

    const t = Object.entries(tags)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    const f = Object.entries(fields)
      .map(([k, v]) => {
        if (typeof v === "string") return `${k}="${v}"`;
        return `${k}=${v}`;
      })
      .join(",");
    const today = new Date().getTime();

    return fetch(env.telegrafUrl, {
      method: "POST",
      headers: {
        "cf-access-client-id": env.cfAccessClientId,
        "cf-access-client-secret": env.cfAccessClientSecret,
      },
      body: `${params.name},${t} ${f} ${today}`,
    });
  },
};
