import { z } from "zod";
import { endpoint as metrics } from "./metrics";
import { Endpoint, EnvironmentSchema } from "./types";

export const schema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("page_view"),
    environment: EnvironmentSchema,
    path: z.string(),
  }),
]);

/*
 * Endpoint for analytics, unsecured. Generally used by client-side scripts.
 * Analytics are just a special kind of metric, so this endpoint is designed to
 * be called from browsers.
 */
export const endpoint: Endpoint<typeof schema> = {
  path: "/a",
  origins: ["https://dietcode.io", "https://blob.city"],
  schema,
  ship: async ({ data: params }, env, request) => {
    const encoder = new TextEncoder();
    const today = new Date();

    const origin = request.headers.get("origin") ?? "";
    const ip = request.headers.get("cf-connecting-ip") ?? "";
    const userAgent = request.headers.get("user-agent") ?? "";
    const country = request.headers.get("cf-ipcountry") ?? "unknown";

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
      encoder.encode(today.toDateString() + ip + userAgent),
    );
    const visitor = Array.from(new Uint8Array(visitorDigest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return metrics.ship?.(
      {
        success: true,
        data: {
          name: "page_view",
          environment: params.environment,
          origin,
          path: params.path,
          fields: {
            visitor,
            location: country,
          },
        },
      },
      env,
      request,
    );
  },
};
