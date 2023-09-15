import { test as t, expect } from "@playwright/test";
import { UnstableDevWorker, unstable_dev } from "wrangler";

type WorkerFixtures = {
  worker: UnstableDevWorker;
  upstream: UnstableDevWorker;
};

const test = t.extend<{}, WorkerFixtures>({
  worker: [
    async ({}, use) => {
      const worker = await unstable_dev("src/worker.ts", {
        experimental: { disableExperimentalWarning: true },
        vars: {
          telegrafUrl: "http://localhost:8888/put",
          lokiUrl: "http://localhost:8888/put",
        },
      });
      await use(worker);
      await worker.stop();
    },
    { scope: "worker" },
  ],
  upstream: [
    async ({}, use) => {
      const worker = await unstable_dev("tests/mocks/upstream.ts", {
        experimental: { disableExperimentalWarning: true },
      });
      await use(worker);
      await worker.stop();
    },
    { scope: "worker" },
  ],
});

test("ping", async ({ worker }) => {
  const res = await worker.fetch("/p");
  expect(res.status).toBe(202);
});

test.describe("analytics", async () => {
  test("no body", async ({ worker }) => {
    const res = await worker.fetch("/a", {
      method: "POST",
      headers: { Origin: "https://dietcode.io" },
    });

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad data");
  });

  test("malformed body", async ({ worker }) => {
    const res = await worker.fetch("/a", {
      method: "POST",
      headers: { Origin: "https://dietcode.io" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad data");
  });

  test("cors preflight", async ({ worker }) => {
    let res = await worker.fetch("/a", {
      method: "OPTIONS",
      headers: { Origin: "https://not.allowed" },
    });

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad origin");

    res = await worker.fetch("/a", {
      method: "OPTIONS",
      headers: { Origin: "https://dietcode.io" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://dietcode.io",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe("POST");
  });

  test("cors headers", async ({ worker }) => {
    const res = await worker.fetch("/a", {
      method: "POST",
      headers: { Origin: "https://dietcode.io" },
      body: JSON.stringify({ name: "page_view", path: "/random" }),
    });
    await worker.waitUntilExit();

    expect(res.status).toBe(202);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://dietcode.io",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe("POST");
  });

  test("upstream request", async ({ worker, request }) => {
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "1.1.1.1",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/random" }),
    });
    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      /page_view,bucket=metrics,environment=production,service=dietcode-io,path=\/random visitor="\w+",location="US" \d+/,
    );
  });

  test("service calculation", async ({ worker, request }) => {
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "1.1.1.1",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/random" }),
    });
    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(/service=dietcode-io/);
  });

  test("visitor uniqueness", async ({ worker, request }) => {
    // POST some analytics via visitor 1
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "1.1.1.1",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/" }),
    });
    await worker.waitUntilExit();

    let upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(/path=\/ visitor="\w+"/);

    const visitor1Id = upstreamRequest.body.match(/visitor="(\w+)"/)?.[1];
    expect(visitor1Id).not.toBeUndefined();

    // POST some analytics from a second visitor on the same page
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "2.2.2.2",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/" }),
    });
    await worker.waitUntilExit();

    upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(/path=\/ visitor="\w+"/);

    const visitor2Id = upstreamRequest.body.match(/visitor="(\w+)"/)?.[1];
    expect(visitor2Id).not.toBeUndefined();

    // ---

    // POST some analytics from the visitor 1, but a different page
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "1.1.1.1",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/sse" }),
    });
    await worker.waitUntilExit();

    upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(`path=/sse visitor="${visitor1Id}"`);

    // POST some analytics from the second visitor on a different page
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "2.2.2.2",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/cors" }),
    });
    await worker.waitUntilExit();

    upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(`path=/cors visitor="${visitor2Id}"`);
  });
});

