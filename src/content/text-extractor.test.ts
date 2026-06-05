import { describe, expect, it } from "vitest";
import { compactText, extractNodeText } from "./text-extractor.js";

function element(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe("extractNodeText", () => {
  it("extracts and compacts nested text", () => {
    expect(extractNodeText(element(`
      <div>
        hello
        <span>world</span>
      </div>
    `))).toBe("hello world");
  });

  it("preserves emoji and other img alt text", () => {
    expect(extractNodeText(element(`
      <div>gm <img alt="🔥" src="emoji.png"> crew</div>
    `))).toBe("gm 🔥 crew");
  });

  it("ignores script, style, and svg content", () => {
    expect(extractNodeText(element(`
      <div>
        visible
        <script>hiddenScript()</script>
        <style>.hidden { color: red; }</style>
        <svg><text>hidden svg</text></svg>
      </div>
    `))).toBe("visible");
  });

  it("handles empty roots and compactText directly", () => {
    expect(extractNodeText(null)).toBe("");
    expect(compactText(" a \n  b\t c ")).toBe("a b c");
  });
});
