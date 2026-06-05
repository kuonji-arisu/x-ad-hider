import { describe, expect, it } from "vitest";
import {
  createSettingsExport,
  parseSettingsExportText,
  SETTINGS_EXPORT_FORMAT,
  SETTINGS_EXPORT_VERSION
} from "./settings-export.js";

describe("settings export", () => {
  it("creates a readable versioned settings file", () => {
    const exportedAt = new Date("2026-06-06T01:02:03.000Z");
    const file = createSettingsExport({
      keywords: [" Promo "],
      usernameKeywords: ["Bot"],
      whitelistHandles: ["@Alice"]
    }, exportedAt);

    expect(file).toEqual({
      format: SETTINGS_EXPORT_FORMAT,
      version: SETTINGS_EXPORT_VERSION,
      exportedAt: "2026-06-06T01:02:03.000Z",
      settings: {
        enabled: true,
        keywords: ["promo"],
        usernameKeywords: ["bot"],
        whitelistHandles: ["alice"]
      }
    });
  });

  it("parses and normalizes valid settings JSON", () => {
    const text = JSON.stringify({
      format: SETTINGS_EXPORT_FORMAT,
      version: SETTINGS_EXPORT_VERSION,
      exportedAt: "2026-06-06T01:02:03.000Z",
      settings: {
        enabled: false,
        keywords: [" Scam ", "scam", ""],
        usernameKeywords: ["Bot"],
        whitelistHandles: ["@Trusted", "trusted"]
      }
    });

    expect(parseSettingsExportText(text)).toEqual({
      enabled: false,
      keywords: ["scam"],
      usernameKeywords: ["bot"],
      whitelistHandles: ["trusted"]
    });
  });

  it("rejects malformed import files", () => {
    expect(() => parseSettingsExportText("{")).toThrow("导入文件不是有效的 JSON");
    expect(() => parseSettingsExportText(JSON.stringify([]))).toThrow("导入文件格式不正确");
    expect(() => parseSettingsExportText(JSON.stringify({
      format: "other",
      version: SETTINGS_EXPORT_VERSION,
      settings: {}
    }))).toThrow("导入文件不是 X Ad Hider 设置文件");
    expect(() => parseSettingsExportText(JSON.stringify({
      format: SETTINGS_EXPORT_FORMAT,
      version: 999,
      settings: {}
    }))).toThrow("不支持的设置文件版本");
    expect(() => parseSettingsExportText(JSON.stringify({
      format: SETTINGS_EXPORT_FORMAT,
      version: SETTINGS_EXPORT_VERSION
    }))).toThrow("导入文件缺少设置内容");
  });

  it("rejects settings fields with wrong types", () => {
    const build = (settings: Record<string, unknown>) => JSON.stringify({
      format: SETTINGS_EXPORT_FORMAT,
      version: SETTINGS_EXPORT_VERSION,
      settings
    });

    expect(() => parseSettingsExportText(build({ enabled: "yes" }))).toThrow("设置字段 enabled 必须是布尔值");
    expect(() => parseSettingsExportText(build({ keywords: "promo" }))).toThrow("设置字段 keywords 必须是数组");
    expect(() => parseSettingsExportText(build({ keywords: ["promo", 123] }))).toThrow("设置字段 keywords 只能包含字符串");
  });
});
