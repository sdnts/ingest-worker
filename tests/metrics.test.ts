import { test, expect } from "vitest";
import { env } from "./setup";
import { endpoint as metrics } from "../src/endpoints/metrics";

test("request metric", async () => {
  const res = await metrics
    .ship(
      {
        name: "request",
        service: "blob-city",
        environment: "production",
        path: "/tunnel",
        status: 101,
        method: "PUT",
        fields: {
          rayId: "abcd",
          tunnelId: "1234",
          peerId: "1",
        },
      },
      env,
    )
    .then((r) => r.text())
    .catch(console.log);

  expect(res).toMatch(
    `request,bucket=metrics,environment=production,service=blob-city,method=PUT,path=/tunnel,status=101 rayId="abcd",tunnelId="1234",peerId="1"`,
  );
});
