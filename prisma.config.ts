/* Prisma 7 configuration. DATABASE_URL comes from .env (dotenv, for the CLI)
   or from PM2's ecosystem.config.js at runtime. */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    /* `prisma generate` (npm postinstall) must work without a real URL */
    url: process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset",
  },
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.mjs",
  },
});
