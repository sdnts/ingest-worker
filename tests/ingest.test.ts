import { test as t, expect } from "@playwright/test";
import { UnstableDevWorker, unstable_dev } from "wrangler";

type WorkerFixtures = {
  worker: UnstableDevWorker;
  upstream: UnstableDevWorker;
};

const test = t.extend<{}, WorkerFixtures>({
  worker: [
    async ({ }, use) => {
      const worker = await unstable_dev("src/worker.ts", {
        experimental: { disableExperimentalWarning: true },
      });
      await use(worker);
      await worker.stop();
    },
    { scope: "worker" },
  ],
  upstream: [
    async ({ }, use) => {
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

  test("incorrect schema", async ({ worker }) => {
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

  test("cors headers", async ({ worker, request }) => {
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

    const upstreamRequest = await request
      .get("http://localhost:8888/get")
      .then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      'page_view,bucket=metrics,origin=https://dietcode.io,path=/random visitor="b6b9d1b50d2e72ad62db863748c044c817e4953fe347d6ce0c1f975a01a40adf",location="US"',
    );
  });

  test("visitor uniqueness", async ({ worker, request }) => {
    let visitor1Id =
      "b6b9d1b50d2e72ad62db863748c044c817e4953fe347d6ce0c1f975a01a40adf";
    let visitor2Id =
      "9b72ddad82d7e9ecb7da3e109eab9f0386476074ece2a2c8f8afed1dae7facc2";

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

    let upstreamRequest = await request
      .get("http://localhost:8888/get")
      .then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      `page_view,bucket=metrics,origin=https://dietcode.io,path=/ visitor="${visitor1Id}",location="US"`,
    );

    // POST some analytics from the same visitor, but a different page
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

    upstreamRequest = await request
      .get("http://localhost:8888/get")
      .then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      `page_view,bucket=metrics,origin=https://dietcode.io,path=/sse visitor="${visitor1Id}",location="US"`,
    );

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

    upstreamRequest = await request
      .get("http://localhost:8888/get")
      .then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      `page_view,bucket=metrics,origin=https://dietcode.io,path=/ visitor="${visitor2Id}",location="US"`,
    );

    // POST some analytics from the second visitor on the second page
    await worker.fetch("/a", {
      method: "POST",
      headers: {
        Origin: "https://dietcode.io",
        "CF-Connecting-IP": "2.2.2.2",
        "User-Agent": "user-agent",
        "CF-IPCountry": "US",
      },
      body: JSON.stringify({ name: "page_view", path: "/sse" }),
    });
    await worker.waitUntilExit();

    upstreamRequest = await request
      .get("http://localhost:8888/get")
      .then((r) => r.json());
    expect(upstreamRequest).not.toBeUndefined();
    expect(upstreamRequest.method).toBe("POST");
    expect(upstreamRequest.body).toMatch(
      `page_view,bucket=metrics,origin=https://dietcode.io,path=/sse visitor="${visitor2Id}",location="US"`,
    );
  });
});
