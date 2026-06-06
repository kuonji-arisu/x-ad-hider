import { normalizeSettings } from "./settings.js";
import type { Settings } from "./types.js";

export const SETTINGS_EXPORT_FORMAT = "x-ad-hider.settings";
export const SETTINGS_EXPORT_VERSION = 1;
export const SETTINGS_EXPORT_MAX_BYTES = 256 * 1024;

export type SettingsExportFile = {
  format: typeof SETTINGS_EXPORT_FORMAT;
  version: typeof SETTINGS_EXPORT_VERSION;
  exportedAt: string;
  settings: Settings;
};

export function createSettingsExport(settings: Partial<Settings>, exportedAt = new Date()): SettingsExportFile {
  return {
    format: SETTINGS_EXPORT_FORMAT,
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    settings: normalizeSettings(settings)
  };
}

export function parseSettingsExportText(text: string): Settings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("导入文件不是有效的 JSON");
  }

  const file = requireRecord(parsed, "导入文件格式不正确");
  if (file.format !== SETTINGS_EXPORT_FORMAT) {
    throw new Error("导入文件不是 X Ad Hider 设置文件");
  }

  if (file.version !== SETTINGS_EXPORT_VERSION) {
    throw new Error(`不支持的设置文件版本：${String(file.version || "")}`);
  }

  const settings = requireRecord(file.settings, "导入文件缺少设置内容");
  return normalizeSettings({
    enabled: readBoolean(settings, "enabled"),
    pinyinFuzzyMatching: readBoolean(settings, "pinyinFuzzyMatching"),
    keywords: readStringList(settings, "keywords"),
    usernameKeywords: readStringList(settings, "usernameKeywords"),
    whitelistHandles: readStringList(settings, "whitelistHandles")
  });
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }

  return value as Record<string, unknown>;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`设置字段 ${key} 必须是布尔值`);
  }

  return value;
}

function readStringList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`设置字段 ${key} 必须是数组`);
  }

  if (!value.every((item) => typeof item === "string")) {
    throw new Error(`设置字段 ${key} 只能包含字符串`);
  }

  return value;
}
