import { endpoint as analytics } from "./endpoints/analytics";
import { endpoint as logs } from "./endpoints/logs";
import { endpoint as metrics } from "./endpoints/metrics";
import { endpoint as ping } from "./endpoints/ping";
import { endpoint as traces } from "./endpoints/traces";

export interface Env {
  telegrafUrl: string;
  telegrafClientId: string;
  telegrafClientSecret: string;
}

export const allowedOrigins = [
  "https://dietcode.io",
  "https://blob.city",
  "https://api.blob.city",
];

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
    if (!allowedOrigins.includes(origin))
      return new Response("Bad origin", { status: 400 });

    const headers: HeadersInit = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST",
    };

    if (request.method === "OPTIONS")
      return new Response(null, { status: 200, headers });

    const endpoint = [analytics, logs, metrics, ping, traces].find(
      (e) => e.path === url.pathname,
    );
    if (!endpoint) return new Response("Bad route", { status: 400, headers });

    if (!endpoint.ship)
      return new Response("Unimplemented", { status: 501, headers });

    try {
      const body = await request.json();
      const params = endpoint.schema.safeParse(body);
      if (!params.success)
        return new Response("Bad data", { status: 400, headers });

      ctx.waitUntil(
        endpoint.ship(
          // Params across schemas do not have an overlap, not sure how to make
          // TS infer the correct type here
          params as any,
          env,
          request,
        ),
      );
      return new Response(null, { status: 202, headers });
    } catch (e) {
      return new Response(null, { status: 500, headers });
    }
  },
};
