import { describe, expect, it } from "vitest";
import { toMatchSignature } from "./match-signature.js";

describe("toMatchSignature", () => {
  it("preserves non-null falsy values", () => {
    expect(toMatchSignature(0)).toBe("0");
    expect(toMatchSignature(false)).toBe("false");
  });

  it("normalizes full-width latin text and symbols", () => {
    expect(toMatchSignature("ＡＢ１２＠")).toBe("ab12@");
  });

  it("drops private-use characters before matching", () => {
    expect(toMatchSignature("a\uE000b")).toBe("ab");
  });
});
