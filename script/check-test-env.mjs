import { existsSync } from "node:fs";

for (const [variable, name] of [
  ["AUTH_TEST_DATABASE_URL", "moodboard_auth_test"],
  ["PAYMENT_TEST_DATABASE_URL", "moodboard_payment_test"],
  ["EXPORT_TEST_DATABASE_URL", "moodboard_export_test"],
]) {
  if (!process.env[variable]) {
    throw new Error(`${variable} is required: CI must run database integration tests, not skip them.`);
  }
  const database = new URL(process.env[variable]);
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      !["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== `/${name}`) {
    throw new Error(`${variable} must use an isolated local database named ${name}.`);
  }
}
if (!process.env.CHROMIUM_PATH || !existsSync(process.env.CHROMIUM_PATH)) {
  throw new Error("CHROMIUM_PATH must identify an installed browser: CI must run browser regressions, not skip them.");
}
