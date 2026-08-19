// src/hooks/useInventoryAlerts.js
//
// Mirrors the exact medicine-loading pattern already used in Dashboard.jsx:
// getDocs (not onSnapshot) + a module-level cache to avoid a blank loading
// screen, with a light periodic background refresh (every 3 minutes) so the
// bell picks up inventory changes without keeping a permanent listener open
// on the collection.
//
// Alert visibility is filtered through the user's personal notification
// preferences (see utils/alertSettings.js): a master on/off switch, a
// "notify me at N days or fewer" threshold, and an optional per-medicine
// allow-list.

import { useEffect, useState, useCallback, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { getAlertSettings, onAlertSettingsChanged } from "../utils/alertSettings";

const LABEL_THRESHOLD_DAYS = 10; // medicines with 10 days or less left need a printed label

const REFRESH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes - same spirit as the Dashboard cache

let medicinesCache = null; // shared across every screen using this hook

function getDaysRemaining(expiry) {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return Math.round((expiryDate - today) / (1000 * 60 * 60 * 24));
}

function getStatus(expiry) {
  const days = getDaysRemaining(expiry);
  if (days === null) return "";
  if (days < 0) return "Expired";
  if (days <= 90) return "Near Expiry";
  return "Safe";
}

function computeAlerts(medicines, settings) {
  if (!settings.enabled) return [];

  const list = [];
  const restrictToSelected = settings.mode === "selected";
  const selectedSet = new Set(settings.selectedMedicineIds || []);

  medicines
    .filter((m) => !m.isSection) // same filter as realMedicines in Dashboard.jsx
    .filter((m) => !restrictToSelected || selectedSet.has(m.id))
    .forEach((med) => {
      const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];

      dates.forEach((expiry) => {
        if (!expiry) return;
        const status = getStatus(expiry);
        const daysRemaining = getDaysRemaining(expiry);
        if (!status) return;

        // Expired items always surface; "near expiry" only within the
        // user's chosen threshold, so a 90-day-out item doesn't flood
        // notifications unless they actually want that much lead time.
        const shouldSurface =
          status === "Expired" || (status === "Near Expiry" && daysRemaining <= settings.thresholdDays);

        if (shouldSurface) {
          list.push({
            id: `${med.id}-${expiry}`,
            medicineId: med.id,
            name: med.name,
            category: med.category,
            expiry,
            status,
            daysRemaining,
            kind: "expiry",
          });
        }

        if (
          daysRemaining !== null &&
          daysRemaining >= 0 &&
          daysRemaining <= LABEL_THRESHOLD_DAYS &&
          !med.labelPrinted
        ) {
          list.push({
            id: `${med.id}-${expiry}-label`,
            medicineId: med.id,
            name: med.name,
            category: med.category,
            expiry,
            daysRemaining,
            kind: "label",
          });
        }
      });
    });

  list.sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
  return list;
}

function extractMedicineOptions(medicines) {
  return medicines
    .filter((m) => !m.isSection)
    .map((m) => ({ id: m.id, name: m.name }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export default function useInventoryAlerts() {
  const [alerts, setAlerts] = useState(() =>
    medicinesCache ? computeAlerts(medicinesCache, getAlertSettings()) : []
  );
  const [allMedicines, setAllMedicines] = useState(() =>
    medicinesCache ? extractMedicineOptions(medicinesCache) : []
  );
  const [loading, setLoading] = useState(!medicinesCache);
  const isMounted = useRef(true);

  const recompute = useCallback(() => {
    if (medicinesCache) {
      setAlerts(computeAlerts(medicinesCache, getAlertSettings()));
      setAllMedicines(extractMedicineOptions(medicinesCache));
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "medicines"));
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      medicinesCache = list;
      if (isMounted.current) {
        setAlerts(computeAlerts(list, getAlertSettings()));
        setAllMedicines(extractMedicineOptions(list));
      }
    } catch (err) {
      console.error("Failed to load inventory alerts from Firestore:", err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    refresh();

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    // Recompute instantly (no refetch needed) when settings change elsewhere
    const unsubscribeSettings = onAlertSettingsChanged(recompute);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      unsubscribeSettings();
    };
  }, [refresh, recompute]);

  const expired = alerts.filter((a) => a.kind === "expiry" && a.status === "Expired");
  const nearExpiry = alerts.filter((a) => a.kind === "expiry" && a.status === "Near Expiry");
  const needsLabel = alerts.filter((a) => a.kind === "label");

  return { alerts, expired, nearExpiry, needsLabel, allMedicines, loading, refresh };
}