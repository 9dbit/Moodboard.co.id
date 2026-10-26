import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const chromium = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";

test("Chromium renders white rounded export cards with one smooth shadow", async (t) => {
  if (!existsSync(chromium)) {
    t.skip(`Chromium not found at ${chromium}`);
    return;
  }

  const workDir = mkdtempSync(join(tmpdir(), "moodboard-export-card-"));
  const entryPath = join(workDir, "entry.js");
  const htmlPath = join(workDir, "harness.html");
  const screenshotPath = join(tmpdir(), "moodboard-export-card-regression.png");

  try {
    const entrySource = `
      import {
        appendRasterizedShadowLayer,
        prepareExportCard,
        waitForRasterizedShadowLayer,
      } from ${JSON.stringify(resolve("client/src/lib/export-card.ts"))};

      declare const html2canvas: (
        element: HTMLElement,
        options?: Record<string, unknown>,
      ) => Promise<HTMLCanvasElement>;

      const svgData = (color: string) =>
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700">' +
          '<rect width="1200" height="700" fill="' + color + '"/>' +
          '<circle cx="920" cy="180" r="180" fill="#f5d08a" opacity=".72"/>' +
          '<path d="M0 560 L380 180 680 520 1040 140 1200 360V700H0Z" fill="#2e4a53" opacity=".82"/>' +
          "</svg>",
        );

      async function render() {
        const root = document.createElement("div");
        Object.assign(root.style, {
          width: "760px",
          height: "620px",
          position: "relative",
          overflow: "hidden",
          background: "#d0b6a4",
          padding: "40px",
          boxSizing: "border-box",
          fontFamily: "Arial, sans-serif",
        });

        const card = document.createElement("div");
        Object.assign(card.style, {
          width: "680px",
          height: "520px",
          position: "relative",
          overflow: "hidden",
          borderRadius: "18px",
          display: "flex",
          flexDirection: "column",
        });
        prepareExportCard(card);

        const image = document.createElement("img");
        Object.assign(image.style, {
          width: "100%",
          height: "410px",
          objectFit: "cover",
          display: "block",
        });
        image.src = svgData("#7b4132");
        card.appendChild(image);

        const caption = document.createElement("div");
        Object.assign(caption.style, {
          flex: "1",
          padding: "26px 24px",
          boxSizing: "border-box",
          background: "transparent",
          display: "flex",
          alignItems: "flex-start",
        });
        const text = document.createElement("p");
        text.textContent =
          "Natural light floods through large windows, illuminating polished concrete floors and wooden beam accents.";
        Object.assign(text.style, {
          margin: "0",
          color: "#52525b",
          fontSize: "20px",
          lineHeight: "1.3",
        });
        caption.appendChild(text);
        card.appendChild(caption);
        root.appendChild(card);
        document.body.appendChild(root);

        await document.fonts.ready;
        await new Promise<void>((done) => {
          if (image.complete) done();
          else {
            image.onload = () => done();
            image.onerror = () => done();
          }
        });

        const shadowLayer = appendRasterizedShadowLayer(root, 1);
        if (shadowLayer) await waitForRasterizedShadowLayer(shadowLayer);

        const rendered = await html2canvas(root, {
          scale: 1,
          backgroundColor: "#d0b6a4",
          width: 760,
          height: 620,
          logging: false,
        });
        const context = rendered.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");
        const pixels = context.getImageData(0, 0, rendered.width, rendered.height).data;
        const pixel = (x: number, y: number) => {
          const offset = (y * rendered.width + x) * 4;
          return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]];
        };
        const nearWhite = (sample: number[]) =>
          sample[0] > 245 && sample[1] > 245 && sample[2] > 245;
        const background = pixel(10, 10);
        const bottomEdgeRows = Array.from({ length: 15 }, (_, index) => pixel(380, 560 + index));
        const darkCaptionPixels = (() => {
          let count = 0;
          for (let y = 470; y < 545; y++) {
            for (let x = 60; x < 700; x++) {
              const sample = pixel(x, y);
              if (sample[0] < 180 && sample[1] < 180 && sample[2] < 180) count++;
            }
          }
          return count;
        })();
        const metrics = {
          size: [rendered.width, rendered.height],
          captionPixel: pixel(100, 500),
          captionIsWhite: nearWhite(pixel(100, 500)),
          captionTextDarkPixels: darkCaptionPixels,
          roundedCornerOutside: pixel(40, 40),
          roundedCornerInside: pixel(58, 558),
          shadowBelowCard: pixel(380, 562),
          background,
          bottomEdgeRows,
          rasterShadowLayerPresent: Boolean(root.querySelector("[data-export-rasterized-shadows]")),
        };

        document.body.innerHTML = "";
        const result = document.createElement("canvas");
        result.width = rendered.width;
        result.height = rendered.height;
        result.style.display = "block";
        result.getContext("2d")!.drawImage(rendered, 0, 0);
        document.body.appendChild(result);
        const output = document.createElement("pre");
        output.id = "metrics";
        output.textContent = JSON.stringify(metrics);
        output.style.display = "none";
        document.body.appendChild(output);
      }

      render().catch((error) => {
        document.body.textContent = String(error?.stack || error);
      });
    `;

    await build({
      stdin: {
        contents: entrySource,
        resolveDir: process.cwd(),
        sourcefile: "export-card-browser-entry.ts",
        loader: "ts",
      },
      bundle: true,
      format: "iife",
      outfile: entryPath,
    });

    const html2canvasPath = resolve("node_modules/html2canvas/dist/html2canvas.min.js");
    writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#d0b6a4}</style></head><body><script src="file://${html2canvasPath}"></script><script src="file://${entryPath}"></script></body></html>`,
    );
    const dom = execFileSync(
      chromium,
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--allow-file-access-from-files",
        "--hide-scrollbars",
        "--window-size=760,620",
        "--virtual-time-budget=8000",
        `--screenshot=${screenshotPath}`,
        "--dump-dom",
        `file://${htmlPath}`,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
    const metricsText = dom.match(/<pre id="metrics"[^>]*>(.*?)<\/pre>/s)?.[1];
    assert.ok(metricsText, "browser harness did not emit pixel metrics");
    const metrics = JSON.parse(metricsText);

    assert.deepEqual(metrics.size, [760, 620]);
    assert.equal(metrics.captionIsWhite, true, `caption pixel was ${metrics.captionPixel}`);
    assert.ok(metrics.captionTextDarkPixels > 100, "caption text did not render as readable dark pixels");
    assert.ok(!metrics.roundedCornerOutside.every((value: number, index: number) => value === metrics.roundedCornerInside[index]));
    assert.ok(metrics.roundedCornerInside[0] > 245, "bottom card surface was not white");
    assert.ok(metrics.rasterShadowLayerPresent, "raster shadow layer was not inserted");
    assert.ok(
      metrics.shadowBelowCard[0] < metrics.background[0] - 4,
      `shadow was not visible below card: ${metrics.shadowBelowCard} vs ${metrics.background}`,
    );
    assert.ok(
      metrics.bottomEdgeRows.every((row: number[]) => !row.slice(0, 3).every((value) => value > 245)),
      `found an opaque duplicate edge: ${JSON.stringify(metrics.bottomEdgeRows)}`,
    );
    console.log(`Chromium export-card screenshot: ${screenshotPath}`);
    console.log(`Chromium export-card pixels: ${JSON.stringify(metrics)}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});