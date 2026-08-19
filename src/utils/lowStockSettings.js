// src/utils/lowStockSettings.js
//
// Lets the user choose what quantity counts as "low stock" instead of the
// hardcoded fallback of 20 units. A medicine's own reorderLevel (if set on
// that document) always wins - this is only the fallback used when a
// medicine doesn't specify its own reorder level.

const STORAGE_KEY = "lowStockThreshold";
export const DEFAULT_LOW_STOCK_THRESHOLD = 20;

export function getLowStockThreshold() {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_LOW_STOCK_THRESHOLD;
}

export function saveLowStockThreshold(value) {
  const clamped = Math.max(1, Math.round(Number(value) || DEFAULT_LOW_STOCK_THRESHOLD));
  localStorage.setItem(STORAGE_KEY, String(clamped));
  return clamped;
}