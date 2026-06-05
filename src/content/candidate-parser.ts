import type { TweetCandidate } from "../shared/types.js";
import { textSample } from "../shared/utils.js";
import { getTimelineArticle } from "./timeline-adapter.js";
import { extractNodeText } from "./text-extractor.js";

export type CandidateParseResult =
  | {
      status: "ready";
      candidate: TweetCandidate;
      signature: string;
    }
  | { status: "pending" }
  | { status: "ignored" };

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

export function parseTimelineItem(item: HTMLElement): CandidateParseResult {
  const article = getTimelineArticle(item);
  if (!article) {
    return { status: "ignored" };
  }

  const handle = extractHandle(article);
  if (!handle) {
    return { status: "pending" };
  }

  const usernameText = extractUsernameText(article, handle);
  const text = extractTweetText(article);
  if (!usernameText && !text) {
    return { status: "pending" };
  }

  const candidate = {
    handle,
    usernameText,
    text,
    tweetUrl: extractTweetUrl(article),
    pageUrl: location.href
  };

  return {
    status: "ready",
    candidate,
    signature: buildSignature(candidate)
  };
}

function extractUsernameText(article: HTMLElement, handle: string): string {
  const userNameElement = findCurrentArticleElement(article, '[data-testid="User-Name"]');
  const userNameText = userNameElement ? extractNodeText(userNameElement) : "";
  return `${handle} ${userNameText}`.trim();
}

function extractTweetText(article: HTMLElement): string {
  const tweetTextElements = findCurrentArticleElements(article, '[data-testid="tweetText"]');
  if (!tweetTextElements.length) {
    return "";
  }

  return Array.from(tweetTextElements)
    .map((element) => extractNodeText(element))
    .filter(Boolean)
    .join(" ");
}

function extractHandle(article: HTMLElement): string {
  const anchors = findCurrentArticleElements<HTMLAnchorElement>(article, 'a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]');
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
  for (const anchor of findCurrentArticleElements<HTMLAnchorElement>(article, "a[href]")) {
    const href = anchor.getAttribute("href") || "";
    if (parseXAnchor(anchor) && /\/status\/\d+/.test(href)) {
      return new URL(href, location.origin).toString();
    }
  }

  return "";
}

function findCurrentArticleElement<T extends Element>(article: HTMLElement, selector: string): T | null {
  return findCurrentArticleElements<T>(article, selector)[0] || null;
}

function findCurrentArticleElements<T extends Element>(article: HTMLElement, selector: string): T[] {
  return Array.from(article.querySelectorAll<T>(selector))
    .filter((element) => element.closest("article") === article);
}

function buildSignature(candidate: TweetCandidate): string {
  return [
    candidate.handle,
    candidate.tweetUrl || "",
    candidate.usernameText,
    textSample(candidate.text, 360)
  ].join("\u0001");
}
