import {
  Analytics,
  Logs,
  Metrics,
  Traces,
  analyticsSchema,
  logsSchema,
  metricsSchema,
  tracesSchema,
} from "./schema";

export interface Env {
  allowedOrigins: string[];

  telegrafUrl: string;
  telegrafClientId: string;
  telegrafClientSecret: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/p") return new Response("pong", { status: 200 });

    const origin = request.headers.get("Origin") ?? "";
    if (!env.allowedOrigins.includes(origin)) {
      return new Response("Bad origin", { status: 400 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Bad method", { status: 400 });
    }

    const params = await request.json();

    switch (url.pathname) {
      case "/a": {
        // For analytics, unsecured. Generally used by client-side scripts.
        // Will be forwarded to InfluxDB by Sinope's Telegraf service.

        const result = analyticsSchema.safeParse(params);
        if (!result.success) return new Response("Bad data", { status: 400 });

        const ip = request.headers.get("cf-connecting-ip") ?? "";
        const userAgent = request.headers.get("user-agent") ?? "";
        const country = request.headers.get("cf-ipcountry") ?? "unknown";

        ctx.waitUntil(
          analytics(env, origin, ip, userAgent, country, result.data),
        );
        break;
      }
      case "/m": {
        // For metrics, secured by Access. Generally used by server-side code.
        // Will be forwarded to InfluxDB by Sinope's Telegraf service.

        const result = metricsSchema.safeParse(params);
        if (!result.success) return new Response("Bad data", { status: 400 });

        ctx.waitUntil(metrics(env, origin, result.data));
        break;
      }

      case "/l": {
        // For logs, secured by Access. Generally used by server-side code.
        // Will be forwarded to Loki by Sinope's Telegraf service.

        const result = logsSchema.safeParse(params);
        if (!result.success) return new Response("Bad data", { status: 400 });

        ctx.waitUntil(logs(env, result.data));
        return new Response("Unimplemented", { status: 501 });
      }

      case "/t": {
        // For traces, secured by Access. Generally used by server-side code.
        // Will be forwarded to Tempo by Sinope's Telegraf service.

        const result = tracesSchema.safeParse(params);
        if (!result.success) return new Response("Bad data", { status: 400 });

        ctx.waitUntil(traces(env, result.data));
        return new Response("Unimplemented", { status: 501 });
      }

      default:
        return new Response("Bad route", { status: 400 });
    }

    return new Response(null, {
      status: 202,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST",
      },
    });
  },
};

async function analytics(
  env: Env,
  origin: string,
  ip: string,
  userAgent: string,
  country: string,
  data: Analytics,
): Promise<void> {
  const encoder = new TextEncoder();
  const today = new Date();

  /**
   * For every origin that reports a page_view, visitors get a unique ID every
   * day. We don't log their IPs / UserAgents, but we do use them to calculate
   * their IDs. Visitor IDs let us determine uniqueness.
   *
   * This is also the strategy Plausible uses, and is a great balance between
   * usefulness and privacy.
   */
  const visitorDigest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(today.toDateString() + origin + ip + userAgent),
  );
  const visitorId = Array.from(new Uint8Array(visitorDigest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await ship(
    env,
    "page_view",
    {
      bucket: "metrics",
      origin,
      path: data.path,
    },
    {
      visitor: visitorId,
      location: country,
    },
  );
}

async function metrics(env: Env, origin: string, data: Metrics): Promise<void> {
  // Tags are indexed by InfluxDB, fields are not
  // Use tags sparingly, for data that has a known set of possible values

  const tags: Record<string, string> = {
    bucket: "metrics",
    origin,
  };
  const fields: Record<string, string> = {};

  switch (data.name) {
    case "request": {
      tags.method = data.method;
      tags.path = data.path;

      fields.status = String(data.status);
      fields.rayId = data.rayId;

      break;
    }

    default:
      break;
  }

  await ship(env, data.name, tags, fields);
}

async function logs(env: Env, data: Logs): Promise<void> { }

async function traces(env: Env, data: Traces): Promise<void> { }

/**
 * Ships a measurement value to Sinope. Formats measurement into the InfluxDB
 * Line Protocol before shipping.
 *
 * @param env
 * @param measurement Name of the measurement
 * @param tags
 * @param fields
 */
function ship(
  env: Env,
  measurement: string,
  tags: Record<string, string>,
  fields: Record<string, string>,
) {
  const t = Object.entries(tags)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  const f = Object.entries(fields)
    .map(([k, v]) => {
      if (typeof v === "string") return `${k}="${v}"`;
      return `${k}=${v}`;
    })
    .join(",");
  const today = new Date();

  return fetch(env.telegrafUrl, {
    method: "POST",
    headers: {
      "cf-access-client-id": env.telegrafClientId,
      "cf-access-client-secret": env.telegrafClientSecret,
    },
    body: `${measurement},${t} ${f} ${today.getTime()}`,
  });
}
