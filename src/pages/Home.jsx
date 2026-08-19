import React, { useState } from "react";
import { Box, Typography, TextField, Button, Checkbox, FormControlLabel, Link, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = (e) => {
    e.preventDefault();
    // توجيه مباشر للداشبورد عند تسجيل الدخول
    navigate("/dashboard");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        backgroundColor: "#F8FAFC",
        overflowX: "hidden",
      }}
    >
      {/* القسم الأيسر: الهوية والشعار الطبي */}
      <Box
        sx={{
          flex: 1.2,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          p: { xs: 4, md: 8 },
          background: "linear-gradient(135deg, #F0F7FF 0%, #E2EEF8 100% )",
          borderRight: "1px solid #E2E8F0",
        }}
      >
        <Box
          sx={{
            maxWidth: "500px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          {/* شعار المستشفى */}
          <Box
            component="img"
            src="/logo.png"
            alt="Hail Health Cluster"
            sx={{
              width: "220px",
              height: "auto",
              objectFit: "contain",
              mb: 1,
            }}
          />

          <Typography
            sx={{
              fontSize: { xs: "28px", md: "36px" },
              fontWeight: 800,
              color: "#0F172A",
              lineHeight: 1.2,
            }}
          >
            مخزن الأدوية
          </Typography>

          <Typography
            sx={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#2563EB",
              letterSpacing: "0.5px",
            }}
          >
            مستشفى الملك سلمان التخصصي · الصيدلية الداخلية
          </Typography>

          <Typography
            sx={{
              fontSize: "14px",
              color: "#64748B",
              lineHeight: 1.6,
              maxWidth: "420px",
              mt: 1,
            }}
          >
            نظام ذكي متكامل لإدارة مخزون الأدوية، تتبع تواريخ الصلاحية، وتقليل الهدر لضمان أعلى معايير الأمان والرعاية الصيدلانية.
          </Typography>
        </Box>
      </Box>

      {/* القسم الأيمن: نموذج تسجيل الدخول */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          p: { xs: 3, sm: 6, md: 8 },
          backgroundColor: "#FFFFFF",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: "420px", my: "auto" }}>
          <Box sx={{ mb: 4 }}>
            <Typography
              sx={{
                fontSize: "26px",
                fontWeight: 800,
                color: "#0F172A",
                mb: 1,
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              sx={{
                fontSize: "14px",
                color: "#64748B",
              }}
            >
              Sign in to continue to Shelf Sense
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSignIn} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              fullWidth
              label="Username or Email"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#F8FAFC",
                },
              }}
            />

            <TextField
              fullWidth
              type="password"
              label="Password"
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#F8FAFC",
                },
              }}
            />

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FormControlLabel
                control={<Checkbox defaultChecked color="primary" />}
                label={<Typography sx={{ fontSize: "13px", color: "#475569" }}>Remember me</Typography>}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{
                mt: 1,
                py: 1.5,
                borderRadius: "12px",
                backgroundColor: "#2563EB",
                fontWeight: 700,
                fontSize: "15px",
                textTransform: "none",
                boxShadow: "0 10px 20px -5px rgba(37, 99, 235, 0.4)",
                "&:hover": {
                  backgroundColor: "#1D4ED8",
                },
              }}
            >
              Sign In
            </Button>

            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={() => navigate("/dashboard")}
              sx={{
                py: 1.5,
                borderRadius: "12px",
                borderColor: "#CBD5E1",
                color: "#334155",
                fontWeight: 600,
                fontSize: "14px",
                textTransform: "none",
                "&:hover": {
                  borderColor: "#94A3B8",
                  backgroundColor: "#F8FAFC",
                },
              }}
            >
              Sign In with Hospital Account
            </Button>
          </Box>

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "13px", color: "#64748B" }}>
              Need help?{" "}
              <Link
                component="button"
                onClick={() => navigate("/support")}
                sx={{
                  color: "#2563EB",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Contact IT Support
              </Link>
            </Typography>
          </Box>
        </Box>

        {/* الفوتر الموحد في أسفل صفحة الدخول */}
        <Box
          component="footer"
          sx={{
            width: "100%",
            maxWidth: "420px",
            pt: 3,
            borderTop: "1px solid #EAECF0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: 4,
          }}
        >
          <Typography sx={{ fontSize: "12px", color: "#667085" }}>
            Shelf Sense · Pharmacy System
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "#98A2B3" }}>
            Version 1.0.0
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default Home;