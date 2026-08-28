import React, { useEffect, useMemo, useState } from "react";

import {
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
  TextField,
  MenuItem,
  Button,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AddIcon from "@mui/icons-material/Add";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import useInventoryAlerts from "../hooks/useInventoryAlerts";

import {
  subscribeReminders,
  addReminder,
  markReminderDone,
  deleteReminder,
} from "../services/reminders";

import {
  buildMonthGrid,
  getWeekdayLabels,
  getMonthLabel,
  isSameDay,
} from "../utils/calendarGrid";

import {
  colors,
  radii,
  iconBadgeSx,
} from "../utils/brandTokens";

import AlertSettingsDialog from "../components/AlertSettingsDialog";


const REMINDER_TYPES = [
  {
    value: "general",
    label: "General reminder",
  },
  {
    value: "shipment",
    label: "Incoming Mawsool shipment",
  },
  {
    value: "inventory_check",
    label: "Periodic inventory check",
  },
  {
    value: "mawsool_order",
    label: "Mawsool order request",
  },
  {
    value: "custom",
    label: "Custom",
  },
];


const cardSx = {
  borderRadius: "20px",
  border: "1px solid #E2E8F0",
  backgroundColor: "#FFFFFF",
  boxShadow: "0 4px 20px rgba(15, 23, 42, 0.03)",
  overflow: "hidden",
};


export default function AlertsCenter() {

  const {
    expired = [],
    nearExpiry = [],
    needsLabel = [],
    allMedicines = [],
  } = useInventoryAlerts();


  const [reminders, setReminders] = useState([]);

  const [cursor, setCursor] = useState(
    new Date()
  );

  const [selectedDay, setSelectedDay] =
    useState(new Date());

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [alertTab, setAlertTab] =
    useState("nearExpiry");

  const [form, setForm] = useState({
    title: "",
    note: "",
    time: "09:00",
    type: "general",
  });


  useEffect(() => {

    const unsubscribe =
      subscribeReminders(setReminders);

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };

  }, []);


  const weeks = useMemo(
    () =>
      buildMonthGrid(
        cursor.getFullYear(),
        cursor.getMonth()
      ),
    [cursor]
  );


  const remindersByDay = useMemo(() => {

    const map = new Map();

    reminders.forEach((r) => {

      if (!r?.dueDate) return;

      const date =
        r.dueDate instanceof Date
          ? r.dueDate
          : new Date(r.dueDate);

      const key = date.toDateString();

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push({
        ...r,
        dueDate: date,
      });

    });

    return map;

  }, [reminders]);


  const selectedDayReminders =
    remindersByDay.get(
      selectedDay.toDateString()
    ) || [];


  const totalInventoryAlerts =
    expired.length +
    nearExpiry.length +
    needsLabel.length;


  const ALERT_TABS = [
    {
      key: "nearExpiry",
      label: "Near expiry",
      data: nearExpiry,
      color: colors.warning,
      bg: colors.warningBg,
      icon: WarningAmberIcon,
      getChip: (a) => `${a.daysRemaining}d left`,
    },
    {
      key: "expired",
      label: "Expired",
      data: expired,
      color: colors.error,
      bg: colors.errorBg,
      icon: ErrorIcon,
      getChip: (a) =>
        `${Math.abs(a.daysRemaining)}d ago`,
    },
    {
      key: "needsLabel",
      label: "Needs label",
      data: needsLabel,
      color: colors.primary,
      bg: colors.primaryBg,
      icon: PrintIcon,
      getChip: (a) =>
        a.daysRemaining == null
          ? "Label"
          : a.daysRemaining < 0
          ? `${Math.abs(a.daysRemaining)}d ago`
          : `${a.daysRemaining}d left`,
    },
  ];

  const activeAlertTab =
    ALERT_TABS.find(
      (t) => t.key === alertTab
    ) || ALERT_TABS[0];


  function openNewReminderDialog(
    presetType = "general"
  ) {

    const presetTitles = {
      shipment: "Incoming Mawsool shipment",
      inventory_check: "Periodic inventory check",
      mawsool_order: "Mawsool order request",
    };

    setForm({
      title: presetTitles[presetType] || "",
      note: "",
      time: "09:00",
      type: presetType,
    });

    setDialogOpen(true);
  }


  async function handleSaveReminder() {

    if (!form.title.trim()) return;

    const [h, m] =
      form.time.split(":").map(Number);

    const dueDate = new Date(selectedDay);

    dueDate.setHours(
      h || 9,
      m || 0,
      0,
      0
    );

    await addReminder({
      title: form.title.trim(),
      note: form.note.trim(),
      dueDate,
      type: form.type,
    });

    setDialogOpen(false);
  }


  function previousMonth() {

    setCursor(
      new Date(
        cursor.getFullYear(),
        cursor.getMonth() - 1,
        1
      )
    );

  }


  function nextMonth() {

    setCursor(
      new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        1
      )
    );

  }


  return (

    <Box
      sx={{
        minHeight: "100vh",
        background: "#F7F9FC",
        px: {
          xs: 2,
          sm: 3,
          md: 4,
        },
        py: {
          xs: 2.5,
          md: 4,
        },
      }}
    >

      <Box
        sx={{
          maxWidth: "1320px",
          mx: "auto",
        }}
      >

        {/* =========================
            HEADER
        ========================== */}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 4,
            pb: 3,
            borderBottom: "1px solid #E2E8F0",
          }}
        >

          <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: "#1976d2", 
                color: "#ffffff", 
                borderRadius: 3.5, 
                display: "flex",
                boxShadow: "0 10px 15px -3px rgba(25, 118, 210, 0.25)"
              }}
            >
              <NotificationsActiveIcon sx={{ fontSize: 30 }} />
            </Box>

            <Box>
              <Typography
                sx={{
                  fontSize: {
                    xs: 24,
                    md: 28,
                  },
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.5px",
                  lineHeight: 1.2,
                }}
              >
                Alerts & Reminders
              </Typography>

              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: 13.5,
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                Manage reminders and track critical inventory timelines
              </Typography>
            </Box>
          </Box>


          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
          >

            <Tooltip title="Settings">

              <IconButton
                onClick={() =>
                  setSettingsOpen(true)
                }
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  border:
                    "1px solid #E2E8F0",
                  backgroundColor:
                    "#FFFFFF",
                  color: "#475569",

                  "&:hover": {
                    backgroundColor:
                      "#F8FAFC",
                    borderColor:
                      "#CBD5E1",
                  },
                }}
              >
                <SettingsIcon
                  sx={{
                    fontSize: 21,
                  }}
                />
              </IconButton>

            </Tooltip>


            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                openNewReminderDialog(
                  "general"
                )
              }
              sx={{
                height: 44,
                px: 2.5,
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 700,
                backgroundColor:
                  "#1976d2",
                boxShadow:
                  "0 4px 14px rgba(25, 118, 210, 0.25)",

                "&:hover": {
                  backgroundColor:
                    "#0369a1",
                },
              }}
            >
              New reminder
            </Button>

          </Stack>

        </Box>


        {/* =========================
            MAIN CONTENT
        ========================== */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.65fr) minmax(340px, .75fr)",
            },
            gap: 2.5,
            alignItems: "start",
          }}
        >

          {/* =========================
              LEFT COLUMN
          ========================== */}

          <Box>

            {/* CALENDAR */}

            <Card sx={cardSx}>

              <CardContent
                sx={{
                  p: {
                    xs: 2,
                    md: 2.75,
                  },
                }}
              >

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    mb: 2.5,
                  }}
                >

                  <Box>

                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#98A2B3",
                        textTransform:
                          "uppercase",
                        letterSpacing: ".7px",
                      }}
                    >
                      Calendar
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 21,
                        fontWeight: 800,
                        color: "#172B4D",
                        mt: .35,
                      }}
                    >
                      {getMonthLabel(
                        cursor.getFullYear(),
                        cursor.getMonth()
                      )}
                    </Typography>

                  </Box>


                  <Stack
                    direction="row"
                    spacing={.75}
                  >

                    <IconButton
                      onClick={previousMonth}
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius:
                          "10px",
                        border:
                          "1px solid #E2E8F0",
                        color: "#667085",
                        background:
                          "#FFFFFF",

                        "&:hover": {
                          background:
                            "#F8FAFC",
                        },
                      }}
                    >
                      <ChevronLeftIcon />
                    </IconButton>


                    <IconButton
                      onClick={nextMonth}
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius:
                          "10px",
                        border:
                          "1px solid #E2E8F0",
                        color: "#667085",
                        background:
                          "#FFFFFF",

                        "&:hover": {
                          background:
                            "#F8FAFC",
                        },
                      }}
                    >
                      <ChevronRightIcon />
                    </IconButton>

                  </Stack>

                </Box>


                {/* WEEK DAYS */}

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(7, 1fr)",
                    borderTop:
                      "1px solid #EEF1F4",
                    borderBottom:
                      "1px solid #EEF1F4",
                    py: 1,
                    mb: 1,
                  }}
                >

                  {getWeekdayLabels().map(
                    (day) => (

                      <Typography
                        key={day}
                        sx={{
                          textAlign:
                            "center",
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: "#98A2B3",
                          letterSpacing:
                            ".35px",
                        }}
                      >
                        {day.toUpperCase()}
                      </Typography>

                    )
                  )}

                </Box>


                {/* DAYS */}

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(7, 1fr)",
                    gap: .5,
                  }}
                >

                  {weeks.flat().map(
                    (day, index) => {

                      const dayReminders =
                        day
                          ? remindersByDay.get(
                              day.toDateString()
                            ) || []
                          : [];

                      const selected =
                        day &&
                        isSameDay(
                          day,
                          selectedDay
                        );


                      return (

                        <Box
                          key={index}
                          onClick={() => {

                            if (!day) return;

                            setSelectedDay(
                              day
                            );

                          }}
                          sx={{
                            minHeight: 58,
                            borderRadius:
                              "10px",
                            cursor: day
                              ? "pointer"
                              : "default",
                            display: "flex",
                            alignItems:
                              "flex-start",
                            justifyContent:
                              "center",
                            pt: 1,

                            backgroundColor:
                              selected
                                ? colors.primary
                                : "transparent",

                            transition:
                              "all .15s ease",

                            "&:hover":
                              day && !selected
                                ? {
                                    backgroundColor:
                                      "#F5F8FB",
                                  }
                                : {},
                          }}
                        >

                          <Box
                            sx={{
                              display: "flex",
                              flexDirection:
                                "column",
                              alignItems:
                                "center",
                            }}
                          >

                            <Typography
                              sx={{
                                width: 30,
                                height: 30,
                                display: "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                borderRadius:
                                  "9px",
                                fontSize: 13,
                                fontWeight:
                                  selected
                                    ? 800
                                    : 600,
                                color:
                                  selected
                                    ? "#FFFFFF"
                                    : day
                                    ? "#344054"
                                    : "transparent",
                              }}
                            >
                              {day
                                ? day.getDate()
                                : "0"}
                            </Typography>


                            {dayReminders.length >
                              0 && (

                              <Box
                                sx={{
                                  width: 5,
                                  height: 5,
                                  borderRadius:
                                    "50%",
                                  background:
                                    selected
                                      ? "#FFFFFF"
                                      : colors.primary,
                                  mt: .3,
                                }}
                              />

                            )}

                          </Box>

                        </Box>

                      );

                    }
                  )}

                </Box>

              </CardContent>

            </Card>


            {/* SELECTED DAY */}

            <Card
              sx={{
                ...cardSx,
                mt: 2.5,
              }}
            >

              <CardContent
                sx={{
                  p: {
                    xs: 2,
                    md: 2.5,
                  },
                }}
              >

                <Box mb={1.75}>

                  <Typography
                    sx={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: "#98A2B3",
                      textTransform:
                        "uppercase",
                      letterSpacing: ".6px",
                    }}
                  >
                    Selected day
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#172B4D",
                      mt: .3,
                    }}
                  >
                    {selectedDay.toLocaleDateString(
                      "en-US",
                      {
                        weekday:
                          "long",
                        day: "numeric",
                        month: "long",
                      }
                    )}
                  </Typography>

                </Box>


                {selectedDayReminders.length ===
                0 ? (

                  <Box
                    sx={{
                      border:
                        "1px dashed #DCE3EA",
                      borderRadius:
                        "12px",
                      background:
                        "#FAFBFC",
                      py: 3,
                      textAlign:
                        "center",
                    }}
                  >

                    <EventBusyIcon
                      sx={{
                        fontSize: 26,
                        color:
                          "#B8C1CC",
                      }}
                    />

                    <Typography
                      sx={{
                        fontSize: 12.5,
                        color:
                          "#98A2B3",
                        mt: .6,
                      }}
                    >
                      No reminders for this day
                    </Typography>

                  </Box>

                ) : (

                  <Stack spacing={1}>

                    {selectedDayReminders.map(
                      (r) => (

                        <Stack
                          key={r.id}
                          direction="row"
                          alignItems="center"
                          spacing={1.2}
                          sx={{
                            p: 1.1,
                            border:
                              "1px solid #E8EDF2",
                            borderRadius:
                              "11px",
                          }}
                        >

                          <Box
                            sx={iconBadgeSx(
                              colors.primary,
                              colors.primaryBg
                            )}
                          >

                            {r.type ===
                            "shipment" ? (

                              <LocalShippingIcon
                                fontSize="small"
                              />

                            ) : (

                              <Box
                                sx={{
                                  width: 7,
                                  height: 7,
                                  borderRadius:
                                    "50%",
                                  background:
                                    colors.primary,
                                }}
                              />

                            )}

                          </Box>


                          <Box
                            sx={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >

                            <Typography
                              fontSize={13}
                              fontWeight={700}
                              noWrap
                              color={
                                colors.textDark
                              }
                            >
                              {r.title}
                            </Typography>

                            <Typography
                              fontSize={11}
                              color={
                                colors.textFaint
                              }
                            >
                              {r.dueDate?.toLocaleTimeString(
                                "en-US",
                                {
                                  hour:
                                    "2-digit",
                                  minute:
                                    "2-digit",
                                }
                              )}
                            </Typography>

                          </Box>


                          <Button
                            size="small"
                            onClick={() =>
                              markReminderDone(
                                r.id
                              )
                            }
                            sx={{
                              textTransform:
                                "none",
                              fontWeight: 700,
                            }}
                          >
                            Done
                          </Button>


                          <IconButton
                            size="small"
                            onClick={() =>
                              deleteReminder(
                                r.id
                              )
                            }
                          >
                            <DeleteIcon
                              fontSize="small"
                            />
                          </IconButton>

                        </Stack>

                      )
                    )}

                  </Stack>

                )}

              </CardContent>

            </Card>

          </Box>


          {/* =========================
              RIGHT COLUMN
          ========================== */}

          <Box>

            {/* INVENTORY */}

            <Card sx={cardSx}>

              <CardContent
                sx={{
                  p: 2.5,
                  pb: 1.5,
                }}
              >

                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={2}
                >

                  <Box>

                    <Typography
                      sx={{
                        fontSize: 16,
                        fontWeight: 800,
                        color:
                          "#172B4D",
                      }}
                    >
                      Inventory notifications
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 11.5,
                        color:
                          "#98A2B3",
                        mt: .35,
                      }}
                    >
                      Items requiring attention
                    </Typography>

                  </Box>


                  <Chip
                    label={
                      totalInventoryAlerts
                    }
                    size="small"
                    sx={{
                      height: 24,
                      borderRadius: "8px",
                      background:
                        "#FFF4E5",
                      color:
                        "#D97706",
                      fontWeight: 800,
                    }}
                  />

                </Stack>


                {/* TABS */}

                <Box
                  sx={{
                    display: "flex",
                    gap: .6,
                    p: .5,
                    mb: 2,
                    borderRadius: "12px",
                    background: "#F3F5F8",
                  }}
                >

                  {ALERT_TABS.map((tab) => {

                    const active =
                      tab.key === alertTab;

                    return (

                      <Box
                        key={tab.key}
                        onClick={() =>
                          setAlertTab(tab.key)
                        }
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          cursor: "pointer",
                          textAlign: "center",
                          borderRadius: "9px",
                          py: .85,
                          px: .5,
                          transition:
                            "all .15s ease",
                          background: active
                            ? "#FFFFFF"
                            : "transparent",
                          boxShadow: active
                            ? "0 1px 4px rgba(16,24,40,.08)"
                            : "none",
                        }}
                      >

                        <Typography
                          sx={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: active
                              ? tab.color
                              : "#8A96A8",
                            overflow: "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tab.label}
                        </Typography>

                        <Typography
                          sx={{
                            fontSize: 15,
                            fontWeight: 800,
                            mt: .1,
                            color: active
                              ? "#172B4D"
                              : "#B0B8C4",
                          }}
                        >
                          {tab.data.length}
                        </Typography>

                      </Box>

                    );

                  })}

                </Box>


                {/* LIST */}

                {activeAlertTab.data.length ===
                0 ? (

                  <Box
                    sx={{
                      py: 4,
                      textAlign:
                        "center",
                    }}
                  >

                    <Typography
                      fontSize={13}
                      color="#98A2B3"
                    >
                      No items in this list
                    </Typography>

                  </Box>

                ) : (

                  <Stack
                    spacing={1.1}
                    sx={{
                      maxHeight: 400,
                      overflowY: "auto",
                      pr: .5,
                      mr: -.5,

                      "&::-webkit-scrollbar": {
                        width: 5,
                      },

                      "&::-webkit-scrollbar-thumb":
                        {
                          background:
                            "#D8DEE6",
                          borderRadius: 10,
                        },

                      "&::-webkit-scrollbar-track":
                        {
                          background:
                            "transparent",
                        },
                    }}
                  >

                    {activeAlertTab.data.map(
                      (a, index) => {

                        const TabIcon =
                          activeAlertTab.icon;

                        return (

                          <Stack
                            key={`${a.id}-${index}`}
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{
                              minWidth: 0,
                              p: .9,
                              borderRadius: "11px",

                              "&:hover": {
                                background:
                                  "#FAFBFC",
                              },
                            }}
                          >

                            <Box
                              sx={iconBadgeSx(
                                activeAlertTab.color,
                                activeAlertTab.bg
                              )}
                            >

                              <TabIcon
                                fontSize="small"
                              />

                            </Box>


                            <Typography
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 12.5,
                                fontWeight: 700,
                                color:
                                  "#344054",
                                overflow:
                                  "hidden",
                                textOverflow:
                                  "ellipsis",
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {a.name}
                            </Typography>


                            <Chip
                              size="small"
                              label={activeAlertTab.getChip(
                                a
                              )}
                              sx={{
                                height: 23,
                                borderRadius:
                                  "7px",
                                flexShrink: 0,
                                background:
                                  activeAlertTab.bg,
                                color:
                                  activeAlertTab.color,
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            />

                          </Stack>

                        );

                      }
                    )}

                  </Stack>

                )}

              </CardContent>

            </Card>


            {/* SHIPMENT */}

            <Card
              sx={{
                mt: 2.5,
                borderRadius: "18px",
                border: "none",
                background:
                  "linear-gradient(135deg,#1976D2,#2585DE)",
                color: "#FFFFFF",
                boxShadow:
                  "0 8px 22px rgba(25,118,210,.14)",
              }}
            >

              <CardContent
                sx={{
                  p: 2.5,
                }}
              >

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >

                  <Box>

                    <Typography
                      sx={{
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      Incoming shipment?
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        mt: .6,
                        color:
                          "rgba(255,255,255,.78)",
                        maxWidth: 280,
                      }}
                    >
                      Schedule a shipment reminder
                      and keep receiving tasks
                      organized.
                    </Typography>

                  </Box>


                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius:
                        "12px",
                      background:
                        "rgba(255,255,255,.15)",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >

                    <LocalShippingIcon />

                  </Box>

                </Stack>


                <Button
                  fullWidth
                  onClick={() =>
                    openNewReminderDialog(
                      "shipment"
                    )
                  }
                  sx={{
                    mt: 2,
                    height: 39,
                    borderRadius:
                      "10px",
                    background:
                      "#FFFFFF",
                    color:
                      colors.primary,
                    textTransform:
                      "none",
                    fontWeight: 800,

                    "&:hover": {
                      background:
                        "#F5F8FC",
                    },
                  }}
                >
                  Schedule shipment
                </Button>

              </CardContent>

            </Card>


            {/* INVENTORY CHECK / ORDER REMINDER */}

            <Card
              sx={{
                mt: 2.5,
                borderRadius: "18px",
                border: "none",
                background:
                  "linear-gradient(135deg,#0E9384,#14B8A6)",
                color: "#FFFFFF",
                boxShadow:
                  "0 8px 22px rgba(14,147,132,.16)",
              }}
            >

              <CardContent
                sx={{
                  p: 2.5,
                }}
              >

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >

                  <Box>

                    <Typography
                      sx={{
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      Stock check due?
                    </Typography>

                    <Typography
                      sx={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        mt: .6,
                        color:
                          "rgba(255,255,255,.78)",
                        maxWidth: 280,
                      }}
                    >
                      Schedule a periodic inventory
                      check or a Mawsool order
                      reminder.
                    </Typography>

                  </Box>


                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius:
                        "12px",
                      background:
                        "rgba(255,255,255,.15)",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >

                    <FactCheckIcon />

                  </Box>

                </Stack>


                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    mt: 2,
                  }}
                >

                  <Button
                    fullWidth
                    startIcon={
                      <FactCheckIcon
                        sx={{
                          fontSize: 17,
                        }}
                      />
                    }
                    onClick={() =>
                      openNewReminderDialog(
                        "inventory_check"
                      )
                    }
                    sx={{
                      height: 39,
                      borderRadius:
                        "10px",
                      background:
                        "#FFFFFF",
                      color:
                        "#0E9384",
                      textTransform:
                        "none",
                      fontWeight: 800,
                      fontSize: 12.5,

                      "&:hover": {
                        background:
                          "#F5FBFA",
                      },
                    }}
                  >
                    Inventory check
                  </Button>


                  <Button
                    fullWidth
                    startIcon={
                      <ShoppingCartIcon
                        sx={{
                          fontSize: 17,
                        }}
                      />
                    }
                    onClick={() =>
                      openNewReminderDialog(
                        "mawsool_order"
                      )
                    }
                    sx={{
                      height: 39,
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,.15)",
                      color:
                        "#FFFFFF",
                      textTransform:
                        "none",
                      fontWeight: 800,
                      fontSize: 12.5,
                      border:
                        "1px solid rgba(255,255,255,.35)",

                      "&:hover": {
                        background:
                          "rgba(255,255,255,.24)",
                      },
                    }}
                  >
                    Order Mawsool
                  </Button>

                </Stack>

              </CardContent>

            </Card>

          </Box>

        </Box>

      </Box>


      {/* =========================
          NEW REMINDER DIALOG
      ========================== */}

      <Dialog
        open={dialogOpen}
        onClose={() =>
          setDialogOpen(false)
        }
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius:
              `${radii.md}px`,
          },
        }}
      >

        <DialogTitle
          sx={{
            fontWeight: 800,
            color: colors.textDark,
          }}
        >
          New reminder
        </DialogTitle>


        <DialogContent>

          <Stack
            spacing={2}
            mt={1}
          >

            <TextField
              select
              fullWidth
              label="Type"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value,
                })
              }
            >

              {REMINDER_TYPES.map(
                (type) => (

                  <MenuItem
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </MenuItem>

                )
              )}

            </TextField>


            <TextField
              fullWidth
              label="Title"
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
            />


            <TextField
              fullWidth
              label="Note (optional)"
              value={form.note}
              onChange={(e) =>
                setForm({
                  ...form,
                  note: e.target.value,
                })
              }
              multiline
              minRows={2}
            />


            <TextField
              fullWidth
              label="Time"
              type="time"
              value={form.time}
              onChange={(e) =>
                setForm({
                  ...form,
                  time: e.target.value,
                })
              }
              InputLabelProps={{
                shrink: true,
              }}
            />

          </Stack>

        </DialogContent>


        <DialogActions
          sx={{
            p: 2,
          }}
        >

          <Button
            onClick={() =>
              setDialogOpen(false)
            }
            sx={{
              textTransform:
                "none",
            }}
          >
            Cancel
          </Button>


          <Button
            variant="contained"
            onClick={
              handleSaveReminder
            }
            sx={{
              textTransform:
                "none",
              fontWeight: 700,
            }}
          >
            Save
          </Button>

        </DialogActions>

      </Dialog>


      {/* SETTINGS */}

      <AlertSettingsDialog
        open={settingsOpen}
        onClose={() =>
          setSettingsOpen(false)
        }
        allMedicines={allMedicines}
      />

    </Box>
  );
}