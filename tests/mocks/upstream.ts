let lastRequest: { method: string; body: string } | undefined;

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/get") {
      return new Response(JSON.stringify(lastRequest), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } else if (url.pathname === "/put") {
      lastRequest = { method: request.method, body: await request.text() };
      return new Response(null, { status: 200 });
    } else if (url.pathname === "/reset") {
      lastRequest = undefined;
    }

    return new Response(null, { status: 400 });
  },
};
