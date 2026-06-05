import { MESSAGE_TYPES } from "../../shared/constants.js";
import type { LogEntry, RuntimeMessage, RuntimeResponse, Settings } from "../../shared/types.js";

const enabledInput = getElement<HTMLInputElement>("enabled");
const summary = getElement<HTMLElement>("summary");
const logsElement = getElement<HTMLElement>("logs");
const notice = getElement<HTMLElement>("notice");

getElement<HTMLButtonElement>("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

getElement<HTMLButtonElement>("clearLogs").addEventListener("click", async () => {
  await runAction(async () => {
    await sendMessage({ type: MESSAGE_TYPES.CLEAR_LOGS });
    await refresh();
  });
});

enabledInput.addEventListener("change", () => saveQuickSettings());

refresh();

async function refresh() {
  const [settings, logs] = await Promise.all([
    sendMessage<Settings>({ type: MESSAGE_TYPES.GET_SETTINGS }),
    sendMessage<LogEntry[]>({ type: MESSAGE_TYPES.GET_LOGS })
  ]);

  enabledInput.checked = settings.enabled;
  summary.textContent = `${settings.keywords.length} 正文 · ${settings.usernameKeywords.length} 用户名 · ${settings.whitelistHandles.length} 白名单`;
  renderLogs(logs.slice(0, 10));
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

function renderLogs(logs: LogEntry[]): void {
  if (!logs.length) {
    logsElement.innerHTML = '<div class="muted">暂无日志</div>';
    return;
  }

  logsElement.innerHTML = logs.map((log) => `
    <div class="log-item log-${escapeHtml(log.level || "info")}">
      <div class="log-meta">
        <span>${escapeHtml(formatTime(log.createdAt))}</span>
        <span>${escapeHtml(log.matchedKeyword || "")}</span>
      </div>
      <div class="log-message">${escapeHtml(log.message || "")}</div>
    </div>
  `).join("");
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

function formatTime(value: number): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value: unknown): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }

  return element as T;
}
