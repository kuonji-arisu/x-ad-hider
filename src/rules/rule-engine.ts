import { MAX_TEXT_SAMPLE } from "../shared/constants.js";
import type { Decision, HideDecision, MatchedField, Settings, TweetCandidate } from "../shared/types.js";
import { normalizeHandle, textSample } from "../shared/utils.js";

export function decideCandidate(settings: Settings, candidate: TweetCandidate): Decision {
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
  const matchedTextKeyword = settings.keywords.find((keyword) => text.includes(keyword));
  if (matchedTextKeyword) {
    return buildHideDecision(candidate, handle, matchedTextKeyword, "text");
  }

  const usernameText = `${candidate?.handle || ""} @${candidate?.handle || ""} ${candidate?.usernameText || ""}`.toLowerCase();
  const matchedUsernameKeyword = settings.usernameKeywords.find((keyword) => usernameText.includes(keyword));
  if (matchedUsernameKeyword) {
    return buildHideDecision(candidate, handle, matchedUsernameKeyword, "username");
  }

  return { action: "skip", reason: "no-keyword-match" };
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
