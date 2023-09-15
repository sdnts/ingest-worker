import { expect } from "@playwright/test";
import { test } from "./setup";

test("ping", async ({ worker }) => {
  const res = await worker.fetch("/p");
  expect(res.status).toBe(202);
});
