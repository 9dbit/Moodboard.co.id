import assert from "node:assert/strict";
import { test } from "node:test";
import { objectKeyFromS3Url, signS3Upload } from "../server/replit_integrations/object_storage/s3Storage";

process.env.S3_ENDPOINT = "https://t3.storageapi.dev";
process.env.S3_BUCKET = "example-moodboard";
process.env.S3_REGION = "auto";
process.env.S3_ACCESS_KEY_ID = "test-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";

test("reads object keys from virtual-host and path-style signed URLs", () => {
  assert.equal(objectKeyFromS3Url("https://example-moodboard.t3.storageapi.dev/.private/uploads/image%20one.png?signature=test"), ".private/uploads/image one.png");
  assert.equal(objectKeyFromS3Url("https://t3.storageapi.dev/example-moodboard/.private/uploads/image.png?signature=test"), ".private/uploads/image.png");
});

test("does not normalize URLs from another bucket, origin, or protocol", () => {
  for (const url of [
    "https://another-bucket.t3.storageapi.dev/.private/uploads/image.png",
    "https://t3.storageapi.dev/another-bucket/.private/uploads/image.png",
    "https://example-moodboard.t3.storageapi.dev.attacker.example/.private/uploads/image.png",
    "http://example-moodboard.t3.storageapi.dev/.private/uploads/image.png",
  ]) assert.equal(objectKeyFromS3Url(url), null);
});

test("presigned uploads retain a stable object key without signing an empty-body checksum", async () => {
  const signed = new URL(await signS3Upload("example-moodboard", ".private/uploads/new-image"));
  assert.equal(objectKeyFromS3Url(signed.href), ".private/uploads/new-image");
  assert.equal(signed.searchParams.get("X-Amz-Expires"), "900");
  assert.equal(signed.searchParams.has("x-amz-checksum-crc32"), false);
});
