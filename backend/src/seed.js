import { closeDatabase, initializeDatabase } from "./bootstrap.js";

try {
  await initializeDatabase();
  console.log("Seed completed successfully.");
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}

