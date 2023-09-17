import {
  endpoint as logs,
  type Log,
  type LogKV,
  type LogLevel,
} from "./endpoints/logs";
import { Env } from "./worker";

export const tail = async (
  events: TraceItem[],
  env: Env,
): Promise<Response[]> => {
  try {
    // Tail events can be batched, so break that open first
    const shipments = events.map((e) => {
      // `e` represents a single Worker invocation

      if (!e.scriptName) throw new Error("Missing scriptName");
      if (!e.eventTimestamp) throw new Error("Missing eventTimestamp");
      if (!e.event) throw new Error("Missing event");

      const lines: Log[] = [
        ...e.logs.map((l) => {
          // Log discipline / protocol:
          // To allow for useful Kvs and messages, logs are allowed in two "formats":
          // 1. Message-only mode: `console.log("Some string", extra-params)`
          // 2. KV+Message mode: `console.log({ foo: "bar" }, "Some string", extra-params)`
          let message: string;
          let kv: LogKV;
          if (typeof l.message[0] === "object") {
            // KV + Message mode
            kv = Object.entries(l.message[0]).reduce((o, [k, v]) => {
              if (
                typeof v === "string" ||
                typeof v === "number" ||
                typeof v === "boolean"
              )
                o[k] = v;
              else o[k] = String(v);
              return o;
            }, {} as LogKV);
            message = l.message.slice(1).join(" ");
          } else {
            // Message-only mode
            kv = {};
            message = l.message.join(" ");
          }

          return {
            level: l.level as LogLevel,
            timestamp: { p: "ms" as const, v: l.timestamp.toString() },
            message,
            kv,
          };
        }),
        ...e.exceptions.map((l) => ({
          level: "error" as const,
          timestamp: { p: "ms" as const, v: l.timestamp.toString() },
          message: l.message,
        })),
      ];

      if (e.outcome !== "ok") {
        if ("request" in e.event) {
          lines.push({
            level: "fatal",
            timestamp: { p: "ms", v: e.eventTimestamp.toString() },
            kv: { outcome: e.outcome },
            message: "Fatal outcome",
          });
        } else if ("cron" in e.event) {
        } else if ("scheduledTime" in e.event) {
        } else if ("queue" in e.event) {
        } else if ("mailFrom" in e.event) {
        } else {
          throw new Error("Unrecognized event source");
        }
      }

      return logs.ship(
        {
          success: true,
          data: {
            service: e.scriptName,
            environment: "production",
            logs: lines,
          },
        },
        env,
      );
    });

    return Promise.all(shipments);
  } catch (e) {
    // Log shipping error, let Loki know so we can alert
    try {
      return logs.ship!(
        {
          success: true,
          data: {
            environment: "production",
            service: "ingest-worker",
            logs: [
              {
                level: "fatal",
                timestamp: { p: "ms", v: Date.now().toString() },
                message: (e as Error).message,
                kv: { name: (e as Error).name, stack: (e as Error).stack },
              },
            ],
          },
        },
        env,
      ).then((r) => [r]);
    } catch (e) {
      // Error during error handling, this next statement must not throw
      return logs.ship!(
        {
          success: true,
          data: {
            environment: "production",
            service: "ingest-worker",
            logs: [
              {
                level: "fatal",
                timestamp: { p: "ms", v: Date.now().toString() },
                message: "An error occured while handling a log shipping error",
              },
            ],
          },
        },
        env,
      ).then((r) => [r]);
    }
  }
};
