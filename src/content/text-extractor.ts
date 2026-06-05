export function extractNodeText(root: Node | null): string {
  if (!root) {
    return "";
  }

  const parts: string[] = [];
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
      continue;
    }

    parts.push(node.nodeValue || "");
  }

  return compactText(parts.join(""));
}

export function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
