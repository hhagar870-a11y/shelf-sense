import { useEffect, useRef, useState } from "react";

import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Box,
} from "@mui/material";

import { BrowserMultiFormatReader } from "@zxing/browser"
import { BarcodeFormat, DecodeHintType } from "@zxing/library"

function SmartScan() {
  const videoRef = useRef(null);

  const [barcode, setBarcode] = useState("");
  const [medicine, setMedicine] = useState(null);

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
      (result, err) => {
  if (result) {
    const text = result.getText();

    setBarcode(text);

    const foundMedicine = medicines.find(
      (item) => item.barcode === text
    );

    if (foundMedicine) {
      setMedicine(foundMedicine);
    } else {
      setMedicine({
        name: "Unknown Medicine",
        batch: "-",
        expiry: "-",
        quantity: "-",
        shelf: "-",
        status: "Not Found",
      });
    }
  }

  if (err) {
    console.error(err);
  }
   }
    );

    return () => {
      codeReader.reset();
    };
  }, []);

  return (
    <Container sx={{ mt: 5 }}>
      <Typography
        variant="h4"
        fontWeight="bold"
        textAlign="center"
        gutterBottom
      >
        📷 Smart Medicine Scanner
      </Typography>

      <video
        ref={videoRef}
        style={{
          width: "100%",
          maxWidth: "700px",
          borderRadius: "15px",
          border: "4px solid #1976d2",
          display: "block",
          margin: "auto",
        }}
      />
          <Typography
        textAlign="center"
        sx={{ mt: 3 }}
      >
        Last Barcode:
      </Typography>

      <Typography
        textAlign="center"
        fontWeight="bold"
        color="primary"
        sx={{ mb: 3 }}
      >
        {barcode || "Waiting..."}
      </Typography>

      {medicine && (
        <Card sx={{ mt: 2 }}>
          <CardContent>

            <Typography variant="h5" gutterBottom>
              💊 {medicine.name}
            </Typography>

            <Typography>
              📦 Batch Number: {medicine.batch}
            </Typography>

            <Typography>
              📅 Expiry Date: {medicine.expiry}
            </Typography>

            <Typography>
              📊 Quantity: {medicine.quantity}
            </Typography>

            <Typography>
              🗂 Shelf: {medicine.shelf}
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Chip
                label={medicine.status}
                color={
                  medicine.status === "Safe"
                    ? "success"
                    : "error"
                }
              />
            </Box>

          </CardContent>
        </Card>
      )}

      <Button
        variant="contained"
        fullWidth
        sx={{ mt: 3 }}
        onClick={() => {
          setBarcode("");
          setMedicine(null);
        }}
      >
        Scan Again
      </Button>

    </Container>
  );
}

export default SmartScan;