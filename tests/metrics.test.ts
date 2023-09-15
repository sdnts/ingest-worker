import { expect } from "@playwright/test";
import { test } from "./setup";

test("no body", async ({ worker }) => {
  const res = await worker.fetch("/m", { method: "POST" });
  expect(res.status).toBe(400);
  await expect(res.text()).resolves.toBe("Bad data");
});

test("malformed body", async ({ worker }) => {
  const res = await worker.fetch("/m", {
    method: "POST",
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  await expect(res.text()).resolves.toBe("Bad data");
});

test("request", async ({ worker, request }) => {
  const res = await worker.fetch("/m", {
    method: "POST",
    body: JSON.stringify({
      name: "request",
      service: "blob-city",
      method: "PUT",
      path: "/tunnel",
      status: 101,
      fields: { rayId: "abcd", tunnelId: "1234", peerId: "1" },
    }),
  });
  expect(res.status).toBe(202);

  await worker.waitUntilExit();

  const upstreamRequest = await request.get("/get").then((r) => r.json());
  expect(upstreamRequest).not.toBeUndefined();
  expect(upstreamRequest.method).toBe("POST");
  expect(upstreamRequest.body).toMatch(
    `request,bucket=metrics,environment=production,service=blob-city,method=PUT,path=/tunnel,status=101 rayId="abcd",tunnelId="1234",peerId="1"`,
  );
});
