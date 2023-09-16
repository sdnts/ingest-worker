import { expect, test, vi } from "vitest";
import { tail } from "../src/tail";
import { env } from "./setup";

test("no events", async () => {
  const response = await tail([], env);
  expect(response).toHaveLength(0);
});

test("shipping error logs", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1);

  const response = await tail(
    [
      {
        scriptName: null,
        exceptions: [],
        logs: [],
        outcome: "ok",
        event: {
          request: {
            url: "https://api.blob.city/tunnel",
            method: "GET",
          },
          response: { status: 101 },
        },
        eventTimestamp: 1,
        diagnosticsChannelEvents: [],
      },
    ],
    env,
  ).then((r) => Promise.all(r.map((r) => r.json())));

  expect(response).toHaveLength(1);

  // Can't use .toStrictEqual here because of the stacktrace

  expect(response[0]).toHaveProperty("streams");

  const streams: any[] = (response[0] as any).streams;
  expect(streams).toHaveLength(1);
  expect(streams[0]).toHaveProperty("stream");
  expect(streams[0]).toHaveProperty("values");

  expect(streams[0].stream).toStrictEqual({
    environment: "production",
    service: "ingest-worker",
  });
  expect(streams[0].values).toHaveLength(1);
  expect(streams[0].values[0]).toHaveLength(2);
  expect(streams[0].values[0][0]).toBe("1000000");
  expect(streams[0].values[0][1]).toMatch(
    /level="fatal" name="Error" stack="Error: Missing scriptName(.|\n)*" message="Missing scriptName"/,
  );

  vi.useRealTimers();
});

test("extra log when outcome is not ok", async () => {
  const response = await tail(
    [
      {
        scriptName: "blob-city-api",
        exceptions: [],
        logs: [],
        outcome: "cpuExceeded",
        event: {
          request: {
            url: "https://api.blob.city/tunnel",
            method: "GET",
          },
        },
        eventTimestamp: 1,
        diagnosticsChannelEvents: [],
      },
    ],
    env,
  ).then((r) => Promise.all(r.map((r) => r.json())));

  expect(response).toHaveLength(1);
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city-api",
        },
        values: [
          [
            "1000000",
            'level="fatal" outcome="cpuExceeded" message="Fatal outcome"',
          ],
        ],
      },
    ],
  });
});

test("script logs", async () => {
  const response = await tail(
    [
      {
        scriptName: "blob-city-api",
        exceptions: [],
        logs: [
          {
            level: "info",
            message: ["log1"],
            timestamp: 1,
          },
          {
            level: "warn",
            message: [{ a: "b", c: 9, d: false }, "log2", "extra", "params"],
            timestamp: 2,
          },
          {
            level: "fatal",
            message: ["log3", "extra", "params"],
            timestamp: 3,
          },
        ],
        outcome: "ok",
        event: {
          request: {
            url: "https://api.blob.city/tunnel",
            method: "GET",
          },
          response: { status: 101 },
        },
        eventTimestamp: 1,
        diagnosticsChannelEvents: [],
      },
    ],
    env,
  ).then((r) => Promise.all(r.map((r) => r.json())));

  expect(response).toHaveLength(1);
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city-api",
        },
        values: [
          ["1000000", 'level="info" message="log1"'],
          [
            "2000000",
            'level="warn" a="b" c=9 d=false message="log2 extra params"',
          ],
          ["3000000", 'level="fatal" message="log3 extra params"'],
        ],
      },
    ],
  });
});

test("script exceptions", async () => {
  const response = await tail(
    [
      {
        scriptName: "blob-city-api",
        logs: [],
        exceptions: [
          {
            name: "TypeError",
            message: "exception1",
            timestamp: 1,
          },
          {
            name: "UncaughtError",
            message: "exception2",
            timestamp: 2,
          },
        ],
        outcome: "ok",
        event: {
          request: {
            url: "https://api.blob.city/tunnel",
            method: "GET",
          },
          response: { status: 101 },
        },
        eventTimestamp: 1,
        diagnosticsChannelEvents: [],
      },
    ],
    env,
  ).then((r) => Promise.all(r.map((r) => r.json())));

  expect(response).toHaveLength(1);
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city-api",
        },
        values: [
          ["1000000", 'level="error" message="exception1"'],
          ["2000000", 'level="error" message="exception2"'],
        ],
      },
    ],
  });
});

test("event batch", async () => {
  const response = await tail(
    [
      {
        scriptName: "blob-city-api",
        exceptions: [],
        logs: [
          {
            level: "info",
            message: ["log1"],
            timestamp: 1,
          },
          {
            level: "warn",
            message: ["log2"],
            timestamp: 2,
          },
        ],
        outcome: "ok",
        event: {
          request: {
            url: "https://api.blob.city/tunnel",
            method: "GET",
          },
          response: { status: 101 },
        },
        eventTimestamp: 1,
        diagnosticsChannelEvents: [],
      },
      {
        scriptName: "blob-city-api",
        logs: [],
        exceptions: [
          {
            name: "TypeError",
            message: "exception1",
            timestamp: 3,
          },
        ],
        outcome: "ok",
        event: {
          request: {
            url: "https://api.blob.city/tunnel",
            method: "GET",
          },
          response: { status: 101 },
        },
        eventTimestamp: 1,
        diagnosticsChannelEvents: [],
      },
    ],
    env,
  ).then((r) => Promise.all(r.map((r) => r.json())));

  expect(response).toHaveLength(2);
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city-api",
        },
        values: [
          ["1000000", 'level="info" message="log1"'],
          ["2000000", 'level="warn" message="log2"'],
        ],
      },
    ],
  });
  expect(response[1]).toStrictEqual({
    streams: [
      {
        stream: {
          environment: "production",
          service: "blob-city-api",
        },
        values: [["3000000", 'level="error" message="exception1"']],
      },
    ],
  });
});
