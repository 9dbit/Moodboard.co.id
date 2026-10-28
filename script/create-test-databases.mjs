import "./check-test-env.mjs";
import pg from "pg";

// AUTH_TEST_DATABASE_URL identifies the isolated CI PostgreSQL service. This
// script never accepts arbitrary SQL/database names or a production connection.
const client = new pg.Client({ connectionString: process.env.AUTH_TEST_DATABASE_URL });
await client.connect();
try {
  for (const name of ["moodboard_payment_test", "moodboard_export_test"]) {
    try {
      await client.query(`CREATE DATABASE ${name}`);
    } catch (error) {
      if (error.code !== "42P04") throw error;
    }
  }
} finally {
  await client.end();
}
