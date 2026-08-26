import React, { useCallback } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Badge,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalPharmacyOutlinedIcon from "@mui/icons-material/LocalPharmacyOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";

import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";
import useInventoryAlerts from "../hooks/useInventoryAlerts";

const drawerWidth = 260;

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { expired = [], nearExpiry = [], needsLabel = [] } = useInventoryAlerts();
  const totalAlerts = expired.length + nearExpiry.length + needsLabel.length;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") setOpen(true);
      else if (e.key === "ArrowLeft") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // دالة تنقل فورية وسريعة تمنع تعليق المتصفح
  const handleItemClick = useCallback((path) => {
    setOpen(false);
    if (location.pathname !== path) {
      navigate(path);
    }
  }, [location.pathname, navigate]);

  const coreLinks = [
    { label: "Dashboard", path: "/dashboard", icon: <DashboardOutlinedIcon sx={{ fontSize: 20 }} /> },
    { label: "Inventory", path: "/inventory", icon: <Inventory2OutlinedIcon sx={{ fontSize: 20 }} /> },
    { label: "Mawsool Orders", path: "/mawsool-orders", icon: <LocalPharmacyOutlinedIcon sx={{ fontSize: 20 }} /> },
  ];

  const toolsLinks = [
    { label: "Smart Scan", path: "/scan", icon: <QrCodeScannerOutlinedIcon sx={{ fontSize: 20 }} /> },
    { 
      label: "Alerts & Reminders", 
      path: "/alerts", 
      icon: (
        <Badge
          badgeContent={totalAlerts}
          color="error"
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              fontSize: 9,
              height: 15,
              minWidth: 15,
              padding: "0 3px",
              backgroundColor: "#EF4444",
              fontWeight: 700,
            },
          }}
        >
          <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
        </Badge>
      ) 
    },
    { label: "Label Printing", path: "/labels", icon: <PrintOutlinedIcon sx={{ fontSize: 20 }} /> },
    { label: "Support & Docs", path: "/support", icon: <HeadsetMicOutlinedIcon sx={{ fontSize: 20 }} /> },
  ];

  const renderNavList = (items) => (
    <List disablePadding>
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        const itemColor = isActive ? "#0284c7" : "#1E3A5F";

        return (
          <ListItemButton
            key={item.path}
            onClick={() => handleItemClick(item.path)}
            sx={{
              px: 1.4,
              py: 0.85,
              mb: 0.3,
              borderRadius: "8px",
              backgroundColor: isActive ? "#eaf3fc" : "transparent",
              transition: "background-color 0.1s ease",
              "&:hover": {
                backgroundColor: isActive ? "#e1eefb" : "#f8fafc",
              },
            }}
          >
            <ListItemIcon sx={{ color: itemColor, minWidth: 34 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                sx: {
                  fontSize: "13.5px !important",
                  color: itemColor,
                  fontWeight: isActive ? 600 : 500,
                  lineHeight: 1.2,
                },
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 2000,
          color: "#0f2b48",
          background: "#ffffff",
          boxShadow: "0 2px 6px rgba(15,43,72,0.08)",
          borderRadius: "8px",
          p: "7px",
          border: "1px solid #e2e8f0",
          "&:hover": { background: "#f8fafc" },
        }}
      >
        <MenuIcon fontSize="small" />
      </IconButton>

      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }} // يحافظ على العناصر في الذاكرة لتسريع الفتح والتنقل
        transitionDuration={{ enter: 180, exit: 140 }} // تسريع زمن الأنيميشن
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: "18px 14px",
            borderRight: "1px solid #f1f5f9",
          },
        }}
      >
        <Box>
          {/* Brand Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 1,
              px: 1,
              mb: 1.5,
            }}
          >
            <img
              src="/logo2.png"
              alt="Hail Health Cluster"
              style={{
                width: "100%",
                maxWidth: 165,
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Box>

          <Divider sx={{ mb: 2, borderColor: "#f1f5f9" }} />

          {/* Main Management Section */}
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#94a3b8",
              px: 1.2,
              mb: 0.6,
            }}
          >
            Main Management
          </Typography>

          <Box sx={{ mb: 2 }}>{renderNavList(coreLinks)}</Box>

          {/* Pharmacy Tools Section */}
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#94a3b8",
              px: 1.2,
              mb: 0.6,
            }}
          >
            Pharmacy Tools
          </Typography>

          {renderNavList(toolsLinks)}
        </Box>

        {/* Seamless CRASHCART+ Item */}
        <Box sx={{ pt: 1.5, borderTop: "1px solid #f1f5f9" }}>
          <Box
            component="a"
            href="https://crashcart-kssh.vercel.app/admin.html"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: "9px 12px",
              borderRadius: "8px",
              backgroundColor: "transparent",
              textDecoration: "none",
              transition: "background-color 0.15s ease",
              "&:hover": {
                backgroundColor: "#f8fafc",
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <MonitorHeartOutlinedIcon sx={{ fontSize: 20, color: "#1E3A5F" }} />
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <Typography sx={{ fontSize: "13.5px", fontWeight: 700, color: "#1E3A5F", lineHeight: 1.1 }}>
                    CRASHCART+
                  </Typography>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: 10.5, color: "#64748b", mt: 0.3 }}>
                  Crash Cart System
                </Typography>
              </Box>
            </Box>
            <OpenInNewRoundedIcon sx={{ fontSize: 14, color: "#94a3b8" }} />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}