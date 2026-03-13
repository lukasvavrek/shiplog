import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

// During build, DATABASE_URL may not be set. Provide a placeholder so module
// initialisation doesn't throw; real queries will only run at request time
// when the actual env var is present.
const sql = neon(
  process.env.DATABASE_URL ??
    "postgresql://build:build@build.neon.tech/build?sslmode=require"
);
export const db = drizzle(sql, { schema });
