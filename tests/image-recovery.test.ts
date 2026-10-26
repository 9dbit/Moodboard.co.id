import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  inspectImageBuffer,
  createPinnedLookup,
  isPrivateAddress,
  optimizeImage,
} from "../server/image-recovery";

test("pinned DNS lookup supports both Node single and all-address contracts", () => {
  const lookup = createPinnedLookup("8.8.8.8", 4);
  lookup("i.pinimg.com", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: "8.8.8.8", family: 4 }]);
  });
  lookup("i.pinimg.com", {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, "8.8.8.8");
    assert.equal(family, 4);
  });
});

test("classifies normal, oversized, and corrupt images", async () => {
  const normal = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#8b5e3c" },
  }).jpeg().toBuffer();
  assert.equal((await inspectImageBuffer(normal)).status, "healthy");

  const oversized = await sharp({
    create: { width: 7101, height: 2, channels: 3, background: "#ffffff" },
  }).png().toBuffer();
  assert.equal((await inspectImageBuffer(oversized)).status, "oversized");

  assert.equal((await inspectImageBuffer(Buffer.from("not an image"))).status, "corrupt_or_unsupported");

  const completeJpeg = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#8b5e3c" },
  }).jpeg({ quality: 90 }).toBuffer();
  const truncatedJpeg = completeJpeg.subarray(0, Math.floor(completeJpeg.length / 2));
  assert.equal((await inspectImageBuffer(truncatedJpeg)).status, "corrupt_or_unsupported");
});

test("optimized images are normalized JPEGs within export dimensions", async () => {
  const source = await sharp({
    create: { width: 2400, height: 1200, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 0.5 } },
  }).png().toBuffer();
  const optimized = await optimizeImage(source);
  const metadata = await sharp(optimized).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1800);
  assert.equal(metadata.height, 900);
});

test("blocks private and special-use network addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.4", "172.16.0.1", "192.168.1.2", "169.254.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false);
});