import { describe, expect, it } from "vitest";
import {
  getTimelineArticle,
  getTimelineItemsFromMutations,
  queryTimelineItems
} from "./timeline-adapter.js";

describe("timeline adapter", () => {
  it("finds timeline cells from a root or when the root is itself a cell", () => {
    document.body.innerHTML = `
      <main>
        <div data-testid="cellInnerDiv"><article>one</article></div>
        <section>
          <div data-testid="cellInnerDiv"><article>two</article></div>
        </section>
      </main>
    `;

    const root = document.querySelector("main")!;
    const items = queryTimelineItems(root);

    expect(items).toHaveLength(2);
    expect(queryTimelineItems(items[0])).toEqual([items[0]]);
    expect(getTimelineArticle(items[0])?.textContent).toBe("one");
  });

  it("extracts directly and indirectly added cells from mutations", () => {
    const target = document.createElement("div");
    const direct = document.createElement("div");
    direct.setAttribute("data-testid", "cellInnerDiv");

    const wrapper = document.createElement("section");
    const nested = document.createElement("div");
    nested.setAttribute("data-testid", "cellInnerDiv");
    wrapper.append(nested);
    const addedNodes = document.createDocumentFragment();
    addedNodes.append(direct, wrapper);
    const removedNodes = document.createDocumentFragment();

    const mutations = [{
      target,
      addedNodes: addedNodes.childNodes,
      removedNodes: removedNodes.childNodes,
      type: "childList",
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      oldValue: null,
      previousSibling: null
    } satisfies MutationRecord];

    expect(getTimelineItemsFromMutations(mutations)).toEqual([direct, nested]);
  });
});
