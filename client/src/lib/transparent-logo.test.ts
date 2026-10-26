import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clearWhiteBorder } from "./transparent-logo";

test("clears the exterior white square, preserving colored shape and enclosed white lettering", () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) {
      if (x === 2 && y === 2) continue;
      pixels.set([240, 20, 30, 255], (y * 5 + x) * 4);
    }
  }
  clearWhiteBorder(pixels, 5, 5);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(2 * 5 + 2) * 4 + 3], 255);
  assert.deepEqual([...pixels.slice(24, 28)], [240, 20, 30, 255]);
});

test("does not alter artwork that already has transparency", () => {
  const pixels = new Uint8ClampedArray([255, 255, 255, 255, 200, 0, 0, 0]);
  const before = pixels.slice();
  clearWhiteBorder(pixels, 2, 1);
  assert.deepEqual(pixels, before);
});

test("does not erase all-white logos or non-white backgrounds", () => {
  for (const color of [[255, 255, 255, 255], [10, 20, 30, 255]]) {
    const pixels = new Uint8ClampedArray(color);
    clearWhiteBorder(pixels, 1, 1);
    assert.deepEqual([...pixels], color);
  }
});