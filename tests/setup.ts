import { test as t } from "@playwright/test";
import { UnstableDevWorker, unstable_dev } from "wrangler";

type WorkerFixtures = {
  worker: UnstableDevWorker;
};

export const test = t.extend<{}, WorkerFixtures>({
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
});
