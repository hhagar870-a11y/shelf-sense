import { useEffect, useRef, useState } from "react";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Box,
  Paper,
  Divider
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

function SmartScan() {
  const videoRef = useRef(null);
  const [barcode, setBarcode] = useState("");
  const [medicine, setMedicine] = useState(null);
  const navigate = useNavigate();
  
  const medicines = JSON.parse(
    localStorage.getItem("medicines") || "[]"
  );

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.QR_CODE,
    ]);

    const codeReader = new BrowserMultiFormatReader(hints);
    codeReader.decodeFromVideoDevice(
      undefined,
      videoRef.current,
      (result) => {
        if (result) {
          const text = result.getText();
          setBarcode(text);
          const foundMedicine = medicines.find((item) => item.barcode === text);
          setMedicine(foundMedicine || {
            name: "Unregistered Item",
            barcode: text,
            batch: "-",
            expiry: "-",
            quantity: "-",
            shelf: "-",
            status: "Not Found",
          });
        }
      }
    );

    return () => {
      if (codeReader.stopContinuousDecode) {
        codeReader.stopContinuousDecode();
      }
    };
  }, []);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const image = new Image();
    image.src = URL.createObjectURL(file);

    image.onload = async () => {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        const result = await reader.decodeFromImageElement(image);
        const text = result.getText();
        setBarcode(text);

        const foundMedicine = medicines.find((item) => item.barcode === text);
        setMedicine(foundMedicine || {
          name: "Unregistered Item",
          barcode: text,
          batch: "-",
          expiry: "-",
          quantity: "-",
          shelf: "-",
          status: "Not Found",
        });
      } catch (err) {
        alert("No barcode detected in the image");
      }
    };
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Sidebar />

      {/* الهيدر المتناسق والمرتب */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3, 
          bgcolor: "#ffffff", 
          border: "1px solid #e2e8f0",
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          flexWrap: "wrap", 
          gap: 2 
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: 2.5, 
              bgcolor: "#eaf5ff", 
              color: "#1985cd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <QrCodeScannerIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight="700" sx={{ color: "#1985cd" }}>
              Smart Optical Scanner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enterprise Module • Barcode & Data Matrix Verification
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<SupportAgentIcon />}
          onClick={() => navigate("/support")}
          sx={{
            borderColor: "#1985cd",
            color: "#1985cd",
            borderRadius: 2.5,
            textTransform: "none",
            fontWeight: 600,
            px: 2.5,
            py: 1,
            "&:hover": { borderColor: "#146cbe", bgcolor: "#f0f7ff" }
          }}
        >
          Contact & Support
        </Button>
      </Paper>

      {/* بانر التنبيه */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2.5, 
          mb: 3, 
          borderRadius: 3, 
          bgcolor: "#f8fafc", 
          border: "1px solid #e2e8f0",
          display: "flex",
          gap: 2,
          alignItems: "flex-start"
        }}
      >
        <InfoOutlinedIcon sx={{ color: "#1985cd", mt: 0.3 }} />
        <Box>
          <Typography variant="subtitle2" fontWeight="700" sx={{ color: "#1985cd" }} gutterBottom>
            Module Status: Under Active Development / قيد التطوير المستمر
          </Typography>
          <Typography variant="body2" color="#475569" sx={{ lineHeight: 1.6 }}>
            This optical scanner interface is provisioned for upcoming clinical integrations. Core decoding modules are currently in a sandbox environment and not deployed for live inventory transactions.<br />
            هذه الواجهة مخصصة للمشروع المستقبلي لقراءة الباركودات دوائياً، وهي متاحة حالياً كمعاينة تقنية وليست مفعلة للاعتماد السريري النهائي.
          </Typography>
        </Box>
      </Paper>

      {/* منطقة الكاميرا بحجم متوازن وأنيق */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          bgcolor: "#ffffff", 
          border: "1px solid #e2e8f0"
        }}
      >
        <Box 
          sx={{ 
            position: "relative", 
            width: "100%", 
            maxWidth: "560px", 
            height: "260px", 
            mx: "auto",
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: "#0f172a",
            border: "2px solid #1985cd"
          }}
        >
          <video
            ref={videoRef}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </Box>

        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", px: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="500">
            Detection Status
          </Typography>
          <Chip 
            label={barcode ? `Detected: ${barcode}` : "Awaiting scan input..."} 
            size="small"
            sx={{ 
              fontWeight: 600, 
              bgcolor: barcode ? "#ecfdf5" : "#f1f5f9",
              color: barcode ? "#047857" : "#475569",
              border: `1px solid ${barcode ? "#a7f3d0" : "#e2e8f0"}`
            }}
          />
        </Box>
      </Paper>

      {/* عرض تفاصيل الدواء */}
      {medicine && (
        <Card elevation={0} sx={{ mt: 3, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight="700" sx={{ color: "#1985cd" }} gutterBottom>
              {medicine.name}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 2 }}>
              <Typography variant="body2" color="text.secondary">Batch Number: <Box component="span" sx={{ color: "#1e293b", fontWeight: 600 }}>{medicine.batch}</Box></Typography>
              <Typography variant="body2" color="text.secondary">Expiry Date: <Box component="span" sx={{ color: "#1e293b", fontWeight: 600 }}>{medicine.expiry}</Box></Typography>
              <Typography variant="body2" color="text.secondary">Quantity: <Box component="span" sx={{ color: "#1e293b", fontWeight: 600 }}>{medicine.quantity}</Box></Typography>
              <Typography variant="body2" color="text.secondary">Shelf Location: <Box component="span" sx={{ color: "#1e293b", fontWeight: 600 }}>{medicine.shelf}</Box></Typography>
            </Box>
            <Box sx={{ mt: 3 }}>
              <Chip
                label={medicine.status}
                size="small"
                color={medicine.status === "Safe" ? "success" : "default"}
              />
            </Box>
          </CardContent>
          {medicine.status === "Not Found" && (
            <Button
              variant="contained"
              fullWidth
              sx={{ 
                borderRadius: 0, 
                py: 1.5, 
                bgcolor: "#1985cd", 
                textTransform: "none",
                "&:hover": { bgcolor: "#146cbe" }
              }}
              onClick={() =>
                navigate("/inventory", {
                  state: { barcode: medicine.barcode },
                })
              }
            >
              Add Item to Inventory Registry
            </Button>
          )}
        </Card>
      )}

      {/* الأزرار السفلية */}
      <Box sx={{ mt: 3, display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
        <Button
          variant="contained"
          startIcon={<ReplayOutlinedIcon />}
          fullWidth
          sx={{ 
            py: 1.5, 
            borderRadius: 2.5, 
            textTransform: "none", 
            fontWeight: 600,
            bgcolor: "#1985cd",
            boxShadow: "none",
            "&:hover": { bgcolor: "#146cbe", boxShadow: "none" }
          }}
          onClick={() => {
            setBarcode("");
            setMedicine(null);
          }}
        >
          Reset Scanner
        </Button>

        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileOutlinedIcon />}
          fullWidth
          sx={{ 
            py: 1.5, 
            borderRadius: 2.5, 
            textTransform: "none", 
            fontWeight: 600,
            borderColor: "#cbd5e1",
            color: "#1985cd",
            bgcolor: "#ffffff",
            "&:hover": { borderColor: "#1985cd", bgcolor: "#f8fafc" }
          }}
        >
          Upload Barcode Image
          <input
            hidden
            accept="image/*"
            type="file"
            onChange={handleImageUpload}
          />
        </Button>
      </Box>
    </Container>
  );
}

export default SmartScan;