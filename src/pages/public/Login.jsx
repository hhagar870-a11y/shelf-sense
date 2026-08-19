import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton
} from "@mui/material";
import { useState } from "react";
import { login } from "../../utils/auth";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import CloseIcon from "@mui/icons-material/Close";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const [supportOpen, setSupportOpen] = useState(false);

  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");

    if (login(email.trim(), password)) {
      navigate("/dashboard");
    } else {
      setError("Incorrect username or password. Please try again.");
    }
  };

  return (
    <>
    <Box
      sx={{
        width: "100%",
        height: "100dvh",
        minHeight: "620px",
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "46% 54%"
        },
        backgroundColor: "#FFFFFF",
        overflow: "hidden",

        fontFamily: "Inter, Segoe UI, Arial, sans-serif",

        "& *": {
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          boxSizing: "border-box"
        }
      }}
    >
      {/* =====================================================
    LEFT BRANDING
===================================================== */}

<Box
  sx={{
    display: { xs: "none", md: "flex" },
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",

    backgroundColor: "#F1F9FC",
    borderRight: "1px solid #E5EEF3"
  }}
>
  {/* Subtle background shape */}
  <Box
    sx={{
      position: "absolute",
      width: 520,
      height: 520,
      borderRadius: "50%",
      backgroundColor: "#E8F5FA",
      left: -280,
      bottom: -300,
      opacity: 0.55
    }}
  />

  {/* BRANDING CONTENT */}
  <Box
    sx={{
      position: "relative",
      zIndex: 1,

      width: "100%",
      maxWidth: 500,

      px: {
        md: 5,
        lg: 6
      },

      transform: "translateY(-25px)"
    }}
  >
    {/* LOGO */}
    <Box
      component="img"
      src="/logo.png"
      alt="Hail Health Cluster"
      sx={{
        width: 185,
        height: "auto",

        display: "block",

        objectFit: "contain",
        objectPosition: "left center",

        mb: 4
      }}
    />

    {/* TITLE GROUP */}
    <Box
      sx={{
        maxWidth: 440
      }}
    >
      {/* Small label */}
      <Typography
        sx={{
          color: "#1385bf",

          fontSize: 11,

          fontWeight: 700,

          letterSpacing: "1.4px",

          lineHeight: 1.4,

          mb: 1.8
        }}
      >
        PHARMACY INVENTORY SYSTEM
      </Typography>

      {/* Main Title */}
      <Typography
        sx={{
          color: "#103F5A",

          fontSize: {
            md: 42,
            lg: 46
          },

          fontWeight: 750,

          lineHeight: 1.08,

          letterSpacing: "-1.7px",

          margin: 0
        }}
      >
        Pharmacy
        <br />
        Inventory
        <br />
        Management
      </Typography>

      {/* Accent */}
      <Box
        sx={{
          width: 52,
          height: 4,

          borderRadius: 10,

          backgroundColor: "#1385bf",

          mt: 2.8,
          mb: 2.8
        }}
      />

      {/* Description */}
      <Typography
        sx={{
          color: "#607D8B",

          fontSize: 14,

          fontWeight: 400,

          lineHeight: 1.7,

          maxWidth: 430,

          margin: 0
        }}
      >
        Manage pharmacy inventory, monitor stock levels,
        and track medication expiry dates efficiently.
      </Typography>
    </Box>
  </Box>
