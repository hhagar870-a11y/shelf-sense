import React, { useEffect, useState } from "react";
import { Container, Box, Typography, Paper } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import ScannedMedicineCard from "./ScannedMedicineCard";

/* ============================================================
   QRLanding — this is what a printed label's QR code opens.
   Add a route for it in App.jsx:

     import QRLanding from "./pages/QRLanding";
     ...
     <Route path="/scan-result" element={<QRLanding />} />

   No Sidebar on purpose — someone scanning a label with their
   phone should land straight on the medicine info, no app chrome.

   If the label's QR had a custom message attached (written in the
   Label Editor's Content tab), it's stored in Firestore under
   qrMessages/{msg} and shown here above the medicine card.
   ============================================================ */

export default function QRLanding() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";
  const msgId = searchParams.get("msg") || "";
  const [messageHtml, setMessageHtml] = useState("");

  useEffect(() => {
    if (!msgId) return;
    async function fetchMessage() {
      try {
        const snap = await getDoc(doc(db, "qrMessages", msgId));
        if (snap.exists()) setMessageHtml(snap.data().html || "");
      } catch (err) {
        console.error("Failed to load QR message:", err);
      }
    }
    fetchMessage();
  }, [msgId]);

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box component="img" src="/logo.png" alt="Hail Health Cluster" sx={{ width: 190, height: "auto" }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Shelf Sense</Typography>
          <Typography variant="body2" sx={{ color: "#6b7280" }}>Scanned label details</Typography>
        </Box>
      </Box>

      {messageHtml && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid #e5e7eb", bgcolor: "#FFFBEB" }}>
          <Typography variant="caption" sx={{ color: "#9ca3af", fontWeight: 700, display: "block", mb: 0.5 }}>Message</Typography>
          <Box sx={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: messageHtml }} />
        </Paper>
      )}

      <ScannedMedicineCard scannedCode={code} />
    </Container>
  );
}