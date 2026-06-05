import { MESSAGE_TYPES } from "../../shared/constants.js";
import {
  createSettingsExport,
  parseSettingsExportText,
  SETTINGS_EXPORT_MAX_BYTES,
  type SettingsExportFile
} from "../../shared/settings-export.js";
import type { LogEntry, RuntimeMessage, RuntimeResponse, Settings } from "../../shared/types.js";

const enabledInput = getElement<HTMLInputElement>("enabled");
const keywordsInput = getElement<HTMLTextAreaElement>("keywords");
const usernameKeywordsInput = getElement<HTMLTextAreaElement>("usernameKeywords");
const whitelistInput = getElement<HTMLTextAreaElement>("whitelist");
const importFileInput = getElement<HTMLInputElement>("importFile");
const logsElement = getElement<HTMLElement>("logs");
const notice = getElement<HTMLElement>("notice");

getElement<HTMLButtonElement>("save").addEventListener("click", () => runAction(async () => {
  await saveSettings();
  notice.textContent = "已保存";
}));
getElement<HTMLButtonElement>("importSettings").addEventListener("click", () => {
  importFileInput.value = "";
  importFileInput.click();
});
getElement<HTMLButtonElement>("exportSettings").addEventListener("click", () => runAction(async () => {
  exportSettings();
  notice.textContent = "已导出";
}));
importFileInput.addEventListener("change", () => runAction(async () => {
  const file = importFileInput.files?.[0];
  if (!file) {
    return;
  }

  await importSettingsFile(file);
  notice.textContent = "已导入";
}));
getElement<HTMLButtonElement>("clearLogs").addEventListener("click", async () => {
  await runAction(async () => {
    await sendMessage({ type: MESSAGE_TYPES.CLEAR_LOGS });
    await refresh();
  });
});

refresh();

async function refresh() {
  const [settings, logs] = await Promise.all([
    sendMessage<Settings>({ type: MESSAGE_TYPES.GET_SETTINGS }),
    sendMessage<LogEntry[]>({ type: MESSAGE_TYPES.GET_LOGS })
  ]);

  applySettings(settings);
  renderLogs(logs);
}

async function saveSettings() {
  await sendMessage({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    payload: readSettingsFromForm()
  });
}

function exportSettings(): void {
  downloadSettingsExport(createSettingsExport(readSettingsFromForm()));
}

async function importSettingsFile(file: File): Promise<void> {
  if (file.size > SETTINGS_EXPORT_MAX_BYTES) {
    throw new Error("导入文件过大");
  }

  const settings = parseSettingsExportText(await file.text());
  const savedSettings = await sendMessage<Settings>({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    payload: settings
  });

  applySettings(savedSettings);
}

function readSettingsFromForm(): Settings {
  return {
    enabled: enabledInput.checked,
    keywords: lines(keywordsInput.value),
    usernameKeywords: lines(usernameKeywordsInput.value),
    whitelistHandles: lines(whitelistInput.value)
  };
}

function applySettings(settings: Settings): void {
  enabledInput.checked = settings.enabled;
  keywordsInput.value = settings.keywords.join("\n");
  usernameKeywordsInput.value = settings.usernameKeywords.join("\n");
  whitelistInput.value = settings.whitelistHandles.map((handle) => `@${handle}`).join("\n");
}

function downloadSettingsExport(file: SettingsExportFile): void {
  const content = `${JSON.stringify(file, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `x-ad-hider-settings-${formatDateForFilename(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
        <span>${escapeHtml(log.handle ? `@${log.handle}` : "")}</span>
      </div>
      <div class="log-message">${escapeHtml(log.message || "")}</div>
      ${log.textSample ? `<div class="muted">${escapeHtml(log.textSample)}</div>` : ""}
    </div>
  `).join("");
}

function lines(value: string): string[] {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDateForFilename(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    dateStyle: "short",
    timeStyle: "short"
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
