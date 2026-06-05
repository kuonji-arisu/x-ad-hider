const TIMELINE_ITEM_SELECTOR = '[data-testid="cellInnerDiv"]';

export function getTimelineItem(article: Element): Element | null {
  return article.closest(TIMELINE_ITEM_SELECTOR);
}
