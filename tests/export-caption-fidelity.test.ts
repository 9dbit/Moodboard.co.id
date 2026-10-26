import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const exportSource = readFileSync("client/src/components/export-modal.tsx", "utf8");
const editorSource = readFileSync("client/src/pages/editor.tsx", "utf8");
const cardSource = readFileSync("client/src/lib/export-card.ts", "utf8");

test("export captions use an opaque white card and transparent caption", () => {
  assert.match(exportSource, /parent\.style\.backgroundColor = EXPORT_CARD_SURFACE/);
  assert.match(exportSource, /descCard\.style\.backgroundColor = "transparent"/);
  assert.match(exportSource, /descEl\.style\.color = EXPORT_CARD_TEXT/);
  assert.match(cardSource, /EXPORT_CARD_SURFACE = "#ffffff"/);
  assert.match(editorSource, /backgroundColor: EXPORT_CARD_SURFACE/);
  assert.match(editorSource, /backgroundColor: "transparent", alignItems: "flex-start"/);
});

test("export descriptions grow instead of inheriting editor truncation", () => {
  const descriptionBuilder = exportSource.slice(
    exportSource.indexOf("const addDescriptionEl"),
    exportSource.indexOf("const addShortDescriptionEl"),
  );
  const overflowBuilder = exportSource.slice(
    exportSource.indexOf("const createDescOverflowCell"),
    exportSource.indexOf("if (layout.useGrid)"),
  );

  assert.doesNotMatch(descriptionBuilder, /minHeight/);
  assert.doesNotMatch(descriptionBuilder, /lineClamp|WebkitLineClamp|overflow\s*=\s*"hidden"/);
  assert.doesNotMatch(overflowBuilder, /overflow\s*=\s*"hidden"/);
  assert.match(descriptionBuilder, /lineHeight = "1\.3"/);
});

test("export rasterizes card shadows after layout", () => {
  assert.match(exportSource, /appendRasterizedShadowLayer/);
  assert.match(cardSource, /data-export-shadow-card/);
  assert.match(cardSource, /dataset\.exportRasterizedShadows/);
  assert.match(cardSource, /globalCompositeOperation = "destination-out"/);
  assert.match(cardSource, /boxShadow = "none"/);
  assert.match(exportSource, /appendRasterizedShadowLayer\(pageEl, canvasWidthPx \/ screenW\)/);
});

test("export includes both designer and client sign-off cells", () => {
  assert.match(exportSource, /makeSignatureCell\(project\.designerName \|\| "", "Project Designer"\)/);
  assert.match(exportSource, /makeSignatureCell\(project\.clientOwnerName \|\| "", "Client"\)/);
});
