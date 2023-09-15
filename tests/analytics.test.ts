import { expect } from "@playwright/test";
import { test } from "./setup";

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
