import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGridLayout, paginateMoodboard } from "../shared/layout-pagination";
import type { Project, Pin } from "../shared/schema";

export type ExportSnapshot = { project: Project; pins: Pin[] };
export type ExportRenderOptions = {
  readImage: (pin: Pin) => Promise<Buffer>;
  onProgress?: (completed: number, total: number) => Promise<void>;
  signal?: AbortSignal;
};
const MM = 72 / 25.4;
const PAPER: Record<string, [number, number]> = { A4: [210, 297], A3: [297, 420], A2: [420, 594] };
const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MAX_EMBEDDED_IMAGE_BYTES = 32 * 1024 * 1024;
let fontBytes: Promise<Buffer> | undefined;
function fontData() {
  return fontBytes ??= (async () => {
    const candidates = [
      ...(typeof __dirname === "string" ? [resolve(__dirname, "assets/NotoSans-Regular.ttf")] : []),
      resolve(process.cwd(), "server/assets/NotoSans-Regular.ttf"),
      resolve(process.cwd(), "dist/assets/NotoSans-Regular.ttf"),
    ];
    for (const filename of candidates) {
      try { return await readFile(filename); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    throw new Error("The bundled PDF font is unavailable.");
  })();
}
function clean(value: unknown) { return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""); }
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const letter of word) {
        if (line && font.widthOfTextAtSize(line + letter, size) > width) { lines.push(line); line = ""; }
        line += letter;
      }
    }
    lines.push(line);
  }
  return lines;
}
function color(hex: string | null | undefined) {
  if (!/^#[a-f0-9]{6}$/i.test(hex || "")) return rgb(1, 1, 1);
  return rgb(parseInt(hex!.slice(1, 3), 16) / 255, parseInt(hex!.slice(3, 5), 16) / 255, parseInt(hex!.slice(5, 7), 16) / 255);
}

/** A backend renderer: selected references are either all included or the job fails. */
export async function renderMoodboardPdf(snapshot: ExportSnapshot, options: ExportRenderOptions) {
  const { project } = snapshot;
  const pins = [...snapshot.pins].sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id);
  if (!pins.length) throw new Error("Add at least one reference image before exporting.");
  if (pins.length > 500) throw new Error("Server exports support up to 500 references. Select a smaller board; no references were exported.");
  const captionCharacters = pins.reduce((total, pin) => total + clean(pin.title).length + clean(pin.descriptionFinal || pin.descriptionAi || pin.descriptionCustomInput).length, 0)
    + clean(project.title).length + clean(project.descriptionAi || project.descriptionRaw).length;
  if (captionCharacters > 250_000) throw new Error("This PDF contains more than 250,000 caption characters. Reduce the text or split the board; no partial PDF was published.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await fontData(), { subset: true });
  pdf.setTitle(clean(project.title));
  pdf.setAuthor(clean(project.studioName || project.designerName || "Moodboard Studio"));
  const base = PAPER[project.paperSize || "A3"] || PAPER.A3;
  const landscape = project.orientation !== "vertical";
  const width = (landscape ? base[1] : base[0]) * MM;
  const height = (landscape ? base[0] : base[1]) * MM;
  const margin = 32;
  const bodyWidth = width - margin * 2;
  const background = color(project.canvasBackground);
  const darkBackground = background.red * 0.299 + background.green * 0.587 + background.blue * 0.114 < 0.45;
  const bodyColor = darkBackground ? rgb(0.95, 0.95, 0.95) : rgb(0.08, 0.08, 0.08);
  const heading = (page: PDFPage, subtitle?: string) => {
    page.drawRectangle({ x: 0, y: 0, width, height, color: color(project.canvasBackground) });
    page.drawRectangle({ x: 0, y: height - 58, width, height: 58, color: rgb(0.12, 0.14, 0.16) });
    const line = wrap(clean(project.title), font, 17, bodyWidth)[0] || "Moodboard";
    page.drawText(line, { x: margin, y: height - 31, font, size: 17, color: rgb(1, 1, 1) });
    if (subtitle) page.drawText(subtitle, { x: margin, y: height - 48, font, size: 9, color: rgb(0.85, 0.85, 0.85) });
  };
  const appendTextPages = (title: string, text: string) => {
    const lines = wrap(text, font, 11, bodyWidth);
    const perPage = Math.max(1, Math.floor((height - 128) / 16));
    for (let i = 0; i < lines.length; i += perPage) {
      const page = pdf.addPage([width, height]); heading(page, title);
      lines.slice(i, i + perPage).forEach((line, j) => page.drawText(line, { x: margin, y: height - 90 - j * 16, font, size: 11, color: bodyColor }));
    }
  };
  if (project.showCover !== false) {
    const coverText = [project.title, project.projectName, project.studioName, project.designerName,
      project.descriptionEnabled === false ? "" : project.descriptionAi || project.descriptionRaw].filter(Boolean).join("\n\n");
    appendTextPages("Project overview", coverText);
  }
  const layout = getGridLayout(landscape, project.imageLayout || "original", project.gridColumns || 3, project.paperSize || "A3");
  // The server uses a bounded row count so captions remain legible on every paper size.
  const rows = Math.min(3, layout.rows);
  const pages = paginateMoodboard(pins, { ...layout, rows, perPage: rows * layout.cols, useGrid: false }, () => false);
  const includedPinIds: number[] = [];
  const continuations: Array<{ title: string; text: string }> = [];
  let totalImageBytes = 0;
  for (const pagePins of pages) {
    options.signal?.throwIfAborted();
    const page = pdf.addPage([width, height]);
    heading(page, `${project.studioName || "Moodboard Studio"} · ${pins.length} references`);
    const gap = 14;
    const cellWidth = (bodyWidth - gap * (layout.cols - 1)) / layout.cols;
    const cellHeight = (height - 112 - gap * (rows - 1)) / rows;
    for (let index = 0; index < pagePins.length; index++) {
      options.signal?.throwIfAborted();
      const pin = pagePins[index];
      const source = await options.readImage(pin);
      const bytes = await sharp(source, { limitInputPixels: 80_000_000, failOn: "error" }).rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" }).jpeg({ quality: 78 }).toBuffer();
      totalImageBytes += bytes.length;
      if (totalImageBytes > MAX_EMBEDDED_IMAGE_BYTES) throw new Error("This PDF exceeds the 32 MB embedded-image budget. Select fewer references; no partial PDF was published.");
      const image = await pdf.embedJpg(bytes);
      const x = margin + index % layout.cols * (cellWidth + gap);
      const top = height - 76 - Math.floor(index / layout.cols) * (cellHeight + gap);
      page.drawRectangle({ x, y: top - cellHeight, width: cellWidth, height: cellHeight, color: rgb(1, 1, 1) });
      const maxHeight = cellHeight * 0.65;
      const scale = Math.min((cellWidth - 12) / image.width, maxHeight / image.height);
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      page.drawImage(image, { x: x + (cellWidth - imageWidth) / 2, y: top - 6 - imageHeight, width: imageWidth, height: imageHeight });
      const caption = [pin.title, pin.descriptionEnabled === false ? "" : pin.descriptionFinal || pin.descriptionAi || pin.descriptionCustomInput].filter(Boolean).join("\n");
      const lines = wrap(caption, font, 9, cellWidth - 12);
      const baseCapacity = Math.max(1, Math.floor((cellHeight - maxHeight - 20) / 12));
      const hasContinuation = lines.length > baseCapacity;
      const capacity = hasContinuation ? Math.max(1, baseCapacity - 1) : baseCapacity;
      lines.slice(0, capacity).forEach((line, j) => page.drawText(line, { x: x + 6, y: top - maxHeight - 20 - j * 12, font, size: 9, color: rgb(0.08, 0.08, 0.08) }));
      if (hasContinuation) {
        page.drawText("Full caption follows.", { x: x + 6, y: top - cellHeight + 7, font, size: 8, color: rgb(0.3, 0.3, 0.3) });
        continuations.push({ title: `Reference ${includedPinIds.length + 1} · full caption`, text: caption });
      }
      includedPinIds.push(pin.id);
      await options.onProgress?.(includedPinIds.length, pins.length);
    }
  }
  for (const continuation of continuations) appendTextPages(continuation.title, continuation.text);
  const allPages = pdf.getPages();
  if (project.showFooter !== false) for (let i = 0; i < allPages.length; i++) {
    allPages[i].drawText(`${i + 1} / ${allPages.length}`, { x: margin, y: 18, font, size: 8, color: darkBackground ? rgb(0.8, 0.8, 0.8) : rgb(0.3, 0.3, 0.3) });
  }
  const bytes = Buffer.from(await pdf.save());
  if (bytes.length > MAX_PDF_BYTES) throw new Error("This PDF exceeds the 40 MB export limit. No partial PDF was published.");
  return { bytes, pageCount: allPages.length, includedPinIds };
}
