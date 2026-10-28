import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import sharp from "sharp";
import { Agent } from "undici";
import { fetchSelectedReferenceImage, SelectedReferenceError } from "../server/selected-reference";

const publicLookup = async () => [{ address: "69.46.46.99", family: 4 }];
const imageHeaders = { "Content-Type": "image/png" };

test("selected references accept ordinary public image hosts with one validated lookup and a pinned dispatcher", async () => {
  const bytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: "#d8c6a4" } }).png().toBuffer();
  let lookups = 0, calls = 0;
  const image = await fetchSelectedReferenceImage("https://moodboard.co.id/images/sample-interior.png#preview", {
    lookup: async hostname => { assert.equal(hostname, "moodboard.co.id"); lookups++; return publicLookup(); },
    transport: async (url, init) => {
      calls++;
      assert.equal(String(url), "https://moodboard.co.id/images/sample-interior.png");
      assert.equal(init?.redirect, "manual");
      assert.ok(init?.dispatcher instanceof Agent);
      const headers = new Headers(init?.headers as any);
      assert.equal(headers.get("authorization"), null);
      assert.equal(headers.get("cookie"), null);
      assert.equal(headers.get("referer"), null);
      return new Response(bytes, { headers: { "Content-Type": "Image/PNG; charset=binary" } }) as any;
    },
  });
  assert.equal(lookups, 1); assert.equal(calls, 1);
  assert.deepEqual(image.buffer, bytes); assert.equal(image.contentType, "image/png");
});

test("selected references reject credentials, unsafe schemes/ports and private numeric or mapped address spellings before fetching", async () => {
  let calls = 0;
  for (const url of [
    "http://images.example/image.png", "file:///etc/passwd", "data:image/png;base64,Zm9v",
    "https://user:pass@images.example/image.png", "https://images.example:444/image.png",
    "https://127.0.0.1/image.png", "https://2130706433/image.png", "https://0x7f000001/image.png",
    "https://169.254.169.254/image.png", "https://192.168.1.10/image.png", "https://100.100.100.100/image.png",
    "https://[::1]/image.png", "https://[::ffff:127.0.0.1]/image.png", "https://[::ffff:c0a8:101]/image.png",
    "https://[fd00::1]/image.png", "https://[fe80::1]/image.png", "https://[2002:a00:1::1]/image.png",
  ]) {
    await assert.rejects(fetchSelectedReferenceImage(url, {
      lookup: async hostname => [{ address: hostname, family: net.isIP(hostname) || 4 }],
      transport: async () => { calls++; throw new Error("Private destination must not be contacted"); },
    }), { status: 400 }, url);
  }
  assert.equal(calls, 0);
});

test("all DNS answers must be public and redirects are resolved and checked before the next socket", async () => {
  let calls = 0;
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    lookup: async () => [{ address: "69.46.46.99", family: 4 }, { address: "10.0.0.1", family: 4 }],
    transport: async () => { calls++; throw new Error("Mixed DNS must not be fetched"); },
  }), { status: 400 });
  assert.equal(calls, 0);
  const lookedUp: string[] = [];
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    lookup: async hostname => { lookedUp.push(hostname); return hostname === "images.example" ? publicLookup() : [{ address: "::ffff:10.0.0.1", family: 6 }]; },
    transport: async () => { calls++; return new Response(null, { status: 302, headers: { Location: "https://redirect.example/image.png" } }) as any; },
  }), { status: 400 });
  assert.deepEqual(lookedUp, ["images.example", "redirect.example"]);
  assert.equal(calls, 1);
  for (const location of ["http://images.example/image.png", "https://user:pass@images.example/image.png", "https://images.example:444/image.png"]) {
    await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
      lookup: publicLookup,
      transport: async () => new Response(null, { status: 302, headers: { Location: location } }) as any,
    }), { status: 400 });
  }
});

test("public cross-origin redirects work without forwarding credentials and redirect chains are bounded", async () => {
  let calls = 0, lookups = 0;
  const out = await fetchSelectedReferenceImage("https://images.example/image.png", {
    lookup: async () => { lookups++; return publicLookup(); },
    transport: async (_url, init) => {
      calls++;
      const headers = new Headers(init?.headers as any);
      assert.equal(headers.get("cookie"), null); assert.equal(headers.get("authorization"), null);
      return (calls === 1 ? new Response(null, { status: 302, headers: { Location: "https://cdn.example/selected.png" } }) : new Response("fixture", { headers: imageHeaders })) as any;
    },
  });
  assert.equal(out.buffer.toString(), "fixture"); assert.equal(calls, 2); assert.equal(lookups, 2);
  calls = 0;
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    lookup: publicLookup,
    transport: async () => { calls++; return new Response(null, { status: 302, headers: { Location: "/again.png" } }) as any; },
  }), { status: 422, message: "Too many image redirects. Use a direct image URL or upload it on the website." });
  assert.equal(calls, 4);
});

test("declared and streamed download bounds cancel rejected bodies", async () => {
  for (const declared of [false, true]) {
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(Buffer.from("123456789")); },
      cancel() { canceled = true; },
    });
    await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
      lookup: publicLookup, maxBytes: 8,
      transport: async () => new Response(body, { headers: { ...imageHeaders, ...(declared ? { "Content-Length": "9" } : {}) } }) as any,
    }), { status: 413 });
    assert.equal(canceled, true);
  }
});

test("a single deadline includes slow DNS and stalled streamed bodies", async () => {
  let calls = 0;
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    timeoutMs: 15,
    lookup: async () => { await new Promise(resolve => setTimeout(resolve, 60)); return publicLookup(); },
    transport: async () => { calls++; throw new Error("Timed-out DNS must not be fetched"); },
  }), { status: 504 });
  assert.equal(calls, 0);
  let canceled = false, timer: ReturnType<typeof setTimeout>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(Buffer.from("partial")); timer = setTimeout(() => controller.close(), 100); },
    cancel() { canceled = true; clearTimeout(timer); },
  });
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    timeoutMs: 15, lookup: publicLookup,
    transport: async () => new Response(body, { headers: imageHeaders }) as any,
  }), { status: 504 });
  assert.equal(canceled, true);
});

test("unsupported types and upstream errors are actionable without leaking network details", async () => {
  for (const type of ["text/html", "image/svg+xml", "application/octet-stream"]) {
    await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
      lookup: publicLookup, transport: async () => new Response("not accepted", { headers: { "Content-Type": type } }) as any,
    }), { status: 415 });
  }
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    lookup: publicLookup, transport: async () => new Response("private upstream", { status: 403 }) as any,
  }), { status: 422, message: "Image source is unavailable (HTTP 403). Use a publicly accessible image URL or upload it on the website." });
  await assert.rejects(fetchSelectedReferenceImage("https://images.example/image.png", {
    lookup: async () => { throw new Error("private-network-diagnostic-secret"); },
  }), error => error instanceof SelectedReferenceError && error.status === 422 && !error.message.includes("diagnostic-secret"));
});
