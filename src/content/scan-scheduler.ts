import {
  getTimelineItemsFromMutations,
  getViewportInfo,
  queryTimelineItems
} from "./timeline-adapter.js";

export type ScanOutcome = "processed" | "pending";
export type ScanHandler = (item: HTMLElement) => ScanOutcome | void;
export type PendingExpiredHandler = (item: HTMLElement) => void;

type ScanSchedulerOptions = {
  onPendingExpired?: PendingExpiredHandler;
};

const MAX_ITEMS_PER_FRAME = 12;
const NEAR_VIEWPORT_MARGIN = 900;
const PENDING_RETRY_DELAYS = [80, 160, 320, 640, 1000];

export class ScanScheduler {
  private queue = new Set<HTMLElement>();
  private pendingAttempts = new WeakMap<HTMLElement, number>();
  private pendingTimers = new WeakMap<HTMLElement, number>();
  private scheduled = false;

  constructor(
    private readonly handleItem: ScanHandler,
    private readonly options: ScanSchedulerOptions = {}
  ) {}

  enqueue(item: HTMLElement): void {
    if (!item.isConnected) {
      return;
    }

    this.clearPendingTimer(item);
    this.queue.add(item);
    this.schedule();
  }

  enqueueAll(root: Node | ParentNode = document): void {
    for (const item of queryTimelineItems(root)) {
      this.enqueue(item);
    }
  }

  enqueueMutations(mutations: MutationRecord[]): void {
    for (const item of getTimelineItemsFromMutations(mutations)) {
      this.enqueue(item);
    }
  }

  private schedule(): void {
    if (this.scheduled) {
      return;
    }

    this.scheduled = true;
    window.requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    this.scheduled = false;

    for (const item of this.takeBatch()) {
      if (!item.isConnected) {
        continue;
      }

      const outcome = this.handleItem(item);
      if (outcome === "pending") {
        this.schedulePendingRetry(item);
      } else {
        this.pendingAttempts.delete(item);
        this.clearPendingTimer(item);
      }
    }

    if (this.queue.size) {
      this.schedule();
    }
  }

  private takeBatch(): HTMLElement[] {
    const priority: HTMLElement[] = [];
    const deferred: HTMLElement[] = [];

    for (const item of this.queue) {
      const info = getViewportInfo(item, NEAR_VIEWPORT_MARGIN);
      if (info.isNearViewport) {
        priority.push(item);
      } else {
        deferred.push(item);
      }
    }

    const batch = [...priority, ...deferred].slice(0, MAX_ITEMS_PER_FRAME);
    for (const item of batch) {
      this.queue.delete(item);
    }

    return batch;
  }

  private schedulePendingRetry(item: HTMLElement): void {
    if (!item.isConnected || this.pendingTimers.has(item)) {
      return;
    }

    const attempt = this.pendingAttempts.get(item) || 0;
    if (attempt >= PENDING_RETRY_DELAYS.length) {
      this.pendingAttempts.delete(item);
      this.options.onPendingExpired?.(item);
      return;
    }

    const delay = PENDING_RETRY_DELAYS[Math.min(attempt, PENDING_RETRY_DELAYS.length - 1)];

    this.pendingAttempts.set(item, attempt + 1);
    const timer = window.setTimeout(() => {
      this.pendingTimers.delete(item);
      if (item.isConnected) {
        this.enqueue(item);
      }
    }, delay);

    this.pendingTimers.set(item, timer);
  }

  private clearPendingTimer(item: HTMLElement): void {
    const timer = this.pendingTimers.get(item);
    if (timer === undefined) {
      return;
    }

    window.clearTimeout(timer);
    this.pendingTimers.delete(item);
  }
}
