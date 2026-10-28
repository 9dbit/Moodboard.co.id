import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { renderMoodboardPdf, type ExportSnapshot } from "../server/export-renderer";

function fixture(count: number): ExportSnapshot {
  return {
    project: { id: 12, userId: "review-user", title: "Referensi ruang café", paperSize: "A4", orientation: "horizontal", gridColumns: 2, imageLayout: "square", showCover: false } as ExportSnapshot["project"],
    pins: Array.from({ length: count }, (_, index) => ({ id: index + 1, projectId: 12, position: index, title: `Reference ${index + 1}`, imagePath: `/objects/uploads/${index + 1}`, descriptionFinal: "Warm room with neutral finishes." })) as ExportSnapshot["pins"],
  };
}

test("server renderer includes every reference beyond 30 pages and produces a valid PDF", async () => {
  const snapshot = fixture(124);
  const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#d7b58c" } }).png().toBuffer();
  const seen: number[] = [];
  const rendered = await renderMoodboardPdf(snapshot, { readImage: async pin => { seen.push(pin.id); return image; } });
  assert.deepEqual(seen, snapshot.pins.map(pin => pin.id));
  assert.deepEqual(rendered.includedPinIds, seen);
  const pdf = await PDFDocument.load(rendered.bytes);
  assert.equal(pdf.getPageCount(), rendered.pageCount);
  assert.ok(pdf.getPageCount() > 30);
  assert.equal(pdf.getTitle(), snapshot.project.title);
});

test("long captions receive continuation pages rather than being silently discarded", async () => {
  const snapshot = fixture(1);
  snapshot.pins[0].descriptionFinal = "A detailed reference caption describing the visible space and finishes. ".repeat(130);
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#eee" } }).jpeg().toBuffer();
  const rendered = await renderMoodboardPdf(snapshot, { readImage: async () => image });
  assert.ok(rendered.pageCount > 1);
  assert.deepEqual(rendered.includedPinIds, [1]);
});

test("unreadable images, empty selections and excessive selections fail without a partial PDF", async () => {
  await assert.rejects(renderMoodboardPdf(fixture(1), { readImage: async () => Buffer.from("not an image") }));
  await assert.rejects(renderMoodboardPdf(fixture(0), { readImage: async () => Buffer.alloc(0) }), /at least one/);
  await assert.rejects(renderMoodboardPdf(fixture(501), { readImage: async () => Buffer.alloc(0) }), /500 references/);
  const excessiveText = fixture(1);
  excessiveText.pins[0].descriptionFinal = "A".repeat(250_001);
  await assert.rejects(renderMoodboardPdf(excessiveText, { readImage: async () => Buffer.alloc(0) }), /250,000/);
});

test("cancelled render attempts stop before reading any reference image", async () => {
  const controller = new AbortController(); controller.abort();
  let reads = 0;
  await assert.rejects(renderMoodboardPdf(fixture(2), { signal: controller.signal, readImage: async () => { reads++; return Buffer.alloc(0); } }), /abort/i);
  assert.equal(reads, 0);
});
