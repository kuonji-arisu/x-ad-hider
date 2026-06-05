import { MAX_LOGS, STORAGE_KEYS } from "../shared/constants.js";
import type { LogEntry, Settings } from "../shared/types.js";
import { normalizeHandle, normalizeKeyword, uniqueCleanList } from "../shared/utils.js";

function getFromStorage(keys: string | string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setInStorage(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set(values, () => resolve()));
}

export async function getSettings(): Promise<Settings> {
  const data = await getFromStorage(STORAGE_KEYS.SETTINGS);
  return normalizeSettings(data[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined);
}

export async function saveSettings(nextSettings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const settings = normalizeSettings({ ...current, ...nextSettings });
  await setInStorage({ [STORAGE_KEYS.SETTINGS]: settings });
  return settings;
}

export function normalizeSettings(settings: Partial<Settings> = {}): Settings {
  return {
    enabled: settings.enabled !== false,
    keywords: uniqueCleanList(settings.keywords || [], normalizeKeyword),
    usernameKeywords: uniqueCleanList(settings.usernameKeywords || [], normalizeKeyword),
    whitelistHandles: uniqueCleanList(settings.whitelistHandles || [], normalizeHandle)
  };
}

export async function getLogs(): Promise<LogEntry[]> {
  const data = await getFromStorage(STORAGE_KEYS.LOGS);
  return (data[STORAGE_KEYS.LOGS] as LogEntry[] | undefined) || [];
}

export async function addLog(log: Omit<LogEntry, "id" | "createdAt">): Promise<LogEntry> {
  const logs = await getLogs();
  const nextLogs = [
    {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...log
    },
    ...logs
  ].slice(0, MAX_LOGS);

  await setInStorage({ [STORAGE_KEYS.LOGS]: nextLogs });
  return nextLogs[0];
}

export async function clearLogs(): Promise<void> {
  await setInStorage({ [STORAGE_KEYS.LOGS]: [] });
}
