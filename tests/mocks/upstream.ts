/**
 * This worker acts like a "latch". It records the most recent request it gets,
 * and is then able to describe it when asked.
 * It is used in tests to assert the correctness of upstream Telegraf / Loki
 * requests. Ideally, I'd have liked to mock these, but neither one of Vitest,
 * MSW or Playwright can reliably detect upstream requests, possibly because of
 * process boundaries, workerd, or both. I've wasted far too much time on JS
 * tooling and I'm not interested in making this work the "right" way anymore.
 */

let lastRequest: { method: string; body: string } | undefined;

export default {
  async fetch(request: Request) {
    return new Response(await request.text(), {
      status: 200,
      headers: {
        "Content-Type": request.headers.get("Content-Type") ?? "text/plain",
      },
    });
  },
};
