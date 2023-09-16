import { test, expect } from "vitest";
import { endpoint as logs } from "../src/endpoints/logs";
import { env } from "./setup";

test("with environment", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "staging",
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "staging",
          service: "blob-city",
          level: "info",
        },
        values: [["001", 'msg="Incoming request"']],
      },
    ],
  });
});

test("with level", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          logs: [
            {
              level: "fatal",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
          level: "fatal",
        },
        values: [["001", 'msg="Incoming request"']],
      },
    ],
  });
});

test("with ms precision", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          logs: [
            {
              level: "info",
              timestamp: { p: "ms", v: "001" },
              message: "Incoming request",
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
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
  });
});

test("with ns precision", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());
  expect(res).toStrictEqual({
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
  });
});

test("without kv", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
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
  });
});

test("with line kv", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
              kv: { method: "GET" },
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
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
  });
});

test("with common kv", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          kv: { rayId: "1234" },
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
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
  });
});

test("with both kv", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          kv: { rayId: "1234" },
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
              kv: { method: "GET" },
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
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
  });
});

test('with undefined kv values', async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          kv: { common: undefined },
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
              kv: { line: undefined },
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
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
  });
})

test("multiple logs", async () => {
  const res = await logs
    .ship(
      {
        success: true,
        data: {
          service: "blob-city",
          environment: "production",
          kv: { rayId: "abcd" },
          logs: [
            {
              level: "info",
              timestamp: { p: "ns", v: "001" },
              message: "Incoming request",
              kv: { method: "GET", path: "/tunnel" },
            },
            {
              level: "debug",
              timestamp: { p: "ns", v: "002" },
              message: "Forwarding to DO",
              kv: { tunnelId: "1234" },
            },
            {
              level: "trace",
              timestamp: { p: "ms", v: "003" },
              message: "Creating WebSocketPair",
            },
            {
              level: "info",
              timestamp: { p: "ns", v: "004" },
              message: "Response",
              kv: { status: 200 },
            },
          ],
        },
      },
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
          level: "info",
        },
        values: [
          [
            "001",
            'rayId="abcd" method="GET" path="/tunnel" msg="Incoming request"',
          ],
          ["004", 'rayId="abcd" status=200 msg="Response"'],
        ],
      },
      {
        stream: {
          environment: "production",
          service: "blob-city",
          level: "debug",
        },
        values: [
          ["002", 'rayId="abcd" tunnelId="1234" msg="Forwarding to DO"'],
        ],
      },
      {
        stream: {
          environment: "production",
          service: "blob-city",
          level: "trace",
        },
        values: [["003000000", 'rayId="abcd" msg="Creating WebSocketPair"']],
      },
    ],
  });
});
