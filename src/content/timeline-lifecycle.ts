import { ObserverManager } from "./observer-manager.js";
import { queryTimelineItems } from "./timeline-adapter.js";

export type TimelineMount = {
  container: HTMLElement;
};

type TimelineMountListener = (mount: TimelineMount) => void;
type TimelineUnmountListener = () => void;

const MAIN_SELECTOR = "main";
const DISCOVERY_DELAY_MS = 80;

export class TimelineLifecycle {
  private currentContainer: HTMLElement | null = null;
  private discoveryTimer: number | null = null;

  constructor(
    private readonly observers: ObserverManager,
    private readonly onMount: TimelineMountListener,
    private readonly onUnmount: TimelineUnmountListener = () => undefined
  ) {}

  start(): void {
    this.observers.observe(document.body, {
      scope: "page",
      name: "timeline-discovery",
      childList: true,
      subtree: true
    }, (mutations) => this.handlePageMutations(mutations));

    this.discoverNow();
  }

  discoverNow(): void {
    if (this.discoveryTimer !== null) {
      window.clearTimeout(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    const mount = findTimelineMount();
    if (!mount) {
      this.unmountCurrentTimeline();
      return;
    }

    if (this.currentContainer === mount.container && mount.container.isConnected) {
      return;
    }

    this.currentContainer = mount.container;
    this.onMount(mount);
  }

  getCurrentContainer(): HTMLElement | null {
    return this.currentContainer?.isConnected ? this.currentContainer : null;
  }

  private scheduleDiscovery(): void {
    if (this.discoveryTimer !== null) {
      return;
    }

    this.discoveryTimer = window.setTimeout(() => this.discoverNow(), DISCOVERY_DELAY_MS);
  }

  private handlePageMutations(mutations: MutationRecord[]): void {
    const currentContainer = this.getCurrentContainer();
    if (currentContainer && mutations.every((mutation) => isTimelineInternalMutation(mutation, currentContainer))) {
      return;
    }

    this.scheduleDiscovery();
  }

  private unmountCurrentTimeline(): void {
    if (!this.currentContainer) {
      return;
    }

    this.currentContainer = null;
    this.observers.disconnectScope("timeline");
    this.onUnmount();
  }
}

function isTimelineInternalMutation(mutation: MutationRecord, currentContainer: HTMLElement): boolean {
  if (isNodeInside(mutation.target, currentContainer)) {
    return true;
  }

  if (!mutation.addedNodes.length) {
    return false;
  }

  return Array.from(mutation.addedNodes).every((node) => isNodeInside(node, currentContainer));
}

function isNodeInside(node: Node, container: HTMLElement): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element && container.contains(element));
}

function findTimelineMount(): TimelineMount | null {
  const root = document.querySelector<HTMLElement>(MAIN_SELECTOR);
  if (!root) {
    return null;
  }

  const items = queryTimelineItems(root);
  if (!items.length) {
    return null;
  }

  return {
    container: findSharedContainer(root, items)
  };
}

function findSharedContainer(root: HTMLElement, items: HTMLElement[]): HTMLElement {
  let container = items[0]?.parentElement || root;

  while (container && container !== root && !items.every((item) => container.contains(item))) {
    const parent = container.parentElement;
    if (!parent) {
      return root;
    }

    container = parent;
  }

  return container;
}
