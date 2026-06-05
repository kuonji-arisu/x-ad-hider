import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../shared/settings.js";
import type { Settings, TweetCandidate } from "../shared/types.js";
import { decideCandidate } from "./rule-engine.js";

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
