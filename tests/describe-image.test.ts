import assert from "node:assert/strict";
import { test } from "node:test";
import type OpenAI from "openai";
import sharp from "sharp";
import { describeDesignImage } from "../server/describe-image";

async function sample() {
  return sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#765432" } }).png().toBuffer();
}

test("caption request includes normalized image pixels and evidence-first instructions", async () => {
  let request: any;
  const client = { chat: { completions: { create: async (input: any) => {
    request = input;
    return { choices: [{ finish_reason: "stop", message: { content: '{"visible":true,"description":"A brown surface"}' } }] };
  } } } } as unknown as OpenAI;
  assert.equal(await describeDesignImage(client, await sample(), { mode: "short", keywords: "marble" }), "A brown surface");
  const image = request.messages[1].content.find((item: any) => item.type === "image_url");
  assert.equal(image.image_url.detail, "high");
  assert.match(image.image_url.url, /^data:image\/jpeg;base64,/);
  const metadata = await sharp(Buffer.from(image.image_url.url.split(",")[1], "base64")).metadata();
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
  assert.match(request.messages[0].content, /only if visible/);
  assert.match(request.messages[0].content, /Never invent windows/);
});

test("unreadable image bytes fail before contacting the model", async () => {
  let called = false;
  const client = { chat: { completions: { create: async () => { called = true; } } } } as unknown as OpenAI;
  await assert.rejects(describeDesignImage(client, Buffer.from("corrupt"), { mode: "short" }));
  assert.equal(called, false);
});

test("unreadable, empty and truncated model responses cannot overwrite a description", async () => {
  const buffer = await sample();
  for (const [finish_reason, content] of [
    ["stop", '{"visible":false,"description":""}'],
    ["stop", '{"visible":true,"description":""}'],
    ["length", '{"visible":true,"description":"Partial caption"}'],
  ]) {
    const client = { chat: { completions: { create: async () => ({
      choices: [{ finish_reason, message: { content } }],
    }) } } } as unknown as OpenAI;
    await assert.rejects(describeDesignImage(client, buffer, { mode: "long" }));
  }
});