import React from "react";
import { Container, Box, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import ScannedMedicineCard from "./ScannedMedicineCard";

/* ============================================================
   QRLanding — this is what a printed label's QR code opens.
   Add a route for it in App.jsx:

     import QRLanding from "./pages/QRLanding";
     ...
     <Route path="/scan-result" element={<QRLanding />} />

   No Sidebar on purpose — someone scanning a label with their
   phone should land straight on the medicine info, no app chrome.
   ============================================================ */

export default function QRLanding() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Shelf Sense</Typography>
        <Typography variant="body2" sx={{ color: "#6b7280" }}>Scanned label details</Typography>
      </Box>
      <ScannedMedicineCard scannedCode={code} />
    </Container>
  );
}