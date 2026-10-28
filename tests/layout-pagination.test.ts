import assert from "node:assert/strict";
import { test } from "node:test";
import { getGridLayout, paginateMoodboard } from "../shared/layout-pagination";

test("more than 30 pages retain every selected reference exactly once", () => {
  const refs = Array.from({ length: 200 }, (_, id) => ({ id }));
  const pages = paginateMoodboard(refs, { cols: 2, rows: 2, perPage: 4, useGrid: true }, () => false);
  assert.equal(pages.length, 50);
  assert.deepEqual(pages.flat(), refs);
});

test("long captions reserve adjacent slots without dropping or reordering references", () => {
  const refs = Array.from({ length: 301 }, (_, id) => ({ id, long: id % 3 === 1 }));
  const pages = paginateMoodboard(refs, { cols: 3, rows: 2, perPage: 6, useGrid: true }, ref => ref.long);
  assert.deepEqual(pages.flat(), refs);
  for (const page of pages) {
    let slots = 0;
    for (const ref of page) {
      if (ref.long && slots % 3 === 2) slots++;
      slots += ref.long ? 2 : 1;
    }
    assert.ok(slots <= 6);
  }
});

test("original and unknown layouts retain all items and use bounded finite geometry", () => {
  const refs = Array.from({ length: 1001 }, (_, id) => id);
  for (const mode of ["original", "unrecognized"]) {
    const layout = getGridLayout(true, mode, Number.NaN, "A3");
    assert.equal(layout.useGrid, false);
    assert.ok(Number.isFinite(layout.perPage));
    assert.deepEqual(paginateMoodboard(refs, layout, () => false).flat(), refs);
  }
});
