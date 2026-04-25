import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  user: config.postgresUser,
  password: config.postgresPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.postgresDb
});

export async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

