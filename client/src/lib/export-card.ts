/**
 * Card surfaces are deliberately independent from the page surface. A moodboard
 * can use any canvas background, but exported image cards and their captions must
 * remain white and readable on top of it.
 */
export const EXPORT_CARD_SURFACE = "#ffffff";
export const EXPORT_CARD_TEXT = "#52525b";

export function prepareExportCard(card: HTMLElement): void {
  card.dataset.exportShadowCard = "true";
  card.style.backgroundColor = EXPORT_CARD_SURFACE;
  // html2canvas can paint CSS shadows as a second, offset card. Shadows are
  // supplied by appendRasterizedShadowLayer instead.
  card.style.boxShadow = "none";
  card.style.zIndex = "1";
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/**
 * Paint only the shadows around export cards into a transparent image layer.
 *
 * Drawing a filled card with a shadow and leaving the fill in the layer creates
 * an opaque duplicate whenever html2canvas antialiases the card edge. Erasing
 * the exact card paths after the shadow pass leaves no duplicate white strips,
 * while the actual white card remains the only surface that is captured.
 */
export function appendRasterizedShadowLayer(
  root: HTMLElement,
  shadowScale: number,
): HTMLImageElement | null {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-export-shadow-card]"));
  if (cards.length === 0 || root.clientWidth <= 0 || root.clientHeight <= 0) return null;

  const rootRect = root.getBoundingClientRect();
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = Math.ceil(root.clientWidth);
  shadowCanvas.height = Math.ceil(root.clientHeight);
  const context = shadowCanvas.getContext("2d");
  if (!context) return null;

  const shapes = cards.map((card) => {
    const rect = card.getBoundingClientRect();
    const computed = getComputedStyle(card);
    return {
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      width: rect.width,
      height: rect.height,
      radius: Number.parseFloat(computed.borderTopLeftRadius) || 0,
    };
  });

  for (const shape of shapes) {
    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.15)";
    context.shadowBlur = 12 * shadowScale;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 4 * shadowScale;
    context.fillStyle = "#000000";
    roundedRectPath(context, shape.x, shape.y, shape.width, shape.height, shape.radius);
    context.fill();
    context.restore();

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.1)";
    context.shadowBlur = 4 * shadowScale;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 2 * shadowScale;
    context.fillStyle = "#000000";
    roundedRectPath(context, shape.x, shape.y, shape.width, shape.height, shape.radius);
    context.fill();
    context.restore();
  }

  // Keep the layer transparent underneath each card. This prevents the layer
  // from becoming a second opaque card when its antialiased edge is captured.
  context.save();
  context.globalCompositeOperation = "destination-out";
  for (const shape of shapes) {
    roundedRectPath(context, shape.x, shape.y, shape.width, shape.height, shape.radius);
    context.fill();
  }
  context.restore();

  const shadowLayer = document.createElement("img");
  shadowLayer.src = shadowCanvas.toDataURL("image/png");
  shadowLayer.alt = "";
  shadowLayer.setAttribute("aria-hidden", "true");
  shadowLayer.dataset.exportRasterizedShadows = "true";
  shadowLayer.style.position = "absolute";
  shadowLayer.style.inset = "0";
  shadowLayer.style.width = "100%";
  shadowLayer.style.height = "100%";
  shadowLayer.style.pointerEvents = "none";
  shadowLayer.style.zIndex = "0";
  root.insertBefore(shadowLayer, root.firstChild);
  return shadowLayer;
}

export function waitForRasterizedShadowLayer(layer: HTMLImageElement): Promise<void> {
  if (layer.complete) return Promise.resolve();
  return new Promise((resolve) => {
    layer.addEventListener("load", () => resolve(), { once: true });
    layer.addEventListener("error", () => resolve(), { once: true });
  });
}