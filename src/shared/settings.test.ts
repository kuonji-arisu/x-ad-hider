import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./settings.js";

describe("normalizeSettings", () => {
  it("uses enabled defaults and cleans rule lists", () => {
    expect(normalizeSettings({
      keywords: [" Promo ", "promo", ""],
      usernameKeywords: [" Bot ", "bot"],
      whitelistHandles: [" @Alice ", "alice", "@Bob"]
    })).toEqual({
      enabled: true,
      pinyinFuzzyMatching: false,
      keywords: ["promo"],
      usernameKeywords: ["bot"],
      whitelistHandles: ["alice", "bob"]
    });
  });

  it("preserves an explicit disabled state", () => {
    expect(normalizeSettings({ enabled: false }).enabled).toBe(false);
  });

  it("only enables pinyin fuzzy matching explicitly", () => {
    expect(normalizeSettings({}).pinyinFuzzyMatching).toBe(false);
    expect(normalizeSettings({ pinyinFuzzyMatching: true }).pinyinFuzzyMatching).toBe(true);
  });
});
