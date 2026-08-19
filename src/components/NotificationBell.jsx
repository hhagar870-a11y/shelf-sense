// src/components/NotificationBell.jsx
//
// Fixed notification bell, mounted only inside Dashboard.jsx. Auto-opens when
// a new inventory alert or due reminder appears, plays a short tone for
// reminders, and lets the user snooze/close individual items or clear all
// inventory notifications at once.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  IconButton,
  Popover,
  Box,
  Typography,
  Stack,
  Button,
  Divider,
  Menu,
  MenuItem,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PrintIcon from "@mui/icons-material/Print";
import AlarmIcon from "@mui/icons-material/Alarm";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate } from "react-router-dom";

import useInventoryAlerts from "../hooks/useInventoryAlerts";
import { subscribeReminders, markReminderDone, snoozeReminder, snoozeOptions } from "../services/reminders";
import { playReminderBeep } from "../utils/beep";
import { colors, radii, shadow, iconBadgeSx } from "../utils/brandTokens";
import AlertSettingsDialog from "./AlertSettingsDialog";

const SEEN_KEY = "seenAlertIds"; // local UI state only, not business data
const DISMISSED_KEY = "dismissedAlertIds"; // { [id]: dismissedAtISODate }

function loadSeenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(set) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
}

// Dismissals persist across page navigation, but only for the current day -
// so closing an expired-medicine alert today doesn't hide it forever.
function loadDismissedToday() {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY)) || {};
    const todayStr = new Date().toDateString();
    const stillValid = {};
    Object.entries(stored).forEach(([id, dismissedAt]) => {
      if (dismissedAt === todayStr) stillValid[id] = dismissedAt;
    });
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(stillValid));
    return new Set(Object.keys(stillValid));
  } catch {
    return new Set();
  }
}

