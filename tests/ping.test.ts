import { test, expect } from "vitest";
import { endpoint as ping } from "../src/endpoints/ping";
import { env } from "./setup";

test("ping", async () => {
  const res = await ping.ship({ success: true, data: {} }, env);
  expect(res.status).toBe(200);
  await expect(res.text()).resolves.toBe("pong");
});
