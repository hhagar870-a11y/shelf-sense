import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Badge,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import InventoryIcon from "@mui/icons-material/Inventory";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";

import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const drawerWidth = 240;

export default function Sidebar() {

  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

useEffect(() => {
  const updateAlerts = () => {
    const medicines = JSON.parse(localStorage.getItem("medicines")) || [];

    const today = new Date();

    const count = medicines.filter((medicine) => {
      const expiry = new Date(medicine.expiry);

      const diffDays = Math.ceil(
        (expiry - today) / (1000 * 60 * 60 * 24)
      );

      return diffDays <= 30;
    }).length;

    setAlertCount(count);
  };

  updateAlerts();

  const interval = setInterval(updateAlerts, 1000);

  return () => clearInterval(interval);
}, []);
  return (

    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,

        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          background: "#0F172A",
          color: "white",
        },
      }}
    >

     <Box
  sx={{
    width: "100%",
    display: "flex",
    justifyContent: "center",
    py: 1,
  }}
>
  <img
    src="/logo.png"
    alt="Shelf Sense"
    style={{
      width: 220,
height: 220,
      objectFit: "contain",
    }}
  />
</Box>
      <Box sx={{ overflow: "auto" }}>

        <List>

          <ListItemButton onClick={() => navigate("/dashboard")}>

            <ListItemIcon>
              <DashboardIcon sx={{ color: "white" }} />
            </ListItemIcon>

            <ListItemText primary="Dashboard" />

          </ListItemButton>

          <ListItemButton onClick={() => navigate("/inventory")}>

            <ListItemIcon>
              <InventoryIcon sx={{ color: "white" }} />
            </ListItemIcon>

            <ListItemText primary="Inventory" />

          </ListItemButton>

          <ListItemButton onClick={() => navigate("/scan")}>

            <ListItemIcon>
              <QrCodeScannerIcon sx={{ color: "white" }} />
            </ListItemIcon>

            <ListItemText primary="Smart Scan" />

          </ListItemButton>

          <ListItemButton>

            <ListItemIcon>
  <Badge
    badgeContent={alertCount}
    color="error"
    invisible={alertCount === 0}
  >
    <WarningAmberIcon sx={{ color: "white" }} />
  </Badge>
</ListItemIcon>

            <ListItemText primary="Alerts" />

          </ListItemButton>

          <ListItemButton>

            <ListItemIcon>
              <AssessmentIcon sx={{ color: "white" }} />
            </ListItemIcon>

            <ListItemText primary="Reports" />

          </ListItemButton>

          <ListItemButton>

            <ListItemIcon>
              <SettingsIcon sx={{ color: "white" }} />
            </ListItemIcon>

            <ListItemText primary="Settings" />

          </ListItemButton>

        </List>

      </Box>

    </Drawer>

  );

}