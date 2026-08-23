import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  InputAdornment,
  IconButton,
  Divider,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
        alignItems: "center",
        justifyContent: "center",
        gap: { xs: 6, md: 10 },
        background: "linear-gradient(135deg, #F3F8FD 0%, #E7F0FA 100%)",
        overflowX: "hidden",
        p: { xs: 4, md: 8 },
        position: "relative",
      }}
    >
      {/* القسم الأيسر: الهوية والشعار الطبي */}
      <Box
        sx={{
          flex: 1,
          maxWidth: "540px",
          display: "flex",
          flexDirection: "column",
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
          }}
        />

        <Typography
          sx={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#2563EB",
            letterSpacing: "1.5px",
          }}
        >
          مخزن الأدوية
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: "32px", md: "42px" },
            fontWeight: 800,
            color: "#0F172A",
            lineHeight: 1.15,
          }}
        >
          مستشفى الملك سلمان التخصصي
        </Typography>

        <Box sx={{ width: "56px", height: "4px", backgroundColor: "#2563EB", borderRadius: "2px" }} />

        <Typography
          sx={{
            fontSize: "15px",
            color: "#64748B",
            lineHeight: 1.7,
            maxWidth: "440px",
          }}
        >
          نظام ذكي متكامل لإدارة مخزون الأدوية، تتبع تواريخ الصلاحية، وتقليل الهدر لضمان أعلى معايير الأمان والرعاية الصيدلانية.
        </Typography>
      </Box>

      {/* القسم الأيمن: نموذج تسجيل الدخول */}
      <Box
        sx={{
          flex: 1,
          maxWidth: "440px",
          width: "100%",
          backgroundColor: "#FFFFFF",
          borderRadius: "20px",
          boxShadow: "0 20px 45px -12px rgba(15, 23, 42, 0.15)",
          p: { xs: 4, sm: 5 },
          display: "flex",
          flexDirection: "column",
        }}
      >
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
          <Box>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#334155", mb: 0.75 }}>
              Username or Email
            </Typography>
            <TextField
              fullWidth
              placeholder="Enter your username or email"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#F8FAFC",
                  "& fieldset": { borderColor: "#E2E8F0" },
                  "&:hover fieldset": { borderColor: "#CBD5E1" },
                  "&.Mui-focused fieldset": { borderColor: "#2563EB" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#334155", mb: 0.75 }}>
              Password
            </Typography>
            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end" size="small">
                      {showPassword ? (
                        <VisibilityOff sx={{ color: "#94A3B8", fontSize: 20 }} />
                      ) : (
                        <Visibility sx={{ color: "#94A3B8", fontSize: 20 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#F8FAFC",
                  "& fieldset": { borderColor: "#E2E8F0" },
                  "&:hover fieldset": { borderColor: "#CBD5E1" },
                  "&.Mui-focused fieldset": { borderColor: "#2563EB" },
                },
              }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <FormControlLabel
              control={<Checkbox color="primary" />}
              label={<Typography sx={{ fontSize: "13px", color: "#475569" }}>Remember me</Typography>}
            />
            <Link
              component="button"
              type="button"
              onClick={() => navigate("/forgot-password")}
              sx={{
                fontSize: "13px",
                color: "#2563EB",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Forgot password?
            </Link>
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

          <Divider sx={{ my: 0.5, color: "#94A3B8", fontSize: "13px" }}>or</Divider>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => navigate("/dashboard")}
            sx={{
              py: 1.5,
              borderRadius: "12px",
              borderColor: "#E2E8F0",
              color: "#334155",
              fontWeight: 600,
              fontSize: "14px",
              textTransform: "none",
              gap: 1,
              "&:hover": {
                borderColor: "#94A3B8",
                backgroundColor: "#F8FAFC",
              },
            }}
          >
            <Box
              component="svg"
              viewBox="0 0 48 48"
              sx={{ width: 18, height: 18 }}
            >
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.3 0 10.2-2 13.9-5.4l-6.4-5.4C29.4 34.9 26.8 36 24 36c-5.4 0-9.9-3.4-11.5-8.2l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.7 4.8-5 6.2l6.4 5.4C39.6 37.5 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
            </Box>
            Continue with Google
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

      {/* الفوتر */}
      <Box
        component="footer"
        sx={{
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
          maxWidth: "1200px",
          mx: "auto",
          px: { xs: 4, md: 8 },
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
  );
}

export default Home;