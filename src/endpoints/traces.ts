import { z } from "zod";
import { Endpoint } from "./types";

const schema = z.never();

export const endpoint: Endpoint<typeof schema> = {
  path: "/t",
  schema,
  ship: async () => new Response("Unimplemented", { status: 501 }),
};
