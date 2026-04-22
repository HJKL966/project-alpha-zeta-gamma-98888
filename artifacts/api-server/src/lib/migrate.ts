import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

export async function ensureSchema() {
  if (!db) {
    logger.warn("Skipping schema migration — DATABASE_URL is not set");
    return;
  }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Database schema ensured");
  } catch (err) {
    logger.error({ err }, "Failed to ensure schema");
  }
}
