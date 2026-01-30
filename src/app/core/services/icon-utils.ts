const ICON_ALIASES: Record<string, string> = {
  home: 'house',
  tree: 'trees',
  window: 'app-window',
  windows: 'app-window',
  tool: 'toolbox',
  tools: 'toolbox',
};

/**
 * Normalize icon names returned from the backend so they match the registered lucide icon names.
 */
export function normalizeIconName(value?: string | null): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === '') {
    return null;
  }

  return ICON_ALIASES[trimmed] ?? trimmed;
}
