import { expect, test } from "vitest";
import { tail } from "../src/tail";

const env = {
  telegrafUrl: "http://localhost:8888/put",
  lokiUrl: "http://localhost:8888/put",
  cfAccessClientId: "",
  cfAccessClientSecret: "",
};

test("no events", async () => {
  const response = await tail([], env);
  expect(response).toHaveLength(0);
});
