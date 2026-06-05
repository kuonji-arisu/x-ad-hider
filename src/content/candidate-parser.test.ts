import { describe, expect, it } from "vitest";
import { parseTimelineItem } from "./candidate-parser.js";

function cell(innerHtml: string): HTMLElement {
  document.body.innerHTML = `<div data-testid="cellInnerDiv">${innerHtml}</div>`;
  return document.querySelector<HTMLElement>('[data-testid="cellInnerDiv"]')!;
}

describe("parseTimelineItem", () => {
  it("parses a ready timeline item", () => {
    const result = parseTimelineItem(cell(`
      <article>
        <div data-testid="User-Name">Alice <span>@alice</span></div>
        <a href="/alice/status/123">time</a>
        <div data-testid="tweetText">hello <img alt="🔥" src="emoji.png"> world</div>
      </article>
    `));

    expect(result).toMatchObject({
      status: "ready",
      candidate: {
        handle: "alice",
        usernameText: "alice Alice @alice",
        text: "hello 🔥 world",
        tweetUrl: "https://x.com/alice/status/123",
        pageUrl: "https://x.com/home"
      }
    });
    expect(result.status === "ready" ? result.signature : "").toContain("alice");
  });

  it("supports absolute X and Twitter status URLs", () => {
    expect(parseTimelineItem(cell(`
      <article>
        <div data-testid="User-Name">Bob @bob</div>
        <a href="https://twitter.com/bob/status/456">time</a>
        <div data-testid="tweetText">hello</div>
      </article>
    `))).toMatchObject({
      status: "ready",
      candidate: {
        handle: "bob",
        tweetUrl: "https://twitter.com/bob/status/456"
      }
    });
  });

  it("returns ignored when the cell has no article", () => {
    expect(parseTimelineItem(cell("<div>not a tweet</div>"))).toEqual({
      status: "ignored"
    });
  });

  it("returns pending while handle is not ready", () => {
    expect(parseTimelineItem(cell(`
      <article>
        <div data-testid="User-Name">Home</div>
        <a href="/home">home</a>
        <div data-testid="tweetText">hello</div>
      </article>
    `))).toEqual({ status: "pending" });
  });

  it("can parse a handle-only item for username matching", () => {
    expect(parseTimelineItem(cell(`
      <article>
        <a href="/alice/status/123">time</a>
      </article>
    `))).toMatchObject({
      status: "ready",
      candidate: {
        handle: "alice",
        usernameText: "alice",
        text: "",
        tweetUrl: "https://x.com/alice/status/123"
      }
    });
  });

  it("only reads elements belonging to the current article", () => {
    const result = parseTimelineItem(cell(`
      <article>
        <div data-testid="User-Name">Alice @alice</div>
        <a href="/alice/status/123">time</a>
        <div data-testid="tweetText">parent text</div>
        <article>
          <div data-testid="User-Name">Mallory @mallory</div>
          <a href="/mallory/status/999">time</a>
          <div data-testid="tweetText">nested text</div>
        </article>
      </article>
    `));

    expect(result).toMatchObject({
      status: "ready",
      candidate: {
        handle: "alice",
        text: "parent text",
        tweetUrl: "https://x.com/alice/status/123"
      }
    });
  });

  it("changes the signature when candidate content changes", () => {
    const first = parseTimelineItem(cell(`
      <article>
        <div data-testid="User-Name">Alice @alice</div>
        <a href="/alice/status/123">time</a>
        <div data-testid="tweetText">first text</div>
      </article>
    `));
    const second = parseTimelineItem(cell(`
      <article>
        <div data-testid="User-Name">Alice @alice</div>
        <a href="/alice/status/123">time</a>
        <div data-testid="tweetText">second text</div>
      </article>
    `));

    expect(first.status === "ready" ? first.signature : "").not.toBe(
      second.status === "ready" ? second.signature : ""
    );
  });
});