test.describe("metrics", async () => {
  test("no body", async ({ worker }) => {
    const res = await worker.fetch("/m", { method: "POST" });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad data");
  });

  test("malformed body", async ({ worker }) => {
    const res = await worker.fetch("/m", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad data");
  });

  test("request", async ({ worker, request }) => {
    const res = await worker.fetch("/m", {
      method: "POST",
      body: JSON.stringify({
        name: "request",
        service: "blob-city",
        method: "PUT",
        path: "/tunnel",
        status: 101,
        fields: { rayId: "abcd", tunnelId: "1234", peerId: "1" },
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      `request,bucket=metrics,environment=production,service=blob-city,method=PUT,path=/tunnel,status=101 rayId="abcd",tunnelId="1234",peerId="1"`,
    );
  });
});

test.describe("logs", async () => {
  test("no body", async ({ worker }) => {
    const res = await worker.fetch("/l", { method: "POST" });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad data");
  });

  test("malformed body", async ({ worker }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Bad data");
  });

  test("logs with environment", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        environment: "staging",
        service: "blob-city",
        logs: [
          {
            timestamp: { v: "001" },
            message: "Incoming request",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "staging",
              service: "blob-city",
              level: "info",
            },
            values: [["001000000", 'msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs with level", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        logs: [
          {
            level: "fatal",
            timestamp: { v: "001" },
            message: "Incoming request",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "fatal",
            },
            values: [["001000000", 'msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs with ms precision", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        logs: [
          {
            timestamp: { v: "001" },
            message: "Incoming request",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [["001000000", 'msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs with ns precision", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        logs: [
          {
            timestamp: { p: "ns", v: "001" },
            message: "Incoming request",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [["001", 'msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs without kv", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        logs: [
          {
            timestamp: { p: "ns", v: "001" },
            message: "Incoming request",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [["001", 'msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs with line kv", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        logs: [
          {
            timestamp: { p: "ns", v: "001" },
            message: "Incoming request",
            kv: { method: "GET" },
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [["001", 'method="GET" msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs with common kv", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        kv: { rayId: "1234" },
        logs: [
          {
            timestamp: { p: "ns", v: "001" },
            message: "Incoming request",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [["001", 'rayId="1234" msg="Incoming request"']],
          },
        ],
      }),
    );
  });

  test("logs with both kv", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        kv: { rayId: "1234" },
        logs: [
          {
            timestamp: { p: "ns", v: "001" },
            message: "Incoming request",
            kv: { method: "GET" },
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [
              ["001", 'rayId="1234" method="GET" msg="Incoming request"'],
            ],
          },
        ],
      }),
    );
  });

  test("multiple logs", async ({ worker, request }) => {
    const res = await worker.fetch("/l", {
      method: "POST",
      body: JSON.stringify({
        service: "blob-city",
        kv: { rayId: "abcd" },
        logs: [
          {
            timestamp: { v: "001" },
            message: "Incoming request",
            kv: { method: "GET", path: "/tunnel" },
          },
          {
            level: "debug",
            timestamp: { v: "002" },
            message: "Forwarding to DO",
            kv: { tunnelId: "1234" },
          },
          {
            level: "trace",
            timestamp: { p: "ns", v: "003" },
            message: "Creating WebSocketPair",
          },
          {
            timestamp: { v: "004" },
            message: "Response",
            kv: { status: 200 },
          },
        ],
      }),
    });
    expect(res.status).toBe(202);

    await worker.waitUntilExit();

    const upstreamRequest = await request.get("/get").then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toBe(
      JSON.stringify({
        streams: [
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "info",
            },
            values: [
              [
                "001000000",
                'rayId="abcd" method="GET" path="/tunnel" msg="Incoming request"',
              ],
              ["004000000", 'rayId="abcd" status=200 msg="Response"'],
            ],
          },
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "debug",
            },
            values: [
              [
                "002000000",
                'rayId="abcd" tunnelId="1234" msg="Forwarding to DO"',
              ],
            ],
          },
          {
            stream: {
              environment: "production",
              service: "blob-city",
              level: "trace",
            },
            values: [["003", 'rayId="abcd" msg="Creating WebSocketPair"']],
          },
        ],
      }),
    );
  });
});
