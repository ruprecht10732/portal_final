import { type Condition } from '../flow-builder.types';

/**
 * Evaluates a condition against a draft state object.
 * Returns `true` when `condition` is `null` (unconditionally visible).
 * Ported from offerte-wizard flow-condition-evaluator.ts.
 */
export function evaluateCondition(
  condition: Condition | null,
  draft: Record<string, unknown>,
): boolean {
  if (condition === null) {
    return true;
  }

  switch (condition.op) {
    case 'truthy':
      return isTruthy(draft[condition.field]);

    case 'falsy':
      return !isTruthy(draft[condition.field]);

    case 'eq':
      return draft[condition.field] === condition.value;

    case 'neq':
      return draft[condition.field] !== condition.value;

    case 'in':
      return condition.values.includes(draft[condition.field]);

    case 'not_in':
      return !condition.values.includes(draft[condition.field]);

    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, draft));

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, draft));

    case 'not':
      return !evaluateCondition(condition.condition, draft);
  }
}

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === false) {
    return false;
  }
  return true;
}
