/** Shared pagination: a selected reference must appear exactly once. */
export type GridLayout = { cols: number; rows: number; perPage: number; useGrid: boolean };
const PAPER: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 }, A2: { w: 420, h: 594 },
};
const ASPECT: Record<string, number | null> = {
  square: 1, portrait_3_5: 3 / 5, portrait_9_16: 9 / 16,
  landscape_5_3: 5 / 3, landscape_16_9: 16 / 9, original: null,
};

export function getGridLayout(isLandscape: boolean, imageLayout: string, gridColumns = 3, paperSize = "A3"): GridLayout {
  const cols = Math.max(2, Math.min(5, Math.trunc(Number.isFinite(gridColumns) ? gridColumns : 3)));
  const aspect = ASPECT[imageLayout] ?? null;
  const base = PAPER[paperSize] || PAPER.A3;
  const width = isLandscape ? base.h : base.w;
  const height = isLandscape ? base.w : base.h;
  const gap = width * 0.015;
  const cellWidth = aspect === null ? width * 0.76 / cols : (width * 0.76 - gap * (cols - 1)) / cols;
  const cellHeight = aspect === null ? cellWidth : cellWidth / aspect;
  const rows = Math.max(2, Math.floor((height * 0.82 + gap) / (cellHeight + gap)));
  return { cols, rows, perPage: cols * rows, useGrid: aspect !== null };
}

export function paginateMoodboard<T>(items: readonly T[], layout: GridLayout, beside: (item: T) => boolean): T[][] {
  const perPage = Math.max(1, Math.trunc(layout.perPage));
  if (!layout.useGrid) {
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
  }
  const pages: T[][] = [];
  let page: T[] = [];
  let slots = 0;
  let column = 0;
  for (const item of items) {
    const width = beside(item) && layout.cols > 1 ? 2 : 1;
    let pad = width === 2 && column === layout.cols - 1 ? 1 : 0;
    if (slots + pad + width > perPage && page.length) {
      pages.push(page); page = []; slots = 0; column = 0; pad = 0;
    }
    slots += pad + width;
    column = (column + pad + width) % Math.max(1, layout.cols);
    page.push(item);
  }
  if (page.length) pages.push(page);
  return pages;
}
