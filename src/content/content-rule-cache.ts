import { decideCandidate } from "../rules/rule-engine.js";
import { MESSAGE_TYPES, STORAGE_KEYS } from "../shared/constants.js";
import { normalizeSettings } from "../shared/settings.js";
import type { Decision, RuntimeMessage, RuntimeResponse, Settings, TweetCandidate } from "../shared/types.js";

type SettingsListener = (settings: Settings) => void;

export class ContentRuleCache {
  private settings: Settings = normalizeSettings();
  private listeners = new Set<SettingsListener>();

  async initialize(): Promise<void> {
    this.settings = await sendMessage<Settings>({ type: MESSAGE_TYPES.GET_SETTINGS });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEYS.SETTINGS]) {
        return;
      }

      this.settings = normalizeSettings(changes[STORAGE_KEYS.SETTINGS].newValue as Partial<Settings> | undefined);
      for (const listener of this.listeners) {
        listener(this.settings);
      }
    });
  }

  decide(candidate: TweetCandidate): Decision {
    return decideCandidate(this.settings, candidate);
  }

  onChange(listener: SettingsListener): void {
    this.listeners.add(listener);
  }
}

function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (rawResponse) => {
      const response = rawResponse as RuntimeResponse<T> | undefined;
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Message failed"));
        return;
      }

      resolve(response.payload);
    });
  });
}
