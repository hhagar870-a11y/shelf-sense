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
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InventoryIcon from "@mui/icons-material/Inventory";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PrintIcon from "@mui/icons-material/Print";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";

import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import MenuIcon from "@mui/icons-material/Menu";
import IconButton from "@mui/material/IconButton";

const drawerWidth = 240;

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
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
    <>
      <IconButton
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          top: 15,
          left: 15,
          zIndex: 2000,
          color: "#0F172A",
          background: "white",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        }}
      >
        <MenuIcon />
      </IconButton>

      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            background: "#ffffff",
            color: "#1e3a8a",
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
            src="/logo2.png"
            alt="System Logo"
            style={{
              width: 200,
              height: 200,
              objectFit: "contain",
              
            }}
          />
        </Box>

        <Box sx={{ overflow: "auto", px: 1 }}>
          <List>
            {/* Dashboard */}
            <ListItemButton
              onClick={() => { navigate("/dashboard"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/dashboard" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/dashboard" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/dashboard" ? "#1985cd" : "#64748b", minWidth: 40 }}>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText
                primary="Dashboard"
                primaryTypographyProps={{ sx: { color: location.pathname === "/dashboard" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/dashboard" ? 700 : 500 } }}
              />
            </ListItemButton>

            {/* Inventory */}
            <ListItemButton
              onClick={() => { navigate("/inventory"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/inventory" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/inventory" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/inventory" ? "#1985cd" : "#64748b", minWidth: 40 }}>
                <InventoryIcon />
              </ListItemIcon>
              <ListItemText
                primary="Inventory"
                primaryTypographyProps={{ sx: { color: location.pathname === "/inventory" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/inventory" ? 700 : 500 } }}
              />
            </ListItemButton>

            {/* Mawsool Orders */}
            <ListItemButton
              onClick={() => { navigate("/mawsool-orders"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/mawsool-orders" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/mawsool-orders" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/mawsool-orders" ? "#1985cd" : "#64748b", minWidth: 40 }}>
                <LocalPharmacyIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mawsool Orders"
                primaryTypographyProps={{ sx: { color: location.pathname === "/mawsool-orders" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/mawsool-orders" ? 700 : 500 } }}
              />
            </ListItemButton>

            {/* Smart Scan */}
            <ListItemButton
              onClick={() => { navigate("/scan"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/scan" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/scan" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/scan" ? "#1985cd" : "#64748b", minWidth: 40 }}>
                <QrCodeScannerIcon />
              </ListItemIcon>
              <ListItemText
                primary="Smart Scan"
                primaryTypographyProps={{ sx: { color: location.pathname === "/scan" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/scan" ? 700 : 500 } }}
              />
            </ListItemButton>

            {/* Alerts */}
            <ListItemButton
              onClick={() => { navigate("/alerts"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/alerts" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/alerts" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/alerts" ? "#1985cd" : "#64748b", minWidth: 40 }}>
  <WarningAmberIcon />
</ListItemIcon>
              <ListItemText
                primary="Alerts"
                primaryTypographyProps={{ sx: { color: location.pathname === "/alerts" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/alerts" ? 700 : 500 } }}
              />
            </ListItemButton>

            {/* Label Printing */}
            <ListItemButton
              onClick={() => { navigate("/labels"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/labels" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/labels" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/labels" ? "#1985cd" : "#64748b", minWidth: 40 }}>
                <PrintIcon />
              </ListItemIcon>
              <ListItemText
                primary="Label Printing"
                primaryTypographyProps={{ sx: { color: location.pathname === "/labels" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/labels" ? 700 : 500 } }}
              />
            </ListItemButton>

            {/* Support & Documentation */}
            <ListItemButton
              onClick={() => { navigate("/support"); setOpen(false); }}
              sx={{
                width: "100%",
                mb: 1,
                borderRadius: 2,
                backgroundColor: location.pathname === "/support" ? "#eaf5ff" : "transparent",
                borderRight: location.pathname === "/support" ? "4px solid #1985cd" : "none",
                "&:hover": { backgroundColor: "#eaf5ff" },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === "/support" ? "#1985cd" : "#64748b", minWidth: 40 }}>
                <SupportAgentIcon />
              </ListItemIcon>
              <ListItemText
                primary="Support & Documentation"
                primaryTypographyProps={{ sx: { color: location.pathname === "/support" ? "#1985cd" : "#1e293b", fontWeight: location.pathname === "/support" ? 700 : 500 } }}
              />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}