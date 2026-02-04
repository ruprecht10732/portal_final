const quoteString = (value: string): string => JSON.stringify(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const stringifyPrimitive = (value: unknown): string | undefined => {
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
      return undefined;
  }
};

const stringifyArray = (value: unknown[], seen: Set<unknown>): string => {
  const items = value.map((item) => stringifyValue(item, seen));
  return `[${items.join(",")}]`;
};

const stringifyRecord = (record: Record<string, unknown>, seen: Set<unknown>): string => {
  const entries = Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => {
      const entryValue = stringifyValue(record[key], seen);
      return `${quoteString(key)}:${entryValue}`;
    });

  return `{${entries.join(",")}}`;
};

const stringifyObject = (value: object, seen: Set<unknown>): string => {
  if (seen.has(value)) {
    return quoteString("[Circular]");
  }
  seen.add(value);

  if (!isPlainObject(value)) {
    seen.delete(value);
    return quoteString(Object.prototype.toString.call(value));
  }

  const result = stringifyRecord(value, seen);
  seen.delete(value);
  return result;
};

const stringifyValue = (value: unknown, seen: Set<unknown>): string => {
  const primitive = stringifyPrimitive(value);
  if (primitive !== undefined) return primitive;

  if (value instanceof Date) {
    return quoteString(value.toISOString());
  }

  if (Array.isArray(value)) {
    return stringifyArray(value, seen);
  }

  if (value && typeof value === "object") {
    return stringifyObject(value, seen);
  }

  return "null";
};

export const stableStringify = (value: unknown): string => stringifyValue(value, new Set());
