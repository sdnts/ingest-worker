import { SafeParseSuccess, z } from "zod";
import { Env } from "../worker";

export interface Endpoint<Schema extends z.ZodSchema> {
  path: `/${string}`;
  origins?: string[];
  schema: Schema;
  ship: <P extends SafeParseSuccess<z.infer<Schema>>["data"]>(
    params: P,
    env: Env,
    request?: Request,
  ) => Promise<Response>;
}

export const EnvironmentSchema = z
  .enum(["development", "staging", "production"])
  .default("production");
