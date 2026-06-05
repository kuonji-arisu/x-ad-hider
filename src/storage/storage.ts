import { MAX_LOGS, STORAGE_KEYS } from "../shared/constants.js";
import type { LogEntry, Settings } from "../shared/types.js";
import { normalizeSettings } from "../shared/settings.js";

function getFromStorage(keys: string | string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = getChromeRuntimeError();
      if (error) {
        reject(error);
        return;
      }

      resolve(items);
    });
  });
}

function setInStorage(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = getChromeRuntimeError();
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getChromeRuntimeError(): Error | null {
  const lastError = chrome.runtime.lastError;
  return lastError ? new Error(lastError.message || "Chrome runtime error") : null;
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
