import { describe, expect, it, vi } from "vitest";
import { normalizeSettings } from "../shared/settings.js";
import type { Settings, TweetCandidate } from "../shared/types.js";
import { toMatchSignature } from "./match-signature.js";
import { compileRuleSettings, decideCandidate, decideCompiledCandidate } from "./rule-engine.js";

function settings(partial: Partial<Settings>): Settings {
  return normalizeSettings(partial);
}

function candidate(partial: Partial<TweetCandidate> = {}): TweetCandidate {
  return {
    handle: "alice",
    usernameText: "Alice Example",
    text: "ordinary post text",
    tweetUrl: "https://x.com/alice/status/123",
    pageUrl: "https://x.com/home",
    ...partial
  };
}

function decideWithPinyin(partial: Partial<Settings>, partialCandidate: Partial<TweetCandidate> = {}) {
  return decideCandidate(settings(partial), candidate(partialCandidate), toMatchSignature);
}

describe("decideCandidate", () => {
  it("skips when disabled or missing a handle", () => {
    expect(decideCandidate(settings({ enabled: false, keywords: ["post"] }), candidate())).toEqual({
      action: "skip",
      reason: "disabled"
    });
    expect(decideCandidate(settings({ keywords: ["post"] }), candidate({ handle: "" }))).toEqual({
      action: "skip",
      reason: "missing-handle"
    });
  });

  it("lets whitelist handles win over matching keywords", () => {
    expect(decideCandidate(settings({
      keywords: ["scam"],
      usernameKeywords: ["alice"],
      whitelistHandles: ["@Alice"]
    }), candidate({ text: "scam promo" }))).toEqual({
      action: "skip",
      reason: "whitelisted"
    });
  });

  it("hides when body text contains a normalized keyword", () => {
    expect(decideCandidate(settings({ keywords: ["Promo"] }), candidate({
      text: "This is a PROMO thread"
    }))).toMatchObject({
      action: "hide",
      handle: "alice",
      matchedKeyword: "promo",
      matchedField: "text",
      tweetUrl: "https://x.com/alice/status/123"
    });
  });

  it("keeps pinyin fuzzy matching disabled by default", () => {
    expect(decideCandidate(settings({ keywords: ["广告"] }), candidate({
      text: "这里有广吿"
    }))).toEqual({
      action: "skip",
      reason: "no-keyword-match"
    });
  });

  it("hides when body text contains a same-pinyin Chinese phrase", () => {
    expect(decideWithPinyin({
      pinyinFuzzyMatching: true,
      keywords: ["广告"]
    }, {
      text: "这里有广吿"
    })).toMatchObject({
      action: "hide",
      matchedKeyword: "广告",
      matchedField: "text"
    });
  });

  it("keeps pinyin and raw latin text in separate match domains", () => {
    expect(decideWithPinyin({
      pinyinFuzzyMatching: true,
      keywords: ["ai"]
    }, {
      text: "我爱这个"
    })).toEqual({
      action: "skip",
      reason: "no-keyword-match"
    });

    expect(decideWithPinyin({
      pinyinFuzzyMatching: true,
      keywords: ["爱"]
    }, {
      text: "矮"
    })).toMatchObject({
      action: "hide",
      matchedKeyword: "爱",
      matchedField: "text"
    });
  });

  it("matches mixed Chinese and latin keywords without matching typed pinyin", () => {
    expect(decideWithPinyin({
      pinyinFuzzyMatching: true,
      keywords: ["我喜欢apple"]
    }, {
      text: "窝喜换Apple"
    })).toMatchObject({
      action: "hide",
      matchedKeyword: "我喜欢apple",
      matchedField: "text"
    });

    expect(decideWithPinyin({
      pinyinFuzzyMatching: true,
      keywords: ["我喜欢apple"]
    }, {
      text: "wo xi huan apple"
    })).toEqual({
      action: "skip",
      reason: "no-keyword-match"
    });
  });

  it("does not combine pinyin tokens across different rules", () => {
    expect(decideWithPinyin({
      pinyinFuzzyMatching: true,
      keywords: ["固泡", "爱情"]
    }, {
      text: "泡爱"
    })).toEqual({
      action: "skip",
      reason: "no-keyword-match"
    });
  });

  it("does not compute empty pinyin rule groups", () => {
    const matchSignature = vi.fn((input: unknown) => String(input ?? "").toLowerCase().replaceAll("x", "y"));
    const compiledSettings = compileRuleSettings(settings({
      pinyinFuzzyMatching: true,
      usernameKeywords: ["yy"]
    }), matchSignature);
    matchSignature.mockClear();

    expect(decideCompiledCandidate(compiledSettings, candidate({
      text: "xx",
      usernameText: "xx"
    }))).toMatchObject({
      action: "hide",
      matchedKeyword: "yy",
      matchedField: "username"
    });
    expect(matchSignature).not.toHaveBeenCalledWith("xx");
    expect(matchSignature).toHaveBeenCalledWith("alice @alice xx");
  });

  it("hides when username text or handle contains a normalized keyword", () => {
    expect(decideCandidate(settings({ usernameKeywords: ["example"] }), candidate())).toMatchObject({
      action: "hide",
      matchedKeyword: "example",
      matchedField: "username"
    });

    expect(decideCandidate(settings({ usernameKeywords: ["ali"] }), candidate({
      usernameText: ""
    }))).toMatchObject({
      action: "hide",
      matchedKeyword: "ali",
      matchedField: "username"
    });
  });

  it("prefers body keywords over username keywords", () => {
    expect(decideCandidate(settings({
      keywords: ["airdrop"],
      usernameKeywords: ["alice"]
    }), candidate({
      text: "airdrop"
    }))).toMatchObject({
      action: "hide",
      matchedField: "text",
      matchedKeyword: "airdrop"
    });
  });

  it("skips when no rule matches", () => {
    expect(decideCandidate(settings({ keywords: ["promo"] }), candidate())).toEqual({
      action: "skip",
      reason: "no-keyword-match"
    });
  });

  it("builds bounded text samples and tolerates missing tweet URLs", () => {
    const decision = decideCandidate(settings({ keywords: ["promo"] }), candidate({
      text: `${"x".repeat(260)} promo`,
      tweetUrl: undefined
    }));

    expect(decision).toMatchObject({
      action: "hide",
      tweetUrl: ""
    });
    expect(decision.action === "hide" ? decision.textSample.length : 0).toBeLessThanOrEqual(240);
  });
});