</Box>
      {/* =====================================================
          LOGIN SIDE
      ===================================================== */}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          px: {
            xs: 3,
            sm: 5,
            md: 7,
            lg: 9
          },

          py: 4,

          backgroundColor: "#FFFFFF",

          overflowY: "auto"
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 470
          }}
        >
          {/* Mobile Logo */}
          <Box
            sx={{
              display: {
                xs: "flex",
                md: "none"
              },

              justifyContent: "center",

              mb: 5
            }}
          >
            <Box
              component="img"
              src="/logo.png"
              alt="Hail Health Cluster"
              sx={{
                width: 170,
                height: "auto"
              }}
            />
          </Box>

          {/* =================================================
              HEADER
          ================================================= */}

          <Box sx={{ mb: 4 }}>
            <Typography
              sx={{
                color: "#1385bf",

                fontSize: {
                  xs: 28,
                  md: 32
                },

                fontWeight: 750,

                letterSpacing: "-1px",

                lineHeight: 1.2,

                mb: 1.2
              }}
            >
              Sign in to your account
            </Typography>

            <Typography
              sx={{
                color: "#718893",

                fontSize: 13.5,

                lineHeight: 1.6,

                maxWidth: 420
              }}
            >
              Enter your credentials to access the pharmacy
              inventory system.
            </Typography>
          </Box>

          {/* =================================================
              FORM
          ================================================= */}

          <Box
            component="form"
            onSubmit={handleSignIn}
          >
            {/* Username */}
            <Typography
              sx={{
                color: "#1385bf",

                fontSize: 13,

                fontWeight: 700,

                mb: 1
              }}
            >
              Username or Email
            </Typography>

            <TextField
              fullWidth
              placeholder="Enter your username or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              sx={inputStyle}
            />

            {/* Password */}
            <Typography
              sx={{
                color: "#294C60",

                fontSize: 13,

                fontWeight: 700,

                mt: 2.5,

                mb: 1
              }}
            >
              Password
            </Typography>

            <TextField
              fullWidth
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              sx={inputStyle}
            />

            {/* Error */}
            {error && (
              <Alert
                severity="error"
                sx={{
                  mt: 2,
                  borderRadius: 1.8,
                  fontSize: 13
                }}
              >
                {error}
              </Alert>
            )}

            {/* Remember Me */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) =>
                    setRememberMe(e.target.checked)
                  }
                  sx={{
                    p: 0.5,

                    mr: 0.5,

                    color: "#B5C8D2",

                    "&.Mui-checked": {
                      color: "#1385bf"
                    }
                  }}
                />
              }
              label={
                <Typography
                  sx={{
                    color: "#71858F",
                    fontSize: 13
                  }}
                >
                  Remember me
                </Typography>
              }
              sx={{
                margin: 0,
                mt: 1.5
              }}
            />

            {/* =================================================
                SIGN IN
            ================================================= */}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              sx={{
                height: 54,

                mt: 2.5,

                borderRadius: 1.8,

                backgroundColor: "#1385bf",

                color: "#FFFFFF",

                fontSize: 14,

                fontWeight: 700,

                textTransform: "none",

                boxShadow:
                  "0 7px 18px rgba(22,139,197,0.16)",

                "&:hover": {
                  backgroundColor: "#117EAF",

                  boxShadow:
                    "0 9px 22px rgba(22,139,197,0.20)"
                }
              }}
            >
              Sign In
            </Button>

            {/* =================================================
                GOOGLE
            ================================================= */}

            <Button
              fullWidth
              disabled
              variant="outlined"
              sx={{
                height: 50,

                mt: 2,

                borderRadius: 1.8,

                borderColor: "#E0E9EE",

                backgroundColor: "#FFFFFF",

                color: "#9EAFB7",

                fontSize: 13,

                fontWeight: 600,

                textTransform: "none",

                "&.Mui-disabled": {
                  borderColor: "#E0E9EE",

                  backgroundColor: "#FFFFFF",

                  color: "#9EAFB7"
                }
              }}
            >
              <Box
                component="span"
                sx={{
                  fontSize: 15,

                  fontWeight: 700,

                  mr: 1
                }}
              >
                G
              </Box>

              Continue with Google
            </Button>

            <Typography
              sx={{
                textAlign: "center",

                color: "#A7B5BC",

                fontSize: 10.5,

                mt: 1
              }}
            >
              Google Sign-In will be available soon
            </Typography>
          </Box>

          {/* =================================================
              SUPPORT
          ================================================= */}

          <Box
            sx={{
              mt: 5,

              pt: 2.5,

              borderTop:
                "1px solid #EDF1F3",

              textAlign: "center"
            }}
          >
            <Typography
              sx={{
                color: "#82949D",

                fontSize: 12.5
              }}
            >
              Need assistance?{" "}

              <Box
                component="span"
                onClick={() => setSupportOpen(true)}
                sx={{
                  color: "#168BC5",

                  fontWeight: 700,

                  cursor: "pointer",

                  "&:hover": {
                    textDecoration: "underline"
                  }
                }}
              >
                Contact Support
              </Box>
            </Typography>

            <Typography
              sx={{
                color: "#B3C0C6",

                fontSize: 10,

                mt: 1
              }}
            >
              Pharmacy Inventory Management · v1.0.0
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>

    {/* =====================================================
        PROFESSIONAL CONTACT SUPPORT DIALOG
    ===================================================== */}

    <Dialog
      open={supportOpen}
      onClose={() => setSupportOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 3,
          p: 1,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              backgroundColor: "#E8F5FA",
              color: "#1385bf",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <SupportAgentIcon fontSize="small" />
          </Box>
          <Typography
            sx={{
              color: "#103F5A",
              fontWeight: 700,
              fontSize: 17
            }}
          >
            Contact IT Support
          </Typography>
        </Box>

        <IconButton
          aria-label="close"
          onClick={() => setSupportOpen(false)}
          sx={{
            color: "#9EAFB8",
            "&:hover": { backgroundColor: "#F1F9FC", color: "#103F5A" }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography 
          dir="rtl"
          sx={{ 
            color: "#607D8B", 
            fontSize: 13.5, 
            mb: 2.5,
            lineHeight: 1.6
          }}
        >
          لأي مشكلة في تسجيل الدخول أو استعادة الحساب، يرجى التواصل مع فريق تقنية المعلومات عبر القنوات التالية:
        </Typography>

        <Box 
          sx={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: 1.5,
            backgroundColor: "#F8FAFC",
            p: 2,
            borderRadius: 2,
            border: "1px solid #E2E8F0"
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ color: "#1385bf", display: "flex" }}>
              <PhoneIcon fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                Internal Extension
              </Typography>
              <Typography sx={{ fontSize: 14, color: "#1E293B", fontWeight: 700 }}>
                Ext. 1234
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "#E2E8F0" }} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ color: "#1385bf", display: "flex" }}>
              <EmailIcon fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                Support Email
              </Typography>
              <Typography sx={{ fontSize: 14, color: "#1E293B", fontWeight: 700 }}>
                it-support@hospital.sa
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => setSupportOpen(value => !value)} // إغلاق النافذة
          sx={{
            textTransform: "none",
            fontWeight: 700,
            backgroundColor: "#1385bf",
            borderRadius: 2,
            py: 1.2,
            boxShadow: "0 4px 12px rgba(19, 133, 191, 0.2)",
            "&:hover": {
              backgroundColor: "#117EAF"
            }
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}


/* =========================================================
   INPUT STYLE
========================================================= */

const inputStyle = {
  "& .MuiOutlinedInput-root": {
    height: 54,

    borderRadius: 1.8,

    backgroundColor: "#FFFFFF",

    "& fieldset": {
      borderColor: "#D8E5EB"
    },

    "&:hover fieldset": {
      borderColor: "#AFC7D3"
    },

    "&.Mui-focused fieldset": {
      borderColor: "#168BC5",

      borderWidth: 1.5
    }
  },

  "& input": {
    fontSize: 14,

    color: "#173F55"
  },

  "& input::placeholder": {
    color: "#9EAFB8",

    opacity: 1
  }
};
export default Login;