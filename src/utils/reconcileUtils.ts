/**
 * Smart array reconciliation helper for SolidJS stores/signals.
 * Performs fine-grained reconciliation by comparing items by unique ID.
 * Returns the existing array reference if no changes occurred, or a updated array
 * retaining unchanged object references to prevent unnecessary DOM re-renders.
 */
export function reconcileById<T extends { id: string }>(current: T[], incoming: T[], tag: string = 'unknown'): T[] {
  if (!incoming) return current || [];
  if (!current || current.length === 0) {
    return incoming;
  }

  const currentMap = new Map<string, T>();
  for (const item of current) {
    if (item && item.id) {
      currentMap.set(item.id, item);
    }
  }

  let hasChanged = current.length !== incoming.length;
  let changedCount = 0;
  const result: T[] = [];

  for (const newObj of incoming) {
    if (!newObj || !newObj.id) continue;
    const oldObj = currentMap.get(newObj.id);

    if (!oldObj) {
      hasChanged = true;
      changedCount++;
      result.push(newObj);
    } else {
      if (JSON.stringify(oldObj) === JSON.stringify(newObj)) {
        result.push(oldObj);
      } else {
        hasChanged = true;
        changedCount++;
        result.push(newObj);
      }
    }
  }

  if (hasChanged) {
    return result;
  } else {
    return current;
  }
}
