import { MESSAGE_TYPES } from "../shared/constants.js";
import type { RuntimeMessage } from "../shared/types.js";
import { getTimelineItem } from "./timeline-adapter.js";

(function () {
  type CandidateResponse = {
    action?: "hide" | "skip";
    matchedKeyword?: string;
  };

  type TweetCandidate = {
    handle: string;
    usernameText: string;
    text: string;
    tweetUrl: string;
    pageUrl: string;
  };

  type XAnchorInfo = {
    handle: string;
    isStatusLink: boolean;
  };

  const VALID_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
  const IGNORED_PATHS = new Set([
    "home",
    "explore",
    "notifications",
    "messages",
    "i",
    "settings",
    "search",
    "compose",
    "privacy",
    "tos"
  ]);

  const checkedArticles = new WeakSet();
  const hiddenClass = "x-ad-hider-hidden";
  let scanTimer: number | null = null;

  injectStyles();
  scheduleScan();
  observePage();

  function observePage() {
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function scheduleScan() {
    if (scanTimer) {
      return;
    }

    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      scanArticles();
    }, 250);
  }

  function scanArticles() {
    const articles = document.querySelectorAll("article");
    for (const article of articles) {
      inspectArticle(article);
    }
  }

  async function inspectArticle(article: HTMLElement): Promise<void> {
    if (checkedArticles.has(article) || article.classList.contains(hiddenClass)) {
      return;
    }

    checkedArticles.add(article);
    const candidate = parseTweetCandidate(article);
    if (!candidate) {
      return;
    }

    try {
      const response = await sendMessage<CandidateResponse>({
        type: MESSAGE_TYPES.CANDIDATE_DETECTED,
        payload: candidate
      });

      if (response?.action === "hide") {
        hideTimelineItemForArticle(article, response);
      }
    } catch (error) {
      console.warn("[X Ad Hider] Candidate handling failed", error);
    }
  }

  function parseTweetCandidate(article: HTMLElement): TweetCandidate | null {
    const handle = extractHandle(article);
    if (!handle) {
      return null;
    }

    const text = extractArticleText(article);
    if (!text.trim()) {
      return null;
    }

    return {
      handle,
      usernameText: extractUsernameText(article, handle),
      text,
      tweetUrl: extractTweetUrl(article),
      pageUrl: location.href
    };
  }

  function extractUsernameText(article: HTMLElement, handle: string): string {
    const userNameElement = article.querySelector('[data-testid="User-Name"]');
    const userNameText = userNameElement ? extractNodeText(userNameElement) : "";
    return `${handle} ${userNameText}`.trim();
  }

  function extractArticleText(article: HTMLElement): string {
    return extractNodeText(article);
  }

  function extractNodeText(root: Node | null): string {
    if (!root) {
      return "";
    }

    const parts = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.matches("script, style, svg")) {
              return NodeFilter.FILTER_REJECT;
            }

            if (element.tagName === "IMG" && element.getAttribute("alt")) {
              return NodeFilter.FILTER_ACCEPT;
            }

            return NodeFilter.FILTER_SKIP;
          }

          return node.nodeValue?.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      }
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "IMG") {
        parts.push((node as HTMLImageElement).getAttribute("alt") || "");
      } else {
        parts.push(node.nodeValue || "");
      }
    }

    return parts.join("").replace(/\s+/g, " ").trim();
  }

  function extractHandle(article: HTMLElement): string {
    const anchors = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]'));
    const statusHandle = findHandleFromAnchors(anchors, true);
    if (statusHandle) {
      return statusHandle;
    }

    return findHandleFromAnchors(anchors, false);
  }

  function findHandleFromAnchors(anchors: HTMLAnchorElement[], requireStatusLink: boolean): string {
    for (const anchor of anchors) {
      const info = parseXAnchor(anchor);
      if (!info) {
        continue;
      }

      if (requireStatusLink && !info.isStatusLink) {
        continue;
      }

      return info.handle;
    }

    return "";
  }

  function parseXAnchor(anchor: HTMLAnchorElement): XAnchorInfo | null {
    let url: URL;
    try {
      const href = anchor.getAttribute("href");
      if (!href) {
        return null;
      }

      url = new URL(href, location.origin);
    } catch {
      return null;
    }

    if (!["x.com", "twitter.com", location.hostname].includes(url.hostname)) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const handle = parts[0] || "";
    if (!VALID_HANDLE.test(handle) || IGNORED_PATHS.has(handle.toLowerCase())) {
      return null;
    }

    return {
      handle,
      isStatusLink: parts[1] === "status"
    };
  }

  function extractTweetUrl(article: HTMLElement): string {
    for (const anchor of article.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const href = anchor.getAttribute("href") || "";
      if (parseXAnchor(anchor) && /\/status\/\d+/.test(href)) {
        return new URL(href, location.origin).toString();
      }
    }

    return "";
  }

  function hideTimelineItemForArticle(article: HTMLElement, response: CandidateResponse): void {
    const timelineItem = getTimelineItem(article);
    if (!timelineItem) {
      return;
    }

    timelineItem.classList.add(hiddenClass);
    timelineItem.setAttribute("data-x-ad-hider-keyword", response.matchedKeyword || "");
  }

  function injectStyles() {
    if (document.getElementById("x-ad-hider-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "x-ad-hider-style";
    style.textContent = `
      .${hiddenClass} {
        display: none !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function sendMessage<T>(message: RuntimeMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (rawResponse) => {
        const response = rawResponse as { ok?: boolean; payload?: T; error?: string } | undefined;
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Background message failed"));
          return;
        }

        resolve(response.payload as T);
      });
    });
  }
})();
