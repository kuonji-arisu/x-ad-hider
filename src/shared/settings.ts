import type { Settings } from "./types.js";
import { normalizeHandle, normalizeKeyword, uniqueCleanList } from "./utils.js";

export function normalizeSettings(settings: Partial<Settings> = {}): Settings {
  return {
    enabled: settings.enabled !== false,
    pinyinFuzzyMatching: settings.pinyinFuzzyMatching === true,
    keywords: uniqueCleanList(settings.keywords || [], normalizeKeyword),
    usernameKeywords: uniqueCleanList(settings.usernameKeywords || [], normalizeKeyword),
    whitelistHandles: uniqueCleanList(settings.whitelistHandles || [], normalizeHandle)
  };
}
