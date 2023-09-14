import { SafeParseSuccess, z } from "zod";
import { Env } from "../";

export type Endpoint<Schema extends z.Schema, Params = z.infer<Schema>> = {
  path: `/${string}`;
  schema: Schema;
  ship?: (
    params: SafeParseSuccess<Params>,
    env: Env,
    request: Request,
  ) => Promise<any>;
};
