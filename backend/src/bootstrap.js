import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withClient } from "./db.js";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const initSqlPath = path.resolve(__dirname, "../sql/init.sql");

export async function initializeDatabase() {
  const sql = await fs.readFile(initSqlPath, "utf8");

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);

      const passwordHash = await bcrypt.hash(config.adminPassword, 12);

      await client.query(
        `
          INSERT INTO users (username, email, password_hash, role)
          VALUES ($1, LOWER($2), $3, 'admin')
          ON CONFLICT (email) DO UPDATE
          SET username = EXCLUDED.username,
              password_hash = EXCLUDED.password_hash,
              role = EXCLUDED.role,
              updated_at = NOW()
        `,
        [config.adminUsername, config.adminEmail, passwordHash]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function closeDatabase() {
  await pool.end();
}

