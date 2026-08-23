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
  InputAdornment,
  IconButton,
  Link,
  Divider
} from "@mui/material";
import { Mail, MessageCircle, User, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { login } from "../../utils/auth";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const [supportOpen, setSupportOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailClick = () => {
    window.location.href = "mailto:hajarralhmaidi@gmail.com";
  };

  const handleWhatsappClick = () => {
    window.open("https://wa.me/966553994025", "_blank");
  };

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
        width: 250,
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
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <User size={18} color="#9EAFB8" />
                    </InputAdornment>
                  )
                }
              }}
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
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={18} color="#9EAFB8" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#9EAFB8" />
                        ) : (
                          <Eye size={18} color="#9EAFB8" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
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
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 1.5
              }}
            >
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
                sx={{ margin: 0 }}
              />

              <Link
                component="button"
                type="button"
                onClick={() => setSupportOpen(true)}
                sx={{
                  fontSize: 13,
                  color: "#1385bf",
                  fontWeight: 600,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" }
                }}
              >
                Forgot password?
              </Link>
            </Box>

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

            <Divider sx={{ my: 2.5, color: "#B3C0C6", fontSize: 12 }}>or</Divider>

            <Button
              fullWidth
              disabled
              variant="outlined"
              sx={{
                height: 50,

                borderRadius: 1.8,

                borderColor: "#E0E9EE",

                backgroundColor: "#FFFFFF",

                color: "#9EAFB7",

                fontSize: 13,

                fontWeight: 600,

                textTransform: "none",

                gap: 1,

                "&.Mui-disabled": {
                  borderColor: "#E0E9EE",

                  backgroundColor: "#FFFFFF",

                  color: "#9EAFB7"
                }
              }}
            >
              <Box
                component="svg"
                viewBox="0 0 48 48"
                sx={{ width: 17, height: 17, opacity: 0.55 }}
              >
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.3 0 10.2-2 13.9-5.4l-6.4-5.4C29.4 34.9 26.8 36 24 36c-5.4 0-9.9-3.4-11.5-8.2l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.7 4.8-5 6.2l6.4 5.4C39.6 37.5 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
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
        CONTACT SUPPORT DIALOG (باللغة الإنجليزية وبدون ذكر IT)
    ===================================================== */}

    <Dialog
      open={supportOpen}
      onClose={() => setSupportOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle
        sx={{
          color: "#103F5A",
          fontWeight: 700,
          fontSize: 18
        }}
      >
        Contact Support
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ color: "#607D8B", fontSize: 13.5, mb: 2.5 }}>
          For any sign-in issues or account assistance, please contact support via:
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<Mail size={18} />}
            onClick={handleEmailClick}
            sx={{
              bgcolor: "#0284c7",
              color: "#ffffff",
              textTransform: "none",
              borderRadius: 2.5,
              py: 1.2,
              fontWeight: 600,
              boxShadow: "none",
              justifyContent: "flex-start",
              px: 3,
              "&:hover": { bgcolor: "#0369a1", boxShadow: "none" }
            }}
          >
            hajarralhmaidi@gmail.com
          </Button>

          <Button
            variant="outlined"
            startIcon={<MessageCircle size={18} color="#16a34a" />}
            onClick={handleWhatsappClick}
            sx={{
              borderColor: "#cbd5e1",
              color: "#334155",
              textTransform: "none",
              borderRadius: 2.5,
              py: 1.2,
              fontWeight: 600,
              justifyContent: "flex-start",
              px: 3,
              "&:hover": { borderColor: "#0284c7", bgcolor: "#f8fafc" }
            }}
          >
            Contact via WhatsApp
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={() => setSupportOpen(false)}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            color: "#1385bf"
          }}
        >
          Close
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