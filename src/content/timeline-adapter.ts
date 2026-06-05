const TIMELINE_ITEM_SELECTOR = '[data-testid="cellInnerDiv"]';
const ARTICLE_SELECTOR = "article";

export type ViewportInfo = {
  top: number;
  bottom: number;
  height: number;
  isAboveViewport: boolean;
  isNearViewport: boolean;
};

export function queryTimelineItems(root: Node | ParentNode = document): HTMLElement[] {
  const items = new Set<HTMLElement>();

  if (root instanceof Element) {
    if (root.matches(TIMELINE_ITEM_SELECTOR)) {
      items.add(root as HTMLElement);
    }

    for (const item of root.querySelectorAll<HTMLElement>(TIMELINE_ITEM_SELECTOR)) {
      items.add(item);
    }
  } else if ("querySelectorAll" in root) {
    for (const item of root.querySelectorAll<HTMLElement>(TIMELINE_ITEM_SELECTOR)) {
      items.add(item);
    }
  }

  return Array.from(items);
}

export function getTimelineItemsFromMutations(mutations: MutationRecord[]): HTMLElement[] {
  const items = new Set<HTMLElement>();

  for (const mutation of mutations) {
    const targetItem = findTimelineItem(mutation.target);
    if (targetItem) {
      items.add(targetItem);
    }

    for (const node of mutation.addedNodes) {
      const directItem = findTimelineItem(node);
      if (directItem) {
        items.add(directItem);
      }

      for (const item of queryTimelineItems(node)) {
        items.add(item);
      }
    }
  }

  return Array.from(items);
}

export function getTimelineArticle(item: Element): HTMLElement | null {
  return item.querySelector<HTMLElement>(ARTICLE_SELECTOR);
}

export function getViewportInfo(element: Element, margin = 0): ViewportInfo {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return {
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    isAboveViewport: rect.bottom <= 0,
    isNearViewport: rect.bottom > -margin && rect.top < viewportHeight + margin
  };
}

function findTimelineItem(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) {
    return null;
  }

  if (element.matches(TIMELINE_ITEM_SELECTOR)) {
    return element as HTMLElement;
  }

  return element.closest<HTMLElement>(TIMELINE_ITEM_SELECTOR);
}
