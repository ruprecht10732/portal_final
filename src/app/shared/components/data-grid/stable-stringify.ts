const quoteString = (value: string): string => JSON.stringify(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const stringifyValue = (value: unknown, seen: Set<unknown>): string => {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return quoteString(value);
    case "number":
      return Number.isFinite(value) ? String(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "bigint":
      return quoteString(value.toString());
    case "symbol":
    case "function":
    case "undefined":
      return "null";
    default:
      break;
  }

  if (value instanceof Date) {
    return quoteString(value.toISOString());
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stringifyValue(item, seen));
    return `[${items.join(",")}]`;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return quoteString("[Circular]");
    }
    seen.add(value);

    if (!isPlainObject(value)) {
      return quoteString(Object.prototype.toString.call(value));
    }

    const record = value;
    const entries = Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => {
        const entryValue = stringifyValue(record[key], seen);
        return `${quoteString(key)}:${entryValue}`;
      });

    seen.delete(value);
    return `{${entries.join(",")}}`;
  }

  return "null";
};

export const stableStringify = (value: unknown): string => stringifyValue(value, new Set());
