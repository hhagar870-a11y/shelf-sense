import React, { useEffect, useState } from "react";
import { Snackbar, Alert, Button, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

/* ============================================================
   DailyExpiryAlert — mount this ONCE near the top of App.jsx
   (outside the <Routes>, so it survives page changes) and it
   will show, at most once per day, a summary of how many
   medicines are expired / near expiry.

   Example in App.jsx:
     import DailyExpiryAlert from "./components/DailyExpiryAlert";
     ...
     return (
       <>
         <DailyExpiryAlert />
         <Routes> ... </Routes>
       </>
     );
   ============================================================ */

// Same thresholds as Inventory.jsx / LabelPrinting.jsx
function getStatus(expiry) {
  if (!expiry) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(23, 59, 59, 999);
  const nearExpiryThreshold = new Date(expiryDate);
  nearExpiryThreshold.setMonth(nearExpiryThreshold.getMonth() - 3);
  nearExpiryThreshold.setHours(0, 0, 0, 0);
  if (today > expiryDate) return "Expired";
  if (today >= nearExpiryThreshold) return "Near Expiry";
  return "Safe";
}

function loadMedicines() {
  try {
    const saved = localStorage.getItem("medicines");
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((m) => !m.isSection) : [];
  } catch {
    return [];
  }
}

const LAST_SHOWN_KEY = "lastExpiryAlertDate";

export default function DailyExpiryAlert() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ expired: 0, nearExpiry: 0 });
  const [notifSupported, setNotifSupported] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const medicines = loadMedicines();
    let expired = 0;
    let nearExpiry = 0;
    medicines.forEach((med) => {
      const dates = med.expiryDates?.length ? med.expiryDates : [med.expiry];
      dates.forEach((d) => {
        const s = getStatus(d);
        if (s === "Expired") expired++;
        else if (s === "Near Expiry") nearExpiry++;
      });
    });
    setCounts({ expired, nearExpiry });
    setNotifSupported(typeof window !== "undefined" && "Notification" in window);

    const todayStr = new Date().toDateString();
    const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
    if (lastShown !== todayStr && (expired > 0 || nearExpiry > 0)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(LAST_SHOWN_KEY, new Date().toDateString());
    setOpen(false);
  }

  function reviewNow() {
    dismiss();
    navigate("/inventory");
  }

  function enableSystemNotifications() {
    if (!notifSupported) return;
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        new Notification("Shelf Sense", {
          body: `${counts.expired} expired · ${counts.nearExpiry} near expiry. Tap to review.`,
        });
      }
    });
  }

  if (counts.expired === 0 && counts.nearExpiry === 0) return null;

  const parts = [];
  if (counts.expired > 0) parts.push(`${counts.expired} expired`);
  if (counts.nearExpiry > 0) parts.push(`${counts.nearExpiry} near expiry`);

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      onClose={dismiss}
      sx={{ mt: 1 }}
    >
      <Alert
        severity={counts.expired > 0 ? "error" : "warning"}
        onClose={dismiss}
        sx={{ alignItems: "center", boxShadow: 3 }}
        action={
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {notifSupported && Notification.permission === "default" && (
              <Button size="small" color="inherit" onClick={enableSystemNotifications}>
                Enable notifications
              </Button>
            )}
            <Button size="small" color="inherit" variant="outlined" onClick={reviewNow}>
              Review
            </Button>
          </Box>
        }
      >
        {parts.join(" · ")} — check your inventory today.
      </Alert>
    </Snackbar>
  );
}