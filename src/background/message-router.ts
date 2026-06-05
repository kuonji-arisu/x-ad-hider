import { MESSAGE_TYPES, LOG_LEVELS } from "../shared/constants.js";
import { decideCandidate } from "../rules/rule-engine.js";
import type { RuntimeMessage, TweetCandidate } from "../shared/types.js";
import {
  addLog,
  clearLogs,
  getLogs,
  getSettings,
  saveSettings
} from "../storage/storage.js";
import { displayHandle, serializeError } from "../shared/utils.js";

export function installMessageRouter() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message as RuntimeMessage)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: serializeError(error) }));

    return true;
  });
}

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message?.type) {
    case MESSAGE_TYPES.CANDIDATE_DETECTED:
      return handleCandidate(message.payload);
    case MESSAGE_TYPES.GET_SETTINGS:
      return getSettings();
    case MESSAGE_TYPES.SAVE_SETTINGS:
      return saveSettings(message.payload);
    case MESSAGE_TYPES.GET_LOGS:
      return getLogs();
    case MESSAGE_TYPES.CLEAR_LOGS:
      await clearLogs();
      return [];
    default:
      throw new Error("Unknown message type");
  }
}

async function handleCandidate(candidate: TweetCandidate): Promise<unknown> {
  const settings = await getSettings();
  const decision = decideCandidate(settings, candidate);

  if (decision.action !== "hide") {
    return decision;
  }

  await addLog({
    level: LOG_LEVELS.INFO,
    type: "local_hide",
    handle: decision.handle,
    matchedKeyword: decision.matchedKeyword,
    matchedField: decision.matchedField,
    tweetUrl: decision.tweetUrl,
    textSample: decision.textSample,
    message: `${displayHandle(decision.handle)} hidden by ${formatMatchedField(decision.matchedField)} "${decision.matchedKeyword}"`
  });

  return {
    action: "hide",
    handle: decision.handle,
    matchedKeyword: decision.matchedKeyword,
    matchedField: decision.matchedField
  };
}

function formatMatchedField(field: string): string {
  return field === "username" ? "用户名" : "正文";
}
