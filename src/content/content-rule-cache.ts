import {
  compileRuleSettings,
  decideCompiledCandidate,
  type CompiledRuleSettings,
  type MatchSignature
} from "../rules/rule-engine.js";
import { MESSAGE_TYPES, STORAGE_KEYS } from "../shared/constants.js";
import { normalizeSettings } from "../shared/settings.js";
import type { Decision, RuntimeMessage, RuntimeResponse, Settings, TweetCandidate } from "../shared/types.js";

type SettingsListener = (settings: Settings) => void;
type MatchSignatureModule = {
  toMatchSignature: MatchSignature;
};

let matchSignaturePromise: Promise<MatchSignature> | null = null;

export class ContentRuleCache {
  private settings: Settings = normalizeSettings();
  private compiledSettings: CompiledRuleSettings = compileRuleSettings(this.settings);
  private listeners = new Set<SettingsListener>();
  private settingsVersion = 0;

  async initialize(): Promise<void> {
    await this.setSettings(await sendMessage<Settings>({ type: MESSAGE_TYPES.GET_SETTINGS }));
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEYS.SETTINGS]) {
        return;
      }

      void this.setSettings(changes[STORAGE_KEYS.SETTINGS].newValue as Partial<Settings> | undefined)
        .then((updated) => {
          if (!updated) {
            return;
          }

          for (const listener of this.listeners) {
            listener(this.settings);
          }
        })
        .catch((error) => {
          console.warn("[X Ad Hider] Failed to update rule settings", error);
        });
    });
  }

  decide(candidate: TweetCandidate): Decision {
    return decideCompiledCandidate(this.compiledSettings, candidate);
  }

  onChange(listener: SettingsListener): void {
    this.listeners.add(listener);
  }

  private async setSettings(settings: Partial<Settings> | undefined): Promise<boolean> {
    const version = this.settingsVersion + 1;
    this.settingsVersion = version;

    const nextSettings = normalizeSettings(settings);
    const toMatchSignature = await loadMatchSignature(nextSettings);
    if (version !== this.settingsVersion) {
      return false;
    }

    this.settings = nextSettings;
    this.compiledSettings = compileRuleSettings(this.settings, toMatchSignature);
    return true;
  }
}

async function loadMatchSignature(settings: Settings): Promise<MatchSignature | undefined> {
  if (!settings.pinyinFuzzyMatching) {
    return undefined;
  }

  matchSignaturePromise ||= import(chrome.runtime.getURL("content/match-signature.js"))
    .then((module) => (module as MatchSignatureModule).toMatchSignature);

  try {
    return await matchSignaturePromise;
  } catch (error) {
    matchSignaturePromise = null;
    console.warn("[X Ad Hider] Pinyin fuzzy matching is unavailable", error);
    return undefined;
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
