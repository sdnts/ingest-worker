import { z } from "zod";
import { Endpoint } from "./types";

const schema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("page_view"),
    origin: z.string(),
    path: z.string(),
    fields: z.object({
      visitor: z.string(),
      location: z.string(),
    }),
  }),

  z.object({
    name: z.literal("request"),
    origin: z.string(),
    method: z.string(),
    path: z.string(),
    status: z.number(),
    fields: z.record(z.string(), z.string()),
  }),
]);

/*
 * Endpoint for metrics, secured by Access. Generally used by server-side code.
 */
export const endpoint: Endpoint<typeof schema> = {
  path: "/m",
  schema,
  ship: async ({ data: params }, env) => {
    // Tags are indexed by InfluxDB, fields are not
    // Use tags sparingly, for data that has a known set of possible values

    const tags: Record<string, string> = {
      bucket: "metrics",
      origin: params.origin,
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

    const response = await fetch(env.telegrafUrl, {
      method: "POST",
      headers: {
        "cf-access-client-id": env.cfAccessClientId,
        "cf-access-client-secret": env.cfAccessClientSecret,
      },
      body: `${params.name},${t} ${f} ${today}`,
    });

    console.log("Shipped metrics");
    console.log("Status:", response.status);
    if (response.status != 204) console.log("Body:", await response.text());
  },
};
