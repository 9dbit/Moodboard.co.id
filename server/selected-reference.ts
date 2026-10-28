import dns from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";
import { createPinnedLookup } from "./image-recovery";
import { ImportInputError, validatePublicReferenceUrl } from "./import-network";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
type Address = { address: string; family: number };
type FetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  lookup?: (hostname: string) => Promise<Address[]>;
  transport?: typeof undiciFetch;
};

export class SelectedReferenceError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "SelectedReferenceError"; }
}

function withinSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => { signal.removeEventListener("abort", aborted); reject(signal.reason); };
    if (signal.aborted) return aborted();
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(value => { signal.removeEventListener("abort", aborted); resolve(value); }, error => { signal.removeEventListener("abort", aborted); reject(error); });
  });
}

/** Public HTTPS references selected by the user; separate from legacy pinimg recovery. */
export async function fetchSelectedReferenceImage(raw: string, options: FetchOptions = {}): Promise<{ buffer: Buffer; contentType: string }> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 12000);
  const maxBytes = Math.min(options.maxBytes ?? MAX_IMAGE_BYTES, MAX_IMAGE_BYTES);
  const lookup = options.lookup ?? (hostname => dns.lookup(hostname, { all: true }));
  const transport = options.transport ?? undiciFetch;
  let current = raw;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      signal.throwIfAborted();
      let addresses: Address[] = [];
      // Capture the exact DNS answer validated by the shared strict public-IP
      // policy, then pin that answer for the socket. No second resolution occurs.
      const url = await validatePublicReferenceUrl(current, async hostname => {
        addresses = await lookup(hostname);
        return addresses;
      }, signal);
      signal.throwIfAborted();
      const selected = addresses[0];
      const dispatcher = new Agent({ connect: { lookup: createPinnedLookup(selected.address, selected.family as 4 | 6) } });
      try {
        const response = await withinSignal(transport(url, {
          dispatcher, redirect: "manual", signal,
          headers: { Accept: "image/jpeg, image/png, image/webp, image/gif", "User-Agent": "MoodboardStudio/1.0" },
        }), signal);
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location) throw new SelectedReferenceError(422, "Image redirect has no destination. Use a direct image URL or upload it on the website.");
          if (redirects === 3) throw new SelectedReferenceError(422, "Too many image redirects. Use a direct image URL or upload it on the website.");
          try { current = new URL(location, url).href; }
          catch { throw new SelectedReferenceError(422, "Image redirect is invalid. Use a direct image URL or upload it on the website."); }
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new SelectedReferenceError(422, `Image source is unavailable (HTTP ${response.status}). Use a publicly accessible image URL or upload it on the website.`);
        }
        const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
        if (!IMAGE_TYPES.has(contentType)) {
          await response.body?.cancel();
          throw new SelectedReferenceError(415, "Choose a direct JPEG, PNG, WebP or GIF image URL; web pages and SVG are unsupported. You can also upload the image on the website.");
        }
        if (Number(response.headers.get("content-length") || 0) > maxBytes) {
          await response.body?.cancel();
          throw new SelectedReferenceError(413, "Image exceeds the 10 MB download limit. Choose a smaller image or upload a resized copy on the website.");
        }
        if (!response.body) throw new SelectedReferenceError(422, "Image source returned no image. Choose another direct image URL or upload it on the website.");
        const reader = response.body.getReader();
        const chunks: Buffer[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await withinSignal(reader.read(), signal);
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) {
              await reader.cancel();
              throw new SelectedReferenceError(413, "Image exceeds the 10 MB download limit. Choose a smaller image or upload a resized copy on the website.");
            }
            chunks.push(Buffer.from(value));
          }
        } catch (error) { await reader.cancel().catch(() => {}); throw error; }
        finally { reader.releaseLock(); }
        if (!size) throw new SelectedReferenceError(422, "Image source returned no image. Choose another direct image URL or upload it on the website.");
        // The upload service subsequently validates actual raster bytes and
        // normalizes them before attaching a private object to the user's board.
        return { buffer: Buffer.concat(chunks), contentType };
      } finally { await dispatcher.destroy(); }
    }
    throw new SelectedReferenceError(422, "Too many image redirects. Use a direct image URL or upload it on the website.");
  } catch (error) {
    if (error instanceof SelectedReferenceError) throw error;
    if (signal.aborted) throw new SelectedReferenceError(504, "Image download timed out. Try a smaller direct image URL or upload it on the website.");
    if (error instanceof ImportInputError) throw new SelectedReferenceError(400, "Image references must use public HTTPS addresses on port 443 without embedded credentials. Local and private network addresses are blocked.");
    throw new SelectedReferenceError(422, "Image could not be downloaded. Use a direct publicly accessible image URL or upload it on the website.");
  }
}
