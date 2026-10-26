import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getPinDesc, isDescLong } from "./pin-description";

const empty = { descriptionFinal: null, descriptionAi: null, descriptionCustomInput: null };

test("preview and export resolve final, AI, then manual descriptions", () => {
  assert.equal(getPinDesc({ ...empty, descriptionFinal: "Final", descriptionAi: "AI", descriptionCustomInput: "Manual" }), "Final");
  assert.equal(getPinDesc({ ...empty, descriptionAi: "AI", descriptionCustomInput: "Manual" }), "AI");
  assert.equal(getPinDesc({ ...empty, descriptionCustomInput: "Manual" }), "Manual");
  assert.equal(getPinDesc(empty), "");
});

test("below keeps long captions under images for every description source", () => {
  for (const source of ["descriptionFinal", "descriptionAi", "descriptionCustomInput"]) {
    const pin = { ...empty, [source]: "Long description ".repeat(30) };
    assert.notEqual(getPinDesc(pin), "");
    assert.equal(isDescLong(pin, "below"), false);
    assert.equal(isDescLong(pin, "auto"), true);
    assert.equal(isDescLong(pin, "beside"), true);
  }
});

test("beside uses a neighboring cell only when text exists", () => {
  assert.equal(isDescLong({ ...empty, descriptionAi: "Short" }, "beside"), true);
  assert.equal(isDescLong({ ...empty, descriptionAi: "Short" }, "auto"), false);
  for (const mode of ["auto", "below", "beside"] as const) {
    assert.equal(isDescLong(empty, mode), false);
  }
});