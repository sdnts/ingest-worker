import { z } from "zod";
import { Endpoint } from "./types";

const schema = z.any();

export const endpoint: Endpoint<typeof schema> = {
  path: "/p",
  schema,
  ship: async () => { },
};
