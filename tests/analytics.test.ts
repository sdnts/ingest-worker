// @vitest-environment happy-dom

import { test, expect } from "vitest";
import { endpoint as analytics } from "../src/endpoints/analytics";
import { env } from "./setup";

test("service calculation", async () => {
  const response = await analytics
    .ship(
      {
        success: true,
        data: {
          name: "page_view",
          environment: "production",
          path: "/random",
        },
      },
      env,
      new Request("https://in.sdnts.dev/a", {
        headers: {
          Origin: "https://dietcode.io",
          "CF-Connecting-IP": "1.1.1.1",
          "User-Agent": "user-agent",
          "CF-IPCountry": "US",
        },
      }),
    )
    .then((r) => r.text());

  expect(response).toMatch(
    /page_view,bucket=metrics,environment=production,service=dietcode-io,path=\/random visitor="\w+",location="US" \d+/,
  );
});

test("visitor uniqueness", async () => {
  // POST some analytics via visitor 1
  let res = await analytics
    .ship(
      {
        success: true,
        data: {
          environment: "production",
          name: "page_view",
          path: "/",
        },
      },
      env,
      new Request("https://in.sdnts.dev/a", {
        headers: {
          Origin: "https://dietcode.io",
          "CF-Connecting-IP": "1.1.1.1",
          "User-Agent": "user-agent",
          "CF-IPCountry": "US",
        },
      }),
    )
    .then((r) => r.text());
  expect(res).toMatch(/path=\/ visitor="\w+"/);

  const visitor1Id = res.match(/visitor="(\w+)"/)?.[1];
  expect(visitor1Id).not.toBeUndefined();

  // POST some analytics from a second visitor on the same page
  res = await analytics
    .ship(
      {
        success: true,
        data: {
          environment: "production",
          name: "page_view",
          path: "/",
        },
      },
      env,
      new Request("https://in.sdnts.dev/a", {
        headers: {
          Origin: "https://dietcode.io",
          "CF-Connecting-IP": "2.2.2.2",
          "User-Agent": "user-agent",
          "CF-IPCountry": "US",
        },
      }),
    )
    .then((r) => r.text());
  expect(res).toMatch(/path=\/ visitor="\w+"/);

  const visitor2Id = res.match(/visitor="(\w+)"/)?.[1];
  expect(visitor2Id).not.toBeUndefined();

  // POST some analytics from the visitor 1, but a different page
  res = await analytics
    .ship(
      {
        success: true,
        data: {
          environment: "production",
          name: "page_view",
          path: "/sse",
        },
      },
      env,
      new Request("https://in.sdnts.dev/a", {
        headers: {
          Origin: "https://dietcode.io",
          "CF-Connecting-IP": "1.1.1.1",
          "User-Agent": "user-agent",
          "CF-IPCountry": "US",
        },
      }),
    )
    .then((r) => r.text());
  expect(res).toMatch(`path=/sse visitor="${visitor1Id}"`);

  // POST some analytics from the second visitor on a different page
  res = await analytics
    .ship(
      {
        success: true,
        data: {
          environment: "production",
          name: "page_view",
          path: "/cors",
        },
      },
      env,
      new Request("https://in.sdnts.dev/a", {
        headers: {
          Origin: "https://dietcode.io",
          "CF-Connecting-IP": "2.2.2.2",
          "User-Agent": "user-agent",
          "CF-IPCountry": "US",
        },
      }),
    )
    .then((r) => r.text());
  expect(res).toMatch(`path=/cors visitor="${visitor2Id}"`);
});
