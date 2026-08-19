// src/utils/alertSettings.js
//
// Personal (per-browser) preferences for how aggressively inventory
// notifications should surface. Kept in localStorage rather than Firestore
// because this is "how loud should this be for me", not shared pharmacy
// data - each pharmacist can tune it differently.

const STORAGE_KEY = "inventoryAlertSettings";
const SETTINGS_EVENT = "inventoryAlertSettingsChanged";

export const DEFAULT_ALERT_SETTINGS = {
  enabled: true, // master switch - off hides all inventory notifications, reminders stay on
  thresholdDays: 30, // surface a "near expiry" notification only at N days or fewer
  mode: "all", // "all" | "selected"
  selectedMedicineIds: [],
};

export function getAlertSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_ALERT_SETTINGS, ...(stored || {}) };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

export function saveAlertSettings(partial) {
  const merged = { ...getAlertSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  return merged;
}

// Lets any mounted component (bell, alerts page) react instantly when
// settings are saved elsewhere, without waiting for the next Firestore poll.
export function onAlertSettingsChanged(callback) {
  window.addEventListener(SETTINGS_EVENT, callback);
  return () => window.removeEventListener(SETTINGS_EVENT, callback);
}