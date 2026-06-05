import { MESSAGE_TYPES } from "../shared/constants.js";
import type { HideDecision, RuntimeMessage, RuntimeResponse } from "../shared/types.js";
import { parseTimelineItem } from "./candidate-parser.js";
import { ContentRuleCache } from "./content-rule-cache.js";
import { HideController } from "./hide-controller.js";
import { ObserverManager } from "./observer-manager.js";
import { ScanScheduler, type ScanOutcome } from "./scan-scheduler.js";
import { TimelineLifecycle, type TimelineMount } from "./timeline-lifecycle.js";

type CellState = {
  signature: string;
  rulesEpoch: number;
};

const recentLogKeys: string[] = [];
const recentLogSet = new Set<string>();
const MAX_RECENT_LOG_KEYS = 500;

(function () {
  void start().catch((error) => {
    console.warn("[X Ad Hider] Content script failed to start", error);
  });
})();

async function start(): Promise<void> {
  const ruleCache = new ContentRuleCache();
  await ruleCache.initialize();

  const states = new WeakMap<HTMLElement, CellState>();
  const observers = new ObserverManager();
  const expiredPendingItems = new WeakSet<HTMLElement>();
  let rulesEpoch = 0;
  let activeTimeline: TimelineMount | null = null;
  const hideController = new HideController(() => activeTimeline?.container || null);

  const scheduler = new ScanScheduler(
    (item) => inspectTimelineItem(item),
    {
      onPendingExpired: (item) => expirePendingItem(item)
    }
  );
  const timelineLifecycle = new TimelineLifecycle(
    observers,
    (mount) => mountTimeline(mount),
    () => {
      activeTimeline = null;
    }
  );

  ruleCache.onChange(() => {
    rulesEpoch += 1;
    const container = timelineLifecycle.getCurrentContainer();
    if (container) {
      scheduler.enqueueAll(container);
    } else {
      timelineLifecycle.discoverNow();
    }
  });

  timelineLifecycle.start();

  function mountTimeline(mount: TimelineMount): void {
    activeTimeline = mount;
    observers.disconnectScope("timeline");
    observers.observe(mount.container, {
      scope: "timeline",
      name: "cells",
      childList: true,
      subtree: true
    }, (mutations) => scheduler.enqueueMutations(mutations));

    scheduler.enqueueAll(mount.container);
  }

  function inspectTimelineItem(item: HTMLElement): ScanOutcome {
    if (!activeTimeline || !activeTimeline.container.contains(item)) {
      states.delete(item);
      hideController.reset(item);
      return "processed";
    }

    const parsed = parseTimelineItem(item);
    if (parsed.status === "pending") {
      return expiredPendingItems.has(item) ? "processed" : "pending";
    }

    expiredPendingItems.delete(item);

    if (parsed.status === "ignored") {
      states.delete(item);
      hideController.reset(item);
      return "processed";
    }

    const currentState = states.get(item);
    const signatureChanged = currentState?.signature !== parsed.signature;
    const rulesChanged = currentState?.rulesEpoch !== rulesEpoch;

    if (!signatureChanged && !rulesChanged) {
      return "processed";
    }

    if (signatureChanged) {
      hideController.reset(item);
    }

    states.set(item, {
      signature: parsed.signature,
      rulesEpoch
    });

    const decision = ruleCache.decide(parsed.candidate);
    if (decision.action !== "hide") {
      hideController.reset(item);
      return "processed";
    }

    hideController.hide(item, decision);
    reportHideDecision(parsed.signature, decision);
    return "processed";
  }

  function expirePendingItem(item: HTMLElement): void {
    expiredPendingItems.add(item);
    states.delete(item);
    hideController.reset(item);
  }
}

function reportHideDecision(signature: string, decision: HideDecision): void {
  const logKey = [
    signature,
    decision.matchedField,
    decision.matchedKeyword
  ].join("\u0001");

  if (recentLogSet.has(logKey)) {
    return;
  }

  rememberLogKey(logKey);
  void sendMessage({
    type: MESSAGE_TYPES.ADD_LOG,
    payload: decision
  }).catch((error) => {
    console.warn("[X Ad Hider] Hide log failed", error);
  });
}

function rememberLogKey(logKey: string): void {
  recentLogSet.add(logKey);
  recentLogKeys.push(logKey);

  while (recentLogKeys.length > MAX_RECENT_LOG_KEYS) {
    const expired = recentLogKeys.shift();
    if (expired) {
      recentLogSet.delete(expired);
    }
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