function persistDismissed(ids) {
  const todayStr = new Date().toDateString();
  const map = {};
  ids.forEach((id) => {
    map[id] = todayStr;
  });
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { expired, nearExpiry, needsLabel, allMedicines } = useInventoryAlerts();
  const [reminders, setReminders] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(() => loadDismissedToday());
  const [snoozeMenu, setSnoozeMenu] = useState({ anchor: null, reminderId: null });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const seenRef = useRef(loadSeenIds());

  useEffect(() => subscribeReminders(setReminders), []);

  // "now" only updates when something else re-renders this component -
  // without a tick, a reminder due at a specific time could sit unnoticed
  // until an unrelated re-render happens. Polling every 15s keeps detection
  // close to real-time without opening a permanent listener.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();
  const dueReminders = useMemo(
    () => reminders.filter((r) => r.dueDate && r.dueDate.getTime() <= now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reminders, tick]
  );

  const inventoryNotifications = useMemo(
    () => [...expired, ...nearExpiry, ...needsLabel].filter((a) => !dismissedIds.has(a.id)),
    [expired, nearExpiry, needsLabel, dismissedIds]
  );

  const totalCount = inventoryNotifications.length + dueReminders.length;

  // Auto-open when something new shows up that we haven't surfaced yet,
  // and play a tone specifically for due reminders.
  useEffect(() => {
    const currentIds = [
      ...inventoryNotifications.map((a) => a.id),
      ...dueReminders.map((r) => r.id),
    ];
    const hasNew = currentIds.some((id) => !seenRef.current.has(id));

    if (hasNew) {
      if (dueReminders.length > 0) playReminderBeep();
      setAnchorEl((prev) => prev ?? document.getElementById("dashboard-notification-bell"));
      currentIds.forEach((id) => seenRef.current.add(id));
      saveSeenIds(seenRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryNotifications.length, dueReminders.length]);

  function dismissNotification(id) {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      persistDismissed(next);
      return next;
    });
  }

  function dismissAll() {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      inventoryNotifications.forEach((a) => next.add(a.id));
      persistDismissed(next);
      return next;
    });
  }

  function openSnoozeMenu(e, reminderId) {
    setSnoozeMenu({ anchor: e.currentTarget, reminderId });
  }

  function closeSnoozeMenu() {
    setSnoozeMenu({ anchor: null, reminderId: null });
  }

  async function handleSnooze(minutes) {
    if (snoozeMenu.reminderId) {
      await snoozeReminder(snoozeMenu.reminderId, minutes);
    }
    closeSnoozeMenu();
  }

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        id="dashboard-notification-bell"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          position: "fixed",
          bottom: 24,
          insetInlineEnd: 24,
          zIndex: 1300,
          bgcolor: colors.surface,
          boxShadow: shadow.float,
          "&:hover": { bgcolor: colors.surfaceMuted },
        }}
      >
        <Badge badgeContent={totalCount} color="error">
          <NotificationsIcon sx={{ color: totalCount > 0 ? colors.primary : colors.textFaint }} />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: `${radii.md}px`, boxShadow: shadow.float } } }}
      >
        <Box sx={{ width: 360, maxHeight: 460, overflowY: "auto", p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography fontWeight={700} fontSize={16} color={colors.textDark}>
              Notifications
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {inventoryNotifications.length > 0 && (
                <Button size="small" onClick={dismissAll} sx={{ textTransform: "none", fontWeight: 600 }}>
                  Close all
                </Button>
              )}
              <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                <SettingsIcon fontSize="small" sx={{ color: colors.textFaint }} />
              </IconButton>
            </Stack>
          </Stack>

          {totalCount === 0 && (
            <Typography color={colors.textFaint} textAlign="center" py={4} fontSize={14}>
              You're all caught up 🎉
            </Typography>
          )}

          {dueReminders.length > 0 && (
            <Box mb={1.5}>
              <Typography variant="caption" fontWeight={700} color={colors.textMuted}>
                REMINDERS
              </Typography>
              <Stack spacing={1} mt={0.75}>
                {dueReminders.map((r) => (
                  <Box
                    key={r.id}
                    sx={{ border: `1px solid ${colors.border}`, borderRadius: `${radii.sm}px`, p: 1.2 }}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="flex-start">
                      <Box sx={iconBadgeSx(colors.primary, colors.primaryBg)}>
                        <AlarmIcon fontSize="small" />
                      </Box>
                      <Box flexGrow={1}>
                        <Typography fontWeight={600} fontSize={14} color={colors.textDark}>
                          {r.title}
                        </Typography>
                        {r.note && (
                          <Typography variant="caption" color={colors.textFaint}>
                            {r.note}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} justifyContent="flex-end" mt={1}>
                      <Button size="small" sx={{ textTransform: "none" }} onClick={(e) => openSnoozeMenu(e, r.id)}>
                        Postpone
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ textTransform: "none", boxShadow: "none" }}
                        onClick={() => markReminderDone(r.id)}
                      >
                        Done
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {dueReminders.length > 0 && inventoryNotifications.length > 0 && <Divider sx={{ my: 1 }} />}

          {inventoryNotifications.length > 0 && (
            <Box>
              <Typography variant="caption" fontWeight={700} color={colors.textMuted}>
                INVENTORY
              </Typography>
              <Stack spacing={1} mt={0.75}>
                {inventoryNotifications.slice(0, 6).map((a) => {
                  const badge =
                    a.kind === "label"
                      ? { icon: <PrintIcon fontSize="small" />, color: colors.warning, bg: colors.warningBg }
                      : a.status === "Expired"
                      ? { icon: <ErrorIcon fontSize="small" />, color: colors.error, bg: colors.errorBg }
                      : { icon: <WarningAmberIcon fontSize="small" />, color: colors.warning, bg: colors.warningBg };

                  return (
                    <Stack
                      key={a.id}
                      direction="row"
                      alignItems="center"
                      spacing={1.2}
                      sx={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: `${radii.sm}px`,
                        p: 1,
                        "&:hover": { bgcolor: colors.surfaceMuted },
                      }}
                    >
                      <Box sx={iconBadgeSx(badge.color, badge.bg)}>{badge.icon}</Box>
                      <Box flexGrow={1}>
                        <Typography fontSize={13} fontWeight={600} color={colors.textDark}>
                          {a.name}
                        </Typography>
                        <Typography variant="caption" color={colors.textFaint}>
                          {a.kind === "label"
                            ? `Needs label · ${a.daysRemaining}d left`
                            : a.status === "Expired"
                            ? "Expired"
                            : `Near expiry · ${a.daysRemaining}d left`}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => dismissNotification(a.id)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Stack>

              {inventoryNotifications.length > 6 && (
                <Button
                  fullWidth
                  size="small"
                  sx={{ mt: 1, textTransform: "none" }}
                  onClick={() => {
                    setAnchorEl(null);
                    navigate("/alerts");
                  }}
                >
                  View all ({inventoryNotifications.length})
                </Button>
              )}
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />
          <Button
            fullWidth
            size="small"
            sx={{ textTransform: "none", fontWeight: 600 }}
            onClick={() => {
              setAnchorEl(null);
              navigate("/alerts");
            }}
          >
            Open alerts & reminders
          </Button>
        </Box>
      </Popover>

      <Menu anchorEl={snoozeMenu.anchor} open={Boolean(snoozeMenu.anchor)} onClose={closeSnoozeMenu}>
        {snoozeOptions().map((opt) => (
          <MenuItem key={opt.minutes} onClick={() => handleSnooze(opt.minutes)}>
            {opt.label}
          </MenuItem>
        ))}
      </Menu>

      <AlertSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        allMedicines={allMedicines}
      />
    </>
  );
}