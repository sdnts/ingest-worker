import { endpoint as analytics } from "./endpoints/analytics";
import { endpoint as logs } from "./endpoints/logs";
import { endpoint as metrics } from "./endpoints/metrics";
import { endpoint as ping } from "./endpoints/ping";
import { endpoint as traces } from "./endpoints/traces";
import { tail } from "./tail";

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

  async tail(
    events: TraceItem[],
    env: Env,
    ctx: Pick<ExecutionContext, "waitUntil">,
  ) {
    // CAVEAT:
    // Because this Worker is a tail consumer, it cannot currently be tailed itself.
    // We can get around this by talking to Loki directly when we want to log.

    ctx.waitUntil(
      logs.ship(
        {
          success: true,
          data: {
            environment: "production",
            service: "ingest-worker",
            logs: [
              {
                level: "info",
                timestamp: { p: "ms", v: Date.now().toString() },
                kv: {
                  events: events.length,
                  services: Array.from(
                    new Set(events.map((e) => e.scriptName)),
                  ).join(","),
                },
                message: "Received tail event",
              },
            ],
          },
        },
        env,
      ),
    );

    if (events.length == 0) return;
    ctx.waitUntil(tail(events, env));

    // TODO: Batched Loki pushes to avoid thundering herd?
    // TODO: Retry on failures?
  },
};
