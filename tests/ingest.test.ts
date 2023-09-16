import { describe, test as t, expect } from "vitest";
import { UnstableDevWorker, unstable_dev } from "wrangler";

type WorkerFixtures = {
  worker: UnstableDevWorker;
};

export const test = t.extend<WorkerFixtures>({
  worker: async ({}, use) => {
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
});

describe("request validation", () => {
  ["/a", "/l", "/m", "/t"].forEach((path) => {
    test(`[${path}] no body`, async ({ worker }) => {
      const res = await worker.fetch(path, { method: "POST" });
      expect(res.status).toBe(400);
    });

    test(`[${path}] malformed body`, async ({ worker }) => {
      const res = await worker.fetch(path, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });
});

describe("CORS", () => {
  ["/a"].forEach((path) => {
    test(`[${path}] preflight`, async ({ worker }) => {
      let res = await worker.fetch(path, {
        method: "OPTIONS",
        headers: { Origin: "https://not.allowed" },
      });

      expect(res.status).toBe(400);
      await expect(res.text()).resolves.toBe("Bad origin");

      res = await worker.fetch(path, {
        method: "OPTIONS",
        headers: { Origin: "https://dietcode.io" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "https://dietcode.io",
      );
      expect(res.headers.get("access-control-allow-methods")).toBe("POST");
    });

    test(`[${path}] headers`, async ({ worker }) => {
      const res = await worker.fetch(path, {
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
  });
});
