import { expect } from "@playwright/test";
import { test } from "./setup";

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
          values: [["001", 'rayId="1234" method="GET" msg="Incoming request"']],
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
