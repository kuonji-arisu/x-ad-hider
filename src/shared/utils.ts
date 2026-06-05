export function normalizeHandle(handle: unknown): string {
  if (!handle) {
    return "";
  }

  return String(handle).trim().replace(/^@+/, "").toLowerCase();
}

export function displayHandle(handle: unknown): string {
  const normalized = normalizeHandle(handle);
  return normalized ? `@${normalized}` : "";
}

export function normalizeKeyword(keyword: unknown): string {
  return String(keyword || "").trim().toLowerCase();
}

export function uniqueCleanList(
  values: unknown[] = [],
  normalizer: (value: unknown) => string = (value) => String(value || "").trim()
): string[] {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const normalized = normalizer(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function textSample(text: unknown, maxLength: number): string {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}...`;
}

export function serializeError(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  return error instanceof Error ? error.message : String(error);
}
