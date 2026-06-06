import { MAX_TEXT_SAMPLE } from "../shared/constants.js";
import type { Decision, HideDecision, MatchedField, Settings, TweetCandidate } from "../shared/types.js";
import { normalizeHandle, textSample } from "../shared/utils.js";

type CompiledRule = {
  keyword: string;
  signature: string;
};

export type MatchSignature = (input: unknown) => string;

export type CompiledRuleSettings = Settings & {
  keywordRules: CompiledRule[];
  usernameKeywordRules: CompiledRule[];
  toMatchSignature?: MatchSignature;
};

export function compileRuleSettings(settings: Settings, toMatchSignature?: MatchSignature): CompiledRuleSettings {
  const pinyinFuzzyMatching = settings.pinyinFuzzyMatching && Boolean(toMatchSignature);
  const matchSignature = pinyinFuzzyMatching ? toMatchSignature : undefined;

  return {
    ...settings,
    pinyinFuzzyMatching,
    keywordRules: matchSignature ? compileRules(settings.keywords, matchSignature) : [],
    usernameKeywordRules: matchSignature ? compileRules(settings.usernameKeywords, matchSignature) : [],
    toMatchSignature: matchSignature
  };
}

export function decideCandidate(
  settings: Settings,
  candidate: TweetCandidate,
  toMatchSignature?: MatchSignature
): Decision {
  return decideCompiledCandidate(compileRuleSettings(settings, toMatchSignature), candidate);
}

export function decideCompiledCandidate(settings: CompiledRuleSettings, candidate: TweetCandidate): Decision {
  if (!settings.enabled) {
    return { action: "skip", reason: "disabled" };
  }

  const handle = normalizeHandle(candidate?.handle);
  if (!handle) {
    return { action: "skip", reason: "missing-handle" };
  }

  if (settings.whitelistHandles.includes(handle)) {
    return { action: "skip", reason: "whitelisted" };
  }

  const text = String(candidate?.text || "").toLowerCase();
  const matchedTextKeyword = findTextKeyword(settings, candidate, text);
  if (matchedTextKeyword) {
    return buildHideDecision(candidate, handle, matchedTextKeyword, "text");
  }

  const usernameText = `${candidate?.handle || ""} @${candidate?.handle || ""} ${candidate?.usernameText || ""}`.toLowerCase();
  const matchedUsernameKeyword = findUsernameKeyword(settings, usernameText);
  if (matchedUsernameKeyword) {
    return buildHideDecision(candidate, handle, matchedUsernameKeyword, "username");
  }

  return { action: "skip", reason: "no-keyword-match" };
}

function findTextKeyword(settings: CompiledRuleSettings, candidate: TweetCandidate, text: string): string | undefined {
  if (!settings.pinyinFuzzyMatching) {
    return settings.keywords.find((keyword) => text.includes(keyword));
  }

  return settings.keywordRules.length
    ? findSignatureMatch(settings.toMatchSignature?.(candidate?.text) || "", settings.keywordRules)
    : undefined;
}

function findUsernameKeyword(settings: CompiledRuleSettings, usernameText: string): string | undefined {
  if (!settings.pinyinFuzzyMatching) {
    return settings.usernameKeywords.find((keyword) => usernameText.includes(keyword));
  }

  return settings.usernameKeywordRules.length
    ? findSignatureMatch(settings.toMatchSignature?.(usernameText) || "", settings.usernameKeywordRules)
    : undefined;
}

function compileRules(keywords: string[], toMatchSignature: MatchSignature): CompiledRule[] {
  return keywords
    .map((keyword) => ({
      keyword,
      signature: toMatchSignature(keyword)
    }))
    .filter((rule) => rule.signature);
}

function findSignatureMatch(signature: string, rules: CompiledRule[]): string | undefined {
  return rules.find((rule) => signature.includes(rule.signature))?.keyword;
}

function buildHideDecision(
  candidate: TweetCandidate,
  handle: string,
  matchedKeyword: string,
  matchedField: MatchedField
): HideDecision {
  return {
    action: "hide",
    handle,
    matchedKeyword,
    matchedField,
    textSample: textSample(candidate.text, MAX_TEXT_SAMPLE),
    tweetUrl: candidate.tweetUrl || ""
  };
}
