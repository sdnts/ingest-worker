import { SafeParseSuccess, z } from "zod";
import { Env } from "../worker";

export type Endpoint<Schema extends z.Schema, Params = z.infer<Schema>> = {
  path: `/${string}`;
  origins?: string[];
  schema: Schema;
  ship: (
    params: SafeParseSuccess<Params>,
    env: Env,
    request?: Request,
  ) => Promise<Response>;
};

export const EnvironmentSchema = z
  .enum(["development", "staging", "production"])
  .default("production");
