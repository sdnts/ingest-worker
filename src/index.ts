import {
  Logs,
  Metrics,
  Traces,
  logsSchema,
  metricsSchema,
  tracesSchema,
} from "./schema";

export interface Env {
  // Secrets
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;

  // Vars
  ALLOWED_ORIGINS: string[];
  TELEGRAF_URL: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/p") {
      return new Response("OK", { status: 200 });
    }

    if (request.method !== "POST") {
      return new Response("Bad method", { status: 400 });
    }

    const origin = request.headers.get("Origin") ?? "";
    if (!env.ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Bad origin", { status: 400 });
    }

    const params = await request.json();

    if (url.pathname === "/m") {
      const result = metricsSchema.safeParse(params);
      if (!result.success) return new Response("Bad data", { status: 400 });

      const ip = request.headers.get("cf-connecting-ip") ?? "";
      const userAgent = request.headers.get("user-agent") ?? "";
      const country = request.headers.get("cf-ipcountry") ?? "unknown";

      const work = metrics(env, origin, ip, userAgent, country, result.data);
      ctx.waitUntil(work);
    } else if (url.pathname === "/l") {
      const result = logsSchema.safeParse(params);
      if (!result.success) {
        return new Response("Bad data", { status: 400 });
      }

      const work = logs(env, result.data);
      ctx.waitUntil(work);

      return new Response("Unimplemented", { status: 501 });
    } else if (url.pathname === "/t") {
      const result = tracesSchema.safeParse(params);
      if (!result.success) {
        return new Response("Bad data", { status: 400 });
      }

      const work = traces(env, result.data);
      ctx.waitUntil(work);

      return new Response("Unimplemented", { status: 501 });
    } else {
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

async function metrics(
  env: Env,
  origin: string,
  ip: string,
  userAgent: string,
  country: string,
  data: Metrics
): Promise<void> {
  const encoder = new TextEncoder();
  const today = new Date();

  /**
   * For every origin that reports analytics, visitors get a unique ID every day.
   * We don't log their IPs / UserAgents, but we do use them to calculate their IDs.
   * Visitor IDs let us determine uniqueness.
   *
   * This is also the strategy Plausible uses, and is a great balance between
   * usefulness and privacy.
   */
  const visitorDigest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(today.toDateString() + origin + ip + userAgent)
  );
  const visitorId = Array.from(new Uint8Array(visitorDigest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await ship(
    env,
    data.name,
    { bucket: "analytics", site: origin, path: data.path },
    { visitor: visitorId, location: country }
  );
}

async function logs(env: Env, data: Logs): Promise<void> {}

async function traces(env: Env, data: Traces): Promise<void> {}

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
  fields: Record<string, string>
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

  return fetch(env.TELEGRAF_URL, {
    method: "POST",
    headers: {
      "cf-access-client-id": env.ACCESS_CLIENT_ID,
      "cf-access-client-secret": env.ACCESS_CLIENT_SECRET,
    },
    body: `${measurement},${t} ${f} ${today.getTime()}`,
  });
}
