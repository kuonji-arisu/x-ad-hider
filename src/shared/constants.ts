export const MESSAGE_TYPES = Object.freeze({
  CANDIDATE_DETECTED: "candidate:detected",
  GET_SETTINGS: "settings:get",
  SAVE_SETTINGS: "settings:save",
  GET_LOGS: "logs:get",
  CLEAR_LOGS: "logs:clear"
});

export const LOG_LEVELS = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error"
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
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
