import { test, expect } from "vitest";
import { endpoint as logs } from "../src/endpoints/logs";
import { env } from "./setup";

test("with environment", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "staging",
          service: "blob-city",
        },
        values: [["001", 'message="Incoming request" level="info"']],
      },
    ],
  });
});

test("with level", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [["001", 'message="Incoming request" level="fatal"']],
      },
    ],
  });
});

test("with ms precision", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [["001000000", 'message="Incoming request" level="info"']],
      },
    ],
  });
});

test("with ns precision", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());
  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [["001", 'message="Incoming request" level="info"']],
      },
    ],
  });
});

test("without kv", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [["001", 'message="Incoming request" level="info"']],
      },
    ],
  });
});

test("with line kv", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [
          ["001", 'message="Incoming request" method="GET" level="info"'],
        ],
      },
    ],
  });
});

test("with common kv", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [
          ["001", 'message="Incoming request" rayId="1234" level="info"'],
        ],
      },
    ],
  });
});

test("with both kv", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [
          [
            "001",
            'message="Incoming request" rayId="1234" method="GET" level="info"',
          ],
        ],
      },
    ],
  });
});

test("with undefined kv values", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [["001", 'message="Incoming request" level="info"']],
      },
    ],
  });
});

test("with no message", async () => {
  const res = await logs
    .ship(
      {
        service: "blob-city",
        environment: "production",
        kv: { common: undefined },
        logs: [
          {
            level: "info",
            timestamp: { p: "ns", v: "001" },
          },
        ],
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
        },
        values: [["001", 'level="info"']],
      },
    ],
  });
});

test("multiple logs", async () => {
  const res = await logs
    .ship(
      {
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
      env,
    )
    .then((r) => r.json());

  expect(res).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city",
        },
        values: [
          [
            "001",
            'message="Incoming request" rayId="abcd" method="GET" path="/tunnel" level="info"',
          ],
          [
            "002",
            'message="Forwarding to DO" rayId="abcd" tunnelId="1234" level="debug"',
          ],
          [
            "003000000",
            'message="Creating WebSocketPair" rayId="abcd" level="trace"',
          ],
          ["004", 'message="Response" rayId="abcd" status=200 level="info"'],
        ],
      },
    ],
  });
});
