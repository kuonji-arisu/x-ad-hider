import { describe, expect, it } from "vitest";
import {
  displayHandle,
  normalizeHandle,
  normalizeKeyword,
  textSample,
  uniqueCleanList
} from "./utils.js";

describe("shared utils", () => {
  it("normalizes and displays handles", () => {
    expect(normalizeHandle("  @@Alice_01  ")).toBe("alice_01");
    expect(displayHandle("Alice")).toBe("@alice");
    expect(displayHandle("")).toBe("");
  });

  it("normalizes keywords and removes duplicate empty values", () => {
    expect(normalizeKeyword("  Promo  ")).toBe("promo");
    expect(uniqueCleanList([" Promo ", "promo", "", " AIRDROP "], normalizeKeyword)).toEqual([
      "promo",
      "airdrop"
    ]);
  });

  it("compacts and truncates text samples to the requested length", () => {
    expect(textSample("  hello\n\nworld  ", 20)).toBe("hello world");
    expect(textSample("abcdefghij", 8)).toBe("abcde...");
    expect(textSample("abcdefghij", 3)).toBe("...");
    expect(textSample("abcdefghij", 0)).toBe("");
  });
});
