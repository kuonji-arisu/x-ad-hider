import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../shared/constants.js";
import type { Settings } from "../shared/types.js";
import { ContentRuleCache } from "./content-rule-cache.js";

type ChangeListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];

type ChromeMock = typeof chrome & {
  __emitSettingsChange: (settings: Partial<Settings>) => void;
};

const originalChrome = globalThis.chrome;

function installChromeMock(settings: Partial<Settings>): ChromeMock {
  let changeListener: ChangeListener | null = null;
  const mock = {
    __emitSettingsChange(nextSettings: Partial<Settings>) {
      changeListener?.({
        [STORAGE_KEYS.SETTINGS]: {
          newValue: nextSettings
        }
      }, "local");
    },
    runtime: {
      lastError: undefined,
      getURL: vi.fn((path: string) => path),
      sendMessage: vi.fn((_message: unknown, callback: (response: unknown) => void) => {
        callback({ ok: true, payload: settings });
      }),
      openOptionsPage: vi.fn(),
      onMessage: {
        addListener: vi.fn()
      }
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn()
      },
      onChanged: {
        addListener: vi.fn((listener: ChangeListener) => {
          changeListener = listener;
        })
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

describe("ContentRuleCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalChrome) {
      globalThis.chrome = originalChrome;
    } else {
      Reflect.deleteProperty(globalThis, "chrome");
    }
  });

  it("does not load the pinyin signature module while pinyin matching is disabled", async () => {
    const mock = installChromeMock({
      keywords: ["promo"],
      pinyinFuzzyMatching: false
    });
    const cache = new ContentRuleCache();

    await cache.initialize();

    expect(mock.runtime.getURL).not.toHaveBeenCalled();
    expect(cache.decide({
      handle: "alice",
      usernameText: "Alice",
      text: "PROMO",
      tweetUrl: ""
    })).toMatchObject({
      action: "hide",
      matchedKeyword: "promo"
    });
  });

  it("falls back to literal matching when the pinyin signature module fails to load", async () => {
    const moduleUrl = `data:text/javascript,${encodeURIComponent(`
      throw new Error("load failed");
    `)}`;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mock = installChromeMock({
      keywords: ["广告", "promo"],
      pinyinFuzzyMatching: true
    });
    mock.runtime.getURL = vi.fn(() => moduleUrl);
    const cache = new ContentRuleCache();

    await cache.initialize();

    expect(mock.runtime.getURL).toHaveBeenCalledWith("content/match-signature.js");
    expect(warn).toHaveBeenCalledWith(
      "[X Ad Hider] Pinyin fuzzy matching is unavailable",
      expect.any(Error)
    );
    expect(cache.decide({
      handle: "alice",
      usernameText: "Alice",
      text: "PROMO",
      tweetUrl: ""
    })).toMatchObject({
      action: "hide",
      matchedKeyword: "promo"
    });
    expect(cache.decide({
      handle: "alice",
      usernameText: "Alice",
      text: "广吿",
      tweetUrl: ""
    })).toEqual({
      action: "skip",
      reason: "no-keyword-match"
    });
  });

  it("loads the pinyin signature module when pinyin matching is enabled", async () => {
    const moduleUrl = `data:text/javascript,${encodeURIComponent(`
      export function toMatchSignature(input) {
        return String(input ?? "").toLowerCase().replaceAll("x", "y");
      }
    `)}`;
    const mock = installChromeMock({
      keywords: ["yy"],
      pinyinFuzzyMatching: true
    });
    mock.runtime.getURL = vi.fn(() => moduleUrl);
    const cache = new ContentRuleCache();

    await cache.initialize();

    expect(mock.runtime.getURL).toHaveBeenCalledWith("content/match-signature.js");
    expect(cache.decide({
      handle: "alice",
      usernameText: "Alice",
      text: "xx",
      tweetUrl: ""
    })).toMatchObject({
      action: "hide",
      matchedKeyword: "yy"
    });
  });
});
