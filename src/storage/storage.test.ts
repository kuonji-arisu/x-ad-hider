import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_LOGS, STORAGE_KEYS } from "../shared/constants.js";
import type { LogEntry } from "../shared/types.js";
import {
  addLog,
  clearLogs,
  getLogs,
  getSettings,
  saveSettings
} from "./storage.js";

type ChromeMock = typeof chrome & {
  __store: Record<string, unknown>;
  __setLastError: (message?: string) => void;
};

const originalChrome = globalThis.chrome;

function installChromeMock(initialStore: Record<string, unknown> = {}): ChromeMock {
  let lastError: { message?: string } | undefined;
  const mock = {
    __store: { ...initialStore },
    __setLastError(message?: string) {
      lastError = message ? { message } : undefined;
    },
    runtime: {
      get lastError() {
        return lastError;
      },
      sendMessage: vi.fn(),
      openOptionsPage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      }
    },
    storage: {
      local: {
        get: vi.fn((keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void) => {
          if (typeof keys === "string") {
            callback({ [keys]: mock.__store[keys] });
            return;
          }

          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, mock.__store[key]])));
            return;
          }

          if (keys && typeof keys === "object") {
            callback(Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [
              key,
              mock.__store[key] ?? fallback
            ])));
            return;
          }

          callback({ ...mock.__store });
        }),
        set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
          Object.assign(mock.__store, items);
          callback?.();
        }),
        remove: vi.fn()
      },
      onChanged: {
        addListener: vi.fn()
      }
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn()
    }
  } satisfies ChromeMock;

  globalThis.chrome = mock;
  return mock;
}

function logEntry(id: string): LogEntry {
  return {
    id,
    createdAt: 1,
    level: "info",
    type: "local_hide",
    message: id
  };
}

describe("storage", () => {
  beforeEach(() => {
    installChromeMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalChrome) {
      globalThis.chrome = originalChrome;
    } else {
      Reflect.deleteProperty(globalThis, "chrome");
    }
  });

  it("returns normalized default settings from empty storage", async () => {
    await expect(getSettings()).resolves.toEqual({
      enabled: true,
      keywords: [],
      usernameKeywords: [],
      whitelistHandles: []
    });
  });

  it("saves settings by merging with current values", async () => {
    const mock = installChromeMock({
      [STORAGE_KEYS.SETTINGS]: {
        enabled: true,
        keywords: ["promo"],
        usernameKeywords: ["bot"],
        whitelistHandles: ["alice"]
      }
    });

    await expect(saveSettings({
      enabled: false,
      keywords: [" Promo ", "Airdrop"]
    })).resolves.toEqual({
      enabled: false,
      keywords: ["promo", "airdrop"],
      usernameKeywords: ["bot"],
      whitelistHandles: ["alice"]
    });
    expect(mock.__store[STORAGE_KEYS.SETTINGS]).toEqual({
      enabled: false,
      keywords: ["promo", "airdrop"],
      usernameKeywords: ["bot"],
      whitelistHandles: ["alice"]
    });
  });

  it("adds newest logs first and caps stored logs", async () => {
    const existingLogs = Array.from({ length: MAX_LOGS }, (_, index) => logEntry(`old-${index}`));
    const mock = installChromeMock({
      [STORAGE_KEYS.LOGS]: existingLogs
    });
    vi.spyOn(Date, "now").mockReturnValue(1234);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");

    const entry = await addLog({
      level: "info",
      type: "local_hide",
      message: "new"
    });

    expect(entry).toMatchObject({
      id: "00000000-0000-4000-8000-000000000000",
      createdAt: 1234,
      message: "new"
    });
    expect(await getLogs()).toHaveLength(MAX_LOGS);
    expect((mock.__store[STORAGE_KEYS.LOGS] as LogEntry[])[0].message).toBe("new");
    expect((mock.__store[STORAGE_KEYS.LOGS] as LogEntry[]).at(-1)?.id).toBe(`old-${MAX_LOGS - 2}`);
  });

  it("clears logs", async () => {
    const mock = installChromeMock({
      [STORAGE_KEYS.LOGS]: [logEntry("old")]
    });

    await clearLogs();
    expect(mock.__store[STORAGE_KEYS.LOGS]).toEqual([]);
  });

  it("rejects when chrome storage reports a runtime error", async () => {
    const mock = installChromeMock();
    mock.__setLastError("storage unavailable");

    await expect(getSettings()).rejects.toThrow("storage unavailable");
    await expect(clearLogs()).rejects.toThrow("storage unavailable");
  });
});
