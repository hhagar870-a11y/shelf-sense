import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  Popover,
  InputAdornment,
  IconButton,
  Link,
  Divider
} from "@mui/material";
import { Mail, MessageCircle, User, Lock, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { login } from "../../utils/auth";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // حالة الـ Popover الخاص بالدعم (يفتح بالهوفر ويتعطل إغلاقه السريع)
  const [supportAnchor, setSupportAnchor] = useState(null);
  const isSupportOpen = Boolean(supportAnchor);

  const handleSupportOpen = (event) => {
    setSupportAnchor(event.currentTarget);
  };

  const handleSupportClose = () => {
    setSupportAnchor(null);
  };

  // العودة لصفحة Welcome فوراً عند الضغط على السهم الأسفل (ArrowDown)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [navigate]);

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
          width: "100vw",
          height: "100vh",
          maxHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
          overflow: "hidden",
          position: "fixed",
          top: 0,
          left: 0,
          px: 3,
          py: 4,
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          
          animation: "fadeInSlide 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          "@keyframes fadeInSlide": {
            "0%": {
              opacity: 0,
              transform: "translateY(20px)"
            },
            "100%": {
              opacity: 1,
              transform: "translateY(0)"
            }
          },

          "& *": {
            fontFamily: "Inter, Segoe UI, Arial, sans-serif",
            boxSizing: "border-box"
          }
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 470,
            backgroundColor: "#FFFFFF",
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)",
            border: "1px solid #E5EEF3"
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 4
            }}
          >
            <Box
              component="img"
              src="/logo.png"
              alt="Hail Health Cluster"
              sx={{
                width: 240,
                height: "auto",
                objectFit: "contain"
              }}
            />
          </Box>

          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Typography
              sx={{
                color: "#052f46",
                fontSize: { xs: 26, md: 32 },
                fontWeight: 300,
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
                mb: 1
              }}
            >
              Sign in to your account
            </Typography>

            <Typography
              sx={{
                color: "#718893",
                fontSize: 13.5,
                lineHeight: 1.6
              }}
            >
              Enter your credentials to access the pharmacy inventory system.
            </Typography>
          </Box>

          <Box
            component="form"
            onSubmit={handleSignIn}
          >
            <Typography
              sx={{
                color: "#294C60",
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

              {/* Forgot password تتفعل بالقائمة المنسدلة عند مرور الماوس */}
              <Link
                component="span"
                onMouseEnter={handleSupportOpen}
                sx={{
                  fontSize: 13,
                  color: "#1385bf",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" }
                }}
              >
                Forgot password?
              </Link>
            </Box>

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
                boxShadow: "0 7px 18px rgba(22,139,197,0.16)",
                "&:hover": {
                  backgroundColor: "#117EAF",
                  boxShadow: "0 9px 22px rgba(22,139,197,0.20)"
                }
              }}
            >
              Sign In
            </Button>

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

          <Box
            sx={{
              mt: 4,
              pt: 2.5,
              borderTop: "1px solid #EDF1F3",
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
              {/* Contact Support تتفعل بالقائمة المنسدلة عند مرور الماوس */}
              <Box
                component="span"
                onMouseEnter={handleSupportOpen}
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

      {/* =====================================================
          POPOVER SUPPORT (تفتح بمجرد تمرير الماوس باحترافية)
      ===================================================== */}
      <Popover
        open={isSupportOpen}
        anchorEl={supportAnchor}
        onClose={handleSupportClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        disableRestoreFocus
        slotProps={{
          paper: {
            onMouseLeave: handleSupportClose,
            sx: {
              mb: 1.5,
              p: 3,
              width: 340,
              borderRadius: "16px",
              boxShadow: "0 15px 35px rgba(0,0,0,0.1)",
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
            }
          }
        }}
      >
        <Typography
          sx={{
            color: "#0F172A",
            fontWeight: 700,
            fontSize: 16,
            mb: 0.8
          }}
        >
          Contact Support
        </Typography>

        <Typography sx={{ color: "#64748B", fontSize: 12.5, mb: 2, lineHeight: 1.5 }}>
          For any sign-in issues or account assistance, please contact via:
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
          <Button
            variant="contained"
            startIcon={<Mail size={16} />}
            onClick={handleEmailClick}
            sx={{
              bgcolor: "#0284c7",
              color: "#ffffff",
              textTransform: "none",
              borderRadius: "10px",
              py: 1,
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow: "none",
              justifyContent: "flex-start",
              px: 2.5,
              "&:hover": { bgcolor: "#0369a1", boxShadow: "none" }
            }}
          >
            hajarralhmaidi@gmail.com
          </Button>

          <Button
            variant="outlined"
            startIcon={<MessageCircle size={16} color="#16a34a" />}
            onClick={handleWhatsappClick}
            sx={{
              borderColor: "#CBD5E1",
              color: "#334155",
              textTransform: "none",
              borderRadius: "10px",
              py: 1,
              fontSize: 12.5,
              fontWeight: 600,
              justifyContent: "flex-start",
              px: 2.5,
              "&:hover": { borderColor: "#0284c7", bgcolor: "#F8FAFC" }
            }}
          >
            Contact via WhatsApp
          </Button>
        </Box>
      </Popover>
    </>
  );
}

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
    },
    "& input:-webkit-autofill": {
      WebkitBoxShadow: "0 0 0 1000px #FFFFFF inset",
      WebkitTextFillColor: "#173F55",
      transition: "background-color 5000s ease-in-out 0s"
    }
  },
  "& input": {
    fontSize: 14,
    color: "#173F55",
    backgroundColor: "transparent"
  },
  "& input::placeholder": {
    color: "#9EAFB8",
    opacity: 1
  }
};

export default Login;