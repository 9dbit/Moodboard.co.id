import dns from "node:dns/promises";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { createPinnedLookup } from "./image-recovery";
const pinterestRoots = new Set(["pinterest.com", "pinterest.co.uk", "pinterest.com.au", "pinterest.ca", "pinterest.de", "pinterest.fr", "pinterest.es", "pinterest.it", "pinterest.jp", "pinterest.co.kr", "pinterest.com.mx", "pinterest.pt", "pinterest.ch", "pinterest.at", "pinterest.se", "pinterest.dk", "pinterest.nl"]);
export class ImportInputError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function parsePinterestUrl(raw: string): URL {
    if (typeof raw !== "string" || raw.length > 4096)
        throw new ImportInputError("Invalid Pinterest URL");
    let url: URL;
    try {
        url = new URL(raw.trim());
    }
    catch {
        throw new ImportInputError("Enter a complete HTTPS Pinterest URL");
    }
    const host = url.hostname.toLowerCase();
    const root = host.startsWith("www.") ? host.slice(4) : host === "id.pinterest.com" ? "pinterest.com" : host;
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !(pinterestRoots.has(root) || host === "pin.it")) {
        throw new ImportInputError("Only HTTPS Pinterest and pin.it links are supported");
    }
    url.hash = "";
    return url;
}
export function isPinterestShortUrl(raw: string): boolean {
    try {
        return parsePinterestUrl(raw).hostname === "pin.it";
    }
    catch {
        return false;
    }
}
export function isPinterestBoardUrl(raw: string): boolean {
    try {
        const url = parsePinterestUrl(raw);
        const parts = url.pathname.split("/").filter(Boolean);
        return url.hostname !== "pin.it" && parts.length >= 2 && !new Set(["pin", "search", "ideas", "resource", "login", "settings", "oauth", "oembed.json"]).has(parts[0].toLowerCase());
    }
    catch {
        return false;
    }
}
const blocked = new net.BlockList();
for (const [ip, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["192.88.99.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const)
    blocked.addSubnet(ip, bits, "ipv4");
const globalV6 = new net.BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
export function isPublicImportAddress(ip: string): boolean {
    const family = net.isIP(ip);
    return family === 4 ? !blocked.check(ip, "ipv4") : family === 6 && globalV6.check(ip, "ipv6") && !blocked.check(ip, "ipv6");
}
function withinSignal<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const aborted = () => { signal.removeEventListener("abort", aborted); reject(signal.reason); };
        if (signal.aborted)
            return aborted();
        signal.addEventListener("abort", aborted, { once: true });
        operation.then(value => { signal.removeEventListener("abort", aborted); resolve(value); }, error => { signal.removeEventListener("abort", aborted); reject(error); });
    });
}
export async function validatePublicReferenceUrl(raw: string, lookup: Lookup = host => dns.lookup(host, { all: true }), signal = AbortSignal.timeout(15000)): Promise<URL> {
    let url: URL;
    try {
        url = new URL(raw);
    }
    catch {
        throw new ImportInputError("Invalid image URL");
    }
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || raw.length > 4096)
        throw new ImportInputError("Image references must use public HTTPS URLs");
    const addresses = await withinSignal(lookup(url.hostname.replace(/^\[|\]$/g, "")), signal);
    if (!addresses.length || addresses.some(a => !isPublicImportAddress(a.address)))
        throw new ImportInputError("Image reference is not a public address");
    url.hash = "";
    return url;
}
type Lookup = (hostname: string) => Promise<Array<{
    address: string;
    family: number;
}>>;
type ImportFetchOptions = {
    timeoutMs?: number;
    maxBytes?: number;
    signal?: AbortSignal;
    lookup?: Lookup;
    transport?: typeof undiciFetch;
};
/** Every destination/redirect is allowlisted, DNS checked and pinned before a socket opens. */
export async function fetchPinterest(raw: string, init: RequestInit = {}, options: ImportFetchOptions = {}): Promise<Response> {
    let url = parsePinterestUrl(raw);
    const lookup = options.lookup || ((host: string) => dns.lookup(host, { all: true }));
    const transport = options.transport || undiciFetch;
    const deadline = AbortSignal.timeout(options.timeoutMs || 30000);
    const signals = [deadline, init.signal, options.signal].filter(Boolean) as AbortSignal[];
    const signal = AbortSignal.any(signals);
    const maxBytes = options.maxBytes || 8 * 1024 * 1024;
    let method = (init.method || "GET").toUpperCase();
    let body = init.body;
    let headers = new Headers(init.headers);
    for (let redirects = 0; redirects <= 4; redirects++) {
        signal.throwIfAborted();
        const addresses = await withinSignal(lookup(url.hostname), signal);
        signal.throwIfAborted();
        if (!addresses.length || addresses.some(a => !isPublicImportAddress(a.address)))
            throw new ImportInputError("Pinterest destination is not a public address");
        const selected = addresses[0];
        const dispatcher = new Agent({ connect: { lookup: createPinnedLookup(selected.address, selected.family as 4 | 6) } });
        try {
            const response = await transport(url, { method, body: body as any, headers: [...headers], redirect: "manual", signal, dispatcher });
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get("location");
                await response.body?.cancel();
                if (!location)
                    throw new ImportInputError("Pinterest redirect has no destination");
                const next = parsePinterestUrl(new URL(location, url).href);
                if (next.origin !== url.origin) {
                    headers.delete("cookie");
                    headers.delete("authorization");
                }
                if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
                    method = "GET";
                    body = undefined;
                    headers.delete("content-type");
                }
                url = next;
                continue;
            }
            const length = Number(response.headers.get("content-length") || 0);
            if (method !== "HEAD" && length > maxBytes) {
                await response.body?.cancel();
                throw new ImportInputError("Pinterest response exceeds the download limit");
            }
            const chunks: Uint8Array[] = [];
            let size = 0;
            if (method !== "HEAD" && response.body) {
                const reader = response.body.getReader();
                try {
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        size += value.byteLength;
                        if (size > maxBytes) {
                            await reader.cancel();
                            throw new ImportInputError("Pinterest response exceeds the download limit");
                        }
                        chunks.push(value);
                    }
                }
                finally {
                    reader.releaseLock();
                }
            }
            else
                await response.body?.cancel();
            const noBody = method === "HEAD" || [204, 205, 304].includes(response.status);
            const result = new Response(noBody ? null : Buffer.concat(chunks), { status: response.status, statusText: response.statusText, headers: [...response.headers] });
            Object.defineProperty(result, "url", { value: url.href });
            return result;
        }
        finally {
            await dispatcher.close();
        }
    }
    throw new ImportInputError("Too many Pinterest redirects");
}
/** Recovery never treats a hostname-looking substring in a stored URL as trusted. */
export function pinterestImageCandidates(raw: string): string[] {
    let url: URL;
    try {
        url = new URL(raw);
    }
    catch {
        return [];
    }
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !["i.pinimg.com", "pinimg.com"].includes(url.hostname))
        return [];
    url.hash = "";
    const sizes = ["originals", "orig", "736x", "564x", "474x", "236x"];
    const candidates: string[] = [];
    if (/^\/(originals|orig|\d+x)\//.test(url.pathname))
        for (const size of sizes) {
            const candidate = new URL(url);
            candidate.pathname = url.pathname.replace(/^\/(originals|orig|\d+x)\//, `/${size}/`);
            if (candidate.href !== url.href)
                candidates.push(candidate.href);
        }
    candidates.push(url.href);
    return [...new Set(candidates)];
}
export function importDelay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted)
            return reject(signal.reason);
        const done = () => { signal?.removeEventListener("abort", abort); resolve(); };
        const timer = setTimeout(done, ms);
        const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal?.reason); };
        signal?.addEventListener("abort", abort, { once: true });
    });
}
