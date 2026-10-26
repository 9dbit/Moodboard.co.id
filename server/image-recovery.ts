import dns from "node:dns/promises";
import net from "node:net";
import sharp from "sharp";
import { Agent, fetch as undiciFetch } from "undici";

// Node's autoSelectFamily requests lookup({ all: true }); preserve that
// callback contract while returning only the already-validated address.
export function createPinnedLookup(address: string, family: 4 | 6): net.LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family }]);
    } else {
      callback(null, address, family);
    }
  };
}

export const IMAGE_LIMITS = {
  bytes: 8 * 1024 * 1024,
  pixels: 20_000_000,
  dimension: 7000,
  fetchBytes: 25 * 1024 * 1024,
};

const privateRanges = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./,
  /^0\./, /^224\./, /^2(?:2[5-9]|3\d)\./,
  /^::1$/, /^::$/, /^fc/i, /^fd/i, /^fe80:/i, /^ff/i, /^::ffff:(?:127|10|192\.168|169\.254)\./i,
];

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) return privateRanges.some((r) => r.test(address));
  if (net.isIPv6(address)) return privateRanges.some((r) => r.test(address));
  return false;
}

export async function validateRemoteUrl(raw: string): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS image sources are allowed");
  if (!url.hostname || url.username || url.password) throw new Error("Invalid image source");
  if (url.hostname !== "i.pinimg.com" && url.hostname !== "pinimg.com") {
    throw new Error("Remote image domain is not supported; upload the image to repair it");
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Image source resolves to a private address");
  }
  const selected = addresses[0];
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}

async function readLimited(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > IMAGE_LIMITS.fetchBytes) throw new Error("Image exceeds download limit");
  if (!response.body) throw new Error("Image response has no body");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > IMAGE_LIMITS.fetchBytes) {
        await reader.cancel("Image exceeds download limit");
        throw new Error("Image exceeds download limit");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function fetchRemoteImage(raw: string, timeoutMs = 12000): Promise<{ buffer: Buffer; contentType: string }> {
  let current = await validateRemoteUrl(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const dispatcher = new Agent({
      connect: {
        lookup: createPinnedLookup(current.address, current.family),
      },
    });
    try {
      const response = await undiciFetch(current.url, {
        dispatcher,
        redirect: "manual",
        headers: { Accept: "image/*", "User-Agent": "MoodboardStudio/1.0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Image redirect has no location");
        await response.body?.cancel();
        current = await validateRemoteUrl(new URL(location, current.url).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Image server returned HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("image/")) throw new Error("Image source is not an image");
      return { buffer: await readLimited(response as unknown as Response), contentType };
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error("Too many image redirects");
}

export async function inspectImageBuffer(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer, { limitInputPixels: 80_000_000, failOn: "error" }).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (!width || !height || !metadata.format) return { status: "corrupt_or_unsupported" as const, fileSize: buffer.length };
    const oversized = buffer.length > IMAGE_LIMITS.bytes ||
      width * height > IMAGE_LIMITS.pixels || Math.max(width, height) > IMAGE_LIMITS.dimension;
    const withinDecodeLimit = width * height <= 80_000_000;
    if (withinDecodeLimit) {
      // Metadata alone accepts some truncated JPEGs. Force a real pixel decode so
      // health status matches what PDF rendering can actually consume.
      await sharp(buffer, { limitInputPixels: 80_000_000, failOn: "error" })
        .rotate()
        .resize({ width: 1, height: 1, fit: "inside" })
        .raw()
        .toBuffer();
    }
    return {
      status: oversized ? "oversized" as const : "healthy" as const,
      repairable: oversized && withinDecodeLimit,
      width,
      height,
      fileSize: buffer.length,
      format: metadata.format,
    };
  } catch {
    return { status: "corrupt_or_unsupported" as const, fileSize: buffer.length };
  }
}

export async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}