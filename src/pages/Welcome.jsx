import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

function Welcome() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);

  const handleNavigate = () => {
    setIsExiting(true); 
    setTimeout(() => {
      navigate("/login"); 
    }, 500); 
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        handleNavigate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        maxHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "fixed",
        top: 0,
        left: 0,
        backgroundImage: `url('/bg-image.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
        px: { xs: 4, sm: 8, md: 12 },
        
        transform: isExiting ? "translateY(100vh)" : "translateY(0)",
        transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)", 
      }}
    >
      {/* 1. اللوجو (تم نقله يميناً قليلاً ليتسق مع بقية المحتوى) */}
      <Box
        component="img"
        src="/logo.png"
        alt="Hail Health Cluster"
        sx={{
          position: "absolute",
          top: { xs: 25, md: 35 },
          left: { xs: 45, sm: 80, md: 125 }, // زِدنا المسافة من اليسار لكي يتحرك اللوجو يميناً
          width: 230, 
          height: "auto",
          objectFit: "contain",
          zIndex: 3,
        }}
      />

      {/* 2. صندوق النصوص (بمكانه الوسطي الجميل والمقرب لليمين) */}
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          maxWidth: 500,
          mt: { xs: 2, md: 3 },  
          ml: { xs: 0, md: 5 },   
          p: { xs: 2, md: 0 },
        }}
      >
        <Typography
          sx={{
            color: "#1385bf",
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "1.4px",
            mb: 1.5,
          }}
        >
          PHARMACY MANAGEMENT SYSTEM
        </Typography>

        {/* العنوان الرئيسي بخط نحيف وأنيق (Thin) */}
        <Typography
          sx={{
            color: "#052f46",
            fontSize: { xs: 32, sm: 38, md: 44 },
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            mb: 2,
          }}
        >
          Integrated Pharmacy
          <br />
          Management System
        </Typography>

        <Box
          sx={{
            width: 48,
            height: 3.5,
            borderRadius: 10,
            backgroundColor: "#1385bf",
            mb: 2.2,
          }}
        />

        <Typography
          sx={{
            color: "#566c77",
            fontSize: { xs: 13.5, md: 14.5 },
            fontWeight: 400,
            lineHeight: 1.65,
            mb: 3.5,
            maxWidth: 440,
          }}
        >
          An integrated solution for managing pharmacy inventory, connected orders, label printing, and crash carts — all in one system.
        </Typography>

        {/* زر Get Started نظيف ومرتب */}
        <Button
          variant="contained"
          endIcon={<ArrowForwardRoundedIcon />}
          onClick={handleNavigate}
          sx={{
            height: 48,
            px: 4,
            borderRadius: 2,
            backgroundColor: "#1385bf",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 700,
            textTransform: "none",
            boxShadow: "0 6px 16px rgba(19,133,191,0.2)",
            "&:hover": {
              backgroundColor: "#1385bf",
              boxShadow: "0 8px 20px rgba(19,133,191,0.28)",
            },
          }}
        >
          Get Started
        </Button>
      </Box>
    </Box>
  );
}

export default Welcome;