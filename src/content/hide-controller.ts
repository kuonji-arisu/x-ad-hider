import type { HideDecision } from "../shared/types.js";
import { getViewportInfo, queryTimelineItems } from "./timeline-adapter.js";

const COLLAPSED_CLASS = "x-ad-hider-hidden-collapsed";
const RESERVED_CLASS = "x-ad-hider-hidden-reserved";
const STYLE_ID = "x-ad-hider-style";
const RESERVED_HEIGHT_PROPERTY = "--x-ad-hider-reserved-height";
const SCROLL_ACTIVE_MS = 220;
const COMPACT_IDLE_MS = 260;
const RESERVE_VIEWPORT_MARGIN = 600;

type HiddenRecord = {
  decision: HideDecision;
  height: number;
  mode: "reserved" | "collapsed";
};

type ScrollAnchor = {
  element: HTMLElement;
  top: number;
};

type TimelineContainerProvider = () => HTMLElement | null;

export class HideController {
  private hiddenItems = new WeakMap<HTMLElement, HiddenRecord>();
  private reservedItems = new Set<HTMLElement>();
  private lastScrollAt = 0;
  private compactTimer: number | null = null;

  constructor(private readonly getTimelineContainer: TimelineContainerProvider = () => null) {
    injectStyles();
    window.addEventListener("scroll", () => this.onScroll(), { passive: true });
    window.addEventListener("resize", () => this.compactReservedItems(), { passive: true });
  }

  hide(item: HTMLElement, decision: HideDecision): void {
    if (this.shouldReserve(item)) {
      this.reserve(item, decision);
      return;
    }

    this.collapse(item, decision);
  }

  reset(item: HTMLElement): void {
    item.classList.remove(COLLAPSED_CLASS, RESERVED_CLASS);
    item.style.removeProperty(RESERVED_HEIGHT_PROPERTY);
    item.removeAttribute("data-x-ad-hider-keyword");
    item.removeAttribute("data-x-ad-hider-field");
    this.reservedItems.delete(item);
    this.hiddenItems.delete(item);
  }

  private reserve(item: HTMLElement, decision: HideDecision): void {
    const height = measureHeight(item);
    item.classList.remove(COLLAPSED_CLASS);
    item.classList.add(RESERVED_CLASS);
    item.style.setProperty(RESERVED_HEIGHT_PROPERTY, `${height}px`);
    item.setAttribute("data-x-ad-hider-keyword", decision.matchedKeyword);
    item.setAttribute("data-x-ad-hider-field", decision.matchedField);
    this.hiddenItems.set(item, { decision, height, mode: "reserved" });
    this.reservedItems.add(item);
    this.scheduleCompaction();
  }

  private collapse(item: HTMLElement, decision: HideDecision): void {
    const existing = this.hiddenItems.get(item);
    const info = getViewportInfo(item);
    const height = existing?.height || measureHeight(item);
    const anchor = info.isAboveViewport && height > 0
      ? captureScrollAnchor(item, this.getTimelineContainer())
      : null;

    item.classList.remove(RESERVED_CLASS);
    item.classList.add(COLLAPSED_CLASS);
    item.style.removeProperty(RESERVED_HEIGHT_PROPERTY);
    item.setAttribute("data-x-ad-hider-keyword", decision.matchedKeyword);
    item.setAttribute("data-x-ad-hider-field", decision.matchedField);
    this.reservedItems.delete(item);
    this.hiddenItems.set(item, { decision, height, mode: "collapsed" });

    stabilizeScrollAnchor(anchor);
  }

  private shouldReserve(item: HTMLElement): boolean {
    if (!this.isScrollActive()) {
      return false;
    }

    return getViewportInfo(item, RESERVE_VIEWPORT_MARGIN).isNearViewport;
  }

  private isScrollActive(): boolean {
    return Date.now() - this.lastScrollAt < SCROLL_ACTIVE_MS;
  }

  private onScroll(): void {
    this.lastScrollAt = Date.now();
    this.scheduleCompaction();
  }

  private scheduleCompaction(): void {
    if (this.compactTimer !== null) {
      window.clearTimeout(this.compactTimer);
    }

    this.compactTimer = window.setTimeout(() => {
      this.compactTimer = null;
      this.compactReservedItems();
    }, COMPACT_IDLE_MS);
  }

  private compactReservedItems(): void {
    if (this.isScrollActive()) {
      this.scheduleCompaction();
      return;
    }

    for (const item of Array.from(this.reservedItems)) {
      const record = this.hiddenItems.get(item);
      if (!item.isConnected || !record) {
        this.reset(item);
        continue;
      }

      if (record.mode === "reserved") {
        this.collapse(item, record.decision);
      }
    }
  }
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${RESERVED_CLASS} {
      box-sizing: border-box !important;
      height: var(${RESERVED_HEIGHT_PROPERTY}) !important;
      min-height: var(${RESERVED_HEIGHT_PROPERTY}) !important;
      max-height: var(${RESERVED_HEIGHT_PROPERTY}) !important;
      overflow: hidden !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }

    .${COLLAPSED_CLASS} {
      display: none !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function measureHeight(item: HTMLElement): number {
  return Math.max(1, Math.ceil(item.getBoundingClientRect().height));
}

function captureScrollAnchor(excludedItem: HTMLElement, timelineContainer: HTMLElement | null): ScrollAnchor | null {
  let best: ScrollAnchor | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const targetTop = Math.min(120, Math.max(40, window.innerHeight * 0.15));

  for (const item of queryTimelineItems(timelineContainer || document)) {
    if (item === excludedItem || !item.isConnected) {
      continue;
    }

    const info = getViewportInfo(item);
    if (info.bottom <= 0 || info.top >= window.innerHeight) {
      continue;
    }

    const distance = Math.abs(info.top - targetTop);
    if (distance < bestDistance) {
      best = {
        element: item,
        top: info.top
      };
      bestDistance = distance;
    }
  }

  return best;
}

function stabilizeScrollAnchor(anchor: ScrollAnchor | null): void {
  if (!anchor?.element.isConnected) {
    return;
  }

  const nextTop = anchor.element.getBoundingClientRect().top;
  const delta = nextTop - anchor.top;
  if (Math.abs(delta) < 1) {
    return;
  }

  window.scrollBy(0, delta);
}
