import { Env } from "../src/worker";
import { exec } from "child_process";

export const env: Env = {
  telegrafUrl: "http://127.0.0.1:8888",
  lokiUrl: "http://127.0.0.1:8888",
  cfAccessClientId: "",
  cfAccessClientSecret: "",
};

export default async function setup() {
  const aborter = new AbortController();
  exec("yarn wrangler dev --port 8888", {
    cwd: "tests/mocks",
    signal: aborter.signal,
  });

  await new Promise<void>((r) => {
    const interval = setInterval(() => {
      fetch("http://127.0.0.1:8888")
        .then(() => {
          clearInterval(interval);
          r();
        })
        .catch(() => {});
    }, 100);
  });

  return () => aborter.abort();
}
