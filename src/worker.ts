import { endpoint as analytics } from "./endpoints/analytics";
import {
  endpoint as logs,
  type Log,
  type LogKV,
  type LogLevel,
} from "./endpoints/logs";
import { endpoint as metrics } from "./endpoints/metrics";
import { endpoint as ping } from "./endpoints/ping";
import { endpoint as traces } from "./endpoints/traces";

export interface Env {
  telegrafUrl: string;
  lokiUrl: string;

  // Values for the `ingest-worker` service token on CF Access
  // This token has permissions to talk to both Telegraf and Loki
  cfAccessClientId: string;
  cfAccessClientSecret: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    /*
     * All authentication for this Worker is offloaded to Access.
     */

    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";

    const endpoint = [analytics, logs, metrics, ping, traces].find(
      (e) => e.path === url.pathname,
    );
    if (!endpoint) return new Response("Bad route", { status: 400 });

    if (endpoint.origins) {
      if (!endpoint.origins.includes(origin))
        return new Response("Bad origin", { status: 400 });

      if (request.method === "OPTIONS")
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST",
          },
        });
    }

    if (!endpoint.ship) return new Response("Unimplemented", { status: 501 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const params = endpoint.schema.safeParse(body);
    if (!params.success) return new Response("Bad data", { status: 400 });

    ctx.waitUntil(
      endpoint.ship(
        // Params across schemas do not have an overlap, not sure how to make
        // TS infer the correct type here
        params as any,
        env,
        request,
      ),
    );

    return new Response(null, {
      status: 202,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST",
      },
    });
  },

  async tail(events: TailEvent[], env: Env, ctx: ExecutionContext) {
    // CAVEAT:
    // Because this Worker is a tail consumer, it cannot currently be tailed itself.
    // We can get around this by talking to Loki directly when we want to log.

    try {
      // Tail events can be batched, so break that open first
      events.forEach((tailEvent) =>
        tailEvent.events.forEach((e) => {
          // `e` represents a single Worker invocation

          if (!e.scriptName) throw new Error("Missing scriptName");
          if (!e.eventTimestamp) throw new Error("Missing eventTimestamp");
          if (!e.event) throw new Error("Missing event");

          const kv = {};
          const l: Log[] = [];

          if ("request" in e.event) {
            const url = new URL(e.event.request.url);
            l.push({
              level: "info",
              timestamp: { p: "ms", v: e.eventTimestamp.toString() },
              kv: {
                path: url.pathname,
                method: e.event.request.method,
              },
              message: "Incoming request",
            });
          } else if ("cron" in e.event) {
          } else if ("scheduledTime" in e.event) {
          } else if ("queue" in e.event) {
          } else if ("mailFrom" in e.event) {
          } else {
            throw new Error("Unrecognized event source");
          }

          l.push(
            ...e.logs.map((l) => {
              // Log discipline / protocol:
              // To allow for useful Kvs and messages, logs are allowed in two "formats":
              // 1. Message-only mode: `console.log("Some string", extra-params)`
              // 2. KV+Message mode: `console.log({ foo: "bar" }, "Some string", extra-params)`
              let message;
              let kv;
              if (typeof l.message[0] === "object") {
                // KV + Message mode
                kv = Object.entries(l.message[0]).reduce((o, [k, v]) => {
                  o[k] = String(v);
                  return o;
                }, {} as LogKV);
                message = l.message.slice(1).join(" ");
              } else {
                // Message-only mode
                kv = {};
                message = l.message.join(" ");
              }

              return {
                level: l.level as LogLevel,
                timestamp: { p: "ms" as const, v: l.timestamp.toString() },
                message: l.message[0],
                kv: l.message[1],
              };
            }),
            ...e.exceptions.map((l) => ({
              level: "fatal" as const,
              timestamp: { p: "ms" as const, v: l.timestamp.toString() },
              message: l.message,
            })),
          );

          if ("request" in e.event) {
            l.push({
              level: "info",
              // TODO: Make this the timestamp of the last log?
              timestamp: { p: "ms", v: e.eventTimestamp.toString() },
              kv: {
                outcome: e.outcome,
                status: e.event.response?.status ?? 0,
              },
              message: "Outgoing response",
            });
          } else if ("cron" in e.event) {
          } else if ("scheduledTime" in e.event) {
          } else if ("queue" in e.event) {
          } else if ("mailFrom" in e.event) {
          } else {
            throw new Error("Unrecognized event source");
          }

          ctx.waitUntil(
            logs.ship!(
              {
                success: true,
                data: {
                  environment: "production" as const,
                  service: e.scriptName,
                  kv,
                  logs: l,
                },
              },
              env,
            ),
          );
        }),
      );
    } catch (e) {
      // Log shipping error, let Loki know so we can alert
      ctx.waitUntil(
        logs.ship!(
          {
            success: true,
            data: {
              environment: "production",
              service: "ingest-worker",
              logs: [
                {
                  level: "fatal",
                  timestamp: { p: "ms", v: Date.now().toString() },
                  message: (e as Error).message,
                },
              ],
            },
          },
          env,
        ),
      );
    }
  },
};
