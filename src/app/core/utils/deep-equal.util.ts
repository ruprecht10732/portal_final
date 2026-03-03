/**
 * Deep equality utility
 * Performs a deep comparison of two values
 */

/**
 * Checks if two values are deeply equal
 * Handles objects, arrays, primitives, and null/undefined
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!areComparableObjects(a, b)) return false;
  return Array.isArray(a) ? deepEqualArrays(a, b as unknown[]) : deepEqualObjects(a, b);
}

function areComparableObjects(a: unknown, b: unknown): boolean {
  if (!isObjectLike(a) || !isObjectLike(b)) return false;
  return Array.isArray(a) === Array.isArray(b);
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function deepEqualArrays(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => deepEqual(val, b[i]));
}

function deepEqualObjects(a: unknown, b: unknown): boolean {
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => key in objB && deepEqual(objA[key], objB[key]));
}