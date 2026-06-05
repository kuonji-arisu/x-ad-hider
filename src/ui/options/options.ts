import { MESSAGE_TYPES } from "../../shared/constants.js";
import {
  createSettingsExport,
  parseSettingsExportText,
  SETTINGS_EXPORT_MAX_BYTES,
  type SettingsExportFile
} from "../../shared/settings-export.js";
import { normalizeSettings } from "../../shared/settings.js";
import type { LogEntry, RuntimeMessage, RuntimeResponse, Settings } from "../../shared/types.js";

type OptionsTab = "settings" | "logs";

const enabledInput = getElement<HTMLInputElement>("enabled");
const keywordsInput = getElement<HTMLTextAreaElement>("keywords");
const usernameKeywordsInput = getElement<HTMLTextAreaElement>("usernameKeywords");
const whitelistInput = getElement<HTMLTextAreaElement>("whitelist");
const importFileInput = getElement<HTMLInputElement>("importFile");
const saveButton = getElement<HTMLButtonElement>("save");
const settingsPanel = getElement<HTMLElement>("settingsPanel");
const logsPanel = getElement<HTMLElement>("logsPanel");
const logsElement = getElement<HTMLElement>("logs");
const notice = getElement<HTMLElement>("notice");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab]"));
const settingsInputs = [
  enabledInput,
  keywordsInput,
  usernameKeywordsInput,
  whitelistInput
];

let savedSettings: Settings | null = null;
let activeTab: OptionsTab = "settings";

saveButton.addEventListener("click", () => runSettingsAction(async () => {
  const settings = await saveSettings();
  applySavedSettings(settings);
  setNotice("已保存");
}));
getElement<HTMLButtonElement>("importSettings").addEventListener("click", () => {
  importFileInput.value = "";
  importFileInput.click();
});
getElement<HTMLButtonElement>("exportSettings").addEventListener("click", () => runSettingsAction(async () => {
  exportSettings();
  setNotice(hasUnsavedChanges() ? "已导出，当前更改尚未保存" : "已导出");
}));
importFileInput.addEventListener("change", () => runSettingsAction(async () => {
  const file = importFileInput.files?.[0];
  if (!file) {
    return;
  }

  const settings = await importSettingsFile(file);
  applySavedSettings(settings);
  setNotice("已导入");
}));
getElement<HTMLButtonElement>("clearLogs").addEventListener("click", async () => {
  await runLogAction(async () => {
    await sendMessage({ type: MESSAGE_TYPES.CLEAR_LOGS });
    renderLogs([]);
  });
});
for (const input of settingsInputs) {
  input.addEventListener("input", () => updateDirtyState());
  input.addEventListener("change", () => updateDirtyState());
}
for (const button of tabButtons) {
  button.addEventListener("click", () => switchTab(readTab(button)));
}

refresh();

async function refresh() {
  const [settings, logs] = await Promise.all([
    sendMessage<Settings>({ type: MESSAGE_TYPES.GET_SETTINGS }),
    sendMessage<LogEntry[]>({ type: MESSAGE_TYPES.GET_LOGS })
  ]);

  applySavedSettings(settings);
  renderLogs(logs);
}

async function saveSettings(): Promise<Settings> {
  return sendMessage<Settings>({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    payload: readSettingsFromForm()
  });
}

function exportSettings(): void {
  downloadSettingsExport(createSettingsExport(readSettingsFromForm()));
}

async function importSettingsFile(file: File): Promise<Settings> {
  if (file.size > SETTINGS_EXPORT_MAX_BYTES) {
    throw new Error("导入文件过大");
  }

  const settings = parseSettingsExportText(await file.text());
  return sendMessage<Settings>({
    type: MESSAGE_TYPES.SAVE_SETTINGS,
    payload: settings
  });
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

function applySavedSettings(settings: Settings): void {
  savedSettings = normalizeSettings(settings);
  applySettings(savedSettings);
  updateDirtyState({ preserveNotice: true });
}

function hasUnsavedChanges(): boolean {
  return Boolean(savedSettings && settingsFingerprint(readSettingsFromForm()) !== settingsFingerprint(savedSettings));
}

function updateDirtyState(options: { preserveNotice?: boolean } = {}): void {
  const dirty = hasUnsavedChanges();
  saveButton.disabled = !savedSettings || !dirty;

  if (!options.preserveNotice) {
    setNotice(dirty ? "有未保存更改" : "");
  }
}

function settingsFingerprint(settings: Partial<Settings>): string {
  return JSON.stringify(normalizeSettings(settings));
}

function switchTab(nextTab: OptionsTab): void {
  activeTab = nextTab;

  for (const button of tabButtons) {
    const isSelected = readTab(button) === activeTab;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  settingsPanel.hidden = activeTab !== "settings";
  logsPanel.hidden = activeTab !== "logs";

  if (activeTab === "logs") {
    void refreshLogs().catch((error) => renderLogError(error));
  }
}

function readTab(button: HTMLButtonElement): OptionsTab {
  return button.dataset.tab === "logs" ? "logs" : "settings";
}

async function refreshLogs(): Promise<void> {
  renderLogs(await sendMessage<LogEntry[]>({ type: MESSAGE_TYPES.GET_LOGS }));
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

async function runSettingsAction(action: () => Promise<void>): Promise<void> {
  setNotice("");
  try {
    await action();
    updateDirtyState({ preserveNotice: true });
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error));
  }
}

async function runLogAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    renderLogError(error);
  }
}

function setNotice(message: string): void {
  notice.textContent = message;
}

function renderLogError(error: unknown): void {
  logsElement.innerHTML = `<div class="muted">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
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
