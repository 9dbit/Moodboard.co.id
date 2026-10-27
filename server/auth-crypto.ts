import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}
export function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error("Password must contain 12 to 128 characters");
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  const parts = encoded?.split("$");
  const valid = parts?.length === 3 && parts[0] === "scrypt-v1" && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Unknown identities still perform the same expensive derivation as real accounts.
  const salt = valid ? parts[1] : "00000000000000000000000000000000";
  const expected = valid ? Buffer.from(parts[2], "hex") : Buffer.alloc(64);
  const actual = await derive(password.slice(0, 128), salt);
  return !!valid && timingSafeEqual(actual, expected);
}
export function newToken(): string { return randomBytes(32).toString("hex"); }
export function validToken(token: unknown): token is string { return typeof token === "string" && /^[a-f0-9]{64}$/.test(token); }
export function hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
