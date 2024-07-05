import { expect, test, vi } from "vitest";
import { tail } from "../src/tail";
import { env } from "./setup";

test("ingest-worker logs", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1);

  const response = await tail(
    [
      {
        scriptName: "blob-city-api",
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

  vi.useRealTimers();

  expect(response).toHaveLength(2);
  expect(response[1]).toStrictEqual({
    streams: [
      {
        stream: {
          service: "ingest-worker",
          environment: "production",
        },
        values: [
          [
            "1000000",
            'message="Processing event" logCount=0 exceptionCount=0 scriptName="blob-city-api" eventTimestamp=1 outcome="ok" level="debug"',
          ],
          ["1000000", 'message="Lines ready" lineCount=0 level="debug"'],
        ],
      },
    ],
  });
});

test("no events", async () => {
  const response = await tail([], env).then((r) =>
    Promise.all(r.map((r) => r.json())),
  );

  expect(response).toHaveLength(1); // Includes 1 extra Response for ingest-worker logs that we won't assert here
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

  vi.useRealTimers();

  expect(response).toHaveLength(1);

  // Can't use .toStrictEqual here because of the stacktrace

  expect(response[0]).toHaveProperty("streams");

  const streams: any[] = (response[0] as any).streams;
  expect(streams).toHaveLength(1);
  expect(streams[0]).toHaveProperty("stream");
  expect(streams[0]).toHaveProperty("values");

  expect(streams[0].stream).toStrictEqual({
    service: "ingest-worker",
    environment: "production",
  });
  expect(streams[0].values).toHaveLength(1);
  expect(streams[0].values[0]).toHaveLength(2);
  expect(streams[0].values[0][0]).toBe("1000000");
  expect(streams[0].values[0][1]).toMatch(
    /message="Missing scriptName" name="Error" stack="Error: Missing scriptName(.|\n)*" level="fatal"/,
  );
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

  expect(response).toHaveLength(2); // Includes 1 extra Response for ingest-worker logs that we won't assert here
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          service: "blob-city-api",
          environment: "production",
        },
        values: [
          [
            "1000000",
            'message="Fatal outcome" outcome="cpuExceeded" level="fatal"',
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

  expect(response).toHaveLength(2); // Includes 1 extra Response for ingest-worker logs that we won't assert here
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          service: "blob-city-api",
          environment: "production",
        },
        values: [
          ["1000000", 'message="log1" level="info"'],
          [
            "2000000",
            'message="log2 extra params" a="b" c=9 d=false level="warn"',
          ],
          ["3000000", 'message="log3 extra params" level="fatal"'],
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

  expect(response).toHaveLength(2); // Includes 1 extra Response for ingest-worker logs that we won't assert here
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          service: "blob-city-api",
          environment: "production",
        },
        values: [
          ["1000000", 'message="exception1" level="error"'],
          ["2000000", 'message="exception2" level="error"'],
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

  expect(response).toHaveLength(3); // Includes 1 extra Response for ingest-worker logs that we won't assert here
  expect(response[0]).toStrictEqual({
    streams: [
      {
        stream: {
          service: "blob-city-api",
          environment: "production",
        },
        values: [
          ["1000000", 'message="log1" level="info"'],
          ["2000000", 'message="log2" level="warn"'],
        ],
      },
    ],
  });
  expect(response[1]).toStrictEqual({
    streams: [
      {
        stream: {
          service: "blob-city-api",
          environment: "production",
        },
        values: [["3000000", 'message="exception1" level="error"']],
      },
    ],
  });
});
