import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

config({ path: resolve(import.meta.dirname, "apps/web/.env.local") });

const url = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

if (!url) {
  throw new Error(
    "Set DATABASE_URL or DIRECT_URL in apps/web/.env.local to connect Prisma to Supabase."
  );
}

export default defineConfig({
  schema: "apps/web/prisma/schema.prisma",
  migrations: {
    seed: "tsx apps/web/prisma/seed.ts",
  },
  datasource: {
    url,
  },
});
