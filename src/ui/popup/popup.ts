import { MESSAGE_TYPES } from "../../shared/constants.js";
import type { RuntimeMessage, RuntimeResponse, Settings, Stats } from "../../shared/types.js";

const enabledInput = getElement<HTMLInputElement>("enabled");
const summary = getElement<HTMLElement>("summary");
const filteredCount = getElement<HTMLElement>("filteredCount");
const notice = getElement<HTMLElement>("notice");

getElement<HTMLButtonElement>("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

enabledInput.addEventListener("change", () => saveQuickSettings());

refresh();

async function refresh() {
  const [settings, stats] = await Promise.all([
    sendMessage<Settings>({ type: MESSAGE_TYPES.GET_SETTINGS }),
    sendActiveTabMessage<Stats>({ type: MESSAGE_TYPES.GET_CONTENT_STATS }).catch(() => ({ filteredCount: 0 }))
  ]);

  enabledInput.checked = settings.enabled;
  summary.textContent = `${settings.keywords.length} 正文 · ${settings.usernameKeywords.length} 用户名 · ${settings.whitelistHandles.length} 白名单`;
  filteredCount.textContent = formatCount(stats.filteredCount);
}

async function saveQuickSettings() {
  await runAction(async () => {
    await sendMessage({
      type: MESSAGE_TYPES.SAVE_SETTINGS,
      payload: {
        enabled: enabledInput.checked
      }
    });
    await refresh();
  });
}

async function runAction(action: () => Promise<void>): Promise<void> {
  notice.textContent = "";
  try {
    await action();
  } catch (error) {
    notice.textContent = error instanceof Error ? error.message : String(error);
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

function sendActiveTabMessage<T>(message: RuntimeMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) {
        reject(new Error("No active tab"));
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (rawResponse) => {
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
  });
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }

  return element as T;
}
