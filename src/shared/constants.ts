export const MESSAGE_TYPES = Object.freeze({
  GET_SETTINGS: "settings:get",
  SAVE_SETTINGS: "settings:save",
  ADD_LOG: "logs:add",
  GET_LOGS: "logs:get",
  CLEAR_LOGS: "logs:clear",
  GET_CONTENT_STATS: "content:stats"
});

export const LOG_LEVELS = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error"
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  pinyinFuzzyMatching: false,
  keywords: [],
  usernameKeywords: [],
  whitelistHandles: []
});

export const STORAGE_KEYS = Object.freeze({
  SETTINGS: "settings",
  LOGS: "logs"
});

export const MAX_LOGS = 200;
export const MAX_TEXT_SAMPLE = 240;
